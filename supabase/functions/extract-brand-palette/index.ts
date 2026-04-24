/**
 * extract-brand-palette
 *
 * Asks Lovable AI (Gemini vision) to look at a logo image and propose a
 * primary / accent / background color trio for a travel-site theme. Used by
 * the Studio Brand tab "Improve with AI" button when the client-side palette
 * extractor produces something the tenant doesn't like.
 *
 * Input: { logo_url: string, brand_name?: string }
 * Output: { success: true, primary: "#hex", accent: "#hex", background: "#hex" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { logo_url, brand_name } = await req.json();
    if (!logo_url || typeof logo_url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "logo_url is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a senior brand designer. Look at the uploaded logo and propose an on-brand color palette for a premium travel website. Return:
- primary: the strongest brand color, used for buttons and links
- accent: a complementary color used for highlights / CTAs
- background: the page background — usually white or a very light tint of the brand

All colors must be valid 6-digit hex (#rrggbb). Avoid pure black or pure white for primary/accent. Keep the palette legible (high contrast against background).`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Brand: ${brand_name || "(unknown)"}\nReturn the palette using the propose_palette tool.`,
                },
                { type: "image_url", image_url: { url: logo_url } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "propose_palette",
                description: "Return a 3-color brand palette as hex codes.",
                parameters: {
                  type: "object",
                  properties: {
                    primary: { type: "string", description: "Hex like #1a73e8" },
                    accent: { type: "string", description: "Hex like #ff6b2c" },
                    background: {
                      type: "string",
                      description: "Hex like #ffffff or #f7fafd",
                    },
                    rationale: { type: "string" },
                  },
                  required: ["primary", "accent", "background"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "propose_palette" },
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[extract-brand-palette] gateway error", response.status, text);
      const status = response.status === 429 || response.status === 402
        ? response.status
        : 500;
      const message =
        response.status === 429
          ? "AI is rate-limited right now. Try again in a minute."
          : response.status === 402
            ? "AI workspace is out of credits."
            : "AI palette extraction failed.";
      return new Response(
        JSON.stringify({ success: false, error: message, status }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = null;
    try {
      parsed = toolCall?.function?.arguments
        ? JSON.parse(toolCall.function.arguments)
        : null;
    } catch {
      parsed = null;
    }

    if (
      !parsed ||
      !isHex(parsed.primary) ||
      !isHex(parsed.accent) ||
      !isHex(parsed.background)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "AI did not return a valid palette",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        primary: parsed.primary,
        accent: parsed.accent,
        background: parsed.background,
        rationale: parsed.rationale || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[extract-brand-palette] error", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});