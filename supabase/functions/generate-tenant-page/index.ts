/**
 * generate-tenant-page
 *
 * AI-generates a single Custom Website page (or every content page on the
 * site, when `full_site=true`) for a specific tenant. Picks an appropriate
 * ordered list of mirror-mode section keys + fills `content_overrides` for
 * those sections in one structured AI call.
 *
 * Inputs:
 *   - site_id (required)
 *   - page_id  | page_slug          → target page (when generating one page)
 *   - new_page { slug, title }      → create a brand-new page and generate it
 *   - full_site = true              → regenerate every existing content page
 *   - brief? (optional free-text guidance from the agent)
 *
 * Editing model: REPLACE wholesale. We overwrite `sections` and
 * `content_overrides` for the targeted page(s). Section locks
 * (`content_overrides.__locks`) are honored — any locked section keeps its
 * existing override copy.
 *
 * Persistence:
 *   - custom_site_pages: sections, content_overrides, meta_title,
 *     meta_description, seo_meta, sort_order (new pages only).
 *   - custom_site_generation_logs: status, model, input, output, duration_ms.
 *
 * Tenant uniqueness: The prompt is seeded with the site's brand kit
 * (site_name, tagline, audience, product_focus, region_focus,
 * brand_personality, layout_preset) AND a 6-char run nonce so two
 * regenerations of the same brand still produce different copy.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

/**
 * Catalogue of mirror-mode section keys the AI is allowed to pick from.
 * MUST stay in sync with src/components/customsite/builder/mirrorSections.ts
 * and src/components/customsite/render/MainSiteSectionRenderer.tsx.
 */
const ALLOWED_SECTION_KEYS = [
  "hero", "stats", "banners", "offers", "ai_planner", "trending",
  "destinations", "recommendations", "deals", "budget_explorer",
  "features", "testimonials", "app_download", "blog", "newsletter",
] as const;

/**
 * Editable text fields per section — passed to the AI so it knows what to write.
 * Values can be strings OR arrays of strings (e.g. hero.rotating_words). Sanitize
 * preserves both shapes; anything not declared here is dropped.
 */
const SECTION_FIELDS: Record<string, string[]> = {
  hero:            ["eyebrow", "headline", "subhead", "rotating_words", "cta_primary", "cta_secondary"],
  stats:           ["title", "subtitle"],
  banners:         ["title", "subtitle"],
  offers:          ["title", "subtitle"],
  ai_planner:      ["title", "subtitle", "cta_label"],
  trending:        ["title", "subtitle"],
  destinations:    ["title", "subtitle"],
  recommendations: ["title", "subtitle"],
  deals:           ["title", "subtitle"],
  budget_explorer: ["title", "subtitle"],
  features:        ["title", "subtitle"],
  testimonials:    ["title", "subtitle"],
  app_download:    ["title", "subtitle"],
  blog:            ["title", "subtitle"],
  newsletter:      ["title", "subtitle", "cta"],
};

/** Fields that legitimately accept an array of short strings. */
const ARRAY_FIELDS = new Set(["rotating_words"]);

interface RequestBody {
  site_id: string;
  page_id?: string;
  page_slug?: string;
  new_page?: { slug: string; title: string };
  full_site?: boolean;
  brief?: string;
}

function nonce(n = 8) {
  // Crypto-strong nonce so two regenerations of the same brand never share a
  // seed — combined with temperature=0.8 this is what guarantees per-tenant
  // (and per-run) copy uniqueness.
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => (b % 36).toString(36)).join("");
}

function allowedSectionsForPlan(modules: any) {
  return ALLOWED_SECTION_KEYS.filter((k) => {
    if (k === "trending")        return modules?.flights !== false;
    if (k === "ai_planner")      return modules?.ai_copy === true;
    if (k === "budget_explorer") return modules?.hotels !== false || modules?.tours !== false;
    return true;
  });
}

