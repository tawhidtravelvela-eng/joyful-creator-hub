/**
 * generate-tenant-site-content
 *
 * Generates a FULLY UNIQUE site for a tenant in one structured AI call:
 *   - layout_preset (one of: ota | corporate | hotel | flight | tour | ai_powered)
 *   - section_order (mirror-mode keys, ordered)
 *   - section_variants (e.g. {"hero":"split","destinations":"premium-grid"})
 *   - fonts + palette nudges (respects tenant brand colors first)
 *   - per-section copy overrides (hero / features / destinations / …)
 *   - per-page body content (about / contact / privacy / terms)
 *   - per-page SEO meta (title + description)
 *   - AI bot persona (name / greeting / tone)
 *
 * Persistence:
 *   - custom_sites: layout_preset, audience/product/region/personality, fonts,
 *     palette tweaks (non-destructive: only fills empty fields), AI bot config.
 *   - custom_site_pages.home: sections, section_variants, content_overrides, seo_meta.
 *   - custom_site_pages.about/contact/privacy/terms: title + body_md + seo_meta.
 *   - custom_site_generation_logs: status, model, input, output, duration_ms.
 *
 * Runs for ALL tenants regardless of plan flag. The plan's `ai_copy` flag is
 * only consulted to decide whether the COPY is allowed to mention "AI".
 *
 * IMPORTANT
 *   - This function NEVER references the platform brand ("Vela", "TravelVela")
 *     in tenant-facing copy (per the supplier-visibility rule).
 *   - When `mention_ai = false` (no AI plan or tenant opted out), we substitute
 *     non-AI variants of every AI-flavored line.
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "google/gemini-3-flash-preview";

// Mirrors src/lib/customsite/{layoutPresets,sectionVariants}.ts. Kept inline
// because edge functions can't import from src/. If you change one, change
// both — there's a comment in each file pointing here.
const LAYOUT_PRESET_KEYS = ["ota", "corporate", "hotel", "flight", "tour", "ai_powered"] as const;
const VARIANT_OPTIONS: Record<string, string[]> = {
  hero:         ["centered", "split", "video-bg", "search-overlay"],
  destinations: ["minimal", "image-heavy", "premium-grid"],
  features:     ["3-col", "icon-grid", "split-image"],
  testimonials: ["cards", "quote-strip", "video"],
  footer:       ["compact", "detailed", "corporate"],
  newsletter:   ["centered", "inline", "split"],
  trending:     ["default", "band", "spotlight"],
  deals:        ["default", "dark", "band"],
  blog:         ["default", "magazine", "spotlight"],
};
const ALLOWED_SECTION_KEYS = [
  "hero", "stats", "banners", "offers", "ai_planner", "trending",
  "destinations", "recommendations", "deals", "budget_explorer",
  "features", "testimonials", "app_download", "blog", "newsletter",
];

interface RequestBody {
  site_id: string;
  /** Required on initial autoCompose call; optional on Studio rewrites. */
  brand_name?: string;
  tagline?: string;
  audience?: string;
  product_focus?: string;
  region?: string;
  brand_personality?: string;
  contact_email?: string;
  contact_phone?: string;
  mention_ai?: boolean;
  products?: { flights?: boolean; hotels?: boolean; tours?: boolean; transfers?: boolean };
  /** When set, only this section key is regenerated and persisted. */
  only_section?: string;
  /** When true, ignore any short-circuit caching and regenerate. */
  force?: boolean;
}

