// AI Design Generator — Analyzes logos, generates unique themes for white-label sites
// Multi-provider fallback: Lovable AI Gateway (Gemini → GPT) → Direct Google Gemini API.
// Never fails on a single provider/model overload — automatically tries the next.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DIRECT_GEMINI_MODEL = "gemini-2.5-flash";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Provider fallback chain — tried in order. If one returns a transient error
// (503/429/5xx) or is missing credentials, we fall through to the next.
type ProviderId = "lovable" | "google" | "openai";
interface ProviderCfg {
  id: ProviderId;
  model: string;
  label: string;
}
const PROVIDER_CHAIN: ProviderCfg[] = [
  { id: "lovable", model: "google/gemini-2.5-flash",       label: "Lovable AI · Gemini 2.5 Flash" },
  { id: "google",  model: "gemini-2.5-flash",              label: "Direct Google · Gemini 2.5 Flash" },
  { id: "lovable", model: "google/gemini-3-flash-preview", label: "Lovable AI · Gemini 3 Flash" },
  { id: "google",  model: "gemini-3-flash-preview",        label: "Direct Google · Gemini 3 Flash" },
  { id: "lovable", model: "openai/gpt-5-mini",             label: "Lovable AI · GPT-5 Mini" },
  { id: "openai",  model: "gpt-5-mini",                    label: "Direct OpenAI · GPT-5 Mini" },
  { id: "openai",  model: "gpt-4.1-mini",                  label: "Direct OpenAI · GPT-4.1 Mini" },
];

/** Convert our normalized message format to OpenAI/Lovable Gateway shape. */
function toOpenAiMessages(systemPrompt: string, messages: { role: string; content: any }[]) {
  const out: any[] = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    const role = m.role === "assistant" ? "assistant" : "user";
    if (typeof m.content === "string") {
      out.push({ role, content: m.content });
    } else if (Array.isArray(m.content)) {
      // Multimodal: OpenAI-compatible parts
      out.push({ role, content: m.content });
    }
  }
  return out;
}

/** Single attempt against the Lovable AI Gateway (OpenAI-compatible). */
async function callLovableGateway(model: string, opts: {
  systemPrompt: string;
  messages: { role: string; content: any }[];
  tools?: any[];
  toolChoice?: string;
}): Promise<any> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    const err: any = new Error("LOVABLE_API_KEY not configured");
    err.skip = true; // skip this provider entirely
    throw err;
  }

  const body: any = {
    model,
    messages: toOpenAiMessages(opts.systemPrompt, opts.messages),
  };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools.map((t) => ({ type: "function", function: t.function }));
    if (opts.toolChoice) {
      body.tool_choice = { type: "function", function: { name: opts.toolChoice } };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(LOVABLE_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const txt = await res.text();
      const err: any = new Error(`Lovable gateway error (${res.status})`);
      err.status = res.status;
      err.body = txt.slice(0, 300);
      // 402 = no credits → try next provider; 429/5xx = transient → next provider.
      err.transient = res.status === 503 || res.status === 429 || res.status === 402 || res.status >= 500;
      throw err;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    // Tool/function call response
    const tc = msg?.tool_calls?.[0];
    if (tc?.function) {
      let args: any = {};
      try { args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function.arguments || {}); }
      catch { args = {}; }
      return { type: "function_call", name: tc.function.name, args };
    }

    // Plain text
    return { type: "text", content: msg?.content || "" };
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

/** Single attempt against the OpenAI Chat Completions API (direct, using OPENAI_API_KEY). */
async function callDirectOpenAi(model: string, opts: {
  systemPrompt: string;
  messages: { role: string; content: any }[];
  tools?: any[];
  toolChoice?: string;
}): Promise<any> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    const err: any = new Error("OPENAI_API_KEY not configured");
    err.skip = true;
    throw err;
  }

  const body: any = {
    model,
    messages: toOpenAiMessages(opts.systemPrompt, opts.messages),
  };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools.map((t) => ({ type: "function", function: t.function }));
    if (opts.toolChoice) {
      body.tool_choice = { type: "function", function: { name: opts.toolChoice } };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const txt = await res.text();
      const err: any = new Error(`Direct OpenAI error (${res.status})`);
      err.status = res.status;
      err.body = txt.slice(0, 300);
      err.transient = res.status === 503 || res.status === 429 || res.status >= 500;
      throw err;
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const tc = msg?.tool_calls?.[0];
    if (tc?.function) {
      let args: any = {};
      try { args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function.arguments || {}); }
      catch { args = {}; }
      return { type: "function_call", name: tc.function.name, args };
    }
    return { type: "text", content: msg?.content || "" };
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

