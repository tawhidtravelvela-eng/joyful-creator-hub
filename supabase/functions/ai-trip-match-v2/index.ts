/**
 * AI Trip Match V2 — Product Matching Layer (Simplified)
 *
 * Strategy: Send AI-generated activity titles directly to unified-tour-search,
 * which already handles normalization, metro broadening, compound queries,
 * identity preservation, and scoring. This engine just:
 *  1. Sends each AI title → unified-tour-search (freetext)
 *  2. Picks the best result (already ranked by the search gateway)
 *  3. Handles option-level matching (Express Pass, etc.)
 *  4. Applies traveler safety filters
 *  5. Matches hotels via unified-hotel-search
 *  6. Matches flights via unified-flight-search
 *
 * IMPORTANT: This engine NEVER accesses DB tables directly for pricing.
 * All data flows through unified-tour-search, unified-hotel-search, and unified-flight-search.
 * No convertPrice or USD_RATES — all unified APIs return pre-converted prices.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ═══════════════════════════════════════════════════════════════
// ██  INLINED QUALITY LAYER (formerly trip-quality-layer v15)
// ═══════════════════════════════════════════════════════════════

function parseTimeToMinutes(time: string | undefined | null): number {
  if (!time) return -1;
  const s = String(time).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const l = s.toLowerCase();
  if (l === "morning" || l === "early morning") return 480;
  if (l === "afternoon") return 840;
  if (l === "evening") return 1080;
  if (l === "night") return 1200;
  return -1;
}

function qlNormalizeLabel(v: any): string {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function qlCityKey(v: any): string {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getActDurationH(act: any, fallback = 2): number {
  if (act?.duration_hours && Number(act.duration_hours) > 0) return Number(act.duration_hours);
  if (act?._durationHours && Number(act._durationHours) > 0) return Number(act._durationHours);
  if (act?.durationMinutes && Number(act.durationMinutes) > 0) return Number(act.durationMinutes) / 60;
  const dur = String(act?.duration || "").toLowerCase();
  const hM = dur.match(/([\d.]+)\s*h/); if (hM) return parseFloat(hM[1]);
  const mM = dur.match(/([\d.]+)\s*min/); if (mM) return parseFloat(mM[1]) / 60;
  if (/full\s*day/.test(dur)) return 8;
  if (/half\s*day/.test(dur)) return 4.5;
  const bare = parseFloat(dur); if (!isNaN(bare) && bare > 0) return bare;
  return fallback;
}

const QL_LOGISTIC_RX = /arrive|transfer|check|hotel|airport|depart|taxi|grab|uber|shuttle|pickup|drop.?off/i;
function qlIsLogistic(a: any): boolean { return QL_LOGISTIC_RX.test(a?.activity || a?.name || ""); }

const QL_METRO_ALIASES: Record<string, string[]> = {
  "kuala lumpur": ["putrajaya", "petaling jaya", "shah alam", "cyberjaya", "genting highlands", "batu caves", "klcc", "bukit bintang"],
  "singapore": ["sentosa", "jurong", "changi", "marina bay"],
  "penang": ["george town", "georgetown", "batu ferringhi", "batu ferringi", "butterworth"],
  "langkawi": ["cenang", "datai", "kuah", "pantai cenang"],
  "bali": ["ubud", "seminyak", "kuta", "nusa dua", "sanur", "canggu", "uluwatu"],
  "bangkok": ["silom", "sukhumvit", "khao san"],
  "tokyo": ["shibuya", "shinjuku", "akihabara", "asakusa"],
  "dubai": ["jumeirah", "deira", "marina"],
};
const QL_MEMBER_TO_PARENT: Record<string, string> = {};
for (const [parent, members] of Object.entries(QL_METRO_ALIASES)) {
  for (const m of members) QL_MEMBER_TO_PARENT[m] = parent;
}

function qlCitiesMatch(a: string, b: string): boolean {
  const ka = qlCityKey(a), kb = qlCityKey(b);
  if (!ka || !kb) return false;
  if (ka === kb || ka.includes(kb) || kb.includes(ka)) return true;
  const pa = QL_MEMBER_TO_PARENT[ka] || ka;
  const pb = QL_MEMBER_TO_PARENT[kb] || kb;
  return pa === pb;
}

type Trust = "bookable_confirmed" | "bookable_needs_recheck" | "suggested_nonbookable";
function tagTrust(a: any): Trust {
  if (a.source === "travelvela" && a.is_live_price && a.product_code && Number(a.cost_estimate || 0) > 0)
    return "bookable_confirmed";
  if (a.source === "travelvela" || a.product_code) return "bookable_needs_recheck";
  return "suggested_nonbookable";
}

interface QualityIssue {
  code: string; day: number; detail: string; severity: "critical" | "warning" | "info"; repaired: boolean;
}

async function runInlineAiReview(itinerary: any, params: any, context?: { flightContext?: any[]; hotelContext?: any[]; activityContext?: any[] }): Promise<{ itinerary: any; aiIssues: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

  const daySummaries = (itinerary.days || []).map((day: any) => {
    const acts = (day.activities || []).map((a: any) => {
      const dur = getActDurationH(a, 2);
      const time = a.time || "??:??";
      const price = a.cost_estimate ? ` $${a.cost_estimate}` : "";
      const code = a.product_code ? " [booked]" : "";
      return `  ${time} ${a.activity || "?"} (${dur}h${price}${code})`;
    }).join("\n");
    return `Day ${day.day} — ${day.city || "?"} (${day.type || "full"}):\n${acts || "  (no activities)"}`;
  }).join("\n\n");

  const paxInfo = `${params?.adults || 2} adults, ${params?.children || 0} children, ${params?.infants || 0} infants`;
  const travelStyle = params?.travel_style || "standard";

  let contextBlock = "";
  if (context?.flightContext?.length) {
    contextBlock += "\nBOOKED FLIGHTS:\n" + context.flightContext.map((f: any) =>
      `  ${f.leg || "?"}: ${f.route} | ${f.airline} | dep ${f.departure || "?"} arr ${f.arrival || "?"} | $${f.price || 0}`
    ).join("\n") + "\n";
  }
  if (context?.hotelContext?.length) {
    contextBlock += "\nBOOKED HOTELS:\n" + context.hotelContext.map((h: any) =>
      `  ${h.city}: ${h.name} (${h.stars}★) $${h.price_per_night}/night × ${h.nights} nights`
    ).join("\n") + "\n";
  }
  if (context?.activityContext?.length) {
    contextBlock += "\nMATCHED ACTIVITIES:\n" + context.activityContext.map((a: any) =>
      `  Day ${a.day}: ${a.product_name} | ${a.duration_hours ? a.duration_hours + 'h' : '?'} | $${a.price} ${a.currency} | ${a.city}`
    ).join("\n") + "\n";
  }

  const reviewPrompt = `You are a travel itinerary quality reviewer. Review this itinerary and return a JSON object with fixes.

TRAVELERS: ${paxInfo}, style: ${travelStyle}
${contextBlock}
ITINERARY:
${daySummaries}

REVIEW RULES:
1. Check timing feasibility: activities must not overlap. Each needs travel buffer (15-30 min between).
2. Check day load: max ~10 active hours per day. Arrival/departure days have limited time.
3. Check for duplicate activities across days (same attraction appearing twice).
4. Check departure days: no long activities (theme parks, full-day tours) on departure days.
5. Check pacing: heavy activities (theme parks 6-8h) should not stack on same day.
6. DO NOT remove activities unless they are duplicates or physically impossible to fit.
7. Prefer shifting times over removing activities.
8. Trust the original plan's composition — only fix timing/feasibility issues.
9. If BOOKED FLIGHTS are provided: ensure no activities conflict with flight departure/arrival times. Activities on departure day must end 3h before flight departure. Activities on arrival day should start after arrival + 1.5h transfer buffer.
10. If BOOKED HOTELS are provided: hotel check-in items should reference the actual booked hotel name.
11. If MATCHED ACTIVITIES are provided: use their actual durations for overlap checks instead of estimates. Do NOT remove matched/booked activities — they are confirmed products.

RESPOND WITH EXACTLY THIS JSON (no markdown, no explanation):
{
  "fixes": [
    {"day": 1, "activity": "name", "action": "shift_time", "new_time": "14:00", "reason": "..."},
    {"day": 2, "activity": "name", "action": "remove", "reason": "duplicate of day 1"},
    {"day": 3, "activity": "name", "action": "shift_time", "new_time": "10:00", "reason": "..."}
  ],
  "issues": ["brief issue description 1", "brief issue description 2"]
}

If no fixes needed, return: {"fixes": [], "issues": []}`;

  let aiResponse: string | null = null;

  if (LOVABLE_API_KEY) {
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You are a travel itinerary QA bot. Return ONLY valid JSON. No markdown." },
            { role: "user", content: reviewPrompt },
          ],
          temperature: 0.1,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        aiResponse = data.choices?.[0]?.message?.content || null;
      }
    } catch (e: any) { console.warn(`[QualityAI] Gateway failed: ${e.message}`); }
  }

  if (!aiResponse && GOOGLE_KEY) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: reviewPrompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048 } }),
        },
      );
      if (resp.ok) {
        const data = await resp.json();
        aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      }
    } catch (e: any) { console.warn(`[QualityAI] Google fallback failed: ${e.message}`); }
  }

  if (!aiResponse) return { itinerary, aiIssues: ["AI review unavailable — skipped"] };

  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { itinerary, aiIssues: ["AI returned non-JSON — skipped"] };
    const parsed = JSON.parse(jsonMatch[0]);
    const fixes = parsed.fixes || [];
    const issues = parsed.issues || [];
    let fixesApplied = 0;

    for (const fix of fixes) {
      const dayIdx = Number(fix.day) - 1;
      const day = itinerary.days?.[dayIdx];
      if (!day?.activities) continue;
      const actIdx = day.activities.findIndex((a: any) =>
        qlNormalizeLabel(a.activity).includes(qlNormalizeLabel(fix.activity)) ||
        qlNormalizeLabel(fix.activity).includes(qlNormalizeLabel(a.activity))
      );
      if (actIdx === -1) continue;
      if (fix.action === "shift_time" && fix.new_time) {
        day.activities[actIdx].time = fix.new_time;
        fixesApplied++;
      } else if (fix.action === "remove") {
        // GUARD: Never remove matched/booked activities (they have product_code from match engine)
        const targetAct = day.activities[actIdx];
        if (targetAct.product_code) {
          console.log(`[QualityAI] ⛔ BLOCKED removal of matched activity "${targetAct.activity}" (product_code: ${targetAct.product_code})`);
          continue;
        }
        day.activities.splice(actIdx, 1);
        fixesApplied++;
      }
    }
    console.log(`[QualityAI] Applied ${fixesApplied}/${fixes.length} fixes`);
    return { itinerary, aiIssues: issues };
  } catch (e: any) {
    return { itinerary, aiIssues: ["AI response parse failed"] };
  }
}

function runVetoLayer(itinerary: any, params: any): { itinerary: any; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  const days = itinerary.days || [];
  const knownCities = Array.isArray(params?.cities) ? params.cities.map((c: any) => String(c?.name || "").trim()) : [];

  for (const day of days) { for (const act of (day.activities || [])) { act._trust = tagTrust(act); } }

  // VETO 1: Wrong City Product
  for (const day of days) {
    const dayCity = day.city || "";
    if (!dayCity || !day.activities) continue;
    for (let i = day.activities.length - 1; i >= 0; i--) {
      const act = day.activities[i];
      if (qlIsLogistic(act)) continue;
      const productCity = act._searchCity || act.city || "";
      if (!productCity) continue;
      if (productCity && !qlCitiesMatch(dayCity, productCity)) {
        const belongsToAnotherCity = knownCities.some((c: string) => qlCitiesMatch(c, productCity) && !qlCitiesMatch(c, dayCity));
        if (belongsToAnotherCity && act.product_code) {
          delete act.product_code; delete act.productOptionCode; delete act.is_live_price;
          issues.push({ code: "WRONG_CITY_PRODUCT", day: day.day, detail: `"${act.activity}" — product from ${productCity} removed (day is ${dayCity})`, severity: "warning", repaired: true });
        }
      }
    }
  }

  // VETO 2: Exact Product-Code Duplicate
  const seenProductCodes = new Map<string, { day: number; actName: string }>();
  for (const day of days) {
    if (!day.activities) continue;
    for (let i = day.activities.length - 1; i >= 0; i--) {
      const act = day.activities[i];
      const pc = act.product_code;
      if (!pc) continue;
      const existing = seenProductCodes.get(pc);
      if (existing) {
        day.activities.splice(i, 1);
        issues.push({ code: "PRODUCT_CODE_DEDUP", day: day.day, detail: `"${act.activity}" — duplicate of Day ${existing.day}`, severity: "critical", repaired: true });
      } else {
        seenProductCodes.set(pc, { day: day.day, actName: act.activity || "" });
      }
    }
  }

  // VETO 3: Night activity time sanity
  const NIGHT_RX = /\bnight\s+(tour|safari|cruise|walk|show|market|view|experience|dining)\b/i;
  for (const day of days) {
    if (!day.activities) continue;
    for (const act of day.activities) {
      const name = act.activity || act.name || "";
      const productName = act.product_name || "";
      if (!NIGHT_RX.test(name) && !NIGHT_RX.test(productName)) continue;
      const mins = parseTimeToMinutes(act.time);
      if (mins >= 0 && mins < 1020) {
        act.time = "19:00";
        issues.push({ code: "NIGHT_ACT_TIME_FIX", day: day.day, detail: `"${name}" shifted to 19:00`, severity: "warning", repaired: true });
      }
    }
  }

  // VETO 4: Transition Day Validation
  const HEAVY_RX = /\b(theme\s*park|water\s*park|universal\s*studio|full[\s-]*day|multi[\s-]*stop|sky\s*world|legoland|safari\s*(?!night)|zoo|aquarium|day\s*trip|genting\s*highland)\b/i;
  for (const day of days) {
    const dayType = day.day_type || day._day_type || "";
    if (dayType !== "transition") continue;
    if (!day.activities) continue;
    const nonLogistic = day.activities.filter((a: any) => !qlIsLogistic(a) && a.category !== "transport");
    if (nonLogistic.length > 2) {
      let kept = 0;
      for (let i = day.activities.length - 1; i >= 0; i--) {
        const act = day.activities[i];
        if (qlIsLogistic(act) || act.category === "transport") continue;
        kept++;
        if (kept > 2) {
          // GUARD: Never remove matched/booked activities
          if (act.product_code) {
            console.log(`[Veto] ⛔ BLOCKED removal of matched activity "${act.activity}" on transition day ${day.day}`);
            continue;
          }
          const removed = day.activities.splice(i, 1)[0];
          issues.push({ code: "TRANSITION_DAY_OVERLOAD", day: day.day, detail: `"${removed.activity}" removed — transition day max 2`, severity: "warning", repaired: true });
        }
      }
    }
    for (let i = day.activities.length - 1; i >= 0; i--) {
      const act = day.activities[i];
      const name = act.activity || act.name || "";
      if (HEAVY_RX.test(name) && !qlIsLogistic(act)) {
        // Heavy activities (theme parks, day trips, full-day tours) are physically impossible on transition days
        // Even matched/booked ones must be removed — they cannot fit around flights
        if (act.product_code) {
          console.log(`[Veto] 🗑️ Removing matched heavy activity "${name}" on transition day ${day.day} (product_code: ${act.product_code})`);
        }
        day.activities.splice(i, 1);
        issues.push({ code: "TRANSITION_DAY_HEAVY_ACT", day: day.day, detail: `"${name}" removed — heavy act on transition day`, severity: "warning", repaired: true });
      }
    }
    const connections = itinerary.travel_connections || [];
    const dayConn = connections.find((c: any) => c.day === day.day || c.day_index === (day.day - 1));
    if (dayConn?.to_city && day.city && !qlCitiesMatch(day.city, dayConn.to_city)) {
      day.city = dayConn.to_city;
      issues.push({ code: "TRANSITION_CITY_OWNER_FIX", day: day.day, detail: `City ownership corrected to ${dayConn.to_city}`, severity: "warning", repaired: true });
    }
  }

  return { itinerary, issues };
}

function computeQualityConfidence(itinerary: any, issues: QualityIssue[]): number {
  let score = 1.0;
  const days = itinerary.days || [];
  score -= issues.filter(i => i.severity === "critical" && !i.repaired).length * 0.1;
  for (const day of days) {
    const acts = (day.activities || []).filter((a: any) => !qlIsLogistic(a));
    if (acts.length === 0 && day.type !== "departure" && day.type !== "free") score -= 0.05;
  }
  let totalActs = 0, bookedActs = 0;
  for (const day of days) {
    for (const act of (day.activities || [])) { if (qlIsLogistic(act)) continue; totalActs++; if (act.product_code) bookedActs++; }
  }
  const bookingRate = totalActs > 0 ? bookedActs / totalActs : 0;
  if (bookingRate < 0.3) score -= 0.1;
  if (bookingRate > 0.6) score += 0.05;
  return Math.max(0.1, Math.min(1.0, Math.round(score * 1000) / 1000));
}

async function runQualityLayer(itinerary: any, params: any, context?: { flightContext?: any[]; hotelContext?: any[]; activityContext?: any[] }): Promise<{ itinerary: any; confidence: number; issues: QualityIssue[]; aiReviewIssues: string[] }> {
  // AI Review #2 removed — it was stripping matched bookable activities and adding 2-3s latency.
  // The deterministic veto layer handles all necessary consistency checks.
  const { itinerary: final, issues } = runVetoLayer(itinerary, params);
  const confidence = computeQualityConfidence(final, issues);
  console.log(`[Quality] ✅ confidence=${confidence}, veto_issues=${issues.length} (AI review skipped)`);
  return { itinerary: final, confidence, issues, aiReviewIssues: [] };
}

// ── Progress broadcaster ──
function createProgressBroadcaster(progressId?: string) {
  if (!progressId) return { send: () => {}, cleanup: () => {} };
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return { send: () => {}, cleanup: () => {} };
  const sb = createClient(supabaseUrl, serviceKey);
  const channel = sb.channel(`trip-progress-${progressId}`);
  let subscribed = false;
  channel.subscribe((status: string) => { if (status === "SUBSCRIBED") subscribed = true; });
  return {
    send: (step: number, label: string) => {
      if (!subscribed) return;
      channel.send({ type: "broadcast", event: "progress", payload: { step, label } })
        .catch(() => {});
      console.log(`[Progress] → step=${step} label="${label}"`);
    },
    cleanup: () => { try { sb.removeChannel(channel); } catch {} },
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// NOTE: No convertPrice for matched products — unified APIs return pre-converted prices.
// AI estimates are in USD and get converted to targetCurrency using live exchange rates below.

const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1, EUR: 0.86, GBP: 0.75, BDT: 122.3, CNY: 6.92, INR: 92.1,
  THB: 31.65, MYR: 3.94, SGD: 1.28, JPY: 157.7, AED: 3.67, SAR: 3.75,
  AUD: 1.42, NZD: 1.7, CAD: 1.37, KRW: 1477, HKD: 7.8, PHP: 56.2,
  IDR: 15700, VND: 25300, PKR: 280, LKR: 300, NPR: 133,
};

async function loadExchangeRates(): Promise<Record<string, number>> {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await sb.from("api_settings").select("settings").eq("provider", "currency_rates").maybeSingle();
    if (data?.settings) {
      const s = data.settings as any;
      return { ...DEFAULT_EXCHANGE_RATES, ...(s.live_rates || {}) };
    }
  } catch (e) { console.warn("[match-v2] exchange rates load error:", e); }
  return { ...DEFAULT_EXCHANGE_RATES };
}

function convertUsdTo(amount: number, targetCurrency: string, rates: Record<string, number>): number {
  if (!amount || targetCurrency === "USD") return amount;
  const rate = rates[targetCurrency];
  if (!rate) return amount;
  return Math.round(amount * rate);
}

// ── Traveler Profile (informational only — AI handles safety during planning) ──

interface TravelerProfile {
  hasInfants: boolean;
  hasChildren: boolean;
  hasSeniors: boolean;
  travelStyle?: string;
}

// NOTE: Safety filtering removed from match engine. The AI generator already
// plans infant/child/senior-safe itineraries with appropriate pacing.
// The match engine trusts the AI's activity selection and only matches products.

// ── Skip filters ──

const SKIP_CATEGORIES = new Set(["food"]);
const SKIP_PATTERNS = /\b(breakfast|lunch|dinner|check.?in|check.?out|hotel|airport transfer|taxi|grab|free time|at leisure|relax|rest|shopping|last.?minute)\b/i;
const BOOKABLE_TRANSPORT = /\b(cable\s*car|sky\s*cab|sky\s*way|funicular|gondola|sky\s*rail|monorail\s*tour)\b/i;
const KNOWN_BOOKABLE_PATTERNS = /\b(theme\s*park|water\s*park|sky\s*world|universal\s*studio|legoland|genting|aquaria|aquarium|zoo|safari|butterfly\s*farm|entopia|observation\s*deck|sky\s*park|artscience|museum|gallery|city\s*tour|guided\s*tour|day\s*trip|cable\s*car|sky\s*bridge|sky\s*cab|helicopter|cruise|boat\s*tour|river\s*cruise|snorkeling|diving|cooking\s*class|workshop|show|performance|cultural\s*show|dinner\s*show|hop[\s-]*on|segway|buggy|atv|zipline|bungee|skydiv|escape\s*room|vr\s*park|kartzone|go[\s-]*kart|paintball|laser\s*tag|trampoline|ice\s*skat|ski|surf|parasail|jet\s*ski|banana\s*boat|wakeboard|flyboard|spa|massage|hot\s*spring|onsen|pub\s*crawl|bar\s*hop|tasting|food\s*tour|putrajaya|highland|hill\s*station)\b/i;

const FREE_LANDMARKS = new Set([
  "merlion", "merlion park", "marina bay sands exterior", "petronas towers", "petronas twin towers",
  "twin towers", "klcc park", "bukit bintang", "chinatown", "china town", "little india",
  "arab street", "kampong glam", "orchard road", "dataran merdeka", "merdeka square",
  "cenang beach", "eagle square", "dataran lang", "jonker street",
  "padang", "esplanade park", "fort canning", "lake gardens", "perdana botanical",
  "walking street", "night market",
]);

function isFreeLandmark(name: string): boolean {
  const lower = name.toLowerCase().trim();
  for (const lm of FREE_LANDMARKS) {
    if (lower.includes(lm)) return true;
  }
  return false;
}

function shouldSkipActivity(activity: any): boolean {
  const name = activity.activity || "";
  const cat = activity.category || "";
  const cost = Number(activity.cost_estimate || 0);
  // Skip activities explicitly marked non-bookable by AI
  if (activity.is_bookable === false) return true;
  if (SKIP_CATEGORIES.has(cat)) return true;
  if (cat === "transport" && !BOOKABLE_TRANSPORT.test(name)) return true;
  // If AI marked as bookable, always try to match (even if cost=0 — AI may not know exact price)
  if (activity.is_bookable === true) return false;
  // Legacy fallback: no is_bookable field — use heuristics
  if (cost > 0) return false;
  if (isFreeLandmark(name)) return true;
  if (cat === "free" || activity.is_free) return true;
  if (SKIP_PATTERNS.test(name)) return true;
  // If it matches known bookable patterns, don't skip
  if (KNOWN_BOOKABLE_PATTERNS.test(name)) return false;
  return false;
}

// ═══ OPTION-LEVEL DEEP MATCHING ═══

const OPTION_NOISE_PAREN = new Set([
  "the", "and", "for", "with", "from", "near", "also", "very",
]);

// Known option variant patterns for stronger extraction
const KNOWN_OPTION_VARIANTS = new Map<string, string[]>([
  ["express pass", ["express", "pass"]],
  ["skip the line", ["skip", "line"]],
  ["fast track", ["fast", "track"]],
  ["fast lane", ["fast", "lane"]],
  ["round trip", ["round", "trip"]],
  ["one way", ["one", "way"]],
  ["all day", ["all", "day"]],
  ["night tour", ["night"]],
  ["combo", ["combo"]],
  ["vip", ["vip"]],
  ["private", ["private"]],
  ["family pass", ["family", "pass"]],
  ["sunset", ["sunset"]],
  ["sunrise", ["sunrise"]],
  ["twilight", ["twilight"]],
]);

function extractOptionKeywords(activity: any): string[] {
  const keywords: string[] = [];
  const name = activity.activity || "";
  const parenMatches = name.matchAll(/\(([^)]+)\)/g);
  for (const m of parenMatches) {
    const inner = m[1].trim();
    if (/^[A-Z]{2,5}$/.test(inner)) continue;
    const innerLower = inner.toLowerCase();
    // Check known variant patterns first
    for (const [variant, tokens] of KNOWN_OPTION_VARIANTS) {
      if (innerLower.includes(variant)) {
        keywords.push(...tokens);
      }
    }
    // Also add raw tokens
    const tokens = innerLower
      .split(/[\s,]+/)
      .filter((t: string) => t.length > 2 && !OPTION_NOISE_PAREN.has(t));
    keywords.push(...tokens);
  }
  const notes = activity.booking_notes || "";
  if (notes) {
    const VARIANT_PATTERNS = /\b(express\s*pass|fast\s*lane|vip|premium|combo|skip[\s-]*the[\s-]*line|round[\s-]*trip|one[\s-]*way|guided|self[\s-]*guided|private|group|family|adult|child|twilight|sunset|sunrise|night|evening)\b/gi;
    const variantMatches = notes.match(VARIANT_PATTERNS) || [];
    for (const vm of variantMatches) {
      keywords.push(...vm.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2));
    }
  }
  return [...new Set(keywords)];
}

// NOTE: matchProductOption removed — option matching is handled via unified-tour-search
// (either pre-enriched _matchedOption or tourProduct API with pre-converted productOptions)

// ═══ DESTINATION POST-FILTER ═══
// Metro aliases: city → sub-destinations that should also be accepted
const METRO_ALIASES: Record<string, string[]> = {
  singapore: ["sentosa", "sentosa island", "jurong", "changi", "marina bay", "orchard"],
  "kuala lumpur": ["genting", "genting highlands", "putrajaya", "batu caves", "petaling jaya", "shah alam", "cyberjaya", "sepang"],
  langkawi: ["langkawi island", "kedah"],
  penang: ["penang island", "george town", "georgetown", "butterworth"],
  bangkok: ["pattaya", "ayutthaya", "kanchanaburi"],
  bali: ["ubud", "seminyak", "kuta", "nusa dua", "sanur", "canggu", "uluwatu"],
  tokyo: ["yokohama", "kamakura", "hakone", "nikko"],
  london: ["windsor", "stonehenge", "bath", "oxford", "cambridge"],
  paris: ["versailles", "giverny", "disneyland paris"],
  dubai: ["abu dhabi", "sharjah", "ajman"],
  istanbul: ["cappadocia", "ephesus"],
  seoul: ["incheon", "suwon", "nami island"],
  "hong kong": ["macau", "lantau"],
  delhi: ["agra", "jaipur"],
  mumbai: ["pune", "lonavala"],
  hanoi: ["ha long", "halong", "ninh binh", "sapa"],
  "ho chi minh": ["cu chi", "mekong delta"],
  jakarta: ["bandung", "bogor"],
  "kuala terengganu": ["redang", "perhentian"],
  "kota kinabalu": ["kundasang", "mount kinabalu"],
  phuket: ["phi phi", "james bond island", "krabi"],
  "chiang mai": ["chiang rai", "doi suthep"],
  cairo: ["giza", "luxor", "aswan"],
  rome: ["vatican", "pompeii", "florence"],
  barcelona: ["montserrat"],
  lisbon: ["sintra", "cascais"],
  athens: ["santorini", "mykonos"],
};

/**
 * Check if a product's destination is compatible with the expected city.
 * Accepts exact match, metro alias match, or substring containment.
 */