function buildPrompt(b: RequestBody) {
  const productList = Object.entries(b.products || {})
    .filter(([_, v]) => v)
    .map(([k]) => k)
    .join(", ") || "travel services";

  const aiClause = b.mention_ai
    ? "You MAY reference an AI trip planner or smart recommendations where natural."
    : "Do NOT mention AI, machine learning, smart algorithms, or automated planning anywhere. Use language about expert curation, human travel specialists, and personalized service instead.";

  return `You are a senior brand strategist + copywriter for travel agencies. Design a UNIQUE website for the brand below. Two tenants with similar inputs MUST get visibly different layout choices, variants and copy. Avoid generic travel-template phrasing.

Brand:
  Name: ${b.brand_name}
  Tagline (if any): ${b.tagline ?? "(none)"}
  Audience: ${b.audience ?? "general travelers"}
  Primary product focus: ${b.product_focus ?? "mixed"}
  Region focus: ${b.region ?? "global"}
  Brand personality: ${b.brand_personality ?? "modern"}
  Products offered: ${productList}

Rules:
  - Never mention third-party brands, suppliers (Travelport, Sabre, Tripjack, Amadeus, Viator) or platform names.
  - ${aiClause}
  - Headlines: max 8 words, punchy and brand-specific. Subheads: max 18 words.
  - SEO titles <60 chars (must include brand). Meta descriptions <160 chars.
  - Pick ONE layout preset that genuinely fits the brand (do not always pick "ota").
  - Pick section variants that create visual identity (vary across tenants).
  - For Privacy/Terms body_md: write a real, usable 200-400 word policy in the brand's voice (NOT a placeholder).
  - For About body_md: write an authentic 150-250 word brand story.
  - SEO must be locale + niche aware. Use the region (${b.region ?? "global"}) and product focus (${b.product_focus ?? "mixed"}) to craft keyword-rich, locally relevant titles, descriptions, H1s, H2 hints, and image alt text. Keywords should reflect real search intent (e.g. "Umrah packages from Dhaka", "cheap student flights Malaysia") — never generic "best travel".
  - Provide JSON-LD schema for the homepage (TravelAgency or LocalBusiness, whichever fits) AND a BreadcrumbList for inner pages. Include name, url placeholder ("{{SITE_URL}}"), description, areaServed (the region), and serviceType (the product focus). Do NOT include phone/address unless given.
  - Provide image_alt_hints with descriptive, keyword-rich alt text for: hero, destinations, features. Keep each under 110 chars.
  - Return your answer by calling the \`compose_tenant_site\` tool. Never return prose.

Variant decision rules (apply in order — pick the FIRST match for each section):
  layout_preset:
    • Brand personality contains "luxury|premium|boutique|editorial" → "hotel" or "tour"
    • Product focus = hotels-only → "hotel"
    • Product focus = tours-only or "experiences" → "tour"
    • Product focus = flights-only or "corporate|business" audience → "flight" or "corporate"
    • mention_ai = true AND personality contains "modern|tech|smart" → "ai_powered"
    • Otherwise → "ota"
  section_variants.hero:
    • personality "luxury|editorial|boutique" → "split"
    • personality "bold|adventure|young" → "video-bg"
    • product focus = hotels OR tours → "search-overlay"
    • Otherwise → "centered"
  Hero assets (REQUIRED when the matching variant is chosen):
    • If hero variant = "split" → set content_overrides.hero.side_image to a tasteful Unsplash URL (https://images.unsplash.com/photo-...&w=1200&q=80) matching the region/personality.
    • If hero variant = "search-overlay" → set content_overrides.hero.background_image to a wide cinematic Unsplash URL (w=1920) for the destination/region.
    • If hero variant = "video-bg" → set content_overrides.hero.video_url to a public MP4 URL (Pexels/Coverr) under 10MB; if you cannot supply one, downgrade to "centered" instead.
    • For "centered", you may still set background_image but it is optional.
  section_variants.destinations:
    • personality "luxury|editorial|premium" → "premium-grid"
    • product focus = tours OR audience contains "family|leisure" → "image-heavy"
    • Otherwise → "minimal"
  Destination images (REQUIRED — drives visual uniqueness):
    • Always populate content_overrides.destinations.destination_images with 5–6 entries that match the tenant's region_focus and audience.
    • Each entry: { name: "City, Country", image: "https://images.unsplash.com/photo-...&w=1200&q=80" }.
    • Pick destinations that genuinely fit the brand (e.g. luxury Maldives/Santorini for "luxury", Umrah cities Mecca/Madinah for "religious", Dubai/Singapore/KL for "Southeast Asia leisure", Paris/Rome for "European corporate"). Do NOT default to Paris/Tokyo/Bali for every tenant.
    • Image URLs must be real Unsplash photo URLs in the format https://images.unsplash.com/photo-{id}?w=1200&q=80&auto=format&fit=crop. Choose photos that visually match the destination.
  section_variants.features:
    • personality "corporate|professional|business" → "3-col"
    • personality "luxury|boutique|editorial" → "split-image"
    • Otherwise → "icon-grid"
  section_variants.testimonials:
    • audience contains "B2B|agent|corporate" → "video"
    • personality "warm|family|community" → "cards"
    • Otherwise → "quote-strip"
  section_variants.footer:
    • audience contains "B2B|corporate|enterprise" → "corporate"
    • personality "minimal|modern" AND product focus is single → "compact"
    • Otherwise → "detailed"
  section_variants.newsletter:
    • personality "luxury|editorial|boutique" → "split"
    • personality "bold|playful|warm" → "inline"
    • Otherwise → "centered"
  section_variants.trending:
    • personality "luxury|editorial|premium" → "spotlight"
    • personality "bold|adventure|young|playful" → "band"
    • Otherwise → "default"
  section_variants.deals:
    • personality "bold|adventure|young|playful" → "dark"
    • personality "warm|family|community" → "band"
    • Otherwise → "default"
  section_variants.blog:
    • personality "luxury|editorial|premium|boutique" → "magazine"
    • personality "modern|tech|minimal" → "spotlight"
    • Otherwise → "default"

Fonts must reinforce personality:
  • luxury/editorial/boutique → heading: "Playfair Display" or "Cormorant Garamond"; body: "Inter" or "Lato"
  • modern/tech/minimal     → heading: "Inter" or "DM Sans";                         body: "Inter"
  • bold/adventure          → heading: "Bricolage Grotesque" or "Space Grotesk";     body: "Inter"
  • warm/family/friendly    → heading: "Fraunces" or "DM Serif Display";             body: "Nunito" or "Inter"

Self-check before returning the tool call: confirm the chosen variants and fonts actually follow the rules above for the given personality + audience + product focus. If two tenants share the same inputs, the OUTPUT must still be deterministic.`;
}

