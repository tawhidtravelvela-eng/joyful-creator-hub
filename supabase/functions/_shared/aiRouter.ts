// Shared AI router for all edge functions.
// Resolves task_key → provider+model+fallback from `ai_task_configs`,
// dispatches to the right provider, and logs usage to `ai_usage_logs`.
//
// Usage:
//   import { runAITask } from "../_shared/aiRouter.ts";
//   const { content, toolCall } = await runAITask({
//     taskKey: "trip-planner-generate",
//     supabase,
//     messages: [{ role: "user", content: "..." }],
//     tools: [...],            // optional
//     toolChoice: { ... },     // optional
//   });

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRunOptions = {
  taskKey: string;
  supabase?: SupabaseClient;
  messages: ChatMessage[];
  tools?: any[];
  toolChoice?: any;
  responseFormat?: any;
  // Hard overrides (rare — admin config wins by default)
  overrideProvider?: string;
  overrideModel?: string;
  overrideTemperature?: number;
  overrideMaxTokens?: number;
  // For OCR / image input (Gemini direct only)
  inlineImage?: { mimeType: string; data: string };
  // If true, skip auto-waterfall expansion (use only the explicit chain).
  disableAutoWaterfall?: boolean;
};

export type AIRunResult = {
  content: string;
  toolCall?: { name: string; args: any };
  provider: string;
  model: string;
  attemptCount: number;
  durationMs: number;
};

interface TaskConfig {
  task_key: string;
  provider: string;
  model: string;
  fallback_chain: { provider: string; model: string }[];
  temperature: number | null;
  max_tokens: number | null;
  enabled: boolean;
}