function buildPrompt(opts: {
  site: any;
  page: { slug: string; title: string };
  brief?: string;
  allowed: string[];
  modules: any;
  runId: string;
}) {
  const { site, page, brief, allowed, modules, runId } = opts;
  const productList = [
    modules?.flights && "flights",
    modules?.hotels && "hotels",
    modules?.tours && "tours",
    modules?.transfers && "transfers",
  ].filter(Boolean).join(", ") || "travel services";

  const aiClause = modules?.ai_copy
    ? "You MAY reference an AI trip planner or smart recommendations where natural."
    : "Do NOT mention AI, machine learning, smart algorithms, or automated planning anywhere. Use language about expert curation, human travel specialists, and personalized service instead.";

  const fieldsBlock = allowed
    .map((k) => `  - ${k}: fields = [${(SECTION_FIELDS[k] || []).join(", ")}]`)
    .join("\n");

  return `You are a senior brand strategist + copywriter for travel agencies.
Design a single page for the tenant brand below. Pick the most appropriate
ordered list of section keys for THIS page (Home, About, Contact, custom),
then write tenant-specific copy for the editable fields of those sections.

Brand:
  Name: ${site.site_name}
  Tagline (if any): ${site.tagline ?? "(none)"}
  Audience: ${site.audience ?? "general travelers"}
  Primary product focus: ${site.product_focus ?? "mixed"}
  Region focus: ${site.region_focus ?? "global"}
  Brand personality: ${site.brand_personality ?? "modern"}
  Products offered: ${productList}
  Layout preset (style hint): ${site.layout_preset ?? "ota"}

Page to generate:
  Slug: ${page.slug}
  Title: ${page.title}
  Agent brief: ${brief?.trim() ? brief.trim() : "(none — use brand context only)"}

Rules:
  - ${aiClause}
  - NEVER reference the underlying platform, suppliers, or third-party providers.
  - Copy MUST be unique to this brand. Avoid stock travel-template phrasing.
  - Pick sections that make sense for THIS page slug. Examples:
      home    → hero + stats + (trending|destinations) + features + testimonials + newsletter
      about   → hero + features + testimonials  (no booking widgets)
      contact → hero + features  (lean — contact form is rendered elsewhere)
      custom  → infer from slug + brief
  - Pick ONLY from this allowed catalogue (filtered by tenant plan):
${fieldsBlock}
  - For each picked section, fill ONLY the listed fields. Keep headlines under 90 chars
    and subheads under 200 chars. No emoji. No exclamation marks.
  - Write a unique meta_title (<60 chars) and meta_description (<160 chars) for this page.
  - Run ID for variation: ${runId}
`;
}

function buildTool(allowed: string[]) {
  // Build an EXPLICIT per-section schema. Gemini's structured-output is far
  // more reliable when each section's fields are spelled out (vs a generic
  // additionalProperties map, which it often returns empty).
  const sectionShapes: Record<string, any> = {};
  for (const key of allowed) {
    const fields = SECTION_FIELDS[key] || [];
    const props: Record<string, any> = {};
    for (const f of fields) {
      props[f] = ARRAY_FIELDS.has(f)
        ? { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 }
        : { type: "string" };
    }
    sectionShapes[key] = {
      type: "object",
      description: `Copy for the ${key} section.`,
      properties: props,
      required: fields.filter((f) => f !== "rotating_words" && f !== "eyebrow" && f !== "cta_secondary").slice(0, 2),
    };
  }
  return {
    type: "function" as const,
    function: {
      name: "compose_tenant_page",
      description: "Pick ordered sections and fill brand-specific copy for every picked section.",
      parameters: {
        type: "object",
        required: ["sections", "content_overrides", "meta_title", "meta_description"],
        properties: {
          sections: {
            type: "array",
            description: "Ordered list of section keys to render on this page.",
            items: { type: "string", enum: allowed },
            minItems: 1,
            maxItems: 10,
          },
          content_overrides: {
            type: "object",
            description: "MANDATORY: For EVERY section in `sections`, include an entry here with brand-specific copy. Do not leave this empty.",
            properties: sectionShapes,
          },
          meta_title: { type: "string", description: "SEO title (<60 chars)." },
          meta_description: { type: "string", description: "SEO description (<160 chars)." },
        },
      },
    },
  };
}

