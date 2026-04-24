// Flight Insights Engine — AI-powered fare insights + AI Pick reranking.
// Uses the shared admin-controlled AI router (task: "flight-insights").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runAITask } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FlightShortlistItem {
  id: string;
  airline: string;
  price: number;
  duration_min: number;
  stops: number;
  cabin_baggage?: string;
  checkin_baggage?: string;
  refundable?: boolean;
  layover_codes?: string[];
}

interface InsightsRequest {
  from_code: string;
  to_code: string;
  depart_date?: string;
  return_date?: string;
  current_min_price?: number;
  current_avg_price?: number;
  currency?: string;
  results_count?: number;
  cabin_class?: string;
  trip_type?: string;
  // Optional shortlist: if provided, AI will rerank and pick winner
  shortlist?: FlightShortlistItem[];
}

interface RouteInsight {
  common_route: string;        // "Most flights have 1 stop via Doha or Dubai"
  shortest_avg_duration: string; // "11h 30m"
  cheaper_dates?: { date: string; price: number; delta_pct: number }[];
}

interface AdvisorEvidence {
  icon: "price" | "time" | "comfort" | "stops" | "baggage" | "refund" | "ontime" | "trend";
  label: string;
  detail?: string;
  tone?: "good" | "neutral" | "warn";
}

interface AdvisorPayload {
  lead: string;
  verdict: { label: string; tone: "good" | "neutral" | "warn" };
  evidence: AdvisorEvidence[];
  action?: { label: string; kind: "book_now" | "hold" | "shift_dates" | "compare" };
}

interface InsightOutput {
  headline: string;
  recommendation: string;
  confidence: "low" | "medium" | "high";
  price_verdict: "great_deal" | "fair" | "above_average" | "unknown";
  trend_direction: "up" | "down" | "stable" | "unknown";
  trend_sparkline: number[];
  trend_dates: string[];
  predicted_change_pct: number;
  best_book_window: string;
  fare_alerts: string[];
  ai_pick_id?: string;             // ID of recommended flight from shortlist
  ai_pick_rationale?: string;      // Why it's recommended (legacy single-string)
  ai_pick_value_delta_pct?: number; // e.g. "9% more value than cheapest"
  smart_tip?: AdvisorPayload;       // NEW: structured Smart Tip for right rail
  pick_advisor?: AdvisorPayload;    // NEW: structured Why-pick for flight card
  route_insight?: RouteInsight;
  urgency?: { level: "low" | "medium" | "high"; message: string };
  trust_signals?: string[];
  generated_at: string;
  source: "ai" | "heuristic" | "cache";
}

function makeCacheKey(r: InsightsRequest): string {
  // Stable signature of the AI input: top-12 cheapest flights' airline+price+stops.
  // Two searches with the same route/date/currency and ~same market will hit cache.
  const sig = (r.shortlist || [])
    .slice()
    .sort((a, b) => a.price - b.price)
    .slice(0, 12)
    .map((f) => `${(f.airline || "").slice(0, 3)}${Math.round(f.price)}${f.stops}`)
    .join("-");
  return [
    r.from_code,
    r.to_code,
    r.depart_date || "any",
    r.return_date || "ow",
    r.cabin_class || "any",
    r.currency || "USD",
    sig || "ns",
  ].join(":");
}

function pctChange(now: number, base: number): number {
  if (!base || base <= 0) return 0;
  return Math.round(((now - base) / base) * 100);
}

async function fetchTrends(
  supabase: any,
  from: string,
  to: string,
  depart?: string,
  currency?: string
) {
  let q = supabase
    .from("flight_price_trends")
    .select("sample_date, depart_date, min_price, avg_price, sample_count, currency")
    .eq("from_code", from)
    .eq("to_code", to)
    .order("sample_date", { ascending: false })
    .limit(60);
  if (depart) q = q.eq("depart_date", depart);
  if (currency) q = q.eq("currency", currency);
  const { data, error } = await q;
  if (error) {
    console.error("[flight-insights] fetchTrends error:", error.message);
    return [];
  }
  return data || [];
}