/** Single attempt against the direct Google Generative Language API (legacy fallback). */
async function callDirectGemini(model: string, opts: {
  systemPrompt: string;
  messages: { role: string; content: any }[];
  tools?: any[];
  toolChoice?: string;
}): Promise<any> {
  const key = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!key) {
    const err: any = new Error("GOOGLE_AI_API_KEY not configured");
    err.skip = true;
    throw err;
  }

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;

  // Convert messages to Gemini format
  const contents: any[] = [];
  for (const m of opts.messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      contents.push({ role, parts: [{ text: m.content }] });
    } else if (Array.isArray(m.content)) {
      // Multimodal content (text + image_url)
      const parts: any[] = [];
      for (const part of m.content) {
        if (part.type === "text") parts.push({ text: part.text });
        else if (part.type === "image_url") {
          parts.push({ text: `[Image URL: ${part.image_url.url}] Analyze this image.` });
        }
      }
      contents.push({ role, parts });
    }
  }

  const body: any = {
    contents,
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
  };

  // Add function calling if tools provided
  if (opts.tools && opts.tools.length > 0) {
    body.tools = [{
      functionDeclarations: opts.tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }];
    if (opts.toolChoice) {
      body.toolConfig = {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: [opts.toolChoice],
        },
      };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const txt = await res.text();
      const err: any = new Error(`Direct Gemini error (${res.status})`);
      err.status = res.status;
      err.body = txt.slice(0, 300);
      err.transient = res.status === 503 || res.status === 429 || res.status >= 500;
      throw err;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const fnCall = parts.find((p: any) => p.functionCall);
    if (fnCall) {
      return { type: "function_call", name: fnCall.functionCall.name, args: fnCall.functionCall.args };
    }
    const text = parts.filter((p: any) => !p.thought && p.text).map((p: any) => p.text).join("");
    return { type: "text", content: text };
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Public entry point. Walks the provider chain in order and returns the first
 * successful response. Falls through on transient errors (503/429/402/5xx),
 * missing credentials, network/abort errors, and empty/unusable responses.
 */
async function callGemini(opts: {
  systemPrompt: string;
  messages: { role: string; content: any }[];
  tools?: any[];
  toolChoice?: string;
}): Promise<any> {
  let lastErr: any = null;

  for (let i = 0; i < PROVIDER_CHAIN.length; i++) {
    const p = PROVIDER_CHAIN[i];
    try {
      const result =
        p.id === "lovable" ? await callLovableGateway(p.model, opts) :
        p.id === "openai"  ? await callDirectOpenAi(p.model, opts)   :
                             await callDirectGemini(p.model, opts);

      // If the caller wanted a function call but the provider gave us text,
      // treat as a soft failure and try the next provider.
      if (opts.toolChoice && result?.type !== "function_call") {
        console.warn(`[ai-design] ${p.label} returned no tool call — falling back.`);
        lastErr = new Error(`${p.label} returned no tool call`);
        continue;
      }

      if (i > 0) console.log(`[ai-design] Recovered via fallback: ${p.label}`);
      return result;
    } catch (e: any) {
      lastErr = e;
      const tag = e?.skip ? "skip" : e?.transient ? "transient" : `status=${e?.status || "n/a"}`;
      console.error(`[ai-design] ${p.label} failed (${tag}): ${e?.message || e}`);
      // Skip on missing creds, transient errors, or unknown/network — try next provider.
      if (e?.skip || e?.transient || !e?.status) continue;
      // Hard non-transient error (e.g. 400 bad request) — still try next provider, since
      // a different model may accept the payload.
      continue;
    }
  }

  const err: any = new Error(lastErr?.message || "All AI providers failed");
  err.status = lastErr?.status || 503;
  err.transient = true;
  throw err;
}

const LAYOUT_TEMPLATES = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional travel site with a full-width hero, search bar, and grid destinations.",
    heroStyle: "full-width-image",
    sectionOrder: ["hero", "stats", "destinations", "offers", "trending_flights", "testimonials", "newsletter"],
  },
  {
    id: "modern-split",
    name: "Modern Split",
    description: "Split hero with text on left, image on right. Minimalist card-based layout.",
    heroStyle: "split-hero",
    sectionOrder: ["hero", "offers", "destinations", "stats", "trending_flights", "testimonials", "newsletter"],
  },
  {
    id: "bold-gradient",
    name: "Bold Gradient",
    description: "Large gradient hero, bold typography, asymmetric grids, vibrant accent colors.",
    heroStyle: "gradient-overlay",
    sectionOrder: ["hero", "stats", "trending_flights", "destinations", "offers", "testimonials", "newsletter"],
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Magazine-style layout with large imagery, serif headings, and editorial spacing.",
    heroStyle: "editorial-hero",
    sectionOrder: ["hero", "destinations", "offers", "trending_flights", "testimonials", "stats", "newsletter"],
  },
  {
    id: "compact-pro",
    name: "Compact Pro",
    description: "Dense, professional layout optimized for B2B agents. Search-first, data-rich.",
    heroStyle: "compact-search",
    sectionOrder: ["hero", "trending_flights", "destinations", "stats", "offers", "newsletter"],
  },
];