function isDestinationCompatible(productDest: string, expectedCity: string): boolean {
  if (!productDest || !expectedCity) return true; // no data to filter on
  const destLower = productDest.toLowerCase().trim();
  const cityLower = expectedCity.toLowerCase().trim();

  // Exact or substring match
  if (destLower.includes(cityLower) || cityLower.includes(destLower)) return true;

  // Metro alias match: check if product dest is a known sub-destination of the city
  const aliases = METRO_ALIASES[cityLower] || [];
  for (const alias of aliases) {
    if (destLower.includes(alias) || alias.includes(destLower)) return true;
  }

  // Reverse check: is the expected city a sub-destination of the product's metro?
  for (const [metro, subs] of Object.entries(METRO_ALIASES)) {
    if (subs.some(s => s === cityLower || cityLower.includes(s))) {
      if (destLower.includes(metro) || metro.includes(destLower)) return true;
      if (subs.some(s => destLower.includes(s))) return true;
    }
  }

  return false;
}

// ═══ LOCAL FUZZY MATCHING UTILITIES ═══

/** Normalize text for comparison: lowercase, strip noise, collapse whitespace */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[()[\]{}&+\-–—:;!?.,'"\/\\|#@*~`]/g, " ")
    .replace(/\b(the|a|an|of|in|at|to|for|and|with|by|from|on|is|are|was|were|has|have|this|that|its|our|your|guided|day|trip|tour|visit|admission|entry|ticket|experience)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract meaningful tokens from a text string */
function extractTokens(text: string): string[] {
  return normalizeForMatch(text).split(" ").filter(t => t.length > 2);
}

/**
 * Product-family keywords for cross-family denial.
 * If AI asks for one family and product is a conflicting family, hard-reject.
 */
const PRODUCT_TYPE_GROUPS: Record<string, RegExp> = {
  admission: /\b(admission|entry|entr(ance|y)\s*ticket|skip[\s-]*the[\s-]*line|observation\s*deck)\b/i,
  photoshoot: /\b(photo\s*shoot|photoshoot|photography|photographer|photo\s*session|portrait)\b/i,
  transfer: /\b(airport\s*transfer|hotel\s*transfer|private\s*transfer|shared\s*transfer|shuttle\s*service|pickup|drop[\s-]*off)\b/i,
  night_tour: /\b(night\s*tour|night\s*safari|evening\s*tour|after[\s-]*dark|night\s*walk|night\s*cruise)\b/i,
  combo_tour: /\b(combo|private\s*tour|guided\s*tour|day\s*trip|walking\s*tour|sightseeing\s*tour|river\s*cruise)\b/i,
  cooking_class: /\b(cooking\s*class|culinary\s*class|food\s*workshop)\b/i,
  rental: /\b(car\s*rental|bike\s*rental|scooter\s*rental|motorbike\s*rental)\b/i,
  spa: /\b(spa|massage|wellness|hammam|onsen)\b/i,
};

function detectProductType(title: string): string | null {
  // Order matters: check specific (narrower) types first
  if (PRODUCT_TYPE_GROUPS.photoshoot.test(title)) return "photoshoot";
  if (PRODUCT_TYPE_GROUPS.transfer.test(title)) return "transfer";
  if (PRODUCT_TYPE_GROUPS.cooking_class.test(title)) return "cooking_class";
  if (PRODUCT_TYPE_GROUPS.rental.test(title)) return "rental";
  if (PRODUCT_TYPE_GROUPS.spa.test(title)) return "spa";
  if (PRODUCT_TYPE_GROUPS.night_tour.test(title)) return "night_tour";
  if (PRODUCT_TYPE_GROUPS.admission.test(title)) return "admission";
  if (PRODUCT_TYPE_GROUPS.combo_tour.test(title)) return "combo_tour";
  return null;
}

/**
 * Cross-Family Denial Matrix: hard conflicts between product families.
 * If the AI intent is family X and the candidate product is family Y,
 * and Y is in X's conflict set, apply a heavy penalty (effective rejection).
 */
const TYPE_CONFLICT_MATRIX: Record<string, Set<string>> = {
  admission: new Set(["night_tour", "combo_tour", "photoshoot", "transfer", "cooking_class", "rental", "spa"]),
  photoshoot: new Set(["admission", "night_tour", "combo_tour", "transfer", "cooking_class", "rental", "spa"]),
  transfer: new Set(["admission", "photoshoot", "night_tour", "combo_tour", "cooking_class", "rental", "spa"]),
  night_tour: new Set(["admission", "photoshoot", "transfer"]),
  combo_tour: new Set(["photoshoot", "transfer", "rental"]),
  cooking_class: new Set(["admission", "photoshoot", "transfer", "rental"]),
  rental: new Set(["admission", "photoshoot", "transfer", "cooking_class", "spa"]),
  spa: new Set(["admission", "photoshoot", "transfer", "rental"]),
};

/**
 * Score how well a product matches an AI-generated activity title.
 * Returns 0-1 where 1 is perfect match.
 */
function scoreTitleMatch(aiTitle: string, productTitle: string, productPlaces?: string[]): number {
  const aiNorm = normalizeForMatch(aiTitle);
  const prodNorm = normalizeForMatch(productTitle);

  // Exact normalized match
  if (aiNorm === prodNorm) return 1.0;

  // Substring containment (one contains the other)
  if (prodNorm.includes(aiNorm) || aiNorm.includes(prodNorm)) return 0.9;

  // Token overlap scoring
  const aiTokens = extractTokens(aiTitle);
  if (aiTokens.length === 0) return 0;

  const prodText = `${prodNorm} ${(productPlaces || []).join(" ").toLowerCase()}`;
  let hits = 0;
  for (const token of aiTokens) {
    if (prodText.includes(token)) hits++;
  }
  const tokenScore = hits / aiTokens.length;

  // Bonus for key identity terms (proper nouns, landmarks)
  const identityTerms = aiTokens.filter(t => t.length > 4);
  let identityBonus = 0;
  let missingIdentityPenalty = 0;
  if (identityTerms.length > 0) {
    const identityHits = identityTerms.filter(t => prodText.includes(t)).length;
    const identityMisses = identityTerms.filter(t => !prodText.includes(t));
    identityBonus = (identityHits / identityTerms.length) * 0.15;
    // Penalize heavily when distinctive keywords from search title are missing
    // e.g. "SkyWorlds" missing from a "Genting Highlands + Batu Caves" product
    if (identityMisses.length > 0 && identityHits > 0) {
      // Some identity terms match (same destination) but key differentiators are missing
      const genericTerms = new Set(["trip", "tour", "ticket", "admission", "cable", "private", "group", "guided", "excursion", "transfer", "highlights", "round"]);
      const distinctiveMisses = identityMisses.filter(t => !genericTerms.has(t));
      if (distinctiveMisses.length > 0) {
        missingIdentityPenalty = distinctiveMisses.length * 0.20;
        console.log(`[Match] ⚠️ Missing distinctive keywords [${distinctiveMisses.join(", ")}] from "${productTitle}" — penalty ${missingIdentityPenalty.toFixed(2)}`);
      }
    }
  }

  // Product-family cross-denial: e.g. AI wants "admission ticket" but got "photoshoot"
  let typePenalty = 0;
  const aiType = detectProductType(aiTitle);
  const prodType = detectProductType(productTitle);
  if (aiType && prodType && aiType !== prodType) {
    const conflicts = TYPE_CONFLICT_MATRIX[aiType];
    if (conflicts?.has(prodType)) {
      typePenalty = 0.60; // near-total rejection for cross-family mismatch
      console.log(`[Match] 🚫 Cross-family denial: AI="${aiType}" vs Product="${prodType}" for "${productTitle}" — penalty ${typePenalty}`);
    }
  }
  // Secondary check: even if AI type is null, reject if product is clearly a different service
  if (!aiType && prodType === "photoshoot" && !/photo/i.test(aiTitle)) {
    typePenalty = 0.50;
    console.log(`[Match] 🚫 Photoshoot product for non-photo intent "${aiTitle}" — penalty ${typePenalty}`);
  }
  if (!aiType && prodType === "transfer" && !/transfer|transport|shuttle|pickup/i.test(aiTitle)) {
    typePenalty = 0.50;
    console.log(`[Match] 🚫 Transfer product for non-transfer intent "${aiTitle}" — penalty ${typePenalty}`);
  }
  // Reject dining/meal products for non-dining intents (e.g., "Dinner at Penang Hill" for a guided tour)
  if (/\b(dinner|lunch|breakfast|dining|meal)\b/i.test(productTitle) && !/\b(dinner|lunch|breakfast|dining|meal|food)\b/i.test(aiTitle)) {
    typePenalty = Math.max(typePenalty, 0.50);
    console.log(`[Match] 🚫 Dining product "${productTitle}" for non-dining intent "${aiTitle}" — penalty ${typePenalty}`);
  }

  return Math.max(0, Math.min(1.0, tokenScore * 0.85 + identityBonus - typePenalty - missingIdentityPenalty));
}

// ═══ ACTIVITY MATCHING — Bulk city fetch + local matching ═══

interface MatchResult {
  dayIdx: number;
  actIdx: number;
  product_code: string;
  product_name: string;
  price: number;
  currency: string;
  rating: number;
  review_count: number;
  image_url: string | null;
  highlights: string[];
  places_covered: string[];
  pricingType: string;
  duration_hours: number | null;
  vela_id: string | null;
  score: number;
  matched_option_code: string | null;
  matched_option_title: string | null;
  option_match: boolean;
}

interface SwapAlternative {
  product_code: string;
  name: string;
  price: number;
  currency: string;
  rating: number;
  review_count: number;
  image: string | null;
  highlights: string[];
  pricingType: string;
  duration: string | null;
  score: number;
  city: string;
}

async function matchActivities(
  itinerary: any,
  sb: any,
  targetCurrency: string,
  travelerProfile: TravelerProfile,
): Promise<{
  matches: MatchResult[];
  stats: { matched: number; unmatched: number; skipped: number; safetyRejected: number };
  searchTermsByCity: Record<string, string[]>;
  totalProductsByCity: Record<string, number>;
  swapPools: Record<string, SwapAlternative[]>;
  allSearchedActivities: any[];
}> {
  const matches: MatchResult[] = [];
  const swapPools: Record<string, SwapAlternative[]> = {};
  let matched = 0, unmatched = 0, skipped = 0, safetyRejected = 0;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const tourSearchUrl = `${SUPABASE_URL}/functions/v1/unified-tour-search`;

  // Group activities by city
  const activitiesByCity: Record<string, { dayIdx: number; actIdx: number; activity: any }[]> = {};
  for (let di = 0; di < (itinerary.days || []).length; di++) {
    const day = itinerary.days[di];
    const city = (day.city || "").trim();
    if (!city) continue;
    for (let ai = 0; ai < (day.activities || []).length; ai++) {
      const act = day.activities[ai];
      if (shouldSkipActivity(act)) { skipped++; continue; }
      if (!activitiesByCity[city]) activitiesByCity[city] = [];
      activitiesByCity[city].push({ dayIdx: di, actIdx: ai, activity: act });
    }
  }

  const cityNames = Object.keys(activitiesByCity);

  // Log raw AI activity names and search_titles
  for (const city of cityNames) {
    const titles = activitiesByCity[city].map(({ activity }) => {
      const name = activity.activity || "(no title)";
      const st = activity.search_title;
      return st ? `${name} → search_title: "${st}"` : name;
    });
    console.log(`[Match] 📋 ACTIVITY NAMES for ${city} (${titles.length}):\n${titles.map((t: string, i: number) => `  ${i + 1}. ${t}`).join("\n")}`);
  }

  // ── PHASE 1: Parallel freetext calls — one per activity title ──
  // Each call goes to unified-tour-search freetext action which handles:
  // smartSearch, scoring, option resolution, currency conversion — all internally.
  // We just use the returned products directly.
  const cityProductPools: Record<string, any[]> = {};
  const allProductsCodes = new Set<string>();
  const allProducts: any[] = [];

  // Collect all (title, city) pairs across all cities
  const allSearchPairs: { title: string; city: string; dayIdx: number; actIdx: number }[] = [];
  for (const city of cityNames) {
    for (const { dayIdx, actIdx, activity } of activitiesByCity[city]) {
      // Prefer AI-generated search_title (booking-optimized) over activity name
      const searchTitle = (activity.search_title || "").trim();
      const activityName = (activity.activity || "").trim();
      const title = searchTitle || activityName;
      if (title.length > 3) allSearchPairs.push({ title, city, dayIdx, actIdx });
    }
  }

  // Map freetext response product → internal pool format
  const mapFreetextProduct = (p: any) => ({
    product_code: p.productCode,
    title: p.name,
    destination: p.destination || "",
    price: p.price || 0,
    currency: p.currency || targetCurrency,
    rating: p.rating || 0,
    review_count: p.reviewCount || 0,
    image_url: p.image || (p.images && p.images[0]) || null,
    highlights: p.highlights || [],
    places_covered: p.placesCovered || [],
    vela_id: p.velaId || null,
    _matchedOption: p._matchedOption || null,
    _optionMismatch: p._optionMismatch || false,
    duration_hours: p.duration_hours || null,
    pricingType: p.pricingType || "PER_PERSON",
    // Use _queryRelevance from unified-tour-search (0-100) as pre-computed score
    _queryRelevance: p._queryRelevance || 0,
    _searchScore: p._searchScore || 0,
  });

  // Fire batch multi-freetext call (single HTTP roundtrip, parallel DB queries internally)
  const perTitleResults: Map<string, any[]> = new Map(); // key: "city::title" → products
  const citySeenCodes: Record<string, Set<string>> = {};
  for (const city of cityNames) {
    citySeenCodes[city] = new Set();
    cityProductPools[city] = [];
  }

  // Deduplicate queries
  const uniqueQueries: { searchText: string; city: string; key: string }[] = [];
  const seenKeys = new Set<string>();
  for (const { title, city } of allSearchPairs) {
    const key = `${city}::${title}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueQueries.push({ searchText: title, city, key });
  }

  const phase1Start = performance.now();

  // Use multi-freetext batch action (single HTTP call → parallel DB queries)
  const BATCH_CHUNK = 30; // split into chunks of 30 for multi-freetext
  for (let i = 0; i < uniqueQueries.length; i += BATCH_CHUNK) {
    const chunk = uniqueQueries.slice(i, i + BATCH_CHUNK);
    try {
      const res = await fetch(tourSearchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "apikey": SUPABASE_KEY,
        },
        body: JSON.stringify({
          action: "multi-freetext",
          queries: chunk.map(q => ({ searchText: q.searchText, city: q.city, key: q.key })),
          targetCurrency,
          limit: 15,
        }),
      });

      if (!res.ok) {
        console.warn(`[Match] multi-freetext batch failed: ${res.status}, falling back to individual calls`);
        // Fallback to individual calls
        await Promise.all(chunk.map(async ({ searchText, city, key }) => {
          try {
            const r = await fetch(tourSearchUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_KEY}`, "apikey": SUPABASE_KEY },
              body: JSON.stringify({ action: "freetext", searchText, targetCurrency, limit: 15 }),
            });
            if (!r.ok) { perTitleResults.set(key, []); return; }
            const d = await r.json();
            const products = (d.products || []).map(mapFreetextProduct);
            perTitleResults.set(key, products.filter((p: any) => isDestinationCompatible(p.destination, city)));
          } catch { perTitleResults.set(key, []); }
        }));
        continue;
      }

      const batchData = await res.json();
      const batchResults = batchData.results || {};

      for (const { key, city } of chunk) {
        const r = batchResults[key];
        const products = (r?.products || []).map(mapFreetextProduct);
        const compatible = products.filter((p: any) => isDestinationCompatible(p.destination, city));
        perTitleResults.set(key, compatible);

        // Add to city pool (dedup by product_code)
        for (const p of compatible) {
          if (p.product_code && !citySeenCodes[city].has(p.product_code)) {
            citySeenCodes[city].add(p.product_code);
            cityProductPools[city].push(p);
          }
          if (p.product_code && !allProductsCodes.has(p.product_code)) {
            allProductsCodes.add(p.product_code);
            allProducts.push(p);
          }
        }
      }
      console.log(`[Match] 🔍 multi-freetext batch (${chunk.length} queries): ${batchData.timing_ms || '?'}ms server-side`);
    } catch (e: any) {
      console.warn(`[Match] multi-freetext error: ${e.message}, falling back`);
      for (const { key } of chunk) perTitleResults.set(key, []);
    }
  }

  const phase1Ms = Math.round(performance.now() - phase1Start);
  console.log(`[Match] ⏱️ Phase 1 (freetext search): ${phase1Ms}ms for ${uniqueQueries.length} queries`);

  for (const city of cityNames) {
    console.log(`[Match] 🏙️ ${city}: ${cityProductPools[city].length} total products from ${activitiesByCity[city].length} activities`);
  }

  // Product detail cache not needed — freetext already resolves options
  const productDetailCache: Record<string, any> = {};

   // ── PHASE 2b: Local fuzzy matching — match each AI title against city pool ──
  const usedProducts = new Set<string>();
  // Semantic name dedup: prevent different product_codes for the same attraction
  const usedAttractionNames = new Set<string>();
  // Same-day landmark tracker: dayIdx → Set of normalized place names
  const dayPlacesCovered = new Map<number, Set<string>>();
  const NORM_NAME = (n: string): string =>
    n.toLowerCase()
      .replace(/\b(tour|ticket|admission|entry|guided|private|half|full|day|trip|experience|visit|excursion|with|options|and)\b/g, "")
      .replace(/[^a-z0-9\s]/g, "").replace(/\s{2,}/g, " ").trim();

  // ═══════════════════════════════════════════════════════════════
  // ██  ENTITY-FAMILY DEDUP (IDF-based, replaces GENERIC_WORDS)
  // ═══════════════════════════════════════════════════════════════

  // Build IDF table from the full city product pool
  const allCityProducts: string[] = [];
  for (const [, pool] of perTitleResults) {
    for (const p of pool) {
      allCityProducts.push((p.title || p.name || "").toLowerCase());
    }
  }
  const totalDocs = Math.max(allCityProducts.length, 1);
  const tokenDocCount = new Map<string, number>();
  for (const title of allCityProducts) {
    const uniqueTokens = new Set(title.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 3));
    for (const t of uniqueTokens) {
      tokenDocCount.set(t, (tokenDocCount.get(t) || 0) + 1);
    }
  }
  const tokenIDF = (token: string): number => {
    const df = tokenDocCount.get(token) || 0;
    if (df === 0) return 3.0; // unseen token = high identity
    return Math.log(totalDocs / df);
  };

  // Hard-coded city names that should never be identity tokens
  const CITY_TOKENS = new Set([
    "langkawi", "penang", "singapore", "kuala", "lumpur", "bali", "bangkok", "phuket",
    "dubai", "tokyo", "london", "paris", "istanbul", "rome", "madrid", "lisbon",
    "george", "town", "georgetown", "sentosa", "genting", "highlands", "putrajaya",
    "petaling", "jaya", "shah", "alam", "cyberjaya", "changi", "jurong",
  ]);

  type TokenClass = "identity" | "modifier" | "generic";
  interface TokenClassification { identity: string[]; modifier: string[]; generic: string[] }

  const classifyTokens = (name: string): TokenClassification => {
    const tokens = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 3);
    const result: TokenClassification = { identity: [], modifier: [], generic: [] };
    for (const t of tokens) {
      if (CITY_TOKENS.has(t)) { result.generic.push(t); continue; }
      const idf = tokenIDF(t);
      if (idf < 1.0) result.generic.push(t);
      else if (idf < 2.0) result.modifier.push(t);
      else result.identity.push(t);
    }
    return result;
  };

  const buildGroupKey = (productName: string): string => {
    const { identity } = classifyTokens(productName);
    if (identity.length === 0) return productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    return identity.sort().join("-");
  };

  // Entity family tracker: groupKey → { count, options[] }
  const usedFamilies = new Map<string, { count: number; options: string[] }>();

  const getEntityPenalty = (
    productName: string,
    productOptionName: string | null,
    queryModifiers: string[]
  ): { penalty: number; groupKey: string; reason: string } => {
    const groupKey = buildGroupKey(productName);
    const family = usedFamilies.get(groupKey);

    if (!family) {
      return { penalty: 0, groupKey, reason: "new_entity" };
    }

    // Query-conditioned: if query asked for specific modifiers, check if this product has them
    if (queryModifiers.length > 0) {
      const prodText = (productName + " " + (productOptionName || "")).toLowerCase();
      const hasRequestedMod = queryModifiers.some(m => prodText.includes(m));
      if (hasRequestedMod) {
        // User explicitly asked for this variant — minimal penalty
        return { penalty: family.count >= 3 ? 0.10 : 0.05, groupKey, reason: "query_requested_variant" };
      }
    }

    const optionSig = (productOptionName || productName).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const isNewOption = !family.options.some(existing => {
      const ew = new Set(existing.split(/\s+/));
      const ow = optionSig.split(/\s+/);
      const overlap = ow.filter(w => ew.has(w)).length;
      return overlap / Math.max(ew.size, ow.length) > 0.7;
    });

    if (family.count >= 3) {
      return { penalty: 0.50, groupKey, reason: `family_saturated(${family.count})` };
    }

    if (isNewOption) {
      return { penalty: 0.15, groupKey, reason: "variant_duplicate" };
    }

    return { penalty: 0.40, groupKey, reason: "near_duplicate" };
  };

  const registerEntityFamily = (productName: string, productOptionName: string | null) => {
    const groupKey = buildGroupKey(productName);
    const optionSig = (productOptionName || productName).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const family = usedFamilies.get(groupKey);
    if (family) {
      family.count++;
      family.options.push(optionSig);
    } else {
      usedFamilies.set(groupKey, { count: 1, options: [optionSig] });
    }
  };

  // Legacy name dedup kept as secondary safety net (soft penalty, not hard reject)
  const isNameOverlap = (productName: string): boolean => {
    const norm = NORM_NAME(productName);
    if (!norm || norm.length < 4) return false;
    const nw = norm.split(/\s+/).filter(w => w.length > 2);
    for (const used of usedAttractionNames) {
      if (norm === used) return true;
      const uw = used.split(/\s+/).filter(w => w.length > 2);
      if (nw.length < 3 || uw.length < 2) continue;
      const overlap = nw.filter(w => uw.some(u => u === w)).length;
      const maxLen = Math.max(nw.length, uw.length);
      if (overlap / maxLen >= 0.8) return true;
      if (uw.length <= 4 && uw.length >= 2 && overlap === uw.length) return true;
    }
    return false;
  };

  for (const city of cityNames) {
    for (const { dayIdx, actIdx, activity } of activitiesByCity[city]) {
      // Use same title resolution as Phase 1 (search_title preferred)
      const searchTitle = (activity.search_title || "").trim();
      const activityName = (activity.activity || "").trim();
      const title = searchTitle || activityName;
      if (!title || title.length < 3) { unmatched++; continue; }

      const optionKeywords = extractOptionKeywords(activity);
      const needsOption = optionKeywords.length > 0;

      // Per-title-exclusive matching: only pick from this activity's own search results
      // Never fall back to the shared city pool — prevents cross-matching
      const titleKey = `${city}::${title}`;
      const titlePool = perTitleResults.get(titleKey) || [];
      if (titlePool.length === 0) {
        console.log(`[Match] ❌ No per-title pool for "${title}" in ${city} — skipping (no city pool fallback)`);
        unmatched++;
        continue;
      }

      // Products are already scored by unified-tour-search (_queryRelevance 0-100, _searchScore)
      // Convert to 0-1 scale for _matchScore, apply option boost/penalty
      const availablePool = titlePool.filter(p => !usedProducts.has(p.product_code));
      const scoredAll = availablePool
        .map(p => {
          const baseScore = (p._queryRelevance || 0) / 100; // 0-1 scale
          const optionBoost = (needsOption && (p._matchedOption?.code || p._matchedOption?.optionCode)) ? 0.30 : 0;
          const optionPenalty = (needsOption && p._optionMismatch) ? 0.30 : 0;
          return { ...p, _matchScore: Math.min(1.0, baseScore + optionBoost - optionPenalty) };
        })
        .sort((a, b) => {
          if (needsOption) {
            const aHasOpt = a._matchedOption?.code ? 1 : 0;
            const bHasOpt = b._matchedOption?.code ? 1 : 0;
            if (aHasOpt !== bHasOpt) return bHasOpt - aHasOpt;
          }
          if (Math.abs(b._matchScore - a._matchScore) > 0.05) return b._matchScore - a._matchScore;
          if (Math.abs((b.rating || 0) - (a.rating || 0)) > 0.3) return (b.rating || 0) - (a.rating || 0);
          return (b.review_count || 0) - (a.review_count || 0);
        });

      // Strict threshold (0.45), then soft fallback (0.25) for products that are clearly related
      let scored = scoredAll.filter(p => p._matchScore >= 0.45);
      if (scored.length === 0 && scoredAll.length > 0) {
        // Soft fallback: accept best candidate if score >= 0.25 (search already validated relevance)
        const best = scoredAll[0];
        if (best._matchScore >= 0.25) {
          console.log(`[Match] 🔄 Soft-match fallback for "${title}" in ${city} — best: "${best.title}" (score: ${best._matchScore.toFixed(2)})`);
          scored = [best];
        }
      }

      if (scored.length === 0) {
        const debugScores = scoredAll.slice(0, 3).map(p => `"${p.title}" (${p._matchScore.toFixed(2)})`).join(", ");
        console.log(`[Match] ❌ No match for "${title}" in ${city} (pool: ${titlePool.length}, available: ${availablePool.length}, top: ${debugScores || "none"})`);
        unmatched++;
        continue;
      }

      let selectedProduct: any = null;
      let matchedOptionCode: string | null = null;
      let matchedOptionTitle: string | null = null;
      let optionMatch = false;
      let finalPrice = 0;
      let finalCurrency = "USD";
      let pricingType = "PER_PERSON";
      let durationHours: number | null = null;

      if (needsOption) {
        // Check if unified-tour-search already resolved the option
        // freetext returns _matchedOption with optionCode/optionName/optionPrice keys
        // IMPORTANT: Verify the matched option actually contains the requested keywords
        for (const candidate of scored.slice(0, 5)) {
          const opt = candidate._matchedOption;
          const optCode = opt?.code || opt?.optionCode;
          if (!optCode) continue;
          const optName = (opt.title || opt.optionName || "").toLowerCase();
          // Verify at least one requested option keyword appears in the option name
          const keywordMatch = optionKeywords.some(kw => optName.includes(kw));
          if (!keywordMatch) {
            console.log(`[Match] ⚠️ Option "${optName}" doesn't match keywords [${optionKeywords.join(",")}] — skipping`);
            continue;
          }
          selectedProduct = candidate;
          matchedOptionCode = optCode;
          matchedOptionTitle = opt.title || opt.optionName || "";
          finalPrice = opt.price || opt.optionPrice || candidate.price || 0;
          finalCurrency = targetCurrency;
          optionMatch = true;
          durationHours = candidate.duration_hours || null;
          pricingType = candidate.pricingType || "PER_PERSON";
          console.log(`[Match] 🎫 Option matched: "${title}" → "${selectedProduct.title}" option "${matchedOptionTitle}" @ ${finalPrice} ${targetCurrency}`);
          break;
        }
        if (!selectedProduct) {
          console.log(`[Match] ⚠️ Option [${optionKeywords.join(",")}] not found — using best match for "${title}"`);
        }
      }

      // If no option match needed or option search failed, use top scored result
      // Price is already in targetCurrency from unified-tour-search
      if (!selectedProduct) {
        selectedProduct = scored[0];
        finalPrice = selectedProduct.price || 0;
        finalCurrency = targetCurrency; // Already converted by unified-tour-search
      }

      // ── Entity-family dedup + places-covered overlap ──
      const selectedName = selectedProduct.title || selectedProduct.name || "";

      // Extract query modifiers from the search title for query-conditioned dedup
      const queryClassification = classifyTokens(title);
      const queryModifiers = queryClassification.modifier;

      // ── Places-covered overlap check: prevent tours that revisit already-covered landmarks ──
      const checkPlacesOverlap = (product: any): { overlapping: string[]; ratio: number; sameDayOverlap: number } => {
        const places: string[] = product.places_covered || [];
        if (places.length === 0) return { overlapping: [], ratio: 0, sameDayOverlap: 0 };
        const normPlaces = places.map(NORM_NAME).filter((p: string) => p && p.length >= 4);
        const overlapping = normPlaces.filter((np: string) => {
          for (const used of usedAttractionNames) {
            if (np === used) return true;
            const npW = np.split(/\s+/).filter((w: string) => w.length > 2);
            const usedW = used.split(/\s+/).filter((w: string) => w.length > 2);
            if (npW.length >= 2 && usedW.length >= 2) {
              const overlap = npW.filter((w: string) => usedW.some((u: string) => u === w)).length;
              if (overlap === Math.min(npW.length, usedW.length) && overlap >= 2) return true;
            }
          }
          return false;
        });
        // Same-day overlap: check against places already matched on this specific day
        const dayPlaces = dayPlacesCovered.get(dayIdx);
        let sameDayOverlap = 0;
        if (dayPlaces && dayPlaces.size > 0) {
          for (const np of normPlaces) {
            if (dayPlaces.has(np)) { sameDayOverlap++; continue; }
            // Fuzzy same-day check
            const npW = np.split(/\s+/).filter((w: string) => w.length > 2);
            for (const dp of dayPlaces) {
              const dpW = dp.split(/\s+/).filter((w: string) => w.length > 2);
              if (npW.length >= 1 && dpW.length >= 1) {
                const ol = npW.filter((w: string) => dpW.some((d: string) => d === w || d.includes(w) || w.includes(d))).length;
                if (ol >= 1 && ol >= Math.min(npW.length, dpW.length)) { sameDayOverlap++; break; }
              }
            }
          }
        }
        return { overlapping, ratio: normPlaces.length > 0 ? overlapping.length / normPlaces.length : 0, sameDayOverlap };
      };

      // ── Same-day product name overlap check ──
      const checkSameDayNameOverlap = (productName: string): boolean => {
        const dayPlaces = dayPlacesCovered.get(dayIdx);
        if (!dayPlaces || dayPlaces.size === 0) return false;
        const normProd = NORM_NAME(productName);
        if (!normProd || normProd.length < 4) return false;
        const prodTokens = normProd.split(/\s+/).filter(w => w.length > 2);
        // Check if product name shares significant tokens with day's covered places
        let matchCount = 0;
        for (const dp of dayPlaces) {
          const dpW = dp.split(/\s+/).filter(w => w.length > 2);
          for (const pt of prodTokens) {
            if (dpW.some(d => d === pt || d.includes(pt) || pt.includes(d))) { matchCount++; break; }
          }
        }
        return matchCount >= 2 || (prodTokens.length >= 2 && matchCount >= Math.ceil(prodTokens.length * 0.5));
      };

      // Entity-family soft dedup
      const entityResult = getEntityPenalty(selectedName, matchedOptionTitle, queryModifiers);
      const nameOverlap = isNameOverlap(selectedName);
      const placesCheck = checkPlacesOverlap(selectedProduct);
      const hasHighPlacesOverlap = placesCheck.ratio >= 0.5 && placesCheck.overlapping.length >= 2;
      const hasSameDayOverlap = placesCheck.sameDayOverlap >= 2;
      const hasSameDayNameOverlap = checkSameDayNameOverlap(selectedName);

      // ── Cross-day title-level landmark overlap ──
      // Catches combo products whose TITLE contains a landmark already visited
      // (e.g. "Genting Day Trip with Batu Caves" when Batu Caves was on Day 9)
      let crossDayTitleOverlap = false;
      {
        const candidateNorm = NORM_NAME(selectedName);
        const candidateTokens = candidateNorm.split(/\s+/).filter((w: string) => w.length > 3);
        // Build bigrams from candidate title for landmark matching
        const candidateBigrams: string[] = [];
        for (let bi = 0; bi < candidateTokens.length - 1; bi++) {
          candidateBigrams.push(`${candidateTokens[bi]} ${candidateTokens[bi + 1]}`);
        }
        for (const usedName of usedAttractionNames) {
          const usedTokens = usedName.split(/\s+/).filter((w: string) => w.length > 3);
          // Check if any bigram from the used name appears in the candidate title
          for (let bi = 0; bi < usedTokens.length - 1; bi++) {
            const bigram = `${usedTokens[bi]} ${usedTokens[bi + 1]}`;
            if (candidateBigrams.includes(bigram) || candidateNorm.includes(bigram)) {
              crossDayTitleOverlap = true;
              console.log(`[Match] 🔄 Cross-day title overlap: "${selectedName}" contains landmark "${bigram}" already visited`);
              break;
            }
          }
          if (crossDayTitleOverlap) break;
        }
      }

      // Compute combined dedup penalty — same-day overlaps are penalized much harder
      let dedupPenalty = entityResult.penalty;
      if (nameOverlap) dedupPenalty = Math.max(dedupPenalty, 0.35);
      if (hasHighPlacesOverlap) dedupPenalty = Math.max(dedupPenalty, 0.30);
      if (crossDayTitleOverlap) dedupPenalty = Math.max(dedupPenalty, 0.35);
      // Same-day duplicate: near-certain rejection
      if (hasSameDayOverlap) {
        dedupPenalty = Math.max(dedupPenalty, 0.55);
        console.log(`[Match] 🔄 Same-day places overlap: "${selectedName}" shares ${placesCheck.sameDayOverlap} landmarks with Day ${dayIdx + 1} — heavy penalty`);
      }
      if (hasSameDayNameOverlap) {
        dedupPenalty = Math.max(dedupPenalty, 0.50);
        console.log(`[Match] 🔄 Same-day name overlap: "${selectedName}" overlaps with Day ${dayIdx + 1} attractions — heavy penalty`);
      }

      const adjustedScore = (selectedProduct._matchScore || 0.5) - dedupPenalty;

      if (adjustedScore < 0.45) {
        console.log(`[Match] 🔄 Dedup penalty too high for "${selectedName}" (${entityResult.reason}, penalty=${dedupPenalty.toFixed(2)}, adjusted=${adjustedScore.toFixed(2)}) — trying alternatives`);
        let fallbackFound = false;
        for (const alt of scored) {
          if (alt.product_code === selectedProduct.product_code) continue;
          if (usedProducts.has(alt.product_code)) continue;
          const altName = alt.title || alt.name || "";
          const altEntity = getEntityPenalty(altName, null, queryModifiers);
          const altNameOvlp = isNameOverlap(altName);
          const altPlaces = checkPlacesOverlap(alt);
          const altPlacesHigh = altPlaces.ratio >= 0.5 && altPlaces.overlapping.length >= 2;
          let altPenalty = altEntity.penalty;
          if (altNameOvlp) altPenalty = Math.max(altPenalty, 0.35);
          if (altPlacesHigh) altPenalty = Math.max(altPenalty, 0.30);
          if (altPlaces.sameDayOverlap >= 2) altPenalty = Math.max(altPenalty, 0.55);
          if (checkSameDayNameOverlap(altName)) altPenalty = Math.max(altPenalty, 0.50);
          const altAdjusted = (alt._matchScore || 0) - altPenalty;
          if (altAdjusted < 0.45) {
            console.log(`[Match] ⚠️ Alt "${altName}" adjusted score ${altAdjusted.toFixed(2)} < 0.45 — skipping`);
            continue;
          }
          selectedProduct = alt;
          finalPrice = alt.price || 0;
          finalCurrency = targetCurrency;
          matchedOptionCode = null;
          matchedOptionTitle = null;
          optionMatch = false;
          console.log(`[Match] ✅ Fallback: "${title}" → "${altName}" (adjusted: ${altAdjusted.toFixed(2)}, entity: ${altEntity.reason})`);
          fallbackFound = true;
          break;
        }
        if (!fallbackFound) {
          console.log(`[Match] 🚫 No quality non-overlapping candidate for "${title}" — leaving as ai_estimate`);
          unmatched++;
          continue;
        }
      } else if (dedupPenalty > 0) {
        console.log(`[Match] ⚡ Soft dedup: "${selectedName}" penalty=${dedupPenalty.toFixed(2)} (${entityResult.reason}), adjusted=${adjustedScore.toFixed(2)} — accepted`);
      }

      usedProducts.add(selectedProduct.product_code);
      usedAttractionNames.add(NORM_NAME(selectedProduct.title || selectedProduct.name || ""));
      registerEntityFamily(selectedProduct.title || selectedProduct.name || "", matchedOptionTitle);
      // Register places_covered so activities in day trips don't get matched separately
      const coveredPlaces: string[] = selectedProduct.places_covered || [];
      // Also register into same-day tracker
      if (!dayPlacesCovered.has(dayIdx)) dayPlacesCovered.set(dayIdx, new Set());
      const dayPlacesSet = dayPlacesCovered.get(dayIdx)!;
      // Register product name tokens as day landmarks
      const prodNorm = NORM_NAME(selectedProduct.title || selectedProduct.name || "");
      if (prodNorm) {
        for (const tok of prodNorm.split(/\s+/).filter((w: string) => w.length > 2)) {
          dayPlacesSet.add(tok);
        }
      }
      for (const place of coveredPlaces) {
        const normPlace = NORM_NAME(place);
        if (normPlace && normPlace.length >= 4) {
          usedAttractionNames.add(normPlace);
          dayPlacesSet.add(normPlace);
          console.log(`[Match] 📍 Registered covered place: "${place}" → "${normPlace}"`);
        }
      }
      const convertedPrice = finalPrice; // Already in targetCurrency from unified-tour-search

      console.log(`[Match] ✅ "${title}" → "${selectedProduct.title}" (score: ${selectedProduct._matchScore?.toFixed(2)}, price: ${convertedPrice} ${targetCurrency}${optionMatch ? `, option: ${matchedOptionTitle}` : ""})`);

      matches.push({
        dayIdx, actIdx,
        product_code: selectedProduct.product_code,
        product_name: selectedProduct.title,
        price: convertedPrice,
        currency: targetCurrency,
        rating: selectedProduct.rating || 0,
        review_count: selectedProduct.review_count || 0,
        image_url: selectedProduct.image_url,
        highlights: selectedProduct.highlights || [],
        places_covered: selectedProduct.places_covered || [],
        pricingType,
        duration_hours: durationHours,
        vela_id: selectedProduct.vela_id,
        score: selectedProduct._matchScore || 0.5,
        matched_option_code: matchedOptionCode,
        matched_option_title: matchedOptionTitle,
        option_match: optionMatch,
      });
      matched++;

      // Swap alternatives: remaining top candidates
      const swapKey = `${dayIdx}_${actIdx}`;
      const alternatives: SwapAlternative[] = [];
      for (let i = 0; i < scored.length && alternatives.length < 5; i++) {
        const alt = scored[i];
        if (alt.product_code === selectedProduct.product_code) continue;
        alternatives.push({
          product_code: alt.product_code,
          name: alt.title,
          price: alt.price || 0, // Already in targetCurrency from unified-tour-search
          currency: targetCurrency,
          rating: alt.rating || 0,
          review_count: alt.review_count || 0,
          image: alt.image_url || null,
          highlights: (alt.highlights || []).slice(0, 3),
          pricingType: "PER_PERSON",
          duration: null,
          score: alt._matchScore || 0.5,
          city,
        });
      }
      if (alternatives.length > 0) {
        swapPools[swapKey] = alternatives;
      }
    }
  }

  // Search terms per city
  const searchTermsByCity: Record<string, string[]> = {};
  for (const city of cityNames) {
    searchTermsByCity[city] = [...new Set(
      activitiesByCity[city]
        .map(({ activity }) => (activity.activity || "").trim())
        .filter(t => t.length > 3)
    )];
  }

  // Total product counts per city
  const totalProductsByCity: Record<string, number> = {};
  for (const city of cityNames) {
    totalProductsByCity[city] = (cityProductPools[city] || []).length;
  }

  // All searched activities for frontend browsing
  const allSearchedActivities: any[] = allProducts.map(p => ({
    name: p.title,
    price: p.price || 0, // Already in targetCurrency from unified-tour-search
    currency: targetCurrency,
    duration: null,
    rating: p.rating || 0,
    reviewCount: p.review_count || 0,
    category: "Tour",
    productCode: p.product_code,
    image: p.image_url || "",
    city: p.destination || "",
    _searchCity: p.destination || "",
    highlights: (p.highlights || []).slice(0, 3),
    pricingType: "PER_PERSON",
    shortDescription: "",
  }));

  console.log(`[Match] 📦 ${allSearchedActivities.length} searched activities, ${Object.keys(swapPools).length} swap pools`);

  return { matches, stats: { matched, unmatched, skipped, safetyRejected }, searchTermsByCity, totalProductsByCity, swapPools, allSearchedActivities, _timing: { phase1_freetext_ms: phase1Ms } };
}

