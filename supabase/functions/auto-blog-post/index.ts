import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Topic pool with region hints & search intent ──

interface TopicTemplate {
  title_hint: string;
  category_slug: string;
  regions: string[];
  search_intent: "informational" | "commercial" | "transactional";
}

const TOPICS: TopicTemplate[] = [
  { title_hint: "budget travel tips for international travelers", category_slug: "budget-travel", regions: ["south-asia", "southeast-asia", "americas"], search_intent: "informational" },
  { title_hint: "hidden gem destination guide off the tourist trail", category_slug: "destinations", regions: ["europe", "southeast-asia", "africa", "americas"], search_intent: "informational" },
  { title_hint: "hotel booking hacks and deals for smart travelers", category_slug: "hotel-guides", regions: ["europe", "north-america", "oceania"], search_intent: "commercial" },
  { title_hint: "flight booking tips and cheap fare strategies", category_slug: "flight", regions: ["south-asia", "north-america", "east-asia"], search_intent: "commercial" },
  { title_hint: "food and street food travel guide", category_slug: "food-culture", regions: ["southeast-asia", "south-asia", "europe", "americas"], search_intent: "informational" },
  { title_hint: "adventure and outdoor travel guide", category_slug: "adventure", regions: ["oceania", "africa", "americas", "south-asia"], search_intent: "informational" },
  { title_hint: "travel safety and planning tips for first-time travelers", category_slug: "travel-tips", regions: ["europe", "north-america", "middle-east"], search_intent: "informational" },
  { title_hint: "cultural travel experiences and local traditions", category_slug: "travel", regions: ["east-asia", "africa", "middle-east", "south-asia"], search_intent: "informational" },
  { title_hint: "family travel guide with kids — top destinations", category_slug: "travel-tips", regions: ["europe", "oceania", "north-america"], search_intent: "commercial" },
  { title_hint: "luxury travel on a budget — premium for less", category_slug: "hotel-guides", regions: ["middle-east", "europe", "southeast-asia"], search_intent: "commercial" },
  { title_hint: "solo travel adventure story and tips", category_slug: "adventure", regions: ["southeast-asia", "americas", "oceania"], search_intent: "informational" },
  { title_hint: "digital nomad travel guide — best cities to work from", category_slug: "travel", regions: ["southeast-asia", "europe", "americas"], search_intent: "commercial" },
  { title_hint: "best European city breaks for a long weekend", category_slug: "destinations", regions: ["europe"], search_intent: "commercial" },
  { title_hint: "ultimate Southeast Asia backpacking route", category_slug: "budget-travel", regions: ["southeast-asia"], search_intent: "transactional" },
  { title_hint: "safari and wildlife travel guide in Africa", category_slug: "adventure", regions: ["africa"], search_intent: "commercial" },
  { title_hint: "Japan travel guide — traditions meets modern cities", category_slug: "destinations", regions: ["east-asia"], search_intent: "commercial" },
  { title_hint: "road trip ideas across the Americas", category_slug: "adventure", regions: ["north-america", "americas"], search_intent: "informational" },
  { title_hint: "island hopping guide — best tropical escapes", category_slug: "destinations", regions: ["southeast-asia", "oceania"], search_intent: "commercial" },
  { title_hint: "Middle East travel guide — beyond the skyscrapers", category_slug: "destinations", regions: ["middle-east"], search_intent: "informational" },
  { title_hint: "best beach destinations around the world", category_slug: "destinations", regions: ["oceania", "southeast-asia", "americas"], search_intent: "commercial" },
  { title_hint: "top hiking and trekking destinations worldwide", category_slug: "adventure", regions: ["south-asia", "americas", "oceania", "africa"], search_intent: "informational" },
  { title_hint: "travel photography tips from around the world", category_slug: "travel-tips", regions: ["europe", "east-asia", "africa"], search_intent: "informational" },
  { title_hint: "best places to visit in South Asia", category_slug: "destinations", regions: ["south-asia"], search_intent: "commercial" },
  { title_hint: "Australian and New Zealand travel essentials", category_slug: "travel-tips", regions: ["oceania"], search_intent: "informational" },
  { title_hint: "best night markets and food streets globally", category_slug: "food-culture", regions: ["east-asia", "southeast-asia", "south-asia"], search_intent: "informational" },
  { title_hint: "book cheap flights to Bangkok from Dhaka", category_slug: "flight", regions: ["south-asia", "southeast-asia"], search_intent: "transactional" },
  { title_hint: "all-inclusive Bali honeymoon package guide", category_slug: "hotel-guides", regions: ["southeast-asia"], search_intent: "transactional" },
  { title_hint: "Dubai vacation package with desert safari", category_slug: "destinations", regions: ["middle-east"], search_intent: "transactional" },
];

