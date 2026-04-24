// Studio — AI Rewrite Slot
// Rewrites the copy for a single slot/field on a single block.
// Charges 1 AI credit, logs a ledger row.
//
// Body: { tenant_id, user_id, block_key, field, current_value, instruction?, brand_name?, tone? }
// Returns: { success, value, credits, provider, model }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runAITask } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const REWRITE_TOOL = {
  type: "function",
  function: {
    name: "rewrite_slot",
    description: "Rewrite a single piece of website copy.",
    parameters: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "The rewritten copy. Plain text. No markdown.",
        },
      },
      required: ["value"],
    },
  },
};

const FIELD_HINTS: Record<string, { maxLen: number; style: string }> = {
  headline:    { maxLen: 80,  style: "punchy, 4–9 words, no period, no emojis" },
  subheadline: { maxLen: 160, style: "1 sentence, value-focused, no emojis" },
  cta_label:   { maxLen: 24,  style: "2–4 words, action verb first" },
  title:       { maxLen: 80,  style: "headline-style, 3–8 words" },
  body:        { maxLen: 280, style: "1–2 sentences, conversational" },
  description: { maxLen: 280, style: "1–2 sentences, conversational" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const {
      tenant_id,
      user_id,
      block_key,
      field,
      current_value,
      instruction,
      brand_name,
      tone,
    } = body || {};

    if (!tenant_id || !block_key || !field) {
      return json({ error: "tenant_id, block_key, field are required" }, 400);
    }

    // 1. Check & debit credits.
    const { data: credits } = await supabase
      .from("tenant_ai_credits")
      .select("monthly_allowance, used_this_period, top_up_balance, total_lifetime_used")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    let row = credits;
    if (!row) {
      const { data: created } = await supabase
        .from("tenant_ai_credits")
        .insert({ tenant_id })
        .select("monthly_allowance, used_this_period, top_up_balance, total_lifetime_used")
        .maybeSingle();
      row = created;
    }

    const allowance = Number(row?.monthly_allowance || 0);
    const used = Number(row?.used_this_period || 0);
    const topup = Number(row?.top_up_balance || 0);
    const poolRemaining = Math.max(0, allowance - used);
    const totalAvailable = poolRemaining + topup;

    if (totalAvailable < 1) {
      return json(
        {
          error: "Out of AI credits",
          message: "Top up to continue rewriting copy.",
        },
        402,
      );
    }

    // 2. Build prompt.
    const hint = FIELD_HINTS[field] || { maxLen: 200, style: "concise, brand-appropriate" };
    const system = `You are a senior copywriter for a white-label travel brand. Rewrite a single field of website copy.

Rules:
- Stay under ${hint.maxLen} characters.
- Style: ${hint.style}.
- Plain text only — no markdown, no quotes, no emojis unless explicitly requested.
- Do not invent facts (prices, locations, dates) that weren't in the original.
- Output via the rewrite_slot tool.`;

    const user = `Brand: ${brand_name || "(unnamed travel brand)"}
Block: ${block_key}
Field: ${field}
Tone: ${tone || "warm, confident, modern"}

Current copy:
"""${String(current_value || "").slice(0, 600)}"""

Instruction:
${instruction || "Make it punchier and more on-brand."}

Rewrite now.`;

    const aiResult = await runAITask({
      taskKey: "studio-ai-rewrite-slot",
      supabase,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [REWRITE_TOOL],
      toolChoice: { type: "function", function: { name: "rewrite_slot" } },
    });

    const value = aiResult.toolCall?.args?.value
      || (aiResult.content || "").trim();
    if (!value) {
      return json({ error: "AI returned empty rewrite" }, 502);
    }

    // 3. Debit 1 credit.
    const chargeFromPool = poolRemaining >= 1;
    const newUsed = chargeFromPool ? used + 1 : used;
    const newTopup = chargeFromPool ? topup : topup - 1;

    await supabase
      .from("tenant_ai_credits")
      .update({
        used_this_period: newUsed,
        top_up_balance: newTopup,
        last_charged_at: new Date().toISOString(),
        total_lifetime_used: (Number(row?.total_lifetime_used || 0) || 0) + 1,
      } as any)
      .eq("tenant_id", tenant_id);

    await supabase.from("tenant_ai_credit_ledger").insert({
      tenant_id,
      user_id: user_id || null,
      operation: "studio_rewrite_slot",
      amount_charged: 1,
      charged_from: chargeFromPool ? "pool" : "topup",
      prompt_summary: `${block_key}.${field}: ${(instruction || "punch up").slice(0, 160)}`,
      pool_balance_after: Math.max(0, allowance - newUsed),
      topup_balance_after: newTopup,
      metadata: {
        block_key,
        field,
        provider: aiResult.provider,
        model: aiResult.model,
      },
    });

    return json({
      success: true,
      value: value.slice(0, hint.maxLen),
      provider: aiResult.provider,
      model: aiResult.model,
      credits: {
        pool_remaining: Math.max(0, allowance - newUsed),
        topup_balance: newTopup,
      },
    });
  } catch (e: any) {
    console.error("[ai-rewrite-slot] error:", e?.message || e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});