async function fetchCheaperDates(
  supabase: any,
  from: string,
  to: string,
  depart: string,
  currency: string,
  currentMin: number
): Promise<{ date: string; price: number; delta_pct: number }[]> {
  if (!depart || !currentMin) return [];
  try {
    const dt = new Date(depart);
    const start = new Date(dt); start.setDate(dt.getDate() - 3);
    const end = new Date(dt); end.setDate(dt.getDate() + 3);
    const { data } = await supabase
      .from("flight_price_cache")
      .select("travel_date, lowest_price, currency")
      .eq("from_code", from)
      .eq("to_code", to)
      .gte("travel_date", start.toISOString().slice(0, 10))
      .lte("travel_date", end.toISOString().slice(0, 10))
      .order("lowest_price", { ascending: true })
      .limit(20);
    return (data || [])
      .filter((r: any) => r.travel_date !== depart && r.lowest_price && r.lowest_price > 0)
      .filter((r: any) => !currency || (r.currency || "USD") === currency)
      .map((r: any) => ({
        date: r.travel_date,
        price: Number(r.lowest_price),
        delta_pct: pctChange(Number(r.lowest_price), currentMin),
      }))
      .filter((r: any) => r.delta_pct < -3) // only show if at least 3% cheaper
      .slice(0, 3);
  } catch (e) {
    console.warn("[flight-insights] cheaper dates failed:", (e as Error).message);
    return [];
  }
}

function rankShortlistHeuristic(shortlist: FlightShortlistItem[]): FlightShortlistItem[] {
  if (!shortlist?.length) return [];
  const minPrice = Math.min(...shortlist.map((f) => f.price)) || 1;
  const minDur = Math.min(...shortlist.map((f) => f.duration_min)) || 1;
  const score = (f: FlightShortlistItem) => {
    const priceScore = (f.price / minPrice) * 50; // lower is better
    const durScore = (f.duration_min / minDur) * 25;
    const stopPenalty = f.stops * 8;
    const baggageBoost = f.checkin_baggage && /\d/.test(f.checkin_baggage) ? -3 : 0;
    const refundBoost = f.refundable ? -2 : 0;
    return priceScore + durScore + stopPenalty + baggageBoost + refundBoost;
  };
  return [...shortlist].sort((a, b) => score(a) - score(b)).slice(0, 5);
}

// Known carrier names AI commonly hallucinates. We check if the rationale mentions
// any of these BUT none of the actual shortlist airlines match — that's a hallucination.
const KNOWN_AIRLINES_REGEX = /\b(biman|emirates|qatar(?:\s+airways)?|etihad|singapore\s+airlines|thai\s+airways?|malaysia\s+airlines|air\s+india|indigo|vistara|spicejet|us[\s-]?bangla|novoair|air\s+arabia|flydubai|saudia?|turkish\s+airlines?|lufthansa|british\s+airways|klm|air\s+france|cathay(?:\s+pacific)?|ana|jal|china\s+(?:southern|eastern)|xiamen|shenzhen\s+airlines)\b/gi;

function detectUnknownAirline(rationale: string, shortlist: FlightShortlistItem[]): boolean {
  if (!rationale) return false;
  const shortlistAirlines = shortlist.map((f) => String(f.airline || "").toLowerCase().trim()).filter(Boolean);
  if (shortlistAirlines.length === 0) return false;
  const matches = rationale.match(KNOWN_AIRLINES_REGEX);
  if (!matches) return false;
  for (const m of matches) {
    const norm = m.toLowerCase().replace(/\s+/g, " ").trim();
    const inShortlist = shortlistAirlines.some((a) => {
      const aNorm = a.replace(/\s+/g, " ");
      return aNorm.includes(norm) || norm.includes(aNorm) ||
        // handle "us bangla" vs "us-bangla airlines"
        aNorm.replace(/[-\s]/g, "").includes(norm.replace(/[-\s]/g, "")) ||
        norm.replace(/[-\s]/g, "").includes(aNorm.replace(/[-\s]/g, ""));
    });
    if (!inShortlist) return true;
  }
  return false;
}

