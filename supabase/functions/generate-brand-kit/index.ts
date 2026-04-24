/**
 * generate-brand-kit — infers a complete brand kit from minimal tenant input.
 *
 * Input:  { siteName, primaryColor?, logoUrl?, brandPersonality?, productFocus?, audience? }
 * Output: { brandKit: { secondary_color, accent_color, neutral, font_heading, font_body,
 *           button_style, icon_style, banner_style, brand_voice: { adjectives, tone_line } } }
 *
 * Uses Lovable AI Gateway. When `logoUrl` is provided, the model receives the image so it
 * can extract dominant colors and infer style from the mark itself.
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const FONT_OPTIONS = [
  "Inter", "Plus Jakarta Sans", "Poppins", "DM Sans",
  "Playfair Display", "Cormorant Garamond", "Manrope", "Outfit",
] as const;

const BRAND_KIT_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_brand_kit",
    description: "Return a complete, harmonised brand kit for the tenant.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary_color:   { type: "string", description: "Hex color, e.g. #1E40AF. Refined version of the input primary." },
        secondary_color: { type: "string", description: "Hex. Harmonious supporting color (analogous or split-complement)." },
        accent_color:    { type: "string", description: "Hex. High-energy CTA color that contrasts with primary on white." },
        neutral: {
          type: "object",
          additionalProperties: false,
          properties: {
            background: { type: "string", description: "Page background hex (usually near-white or near-black)." },
            surface:    { type: "string", description: "Card/surface hex." },
            muted:      { type: "string", description: "Muted text/border hex." },
          },
          required: ["background", "surface", "muted"],
        },
        font_heading: { type: "string", enum: FONT_OPTIONS as unknown as string[] },
        font_body:    { type: "string", enum: FONT_OPTIONS as unknown as string[] },
        button_style: {
          type: "object",
          additionalProperties: false,
          properties: {
            radius:  { type: "string", enum: ["sharp", "soft", "rounded", "pill"] },
            shadow:  { type: "string", enum: ["none", "subtle", "medium", "elevated"] },
            weight:  { type: "string", enum: ["regular", "semibold", "bold"] },
          },
          required: ["radius", "shadow", "weight"],
        },
        icon_style:   { type: "string", enum: ["outline", "solid", "duotone", "minimal"] },
        banner_style: { type: "string", enum: ["photo", "gradient", "pattern", "minimal"] },
        brand_voice: {
          type: "object",
          additionalProperties: false,
          properties: {
            adjectives: {
              type: "array",
              minItems: 3, maxItems: 3,
              items: { type: "string" },
              description: "Three single-word adjectives describing the voice (e.g. Warm, Trustworthy, Modern).",
            },
            tone_line: { type: "string", description: "One-sentence tone guideline used to steer AI copy + chatbot." },
          },
          required: ["adjectives", "tone_line"],
        },
        rationale: { type: "string", description: "One short paragraph explaining the choices to the tenant." },
      },
      required: [
        "primary_color", "secondary_color", "accent_color", "neutral",
        "font_heading", "font_body", "button_style", "icon_style",
        "banner_style", "brand_voice", "rationale",
      ],
    },
  },
};

function buildSystemPrompt(): string {
  return [
    "You are a senior brand designer who builds cohesive identity systems for travel businesses.",
    "Your job: from minimal input (name, optional logo, optional primary color, optional positioning),",
    "produce a polished, harmonised brand kit that feels intentional — never generic.",
    "",
    "Hard rules:",
    "• If a logo is provided, prioritise extracting its actual dominant color as the primary, then build the rest around it.",
    "• Colors must pass a basic contrast check (CTA accent must read on white, body text must read on background).",
    "• Pair fonts deliberately: a serif heading with a sans body for premium/luxury; clean geometric sans pairs for modern/practical.",
    "• Match button radius + shadow to the brand personality: luxury → sharp/soft + subtle; friendly → rounded + medium; bold → pill + elevated.",
    "• Brand voice adjectives must be specific (avoid 'good', 'nice', 'professional' as the first word).",
    "",
    "Always return the structured tool call. Never reply with prose only.",
  ].join("\n");
}

function buildUserContent(args: {
  siteName: string;
  primaryColor?: string;
  brandPersonality?: string;
  productFocus?: string;
  audience?: string;
  logoUrl?: string;
}): Array<Record<string, unknown>> | string {
  const lines = [
    `Brand name: ${args.siteName}`,
    args.primaryColor   ? `Preferred primary color: ${args.primaryColor}` : "Preferred primary color: not specified — choose one that fits.",
    args.brandPersonality ? `Personality: ${args.brandPersonality}` : null,
    args.productFocus   ? `Primary product: ${args.productFocus}` : null,
    args.audience       ? `Target audience: ${args.audience}` : null,
    "",
    "Generate the full brand kit now. If a logo is attached, base the palette on it.",
  ].filter(Boolean).join("\n");

  if (!args.logoUrl) return lines;

  return [
    { type: "text", text: lines },
    { type: "image_url", image_url: { url: args.logoUrl } },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const siteName = String(body?.siteName || "").trim();
    if (!siteName) {
      return new Response(JSON.stringify({ error: "siteName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const primaryColor = typeof body?.primaryColor === "string" ? body.primaryColor.trim() : undefined;
    const logoUrl = typeof body?.logoUrl === "string" && body.logoUrl.startsWith("http") ? body.logoUrl : undefined;
    const brandPersonality = typeof body?.brandPersonality === "string" ? body.brandPersonality.trim() : undefined;
    const productFocus = typeof body?.productFocus === "string" ? body.productFocus.trim() : undefined;
    const audience = typeof body?.audience === "string" ? body.audience.trim() : undefined;

    // Vision-capable model when we have a logo, otherwise use the fast text model.
    const model = logoUrl ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";

    const userContent = buildUserContent({ siteName, primaryColor, logoUrl, brandPersonality, productFocus, audience });

    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userContent },
        ],
        tools: [BRAND_KIT_TOOL],
        tool_choice: { type: "function", function: { name: "emit_brand_kit" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a minute." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("[generate-brand-kit] gateway error:", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error("[generate-brand-kit] no tool call in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return a brand kit" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let brandKit: Record<string, unknown>;
    try {
      brandKit = JSON.parse(argsStr);
    } catch (e) {
      console.error("[generate-brand-kit] JSON parse error:", e, argsStr);
      return new Response(JSON.stringify({ error: "AI returned malformed JSON" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, brandKit, model }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-brand-kit] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});