async function callAI(prompt: string, allowed: string[]) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const tool = buildTool(allowed);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You generate unique, tenant-specific page copy by calling tools. Never return free-form prose." },
        { role: "user", content: prompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "compose_tenant_page" } },
      temperature: 0.8,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("AI gateway rate-limited (429). Try again shortly.");
    if (res.status === 402) throw new Error("AI gateway payment required (402). Add credits in workspace settings.");
    throw new Error(`AI gateway ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("AI did not return a tool call");
  return JSON.parse(call.function?.arguments || "{}");
}

/**
 * Sanitize the AI output. Drops sections not in the allowed catalogue and
 * fields not declared for that section.
 */
function sanitize(args: any, allowed: string[]) {
  const allowSet = new Set(allowed);
  const sections: string[] = Array.isArray(args.sections)
    ? Array.from(new Set(args.sections.filter((s: any) => typeof s === "string" && allowSet.has(s))))
    : [];
  const overrides: Record<string, Record<string, any>> = {};
  const rawO = args.content_overrides || {};
  for (const k of sections) {
    const fields = SECTION_FIELDS[k] || [];
    const src = rawO[k];
    if (!src || typeof src !== "object") continue;
    const out: Record<string, any> = {};
    for (const f of fields) {
      const v = src[f];
      if (ARRAY_FIELDS.has(f)) {
        if (Array.isArray(v)) {
          const arr = v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 60)).slice(0, 6);
          if (arr.length) out[f] = arr;
        }
      } else if (typeof v === "string" && v.trim()) {
        out[f] = v.trim().slice(0, 240);
      }
    }
    if (Object.keys(out).length) overrides[k] = out;
  }
  return {
    sections,
    content_overrides: overrides,
    meta_title: typeof args.meta_title === "string" ? args.meta_title.slice(0, 70) : "",
    meta_description: typeof args.meta_description === "string" ? args.meta_description.slice(0, 180) : "",
  };
}

/**
 * Deterministic safety net: when AI returns sections but no/empty overrides
 * for some of them, fill those sections with brand-aware baseline copy so the
 * tenant ALWAYS sees visible per-brand changes after a generate run.
 */
function fillMissingOverrides(
  result: { sections: string[]; content_overrides: Record<string, Record<string, any>> },
  site: any,
  page: { slug: string; title: string },
) {
  const brand = site.site_name || "Our agency";
  const region = site.region_focus || "the world";
  const audience = site.audience || "travelers";
  const tagline = site.tagline || "";
  const isHome = page.slug === "home";
  const isAbout = page.slug === "about";
  const isContact = page.slug === "contact";

  const baseline: Record<string, Record<string, any>> = {
    hero: {
      eyebrow: tagline || `${brand}`,
      headline: isHome
        ? `Travel ${region} with ${brand}`
        : isAbout
        ? `About ${brand}`
        : isContact
        ? `Get in touch with ${brand}`
        : `${page.title} — ${brand}`,
      subhead: isHome
        ? `Curated flights, stays and experiences across ${region} for ${audience}.`
        : isAbout
        ? `We help ${audience} discover and book ${region} with confidence.`
        : isContact
        ? `Our team is ready to help plan your next trip to ${region}.`
        : `${page.title} at ${brand}.`,
    },
    stats:           { title: `Why ${audience} choose ${brand}`, subtitle: `Real numbers from real trips across ${region}.` },
    banners:         { title: `Featured offers from ${brand}`, subtitle: `Hand-picked deals for ${region}.` },
    offers:          { title: `Today's best offers`, subtitle: `Limited-time savings curated for ${audience}.` },
    ai_planner:      { title: `Plan your trip to ${region}`, subtitle: `Tell us your dates and budget — we'll do the rest.`, cta_label: "Start planning" },
    trending:        { title: `Trending right now`, subtitle: `Routes ${audience} are booking this week.` },
    destinations:    { title: `Popular in ${region}`, subtitle: `${brand}'s most-loved destinations.` },
    recommendations: { title: `Recommended for ${audience}`, subtitle: `Curated by the ${brand} team.` },
    deals:           { title: `Deals worth booking`, subtitle: `Verified pricing, no hidden fees.` },
    budget_explorer: { title: `Find your perfect trip`, subtitle: `Filter ${region} by budget and style.` },
    features:        { title: `Why book with ${brand}`, subtitle: `Built for ${audience} who care about the details.` },
    testimonials:    { title: `What travelers say about ${brand}`, subtitle: `Honest stories from real trips.` },
    app_download:    { title: `Take ${brand} with you`, subtitle: `Manage every booking from your pocket.` },
    blog:            { title: `${region} travel guides`, subtitle: `Insider tips from the ${brand} team.` },
    newsletter:      { title: `Stay ahead of the next deal`, subtitle: `Join ${brand}'s monthly briefing for ${audience}.`, cta: "Subscribe" },
  };

  let filled = 0;
  for (const k of result.sections) {
    if (!result.content_overrides[k] || Object.keys(result.content_overrides[k]).length === 0) {
      if (baseline[k]) {
        result.content_overrides[k] = baseline[k];
        filled++;
      }
    }
  }
  return filled;
}