function buildHeuristic(req: InsightsRequest, trends: any[]): InsightOutput {
  const now = req.current_min_price || 0;
  // Mirror the calendar's freshness-first logic: for each depart_date, keep
  // only the freshest sample_date, and within that day pick the lowest price.
  // This guarantees calendar + trend insights read the same numbers.
  const freshestByDepart = new Map<string, { sample_date: string; min_price: number }>();
  for (const r of trends) {
    const dep = String(r.depart_date || "");
    const sd = String(r.sample_date || "");
    const mp = Number(r.min_price) || 0;
    if (!dep || !sd || mp <= 0) continue;
    const cur = freshestByDepart.get(dep);
    if (!cur || sd > cur.sample_date || (sd === cur.sample_date && mp < cur.min_price)) {
      freshestByDepart.set(dep, { sample_date: sd, min_price: mp });
    }
  }
  const sortedAsc = Array.from(freshestByDepart.entries())
    .map(([depart_date, v]) => ({ depart_date, sample_date: v.sample_date, min_price: v.min_price }))
    .sort((a, b) => a.depart_date.localeCompare(b.depart_date));
  const sparkline = sortedAsc.slice(-14).map((t) => t.min_price);
  const dates = sortedAsc.slice(-14).map((t) => t.depart_date);
  const avgHistorical =
    sparkline.length > 0
      ? sparkline.reduce((s, v) => s + v, 0) / sparkline.length
      : now;
  const change = pctChange(now, avgHistorical);

  let verdict: InsightOutput["price_verdict"] = "unknown";
  let headline = "Live fares for your route";
  let recommendation = "Compare options below to find the best fit.";
  let confidence: InsightOutput["confidence"] = "low";

  if (sparkline.length >= 5 && now > 0) {
    confidence = sparkline.length >= 10 ? "high" : "medium";
    if (change <= -10) {
      verdict = "great_deal";
      headline = `Prices are ${Math.abs(change)}% lower than usual`;
      recommendation = "Great time to book — fares are below the typical range.";
    } else if (change >= 15) {
      verdict = "above_average";
      headline = `Prices are ${change}% higher than usual`;
      recommendation = "Consider flexible dates — this week is pricier than usual.";
    } else {
      verdict = "fair";
      headline = "Prices are in the typical range";
      recommendation = "Fair pricing — book when you find a fit.";
    }
  } else if (now > 0) {
    headline = `Lowest fare from ${req.currency || "USD"} ${Math.round(now)}`;
    recommendation = "Limited price history — compare carriers below.";
  }

  let trendDir: InsightOutput["trend_direction"] = "unknown";
  if (sparkline.length >= 4) {
    const half = Math.floor(sparkline.length / 2);
    const earlyAvg = sparkline.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(half, 1);
    const lateAvg = sparkline.slice(half).reduce((s, v) => s + v, 0) / Math.max(sparkline.length - half, 1);
    const diff = pctChange(lateAvg, earlyAvg);
    if (diff > 4) trendDir = "up";
    else if (diff < -4) trendDir = "down";
    else trendDir = "stable";
  }

  const alerts: string[] = [];
  let urgency: InsightOutput["urgency"] = { level: "low", message: "Plenty of availability" };
  if ((req.results_count || 0) > 0 && (req.results_count || 0) < 6) {
    alerts.push(`Only ${req.results_count} options on this route`);
    urgency = { level: "high", message: `Only ${req.results_count} options left` };
  } else if (verdict === "great_deal") {
    urgency = { level: "medium", message: "Great deal — book before it goes" };
  } else if (trendDir === "up") {
    urgency = { level: "medium", message: "Fares trending upward this week" };
  }
  if (verdict === "great_deal") alerts.push("Best time to book now");
  if (trendDir === "up") alerts.push("Fares trending upward");

  return {
    headline,
    recommendation,
    confidence,
    price_verdict: verdict,
    trend_direction: trendDir,
    trend_sparkline: sparkline,
    trend_dates: dates,
    predicted_change_pct: trendDir === "up" ? 5 : trendDir === "down" ? -5 : 0,
    best_book_window: verdict === "great_deal" || trendDir === "up" ? "now" : "within 7 days",
    fare_alerts: alerts,
    urgency,
    trust_signals: [
      "Live fares from multiple GDS partners",
      "Fare verified before payment",
      "24/7 booking support",
    ],
    generated_at: new Date().toISOString(),
    source: "heuristic",
  };
}

