/**
 * generate-service-page — AI-generates a Standard service landing page
 * (hero + search + why-us + destinations + FAQ + CTA) for a tenant's
 * Custom Website, tailored to their brand kit, niche, and the chosen service.
 *
 * The function returns a `sections` array of SectionInstance objects that
 * the caller upserts into `custom_site_pages` with `auto_service = <service>`.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Service = "flights" | "hotels" | "tours" | "transfers";

const SERVICE_META: Record<Service, { label: string; singular: string; verb: string; defaultProduct: string }> = {
  flights:   { label: "Flights",   singular: "flight",   verb: "fly",       defaultProduct: "flights" },
  hotels:    { label: "Hotels",    singular: "hotel",    verb: "stay",      defaultProduct: "hotels" },
  tours:     { label: "Tours & experiences", singular: "tour", verb: "explore", defaultProduct: "tours" },
  transfers: { label: "Transfers", singular: "transfer", verb: "ride",      defaultProduct: "transfers" },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Build a SectionInstance scaffold ready to be persisted on a page.
 * The `variant` keys here must exist in `src/components/customsite/sections/registry.tsx`.
 */
function makeSection(variant: string, type: string, content: Record<string, unknown>) {
  return { id: uid(), type, variant, content };
}

const SCHEMA = {
  name: "emit_service_page",
  description: "Emit copy for a Standard service landing page.",
  parameters: {
    type: "object",
    properties: {
      meta_title: { type: "string", description: "SEO title, max 60 chars" },
      meta_description: { type: "string", description: "SEO description, max 155 chars" },
      hero: {
        type: "object",
        properties: {
          eyebrow: { type: "string" },
          headline: { type: "string" },
          subhead: { type: "string" },
          primaryCtaLabel: { type: "string" },
          secondaryCtaLabel: { type: "string" },
        },
        required: ["eyebrow", "headline", "subhead", "primaryCtaLabel", "secondaryCtaLabel"],
      },
      search: {
        type: "object",
        properties: {
          eyebrow: { type: "string" },
          heading: { type: "string" },
          subhead: { type: "string" },
          ctaLabel: { type: "string" },
        },
        required: ["eyebrow", "heading", "subhead", "ctaLabel"],
      },
      why_us: {
        type: "object",
        properties: {
          eyebrow: { type: "string" },
          heading: { type: "string" },
          subhead: { type: "string" },
          items: {
            type: "array",
            minItems: 3, maxItems: 4,
            items: {
              type: "object",
              properties: {
                icon: { type: "string", description: "lucide-react icon name e.g. Shield, Sparkles, Headphones, Globe, Zap, Heart, Award, Plane, Hotel, Map, Car" },
                title: { type: "string" },
                description: { type: "string" },
              },
              required: ["icon", "title", "description"],
            },
          },
        },
        required: ["eyebrow", "heading", "subhead", "items"],
      },
      destinations: {
        type: "object",
        properties: {
          eyebrow: { type: "string" },
          heading: { type: "string" },
          subhead: { type: "string" },
        },
        required: ["eyebrow", "heading", "subhead"],
      },
      cta: {
        type: "object",
        properties: {
          eyebrow: { type: "string" },
          heading: { type: "string" },
          subhead: { type: "string" },
          ctaLabel: { type: "string" },
        },
        required: ["eyebrow", "heading", "subhead", "ctaLabel"],
      },
      faq: {
        type: "array",
        minItems: 4, maxItems: 6,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
          required: ["question", "answer"],
        },
      },
    },
    required: ["meta_title", "meta_description", "hero", "search", "why_us", "destinations", "cta", "faq"],
  },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { site_id, service } = await req.json() as { site_id?: string; service?: Service };
    if (!site_id || !service || !(service in SERVICE_META)) {
      return new Response(JSON.stringify({ error: "site_id and a valid service are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull site context for personalisation
    const { data: site, error: siteErr } = await supabase
      .from("custom_sites")
      .select("site_name, tagline, brand_kit, brand_personality, audience, region_focus, product_focus")
      .eq("id", site_id)
      .maybeSingle();
    if (siteErr) throw siteErr;
    if (!site) throw new Error("Site not found");

    const meta = SERVICE_META[service];
    const brandVoice = (site.brand_kit as any)?.voice?.adjectives?.join(", ") || site.brand_personality || "warm, trustworthy, modern";

    const systemPrompt = `You are a senior travel-brand copywriter. Write concise, on-brand landing-page copy for a travel agency's "${meta.label}" service page.
Voice: ${brandVoice}.
Audience: ${site.audience || "leisure travellers"}.
Region focus: ${site.region_focus || "global"}.
Output via the emit_service_page tool only — no commentary.
Rules:
- meta_title under 60 chars, meta_description under 155 chars.
- Hero headline must be a benefit-led promise, not a feature list.
- Why-us items: each title 2-4 words, description 1 sentence (max 18 words).
- FAQ: practical traveller questions (booking, payment, refunds, support), short answers.
- Never use lorem ipsum or placeholder text. Never mention competitors.`;

    const userPrompt = `Brand: ${site.site_name}${site.tagline ? ` — ${site.tagline}` : ""}
Service to write copy for: ${meta.label}
Generate the full page copy now.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{ type: "function", function: SCHEMA }],
        tool_choice: { type: "function", function: { name: "emit_service_page" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit reached. Try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Top up to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("AI did not return structured copy");
    const copy = JSON.parse(toolCall.function.arguments);

    // Compose the SectionInstance[] for a Standard service page.
    const sections = [
      makeSection("hero_split", "hero", {
        eyebrow: copy.hero.eyebrow,
        headline: copy.hero.headline,
        subhead: copy.hero.subhead,
        primaryCta: { label: copy.hero.primaryCtaLabel, href: "#search", variant: "primary" },
        secondaryCta: { label: copy.hero.secondaryCtaLabel, href: "#contact", variant: "ghost" },
      }),
      makeSection("search_inline_hero", "search", {
        eyebrow: copy.search.eyebrow,
        heading: copy.search.heading,
        subhead: copy.search.subhead,
        products: [meta.defaultProduct],
        defaultProduct: meta.defaultProduct,
        ctaLabel: copy.search.ctaLabel,
        helperText: "Free cancellation on most bookings.",
      }),
      makeSection("why_icon_grid", "why_us", {
        eyebrow: copy.why_us.eyebrow,
        heading: copy.why_us.heading,
        subhead: copy.why_us.subhead,
        items: copy.why_us.items,
      }),
      makeSection("destinations_grid", "destinations", {
        eyebrow: copy.destinations.eyebrow,
        heading: copy.destinations.heading,
        subhead: copy.destinations.subhead,
        items: [],
        cta: { label: `Browse all ${meta.label.toLowerCase()}`, href: `/${service}`, variant: "ghost" },
      }),
      makeSection("newsletter_centered", "newsletter", {
        eyebrow: copy.cta.eyebrow,
        heading: copy.cta.heading,
        subhead: copy.cta.subhead,
        placeholder: "you@email.com",
        ctaLabel: copy.cta.ctaLabel,
        privacyNote: "We respect your privacy. Unsubscribe anytime.",
      }),
    ];

    return new Response(JSON.stringify({
      success: true,
      service,
      sections,
      meta_title: copy.meta_title,
      meta_description: copy.meta_description,
      faq: copy.faq, // returned for future FAQ section variant; currently stored on page seo_meta
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("generate-service-page error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});