/** Default starter sections per page type (used when AI fails). */
function fallbackForSlug(slug: string, allowed: string[]) {
  const a = (k: string) => allowed.includes(k);
  if (slug === "home")    return ["hero", a("trending") && "trending", "destinations", "features", "testimonials", "newsletter"].filter(Boolean) as string[];
  if (slug === "about")   return ["hero", "features", "testimonials"];
  if (slug === "contact") return ["hero", "features"];
  return ["hero", "features"];
}

async function generateOnePage(supa: any, site: any, modules: any, page: { id: string; slug: string; title: string; content_overrides?: any }, brief: string | undefined) {
  const allowed = allowedSectionsForPlan(modules);
  const runId = nonce(6);
  const start = Date.now();

  let result: ReturnType<typeof sanitize> | null = null;
  let aiError: string | null = null;
  try {
    const prompt = buildPrompt({ site, page, brief, allowed, modules, runId });
    const raw = await callAI(prompt, allowed);
    result = sanitize(raw, allowed);
    if (result.sections.length === 0) throw new Error("AI returned no usable sections");
  } catch (e: any) {
    aiError = e?.message || String(e);
    result = {
      sections: fallbackForSlug(page.slug, allowed),
      content_overrides: {},
      meta_title: `${page.title} | ${site.site_name}`,
      meta_description: site.tagline || `${page.title} at ${site.site_name}`,
    };
  }

  // Safety net: ensure every picked section has at least baseline brand-aware
  // copy. Without this, when the AI returns sections but skips overrides, the
  // tenant sees zero textual change after a regenerate.
  const filledCount = fillMissingOverrides(result, site, page);
  if (!result.meta_title) result.meta_title = `${page.title} | ${site.site_name}`;
  if (!result.meta_description) result.meta_description = site.tagline || `${page.title} at ${site.site_name}`;

  // Honor section locks: keep existing copy for any locked section.
  const existingOverrides = (page.content_overrides || {}) as Record<string, any>;
  const lockedMap = (existingOverrides.__locks || {}) as Record<string, boolean>;
  const mergedOverrides: Record<string, any> = { ...result.content_overrides };
  for (const key of Object.keys(lockedMap)) {
    if (lockedMap[key] && existingOverrides[key]) {
      mergedOverrides[key] = existingOverrides[key];
    }
  }
  // Preserve the lock map itself.
  if (Object.keys(lockedMap).length) mergedOverrides.__locks = lockedMap;

  await supa.from("custom_site_pages").update({
    sections: result.sections,
    content_overrides: mergedOverrides,
    meta_title: result.meta_title,
    meta_description: result.meta_description,
    seo_meta: { title: result.meta_title, description: result.meta_description, generated_at: new Date().toISOString() },
    auto_generated_at: new Date().toISOString(),
  }).eq("id", page.id);

  // triggered_by is uuid in schema — pass null when not initiated by a user.
  await supa.from("custom_site_generation_logs").insert({
    site_id: site.id,
    status: aiError ? "fallback" : "ok",
    model: MODEL,
    triggered_by: null,
    input: { page_id: page.id, slug: page.slug, brief, run_id: runId, source: "generate-tenant-page", filled_overrides: filledCount },
    output: result,
    error: aiError,
    duration_ms: Date.now() - start,
  });

  return { page_id: page.id, slug: page.slug, ai_error: aiError, sections: result.sections };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.site_id) throw new Error("site_id required");

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load site (need brand context).
    const { data: site, error: siteErr } = await supa
      .from("custom_sites").select("*").eq("id", body.site_id).maybeSingle();
    if (siteErr || !site) throw new Error("site not found");

    // Resolve plan modules (controls allowed sections).
    let modules: any = {};
    try {
      const { data: m } = await supa.rpc("get_tenant_modules", { _tenant_id: site.tenant_id });
      modules = m ?? {};
    } catch {
      modules = { flights: true, hotels: true, tours: true, transfers: true, ai_copy: false };
    }

    // Resolve target page(s).
    let targets: any[] = [];
    if (body.full_site) {
      const { data: pages } = await supa
        .from("custom_site_pages")
        .select("id, slug, title, content_overrides, is_system, sort_order")
        .eq("site_id", body.site_id)
        .order("sort_order");
      // No skip-list: tenant wants every page (including legal/policy pages)
      // regenerated with brand-unique copy on full-site runs.
      targets = pages || [];
    } else if (body.new_page) {
      const slug = body.new_page.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const title = body.new_page.title || slug;
      // Check if a page with this slug already exists.
      const { data: existing } = await supa
        .from("custom_site_pages").select("id, slug, title, content_overrides")
        .eq("site_id", body.site_id).eq("slug", slug).maybeSingle();
      if (existing) {
        targets = [existing];
      } else {
        const { data: maxRow } = await supa
          .from("custom_site_pages").select("sort_order")
          .eq("site_id", body.site_id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
        const nextOrder = (maxRow?.sort_order ?? 0) + 1;
        const { data: created, error: createErr } = await supa
          .from("custom_site_pages").insert({
            site_id: body.site_id, slug, title,
            sections: [], content_overrides: {},
            sort_order: nextOrder, is_home: false, is_system: false,
          }).select("id, slug, title, content_overrides").single();
        if (createErr || !created) throw new Error(createErr?.message || "Could not create page");
        targets = [created];
      }
    } else if (body.page_id || body.page_slug) {
      let q = supa.from("custom_site_pages")
        .select("id, slug, title, content_overrides")
        .eq("site_id", body.site_id);
      if (body.page_id) q = q.eq("id", body.page_id);
      else q = q.eq("slug", body.page_slug);
      const { data: row } = await q.maybeSingle();
      if (!row) throw new Error("page not found");
      targets = [row];
    } else {
      throw new Error("Provide page_id, page_slug, new_page, or full_site=true");
    }

    if (targets.length === 0) {
      return new Response(JSON.stringify({ success: true, generated: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate sequentially to keep AI quota predictable. Most calls = 1 page.
    const results: any[] = [];
    for (const t of targets) {
      try {
        const r = await generateOnePage(supa, site, modules, t, body.brief);
        results.push(r);
      } catch (e: any) {
        results.push({ page_id: t.id, slug: t.slug, error: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, generated: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});