/**
 * Tool-calling schema for structured output. The AI must call this tool
 * (forced via tool_choice) and we read the parsed arguments — far more
 * reliable than asking for raw JSON in content.
 */
function composeTool() {
  const sectionCopySchema = {
    type: "object",
    additionalProperties: true,
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
    },
  };

  return {
    type: "function",
    function: {
      name: "compose_tenant_site",
      description: "Return the full unique site composition for a tenant.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: [
          "layout_preset", "section_order", "section_variants", "fonts",
          "content_overrides", "pages", "seo", "ai_bot",
        ],
        properties: {
          layout_preset: { type: "string", enum: [...LAYOUT_PRESET_KEYS] },
          section_order: {
            type: "array",
            items: { type: "string", enum: ALLOWED_SECTION_KEYS },
            minItems: 4,
            maxItems: 12,
          },
          section_variants: {
            type: "object",
            additionalProperties: false,
            properties: {
              hero:         { type: "string", enum: VARIANT_OPTIONS.hero },
              destinations: { type: "string", enum: VARIANT_OPTIONS.destinations },
              features:     { type: "string", enum: VARIANT_OPTIONS.features },
              testimonials: { type: "string", enum: VARIANT_OPTIONS.testimonials },
              footer:       { type: "string", enum: VARIANT_OPTIONS.footer },
              newsletter:   { type: "string", enum: VARIANT_OPTIONS.newsletter },
              trending:     { type: "string", enum: VARIANT_OPTIONS.trending },
              deals:        { type: "string", enum: VARIANT_OPTIONS.deals },
              blog:         { type: "string", enum: VARIANT_OPTIONS.blog },
            },
          },
          fonts: {
            type: "object",
            additionalProperties: false,
            required: ["heading", "body"],
            properties: {
              heading: { type: "string" },
              body: { type: "string" },
            },
          },
          palette_tweaks: {
            type: "object",
            additionalProperties: false,
            properties: {
              accent: { type: "string", description: "Optional accent override in #RRGGBB. Leave empty to keep tenant-chosen color." },
            },
          },
          content_overrides: {
            type: "object",
            additionalProperties: false,
            required: ["hero", "features"],
            properties: {
              hero: {
                type: "object",
                required: ["headline", "subhead", "cta_primary"],
                properties: {
                  headline: { type: "string" },
                  subhead: { type: "string" },
                  cta_primary: { type: "string" },
                  cta_secondary: { type: "string" },
                  background_image: { type: "string", description: "Optional Unsplash/Pexels URL used by 'search-overlay' and 'split' hero variants. Choose a brand-relevant landscape image." },
                  side_image: { type: "string", description: "Optional URL for the right-side image used by the 'split' hero variant. If omitted, background_image is reused." },
                  video_url: { type: "string", description: "Optional MP4 URL used by 'video-bg' hero variant. Use a short looping cinematic clip." },
                },
              },
              trending: sectionCopySchema,
              destinations: {
                type: "object",
                additionalProperties: true,
                properties: {
                  title: { type: "string" },
                  subtitle: { type: "string" },
                  picks: { type: "array", items: { type: "string" }, maxItems: 12 },
                  destination_images: {
                    type: "array",
                    minItems: 5,
                    maxItems: 6,
                    description: "Tenant-specific destination cards. Each entry overrides the platform default image for that destination card. Names should match real cities relevant to the tenant's region_focus.",
                    items: {
                      type: "object",
                      required: ["name", "image"],
                      properties: {
                        name:    { type: "string", description: "City, Country (e.g. 'Dubai, UAE')" },
                        country: { type: "string" },
                        image:   { type: "string", description: "Real Unsplash URL: https://images.unsplash.com/photo-...&w=1200&q=80" },
                        tagline: { type: "string", description: "Optional 4-6 word hook" },
                      },
                    },
                  },
                },
              },
              ai_planner: sectionCopySchema,
              budget_explorer: sectionCopySchema,
              features: {
                type: "object",
                required: ["title", "bullets"],
                properties: {
                  title: { type: "string" },
                  subtitle: { type: "string" },
                  bullets: {
                    type: "array",
                    minItems: 3,
                    maxItems: 6,
                    items: {
                      type: "object",
                      required: ["title", "body"],
                      properties: {
                        title: { type: "string" },
                        body: { type: "string" },
                        icon: { type: "string", description: "lucide-react icon name (optional)" },
                      },
                    },
                  },
                },
              },
              testimonials: sectionCopySchema,
              deals: sectionCopySchema,
              newsletter: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  subtitle: { type: "string" },
                  cta: { type: "string" },
                },
              },
              footer: {
                type: "object",
                properties: {
                  about_text: { type: "string" },
                  tagline: { type: "string" },
                },
              },
            },
          },
          pages: {
            type: "object",
            additionalProperties: false,
            required: ["about", "contact", "privacy", "terms"],
            properties: {
              about:   { type: "object", required: ["title", "body_md"], properties: { title: { type: "string" }, intro: { type: "string" }, body_md: { type: "string" } } },
              contact: { type: "object", required: ["title", "body_md"], properties: { title: { type: "string" }, intro: { type: "string" }, body_md: { type: "string" } } },
              privacy: { type: "object", required: ["title", "body_md"], properties: { title: { type: "string" }, body_md: { type: "string" } } },
              terms:   { type: "object", required: ["title", "body_md"], properties: { title: { type: "string" }, body_md: { type: "string" } } },
            },
          },
          seo: {
            type: "object",
            additionalProperties: false,
            required: ["home"],
            properties: {
              home: {
                type: "object",
                required: ["title", "description"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  keywords: { type: "string", description: "Comma-separated, locale + niche aware keywords" },
                  h1: { type: "string", description: "Suggested H1 with primary keyword" },
                  h2_hints: { type: "array", items: { type: "string" }, maxItems: 6, description: "Keyword-focused H2 ideas" },
                  jsonld: {
                    type: "object",
                    description: "Schema.org JSON-LD object for the homepage (TravelAgency / LocalBusiness). Use {{SITE_URL}} as the URL placeholder.",
                    additionalProperties: true,
                  },
                  image_alts: {
                    type: "object",
                    additionalProperties: true,
                    properties: {
                      hero: { type: "string" },
                      destinations: { type: "string" },
                      features: { type: "string" },
                    },
                  },
                },
              },
              about:   { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, keywords: { type: "string" }, h1: { type: "string" } } },
              contact: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, keywords: { type: "string" }, h1: { type: "string" } } },
              privacy: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } } },
              terms:   { type: "object", properties: { title: { type: "string" }, description: { type: "string" } } },
            },
          },
          ai_bot: {
            type: "object",
            required: ["name", "greeting"],
            properties: {
              name: { type: "string" },
              greeting: { type: "string" },
              tone: { type: "string", enum: ["friendly", "professional", "playful", "warm"] },
            },
          },
        },
      },
    },
  };
}