// ═══ HOTEL MATCHING via unified-hotel-search ═══

interface HotelMatch {
  city: string;
  name: string;
  stars: number;
  price_per_night: number;
  total_price: number;
  nights: number;
  total_nights?: number;
  self_managed_nights?: number;
  currency: string;
  is_live_price: boolean;
  source: string;
  hotel_id?: string;
  hotel_area?: string;
  image?: string;
  rating?: number;
  amenities?: string[];
  ai_suggestion?: string;
  match_method?: string;
  latitude?: number;
  longitude?: number;
}

function findBestHotelMatch(aiName: string, hotels: any[]): { hotel: any; method: string } | null {
  if (!aiName || !hotels.length) return null;
  const aiNorm = aiName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const aiTokens = aiNorm.split(/\s+/).filter(w => w.length > 1);

  for (const h of hotels) {
    const hNorm = (h.name || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    if (hNorm.includes(aiNorm) || aiNorm.includes(hNorm)) {
      return { hotel: h, method: "exact_substring" };
    }
  }

  let bestScore = 0;
  let bestHotel: any = null;
  for (const h of hotels) {
    const hNorm = (h.name || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const hTokens = hNorm.split(/\s+/).filter(w => w.length > 1);
    if (!hTokens.length) continue;
    const overlap = aiTokens.filter(t => hTokens.some(ht => ht.includes(t) || t.includes(ht))).length;
    const score = overlap / Math.max(aiTokens.length, hTokens.length);
    if (score > bestScore && score >= 0.4 && overlap >= 2) {
      bestScore = score;
      bestHotel = h;
    }
  }
  if (bestHotel) return { hotel: bestHotel, method: `token_overlap_${Math.round(bestScore * 100)}` };
  return null;
}

interface HotelSwapAlternative {
  hotel_id: string;
  name: string;
  stars: number;
  price_per_night: number;
  total_price: number;
  nights: number;
  currency: string;
  rating: number;
  image: string;
  amenities: string[];
  source: string;
  is_live_price: boolean;
  city: string;
}

async function matchHotels(
  itinerary: any,
  sb: any,
  searchParams: any,
  targetCurrency: string,
): Promise<{ selected: HotelMatch[]; hotelSwapPools: Record<string, HotelSwapAlternative[]>; allSearchedHotels: any[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const hotels: HotelMatch[] = [];
  const hotelSwapPools: Record<string, HotelSwapAlternative[]> = {};
  const allSearchedHotels: any[] = [];
  const cities = itinerary.cities || [];
  const selectedHotels = itinerary.selected_hotels || [];

  const firstDay = itinerary.days?.[0];
  const globalCheckin = firstDay?.date || searchParams?.depart_date || "";
  const stars = searchParams?.hotel_stars || 4;
  const adults = itinerary.adults || 1;
  const children = itinerary.children || 0;
  const rooms = Math.ceil((adults + children) / 3) || 1;

  // Build a per-city date map from AI-generated day dates (most reliable source)
  const cityFirstDayDate: Record<string, string> = {};
  const cityLastDayDate: Record<string, string> = {};
  for (const day of itinerary.days || []) {
    const c = (day.city || "").trim();
    if (!c || !day.date) continue;
    if (!cityFirstDayDate[c]) cityFirstDayDate[c] = day.date;
    cityLastDayDate[c] = day.date;
  }

  const citySearches = cities.map(async (city: any, idx: number) => {
    const cityName = city.name || "";
    const nights = Number(city.nights || (city.days ? Math.max(city.days - 1, 1) : 2));
    const selfManagedNights = Number(selectedHotels[idx]?.self_managed_nights || city.self_managed_nights || 0);
    const totalNights = Number(selectedHotels[idx]?.total_nights || city.total_nights || nights);
    const aiSuggestion = city.preferred_hotel || selectedHotels[idx]?.ai_suggestion || selectedHotels[idx]?.name || "";
    const hotelArea = city.hotel_area || selectedHotels[idx]?.hotel_area || "";
    const hotelType = city.hotel_type || selectedHotels[idx]?.hotel_type || "";

    // Priority: AI day dates → computed from globalCheckin → today fallback
    let cityCheckin = cityFirstDayDate[cityName] || "";
    if (!cityCheckin && globalCheckin) {
      // Compute from global start + sum of previous city nights
      const base = new Date(globalCheckin);
      let dayOffset = 0;
      for (let ci = 0; ci < idx; ci++) {
        dayOffset += (cities[ci].nights || cities[ci].days || 2);
      }
      base.setDate(base.getDate() + dayOffset);
      cityCheckin = base.toISOString().split("T")[0];
    }
    if (!cityCheckin) {
      // Last resort: use today + offset
      const fallback = new Date();
      let dayOffset = 0;
      for (let ci = 0; ci < idx; ci++) {
        dayOffset += (cities[ci].nights || cities[ci].days || 2);
      }
      fallback.setDate(fallback.getDate() + dayOffset + 14); // 2 weeks out default
      cityCheckin = fallback.toISOString().split("T")[0];
      console.warn(`[Match] ⚠️ No date found for ${cityName}, using fallback: ${cityCheckin}`);
    }

    let cityCheckout = "";
    if (cityLastDayDate[cityName]) {
      // Use the day AFTER the last AI day in this city
      const co = new Date(cityLastDayDate[cityName]);
      co.setDate(co.getDate() + 1);
      cityCheckout = co.toISOString().split("T")[0];
    } else {
      const co = new Date(cityCheckin);
      co.setDate(co.getDate() + nights);
      cityCheckout = co.toISOString().split("T")[0];
    }

    console.log(`[Match] 🏨 Hotel search: ${cityName} → checkin=${cityCheckin} checkout=${cityCheckout} (${nights}n)`);

    try {
      // Step 1: Use full search (returns live-priced results directly)
      const searchBody: any = {
        cityName,
        checkinDate: cityCheckin,
        checkoutDate: cityCheckout,
        adults,
        children,
        rooms,
        currency: targetCurrency,
      };
      // Add hotel name for targeted search, or area for filtered search
      if (aiSuggestion && aiSuggestion !== `Hotel in ${cityName}`) {
        searchBody.hotelName = aiSuggestion;
      } else if (hotelArea) {
        // Search with area context (e.g., "KLCC" or "Batu Ferringhi")
        searchBody.hotelName = hotelArea;
      }

      const searchResp = await fetch(`${supabaseUrl}/functions/v1/unified-hotel-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(searchBody),
      });

      if (!searchResp.ok) {
        console.warn(`[Match] Hotel search failed for ${cityName}: ${searchResp.status}`);
        const fb = await fallbackHotelMatch(cityName, nights, stars, targetCurrency, sb, aiSuggestion);
        return { selected: fb, searchHotels: [], cityName, nights };
      }

      const searchData = await searchResp.json();
      const searchHotels = searchData.hotels || [];
      const returnedCurrency = searchData.displayCurrency || targetCurrency;

      if (searchHotels.length === 0) {
        const fb = await fallbackHotelMatch(cityName, nights, stars, targetCurrency, sb, aiSuggestion);
        return { selected: fb, searchHotels: [], cityName, nights };
      }

      console.log(`[Match] 🏨 ${cityName}: ${searchHotels.length} hotels (currency: ${returnedCurrency}), AI: "${aiSuggestion}"`);

      let selectedHotel: any = null;
      let matchMethod = "best_available";

      if (aiSuggestion && aiSuggestion !== `Hotel in ${cityName}`) {
        const match = findBestHotelMatch(aiSuggestion, searchHotels);
        if (match) {
          selectedHotel = match.hotel;
          matchMethod = `ai_match_${match.method}`;
        }
      }

      if (!selectedHotel) {
        // ── Smart hotel scoring based on travel context ──
        const travelStyle = (searchParams?.travel_style || "comfortable").toLowerCase();
        const travelType = (searchParams?.travel_type || "").toLowerCase();
        const selPriority = (searchParams?.selection_priority || "best_value").toLowerCase();

        // Determine ideal star range and minimum rating based on context
        const isLuxury = travelStyle === "luxury" || selPriority === "luxury";
        const isBudget = travelStyle === "budget" || selPriority === "cheapest";
        const isHoneymoon = travelType === "honeymoon" || travelType === "couple";
        const isFamily = travelType === "family";

        const idealStars = isLuxury ? 5 : isBudget ? 3 : 4;
        const minRating = isLuxury ? 7.5 : isBudget ? 6.5 : 7.0; // Don't pick bad hotels even on budget

        // Romantic/family keyword sets for name/amenity matching
        const romanticKeywords = /romantic|honeymoon|boutique|adults[\s-]*only|couple|spa|intimate|private\s*pool|overwater|beachfront/i;
        const familyKeywords = /family|kids|children|playground|pool|waterpark|suite|apartment|connecting/i;

        let candidates = searchHotels.filter((h: any) => {
          const r = h.rating || 0;
          // Filter out poorly rated hotels — never suggest below minRating unless no choice
          return r === 0 || r >= minRating;
        });
        if (candidates.length < 3) candidates = searchHotels; // Fallback if too few pass

        const areaLower = hotelArea.toLowerCase();
        const typeLower = hotelType.toLowerCase();

        candidates.sort((a: any, b: any) => {
          let aScore = 0, bScore = 0;

          const aName = ((a.name || "") + " " + (a.address || "") + " " + (a.propertyType || "")).toLowerCase();
          const bName = ((b.name || "") + " " + (b.address || "") + " " + (b.propertyType || "")).toLowerCase();
          const aAmenStr = (a.amenities || []).join(" ").toLowerCase();
          const bAmenStr = (b.amenities || []).join(" ").toLowerCase();

          // ── Area match (highest priority) ──
          if (areaLower) {
            if (aName.includes(areaLower)) aScore += 60;
            if (bName.includes(areaLower)) bScore += 60;
          }

          // ── Type match ──
          if (typeLower) {
            if (aName.includes(typeLower)) aScore += 35;
            if (bName.includes(typeLower)) bScore += 35;
          }

          // ── Travel type affinity ──
          if (isHoneymoon) {
            if (romanticKeywords.test(aName + " " + aAmenStr)) aScore += 25;
            if (romanticKeywords.test(bName + " " + bAmenStr)) bScore += 25;
            // Penalize generic/chain-sounding names for honeymoon
            if (/budget|hostel|dormitor/i.test(aName)) aScore -= 30;
            if (/budget|hostel|dormitor/i.test(bName)) bScore -= 30;
          }
          if (isFamily) {
            if (familyKeywords.test(aName + " " + aAmenStr)) aScore += 25;
            if (familyKeywords.test(bName + " " + bAmenStr)) bScore += 25;
            // Penalize adults-only
            if (/adults[\s-]*only/i.test(aName + " " + aAmenStr)) aScore -= 40;
            if (/adults[\s-]*only/i.test(bName + " " + bAmenStr)) bScore -= 40;
          }

          // ── Stars scoring (context-aware) ──
          const aStars = a.stars || 0;
          const bStars = b.stars || 0;
          aScore -= Math.abs(aStars - idealStars) * (isLuxury ? 15 : 8);
          bScore -= Math.abs(bStars - idealStars) * (isLuxury ? 15 : 8);

          // ── Rating scoring (always important — higher weight for luxury/honeymoon) ──
          const ratingWeight = isLuxury || isHoneymoon ? 6 : isBudget ? 4 : 5;
          aScore += (a.rating || 0) * ratingWeight;
          bScore += (b.rating || 0) * ratingWeight;

          // ── Price scoring (context-aware) ──
          const aPrice = a.price || 0;
          const bPrice = b.price || 0;
          // Always require a price
          if (aPrice > 0) aScore += 15;
          if (bPrice > 0) bScore += 15;

          if (isBudget && aPrice > 0 && bPrice > 0) {
            // Budget: prefer cheaper, but not at the cost of terrible quality
            // Normalize price difference as a score (cheaper = higher score)
            const maxP = Math.max(aPrice, bPrice, 1);
            aScore += Math.round((1 - aPrice / maxP) * 25);
            bScore += Math.round((1 - bPrice / maxP) * 25);
          } else if (isLuxury) {
            // Luxury: price matters less, quality matters more — slight preference for higher-end
            if (aPrice > bPrice && aStars >= 5) aScore += 5;
            if (bPrice > aPrice && bStars >= 5) bScore += 5;
          }
          // best_value: balanced — rating and stars already handle quality, price as tiebreaker

          if (bScore !== aScore) return bScore - aScore;
          // Final tie-break: cheaper
          return (aPrice || 999999) - (bPrice || 999999);
        });

        selectedHotel = candidates[0];
        matchMethod = hotelArea ? "area_best_match" : (aiSuggestion ? "fallback_best_match" : "smart_best");
        console.log(`[Match] 🏨 ${cityName}: smart-picked "${selectedHotel.name}" (${selectedHotel.stars}★, rating ${selectedHotel.rating || "?"}) | style=${travelStyle} type=${travelType}${hotelArea ? ` area=${hotelArea}` : ""}${hotelType ? ` type=${hotelType}` : ""}`);
      }

      // Prices already converted by unified-hotel-search — use directly
      const pricePerNight = selectedHotel.price || selectedHotel.pricePerNight || 0;

      const result: HotelMatch = {
        city: cityName,
        name: selectedHotel.name || `Hotel in ${cityName}`,
        stars: selectedHotel.stars || stars,
        price_per_night: pricePerNight,
        total_price: pricePerNight * nights,
        nights,
        total_nights: totalNights,
        self_managed_nights: selfManagedNights,
        currency: returnedCurrency,
        is_live_price: (pricePerNight > 0 && !selectedHotel.isPreview),
        source: pricePerNight > 0 ? "unified_hotel_search" : "hotel_catalogue",
        hotel_id: selectedHotel.id || "",
        hotel_area: hotelArea || selectedHotel.city || cityName,
        image: selectedHotel.image || "",
        rating: selectedHotel.rating || 0,
        amenities: selectedHotel.amenities || [],
        ai_suggestion: aiSuggestion || undefined,
        match_method: matchMethod,
        latitude: selectedHotel.latitude || selectedHotel.lat || undefined,
        longitude: selectedHotel.longitude || selectedHotel.lng || undefined,
      };

      return { selected: result, searchHotels, cityName, nights };
    } catch (e: any) {
      console.warn(`[Match] Hotel error for ${cityName}: ${e.message}`);
      const fb = await fallbackHotelMatch(cityName, nights, stars, targetCurrency, sb, aiSuggestion);
      return { selected: fb, searchHotels: [], cityName, nights };
    }
  });

  const results = await Promise.all(citySearches);

  // Full search already returns live-priced results — no smart-price needed

  for (const r of results) {
    if (r?.selected) hotels.push(r.selected);

    // Build swap pools and allSearchedHotels per city
    const cityName = r?.cityName || "";
    const nightsForCity = r?.nights || 2;
    const rawHotels = r?.searchHotels || [];
    const selectedId = r?.selected?.hotel_id || "";

    if (rawHotels.length > 0) {
      const swaps: HotelSwapAlternative[] = [];
      for (const h of rawHotels) {
        const hId = h.id || h.hotelId || "";
        const isSelected = hId === selectedId;
        // Prices already converted by unified-hotel-search — use directly
        const hPrice = h.price || h.pricePerNight || 0;
        const alt: HotelSwapAlternative = {
          hotel_id: hId,
          name: h.name || "",
          stars: h.stars || 0,
          price_per_night: hPrice,
          total_price: hPrice * nightsForCity,
          nights: nightsForCity,
          currency: targetCurrency,
          rating: h.rating || 0,
          image: h.image || "",
          amenities: (h.amenities || []).slice(0, 5),
          source: hPrice > 0 ? "unified_hotel_search" : "hotel_catalogue",
          is_live_price: hPrice > 0 && !h.isPreview,
          city: cityName,
        };
        // Only add non-selected hotels to swap pool
        if (!isSelected) swaps.push(alt);

        // Add ALL hotels (including selected) to allSearchedHotels
        allSearchedHotels.push({
          hotel_id: hId,
          name: h.name || "",
          city: cityName,
          stars: h.stars || 0,
          price_per_night: hPrice,
          total_price: hPrice * nightsForCity,
          nights: nightsForCity,
          currency: targetCurrency,
          rating: h.rating || 0,
          image: h.image || "",
          amenities: (h.amenities || []).slice(0, 5),
          source: hPrice > 0 ? "unified_hotel_search" : "hotel_catalogue",
          is_live_price: hPrice > 0 && !h.isPreview,
        });
      }

      // Sort swaps: priced first, then by rating desc
      swaps.sort((a, b) => {
        const aHasPrice = a.price_per_night > 0 ? 0 : 1;
        const bHasPrice = b.price_per_night > 0 ? 0 : 1;
        if (aHasPrice !== bHasPrice) return aHasPrice - bHasPrice;
        return (b.rating || 0) - (a.rating || 0);
      });

      hotelSwapPools[cityName] = swaps.slice(0, 20); // top 20 alternatives per city
    }
  }

  console.log(`[Match] 🏨 ${hotels.length} hotels selected, ${Object.keys(hotelSwapPools).length} swap pools, ${allSearchedHotels.length} total searched`);
  return { selected: hotels, hotelSwapPools, allSearchedHotels };
}

async function fallbackHotelMatch(
  cityName: string, nights: number, stars: number,
  targetCurrency: string, _sb: any, aiSuggestion?: string,
): Promise<HotelMatch> {
  // Fallback: call unified-hotel-search with just the city (no hotel name) to get any available hotel
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/unified-hotel-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: anonKey },
      body: JSON.stringify({
        action: "cache-first-search",
        cityName,
        checkinDate: new Date().toISOString().slice(0, 10),
        checkoutDate: new Date(Date.now() + nights * 86400000).toISOString().slice(0, 10),
        adults: 1,
        children: 0,
        limit: 20,
        targetCurrency,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const hotels = data.hotels || [];
      const returnedCurrency = data.displayCurrency || targetCurrency;
      if (hotels.length > 0) {
        // Pick best by star proximity + price availability
        hotels.sort((a: any, b: any) => {
          const aHasPrice = (a.price || 0) > 0 ? 0 : 1;
          const bHasPrice = (b.price || 0) > 0 ? 0 : 1;
          if (aHasPrice !== bHasPrice) return aHasPrice - bHasPrice;
          return Math.abs((a.stars || 0) - stars) - Math.abs((b.stars || 0) - stars);
        });
        const h = hotels[0];
        const pricePerNight = h.price || h.pricePerNight || 0;
        return {
          city: cityName, name: h.name || `${stars}-Star Hotel in ${cityName}`,
          stars: h.stars || stars, price_per_night: pricePerNight,
          total_price: pricePerNight * nights, nights, currency: returnedCurrency,
          is_live_price: pricePerNight > 0 && !h.isPreview,
          source: pricePerNight > 0 ? "unified_hotel_search" : "hotel_catalogue",
          hotel_id: h.id || "", image: h.image || "", rating: h.rating || 0,
          amenities: h.amenities || [],
          ai_suggestion: aiSuggestion || undefined, match_method: "fallback_city_search",
        };
      }
    }
  } catch (e: any) {
    console.warn(`[Match] Fallback hotel search failed for ${cityName}: ${e.message}`);
  }

  // Last resort: rough estimate — return in targetCurrency (approximate USD-equivalent values)
  // These are very rough and the frontend will show them as estimates
  const roughPrice = stars >= 5 ? 150 : stars >= 4 ? 80 : 45;
  return {
    city: cityName, name: aiSuggestion || `${stars}-Star Hotel in ${cityName}`,
    stars, price_per_night: roughPrice, total_price: roughPrice * nights,
    nights, currency: targetCurrency, is_live_price: false, source: "rough_estimate",
    ai_suggestion: aiSuggestion || undefined, match_method: "rough_fallback",
  };
}

// ═══ FLIGHT MATCHING — via unified-flight-search ═══

interface FlightMatch {
  from_city: string;
  to_city: string;
  from_code: string;
  to_code: string;
  price: number;
  currency: string;
  is_live_price: boolean;
  source: string;
  leg_type: "outbound" | "intercity" | "return";
  // Rich data from unified-flight-search
  airline?: string;
  flight_number?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  stops?: number;
  cabin_class?: string;
  segments?: any[];
  totalPrice?: number;
  paxPricing?: any;
  outbound?: any;
  return_leg?: any;
  legs_summary?: any[];
  _raw?: any; // full flight object for frontend swap pools
}

function buildIataMapFromFlights(flights: FlightMatch[]): Record<string, string> {
  const iataMap: Record<string, string> = {};
  for (const flight of flights || []) {
    if (flight.from_city && flight.from_code && !iataMap[flight.from_city]) {
      iataMap[flight.from_city] = flight.from_code;
    }
    if (flight.to_city && flight.to_code && !iataMap[flight.to_city]) {
      iataMap[flight.to_city] = flight.to_code;
    }
  }
  return iataMap;
}

async function buildAirportCoordsMapFromIataMap(
  sb: any,
  iataMap: Record<string, string>,
  logPrefix = "[Match]",
): Promise<Record<string, { lat: number; lng: number }>> {
  const airportCoordsMap: Record<string, { lat: number; lng: number }> = {};
  const uniqueIataCodes = [...new Set(
    Object.values(iataMap).filter((code): code is string => typeof code === "string" && /^[A-Za-z]{3}$/.test(code))
  )];

  if (uniqueIataCodes.length === 0) return airportCoordsMap;

  try {
    const { data: airportRows, error } = await sb
      .from("airports")
      .select("iata_code, city, latitude, longitude")
      .in("iata_code", uniqueIataCodes);

    if (error) throw error;

    for (const ap of airportRows || []) {
      const lat = typeof ap.latitude === "number" && !Number.isNaN(ap.latitude) ? ap.latitude : null;
      const lng = typeof ap.longitude === "number" && !Number.isNaN(ap.longitude) ? ap.longitude : null;
      if (lat === null || lng === null) continue;

      const codeKey = String(ap.iata_code || "").toLowerCase();
      const cityKey = String(ap.city || "").toLowerCase();
      if (codeKey) airportCoordsMap[codeKey] = { lat, lng };
      if (cityKey) airportCoordsMap[cityKey] = { lat, lng };
    }

    for (const [city, code] of Object.entries(iataMap)) {
      const coordsByCode = airportCoordsMap[String(code || "").toLowerCase()];
      if (coordsByCode && city) {
        airportCoordsMap[city.toLowerCase()] = coordsByCode;
      }
    }

    console.log(`${logPrefix} 📍 Airport coords resolved for ${Object.keys(airportCoordsMap).length} keys from DB`);
  } catch (e) {
    console.warn(`${logPrefix} ⚠️ Failed to fetch airport coords from DB:`, e);
  }

  return airportCoordsMap;
}

async function matchFlights(
  itinerary: any,
  sb: any,
  searchParams: any,
  targetCurrency: string,
): Promise<{ selected: FlightMatch[]; allSearchedFlights: any[] }> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const flightSearchUrl = `${SUPABASE_URL}/functions/v1/unified-flight-search`;

  const connections = itinerary.travel_connections || [];
  const originCity = searchParams?.origin_city || "";
  const cities = itinerary.cities || [];
  const firstCity = cities[0]?.name || "";
  const lastCity = cities[cities.length - 1]?.name || "";
  let departDate = searchParams?.depart_date || itinerary.days?.[0]?.date || "";
  // Fallback: if no date at all, use 2 weeks from now
  if (!departDate) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 14);
    departDate = fallback.toISOString().split("T")[0];
    console.warn(`[Match] ⚠️ No depart_date found, using fallback: ${departDate}`);
  }
  const adults = itinerary.adults || 1;
  const children = itinerary.children || 0;
  const infants = itinerary.infants || 0;
  const cabinClass = searchParams?.cabin_class || "Economy";
  const selectionPriority = (searchParams?.selection_priority || "cheapest").toLowerCase();
  const preferDirect = searchParams?.prefer_direct === true;

  // Resolve IATA codes via search-airports edge function (7000+ airports with OurAirports CSV fallback)
  const allCityNames = [...new Set([originCity, firstCity, lastCity, ...connections.map((c: any) => c.from_city), ...connections.map((c: any) => c.to_city)].filter(Boolean))];
  const iataMap: Record<string, string> = {};

  // Also check searchParams for explicit origin_airport
  if (searchParams?.origin_airport && originCity) {
    iataMap[originCity] = searchParams.origin_airport;
  }

  // Resolve remaining cities via search-airports in parallel
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const citiesToResolve = allCityNames.filter(c => !iataMap[c]);
  if (citiesToResolve.length > 0) {
    const resolveResults = await Promise.allSettled(
      citiesToResolve.map(async (city) => {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/search-airports`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ query: city }),
          });
          if (!res.ok) return { city, code: null };
          const data = await res.json();
          // Find best match: prefer exact city match, then first result
          const airports = data.airports || [];
          const exact = airports.find((a: any) => a.city?.toLowerCase() === city.toLowerCase());
          const best = exact || airports[0];
          return { city, code: best?.iata_code || null };
        } catch {
          return { city, code: null };
        }
      })
    );
    for (const r of resolveResults) {
      if (r.status === "fulfilled" && r.value.code) {
        iataMap[r.value.city] = r.value.code;
      }
    }
  }

  const unresolvedCities = allCityNames.filter(c => !iataMap[c]);
  if (unresolvedCities.length > 0) {
    console.warn(`[Match] ⚠️ Could not resolve IATA for: ${unresolvedCities.join(", ")}`);
  }
  console.log(`[Match] ✈️ IATA map: ${Object.entries(iataMap).map(([c, i]) => `${c}=${i}`).join(", ")}`);

  const airportCoordsMap = await buildAirportCoordsMapFromIataMap(sb, iataMap, "[Match]");

  // Build route legs with dates
  interface RouteLeg { from: string; to: string; fromCode: string; toCode: string; date: string; legType: "outbound" | "intercity" | "return" }
  const legs: RouteLeg[] = [];

  // Outbound
  if (originCity && firstCity && iataMap[originCity] && iataMap[firstCity]) {
    legs.push({ from: originCity, to: firstCity, fromCode: iataMap[originCity], toCode: iataMap[firstCity], date: departDate, legType: "outbound" });
  }

  // Inter-city legs from travel_connections (skip if already covered by outbound/return)
  const outboundKey = legs.length > 0 ? `${legs[0].fromCode}-${legs[0].toCode}` : "";
  for (const conn of connections) {
    if (conn.mode !== "flight") continue;
    const fc = iataMap[conn.from_city] || "";
    const tc = iataMap[conn.to_city] || "";
    if (!fc || !tc) continue;
    // Skip same-city legs (e.g., KUL→KUL for split hotel stays)
    if (fc === tc) {
      console.log(`[Match] ✈️ Skipping same-airport intercity leg ${fc}→${tc} (${conn.from_city}→${conn.to_city})`);
      continue;
    }
    // Skip if this connection duplicates the outbound leg
    const connKey = `${fc}-${tc}`;
    if (connKey === outboundKey) {
      console.log(`[Match] ✈️ Skipping duplicate intercity leg ${fc}→${tc} (same as outbound)`);
      continue;
    }
    // Skip if this duplicates the return leg
    if (originCity && lastCity && fc === iataMap[lastCity] && tc === iataMap[originCity]) {
      console.log(`[Match] ✈️ Skipping duplicate intercity leg ${fc}→${tc} (same as return)`);
      continue;
    }
    // Compute date: prefer AI day.date for the connection's day_index, then conn.date, then offset from departDate
    let connDate = conn.date || "";
    if (!connDate && conn.day_index !== undefined && itinerary.days?.[conn.day_index]?.date) {
      connDate = itinerary.days[conn.day_index].date;
    }
    if (!connDate && departDate && conn.day_index !== undefined) {
      const d = new Date(departDate);
      d.setDate(d.getDate() + conn.day_index);
      connDate = d.toISOString().split("T")[0];
    }
    legs.push({ from: conn.from_city, to: conn.to_city, fromCode: fc, toCode: tc, date: connDate, legType: "intercity" });
  }

  // Return leg
  if (originCity && lastCity && iataMap[lastCity] && iataMap[originCity]) {
    // Use AI's last day date, or compute from departDate + duration
    const lastDayObj = itinerary.days?.[itinerary.days.length - 1];
    let returnDate = lastDayObj?.date || "";
    if (!returnDate && departDate && itinerary.duration_days) {
      const d = new Date(departDate);
      d.setDate(d.getDate() + itinerary.duration_days - 1);
      returnDate = d.toISOString().split("T")[0];
    }
    legs.push({ from: lastCity, to: originCity, fromCode: iataMap[lastCity], toCode: iataMap[originCity], date: returnDate, legType: "return" });
  }

  if (legs.length === 0) {
    console.log("[Match] ✈️ No flight routes resolved");
    return { selected: [], allSearchedFlights: [] };
  }

  console.log(`[Match] ✈️ Searching ${legs.length} flight legs via unified-flight-search`);

  // Search all legs in parallel via unified-flight-search
  const allSearchedFlights: any[] = [];
  const selected: FlightMatch[] = [];

  const legResults = await Promise.all(legs.map(async (leg) => {
    try {
      const res = await fetch(flightSearchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "apikey": SUPABASE_KEY,
        },
        body: JSON.stringify({
          from: leg.fromCode,
          to: leg.toCode,
          departDate: leg.date,
          adults,
          children,
          infants,
          cabinClass,
          directFlight: preferDirect,
          currency: targetCurrency,
          quickSearch: true, // faster for pipeline — skip some enrichment
        }),
      });

      if (!res.ok) {
        console.warn(`[Match] ✈️ Flight search failed for ${leg.fromCode}→${leg.toCode}: ${res.status}`);
        return { leg, flights: [] as any[] };
      }

      const data = await res.json();
      const flights = data.flights || [];
      console.log(`[Match] ✈️ ${leg.fromCode}→${leg.toCode} (${leg.legType}): ${flights.length} results`);
      return { leg, flights };
    } catch (e: any) {
      console.warn(`[Match] ✈️ Flight search error ${leg.fromCode}→${leg.toCode}: ${e.message}`);
      return { leg, flights: [] as any[] };
    }
  }));

  // Select best flight per leg based on selectionPriority
  for (const { leg, flights } of legResults) {
    // Tag and collect all flights for swap pools
    const legLabel = `${leg.from} → ${leg.to}`;
    for (const f of flights) {
      f._legType = leg.legType;
      f._legLabel = legLabel;
      f._legFrom = leg.from;
      f._legTo = leg.to;
      f._legFromCode = leg.fromCode;
      f._legToCode = leg.toCode;
      allSearchedFlights.push(f);
    }

    if (flights.length === 0) {
      // No results from unified-flight-search — record as unavailable (no direct DB bypass)
      selected.push({
        from_city: leg.from, to_city: leg.to,
        from_code: leg.fromCode, to_code: leg.toCode,
        price: 0, currency: targetCurrency,
        is_live_price: false, source: "no_results",
        leg_type: leg.legType,
      });
      continue;
    }

    // When prefer_direct is set, strictly prefer non-stop flights even if pricier
    let pool = flights;
    if (preferDirect) {
      const directOnly = flights.filter((f: any) => (f.stops ?? 0) === 0);
      if (directOnly.length > 0) {
        pool = directOnly;
        console.log(`[Match] ✈️ prefer_direct: filtered to ${directOnly.length} direct flights (out of ${flights.length})`);
      } else {
        // Fallback: sort by fewest stops, then price
        pool = [...flights].sort((a: any, b: any) => {
          const stopDiff = (a.stops ?? 99) - (b.stops ?? 99);
          return stopDiff !== 0 ? stopDiff : (a.price || 999999) - (b.price || 999999);
        });
        console.log(`[Match] ✈️ prefer_direct: no direct flights found, using ${pool.length} sorted by fewest stops`);
      }
    }

    // Selection logic
    let best: any;
    if (selectionPriority === "luxury" || selectionPriority === "comfortable") {
      // Weighted: Stops 50%, Duration 30%, Price 20%
      const maxPrice = Math.max(...pool.map((f: any) => f.price || 0));
      const maxDur = Math.max(...pool.map((f: any) => parseDurationMinutes(f.duration) || 999));
      best = pool.reduce((a: any, b: any) => {
        const scoreA = luxuryScore(a, maxPrice, maxDur);
        const scoreB = luxuryScore(b, maxPrice, maxDur);
        return scoreA >= scoreB ? a : b;
      });
    } else if (selectionPriority === "fastest") {
      best = pool.reduce((a: any, b: any) => {
        const durA = parseDurationMinutes(a.duration) || 9999;
        const durB = parseDurationMinutes(b.duration) || 9999;
        return durA <= durB ? a : b;
      });
    } else {
      // "cheapest" or default — lowest price
      best = pool.reduce((a: any, b: any) => ((a.price || 999999) <= (b.price || 999999) ? a : b));
    }

    selected.push({
      from_city: leg.from, to_city: leg.to,
      from_code: leg.fromCode, to_code: leg.toCode,
      price: best.price || 0,
      totalPrice: best.totalPrice || 0,
      currency: targetCurrency,
      is_live_price: true,
      source: best.source || "unified_flight_search",
      leg_type: leg.legType,
      airline: best.airline || "",
      flight_number: best.flightNumber || "",
      departure: best.departure || "",
      arrival: best.arrival || "",
      duration: best.duration || "",
      stops: best.stops ?? 0,
      cabin_class: best.cabinClass || cabinClass,
      segments: best.segments || [],
      paxPricing: best.paxPricing || null,
      outbound: best.outbound || null,
      return_leg: best.return_leg || null,
      legs_summary: best.legs_summary || null,
      _raw: best,
    });

    console.log(`[Match] ✈️ Selected ${leg.legType} ${leg.fromCode}→${leg.toCode}: ${best.airline} ${best.flightNumber || ""} @ ${best.price} ${targetCurrency} (${best.stops || 0} stops)`);
  }

  return { selected, allSearchedFlights };
}