const FONT_PAIRS = [
  { heading: "DM Serif Display", body: "Plus Jakarta Sans", style: "editorial" },
  { heading: "Poppins", body: "Inter", style: "modern" },
  { heading: "Playfair Display", body: "Lato", style: "luxury" },
  { heading: "Space Grotesk", body: "DM Sans", style: "tech" },
  { heading: "Merriweather", body: "Source Sans 3", style: "classic" },
  { heading: "Cormorant Garamond", body: "Nunito Sans", style: "premium" },
  { heading: "Outfit", body: "Work Sans", style: "clean" },
  { heading: "Sora", body: "Rubik", style: "bold" },
];

// Shared tool definitions
const THEME_TOOL = {
  function: {
    name: "generate_website_theme",
    description: "Generate a complete website theme configuration",
    parameters: {
      type: "object",
      properties: {
        primary_color: { type: "string", description: "Primary brand color in hex" },
        secondary_color: { type: "string", description: "Secondary color in hex" },
        accent_color: { type: "string", description: "Accent/highlight color in hex" },
        background_color: { type: "string", description: "Main background color in hex" },
        layout_template: {
          type: "string",
          enum: LAYOUT_TEMPLATES.map(t => t.id),
          description: "Which layout template fits best",
        },
        font_heading: { type: "string", description: "Heading font name" },
        font_body: { type: "string", description: "Body font name" },
        border_radius: {
          type: "string",
          enum: ["0.25rem", "0.5rem", "0.75rem", "1rem", "1.25rem", "1.5rem"],
          description: "Border radius for cards and buttons",
        },
        hero_tagline: { type: "string", description: "A catchy hero tagline for the site" },
        sections: {
          type: "object",
          properties: {
            hero: { type: "boolean" },
            stats: { type: "boolean" },
            destinations: { type: "boolean" },
            offers: { type: "boolean" },
            trending_flights: { type: "boolean" },
            testimonials: { type: "boolean" },
            newsletter: { type: "boolean" },
            blog: { type: "boolean" },
          },
          required: ["hero", "stats", "destinations", "offers", "trending_flights", "testimonials", "newsletter", "blog"],
        },
        design_rationale: { type: "string", description: "Brief explanation of design choices" },
      },
      required: ["primary_color", "secondary_color", "accent_color", "background_color", "layout_template", "font_heading", "font_body", "border_radius", "hero_tagline", "sections", "design_rationale"],
    },
  },
};