function buildRouteInsight(shortlist: FlightShortlistItem[]): RouteInsight | undefined {
  if (!shortlist?.length) return undefined;
  // Most common stop count + layover hubs
  const stopCounts: Record<number, number> = {};
  const hubs: Record<string, number> = {};
  let totalDur = 0;
  let durCount = 0;
  for (const f of shortlist) {
    stopCounts[f.stops] = (stopCounts[f.stops] || 0) + 1;
    if (f.duration_min > 0) { totalDur += f.duration_min; durCount++; }
    (f.layover_codes || []).forEach((c) => { if (c) hubs[c] = (hubs[c] || 0) + 1; });
  }
  const dominantStops = Number(Object.entries(stopCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 0);
  const topHubs = Object.entries(hubs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
  const fastest = Math.min(...shortlist.map((f) => f.duration_min).filter((m) => m > 0));
  const fastestStr = fastest > 0 ? `${Math.floor(fastest / 60)}h ${fastest % 60}m` : "—";

  const stopsLabel = dominantStops === 0 ? "non-stop" : `${dominantStops} stop${dominantStops > 1 ? "s" : ""}`;
  const hubLabel = topHubs.length ? ` via ${topHubs.join(" or ")}` : "";
  return {
    common_route: `Most flights are ${stopsLabel}${hubLabel}`,
    shortest_avg_duration: fastestStr,
  };
}

async function enrichWithAI(
  base: InsightOutput,
  req: InsightsRequest,
  trends: any[],
  shortlist: FlightShortlistItem[]
): Promise<InsightOutput> {
  try {
    const shortlistJson = shortlist.length
      ? shortlist.map((f, i) => ({
          rank: i + 1,
          id: f.id,
          airline: f.airline,
          price: f.price,
          duration_h: +(f.duration_min / 60).toFixed(1),
          stops: f.stops,
          baggage_kg: f.checkin_baggage || "—",
          refundable: f.refundable || false,
          layovers: f.layover_codes || [],
        }))
      : null;

    const cheapest = shortlist.length ? [...shortlist].sort((a, b) => a.price - b.price)[0] : null;
    const fastest = shortlist.length ? [...shortlist].sort((a, b) => a.duration_min - b.duration_min)[0] : null;

    const allowedAirlines = Array.from(
      new Set(shortlist.map((f) => String(f.airline || "").trim()).filter(Boolean))
    );

    // Sanity: only trust historical % when we have enough same-currency samples AND the
    // delta is realistic (mixed-currency / sparse data can produce 70%+ swings — those are noise).
    const sameCurTrends = trends.filter(
      (t: any) => !req.currency || (t.currency || "USD") === req.currency
    );
    const avgHistorical =
      sameCurTrends.length >= 5
        ? sameCurTrends.reduce((s, t) => s + Number(t.avg_price || 0), 0) / sameCurTrends.length
        : 0;
    const liveLow = req.current_min_price || 0;
    const rawPct = avgHistorical > 0 && liveLow > 0
      ? Math.round(((liveLow - avgHistorical) / avgHistorical) * 100)
      : 0;
    // Guard: clamp implausible swings (>50%) to "unknown" — likely sparse data, not real signal.
    const trustHistorical = Math.abs(rawPct) <= 50 && sameCurTrends.length >= 5;
    const pctVsAvg = trustHistorical ? rawPct : 0;
    const dayOfWeek = req.depart_date ? new Date(req.depart_date).toLocaleDateString("en-US", { weekday: "long" }) : "";
    const tripContext = req.trip_type === "roundtrip" ? "roundtrip" : "one-way";

    const prompt = `You are Vela — a senior travel advisor speaking to one traveler. Recommend the best-value flight from the shortlist and explain it like a trusted friend who happens to be a 20-year industry veteran. Plain, warm, specific.

ROUTE CONTEXT
• ${req.from_code} → ${req.to_code} (${tripContext})
• Departs: ${req.depart_date || "flexible"}${dayOfWeek ? ` · ${dayOfWeek}` : ""}
• Cabin: ${req.cabin_class || "Economy"}  Currency: ${req.currency || "USD"}
• Live cheapest: ${liveLow || "?"}
• Historical avg (same currency, ${sameCurTrends.length} samples): ${trustHistorical ? avgHistorical.toFixed(0) : "INSUFFICIENT — do NOT cite a 'vs typical' percentage"}
• Vs typical: ${trustHistorical ? `${pctVsAvg > 0 ? "+" : ""}${pctVsAvg}%` : "UNAVAILABLE — do not invent one"}
• Heuristic verdict: ${base.price_verdict}

ALLOWED AIRLINE NAMES (use FULL name only, NEVER IATA codes): ${allowedAirlines.join(" | ") || "(none)"}

SHORTLIST:
${shortlistJson ? JSON.stringify(shortlistJson, null, 2) : "(none)"}

═══════════════════════════════════════════════
You MUST emit BOTH a smart_tip AND a pick_advisor in the tool call.

✦ smart_tip = market overview for the whole route+date (not a specific flight).
   - lead: ONE warm sentence (14–24 words) like a senior advisor giving the bottom line.
     Examples:
       "Honestly, this is a solid week to fly to Guangzhou — fares are running about 12% under what we usually see in May." (only if Vs typical is provided)
       "Prices look fair right now, but I'd lean toward booking within a week before the summer surge kicks in."
       "Limited price history on this route, but the cheapest fare here is a strong nonstop deal worth grabbing."
   - verdict: 1–3 word pill, e.g. {label:"Below typical", tone:"good"} / {label:"Fair price", tone:"neutral"} / {label:"Above typical", tone:"warn"} / {label:"Limited history", tone:"neutral"}
   - evidence: 2–3 chips with concrete data:
       • {icon:"price", label:"Cheapest is nonstop", tone:"good"}     ← prefer shortlist-grounded chips
       • {icon:"trend", label:"Stable next 7 days", tone:"neutral"}
       • {icon:"stops", label:"Nonstop option", tone:"good"}
   - action (optional): {label:"Book within 3 days", kind:"book_now"} or {label:"Hold and watch", kind:"hold"} or {label:"Try ±3 days", kind:"shift_dates"}

✦ pick_advisor = why THIS specific flight (the ai_pick_id) is the best buy.
   - lead: ONE conversational sentence (14–26 words) explaining the trade-off in plain English.
     Examples:
       "I'd take US-Bangla Airlines here — it's the only nonstop, costs the same as 1-stop options, and you keep your morning."
       "Singapore Airlines costs about 15% more, but you save 4 hours and avoid the rough Doha layover — worth it for a Sunday flight."
       "Cheapest fare on the page AND it's refundable — that's a rare combo, hard to beat for a flexible trip."
   - verdict: 1–3 word pill, e.g. {label:"Best value", tone:"good"} / {label:"Smart upgrade", tone:"good"} / {label:"Cheapest + flexible", tone:"good"}
   - evidence: 2–3 chips of REAL advantages from the shortlist data, not generic:
       • {icon:"stops", label:"Only nonstop", tone:"good"}
       • {icon:"baggage", label:"30kg included", tone:"good"}
       • {icon:"price", label:"Same price as 1-stops", tone:"good"}
       • {icon:"time", label:"Saves 4h vs alt", tone:"good"}
       • {icon:"refund", label:"Partially refundable", tone:"good"}
   - action: usually {label:"Book this fare", kind:"book_now"} for the picked flight.

✦ urgency.message: ONE short sentence (≤14 words) grounded in shortlist or trustworthy history. NEVER cite a "% below/above average" unless "Vs typical" above is provided. Good examples:
   "Cheapest is also the only nonstop — easy decision."
   "Few nonstops on this route — this one stands out."
   "Solid value for a same-day nonstop."
   BAD: "This fare is 74% below average" (when Vs typical is UNAVAILABLE).

HARD RULES (violation = rejection):
1. NEVER use airline IATA codes (e.g. "BS", "SQ"). Always full names from the ALLOWED list.
2. NEVER write template phrasing like "X is cheapest at Y, fastest at Z, with N stops".
3. NEVER write generic filler ("Recommended option", "Best value flight for DAC to CAN").
4. Each evidence chip must be GROUNDED in the actual shortlist/route data above.
5. Lead sentences must sound human — contractions OK, no marketing-speak, no exclamation marks.
6. Also fill the legacy ai_pick_rationale field with pick_advisor.lead (same content, kept for back-compat).
7. NEVER invent a "% vs typical/average" number. If Vs typical is UNAVAILABLE, talk about shortlist facts instead (nonstop, price gap, baggage, etc.).

Headline (≤8 words): factual, e.g. "Nonstop available on US-Bangla Airlines" or "Prices ${base.price_verdict === "great_deal" ? "below" : "near"} typical".`;

    // Reusable advisor sub-schema
    const advisorSchema = {
      type: "object",
      properties: {
        lead: { type: "string", description: "ONE warm sentence (14-26 words). Senior travel agent voice." },
        verdict: {
          type: "object",
          properties: {
            label: { type: "string", description: "1-3 words, e.g. 'Below typical', 'Best value'" },
            tone: { type: "string", enum: ["good", "neutral", "warn"] },
          },
          required: ["label", "tone"],
        },
        evidence: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              icon: { type: "string", enum: ["price", "time", "comfort", "stops", "baggage", "refund", "ontime", "trend"] },
              label: { type: "string", description: "≤4 words, concrete data" },
              detail: { type: "string", description: "Optional ≤8 word clarifier" },
              tone: { type: "string", enum: ["good", "neutral", "warn"] },
            },
            required: ["icon", "label", "tone"],
          },
        },
        action: {
          type: "object",
          properties: {
            label: { type: "string", description: "Action label, ≤4 words" },
            kind: { type: "string", enum: ["book_now", "hold", "shift_dates", "compare"] },
          },
          required: ["label", "kind"],
        },
      },
      required: ["lead", "verdict", "evidence"],
    };

    const result = await runAITask({
      taskKey: "flight-insights",
      // Force cheapest Gemini for all flight-page AI work — this task runs on every search
      overrideProvider: "lovable",
      overrideModel: "google/gemini-2.5-flash-lite",
      overrideTemperature: 0.3,
      overrideMaxTokens: 900,
      messages: [
        { role: "system", content: `You are Vela, a senior travel advisor with 20 years of route knowledge. You speak warmly and specifically — like a friend who happens to be an industry veteran. Cite ONLY airline names from the ALLOWED list provided in the user message — never invent or substitute carriers. Every claim must be grounded in the supplied data. Always emit BOTH smart_tip and pick_advisor with full structure.` },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_insight",
            description: "Emit a structured flight pricing insight with two advisor breakdowns",
            parameters: {
              type: "object",
              properties: {
                headline: { type: "string", description: "≤8 words, factual" },
                recommendation: { type: "string", description: "1 sentence trust-building" },
                ai_pick_id: { type: "string", description: "ID of best-value flight from shortlist" },
                ai_pick_rationale: { type: "string", description: "Same as pick_advisor.lead — kept for legacy UI." },
                ai_pick_value_delta_pct: { type: "number", description: "% more value vs cheapest, e.g. 9" },
                best_book_window: { type: "string", description: "now | within 3 days | within 7 days | wait" },
                predicted_change_pct: { type: "number" },
                fare_alerts: { type: "array", items: { type: "string" }, maxItems: 3 },
                urgency_level: { type: "string", enum: ["low", "medium", "high"] },
                urgency_message: { type: "string" },
                smart_tip: advisorSchema,
                pick_advisor: advisorSchema,
              },
              required: ["headline", "recommendation", "best_book_window", "fare_alerts", "smart_tip", "pick_advisor"],
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "emit_insight" } },
    });
    const args = result.toolCall?.args;
    if (!args) return base;

    // Validate rationale: reject generic filler, template phrasing, raw airline codes,
    // AND any rationale that mentions an airline NOT actually present in the shortlist.
    const rationale = typeof args.ai_pick_rationale === "string" ? args.ai_pick_rationale.trim() : "";
    const mentionsUnknownAirline = detectUnknownAirline(rationale, shortlist);
    const usesRawCode = /\b[A-Z0-9]{2}\b\s+(is|has|offers|costs|wins|provides|gives)\b/i.test(rationale);
    const isTemplated =
      /\bis\s+cheapest\s+at\b/i.test(rationale) ||
      /\bfastest\s+at\s+\d/i.test(rationale) ||
      /with\s+\d+\s+stops?\b/i.test(rationale);
    const isGeneric = !rationale ||
      /best value flight for/i.test(rationale) ||
      /recommended (option|flight)/i.test(rationale) ||
      rationale.split(/\s+/).length < 8;
    const finalRationale = (isGeneric || mentionsUnknownAirline || usesRawCode || isTemplated) ? undefined : rationale;
    if (mentionsUnknownAirline || usesRawCode || isTemplated) {
      console.warn("[flight-insights] rejected rationale:", { rationale, mentionsUnknownAirline, usesRawCode, isTemplated });
    }

    // Validate advisor payloads — reject if airline names are wrong or evidence is empty
    const sanitizeAdvisor = (a: any): AdvisorPayload | undefined => {
      if (!a || typeof a !== "object") return undefined;
      const lead = typeof a.lead === "string" ? a.lead.trim() : "";
      if (!lead || lead.split(/\s+/).length < 8) return undefined;
      if (detectUnknownAirline(lead, shortlist)) {
        console.warn("[flight-insights] advisor rejected — unknown airline in lead:", lead);
        return undefined;
      }
      if (/\b[A-Z]{2,3}\d{2,4}\b/.test(lead)) return undefined; // raw flight numbers
      const verdict = a.verdict && typeof a.verdict.label === "string"
        ? { label: String(a.verdict.label).slice(0, 24), tone: ["good", "neutral", "warn"].includes(a.verdict.tone) ? a.verdict.tone : "neutral" }
        : { label: "Recommended", tone: "neutral" as const };
      const evidence = Array.isArray(a.evidence)
        ? a.evidence
            .filter((e: any) => e && typeof e.label === "string" && e.label.trim())
            .slice(0, 3)
            .map((e: any) => ({
              icon: ["price", "time", "comfort", "stops", "baggage", "refund", "ontime", "trend"].includes(e.icon) ? e.icon : "price",
              label: String(e.label).slice(0, 32),
              detail: typeof e.detail === "string" ? String(e.detail).slice(0, 50) : undefined,
              tone: ["good", "neutral", "warn"].includes(e.tone) ? e.tone : "neutral",
            }))
        : [];
      if (evidence.length < 2) return undefined;
      const action = a.action && typeof a.action.label === "string" && ["book_now", "hold", "shift_dates", "compare"].includes(a.action.kind)
        ? { label: String(a.action.label).slice(0, 24), kind: a.action.kind }
        : undefined;
      return { lead, verdict, evidence, action };
    };

    const smartTip = sanitizeAdvisor(args.smart_tip);
    const pickAdvisor = sanitizeAdvisor(args.pick_advisor);

    return {
      ...base,
      headline: args.headline || base.headline,
      recommendation: args.recommendation || base.recommendation,
      ai_pick_id: args.ai_pick_id || base.ai_pick_id,
      ai_pick_rationale: finalRationale ?? pickAdvisor?.lead ?? base.ai_pick_rationale,
      ai_pick_value_delta_pct: typeof args.ai_pick_value_delta_pct === "number" ? args.ai_pick_value_delta_pct : base.ai_pick_value_delta_pct,
      best_book_window: args.best_book_window || base.best_book_window,
      predicted_change_pct: typeof args.predicted_change_pct === "number" ? args.predicted_change_pct : base.predicted_change_pct,
      fare_alerts: Array.isArray(args.fare_alerts) && args.fare_alerts.length ? args.fare_alerts : base.fare_alerts,
      urgency: args.urgency_level && args.urgency_message
        ? { level: args.urgency_level, message: args.urgency_message }
        : base.urgency,
      smart_tip: smartTip,
      pick_advisor: pickAdvisor,
      source: "ai",
    };
  } catch (e) {
    console.warn("[flight-insights] AI enrich failed:", (e as Error).message);
    return base;
  }
}