function parseDurationMinutes(dur: string | undefined): number | null {
  if (!dur) return null;
  const h = dur.match(/([\d]+)\s*h/i);
  const m = dur.match(/([\d]+)\s*m/i);
  return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0) || null;
}

function luxuryScore(f: any, maxPrice: number, maxDur: number): number {
  const stops = f.stops ?? 0;
  const dur = parseDurationMinutes(f.duration) || maxDur;
  const price = f.price || maxPrice;
  const stopScore = (1 - stops / 3) * 50;
  const durScore = (1 - dur / maxDur) * 30;
  const priceScore = (1 - price / maxPrice) * 20;
  const directBonus = stops === 0 ? 10 : 0;
  return stopScore + durScore + priceScore + directBonus;
}

// ═══ PRE-FETCHED DATA ADAPTERS — Convert frontend search results to match engine format ═══

function buildFlightResultFromPrefetched(
  prefetchedFlights: any[],
  itinerary: any,
  searchParams: any,
  targetCurrency: string,
  sb: any,
): Promise<{ selected: FlightMatch[]; allSearchedFlights: any[] }> {
  // Group pre-fetched flights by leg type
  const byLeg: Record<string, any[]> = {};
  for (const f of prefetchedFlights) {
    const legType = f._legType || "outbound";
    if (!byLeg[legType]) byLeg[legType] = [];
    byLeg[legType].push(f);
  }

  const selectionPriority = (searchParams?.selection_priority || "cheapest").toLowerCase();
  const selected: FlightMatch[] = [];

  for (const [legType, flights] of Object.entries(byLeg)) {
    if (flights.length === 0) continue;

    let best: any;
    if (selectionPriority === "cheapest") {
      best = flights.reduce((a: any, b: any) => ((a.price || 999999) <= (b.price || 999999) ? a : b));
    } else if (selectionPriority === "fastest") {
      best = flights.reduce((a: any, b: any) => {
        const durA = parseDurationMinutes(a.duration) || 9999;
        const durB = parseDurationMinutes(b.duration) || 9999;
        return durA <= durB ? a : b;
      });
    } else {
      const maxPrice = Math.max(...flights.map((f: any) => f.price || 0));
      const maxDur = Math.max(...flights.map((f: any) => parseDurationMinutes(f.duration) || 999));
      best = flights.reduce((a: any, b: any) => luxuryScore(a, maxPrice, maxDur) >= luxuryScore(b, maxPrice, maxDur) ? a : b);
    }

    selected.push({
      from_city: best._legFrom || best.fromCity || "",
      to_city: best._legTo || best.toCity || "",
      from_code: best.fromCode || best._legFromCode || "",
      to_code: best.toCode || best._legToCode || "",
      price: best.price || 0,
      totalPrice: best.totalPrice || best.price || 0,
      currency: targetCurrency,
      is_live_price: true,
      source: best.source || "prefetched",
      leg_type: legType as "outbound" | "intercity" | "return",
      airline: best.airline || "",
      flight_number: best.flightNumber || "",
      departure: best.departure || "",
      arrival: best.arrival || "",
      duration: best.duration || "",
      stops: best.stops ?? 0,
      cabin_class: best.cabinClass || searchParams?.cabin_class || "",
      segments: best.segments || [],
      paxPricing: best.paxPricing || null,
      outbound: best.outbound || null,
      return_leg: best.return_leg || null,
      legs_summary: best.legs_summary || null,
      _raw: best,
    });
  }

  return Promise.resolve({ selected, allSearchedFlights: prefetchedFlights });
}