const LANGUAGES = [
  { code: "en", name: "English", weight: 6, audience: "global English-speaking travelers" },
  { code: "bn", name: "Bengali", weight: 2, audience: "Bangladeshi and Bengali-speaking travelers" },
  { code: "hi", name: "Hindi", weight: 2, audience: "Indian Hindi-speaking travelers" },
  { code: "ar", name: "Arabic", weight: 1, audience: "Middle Eastern and Arabic-speaking travelers" },
];

function pickWeightedLanguage(): typeof LANGUAGES[number] {
  const totalWeight = LANGUAGES.reduce((sum, l) => sum + l.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const lang of LANGUAGES) {
    rand -= lang.weight;
    if (rand <= 0) return lang;
  }
  return LANGUAGES[0];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").substring(0, 80);
}

function pickAuthor(
  tenantId: string | null,
  authors: any[] | null,
  topic: TopicTemplate
): { name: string; id: string | null; bio: string } {
  if (tenantId) {
    const tenantAuthors = (authors || []).filter((a: any) => a.tenant_id === tenantId);
    if (tenantAuthors.length > 0) {
      const pick = tenantAuthors[Math.floor(Math.random() * tenantAuthors.length)];
      return { name: pick.name, id: pick.id, bio: pick.bio || "" };
    }
    const fallbackNames = ["Alex Morgan", "Sarah Chen", "James Wilson", "Maya Patel"];
    return { name: fallbackNames[Math.floor(Math.random() * fallbackNames.length)], id: null, bio: "" };
  }
  const mainAuthors = (authors || []).filter((a: any) => !a.tenant_id);
  if (!mainAuthors.length) return { name: "Travel Vela Team", id: null, bio: "" };
  const scored = mainAuthors.map((a: any) => {
    let score = 0;
    if (topic.regions.includes(a.region)) score += 10;
    if ((a.expertise || []).includes(topic.category_slug)) score += 5;
    score += Math.random() * 3;
    return { author: a, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const topN = scored.slice(0, Math.min(3, scored.length));
  const pick = topN[Math.floor(Math.random() * topN.length)].author;
  return { name: pick.name, id: pick.id, bio: pick.bio || "" };
}

// ── Search intent → CTA strategy mapping ──

function getIntentStrategy(intent: TopicTemplate["search_intent"]) {
  switch (intent) {
    case "informational":
      return {
        tone: "educational, value-heavy, reader-first",
        ctaStrength: "soft",
        ctaAfterIntro: `<div class="blog-cta" style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #0ea5e9"><p style="margin:0;color:#334155">💡 <strong style="color:#0369a1">Planning a trip?</strong> Let Vela AI create your perfect itinerary — flights, hotels, and activities sorted in seconds.</p><p style="margin:10px 0 0"><a href="/trip-planner" style="color:#0ea5e9;font-weight:600;text-decoration:none">Try the AI planner →</a></p></div>`,
        ctaMid: `<div class="blog-cta" style="background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #eab308"><p style="margin:0;color:#334155">🗺️ <strong style="color:#854d0e">Want to include this in your trip?</strong> Travel Vela can arrange it seamlessly — just tell us where you want to go.</p><p style="margin:10px 0 0"><a href="/trip-planner" style="color:#ca8a04;font-weight:600;text-decoration:none">Start planning →</a></p></div>`,
        ctaPreConclusion: `<div class="blog-cta" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #22c55e"><p style="margin:0;color:#334155">🌍 <strong style="color:#166534">Inspired?</strong> This kind of trip is easier than you think. Let our AI planner map it out for you.</p><p style="margin:10px 0 0"><a href="/trip-planner" style="color:#16a34a;font-weight:600;text-decoration:none">Plan your trip →</a></p></div>`,
        ctaFinal: `<div class="blog-cta" style="background:linear-gradient(135deg,#faf5ff,#f3e8ff);border-radius:12px;padding:22px 24px;margin:28px 0;border-left:4px solid #a855f7;text-align:center"><p style="margin:0 0 6px;font-size:1.15em;font-weight:700;color:#6b21a8">Ready to travel?</p><p style="margin:0;color:#334155">Let Travel Vela take care of your flights, hotels, and full itinerary.</p><p style="margin:14px 0 0"><a href="/trip-planner" style="background:#9333ea;color:white;padding:10px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Start planning with Vela AI →</a></p></div>`,
      };
    case "commercial":
      return {
        tone: "balanced, recommendation-focused, comparison-ready",
        ctaStrength: "moderate",
        ctaAfterIntro: `<div class="blog-cta" style="background:linear-gradient(135deg,#fff7ed,#fed7aa);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #f97316"><p style="margin:0;color:#334155">✈️ <strong style="color:#c2410c">Compare prices in seconds:</strong> Travel Vela searches 50+ airlines to find your best deal.</p><p style="margin:10px 0 0"><a href="/flights" style="color:#ea580c;font-weight:600;text-decoration:none">Search flights →</a> · <a href="/hotels" style="color:#ea580c;font-weight:600;text-decoration:none">Find hotels →</a></p></div>`,
        ctaMid: `<div class="blog-cta" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #3b82f6"><p style="margin:0;color:#334155">🏨 <strong style="color:#1d4ed8">Found your destination?</strong> Lock in the best rates — compare hotels, flights, and tours in one search.</p><p style="margin:10px 0 0"><a href="/hotels" style="color:#2563eb;font-weight:600;text-decoration:none">Compare hotels →</a> · <a href="/tours" style="color:#2563eb;font-weight:600;text-decoration:none">Browse tours →</a></p></div>`,
        ctaPreConclusion: `<div class="blog-cta" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #22c55e"><p style="margin:0;color:#334155">📋 <strong style="color:#166534">Want the full plan?</strong> Our AI builds a day-by-day itinerary with flights + hotels + activities, matched to your budget.</p><p style="margin:10px 0 0"><a href="/trip-planner" style="color:#16a34a;font-weight:600;text-decoration:none">Build my trip →</a></p></div>`,
        ctaFinal: `<div class="blog-cta" style="background:linear-gradient(135deg,#312e81,#4338ca);border-radius:12px;padding:22px 24px;margin:28px 0;text-align:center"><p style="margin:0 0 6px;font-size:1.15em;font-weight:700;color:white">Book your trip with Travel Vela</p><p style="margin:0;color:#c7d2fe">Best prices on flights, hotels, and experiences — all in one place.</p><p style="margin:14px 0 0"><a href="/flights" style="background:rgba(255,255,255,0.15);color:white;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin:0 6px">Search flights</a> <a href="/hotels" style="background:rgba(255,255,255,0.15);color:white;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin:0 6px">Find hotels</a></p></div>`,
      };
    case "transactional":
    default:
      return {
        tone: "action-oriented, urgency-driven, deal-focused",
        ctaStrength: "strong",
        ctaAfterIntro: `<div class="blog-cta" style="background:linear-gradient(135deg,#fef2f2,#fecaca);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #ef4444"><p style="margin:0;color:#334155">🔥 <strong style="color:#b91c1c">Deals won't last:</strong> Fares are rising — lock in today's price before it's gone.</p><p style="margin:10px 0 0"><a href="/flights" style="color:#dc2626;font-weight:600;text-decoration:none">Check today's prices →</a></p></div>`,
        ctaMid: `<div class="blog-cta" style="background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #eab308"><p style="margin:0;color:#334155">💰 <strong style="color:#854d0e">Save up to 40%</strong> when you book flights + hotels together on Travel Vela.</p><p style="margin:10px 0 0"><a href="/hotels" style="color:#ca8a04;font-weight:600;text-decoration:none">See hotel deals →</a> · <a href="/tours" style="color:#ca8a04;font-weight:600;text-decoration:none">Book activities →</a></p></div>`,
        ctaPreConclusion: `<div class="blog-cta" style="background:linear-gradient(135deg,#ecfdf5,#a7f3d0);border-radius:12px;padding:18px 22px;margin:20px 0;border-left:4px solid #10b981"><p style="margin:0;color:#334155">✅ <strong style="color:#065f46">Everything sorted in 2 minutes:</strong> Our AI planner handles flights, hotels, and daily plans for you.</p><p style="margin:10px 0 0"><a href="/trip-planner" style="color:#059669;font-weight:600;text-decoration:none">Plan my trip now →</a></p></div>`,
        ctaFinal: `<div class="blog-cta" style="background:linear-gradient(135deg,#991b1b,#dc2626);border-radius:12px;padding:22px 24px;margin:28px 0;text-align:center"><p style="margin:0 0 6px;font-size:1.15em;font-weight:700;color:white">Don't miss out — book now</p><p style="margin:0;color:#fecaca">Prices go up. Seats fill up. Free cancellation on most bookings.</p><p style="margin:14px 0 0"><a href="/flights" style="background:rgba(255,255,255,0.2);color:white;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:0 6px">Book flights →</a> <a href="/hotels" style="background:rgba(255,255,255,0.2);color:white;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin:0 6px">Book hotels →</a></p></div>`,
      };
  }
}

// ── Internal links ──

const INTERNAL_LINKS = {
  flights: { url: "/flights", anchors: ["search flights", "compare flight prices", "find cheap flights", "book your flight"] },
  hotels: { url: "/hotels", anchors: ["browse hotels", "find accommodation", "compare hotel prices", "book your stay"] },
  tours: { url: "/tours", anchors: ["explore tours", "book experiences", "find activities", "discover local tours"] },
  tripPlanner: { url: "/trip-planner", anchors: ["plan your trip", "create an itinerary", "use our AI planner", "build your trip plan"] },
  blog: { url: "/blog", anchors: ["read more travel guides", "explore our blog", "more travel tips", "travel inspiration"] },
};

function getRandomAnchor(links: typeof INTERNAL_LINKS[keyof typeof INTERNAL_LINKS]): string {
  return links.anchors[Math.floor(Math.random() * links.anchors.length)];
}

// ── API call helpers ──
// GPT-5 uses the Responses API with max_output_tokens (not max_completion_tokens).
// Structured Outputs (JSON schema) ensure valid JSON without truncation.
// reasoning.effort="low" keeps reasoning budget small so output tokens aren't eaten.

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { json?: boolean; maxTokens?: number; jsonSchema?: any } = {}
): Promise<string> {
  const isGpt5 = model.startsWith("gpt-5");

  if (isGpt5) {
    // ── Responses API for GPT-5 models ──
    const body: any = {
      model,
      max_output_tokens: opts.maxTokens || 4000,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
    };

    // Use JSON schema structured output if provided
    if (opts.jsonSchema) {
      body.text = {
        format: {
          type: "json_schema",
          name: opts.jsonSchema.name,
          schema: opts.jsonSchema.schema,
        },
      };
    } else if (opts.json) {
      body.text = { format: { type: "json_object" } };
    }

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI Responses ${model} error ${res.status}: ${t}`);
    }
    const data = await res.json();
    // Responses API: output_text is a convenience field; fallback to output array
    let content = data?.output_text || "";
    if (!content && Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text" || part.type === "text") {
              content += part.text || "";
            }
          }
        }
      }
    }
    const usage = data?.usage || {};
    console.log(`[callOpenAI] ${model} (Responses API) | output_tokens: ${usage.output_tokens} | input_tokens: ${usage.input_tokens} | reasoning_tokens: ${usage.output_tokens_details?.reasoning_tokens || 0} | has_content: ${!!content}`);

    if (!content) {
      console.error(`[callOpenAI] ${model} empty response. Full data keys:`, Object.keys(data || {}), "output:", JSON.stringify(data?.output || []).slice(0, 500));
      throw new Error(`${model} returned empty output (status: ${data?.status})`);
    }
    return content;
  }

  // ── Chat Completions API for non-GPT-5 models (gpt-4.1, etc.) ──
  const body: any = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: opts.maxTokens || 4000,
    temperature: 0.7,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${model} error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage || {};
  console.log(`[callOpenAI] ${model} (Chat API) | prompt: ${usage.prompt_tokens} | completion: ${usage.completion_tokens}`);

  if (!content) {
    throw new Error(`${model} returned empty content (finish_reason: ${data?.choices?.[0]?.finish_reason})`);
  }
  return content;
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: opts.maxTokens || 4000,
      temperature: opts.temperature ?? 0.85,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const content = data?.content?.[0]?.text || "";
  const usage = data?.usage || {};
  console.log(`[callAnthropic] claude-sonnet | input: ${usage.input_tokens} | output: ${usage.output_tokens}`);
  return content;
}

/** Safely extract JSON from a response that may have markdown fences or extra text */
function extractJson(raw: string): any {
  const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
  }
  throw new Error("Could not extract JSON from response: " + cleaned.slice(0, 200));
}

// ── 3-CALL OPTIMIZED PIPELINE ──
// Call 1: GPT-4.1 → meta + outline + FAQ combined (~2500 output tokens)
// Call 2: Claude Sonnet → full article writing (~4000 output tokens)
// Call 3: GPT-5-mini (Responses API) → SEO polish only (~4000 output tokens)
// CTA injection is deterministic — done in backend code, not AI.

/** Deterministic CTA injection — replaces markers or inserts at smart positions */
function injectCTAs(html: string, strategy: ReturnType<typeof getIntentStrategy>): string {
  let result = html;
  let injected = 0;

  // Replace explicit markers first
  const markers: [string, string][] = [
    ["<!-- CTA:after_intro -->", strategy.ctaAfterIntro],
    ["<!-- CTA:mid_content -->", strategy.ctaMid],
    ["<!-- CTA:pre_conclusion -->", strategy.ctaPreConclusion],
    ["<!-- CTA:final -->", strategy.ctaFinal],
  ];

  for (const [marker, cta] of markers) {
    if (result.includes(marker)) {
      result = result.replace(marker, cta);
      injected++;
    }
  }

  // If markers were missing, insert at smart positions
  if (injected < 4) {
    const h2s = [...result.matchAll(/<h2[^>]*>/gi)];
    if (h2s.length >= 2 && !result.includes(strategy.ctaAfterIntro)) {
      // After first H2 section
      const pos = h2s[1].index!;
      result = result.slice(0, pos) + strategy.ctaAfterIntro + "\n" + result.slice(pos);
      injected++;
    }
    if (h2s.length >= 4 && !result.includes(strategy.ctaMid)) {
      // Mid-content
      const midIdx = Math.floor(h2s.length / 2);
      const pos = h2s[midIdx].index!;
      result = result.slice(0, pos) + strategy.ctaMid + "\n" + result.slice(pos);
      injected++;
    }
    // Pre-conclusion: before last H2
    if (h2s.length >= 3 && !result.includes(strategy.ctaPreConclusion)) {
      const pos = h2s[h2s.length - 1].index!;
      result = result.slice(0, pos) + strategy.ctaPreConclusion + "\n" + result.slice(pos);
      injected++;
    }
    // Final CTA: append at end
    if (!result.includes(strategy.ctaFinal)) {
      result += "\n" + strategy.ctaFinal;
      injected++;
    }
  }

  console.log(`[blog] CTA injection: ${injected} CTAs placed (deterministic)`);
  return result;
}

async function generateBlogPost(
  topic: TopicTemplate,
  author: { name: string; id: string | null; bio: string },
  lang: typeof LANGUAGES[number],
  keys: { openai: string; anthropic: string }
): Promise<{ title: string; excerpt: string; content: string; tags: string[]; models_used: string[]; costs: number[] }> {

  const currency = lang.code === "bn" ? "BDT (৳)" : lang.code === "hi" ? "INR (₹)" : lang.code === "ar" ? "AED (د.إ)" : "USD ($)";
  const langNote = lang.code !== "en" ? `Write EVERYTHING in ${lang.name}. Only JSON keys in English.` : "";
  const strategy = getIntentStrategy(topic.search_intent);

  // ────────────────────────────────────────────────
  // CALL 1: GPT-4.1 → Combined Meta + Outline + FAQ (~2500 tokens)
  // ────────────────────────────────────────────────

  const combinedPrompt = `You are a travel content strategist for Travel Vela.
TOPIC: "${topic.title_hint}"
SEARCH INTENT: "${topic.search_intent}"
Author: ${author.name}${author.bio ? ` — ${author.bio}` : ""}
Language: ${lang.name} (${lang.code}). Audience: ${lang.audience}.
Currency: ${currency}.
${langNote}

Return JSON with ALL of these fields:
{
  "title": "SEO-optimized, 50-70 chars, emotional + keyword-rich, include 2026 or a number",
  "meta_description": "Compelling max 155 chars for Google SERP",
  "excerpt": "120-160 char summary for blog cards",
  "tags": ["5 SEO tags"],
  "target_keywords": ["3-5 primary keywords"],
  "featured_snippet": {
    "definition_paragraph": "40-60 word definition/summary for Google featured snippet",
    "key_list_items": ["5-7 concise bullet points"]
  },
  "sections": [
    {
      "heading": "H2 heading",
      "key_points": ["specific bullet — REAL places, REAL tips"],
      "tone_note": "storytelling angle"
    }
  ],
  "recommended_plan": {
    "title": "Recommended X-Day Plan",
    "days": ["Day 1: Specific activity at Real Place"],
    "why_it_works": "1-sentence value"
  },
  "estimated_budget": {
    "flights": "range in ${currency}",
    "hotels": "per night in ${currency}",
    "food": "daily in ${currency}",
    "activities": "total in ${currency}",
    "total": "total trip in ${currency}"
  },
  "faq": [
    { "q": "question travelers search", "a": "2-3 sentence answer" }
  ]
}

RULES: 6-8 sections. Every place must be REAL and NAMED. 3-5 FAQ items. First section = hook. Last = "Final Thoughts".`;

  console.log(`[blog] Call 1: GPT-4.1 combined meta+outline for "${topic.title_hint}"`);
  const structureRaw = await callOpenAI(
    keys.openai, "gpt-4.1",
    "You are an SEO travel content strategist. Return valid JSON only. Every place must be REAL. Be thorough but concise.",
    combinedPrompt,
    { json: true, maxTokens: 2500 }
  );
  const structure = extractJson(structureRaw);

  // ────────────────────────────────────────────────
  // CALL 2: Claude Sonnet → Full Article Writing
  // ────────────────────────────────────────────────

  const writingSystemPrompt = `You are ${author.name}, a passionate travel writer for Travel Vela who's been to 40+ countries.
${author.bio ? `Your background: ${author.bio}` : ""}

SEARCH INTENT: ${topic.search_intent} → Tone: ${strategy.tone}
CTA Strength: ${strategy.ctaStrength}

YOUR VOICE:
- Write like telling a friend about your trip over coffee
- Use sensory details: smells, sounds, textures
- Include honest opinions — what surprised you, what you'd skip
- Share specific moments: "I remember standing at the edge of..."
- Vary sentence length. Short punchy lines. Then longer descriptions.

NEVER:
- Sound like Wikipedia or a travel brochure
- Use "nestled", "vibrant", "bustling", "explore the area"
- Write generic filler. Repeat points. Use aggressive sales language.

VISA RULES: Never state visa requirements as facts. Always add "check the official embassy site."`;

  const writingPrompt = `Write a full travel blog post. Language: ${lang.name}. ${langNote}
Currency: ${currency}

OUTLINE:
${JSON.stringify(structure.sections, null, 2)}

KEYWORDS (weave naturally): ${(structure.target_keywords || []).join(", ")}

FEATURED SNIPPET (include early):
${structure.featured_snippet?.definition_paragraph || "Write a 40-60 word summary"}
Key list: ${JSON.stringify(structure.featured_snippet?.key_list_items || [])}

PLAN: ${JSON.stringify(structure.recommended_plan || {})}
BUDGET: ${JSON.stringify(structure.estimated_budget || {})}

INSTRUCTIONS:
1. Write 1200-1800 words of HTML
2. Use <h2>/<h3>/<p>/<ul>/<li>/<strong>
3. Insert CTA markers: <!-- CTA:after_intro --> <!-- CTA:mid_content --> <!-- CTA:pre_conclusion --> <!-- CTA:final -->
4. Include featured snippet as <p><strong>In short:</strong>...</p> near top
5. Include Recommended Plan as <h2> with numbered list
6. Include Budget as <h2> with <ul>
7. Include 3-5 internal links: <a href="/flights">, <a href="/hotels">, <a href="/tours">, <a href="/trip-planner">
8. Start with a hook. Bridge sentences between sections.
9. FAQ at end: <h2>FAQ</h2> then <h3>Q</h3><p>A</p>

FAQs:
${(structure.faq || []).map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

Return ONLY HTML. No JSON. No markdown fences.`;

  console.log(`[blog] Call 2: Claude Sonnet writing`);
  const htmlContent = await callAnthropic(
    keys.anthropic, writingSystemPrompt, writingPrompt,
    { temperature: 0.9, maxTokens: 5000 }
  );

  // ────────────────────────────────────────────────
  // DETERMINISTIC: Backend CTA injection (no AI needed)
  // ────────────────────────────────────────────────

  const htmlWithCTAs = injectCTAs(htmlContent, strategy);

  // ────────────────────────────────────────────────
  // CALL 3: GPT-5-mini → SEO Polish Only (no CTA work)
  // ────────────────────────────────────────────────

  const seoPrompt = `Polish this blog post for SEO. CTAs are already injected — do NOT touch or remove any <div class="blog-cta"> blocks.

HTML:
${htmlWithCTAs}

SEO tasks:
1. Ensure proper H2/H3 hierarchy (no skipped levels)
2. Add <strong> to 3-5 key phrases for emphasis
3. Verify FAQ section uses <h3> for questions
4. Check internal links exist (/flights, /hotels, /tours, /trip-planner)
5. Fix any broken HTML tags
6. Ensure alt text on any images

Language: ${lang.name}. Do NOT change writing voice or tone. Do NOT remove or modify CTA blocks.`;

  console.log(`[blog] Call 3: GPT-5-mini SEO polish (Responses API + JSON schema)`);
  const seoSchema = {
    name: "seo_polished_blog",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        content: { type: "string", description: "Full polished HTML content (CTAs preserved)" },
        word_count: { type: "number", description: "Approximate word count" },
        seo_fixes: { type: "number", description: "Number of SEO improvements made" },
      },
      required: ["content", "word_count", "seo_fixes"],
    },
  };
  const seoRaw = await callOpenAI(
    keys.openai, "gpt-5-mini",
    "You are an SEO specialist. Polish HTML for search engines. Preserve all CTA blocks untouched.",
    seoPrompt,
    { maxTokens: 10000, jsonSchema: seoSchema }
  );
  const seoResult = extractJson(seoRaw);

  return {
    title: structure.title,
    excerpt: structure.excerpt || structure.meta_description || "",
    content: seoResult.content || htmlWithCTAs,
    tags: structure.tags || [],
    models_used: ["gpt-4.1", "claude-sonnet-4.6", "gpt-5-mini"],
    costs: [0.012, 0.018, 0.012],
  };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!openaiKey || !anthropicKey) {
      throw new Error("Both OPENAI_API_KEY and ANTHROPIC_API_KEY are required for the 3-model pipeline");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    let tenantId: string | null = null;
    let mode: "single" | "all_enterprise" = "single";
    try {
      const body = await req.json();
      tenantId = body?.tenant_id || null;
      if (body?.mode === "all_enterprise") mode = "all_enterprise";
    } catch { /* no body = main site */ }

    // ── Enterprise plan-gating for tenant-scoped runs ──
    if (tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, plan_key, plan_expires_at, auto_blog_enabled")
        .eq("id", tenantId)
        .maybeSingle();

      if (!tenant) {
        return new Response(JSON.stringify({ success: false, error: "Tenant not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const planActive = !tenant.plan_expires_at || new Date(tenant.plan_expires_at) > new Date();
      const effectivePlan = planActive ? tenant.plan_key : "starter";

      const { data: planRow } = await supabase
        .from("b2b_plans")
        .select("allow_auto_blog, allow_blog")
        .eq("plan_key", effectivePlan)
        .maybeSingle();

      if (!planRow?.allow_auto_blog) {
        return new Response(
          JSON.stringify({ success: false, error: "Auto-blog requires the Enterprise plan" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Cron mode: fan out to every Enterprise tenant with auto_blog_enabled=true ──
    if (mode === "all_enterprise" && !tenantId) {
      const { data: enterpriseTenants } = await supabase
        .from("tenants")
        .select("id, plan_key, plan_expires_at, auto_blog_enabled")
        .eq("auto_blog_enabled", true);

      const eligible = (enterpriseTenants || []).filter((t: any) => {
        const active = !t.plan_expires_at || new Date(t.plan_expires_at) > new Date();
        return active && t.plan_key === "enterprise";
      });

      const fanout: Array<{ tenant_id: string; status: string; error?: string }> = [];
      for (const t of eligible) {
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/auto-blog-post`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ tenant_id: t.id }),
          });
          fanout.push({ tenant_id: t.id, status: r.ok ? "queued" : "error", error: r.ok ? undefined : `HTTP ${r.status}` });
        } catch (e) {
          fanout.push({ tenant_id: t.id, status: "error", error: (e as Error).message });
        }
      }

      return new Response(
        JSON.stringify({ success: true, mode: "all_enterprise", tenants_processed: fanout.length, fanout }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick 1 topic per invocation to stay within 150s edge function limit
    // Cron runs 3x/day to produce 3 daily posts
    const shuffled = [...TOPICS].sort(() => Math.random() - 0.5);
    const selectedTopics: TopicTemplate[] = [shuffled[0]];

    const { data: categories } = await supabase.from("blog_categories").select("id,slug");
    const catMap = new Map((categories || []).map((c: any) => [c.slug, c.id]));

    const { data: authors } = await supabase
      .from("blog_author_profiles")
      .select("id,name,slug,bio,expertise,region,country,tenant_id")
      .eq("is_active", true);

    const results = [];

    for (const topic of selectedTopics) {
      const author = pickAuthor(tenantId, authors, topic);
      const lang = pickWeightedLanguage();

      try {
        const post = await generateBlogPost(topic, author, lang, {
          openai: openaiKey,
          anthropic: anthropicKey,
        });

        const slug = slugify(post.title) + "-" + Date.now().toString(36);
        const categoryId = catMap.get(topic.category_slug) || null;
        const featuredImage = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 100000000)}?w=800&q=80`;

        const { error } = await supabase.from("blog_posts").insert({
          title: post.title,
          slug,
          excerpt: post.excerpt,
          content: post.content,
          featured_image: featuredImage,
          tags: post.tags,
          author_name: author.name,
          author_profile_id: author.id,
          language: lang.code,
          status: "published",
          published_at: new Date().toISOString(),
          category_id: categoryId,
          tenant_id: tenantId,
          word_count: post.content.split(/\s+/).length,
        });

        if (error) {
          console.error("Insert error:", error);
          results.push({ title: post.title, status: "error", error: error.message });
        } else {
          results.push({
            title: post.title,
            slug,
            status: "published",
            language: lang.code,
            author: author.name,
            search_intent: topic.search_intent,
            models: post.models_used,
          });
        }

        // Log each model stage
        const stages = [
          { model: "gpt-4.1", cost: post.costs[0] },
          { model: "claude-sonnet-4.6", cost: post.costs[1] },
          { model: "gpt-5-mini", cost: post.costs[2] },
        ];
        for (const stage of stages) {
          await supabase.from("ai_usage_logs").insert({
            model: stage.model,
            provider: stage.model.includes("claude") ? "anthropic" : "openai",
            function_name: "auto-blog-post",
            success: true,
            estimated_cost: stage.cost,
          });
        }
      } catch (postError) {
        console.error(`Failed to generate post for "${topic.title_hint}":`, postError);
        results.push({ topic: topic.title_hint, status: "error", error: (postError as Error).message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        posts_created: results.filter(r => r.status === "published").length,
        pipeline: "gpt4.1-structure → claude-writing → backend-cta → gpt5mini-seo (3 AI calls)",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto blog post error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