async function callAI(prompt: string): Promise<{ args: any; raw: any }> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const tool = composeTool();
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You design unique tenant travel websites by calling tools. Never return free-form prose." },
        { role: "user", content: prompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "compose_tenant_site" } },
      // Lower temperature: variant choice is now rule-driven, but copy still
      // benefits from some creativity. 0.55 keeps headlines fresh while
      // making variant/font selection consistent with the decision rules.
      temperature: 0.55,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("AI gateway rate-limited (429). Try again shortly.");
    if (res.status === 402) throw new Error("AI gateway payment required (402). Add credits in Settings → Workspace → Usage.");
    throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return a tool call");
  const argStr = call.function?.arguments || "{}";
  return { args: JSON.parse(argStr), raw: json };
}

function fallbackContent(b: RequestBody) {
  const noun = b.region || "the world";
  const aiSafe = (s: string, alt: string) => (b.mention_ai ? s : alt);
  const brand = b.brand_name || "Your travel brand";
  return {
    layout_preset: "ota",
    section_order: [
      "hero", "stats", "trending", "destinations", "features",
      "testimonials", "newsletter",
    ],
    section_variants: {
      hero: "centered",
      destinations: "image-heavy",
      features: "3-col",
      testimonials: "cards",
      footer: "detailed",
      newsletter: "centered",
    },
    fonts: { heading: "Inter", body: "Inter" },
    content_overrides: {
    hero: {
        headline: b.tagline || `Your ${noun} starts here.`,
        subhead: aiSafe(
          `Discover, plan and book unforgettable trips with ${brand}.`,
          `Hand-picked trips and 24/7 expert support from ${brand}.`,
        ),
        cta_primary: "Plan my trip",
        cta_secondary: "Browse destinations",
      },
      trending: { title: "Where travelers are going", subtitle: "Live fares, updated daily" },
      destinations: { title: "Top destinations", subtitle: "Hand-picked stays and experiences" },
      ai_planner: { title: "Plan your perfect trip", subtitle: "Tell us your dream — we'll build it" },
      budget_explorer: { title: "Travel within your budget", subtitle: "Find what fits your wallet" },
      features: {
        title: `Why travelers choose ${brand}`,
        subtitle: "Trusted by thousands across the region",
        bullets: [
          { title: "Best price guarantee", body: "We match any cheaper price you find." },
          { title: "24/7 support", body: "Real humans, any time zone." },
          { title: "Flexible booking", body: "Free cancellation on most stays." },
          { title: "Verified properties", body: "Every hotel personally vetted." },
        ],
      },
      testimonials: { title: "Loved by travelers", subtitle: "Real stories, real trips" },
      newsletter: { title: "Get deals first", subtitle: "Exclusive offers in your inbox.", cta: "Subscribe" },
      footer: { about_text: `${brand} helps travelers explore ${noun} with confidence.` },
    },
    pages: {
      about:   { title: `About ${brand}`, intro: `Travelers we serve, places we love.`, body_md: `## About ${brand}\n\n${brand} helps travelers explore ${noun} with confidence. Our team curates flights, stays, and experiences with a focus on value and reliability.` },
      contact: { title: "Contact us", intro: "We reply within one business day.", body_md: `## Get in touch\n\nEmail: ${b.contact_email || "(add your email)"}\nPhone: ${b.contact_phone || "(add your phone)"}` },
      privacy: { title: "Privacy Policy", body_md: `## Privacy Policy\n\n${brand} respects your privacy. We collect only the information needed to deliver your bookings and improve our service. We never sell personal data.` },
      terms:   { title: "Terms of Service", body_md: `## Terms of Service\n\nBy using ${brand} you agree to act in good faith, follow supplier policies, and pay valid charges. Cancellation rules vary by product and are shown before booking.` },
    },
    seo: {
      home: {
        title: `${brand} — Travel made simple`,
        description: `Plan and book your next trip with ${brand}. Flights, hotels, tours and more.`.slice(0, 160),
        keywords: `${brand}, travel, ${b.region ?? "trips"}, ${b.product_focus ?? "flights"}, hotels, tours`,
        h1: `${brand} — your gateway to ${noun}`,
        h2_hints: ["Why travelers choose us", "Top destinations", "Plan your trip"],
        jsonld: {
          "@context": "https://schema.org",
          "@type": "TravelAgency",
          name: brand,
          url: "{{SITE_URL}}",
          description: `Plan and book trips with ${brand}.`,
          areaServed: b.region ?? "Worldwide",
        },
        image_alts: {
          hero: `${brand} — travel and tours in ${noun}`,
          destinations: `Top destinations curated by ${brand}`,
          features: `Why travelers choose ${brand}`,
        },
      },
      about:   { title: `About ${brand}`, description: `Learn how ${brand} helps travelers explore ${noun}.`.slice(0, 160), h1: `About ${brand}` },
      contact: { title: `Contact ${brand}`, description: `Reach the ${brand} team — we reply within a business day.`.slice(0, 160), h1: `Contact ${brand}` },
      privacy: { title: `Privacy — ${brand}`, description: `How ${brand} handles your personal data.`.slice(0, 160) },
      terms:   { title: `Terms — ${brand}`, description: `Terms of service for using ${brand}.`.slice(0, 160) },
    },
    ai_bot: {
      name: `${brand} AI`,
      greeting: "Hi! Where would you like to go?",
      tone: "friendly" as const,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let logId: string | null = null;

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.site_id) {
      return new Response(JSON.stringify({ error: "site_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always fetch site row — fills any missing wizard fields, ensures we have
    // the latest tenant inputs even on a regenerate-from-admin call.
    const { data: site } = await supabase
      .from("custom_sites")
      .select("site_name, tagline, mention_ai, audience, product_focus, region_focus, brand_personality, contact_email, contact_phone, show_flights, show_hotels, show_tours, show_transfers")
      .eq("id", body.site_id)
      .maybeSingle();
    if (!site) {
      return new Response(JSON.stringify({ error: "site not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    body.brand_name        = body.brand_name        || site.site_name || "Your brand";
    body.tagline           = body.tagline           ?? site.tagline ?? undefined;
    body.audience          = body.audience          ?? site.audience ?? undefined;
    body.product_focus     = body.product_focus     ?? site.product_focus ?? undefined;
    body.region            = body.region            ?? site.region_focus ?? undefined;
    body.brand_personality = body.brand_personality ?? site.brand_personality ?? undefined;
    body.contact_email     = body.contact_email     ?? site.contact_email ?? undefined;
    body.contact_phone     = body.contact_phone     ?? site.contact_phone ?? undefined;
    body.mention_ai        = body.mention_ai        ?? !!site.mention_ai;
    body.products          = body.products          ?? {
      flights: !!site.show_flights,
      hotels: !!site.show_hotels,
      tours: !!site.show_tours,
      transfers: !!site.show_transfers,
    };

    const safeBody = body as Required<Pick<RequestBody, "site_id" | "brand_name" | "mention_ai" | "products">> & RequestBody;

    // Open a generation log entry up-front so we can attribute success/failure.
    const { data: log } = await supabase
      .from("custom_site_generation_logs")
      .insert({
        site_id: safeBody.site_id,
        status: "pending",
        model: MODEL,
        input: safeBody as any,
      })
      .select("id")
      .single();
    logId = log?.id ?? null;

    let generated: any;
    let aiOk = true;
    try {
      const { args } = await callAI(buildPrompt(safeBody));
      generated = args;
    } catch (err) {
      aiOk = false;
      console.warn("[generate-tenant-site-content] AI failed, using fallback:", String(err));
      generated = fallbackContent(safeBody);
      if (logId) {
        await supabase
          .from("custom_site_generation_logs")
          .update({ status: "failed", error: String(err), duration_ms: Date.now() - startedAt })
          .eq("id", logId);
      }
    }

    // Deep-merge with fallback so every section/page has at least default copy.
    const fb = fallbackContent(safeBody);
    const merged = {
      layout_preset:    generated.layout_preset    || fb.layout_preset,
      section_order:    generated.section_order?.length ? generated.section_order : fb.section_order,
      section_variants: { ...fb.section_variants, ...(generated.section_variants || {}) },
      fonts:            { ...fb.fonts, ...(generated.fonts || {}) },
      palette_tweaks:   generated.palette_tweaks || {},
      content_overrides:{ ...fb.content_overrides, ...(generated.content_overrides || {}) },
      pages:            { ...fb.pages, ...(generated.pages || {}) },
      seo:              { ...fb.seo, ...(generated.seo || {}) },
      ai_bot:           { ...fb.ai_bot, ...(generated.ai_bot || {}) },
    };

    // ── 1. Persist site-level fields ────────────────────────────────────
    if (!safeBody.only_section) {
      const sitePatch: Record<string, any> = {
        ai_bot_name:     merged.ai_bot.name || `${safeBody.brand_name} AI`,
        ai_bot_greeting: merged.ai_bot.greeting || "Hi! Where would you like to go?",
        ai_bot_tone:     merged.ai_bot.tone || "friendly",
        mention_ai:      safeBody.mention_ai,
        layout_preset:   merged.layout_preset,
        font_heading:    merged.fonts.heading,
        font_body:       merged.fonts.body,
      };
      // Persist wizard inputs back so future regens use them.
      if (safeBody.audience)          sitePatch.audience = safeBody.audience;
      if (safeBody.product_focus)     sitePatch.product_focus = safeBody.product_focus;
      if (safeBody.region)            sitePatch.region_focus = safeBody.region;
      if (safeBody.brand_personality) sitePatch.brand_personality = safeBody.brand_personality;
      // Apply accent tweak only if the AI suggested one (we never overwrite primary).
      if (merged.palette_tweaks?.accent) sitePatch.accent_color = merged.palette_tweaks.accent;
      await supabase.from("custom_sites").update(sitePatch).eq("id", safeBody.site_id);
    }

    // ── 2. Scoped (single-section) regen short-circuit ──────────────────
    if (safeBody.only_section) {
      const { data: homePage } = await supabase
        .from("custom_site_pages")
        .select("id, content_overrides")
        .eq("site_id", safeBody.site_id)
        .eq("is_home", true)
        .maybeSingle();
      if (homePage?.id) {
        const prev = (homePage.content_overrides || {}) as Record<string, any>;
        // Respect section locks: if the targeted section is locked, do nothing.
        const locks = (prev.__locks || {}) as Record<string, boolean>;
        if (locks[safeBody.only_section]) {
          if (logId) {
            await supabase
              .from("custom_site_generation_logs")
              .update({ status: "skipped", error: "section locked", duration_ms: Date.now() - startedAt })
              .eq("id", logId);
          }
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: "locked", section: safeBody.only_section }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const nextSection = (merged.content_overrides as any)[safeBody.only_section];
        if (nextSection) {
          await supabase
            .from("custom_site_pages")
            .update({ content_overrides: { ...prev, [safeBody.only_section]: nextSection } })
            .eq("id", homePage.id);
        }
      }
      if (logId) {
        await supabase
          .from("custom_site_generation_logs")
          .update({ status: aiOk ? "success" : "failed", output: merged as any, duration_ms: Date.now() - startedAt })
          .eq("id", logId);
      }
      return new Response(
        JSON.stringify({ success: true, section: safeBody.only_section, content: (merged.content_overrides as any)[safeBody.only_section] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 3. Persist HOME page ────────────────────────────────────────────
    const { data: homeRow } = await supabase
      .from("custom_site_pages")
      .select("id, content_overrides, section_variants")
      .eq("site_id", safeBody.site_id)
      .eq("is_home", true)
      .maybeSingle();

    const seoHome = (merged.seo as any).home || {};
    // Preserve any locked sections — keep their previous overrides AND their
    // previous variant choice so manual edits and chosen layout survive.
    const prevOverrides = ((homeRow as any)?.content_overrides || {}) as Record<string, any>;
    const prevVariants  = ((homeRow as any)?.section_variants || {}) as Record<string, string>;
    const locks = (prevOverrides.__locks || {}) as Record<string, boolean>;
    const mergedOverrides: Record<string, any> = { ...(merged.content_overrides as any) };
    const mergedVariants: Record<string, string> = { ...(merged.section_variants as any) };
    for (const k of Object.keys(locks)) {
      if (!locks[k]) continue;
      if (prevOverrides[k] !== undefined) mergedOverrides[k] = prevOverrides[k];
      if (prevVariants[k]  !== undefined) mergedVariants[k]  = prevVariants[k];
    }
    // Always preserve the locks map itself.
    mergedOverrides.__locks = locks;

    const homePatch = {
      sections: merged.section_order,
      section_variants: mergedVariants,
      content_overrides: mergedOverrides,
      seo_meta: seoHome,
      meta_title: seoHome.title || null,
      meta_description: seoHome.description || null,
    };
    if (homeRow?.id) {
      await supabase.from("custom_site_pages").update(homePatch).eq("id", homeRow.id);
    } else {
      await supabase.from("custom_site_pages").insert({
        site_id: safeBody.site_id, slug: "home", title: "Home", is_home: true, is_system: true, sort_order: 0, ...homePatch,
      });
    }

    // ── 4. Persist system pages (about/contact/privacy/terms) ───────────
    const sysPages: Array<{ slug: string; sort_order: number }> = [
      { slug: "about",   sort_order: 1 },
      { slug: "contact", sort_order: 2 },
      { slug: "privacy", sort_order: 90 },
      { slug: "terms",   sort_order: 91 },
    ];
    for (const p of sysPages) {
      const pageDef = (merged.pages as any)[p.slug] || {};
      const seoDef = (merged.seo as any)[p.slug] || {};
      const patch = {
        title: pageDef.title || p.slug,
        body_md: pageDef.body_md || null,
        meta_title: seoDef.title || null,
        meta_description: seoDef.description || null,
        seo_meta: seoDef,
      };
      const { data: existing } = await supabase
        .from("custom_site_pages")
        .select("id")
        .eq("site_id", safeBody.site_id)
        .eq("slug", p.slug)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from("custom_site_pages").update(patch).eq("id", existing.id);
      } else {
        await supabase.from("custom_site_pages").insert({
          site_id: safeBody.site_id, slug: p.slug, sort_order: p.sort_order,
          is_home: false, is_system: true, sections: [], section_variants: {}, ...patch,
        });
      }
    }

    // ── 5. Close out the log entry ──────────────────────────────────────
    if (logId) {
      await supabase
        .from("custom_site_generation_logs")
        .update({
          status: aiOk ? "success" : "failed",
          output: merged as any,
          duration_ms: Date.now() - startedAt,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ai_used: aiOk,
        layout_preset: merged.layout_preset,
        section_order: merged.section_order,
        section_variants: merged.section_variants,
        log_id: logId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-tenant-site-content] error:", err);
    if (logId) {
      await supabase
        .from("custom_site_generation_logs")
        .update({ status: "failed", error: String(err), duration_ms: Date.now() - startedAt })
        .eq("id", logId);
    }
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});