function buildHotelResultFromPrefetched(
  prefetchedHotels: any[],
  itinerary: any,
  searchParams: any,
  targetCurrency: string,
): Promise<{ selected: HotelMatch[]; hotelSwapPools: Record<string, HotelSwapAlternative[]>; allSearchedHotels: any[] }> {
  const cities = itinerary.cities || [];
  const stars = searchParams?.hotel_stars || 4;
  const selectedHotels: HotelMatch[] = [];
  const hotelSwapPools: Record<string, HotelSwapAlternative[]> = {};

  // Group hotels by city
  const byCity: Record<string, any[]> = {};
  for (const h of prefetchedHotels) {
    const city = h.city || h._searchCity || "Unknown";
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(h);
  }

  for (const city of cities) {
    const cityName = city.name || "";
    const nights = Number(city.nights || (city.days ? Math.max(city.days - 1, 1) : 2));
    const selfManagedNights = Number(city.self_managed_nights || 0);
    const totalNights = Number(city.total_nights || nights);
    const cityHotels = byCity[cityName] || [];
    if (cityHotels.length === 0) continue;

    // Sort: priced first, then by star proximity + rating
    const sorted = [...cityHotels].sort((a: any, b: any) => {
      const aPrice = a.price || a.pricePerNight || 0;
      const bPrice = b.price || b.pricePerNight || 0;
      if ((aPrice > 0 ? 0 : 1) !== (bPrice > 0 ? 0 : 1)) return (aPrice > 0 ? 0 : 1) - (bPrice > 0 ? 0 : 1);
      const aDiff = Math.abs((a.stars || 0) - stars);
      const bDiff = Math.abs((b.stars || 0) - stars);
      if (aDiff !== bDiff) return aDiff - bDiff;
      return (b.rating || 0) - (a.rating || 0);
    });

    const best = sorted[0];
    const ppn = best.price || best.pricePerNight || 0;

    selectedHotels.push({
      city: cityName,
      name: best.name || `Hotel in ${cityName}`,
      stars: best.stars || stars,
      price_per_night: ppn,
      total_price: ppn * nights,
      nights,
      total_nights: totalNights,
      self_managed_nights: selfManagedNights,
      currency: targetCurrency,
      is_live_price: ppn > 0 && !best.isPreview,
      source: "prefetched",
      hotel_id: best.id || best.hotelId || "",
      hotel_area: best.area || best.city || cityName,
      image: best.image || "",
      rating: best.rating || 0,
      amenities: best.amenities || [],
      match_method: "prefetched_best",
    });

    // Swap pool: remaining hotels
    const swaps: HotelSwapAlternative[] = sorted.slice(1, 21).map((h: any) => ({
      hotel_id: h.id || h.hotelId || "",
      name: h.name || "",
      stars: h.stars || 0,
      price_per_night: h.price || h.pricePerNight || 0,
      total_price: (h.price || h.pricePerNight || 0) * nights,
      nights,
      currency: targetCurrency,
      rating: h.rating || 0,
      image: h.image || "",
      amenities: (h.amenities || []).slice(0, 5),
      source: "prefetched",
      is_live_price: (h.price || 0) > 0 && !h.isPreview,
      city: cityName,
    }));
    if (swaps.length > 0) hotelSwapPools[cityName] = swaps;
  }

  return Promise.resolve({ selected: selectedHotels, hotelSwapPools, allSearchedHotels: prefetchedHotels });
}