interface ProviderRow {
  provider: string;
  secret_name: string;
  base_url: string | null;
  is_active: boolean;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let _providerCache: Map<string, ProviderRow> | null = null;
let _providerCacheAt = 0;
const PROVIDER_CACHE_MS = 60_000;

async function getProviders(supabase: SupabaseClient): Promise<Map<string, ProviderRow>> {
  if (_providerCache && Date.now() - _providerCacheAt < PROVIDER_CACHE_MS) return _providerCache;
  const { data } = await supabase.from("ai_provider_keys").select("provider, secret_name, base_url, is_active");
  const map = new Map<string, ProviderRow>();
  (data || []).forEach((r: any) => map.set(r.provider, r));
  _providerCache = map;
  _providerCacheAt = Date.now();
  return map;
}

async function getTaskConfig(supabase: SupabaseClient, taskKey: string): Promise<TaskConfig | null> {
  const { data } = await supabase
    .from("ai_task_configs")
    .select("task_key, provider, model, fallback_chain, temperature, max_tokens, enabled")
    .eq("task_key", taskKey)
    .maybeSingle();
  return (data as any) || null;
}

async function logUsage(
  supabase: SupabaseClient,
  args: {
    taskKey: string;
    provider: string;
    model: string;
    durationMs: number;
    success: boolean;
    routeReason: string;
    inputTokens?: number;
    outputTokens?: number;
  },
) {
  try {
    await supabase.from("ai_usage_logs").insert({
      function_name: args.taskKey,
      provider: args.provider,
      model: args.model,
      duration_ms: args.durationMs,
      success: args.success,
      route_reason: args.routeReason,
      input_tokens: args.inputTokens || null,
      output_tokens: args.outputTokens || null,
      total_tokens: (args.inputTokens || 0) + (args.outputTokens || 0) || null,
    });
  } catch (e) {
    console.warn("[aiRouter] usage log failed:", (e as Error).message);
  }
}

// ---------------- Provider adapters ----------------

async function callLovableGateway(
  apiKey: string,
  baseUrl: string,
  model: string,
  opts: AIRunOptions,
  temperature: number,
  maxTokens: number,
) {
  const body: any = {
    model,
    messages: opts.messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (opts.responseFormat) body.response_format = opts.responseFormat;

  const resp = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`lovable ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const choice = json?.choices?.[0]?.message;
  const tc = choice?.tool_calls?.[0];
  return {
    content: choice?.content || "",
    toolCall: tc ? { name: tc.function?.name, args: JSON.parse(tc.function?.arguments || "{}") } : undefined,
    inputTokens: json?.usage?.prompt_tokens,
    outputTokens: json?.usage?.completion_tokens,
  };
}

async function callOpenAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  opts: AIRunOptions,
  temperature: number,
  maxTokens: number,
) {
  // OpenAI direct uses identical body shape as the Lovable gateway
  return callLovableGateway(apiKey, baseUrl, model, opts, temperature, maxTokens);
}

async function callGoogleGemini(
  apiKey: string,
  baseUrl: string,
  model: string,
  opts: AIRunOptions,
  temperature: number,
  maxTokens: number,
) {
  // baseUrl: https://generativelanguage.googleapis.com/v1beta/models
  const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;
  const sysMsg = opts.messages.find((m) => m.role === "system");
  const convMsgs = opts.messages.filter((m) => m.role !== "system");
  const contents: any[] = convMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  if (opts.inlineImage && contents.length > 0) {
    contents[contents.length - 1].parts.push({
      inlineData: { mimeType: opts.inlineImage.mimeType, data: opts.inlineImage.data },
    });
  }
  const body: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (sysMsg) body.systemInstruction = { parts: [{ text: sysMsg.content }] };
  if (opts.responseFormat?.type === "json_object") body.generationConfig.responseMimeType = "application/json";
  if (opts.tools) {
    body.tools = [{
      functionDeclarations: opts.tools.map((t: any) => ({
        name: t.function?.name,
        description: t.function?.description,
        parameters: t.function?.parameters,
      })),
    }];
    if (opts.toolChoice?.function?.name) {
      body.toolConfig = {
        functionCallingConfig: { mode: "ANY", allowedFunctionNames: [opts.toolChoice.function.name] },
      };
    }
  }
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`google ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const cand = json?.candidates?.[0];
  const parts = cand?.content?.parts || [];
  const textPart = parts.find((p: any) => typeof p.text === "string");
  const fnPart = parts.find((p: any) => p.functionCall);
  return {
    content: textPart?.text || "",
    toolCall: fnPart?.functionCall
      ? { name: fnPart.functionCall.name, args: fnPart.functionCall.args || {} }
      : undefined,
    inputTokens: json?.usageMetadata?.promptTokenCount,
    outputTokens: json?.usageMetadata?.candidatesTokenCount,
  };
}

async function callAnthropic(
  apiKey: string,
  baseUrl: string,
  model: string,
  opts: AIRunOptions,
  temperature: number,
  maxTokens: number,
) {
  const sysMsg = opts.messages.find((m) => m.role === "system");
  const convMsgs = opts.messages.filter((m) => m.role !== "system");
  const body: any = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: convMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (sysMsg) body.system = sysMsg.content;
  if (opts.tools) {
    body.tools = opts.tools.map((t: any) => ({
      name: t.function?.name,
      description: t.function?.description,
      input_schema: t.function?.parameters,
    }));
    if (opts.toolChoice?.function?.name) {
      body.tool_choice = { type: "tool", name: opts.toolChoice.function.name };
    }
  }
  const resp = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`anthropic ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  const blocks = json?.content || [];
  const textBlock = blocks.find((b: any) => b.type === "text");
  const toolBlock = blocks.find((b: any) => b.type === "tool_use");
  return {
    content: textBlock?.text || "",
    toolCall: toolBlock ? { name: toolBlock.name, args: toolBlock.input || {} } : undefined,
    inputTokens: json?.usage?.input_tokens,
    outputTokens: json?.usage?.output_tokens,
  };
}

// ---------------- Public API ----------------

export async function runAITask(opts: AIRunOptions): Promise<AIRunResult> {
  const supabase = opts.supabase ?? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const config = await getTaskConfig(supabase, opts.taskKey);

  // Build attempt chain
  const attempts: { provider: string; model: string }[] = [];
  if (opts.overrideProvider && opts.overrideModel) {
    attempts.push({ provider: opts.overrideProvider, model: opts.overrideModel });
  } else if (config?.enabled) {
    attempts.push({ provider: config.provider, model: config.model });
    (config.fallback_chain || []).forEach((f) => attempts.push(f));
  } else {
    // No config or disabled → default to Lovable gateway
    attempts.push({ provider: "lovable", model: "google/gemini-3-flash-preview" });
  }

  // ---- Auto-waterfall expansion ----
  // For each attempt, automatically add Cloudflare Gateway + Direct provider as
  // implicit fallbacks (deduped). Admin only needs to pick ONE primary model;
  // the router transparently tries: Lovable → Cloudflare → Direct.
  const expanded: { provider: string; model: string }[] = [];
  const seen = new Set<string>();
  const push = (p: string, m: string) => {
    const k = `${p}::${m}`;
    if (seen.has(k)) return;
    seen.add(k);
    expanded.push({ provider: p, model: m });
  };
  for (const a of attempts) {
    push(a.provider, a.model);
    if (opts.disableAutoWaterfall) continue;
    const variants = waterfallVariants(a.provider, a.model);
    for (const v of variants) push(v.provider, v.model);
  }
  const finalAttempts = expanded;

  const temperature = opts.overrideTemperature ?? config?.temperature ?? 0.7;
  const maxTokens = opts.overrideMaxTokens ?? config?.max_tokens ?? 4096;
  const providers = await getProviders(supabase);

  let lastErr: Error | null = null;
  for (let i = 0; i < finalAttempts.length; i++) {
    const { provider, model } = finalAttempts[i];
    const meta = providers.get(provider);
    if (!meta || !meta.is_active) {
      lastErr = new Error(`provider ${provider} not active`);
      continue;
    }
    let apiKey = Deno.env.get(meta.secret_name);
    if (!apiKey) {
      // Fallback: read from Vault (admin-managed via UI)
      try {
        const { data: vaultKey } = await supabase.rpc("read_provider_secret", { p_name: meta.secret_name });
        if (vaultKey && typeof vaultKey === "string") apiKey = vaultKey;
      } catch (_e) { /* ignore */ }
    }
    if (!apiKey) {
      lastErr = new Error(`no key for ${provider} (${meta.secret_name})`);
      continue;
    }
    const baseUrl = meta.base_url || "";
    const t0 = Date.now();
    try {
      let res;
      if (provider === "lovable") res = await callLovableGateway(apiKey, baseUrl, model, opts, temperature, maxTokens);
      else if (provider === "openai") res = await callOpenAI(apiKey, baseUrl, model, opts, temperature, maxTokens);
      else if (provider === "cloudflare") res = await callOpenAI(apiKey, baseUrl, model, opts, temperature, maxTokens);
      else if (provider === "google") res = await callGoogleGemini(apiKey, baseUrl, model, opts, temperature, maxTokens);
      else if (provider === "anthropic") res = await callAnthropic(apiKey, baseUrl, model, opts, temperature, maxTokens);
      else throw new Error(`unknown provider ${provider}`);

      const durationMs = Date.now() - t0;
      logUsage(supabase, {
        taskKey: opts.taskKey,
        provider,
        model,
        durationMs,
        success: true,
        routeReason: i === 0 ? "primary" : `fallback#${i}`,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
      });
      return {
        content: res.content,
        toolCall: res.toolCall,
        provider,
        model,
        attemptCount: i + 1,
        durationMs,
      };
    } catch (e) {
      lastErr = e as Error;
      const durationMs = Date.now() - t0;
      logUsage(supabase, {
        taskKey: opts.taskKey,
        provider,
        model,
        durationMs,
        success: false,
        routeReason: `error: ${(e as Error).message.slice(0, 80)}`,
      });
      console.warn(`[aiRouter] attempt ${i + 1} (${provider}/${model}) failed:`, (e as Error).message);
      continue;
    }
  }
  throw new Error(`All ${finalAttempts.length} AI providers failed for task ${opts.taskKey}: ${lastErr?.message}`);
}