async function recordTrendSample(_supabase: any, _req: InsightsRequest) {
  // Intentionally disabled.
  // This endpoint only sees already-converted UI aggregates (display currency + shortlist
  // summary), not canonical provider fares. Writing those values into flight_price_trends
  // polluted the shared trend store with mixed-currency / aggregate rows.
  return;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as InsightsRequest;
    if (!body?.from_code || !body?.to_code) {
      return new Response(JSON.stringify({ error: "from_code and to_code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const cacheKey = makeCacheKey(body);
    const shortlist = rankShortlistHeuristic(body.shortlist || []);

    // 1. Cache hit? Skip generic/stale rationales so the new prompt rewrites them.
    const { data: cached } = await supabase
      .from("flight_insights_cache")
      .select("insights, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached?.insights) {
      const cachedAny = cached.insights as any;
      const rationale = String(cachedAny?.ai_pick_rationale || "");
      const isStaleGeneric =
        /best value flight for/i.test(rationale) ||
        /recommended (option|flight)/i.test(rationale);
      const isStaleTemplate =
        /\bis\s+cheapest\s+at\b/i.test(rationale) ||
        /\bfastest\s+at\s+\d/i.test(rationale) ||
        /with\s+\d+\s+stops?\b/i.test(rationale) ||
        /\b[A-Z0-9]{2}\b\s+(is|has|offers|costs|wins|provides|gives)\b/i.test(rationale);
      const mentionsUnknownAirline = detectUnknownAirline(rationale, shortlist);
      // Bust cache when the new advisor payloads aren't present yet
      const missingAdvisor = !cachedAny?.smart_tip || !cachedAny?.pick_advisor;
      if (!isStaleGeneric && !isStaleTemplate && !mentionsUnknownAirline && !missingAdvisor) {
        recordTrendSample(supabase, body);
        return new Response(JSON.stringify({ ...cached.insights, source: "cache" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.warn("[flight-insights] cache busted:", { rationale, isStaleGeneric, isStaleTemplate, mentionsUnknownAirline, missingAdvisor });
    }

    // 2. Parallel fetch trends, cheaper dates, record sample
    const [trends, cheaperDates] = await Promise.all([
      fetchTrends(supabase, body.from_code, body.to_code, body.depart_date, body.currency),
      fetchCheaperDates(supabase, body.from_code, body.to_code, body.depart_date || "", body.currency || "USD", body.current_min_price || 0),
      recordTrendSample(supabase, body),
    ]);

    // 3. Build insight: heuristic → AI rerank
    const baseline = buildHeuristic(body, trends);
    const routeInsight = buildRouteInsight(shortlist);
    if (routeInsight) {
      routeInsight.cheaper_dates = cheaperDates;
      baseline.route_insight = routeInsight;
    }
    // Default AI pick to top heuristic
    if (shortlist.length && !baseline.ai_pick_id) {
      baseline.ai_pick_id = shortlist[0].id;
      const cheapest = [...shortlist].sort((a, b) => a.price - b.price)[0];
      if (cheapest && shortlist[0].id !== cheapest.id) {
        const delta = pctChange(cheapest.price, shortlist[0].price);
        baseline.ai_pick_value_delta_pct = Math.abs(delta);
      }
    }
    const enriched = await enrichWithAI(baseline, body, trends, shortlist);
    if (!enriched.route_insight && routeInsight) enriched.route_insight = routeInsight;

    // 4. Cache — AI entries get 24h TTL (learn & skip), heuristic gets 1h.
    try {
      const ttlHours = enriched.source === "ai" ? 24 : 1;
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
      await supabase.from("flight_insights_cache").upsert(
        {
          cache_key: cacheKey,
          from_code: body.from_code,
          to_code: body.to_code,
          depart_date: body.depart_date || null,
          return_date: body.return_date || null,
          insights: enriched,
          source: enriched.source,
          expires_at: expiresAt,
        },
        { onConflict: "cache_key" }
      );
    } catch (e) {
      console.warn("[flight-insights] cache upsert failed:", (e as Error).message);
    }

    return new Response(JSON.stringify(enriched), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[flight-insights] fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