function applyMatches(
  itinerary: any,
  activityMatches: MatchResult[],
  hotelMatches: HotelMatch[],
  flightMatches: FlightMatch[],
  targetCurrency: string,
  travelers: number,
  exchangeRates: Record<string, number>,
): any {
  const enriched = JSON.parse(JSON.stringify(itinerary));

  for (const match of activityMatches) {
    const day = enriched.days?.[match.dayIdx];
    if (!day) continue;
    const act = day.activities?.[match.actIdx];
    if (!act) continue;

    act.product_code = match.product_code;
    act.product_option_code = match.matched_option_code || null;
    act.product_option_title = match.matched_option_title || null;
    act.product_name = match.product_name;
    act.cost_estimate = match.pricingType === "PER_PERSON"
      ? match.price * travelers
      : match.price;
    act.is_live_price = match.price > 0;
    act.source = match.option_match ? "tour_cache_option" : "tour_cache";
    act.highlights = match.highlights;
    act.places_covered = match.places_covered;
    act.pricingType = match.pricingType;
    act.vela_id = match.vela_id;
    if (match.duration_hours) act.duration_hours = match.duration_hours;
  }

  // ── Handle unmatched activities: convert paid → free, or convert currency ──
  const matchedIndices = new Set(activityMatches.map(m => `${m.dayIdx}-${m.actIdx}`));
  for (const day of enriched.days || []) {
    for (let ai = 0; ai < (day.activities || []).length; ai++) {
      const act = day.activities[ai];
      const key = `${(day.day || 1) - 1}-${ai}`;
      if (matchedIndices.has(key)) continue; // already has live price
      if (act.is_live_price) continue;

      const estimate = Number(act.cost_estimate || 0);
      // If no paid product matched and it had a cost, convert to free activity
      if (estimate > 0) {
        const cityName = day.city || "the area";
        const oldName = act.activity || "";
        // Check if this looks like a bookable tour/activity (not transport/hotel)
        const isTransport = /\b(flight|transfer|taxi|airport|check.?in|check.?out)\b/i.test(oldName);
        if (!isTransport) {
          act.cost_estimate = 0;
          act.estimate_currency = targetCurrency;
          act.category = "free_activity";
          act.notes = `Originally "${oldName}" — no bookable product found. Enjoy exploring ${cityName} independently!`;
          console.log(`[Match] 🆓 Converted unmatched paid activity "${oldName}" → free self-guided activity in ${cityName}`);
        } else if (targetCurrency !== "USD") {
          act.cost_estimate = convertUsdTo(estimate, targetCurrency, exchangeRates);
          act.estimate_currency = targetCurrency;
          console.log(`[Match] 💱 Converted AI estimate "${oldName}" ${estimate} USD → ${act.cost_estimate} ${targetCurrency}`);
        }
      }
    }
  }

  if (hotelMatches.length > 0) {
    enriched.selected_hotels = hotelMatches.map(h => ({
      name: h.name, city: h.city, stars: h.stars,
      price_per_night: h.price_per_night, total_price: h.total_price,
      nights: h.nights, total_nights: h.total_nights, self_managed_nights: h.self_managed_nights,
      hotel_area: h.hotel_area || h.city,
      hotel_id: h.hotel_id || "", image: h.image || "",
      rating: h.rating || 0, amenities: h.amenities || [],
      reason: h.match_method === "ai_match_exact_substring" ? "AI recommended — exact match"
        : h.match_method?.startsWith("ai_match_token") ? "AI recommended — close match"
        : h.match_method === "fallback_best_match" ? "Best available for your preferences"
        : h.source === "unified_hotel_search" ? "Best rated in your category"
        : h.source === "city_estimate" ? "Based on city average pricing"
        : "Estimated pricing",
      ai_suggestion: h.ai_suggestion || undefined,
      match_method: h.match_method || "unknown",
      currency: h.currency, is_live_price: h.is_live_price, source: h.source,
      latitude: h.latitude, longitude: h.longitude,
    }));

    // Replace unfound AI hotel names in itinerary cities with actual matched hotels
    const hotelByCity: Record<string, HotelMatch> = {};
    for (const h of hotelMatches) hotelByCity[h.city] = h;

    // Update cities[].preferred_hotel with the actually-found hotel name
    if (enriched.cities) {
      for (const city of enriched.cities) {
        const matched = hotelByCity[city.name];
        if (matched && matched.ai_suggestion && matched.name !== matched.ai_suggestion) {
          console.log(`[Match] 🏨 Replacing unfound AI hotel "${matched.ai_suggestion}" → "${matched.name}" in ${city.name}`);
          city.preferred_hotel = matched.name;
        }
      }
    }

    for (const day of enriched.days || []) {
      const cityHotel = hotelByCity[day.city];
      if (cityHotel) {
        day.hotel = {
          name: cityHotel.name, area: cityHotel.hotel_area || cityHotel.city,
          price_per_night: cityHotel.price_per_night, stars: cityHotel.stars,
          is_live_price: cityHotel.is_live_price, hotel_id: cityHotel.hotel_id || "",
          image: cityHotel.image || "",
        };
      }

      // Replace ALL hotel name references from ANY city's AI suggestion → matched name
      // This handles transition days where activities reference a different city's hotel
      for (const [, hm] of Object.entries(hotelByCity)) {
        if (hm.ai_suggestion && hm.name !== hm.ai_suggestion) {
          const oldName = hm.ai_suggestion;
          const newName = hm.name;
          for (const act of day.activities || []) {
            if (act.activity && act.activity.includes(oldName)) {
              console.log(`[Match] 🏨 Activity text replace: "${act.activity}" → "${act.activity.replace(oldName, newName)}"`);
              act.activity = act.activity.replace(oldName, newName);
            }
            if (act.description && act.description.includes(oldName)) {
              act.description = act.description.replace(oldName, newName);
            }
          }
        }
      }

      // ── Deduplicate: Remove AI-generated hotel check-in/checkout activities ──
      if (day.activities) {
        const before = day.activities.length;
        day.activities = day.activities.filter((act: any) => {
          const label = (act.activity || "").toLowerCase();
          const cat = (act.category || "").toLowerCase();
          if (cat === "hotel" && /check.?in|check.?out|refresh|settle/i.test(label)) return false;
          if (/^(hotel\s*)?(check.?in|check.?out|checkout)\b/i.test(label)) return false;
          return true;
        });
        if (day.activities.length < before) {
          console.log(`[Match] 🏨 Removed ${before - day.activities.length} duplicate hotel check-in/out activities on Day ${day.day} (${day.city})`);
        }
      }
    }
  }

  // ── Deduplicate: Remove duplicate flight activities across days ──
  // AI sometimes generates "Flight from X to Y" on both the departure and arrival day.
  // Keep only the first occurrence of each route.
  const seenFlightRoutes = new Set<string>();
  for (const day of enriched.days || []) {
    if (!day.activities) continue;
    const before = day.activities.length;
    day.activities = day.activities.filter((act: any) => {
      const label = (act.activity || "").toLowerCase();
      const cat = (act.category || "").toLowerCase();
      // Detect flight activities
      const isFlight = cat === "flight" || cat === "transport" ||
        /\bflight\b.*\bfrom\b.*\bto\b/i.test(label) ||
        /\bfly\b.*\bto\b/i.test(label) ||
        (/\b(depart|departure)\b/i.test(label) && /\bflight\b/i.test(label));
      if (!isFlight) return true;
      // Extract route key from activity text
      const routeMatch = label.match(/(?:from|→)\s*(\w[\w\s]*?)\s*(?:to|→)\s*(\w[\w\s]*?)$/i);
      if (!routeMatch) return true; // can't parse route, keep it
      const routeKey = `${routeMatch[1].trim()}-${routeMatch[2].trim()}`.toLowerCase();
      if (seenFlightRoutes.has(routeKey)) return false; // duplicate
      seenFlightRoutes.add(routeKey);
      return true;
    });
    if (day.activities.length < before) {
      console.log(`[Match] ✈️ Removed ${before - day.activities.length} duplicate flight activities on Day ${day.day} (${day.city})`);
    }
  }

  let totalActivities = 0, totalHotels = 0, totalFlights = 0;
  for (const day of enriched.days || []) {
    for (const act of day.activities || []) {
      totalActivities += act.cost_estimate || 0;
    }
  }
  for (const h of hotelMatches) totalHotels += h.total_price;
  // Use totalPrice (all-pax) when available, otherwise per-person price
  for (const f of flightMatches) totalFlights += (f.totalPrice || f.price || 0);

  enriched.budget_estimate = {
    currency: targetCurrency,
    total: totalActivities + totalHotels + totalFlights,
    breakdown: { flights: totalFlights, hotels: totalHotels, activities: totalActivities },
    is_estimated: !flightMatches.some(f => f.is_live_price),
  };

  // Enrich travel_connections with live flight data
  if (flightMatches.length > 0 && enriched.travel_connections) {
    for (const fm of flightMatches) {
      const conn = enriched.travel_connections.find(
        (c: any) => c.from_city === fm.from_city && c.to_city === fm.to_city
      );
      if (conn) {
        conn.estimated_price = fm.totalPrice || fm.price;
        conn.price_currency = fm.currency;
        conn.from_code = fm.from_code;
        conn.to_code = fm.to_code;
        conn.is_live_price = fm.is_live_price;
        conn.airline = fm.airline || "";
        conn.flight_number = fm.flight_number || "";
        conn.departure = fm.departure || "";
        conn.arrival = fm.arrival || "";
        conn.duration = fm.duration || "";
        conn.stops = fm.stops ?? 0;
      }
    }
  }

  // Build selected_flights (parallel to selected_hotels)
  enriched.selected_flights = flightMatches.map(fm => ({
    from_city: fm.from_city, to_city: fm.to_city,
    from_code: fm.from_code, to_code: fm.to_code,
    leg_type: fm.leg_type,
    airline: fm.airline || "", flight_number: fm.flight_number || "",
    departure: fm.departure || "", arrival: fm.arrival || "",
    duration: fm.duration || "", stops: fm.stops ?? 0,
    price: fm.price, totalPrice: fm.totalPrice || fm.price,
    currency: fm.currency, cabin_class: fm.cabin_class || "",
    is_live_price: fm.is_live_price, source: fm.source,
    segments: fm.segments || [],
    paxPricing: fm.paxPricing || null,
    outbound: fm.outbound || null,
    return_leg: fm.return_leg || null,
    legs_summary: fm.legs_summary || null,
  }));

  enriched.live_activities = activityMatches.map(m => ({
    name: m.product_name, price: m.price, currency: m.currency,
    duration: m.duration_hours ? `${m.duration_hours}h` : "",
    rating: m.rating, review_count: m.review_count,
    category: "activity", product_code: m.product_code,
    product_option_code: m.matched_option_code || null,
    product_option_title: m.matched_option_title || null,
    option_match: m.option_match,
    image: m.image_url || "", is_live_price: m.price > 0,
    highlights: m.highlights, pricingType: m.pricingType,
    vela_id: m.vela_id, _matchScore: m.score,
  }));

  enriched.live_hotels = hotelMatches.map(h => ({
    id: h.hotel_id || "", name: h.name, city: h.city,
    stars: h.stars, rating: h.rating || 0,
    price: h.price_per_night, pricePerNight: h.price_per_night,
    currency: h.currency, image: h.image || "",
    amenities: h.amenities || [], source: h.source,
    is_live_price: h.is_live_price, nights: h.nights,
    total_price: h.total_price, match_method: h.match_method,
    ai_suggestion: h.ai_suggestion,
  }));

  enriched.live_flights = flightMatches.map(fm => ({
    from_city: fm.from_city, to_city: fm.to_city,
    from_code: fm.from_code, to_code: fm.to_code,
    leg_type: fm.leg_type,
    airline: fm.airline || "", flight_number: fm.flight_number || "",
    departure: fm.departure || "", arrival: fm.arrival || "",
    duration: fm.duration || "", stops: fm.stops ?? 0,
    price: fm.price, totalPrice: fm.totalPrice || fm.price,
    currency: fm.currency, is_live_price: fm.is_live_price,
    source: fm.source, cabin_class: fm.cabin_class || "",
  }));

  // Build legacy selected_flight (singular) for frontend DesktopFlightsCard
  if (flightMatches.length > 0) {
    const outbound = flightMatches.find(f => f.leg_type === "outbound");
    const returnFlight = flightMatches.find(f => f.leg_type === "return");
    const interCity = flightMatches.filter(f => f.leg_type === "intercity");
    // totalPrice = all-pax total across all legs; perAdultTotal = per-adult sum
    const totalFlightPrice = flightMatches.reduce((s, f) => s + (f.totalPrice || f.price || 0), 0);
    const perAdultTotal = flightMatches.reduce((s, f) => s + (f.price || 0), 0);

    const buildLeg = (fm: any) => fm ? ({
      airline: fm.airline || "",
      flight_number: fm.flight_number || "",
      from: fm.from_code || fm.from_city || "",
      to: fm.to_code || fm.to_city || "",
      departure: fm.departure || "",
      arrival: fm.arrival || "",
      duration: fm.duration || "",
      stops: fm.stops ?? 0,
      date: fm.date || "",
      cabin_class: fm.cabin_class || "Economy",
    }) : undefined;

    enriched.selected_flight = {
      summary: outbound
        ? `${outbound.airline} ${outbound.flight_number} · ${outbound.from_city} → ${outbound.to_city}`.trim()
        : "",
      // totalPrice is the fully computed all-pax cost across all legs.
      // price is the per-adult sum (for display / per-person breakdown).
      // adultFare/childFare/infantFare are omitted to prevent calcFlightCost from
      // multiplying per-adult × pax again. calcFlightCost falls through to totalPrice.
      totalPrice: totalFlightPrice,
      price: perAdultTotal,
      outbound: buildLeg(outbound),
      inbound: buildLeg(returnFlight),
      inter_city_legs: interCity.map(ic => ({
        label: `${ic.from_city} → ${ic.to_city}`,
        ...buildLeg(ic)!,
        price: ic.price || 0,
        totalPrice: ic.totalPrice || ic.price || 0,
        currency: ic.currency || targetCurrency,
      })),
      is_live_price: flightMatches.some(f => f.is_live_price),
      return_flight: !!returnFlight,
      _rawSegments: outbound?.segments || [],
    };
  }

  // Build legacy selected_hotel (singular) from first hotel match
  if (hotelMatches.length > 0) {
    const h = hotelMatches[0];
    enriched.selected_hotel = {
      name: h.name,
      stars: h.stars,
      price_per_night: h.price_per_night,
      total_price: h.total_price,
      nights: h.nights,
      room_type: h.room_type || "",
      meal_basis: h.meal_basis || "",
      is_live_price: h.is_live_price,
    };
  }

  enriched._pipeline_version = "v2_matched";
  return enriched;
}

// ═══ BACKEND TRANSFER NEED EXTRACTION ═══
// Builds transfer requests from the matched itinerary (flights + hotels resolved)
// Now includes distance/duration data from airportCoordsMap for better AI estimation
function buildTransferNeeds(itinerary: any, hotelMatches: any[], flightMatches: any[], airportCoordsMap?: Record<string, { lat: number; lng: number }>): any[] {
  const days = itinerary?.days;
  if (!days || days.length === 0) return [];

  const transfers: any[] = [];
  const adults = itinerary.adults || itinerary.travelers || 2;
  const children = itinerary.children || 0;
  const infants = itinerary.infants || 0;
  const totalPax = adults + children;
  const country = itinerary.destination_country || itinerary.country || "";
  const basePax = { passengers: totalPax, adults, children, infants };

  const getDayCity = (day: any): string =>
    day?.city || day?.location || (itinerary.destination || "").split(",")[0]?.trim() || "";

  const getDayHotel = (day: any): string => {
    const direct = day?.hotel?.name || day?.selected_hotel?.name;
    if (direct) return direct;
    const dayCity = getDayCity(day).toLowerCase().trim();
    const matched = hotelMatches.find((h: any) => {
      const hc = (h._searchCity || h.city || "").toLowerCase().trim();
      return hc && dayCity && (hc === dayCity || hc.includes(dayCity) || dayCity.includes(hc));
    });
    return matched?.name || itinerary.selected_hotel?.name || "Hotel";
  };

  // Build IATA lookup from flight matches
  const getIata = (city: string): string | undefined => {
    const cl = city.toLowerCase().trim();
    for (const fm of flightMatches) {
      if ((fm.from || "").toLowerCase().includes(cl) || cl.includes((fm.from || "").toLowerCase())) return fm.from_code;
      if ((fm.to || "").toLowerCase().includes(cl) || cl.includes((fm.to || "").toLowerCase())) return fm.to_code;
    }
    // Check itinerary selected_flight
    const sf = itinerary.selected_flight;
    if (sf) {
      const outDep = (sf.outbound?.departure_city || sf.from || "").toLowerCase();
      const outArr = (sf.outbound?.arrival_city || sf.to || "").toLowerCase();
      if (outDep.includes(cl) || cl.includes(outDep)) return sf.outbound?.departure_airport || sf.from_code;
      if (outArr.includes(cl) || cl.includes(outArr)) return sf.outbound?.arrival_airport || sf.to_code;
      for (const leg of sf.inter_city_legs || []) {
        const lf = (leg.from || "").toLowerCase();
        const lt = (leg.to || "").toLowerCase();
        if (lf.includes(cl) || cl.includes(lf)) return leg.from_code;
        if (lt.includes(cl) || cl.includes(lt)) return leg.to_code;
      }
    }
    return undefined;
  };

  const hasFlightForSegment = (fromCity: string, toCity: string): boolean => {
    const from = fromCity.toLowerCase();
    const to = toCity.toLowerCase();
    const legs = itinerary.selected_flight?.inter_city_legs || [];
    return legs.some((leg: any) => {
      const lf = (leg.from || "").toLowerCase();
      const lt = (leg.to || "").toLowerCase();
      return (lf.includes(from) || from.includes(lf)) && (lt.includes(to) || to.includes(lt));
    });
  };

  const dayHasFlightActivity = (day: any): boolean =>
    (day?.activities || []).some((a: any) => /flight\s+from/i.test(a.activity || a.name || "") || a.category === "flight");

  // 1. Arrival: airport → hotel (Day 1)
  const firstCity = getDayCity(days[0]);
  const firstIata = getIata(firstCity);
  transfers.push({
    pickup_type: "airport", pickup_code: firstIata, pickup_name: `${firstCity} Airport`,
    dropoff_type: "hotel", dropoff_name: getDayHotel(days[0]),
    city: firstCity, country, ...basePax,
    transfer_type: "airport_hotel", day_index: 0, position: "arrival", time_bucket: "daytime",
  });

  // 2. Departure: hotel → airport (last day)
  const lastCity = getDayCity(days[days.length - 1]);
  const lastIata = getIata(lastCity);
  transfers.push({
    pickup_type: "hotel", pickup_name: getDayHotel(days[days.length - 1]),
    dropoff_type: "airport", dropoff_code: lastIata, dropoff_name: `${lastCity} Airport`,
    city: lastCity, country, ...basePax,
    transfer_type: "hotel_airport", day_index: days.length - 1, position: "departure", time_bucket: "daytime",
  });

  // 3. Transition day transfers
  for (let i = 1; i < days.length; i++) {
    const day = days[i];
    const prevDay = days[i - 1];
    const prevCity = getDayCity(prevDay).toLowerCase();
    const currCity = getDayCity(day).toLowerCase();
    const dayType = (day.day_type || "").toLowerCase();
    const depCity = day.departure_city || getDayCity(prevDay);
    const arrCity = day.arrival_city || getDayCity(day);
    const isTransition = dayType === "transition" || prevCity !== currCity;

    if (!isTransition) {
      // Same city — check mid-stay hotel change
      const prevH = getDayHotel(prevDay).toLowerCase();
      const currH = getDayHotel(day).toLowerCase();
      if (prevH && currH && prevH !== currH) {
        transfers.push({
          pickup_type: "hotel", pickup_name: getDayHotel(prevDay),
          dropoff_type: "hotel", dropoff_name: getDayHotel(day),
          city: getDayCity(day), country, ...basePax,
          transfer_type: "hotel_hotel", day_index: i, position: "intercity", time_bucket: "daytime",
        });
      }
      continue;
    }

    const isByFlight = hasFlightForSegment(depCity, arrCity) || dayHasFlightActivity(day);
    if (isByFlight) {
      const depIata = getIata(depCity);
      const arrIata = getIata(arrCity);
      transfers.push({
        pickup_type: "hotel", pickup_name: getDayHotel(prevDay),
        dropoff_type: "airport", dropoff_code: depIata, dropoff_name: `${depCity} Airport`,
        city: depCity, country, ...basePax,
        transfer_type: "hotel_airport", day_index: i, position: "departure", time_bucket: "daytime",
      });
      transfers.push({
        pickup_type: "airport", pickup_code: arrIata, pickup_name: `${arrCity} Airport`,
        dropoff_type: "hotel", dropoff_name: getDayHotel(day),
        city: arrCity, country, ...basePax,
        transfer_type: "airport_hotel", day_index: i, position: "arrival", time_bucket: "daytime",
      });
    } else {
      transfers.push({
        pickup_type: "hotel", pickup_name: getDayHotel(prevDay),
        dropoff_type: "hotel", dropoff_name: getDayHotel(day),
        city: arrCity, country, ...basePax,
        transfer_type: "hotel_hotel", day_index: i, position: "intercity", time_bucket: "daytime",
      });
    }
  }

  // 4. Resort detection
  const destination = (itinerary.destination || "").toLowerCase();
  const resortDests = ["maldives", "bora bora", "fiji", "seychelles"];
  if (resortDests.some(r => destination.includes(r))) {
    if (transfers.length > 0) { transfers[0].transfer_type = "resort_transfer"; transfers[0].position = "resort"; }
    if (transfers.length > 1) { transfers[transfers.length - 1].transfer_type = "resort_transfer"; transfers[transfers.length - 1].position = "resort"; }
  }

  // 5. Enrich with distance data from airport coordinates + hotel coordinates
  if (airportCoordsMap) {
    for (const t of transfers) {
      const city = (t.city || "").toLowerCase();
      const airportCoords = airportCoordsMap[city] || (t.pickup_code ? airportCoordsMap[t.pickup_code.toLowerCase()] : undefined) || (t.dropoff_code ? airportCoordsMap[t.dropoff_code.toLowerCase()] : undefined);
      // Find hotel coordinates from hotelMatches
      const hotelName = (t.pickup_type === "hotel" ? t.pickup_name : t.dropoff_name || "").toLowerCase();
      const matchedHotel = hotelMatches.find((h: any) => {
        const hName = (h.name || "").toLowerCase();
        const hCity = (h._searchCity || h.city || "").toLowerCase();
        return (hName.includes(hotelName.slice(0, 15)) || hotelName.includes(hName.slice(0, 15))) && (hCity === city || hCity.includes(city) || city.includes(hCity));
      });
      const hotelLat = matchedHotel?.latitude || matchedHotel?.lat;
      const hotelLng = matchedHotel?.longitude || matchedHotel?.lng;

      if (airportCoords && hotelLat && hotelLng) {
        const distKm = haversineKm(airportCoords.lat, airportCoords.lng, hotelLat, hotelLng) * 1.3; // road multiplier
        const speedKmh = distKm > 30 ? 45 : 30;
        const durationMin = Math.round((distKm / speedKmh) * 60);
        t.distance_km = distKm;
        t.estimated_duration_minutes = durationMin;
        t.hotel_name = matchedHotel?.name || t.pickup_name || t.dropoff_name;
        t.airport_name = t.pickup_code || t.dropoff_code || `${city} Airport`;
      }
    }
  }

  return transfers;
}


// Calculates realistic timing based on:
// - Departure: checkout → 15min → transfer (estimate distance) → arrive airport 2.5h before flight
// - Arrival: flight lands → 30min (deplane/baggage) → airport pickup → transfer to hotel → check-in → 1h gap → activities