const COLOR_TOOL = {
  function: {
    name: "extract_brand_colors",
    description: "Extract brand colors from a logo and suggest a website palette",
    parameters: {
      type: "object",
      properties: {
        dominant_colors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              hex: { type: "string" },
              name: { type: "string" },
              usage: { type: "string", description: "How this color appears in the logo" },
            },
            required: ["hex", "name"],
          },
          description: "Colors found in the logo (2-5 colors)",
        },
        suggested_palette: {
          type: "object",
          properties: {
            primary: { type: "string", description: "Primary color hex" },
            secondary: { type: "string", description: "Secondary color hex" },
            accent: { type: "string", description: "Accent color hex" },
            background: { type: "string", description: "Background color hex" },
          },
          required: ["primary", "secondary", "accent", "background"],
        },
      },
      required: ["dominant_colors", "suggested_palette"],
    },
  },
};

const TWEAK_TOOL = {
  function: {
    name: "apply_theme_changes",
    description: "Apply specific changes to the current theme",
    parameters: {
      type: "object",
      properties: {
        color_changes: {
          type: "object",
          description: "Color overrides to apply (only changed fields). Keys: primary, primary_foreground, accent, accent_foreground, background, foreground, card, card_foreground, secondary, muted, muted_foreground, border",
        },
        font_heading: { type: "string", description: "New heading font (only if changing)" },
        font_body: { type: "string", description: "New body font (only if changing)" },
        radius: { type: "string", description: "New border radius e.g. '0.75rem' (only if changing)" },
        explanation: { type: "string", description: "Brief, friendly explanation of what you changed and why" },
      },
      required: ["explanation"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) {
      return json({ success: false, error: "GOOGLE_AI_API_KEY not configured" }, 500);
    }

    // ── Action: Generate theme from brand description ──
    if (action === "generate-theme") {
      const { brandDescription, logoUrl, currentColors, referenceImages, chatHistory } = body;

      if (!brandDescription && !logoUrl) {
        return json({ success: false, error: "Provide brandDescription or logoUrl" }, 400);
      }

      const systemPrompt = `You are an expert web designer specializing in travel booking websites.
Given a brand description and optionally logo colors and reference images, generate a complete, unique website theme.

Available layout templates: ${JSON.stringify(LAYOUT_TEMPLATES.map(t => ({ id: t.id, name: t.name, description: t.description })))}

Available font pairs: ${JSON.stringify(FONT_PAIRS)}

RULES:
- Generate a UNIQUE color palette that perfectly matches the brand identity
- Colors must have good contrast (WCAG AA minimum)
- Pick the most fitting layout template
- Pick the most fitting font pair
- Generate a catchy hero tagline
- Suggest which sections to show/hide
- All colors must be hex format
- If reference images are provided, extract visual inspiration from them (color moods, style cues, layout hints)`;

      // Build content parts
      const contentParts: any[] = [];
      
      let textPrompt = `Brand description: "${brandDescription || "A professional travel agency"}"`;
      if (logoUrl) textPrompt += `\nLogo URL for reference: ${logoUrl}`;
      if (currentColors) textPrompt += `\nCurrent brand colors for reference: primary=${currentColors.primary}, secondary=${currentColors.secondary}`;
      if (referenceImages?.length > 0) textPrompt += `\n\nThe user uploaded ${referenceImages.length} reference image(s) for design inspiration. Analyze the visual style, colors, typography mood, and layout feel from these references.`;
      textPrompt += `\n\nGenerate a complete website theme for this travel brand.`;
      
      contentParts.push({ type: "text", text: textPrompt });
      
      // Add reference images
      if (referenceImages && Array.isArray(referenceImages)) {
        for (const imgUrl of referenceImages.slice(0, 3)) {
          contentParts.push({ type: "image_url", image_url: { url: imgUrl } });
        }
      }
      if (logoUrl) {
        contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
      }

      // Include chat history context
      const messages: any[] = [];
      if (chatHistory && Array.isArray(chatHistory)) {
        for (const msg of chatHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content: contentParts.length > 1 ? contentParts : textPrompt });

      const result = await callGemini({
        systemPrompt,
        messages,
        tools: [THEME_TOOL],
        toolChoice: "generate_website_theme",
      });

      if (result.type !== "function_call") {
        console.error("[ai-design] No function call in response:", JSON.stringify(result).slice(0, 500));
        return json({ success: false, error: "AI did not return a theme" }, 500);
      }

      const theme = result.args;
      const templateDetails = LAYOUT_TEMPLATES.find(t => t.id === theme.layout_template) || LAYOUT_TEMPLATES[0];

      return json({
        success: true,
        theme: { ...theme, templateDetails },
        templates: LAYOUT_TEMPLATES,
      });
    }

    // ── Action: Extract colors from logo URL ──
    if (action === "extract-colors") {
      const { logoUrl } = body;
      if (!logoUrl) {
        return json({ success: false, error: "logoUrl is required" }, 400);
      }

      const result = await callGemini({
        systemPrompt: "You are a color analysis expert. Extract the dominant colors from the described logo/brand image and suggest a website color palette.",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Analyze this logo image and extract the dominant brand colors. Suggest a complete website color palette based on these colors." },
            { type: "image_url", image_url: { url: logoUrl } },
          ],
        }],
        tools: [COLOR_TOOL],
        toolChoice: "extract_brand_colors",
      });

      if (result.type !== "function_call") {
        return json({ success: false, error: "Could not extract colors" }, 500);
      }

      return json({ success: true, ...result.args });
    }

    // ── Action: List available templates ──
    if (action === "list-templates") {
      return json({ success: true, templates: LAYOUT_TEMPLATES, fontPairs: FONT_PAIRS });
    }

    // ── Action: Tweak existing theme via chat ──
    if (action === "tweak-theme") {
      const { instruction, currentTheme, chatHistory, referenceImages } = body;

      if (!instruction) {
        return json({ success: false, error: "instruction is required" }, 400);
      }

      const systemPrompt = `You are a helpful design assistant for a travel website admin panel.
The admin has already set up a theme and wants to make adjustments via chat.

Current theme configuration:
${JSON.stringify(currentTheme, null, 2)}

Available color fields: primary, primary_foreground, accent, accent_foreground, background, foreground, card, card_foreground, secondary, muted, muted_foreground, border.
Available font pairs: ${JSON.stringify(FONT_PAIRS.map(f => f.heading + " / " + f.body))}
Available layouts: ${LAYOUT_TEMPLATES.map(t => t.id).join(", ")}

RULES:
- Only return the fields that need to change
- Colors must be hex format
- Keep good contrast (WCAG AA)
- Be conversational in your explanation
- If reference images are provided, use them as visual inspiration for the changes
- If the user asks something unrelated to theme design, politely redirect
- You can change layout_template, font_heading, font_body, border_radius, hero_tagline, and all color fields`;

      const messages: any[] = [];
      if (chatHistory && Array.isArray(chatHistory)) {
        for (const msg of chatHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      // Build user message with possible reference images
      const contentParts: any[] = [{ type: "text", text: instruction }];
      if (referenceImages && Array.isArray(referenceImages)) {
        for (const imgUrl of referenceImages.slice(0, 3)) {
          contentParts.push({ type: "image_url", image_url: { url: imgUrl } });
        }
      }
      messages.push({ role: "user", content: contentParts.length > 1 ? contentParts : instruction });

      const result = await callGemini({
        systemPrompt,
        messages,
        tools: [TWEAK_TOOL],
        toolChoice: "apply_theme_changes",
      });

      if (result.type !== "function_call") {
        return json({ success: false, error: "AI did not return changes" }, 500);
      }

      return json({ success: true, changes: result.args });
    }

    // ── Action: Generate full site (theme + pages + sections) ──
    if (action === "generate-full-site") {
      const { brandDescription, businessName, logoUrl, referenceImages, targetAudience, language } = body;

      if (!brandDescription) {
        return json({ success: false, error: "brandDescription is required" }, 400);
      }

      const SITE_TOOL = {
        function: {
          name: "generate_complete_site",
          description: "Generate a complete website: theme + multiple pages, each with ordered sections.",
          parameters: {
            type: "object",
            properties: {
              site_name: { type: "string", description: "Brand/site display name" },
              tagline: { type: "string", description: "Hero tagline" },
              theme: {
                type: "object",
                properties: {
                  primary_color: { type: "string" },
                  secondary_color: { type: "string" },
                  accent_color: { type: "string" },
                  background_color: { type: "string" },
                  text_color: { type: "string" },
                  font_heading: { type: "string" },
                  font_body: { type: "string" },
                  border_radius: { type: "string", enum: ["0.25rem", "0.5rem", "0.75rem", "1rem", "1.25rem", "1.5rem"] },
                  button_style: { type: "string", enum: ["solid", "outline", "gradient", "glass", "pill"] },
                },
                required: ["primary_color", "secondary_color", "accent_color", "background_color", "text_color", "font_heading", "font_body", "border_radius", "button_style"],
              },
              pages: {
                type: "array",
                description: "Array of pages to generate. The first page MUST be the homepage (slug='home', is_homepage=true).",
                items: {
                  type: "object",
                  properties: {
                    slug: { type: "string", description: "URL slug, lowercase, hyphenated" },
                    title: { type: "string" },
                    nav_label: { type: "string" },
                    is_homepage: { type: "boolean" },
                    show_in_header: { type: "boolean" },
                    show_in_footer: { type: "boolean" },
                    seo_title: { type: "string" },
                    seo_description: { type: "string" },
                    sections: {
                      type: "array",
                      description: "Ordered sections. Use only allowed type keys.",
                      items: {
                        type: "object",
                        properties: {
                          type: {
                            type: "string",
                            enum: [
                              "hero_classic", "hero_split", "hero_video", "hero_minimal",
                              "search_inline", "usp_strip", "destinations_grid", "offers_carousel",
                              "testimonials_grid", "trust_bar", "faq_accordion", "newsletter_capture",
                              "cta_block", "contact_form",
                              "rich_text", "image_text_split", "team_grid", "stats_band", "quote_band", "timeline",
                              "feature_grid", "pricing_table", "logo_cloud", "comparison_table",
                              "lead_capture", "newsletter_inline",
                              "gallery_masonry", "video_embed", "map_embed",
                              "blog_post_grid",
                            ],
                          },
                           config: {
                             type: "object",
                             description: "Section configuration with REAL brand-specific content. NEVER return an empty object. Use the right keys for the section type:\n• hero_classic / hero_split / hero_video / hero_minimal: { headline, subtitle, ctaText, ctaUrl, backgroundImage?, overlay? }\n• search_inline: { title?, subtitle?, defaultTab? }\n• usp_strip: { items: [{ icon?, title, description }] }  (3–4 items)\n• destinations_grid: { title, subtitle?, items: [{ name, country?, image?, price?, description? }] } (4–8 items)\n• offers_carousel: { title, subtitle?, items: [{ title, description, badge?, image?, ctaText?, ctaUrl? }] } (3–6 items)\n• testimonials_grid: { title?, items: [{ name, role?, quote, avatar? }] } (3–4 items)\n• trust_bar / logo_cloud: { title?, logos: [{ name, url? }] }\n• faq_accordion: { title, items: [{ question, answer }] } (4–8 items)\n• newsletter_capture / newsletter_inline: { title, subtitle, ctaText, placeholder? }\n• cta_block: { headline, subtitle?, ctaText, ctaUrl }\n• contact_form: { title, subtitle?, fields?: [], email?, phone?, address? }\n• rich_text: { title?, body (markdown/plain) }\n• image_text_split: { title, body, image, ctaText?, ctaUrl?, reverse? }\n• team_grid: { title, items: [{ name, role, photo?, bio? }] } (3–6 items)\n• stats_band: { items: [{ value, label }] } (3–4 items)\n• quote_band: { quote, author }\n• timeline: { title, items: [{ year, title, description }] }\n• feature_grid: { title, subtitle?, items: [{ icon?, title, description }] } (3–6 items)\n• pricing_table: { title, plans: [{ name, price, period?, features:[], ctaText, highlighted? }] } (2–3 plans)\n• comparison_table: { title, columns:[], rows:[] }\n• lead_capture: { title, subtitle, fields:[], ctaText }\n• gallery_masonry: { title, images:[{ url, caption? }] }\n• video_embed: { title?, url }\n• map_embed: { title?, address, embedUrl? }\n• blog_post_grid: { title, items:[{ title, excerpt, image?, slug? }] }\nALL text must be in the requested language and tailored to the brand — never empty, never lorem ipsum.",
                           },
                        },
                        required: ["type", "config"],
                      },
                    },
                  },
                  required: ["slug", "title", "is_homepage", "sections"],
                },
              },
              navigation_header: {
                type: "array",
                description: "Header menu items (slugs of pages above)",
                items: { type: "string" },
              },
              navigation_footer: {
                type: "array",
                description: "Footer menu items (slugs of pages above)",
                items: { type: "string" },
              },
              rationale: { type: "string", description: "Brief friendly explanation of the site structure" },
            },
            required: ["site_name", "tagline", "theme", "pages", "rationale"],
          },
        },
      };

      const systemPrompt = `You are a senior web designer & content strategist for travel booking websites.
Generate a complete, ready-to-publish multi-page site for the described brand.

RULES:
- Build 3 to 5 pages: home (mandatory, slug="home", is_homepage=true), about, destinations (or services), contact, optionally blog.
- Homepage must contain in this rough order: hero_classic OR hero_split, search_inline, usp_strip, destinations_grid, offers_carousel, testimonials_grid, newsletter_capture.
- Other pages: pick 3-6 sections that fit the page intent.
- Generate REAL, specific copy in ${language || "English"} tailored to the brand — never lorem ipsum, never empty strings.
- Match the visual identity of the brand (luxury / family / adventure / B2B / budget).
- Colors: hex format, WCAG AA contrast, harmonious palette derived from brand or logo.
- Font pairs to choose from: ${FONT_PAIRS.map(f => `${f.heading} / ${f.body}`).join(", ")}.
- CRITICAL: Each section's "config" object MUST be fully populated with the keys listed in the schema for that section type. NEVER output config: {}. Every list section (usp_strip, destinations_grid, offers_carousel, testimonials_grid, faq_accordion, feature_grid, team_grid, stats_band, pricing_table) must include 3+ realistic items with full text — names, descriptions, prices, quotes, etc., relevant to the brand.
- Every page should have unique seo_title (<60 chars) and seo_description (<160 chars).
- Header nav: 3-5 items max (do NOT include the homepage slug in navigation_header — the logo links home). Footer nav: include all non-homepage pages.`;

      const contentParts: any[] = [];
      let textPrompt = `Brand: ${businessName || "Travel Brand"}\nDescription: ${brandDescription}`;
      if (targetAudience) textPrompt += `\nTarget audience: ${targetAudience}`;
      if (logoUrl) textPrompt += `\nLogo: ${logoUrl}`;
      textPrompt += `\n\nGenerate the complete site structure now.`;
      contentParts.push({ type: "text", text: textPrompt });

      if (referenceImages && Array.isArray(referenceImages)) {
        for (const imgUrl of referenceImages.slice(0, 3)) {
          contentParts.push({ type: "image_url", image_url: { url: imgUrl } });
        }
      }
      if (logoUrl) {
        contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
      }

      const result = await callGemini({
        systemPrompt,
        messages: [{ role: "user", content: contentParts.length > 1 ? contentParts : textPrompt }],
        tools: [SITE_TOOL],
        toolChoice: "generate_complete_site",
      });

      if (result.type !== "function_call") {
        console.error("[ai-design] full-site no function call:", JSON.stringify(result).slice(0, 500));
        return json({ success: false, error: "AI did not return a site plan" }, 500);
      }

      return json({ success: true, site: result.args });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error("[ai-design] error:", e);
    const isTransient = e?.transient === true || /\b(503|429|overload|unavailable|UNAVAILABLE)\b/i.test(String(e?.message || ""));
    return json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
        fallback: isTransient,
        retryable: isTransient,
      },
      // Return 200 for transient errors so the client can read the fallback flag
      // instead of treating it as a hard failure / blank screen.
      isTransient ? 200 : 500,
    );
  }
});