// ---------------- Auto-waterfall helpers ----------------

// Strips known provider prefixes from a model id (e.g. "google/gemini-3-flash-preview" -> "gemini-3-flash-preview").
function stripPrefix(model: string): { family: "google" | "openai" | "anthropic" | null; bare: string } {
  if (model.startsWith("google/")) return { family: "google", bare: model.slice("google/".length) };
  if (model.startsWith("google-ai-studio/")) return { family: "google", bare: model.slice("google-ai-studio/".length) };
  if (model.startsWith("openai/")) return { family: "openai", bare: model.slice("openai/".length) };
  if (model.startsWith("anthropic/")) return { family: "anthropic", bare: model.slice("anthropic/".length) };
  // Heuristic detection from bare name
  if (/^gemini[-_]/i.test(model)) return { family: "google", bare: model };
  if (/^gpt[-_]/i.test(model)) return { family: "openai", bare: model };
  if (/^claude[-_]/i.test(model)) return { family: "anthropic", bare: model };
  return { family: null, bare: model };
}

// Given a primary (provider, model), return the implicit waterfall fallbacks:
//   Lovable primary → Cloudflare same model → Direct provider same model.
// Cloudflare uses provider-prefixed names (openai/, google-ai-studio/, anthropic/).
// Direct providers use the bare model name.
function waterfallVariants(provider: string, model: string): { provider: string; model: string }[] {
  const { family, bare } = stripPrefix(model);
  const out: { provider: string; model: string }[] = [];

  // Cloudflare prefix per family
  const cfPrefix = family === "google" ? "google-ai-studio" : family;
  const cfModel = family ? `${cfPrefix}/${bare}` : model;

  if (provider === "lovable") {
    // Lovable → Cloudflare → Direct
    if (family) out.push({ provider: "cloudflare", model: cfModel });
    if (family) out.push({ provider: family, model: bare });
  } else if (provider === "cloudflare") {
    // Cloudflare → Direct
    if (family) out.push({ provider: family, model: bare });
  } else if (provider === "google" || provider === "openai" || provider === "anthropic") {
    // Direct → Cloudflare (in case direct keys are throttled)
    out.push({ provider: "cloudflare", model: cfModel });
  }
  return out;
}