function parseTimeStr(t: string): number {
  if (!t) return -1;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : -1;
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(Math.min(Math.max(mins, 0), 23 * 60 + 59) / 60);
  const m = Math.floor(Math.max(mins, 0)) % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Airport coordinates map — populated dynamically from DB at runtime
// Passed into resolveFlightTimingConflicts; no hardcoded coords needed

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Estimate transfer duration using hotel coordinates → airport coordinates
// airportCoords is dynamically populated from DB; falls back to generic estimate
function estimateTransferMinutes(city: string, hotelLat?: number, hotelLng?: number, airportCoords?: Record<string, { lat: number; lng: number }>): number {
  const c = (city || "").toLowerCase();
  const coords = airportCoords || {};
  const airport = coords[c] || Object.entries(coords).find(([k]) => c.includes(k) || k.includes(c))?.[1];

  if (hotelLat && hotelLng && airport) {
    const distKm = haversineKm(hotelLat, hotelLng, airport.lat, airport.lng);
    const roadKm = distKm * 1.3;
    const avgSpeedKmH = distKm > 30 ? 45 : 30;
    const driveMin = (roadKm / avgSpeedKmH) * 60;
    const totalMin = Math.round(Math.max(15, driveMin + 10));
    console.log(`[Transfer] 📍 ${city}: hotel(${hotelLat.toFixed(3)},${hotelLng.toFixed(3)}) → airport(${airport.lat.toFixed(3)},${airport.lng.toFixed(3)}) = ${distKm.toFixed(1)}km → ~${totalMin}min`);
    return Math.min(totalMin, 120);
  }

  // No coordinates available — use conservative default
  console.log(`[Transfer] ⚠️ ${city}: no airport/hotel coords, using 40min default`);
  return 40;
}

function resolveFlightTimingConflicts(itinerary: any, flights: any[], airportCoords?: Record<string, { lat: number; lng: number }>): void {
  if (!itinerary?.days || !flights?.length) return;

  // Build hotel-by-city map for correct hotel name references + coordinates
  const hotelByCity: Record<string, { name: string; lat?: number; lng?: number }> = {};
  for (const h of itinerary.selected_hotels || []) {
    hotelByCity[(h._searchCity || h.city || "").toLowerCase()] = {
      name: h.name,
      lat: h.latitude || undefined,
      lng: h.longitude || undefined,
    };
  }

  for (const day of itinerary.days) {
    const acts = day.activities || [];
    if (acts.length === 0) continue;

    const dayDate = day.date || "";
    const dayType = (day.day_type || "").toLowerCase();
    const isLastDay = day.day === itinerary.days?.length;

    // Find matched flight for this day
    const departingFlight = flights.find((f: any) => f.departure?.startsWith(dayDate));
    const arrivingFlight = flights.find((f: any) => f.arrival?.startsWith(dayDate) && !(f.departure?.startsWith(dayDate) && f.from_city === day.city));

    // ── DEPARTURE DAY LOGIC ──
    // Only apply departure-day adjustments (checkout, sightseeing compression)
    // when this is NOT the first day of the trip — Day 1 has no prior hotel to check out from.
    const isFirstDay = day.day === 1;
    if (departingFlight?.departure && !isFirstDay) {
      const realDepTime = departingFlight.departure.match(/T(\d{2}:\d{2})/)?.[1];
      if (realDepTime) {
        const flightDepMin = parseTimeStr(realDepTime);
        const departCity = departingFlight.from_city || day.departure_city || day.city || "";
        const hotelInfo = hotelByCity[departCity.toLowerCase()];
        const transferDuration = estimateTransferMinutes(departCity, hotelInfo?.lat, hotelInfo?.lng, airportCoords);
        const arriveAirportBy = flightDepMin - 150; // 2.5h before flight
        const transferStartMin = arriveAirportBy - transferDuration;
        const checkoutMin = Math.max(transferStartMin - 15, 6 * 60);

        console.log(`[FlightFix] ✈️ Day ${day.day} DEPARTURE: flight=${realDepTime}, airport_by=${minutesToTimeStr(arriveAirportBy)}, transfer=${minutesToTimeStr(transferStartMin)} (${transferDuration}min), checkout=${minutesToTimeStr(checkoutMin)}`);

        // Update or INJECT checkout activity
        let checkoutAct = acts.find((a: any) => /check.?out/i.test(a.activity || ""));
        const depHotelName = hotelInfo?.name || "Hotel";
        if (checkoutAct) {
          checkoutAct.time = minutesToTimeStr(checkoutMin);
        } else {
          checkoutAct = {
            activity: `Check-out from ${depHotelName}`,
            time: minutesToTimeStr(checkoutMin),
            duration_hours: 0.25,
            category: "hotel",
            cost_estimate: 0,
            description: `Check-out and prepare for departure`,
          };
          // Insert before transfer/flight activities
          const firstTransportIdx = acts.findIndex((a: any) => /transfer|→.*airport|airport|depart|flight/i.test(a.activity || ""));
          if (firstTransportIdx >= 0) acts.splice(firstTransportIdx, 0, checkoutAct);
          else acts.push(checkoutAct);
          console.log(`[FlightFix] 🏨 Injected checkout from ${depHotelName} at ${minutesToTimeStr(checkoutMin)}`);
        }

        // Update or INJECT transfer to airport + fix hotel name
        let transferAct = acts.find((a: any) => /transfer|→.*airport|airport/i.test(a.activity || "") && !/arrive|arrival|pickup/i.test(a.activity || ""));
        if (transferAct) {
          transferAct.time = minutesToTimeStr(transferStartMin);
          if (depHotelName && transferAct.activity) {
            transferAct.activity = transferAct.activity.replace(/^[^→]+→/, `${depHotelName} →`);
          }
        } else {
          transferAct = {
            activity: `${depHotelName} → Airport Transfer`,
            time: minutesToTimeStr(transferStartMin),
            duration_hours: Math.round(transferDuration / 60 * 10) / 10,
            category: "transport",
            cost_estimate: 0,
            description: `Transfer to airport (~${transferDuration} min)`,
          };
          const coIdx = acts.indexOf(checkoutAct);
          acts.splice(coIdx + 1, 0, transferAct);
          console.log(`[FlightFix] 🚗 Injected departure transfer: ${depHotelName} → Airport at ${minutesToTimeStr(transferStartMin)}`);
        }

        // Update flight departure activity time
        const flightAct = acts.find((a: any) =>
          /✈|flight|depart/i.test(a.activity || "") && !/arrive|arrival|land/i.test(a.activity || "")
        );
        if (flightAct) flightAct.time = realDepTime;

        // Shift sightseeing before checkout — ONLY pre-flight activities
        // On transition days, post-flight activities belong to the arrival city and are handled by arrival logic
        const sightseeing = acts.filter((a: any) => {
          if (/check.?out|check.?in|transfer|airport|flight|depart|arrive|✈|hotel/i.test(a.activity || "")) return false;
          // Only include activities currently scheduled before the flight
          const actMin = parseTimeStr(a.time);
          return actMin < flightDepMin;
        });
        let nextSlot = 7 * 60;
        for (const act of sightseeing) {
          const dur = getActDurationH(act, 1.5) * 60;
          if (nextSlot + dur > checkoutMin - 30) {
            act.time = minutesToTimeStr(Math.max(7 * 60, checkoutMin - dur - 30));
          } else {
            act.time = minutesToTimeStr(nextSlot);
            nextSlot = nextSlot + dur + 30;
          }
        }

        // ── Clean up departure-only days ──
        // On days where the traveler departs and does NOT arrive in a new city,
        // remove check-in, post-flight activities, and stale AI transfer placeholders
        const isDepartureOnly = departingFlight && !arrivingFlight;


        if (isDepartureOnly || isLastDay) {
          // Remove check-in on departure day — makes no sense
          for (let ai = acts.length - 1; ai >= 0; ai--) {
            if (/check.?in/i.test(acts[ai].activity || "")) {
              console.log(`[FlightFix] 🗑️ Removing check-in on departure Day ${day.day}: "${acts[ai].activity}"`);
              acts.splice(ai, 1);
            }
          }

          // Remove activities scheduled AFTER flight departure
          for (let ai = acts.length - 1; ai >= 0; ai--) {
            const actName = acts[ai].activity || "";
            const actMin = parseTimeStr(acts[ai].time);
            // Keep the flight itself and transport/checkout events
            if (/✈|depart|flight|check.?out/i.test(actName)) continue;
            // Keep the resolved transfer to airport (has product_code or Sedan badge)
            if (acts[ai].product_code || /→.*airport/i.test(actName)) continue;
            if (actMin >= flightDepMin) {
              console.log(`[FlightFix] 🗑️ Removing post-flight activity on Day ${day.day}: "${actName}" at ${acts[ai].time}`);
              acts.splice(ai, 1);
            }
          }
        }

        // Remove duplicate AI-generated transfer placeholders that overlap with real transfers
        // e.g., "Transfer: KL → Dhaka" (flight placeholder) or "Transfer to KLIA" (duplicate of resolved transfer)
        const hasResolvedHotelAirportTransfer = acts.some((a: any) =>
          /→.*airport/i.test(a.activity || "") && (a.category === "transport" || /transport/i.test(a.category || ""))
        );
        if (hasResolvedHotelAirportTransfer) {
          const STALE_TRANSFER_RX = /^transfer\s*(?:to|:)\s/i;
          for (let ai = acts.length - 1; ai >= 0; ai--) {
            const actName = acts[ai].activity || "";
            // "Transfer: City → City" is an AI flight placeholder — remove if real flight exists
            if (STALE_TRANSFER_RX.test(actName) && !/→.*airport|airport.*→/i.test(actName)) {
              console.log(`[FlightFix] 🗑️ Removing stale AI transfer placeholder on Day ${day.day}: "${actName}"`);
              acts.splice(ai, 1);
            }
          }
        }

        acts.sort((a: any, b: any) => parseTimeStr(a.time) - parseTimeStr(b.time));
      }
    }

    // ── Remove checkout on arrival-only days (Day 1 or pure arrival days with no departure) ──
    if (isFirstDay || (!departingFlight && arrivingFlight)) {
      const coIdx = acts.findIndex((a: any) => /check.?out/i.test(a.activity || ""));
      if (coIdx !== -1) {
        console.log(`[FlightFix] 🗑️ Removing checkout on Day ${day.day} (arrival-only day)`);
        acts.splice(coIdx, 1);
      }
    }

    // ── ARRIVAL DAY LOGIC ──
    // Skip hotel check-in injection on the LAST day — arriving home doesn't need a hotel
    const isLastDay = day.day === itinerary.days?.length;
    if (arrivingFlight?.arrival && !isLastDay) {
      const realArrTime = arrivingFlight.arrival.match(/T(\d{2}:\d{2})/)?.[1];
      if (realArrTime) {
        const flightArrMin = parseTimeStr(realArrTime);
        const arriveCity = arrivingFlight.to_city || day.arrival_city || day.city || "";
        const arrHotelInfo = hotelByCity[arriveCity.toLowerCase()];
        const transferDuration = estimateTransferMinutes(arriveCity, arrHotelInfo?.lat, arrHotelInfo?.lng, airportCoords);
        const pickupMin = flightArrMin + 30; // 30min after landing
        const checkinMin = pickupMin + transferDuration;
        const activitiesStartMin = checkinMin + 60; // 1hr after check-in

        console.log(`[FlightFix] ✈️ Day ${day.day} ARRIVAL: flight=${realArrTime}, pickup=${minutesToTimeStr(pickupMin)}, checkin=${minutesToTimeStr(checkinMin)}, activities_from=${minutesToTimeStr(activitiesStartMin)}`);

        // Update flight arrival activity
        const arrivalAct = acts.find((a: any) =>
          /arrive|arrival|land|✈/i.test(a.activity || "") && !/depart/i.test(a.activity || "")
        );
        if (arrivalAct) arrivalAct.time = realArrTime;

        // Update or INJECT airport pickup/transfer + fix hotel name
        let pickupAct = acts.find((a: any) =>
          /airport.*→|airport.*transfer|pickup|airport.*hotel/i.test(a.activity || "")
        );
        const hotelName = arrHotelInfo?.name || "Hotel";
        if (pickupAct) {
          pickupAct.time = minutesToTimeStr(pickupMin);
          if (hotelName && pickupAct.activity) {
            pickupAct.activity = pickupAct.activity.replace(/→\s*.+$/, `→ ${hotelName}`);
          }
        } else {
          // Inject missing arrival transfer
          pickupAct = {
            activity: `Airport Transfer → ${hotelName}`,
            time: minutesToTimeStr(pickupMin),
            duration_hours: Math.round(transferDuration / 60 * 10) / 10,
            category: "transport",
            cost_estimate: 0,
            description: `Private transfer from airport to ${hotelName} (~${transferDuration} min)`,
          };
          // Insert after arrival activity or at the start
          const arrActIdx = arrivalAct ? acts.indexOf(arrivalAct) : -1;
          acts.splice(arrActIdx + 1, 0, pickupAct);
          console.log(`[FlightFix] 🚗 Injected arrival transfer: Airport → ${hotelName} at ${minutesToTimeStr(pickupMin)}`);
        }

        // Update or INJECT check-in activity
        let checkinAct = acts.find((a: any) => /check.?in/i.test(a.activity || ""));
        if (checkinAct) {
          checkinAct.time = minutesToTimeStr(checkinMin);
        } else {
          checkinAct = {
            activity: `Check-in at ${hotelName}`,
            time: minutesToTimeStr(checkinMin),
            duration_hours: 0.5,
            category: "hotel",
            cost_estimate: 0,
            description: `Check-in and freshen up at ${hotelName}`,
          };
          const pickupIdx = acts.indexOf(pickupAct);
          acts.splice(pickupIdx + 1, 0, checkinAct);
          console.log(`[FlightFix] 🏨 Injected check-in at ${hotelName} at ${minutesToTimeStr(checkinMin)}`);
        }

        // Shift activities to after activitiesStartMin — but cap at 21:00 cutoff
        const MAX_ACTIVITY_END_MIN = 21 * 60; // 21:00 hard cutoff
        const sightseeing = acts.filter((a: any) =>
          !/check.?in|check.?out|transfer|airport|flight|arrive|arrival|depart|✈|hotel/i.test(a.activity || "")
        );

        // If activities can't reasonably fit after arrival, only keep what fits before 21:00
        let nextSlot = activitiesStartMin;
        const keptActivities: any[] = [];
        const droppedActivities: string[] = [];

        for (const act of sightseeing) {
          const dur = getActDurationH(act, 1.5) * 60;
          const actMin = parseTimeStr(act.time);

          // Would this activity end after 21:00?
          const startMin = Math.max(actMin, nextSlot);
          if (startMin + dur > MAX_ACTIVITY_END_MIN) {
            // Activity won't fit — drop it for this day
            droppedActivities.push(act.activity || "Unknown");
            const actIndex = acts.indexOf(act);
            if (actIndex !== -1) acts.splice(actIndex, 1);
            continue;
          }

          if (actMin < activitiesStartMin || actMin < 0) {
            const oldTime = act.time;
            act.time = minutesToTimeStr(nextSlot);
            console.log(`[FlightFix] ⏩ "${act.activity}" shifted ${oldTime} → ${act.time}`);
          }
          const currentMin = parseTimeStr(act.time);
          if (currentMin >= nextSlot) nextSlot = currentMin + dur + 30;
          else nextSlot += dur + 30;
          keptActivities.push(act);
        }

        if (droppedActivities.length > 0) {
          console.log(`[FlightFix] 🗑️ Day ${day.day}: dropped ${droppedActivities.length} activities that wouldn't fit before 21:00 after late arrival: ${droppedActivities.join(", ")}`);
        }

        acts.sort((a: any, b: any) => parseTimeStr(a.time) - parseTimeStr(b.time));
      }
    }

    // ── Remove stale hotel-to-hotel transfers on flight-based transition days ──
    // When airport transfers exist (hotel→airport + airport→hotel), any AI-generated
    // hotel-to-hotel transfer is redundant and should be removed.
    const hasAirportTransfer = acts.some((a: any) => /airport|→.*airport|airport.*→/i.test(a.activity || ""));
    if (hasAirportTransfer) {
      const HOTEL_TO_HOTEL_RX = /^(?!.*airport).*(?:hotel|place|apartment|resort|villa|suite|inn|lodge|residence|court).*→.*(?:hotel|place|apartment|resort|villa|suite|inn|lodge|residence|court)/i;
      for (let ai = acts.length - 1; ai >= 0; ai--) {
        const act = acts[ai];
        const actName = act.activity || "";
        const isAirportLeg = /airport/i.test(actName);
        const isFlightLeg = act.category === "flight" || /✈|\bflight\b|\barriv(?:e|al)\b|\bdepart(?:ure)?\b/i.test(actName);
        const isTransportLike = /transport|transfer|pickup|drop[\s-]?off/i.test(`${act.category || ""} ${actName}`);
        const isStaleHotelHop = HOTEL_TO_HOTEL_RX.test(actName);

        if (!act.product_code && !isAirportLeg && !isFlightLeg && (isStaleHotelHop || (isTransportLike && /→/.test(actName)))) {
          console.log(`[FlightFix] 🗑️ Removing stale hotel-to-hotel transfer on Day ${day.day}: "${actName}"`);
          acts.splice(ai, 1);
        }
      }
    }

    // ── Set departure_city and arrival_city on transition days ──
    if (dayType === "transition" || (departingFlight && arrivingFlight)) {
      if (!day.departure_city && departingFlight) day.departure_city = departingFlight.from_city;
      if (!day.arrival_city && arrivingFlight) day.arrival_city = arrivingFlight.to_city;
    }
    // Detect transition from flight data: departs and arrives same day
    if (departingFlight && departingFlight.arrival?.startsWith(dayDate)) {
      day.departure_city = day.departure_city || departingFlight.from_city;
      day.arrival_city = day.arrival_city || departingFlight.to_city;
      if (!day.day_type && day.departure_city !== day.arrival_city) day.day_type = "transition";
    }
  }
}

// ═══ MAIN HANDLER ═══

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase credentials" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const start = performance.now();
    const body = await req.json();
    const mode = body.mode || "full"; // "prefetch" | "assemble" | "full" (legacy)

    // ═══ MODE: PREFETCH — Start flight + hotel search immediately (no itinerary needed) ═══
    if (mode === "prefetch") {
      const searchParams = body.searchParams || {};
      const currency = body.currency || "USD";
      const progress = createProgressBroadcaster(body.progress_id);
      await new Promise(r => setTimeout(r, 100));
      progress.send(3, "Searching flights & hotels…");

      // Past-Date Protection
      if (searchParams.depart_date) {
        const todayStr = new Date().toISOString().split("T")[0];
        if (searchParams.depart_date < todayStr) {
          const dep = new Date(searchParams.depart_date);
          const now = new Date();
          while (dep <= now) dep.setFullYear(dep.getFullYear() + 1);
          const newDepStr = dep.toISOString().split("T")[0];
          console.log(`[Match/Prefetch] ⏰ Past-date protection: ${searchParams.depart_date} → ${newDepStr}`);
          searchParams.depart_date = newDepStr;
        }
      }

      searchParams.origin_city = body.origin || searchParams.origin_city || "";

      // ── Canonical duration helpers ──
      const getCityNights = (city: any): number => {
        const n = Number(city?.nights);
        if (Number.isFinite(n) && n > 0) return n;
        const d = Number(city?.days);
        if (Number.isFinite(d) && d > 1) return d - 1;
        return 1;
      };
      const getCityDays = (city: any): number => {
        const d = Number(city?.days);
        if (Number.isFinite(d) && d > 0) return d;
        return getCityNights(city) + 1;
      };

      // Build a minimal pseudo-itinerary for flight/hotel search
      const cities: any[] = Array.isArray(searchParams.cities) && searchParams.cities.length > 0
        ? searchParams.cities.map((c: any) => ({ ...c, days: getCityDays(c), nights: getCityNights(c) }))
        : [{ name: searchParams.hotel_city_name || searchParams.destination_city || "", days: searchParams.duration_days || 3, nights: Math.max((searchParams.duration_days || 3) - 1, 1) }];

      // Shared-transition model: each inter-city boundary shares a day
      const rawDays = cities.reduce((s: number, c: any) => s + getCityDays(c), 0);
      const sharedTransitions = Math.max(0, cities.length - 1);
      const totalDays = rawDays - sharedTransitions;
      const pseudoItinerary: any = {
        cities: cities.map((c: any) => ({
          name: c.name, days: getCityDays(c), nights: getCityNights(c),
          preferred_hotel: c.preferred_hotel || "",
          hotel_area: c.hotel_area || "",
        })),
        days: [],
        duration_days: totalDays,
        adults: body.adults || 1,
        children: body.children || 0,
        infants: body.infants || 0,
        travel_connections: body.travel_connections || [],
      };

      // Build pseudo days with dates — shared-transition model:
      // First city gets all its days; subsequent cities skip day 0 (shared with prev city's last day)
      let dateOffset = 0;
      for (let ci = 0; ci < cities.length; ci++) {
        const city = cities[ci];
        const cityDays = city.days || 2;
        const startD = ci === 0 ? 0 : 1; // skip shared transition day for non-first cities
        for (let d = startD; d < cityDays; d++) {
          let dayDate = "";
          if (searchParams.depart_date) {
            const dd = new Date(searchParams.depart_date);
            dd.setDate(dd.getDate() + dateOffset);
            dayDate = dd.toISOString().split("T")[0];
          }
          pseudoItinerary.days.push({ day: dateOffset + 1, city: city.name, date: dayDate, activities: [] });
          dateOffset++;
        }
      }
      console.log(`[Match/Prefetch] 📅 Built ${pseudoItinerary.days.length} pseudo days (totalDays=${totalDays}, shared transitions=${sharedTransitions})`);

      // Build travel_connections from cities if not provided
      if ((!pseudoItinerary.travel_connections || pseudoItinerary.travel_connections.length === 0) && cities.length > 1) {
        const connections: any[] = [];
        // Outbound: origin → first city
        if (searchParams.origin_city) {
          connections.push({ from_city: searchParams.origin_city, to_city: cities[0].name, mode: "flight", day_index: 0 });
        }
        // Inter-city connections — shared-transition model:
        // Transition day is the LAST day of the current city AND the FIRST day of the next city.
        // So we DON'T advance dayIdx past the transition — the next city starts from it.
        let dayIdx = 0;
        for (let i = 0; i < cities.length - 1; i++) {
          const cityDays = cities[i].days || 2;
          dayIdx += cityDays - 1; // last day of current city = transition/departure day
          // Skip same-city connections (e.g., split hotel stays in same city)
          if (cities[i].name.toLowerCase() === cities[i + 1].name.toLowerCase()) {
            // Same city — no shared transition, just advance
            dayIdx += 1;
            continue;
          }
          connections.push({ from_city: cities[i].name, to_city: cities[i + 1].name, mode: "flight", day_index: dayIdx });
          console.log(`[Match/Prefetch] 🔗 Connection ${cities[i].name}→${cities[i + 1].name} at day_index=${dayIdx} (date=${pseudoItinerary.days[dayIdx]?.date || '?'})`);
          // Do NOT advance past transition — next city shares this day
        }
        // Return: last city → origin
        if (searchParams.origin_city) {
          connections.push({ from_city: cities[cities.length - 1].name, to_city: searchParams.origin_city, mode: "flight", day_index: totalDays - 1 });
        }
        pseudoItinerary.travel_connections = connections;
      }

      // Run flight + hotel search in parallel
      const [hotelResult, flightResult] = await Promise.all([
        matchHotels(pseudoItinerary, sb, searchParams, currency),
        matchFlights(pseudoItinerary, sb, searchParams, currency),
      ]);

      const elapsed = Math.round(performance.now() - start);
      console.log(`[Match/Prefetch] ✅ Done in ${elapsed}ms — ${flightResult.selected.length} flights, ${hotelResult.selected.length} hotels`);
      progress.send(4, `Found ${flightResult.allSearchedFlights.length} flights, ${hotelResult.allSearchedHotels.length} hotels`);
      progress.cleanup();

      return new Response(JSON.stringify({
        mode: "prefetch",
        flights: { selected: flightResult.selected, allSearchedFlights: flightResult.allSearchedFlights },
        hotels: { selected: hotelResult.selected, hotelSwapPools: hotelResult.hotelSwapPools, allSearchedHotels: hotelResult.allSearchedHotels },
        timing_ms: elapsed,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ MODE: ACTIVITY-PREFETCH — Search activities using AI-generated titles ═══
    if (mode === "activity-prefetch") {
      const itinerary = body.itinerary;
      const currency = body.currency || "USD";
      const searchParams = body.searchParams || {};

      if (!itinerary || !itinerary.days) {
        return new Response(
          JSON.stringify({ error: "No itinerary provided for activity prefetch" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const bodyAdults = body.adults || itinerary.adults || 1;
      const bodyChildren = body.children || itinerary.children || 0;
      const bodyInfants = body.infants || itinerary.infants || 0;

      const travelerProfile: TravelerProfile = {
        hasInfants: bodyInfants > 0,
        hasChildren: bodyChildren > 0,
        hasSeniors: false,
        travelStyle: searchParams?.travel_style,
      };

      const progress = createProgressBroadcaster(body.progress_id);
      await new Promise(r => setTimeout(r, 100));
      progress.send(4, "Searching activities & experiences…");

      console.log(`[Match/ActivityPrefetch] 🔍 Searching activities for ${itinerary.days.length} days`);
      const activityResult = await matchActivities(itinerary, sb, currency, travelerProfile);

      const elapsed = Math.round(performance.now() - start);
      console.log(`[Match/ActivityPrefetch] ✅ Done in ${elapsed}ms — ${activityResult.stats.matched}/${activityResult.stats.matched + activityResult.stats.unmatched} matched`);
      progress.send(5, `Found ${activityResult.allSearchedActivities.length} activities`);
      progress.cleanup();

      return new Response(JSON.stringify({
        mode: "activity-prefetch",
        activityResult: {
          matches: activityResult.matches,
          stats: activityResult.stats,
          searchTermsByCity: activityResult.searchTermsByCity,
          totalProductsByCity: activityResult.totalProductsByCity,
          swapPools: activityResult.swapPools,
          allSearchedActivities: activityResult.allSearchedActivities,
        },
        timing_ms: elapsed,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ MODE: ASSEMBLE — Itinerary + pre-fetched flight/hotel/activity data → assemble + AI review ═══
    if (mode === "assemble") {
      const itinerary = body.itinerary;
      const searchParams = body.searchParams || {};
      const currency = body.currency || "USD";
      const debugMode = body.debug_mode || false;
      const prefetchedFlights = body.prefetchedFlights || { selected: [], allSearchedFlights: [] };
      const prefetchedHotels = body.prefetchedHotels || { selected: [], hotelSwapPools: {}, allSearchedHotels: [] };
      const prefetchedActivities = body.prefetchedActivities || null;

      if (!itinerary || !itinerary.days) {
        return new Response(
          JSON.stringify({ error: "No itinerary provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const bodyAdults = body.adults || itinerary.adults || 1;
      const bodyChildren = body.children || itinerary.children || 0;
      const bodyInfants = body.infants || itinerary.infants || 0;
      const travelers = bodyAdults + bodyChildren;

      itinerary.adults = bodyAdults;
      itinerary.children = bodyChildren;
      itinerary.infants = bodyInfants;

      // ── Duration clamp: enforce requested trip length ──
      const normNights = (city: any): number => {
        const n = Number(city?.nights);
        if (Number.isFinite(n) && n > 0) return n;
        const d = Number(city?.days);
        if (Number.isFinite(d) && d > 1) return d - 1;
        return 1;
      };

      // Use searchParams.cities as authoritative source
      if (Array.isArray(searchParams.cities) && searchParams.cities.length > 0) {
        itinerary.cities = searchParams.cities.map((city: any) => ({
          ...city,
          nights: normNights(city),
          days: Number(city?.days) > 0 ? Number(city.days) : normNights(city) + 1,
        }));
      }

      const requestedDuration = Array.isArray(searchParams.cities) && searchParams.cities.length > 0
        ? searchParams.cities.reduce((sum: number, city: any) => sum + normNights(city), 0) + 1
        : Number(searchParams.duration_days || itinerary.duration_days || itinerary.days?.length || 1);

      if (requestedDuration > 0 && itinerary.days?.length > requestedDuration) {
        console.log(`[Match/Assemble] ✂️ Clamping itinerary days ${itinerary.days.length} → ${requestedDuration}`);
        itinerary.days = itinerary.days.slice(0, requestedDuration);
        itinerary.duration_days = requestedDuration;
        itinerary.days.forEach((day: any, idx: number) => { day.day = idx + 1; });
      } else if (requestedDuration > 0) {
        itinerary.duration_days = requestedDuration;
      }

      // Build cities from days if missing
      if (!itinerary.cities || itinerary.cities.length === 0) {
        const cityMap = new Map<string, number>();
        for (const day of itinerary.days) {
          const city = (day.city || "").trim();
          if (!city) continue;
          cityMap.set(city, (cityMap.get(city) || 0) + 1);
        }
        const cityEntries = [...cityMap.entries()];
        itinerary.cities = cityEntries.map(([name, dayCount], idx) => {
          const nights = idx === cityEntries.length - 1 ? Math.max(1, dayCount - 1) : dayCount;
          return { name, days: dayCount, nights, preferred_hotel: "", hotel_area: "" };
        });
      }

      const travelerProfile: TravelerProfile = {
        hasInfants: bodyInfants > 0,
        hasChildren: bodyChildren > 0,
        hasSeniors: false,
        travelStyle: searchParams?.travel_style,
      };

      const progress = createProgressBroadcaster(body.progress_id);
      await new Promise(r => setTimeout(r, 100));
      progress.send(4, "Matching activities & experiences…");

      // Past-date protection on itinerary days
      if (searchParams.depart_date) {
        const todayStr = new Date().toISOString().split("T")[0];
        if (searchParams.depart_date < todayStr) {
          const dep = new Date(searchParams.depart_date);
          const now = new Date();
          while (dep <= now) dep.setFullYear(dep.getFullYear() + 1);
          searchParams.depart_date = dep.toISOString().split("T")[0];
        }
        if (itinerary.days) {
          const todayCheck = new Date().toISOString().split("T")[0];
          for (const day of itinerary.days) {
            if (day.date && day.date < todayCheck) {
              const d = new Date(day.date);
              const now = new Date();
              while (d <= now) d.setFullYear(d.getFullYear() + 1);
              day.date = d.toISOString().split("T")[0];
            }
          }
        }
      }

      const hasPreActivities = prefetchedActivities && prefetchedActivities.matches;
      const hasPreFlights = prefetchedFlights.selected.length > 0;
      const hasPreHotels = prefetchedHotels.selected.length > 0;
      console.log(`[Match/Assemble] 🔍 ${itinerary.days.length} days, ${itinerary.cities?.length || 0} cities | ${bodyAdults}a+${bodyChildren}c+${bodyInfants}i | Pre-fetched: ${prefetchedFlights.selected.length} flights, ${prefetchedHotels.selected.length} hotels, activities=${hasPreActivities ? 'YES' : 'searching...'}`);

      // Fallback: if no pre-fetched flights/hotels, search live now
      let flightResult: any = { selected: prefetchedFlights.selected, allSearchedFlights: prefetchedFlights.allSearchedFlights };
      let hotelResult: any = { selected: prefetchedHotels.selected, hotelSwapPools: prefetchedHotels.hotelSwapPools, allSearchedHotels: prefetchedHotels.allSearchedHotels };

      if (!hasPreFlights || !hasPreHotels) {
        console.log(`[Match/Assemble] 🔄 No pre-fetched ${!hasPreFlights ? 'flights' : ''}${!hasPreFlights && !hasPreHotels ? ' & ' : ''}${!hasPreHotels ? 'hotels' : ''} — searching live...`);
        const liveSearches: Promise<any>[] = [];
        if (!hasPreHotels) liveSearches.push(matchHotels(itinerary, sb, searchParams, currency));
        else liveSearches.push(Promise.resolve(null));
        if (!hasPreFlights) liveSearches.push(matchFlights(itinerary, sb, searchParams, currency));
        else liveSearches.push(Promise.resolve(null));

        const [liveHotelResult, liveFlightResult] = await Promise.all(liveSearches);
        if (liveHotelResult) {
          hotelResult = liveHotelResult;
          console.log(`[Match/Assemble] 🏨 Live hotel search: ${hotelResult.selected.length} selected, ${hotelResult.allSearchedHotels.length} total`);
        }
        if (liveFlightResult) {
          flightResult = liveFlightResult;
          console.log(`[Match/Assemble] ✈️ Live flight search: ${flightResult.selected.length} selected, ${flightResult.allSearchedFlights.length} total`);
        }
      }

      // Use pre-fetched activities if available, otherwise search now
      const activityResult = hasPreActivities
        ? prefetchedActivities
        : await matchActivities(itinerary, sb, currency, travelerProfile);

      const flightMatches: FlightMatch[] = flightResult.selected;
      const allSearchedFlights: any[] = flightResult.allSearchedFlights;
      const hotelMatches: HotelMatch[] = hotelResult.selected;
      const hotelSwapPools = hotelResult.hotelSwapPools;
      const allSearchedHotels: any[] = hotelResult.allSearchedHotels;

      // Replace AI hotel suggestions with actually-picked hotels
      for (const hm of hotelMatches) {
        const cityData = itinerary.cities?.find((c: any) => c.name === hm.city);
        if (cityData?.preferred_hotel && hm.name) {
          console.log(`[Match/Assemble] 🏨 Replacing AI hotel "${cityData.preferred_hotel}" with picked "${hm.name}" in ${hm.city}`);
        }
      }

      const matchElapsed = Math.round(performance.now() - start);
      console.log(`[Match/Assemble] ✅ Activities matched in ${matchElapsed}ms — ${activityResult.stats.matched}/${activityResult.stats.matched + activityResult.stats.unmatched}`);

      const exchangeRates = await loadExchangeRates();
      const enrichedItinerary = applyMatches(
        itinerary, activityResult.matches, hotelMatches, flightMatches, currency, travelers, exchangeRates,
      );
      const airportCoordsMap = await buildAirportCoordsMapFromIataMap(
        sb,
        buildIataMapFromFlights(flightMatches),
        "[Match/Assemble]",
      );

      // Flight-Aware Time Adjustment
      resolveFlightTimingConflicts(enrichedItinerary, flightMatches, airportCoordsMap);

      // AI Review Pass — inlined quality layer
      progress.send(5, "AI reviewing your itinerary…");
      let qualityResult: any = null;
      try {
        const flightCtx = flightMatches
          .filter(f => f.price > 0)
          .sort((a, b) => (a.totalPrice || a.price || 0) - (b.totalPrice || b.price || 0))
          .slice(0, 3)
          .map(f => ({ leg: f.leg_type, route: `${f.from_city} → ${f.to_city}`, airline: f.airline || "", departure: f.departure || "", arrival: f.arrival || "", price: f.totalPrice || f.price || 0 }));
        const hotelCtx = hotelMatches
          .sort((a, b) => (b.stars || 0) - (a.stars || 0))
          .slice(0, 3)
          .map(h => ({ city: h.city, name: h.name, stars: h.stars, price_per_night: h.price_per_night, nights: h.nights }));
        const actCtx = (() => {
          const byDay: Record<number, any[]> = {};
          for (const m of activityResult.matches.filter((m: any) => m.matched && m.product_code)) {
            const d = m.dayIdx ?? 0;
            if (!byDay[d]) byDay[d] = [];
            byDay[d].push(m);
          }
          const top: any[] = [];
          for (const [_, items] of Object.entries(byDay)) {
            items.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
            top.push(...items.slice(0, 3));
          }
          return top.map((m: any) => ({ day: (m.dayIdx ?? 0) + 1, title: m.title, product_name: m.product_name || m.title, product_code: m.product_code, price: m.price || 0, currency: m.currency || currency, duration_hours: m.duration_hours || null, city: m.city || "" }));
        })();
        qualityResult = await runQualityLayer(enrichedItinerary, {
          adults: bodyAdults, children: bodyChildren, infants: bodyInfants, travel_style: searchParams?.travel_style,
        }, { flightContext: flightCtx, hotelContext: hotelCtx, activityContext: actCtx });
        console.log(`[Match/Assemble] 🛡️ Quality: confidence=${qualityResult.confidence}, issues=${qualityResult.issues?.length || 0}`);
      } catch (qErr: any) {
        console.warn(`[Match/Assemble] Quality layer error: ${qErr.message}`);
      }

      progress.send(6, "Finalizing your personalized itinerary…");

      const finalItinerary = qualityResult?.itinerary || enrichedItinerary;
      const totalElapsed = Math.round(performance.now() - start);

      const response: any = {
        itinerary: finalItinerary,
        liveData: {
          flightsFound: flightMatches.filter(f => f.price > 0).length,
          hotelsFound: hotelMatches.length,
          activitiesFound: activityResult.stats.matched,
        },
        matchReport: {
          activities: activityResult.stats,
          hotels: { matched: hotelMatches.length },
          flights: { matched: flightMatches.filter(f => f.price > 0).length, total: flightMatches.length, live: flightMatches.filter(f => f.is_live_price).length },
          timing_ms: totalElapsed, match_ms: matchElapsed,
          _timing: { total_ms: totalElapsed, match_ms: matchElapsed, activity_freetext_ms: activityResult._timing?.phase1_freetext_ms || 0 },
        },
        activitySearchTerms: activityResult.searchTermsByCity,
        totalProductsByCity: activityResult.totalProductsByCity,
        activitySwapPools: activityResult.swapPools,
        hotelSwapPools,
        allSearchedActivities: activityResult.allSearchedActivities,
        allSearchedHotels,
        allSearchedFlights,
      };

      if (qualityResult) {
        response.quality = {
          confidence: qualityResult.confidence,
          issues_found: qualityResult.issues?.length || 0,
          issues_repaired: qualityResult.issues?.filter((i: any) => i.repaired).length || 0,
          critical_unrepaired: qualityResult.issues?.filter((i: any) => i.severity === "critical" && !i.repaired).length || 0,
        };
      }

      if (debugMode) {
        response.debug = {
          traveler_profile: travelerProfile,
          quality_issues: qualityResult?.issues || [],
          contract_violations: qualityResult?.contractViolations || [],
        };
      }

      progress.cleanup();
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ MODE: FULL (legacy) — Original behavior for backward compat ═══
    const itinerary = body.itinerary;
    const searchParams = body.searchParams || {};
    const currency = body.currency || "USD";
    const debugMode = body.debug_mode || false;

    if (!itinerary || !itinerary.days) {
      return new Response(
        JSON.stringify({ error: "No itinerary provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bodyAdults = body.adults || itinerary.adults || 1;
    const bodyChildren = body.children || itinerary.children || 0;
    const bodyInfants = body.infants || itinerary.infants || 0;
    const travelers = bodyAdults + bodyChildren;

    itinerary.adults = bodyAdults;
    itinerary.children = bodyChildren;
    itinerary.infants = bodyInfants;

    if (!itinerary.cities || itinerary.cities.length === 0) {
      const cityMap = new Map<string, number>();
      for (const day of itinerary.days) {
        const city = (day.city || "").trim();
        if (!city) continue;
        cityMap.set(city, (cityMap.get(city) || 0) + 1);
      }
      const cityEntries = [...cityMap.entries()];
      itinerary.cities = cityEntries.map(([name, dayCount], idx) => {
        const nights = idx === cityEntries.length - 1 ? Math.max(1, dayCount - 1) : dayCount;
        const hotelSuggestion = (itinerary.selected_hotels || []).find(
          (h: any) => (h.city || "").toLowerCase() === name.toLowerCase()
        );
        return {
          name, days: dayCount, nights,
          preferred_hotel: hotelSuggestion?.name || hotelSuggestion?.preferred_hotel || "",
          hotel_area: hotelSuggestion?.hotel_area || "",
        };
      });
    }

    const travelerProfile: TravelerProfile = {
      hasInfants: bodyInfants > 0,
      hasChildren: bodyChildren > 0,
      hasSeniors: false,
      travelStyle: searchParams?.travel_style,
    };

    console.log(`[Match] 🔍 V2 matching (legacy full mode): ${itinerary.days.length} days, ${itinerary.cities?.length || 0} cities | ${bodyAdults}a+${bodyChildren}c+${bodyInfants}i`);

    const progress = createProgressBroadcaster(body.progress_id);
    await new Promise(r => setTimeout(r, 200));
    progress.send(3, "Searching activities & experiences…");

    searchParams.depart_date = body.startDate || searchParams.depart_date || "";
    searchParams.origin_city = body.origin || searchParams.origin_city || "";

    // Past-Date Protection
    if (searchParams.depart_date) {
      const todayStr = new Date().toISOString().split("T")[0];
      if (searchParams.depart_date < todayStr) {
        const dep = new Date(searchParams.depart_date);
        const now = new Date();
        while (dep <= now) {
          dep.setFullYear(dep.getFullYear() + 1);
        }
        const newDepStr = dep.toISOString().split("T")[0];
        console.log(`[Match] ⏰ Past-date protection: ${searchParams.depart_date} → ${newDepStr} (year shift)`);
        searchParams.depart_date = newDepStr;

        if (itinerary.days) {
          for (const day of itinerary.days) {
            if (day.date && day.date < todayStr) {
              const d = new Date(day.date);
              while (d <= now) d.setFullYear(d.getFullYear() + 1);
              day.date = d.toISOString().split("T")[0];
            }
          }
        }
      }
    }

    // All searches run server-side in parallel
    progress.send(4, "Searching flights, hotels & activities…");
    const [activityResult, hotelResult, flightResult] = await Promise.all([
      matchActivities(itinerary, sb, currency, travelerProfile),
      matchHotels(itinerary, sb, searchParams, currency),
      matchFlights(itinerary, sb, searchParams, currency),
    ]);

    const hotelMatches = hotelResult.selected;
    const hotelSwapPools = hotelResult.hotelSwapPools;
    const allSearchedHotels = hotelResult.allSearchedHotels;

    const flightMatches = flightResult.selected;
    const allSearchedFlights = flightResult.allSearchedFlights;

    const matchElapsed = Math.round(performance.now() - start);
    console.log(`[Match] ✅ Done in ${matchElapsed}ms — Activities: ${activityResult.stats.matched}/${activityResult.stats.matched + activityResult.stats.unmatched} | Flights: ${flightMatches.filter(f => f.is_live_price).length} live`);

    const exchangeRates = await loadExchangeRates();
    const enrichedItinerary = applyMatches(
      itinerary, activityResult.matches, hotelMatches, flightMatches, currency, travelers, exchangeRates,
    );
    const airportCoordsMap = await buildAirportCoordsMapFromIataMap(
      sb,
      buildIataMapFromFlights(flightMatches),
      "[Match]",
    );

    resolveFlightTimingConflicts(enrichedItinerary, flightMatches, airportCoordsMap);

    // Quality layer (inlined)
    progress.send(5, "Running quality checks…");
    let qualityResult: any = null;
    try {
      qualityResult = await runQualityLayer(enrichedItinerary, {
        adults: bodyAdults, children: bodyChildren, infants: bodyInfants, travel_style: searchParams?.travel_style,
      });
      console.log(`[Match] 🛡️ Quality: confidence=${qualityResult.confidence}, issues=${qualityResult.issues?.length || 0}`);
    } catch (qErr: any) {
      console.warn(`[Match] Quality layer error: ${qErr.message}`);
    }

    // ── Resolve transfers (backend) after flights + hotels are matched ──
    progress.send(6, "Resolving ground transfers…");
    let resolvedTransfers: any[] = [];
    try {
      const transferNeeds = buildTransferNeeds(qualityResult?.itinerary || enrichedItinerary, hotelMatches, flightMatches, airportCoordsMap);
      if (transferNeeds.length > 0) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const tRes = await fetch(`${supabaseUrl}/functions/v1/resolve-transfers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            transfers: transferNeeds,
            currency,
            available_products: activityResult.allSearchedActivities || [],
          }),
        });
        if (tRes.ok) {
          const tData = await tRes.json();
          resolvedTransfers = tData?.transfers || [];
          console.log(`[Match] 🚗 Transfers resolved: ${resolvedTransfers.length} (${tData?.cache_hits || 0} cached, ${tData?.estimation_count || 0} estimated)`);
        }
      }
    } catch (trErr: any) {
      console.warn(`[Match] Transfer resolution error: ${trErr.message}`);
    }

    progress.send(7, "Finalizing your personalized itinerary…");

    const finalItinerary = qualityResult?.itinerary || enrichedItinerary;
    const totalElapsed = Math.round(performance.now() - start);

    const response: any = {
      itinerary: finalItinerary,
      liveData: {
        flightsFound: flightMatches.filter(f => f.price > 0).length,
        hotelsFound: hotelMatches.length,
        activitiesFound: activityResult.stats.matched,
      },
      matchReport: {
        activities: activityResult.stats,
        hotels: { matched: hotelMatches.length },
        flights: { matched: flightMatches.filter(f => f.price > 0).length, total: flightMatches.length, live: flightMatches.filter(f => f.is_live_price).length },
        timing_ms: totalElapsed, match_ms: matchElapsed,
        _timing: { total_ms: totalElapsed, match_ms: matchElapsed, activity_freetext_ms: activityResult._timing?.phase1_freetext_ms || 0 },
      },
      activitySearchTerms: activityResult.searchTermsByCity,
      totalProductsByCity: activityResult.totalProductsByCity,
      activitySwapPools: activityResult.swapPools,
      hotelSwapPools,
      allSearchedActivities: activityResult.allSearchedActivities,
      allSearchedHotels,
      allSearchedFlights,
      resolvedTransfers,
    };

    if (qualityResult) {
      response.quality = {
        confidence: qualityResult.confidence,
        issues_found: qualityResult.issues?.length || 0,
        issues_repaired: qualityResult.issues?.filter((i: any) => i.repaired).length || 0,
        critical_unrepaired: qualityResult.issues?.filter((i: any) => i.severity === "critical" && !i.repaired).length || 0,
      };
    }

    if (debugMode) {
      response.debug = {
        traveler_profile: travelerProfile,
        quality_issues: qualityResult?.issues || [],
        contract_violations: qualityResult?.contractViolations || [],
      };
    }

    progress.cleanup();
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[Match] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
