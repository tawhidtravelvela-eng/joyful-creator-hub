import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FlightInsight } from "@/components/flights/results/types";

interface ShortlistFlight {
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

interface Args {
  from?: string | null;
  to?: string | null;
  departDate?: string | null;
  returnDate?: string | null;
  cabinClass?: string;
  currency?: string;
  resultsCount?: number;
  currentMinPrice?: number;
  currentAvgPrice?: number;
  shortlist?: ShortlistFlight[];
  enabled?: boolean;
}

// ----- Local heuristic AI Pick (instant fallback while AI loads) -----
function scoreFlight(f: ShortlistFlight, minPrice: number, minDur: number) {
  const priceScore = (f.price / Math.max(minPrice, 1)) * 50;
  const durScore = (f.duration_min / Math.max(minDur, 1)) * 25;
  const stopPenalty = f.stops * 8;
  const baggageBoost = f.checkin_baggage && /\d/.test(f.checkin_baggage) ? -3 : 0;
  const refundBoost = f.refundable ? -2 : 0;
  return priceScore + durScore + stopPenalty + baggageBoost + refundBoost;
}

function fmtDur(min: number): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function buildLocalRationale(pick: ShortlistFlight, shortlist: ShortlistFlight[]): string {
  if (!pick || shortlist.length === 0) return "";
  const cheapest = [...shortlist].sort((a, b) => a.price - b.price)[0];
  const fastest = [...shortlist].sort((a, b) => a.duration_min - b.duration_min)[0];
  const airline = pick.airline?.trim() || "This flight";

  const isCheapest = pick.id === cheapest.id;
  const isFastest = pick.id === fastest.id;
  const isNonstop = pick.stops === 0;
  const hasBag = !!(pick.checkin_baggage && /\d/.test(pick.checkin_baggage));
  const isRefundable = !!pick.refundable;

  if (isCheapest) {
    if (isFastest && isNonstop) return `${airline} is the cheapest, fastest, and only nonstop — hard to beat.`;
    if (isFastest) return `${airline} is both cheapest and fastest at ${fmtDur(pick.duration_min)}.`;
    if (isNonstop) return `${airline} is the cheapest option AND the only nonstop — clear winner.`;
    if (hasBag) return `${airline} is cheapest and includes ${pick.checkin_baggage} checked baggage.`;
    return `${airline} is the cheapest option on this route.`;
  }

  const durDelta = cheapest.duration_min - pick.duration_min;
  const stopsDelta = cheapest.stops - pick.stops;
  if (durDelta >= 60) {
    const hours = Math.round(durDelta / 60);
    return `${airline} costs a bit more but saves you ${hours}h${stopsDelta > 0 ? " and a layover" : ""}.`;
  }
  if (stopsDelta > 0 && isNonstop) return `${airline} is the only nonstop — worth the small premium.`;
  if (hasBag && !cheapest.checkin_baggage?.match(/\d/)) {
    return `${airline} includes a ${pick.checkin_baggage} checked bag — better value once you add baggage.`;
  }
  if (isRefundable && !cheapest.refundable) return `${airline} is refundable, useful if your plans might shift.`;
  return `${airline} balances price, time, and comfort on this route.`;
}

function buildLocalInsight(args: Args): FlightInsight | null {
  const shortlist = args.shortlist || [];
  if (shortlist.length === 0) return null;

  const minPrice = Math.min(...shortlist.map((f) => f.price)) || 1;
  const minDur = Math.min(...shortlist.map((f) => f.duration_min)) || 1;
  const ranked = [...shortlist].sort((a, b) => scoreFlight(a, minPrice, minDur) - scoreFlight(b, minPrice, minDur));
  const pick = ranked[0];
  if (!pick) return null;

  const cheapest = [...shortlist].sort((a, b) => a.price - b.price)[0];
  const valueDelta = pick.id !== cheapest.id
    ? Math.abs(Math.round(((cheapest.price - pick.price) / cheapest.price) * 100))
    : 0;

  return {
    headline: args.currentMinPrice
      ? `Lowest fare from ${args.currency || "USD"} ${Math.round(args.currentMinPrice)}`
      : "Live fares for your route",
    recommendation: "Compare options below to find the best fit for your trip.",
    confidence: "medium",
    price_verdict: "unknown",
    trend_direction: "unknown",
    trend_sparkline: [],
    trend_dates: [],
    predicted_change_pct: 0,
    best_book_window: "within 7 days",
    fare_alerts: [],
    ai_pick_id: pick.id,
    ai_pick_rationale: buildLocalRationale(pick, shortlist),
    ai_pick_value_delta_pct: valueDelta || undefined,
    urgency: { level: "low", message: "Plenty of availability" },
    trust_signals: ["Live fares verified before payment", "24/7 booking support"],
    generated_at: new Date().toISOString(),
    source: "heuristic",
  } as unknown as FlightInsight;
}

// In-memory cache (key → insight) so we don't re-call the edge function on filter/sort
const aiCache = new Map<string, FlightInsight>();
const inflight = new Map<string, Promise<FlightInsight | null>>();

export function useFlightInsights(args: Args) {
  const shortlistKey = (args.shortlist || [])
    .map((f) => `${f.id}:${Math.round(f.price)}`)
    .join("|");

  // Top-12 signature: AI input is capped to top-12, so don't refetch when only deeper rows change
  const aiInputSig = (args.shortlist || [])
    .slice()
    .sort((a, b) => a.price - b.price)
    .slice(0, 12)
    .map((f) => `${f.id}:${Math.round(f.price)}:${f.duration_min}:${f.stops}`)
    .join("|");

  const cacheKey = useMemo(
    () =>
      [
        args.from || "",
        args.to || "",
        args.departDate || "",
        args.returnDate || "",
        args.cabinClass || "",
        args.currency || "",
        Math.round(args.currentMinPrice || 0),
        aiInputSig,
      ].join("::"),
    [args.from, args.to, args.departDate, args.returnDate, args.cabinClass, args.currency, args.currentMinPrice, aiInputSig]
  );

  const localInsight = useMemo<FlightInsight | null>(() => {
    if (!args.enabled || !args.from || !args.to) return null;
    return buildLocalInsight(args);
  }, [args.enabled, args.from, args.to, shortlistKey, args.currency, args.currentMinPrice]);

  const [aiInsight, setAiInsight] = useState<FlightInsight | null>(
    () => aiCache.get(cacheKey) || null
  );
  const [loading, setLoading] = useState(false);
  // Timed-out flag — when true, we expose the local heuristic text as fallback.
  const [timedOut, setTimedOut] = useState(false);
  const lastKey = useRef<string>("");

  // Hard cap on how long we wait for AI before falling back to system heuristic.
  const AI_TIMEOUT_MS = 6000;

  useEffect(() => {
    if (!args.enabled || !args.from || !args.to || (args.shortlist || []).length === 0) return;
    if (lastKey.current === cacheKey) return;
    lastKey.current = cacheKey;

    const cached = aiCache.get(cacheKey);
    if (cached) {
      setAiInsight(cached);
      setTimedOut(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTimedOut(false);

    const top = (args.shortlist || []).slice().sort((a, b) => a.price - b.price).slice(0, 12);

    const fetcher = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("flight-insights", {
          body: {
            from_code: args.from,
            to_code: args.to,
            depart_date: args.departDate || undefined,
            return_date: args.returnDate || undefined,
            current_min_price: args.currentMinPrice,
            current_avg_price: args.currentAvgPrice,
            currency: args.currency || "USD",
            results_count: args.resultsCount,
            cabin_class: args.cabinClass,
            shortlist: top.map((f) => ({
              id: f.id,
              airline: f.airline,
              price: f.price,
              duration_min: f.duration_min,
              stops: f.stops,
              cabin_baggage: f.cabin_baggage,
              checkin_baggage: f.checkin_baggage,
              refundable: f.refundable,
              layover_codes: f.layover_codes,
            })),
          },
        });
        if (error) throw error;
        const insight = (data?.insight || data) as FlightInsight | null;
        if (insight) aiCache.set(cacheKey, insight);
        return insight;
      } catch (e) {
        console.warn("[useFlightInsights] edge call failed:", (e as Error).message);
        return null;
      }
    };

    let promise = inflight.get(cacheKey);
    if (!promise) {
      promise = fetcher();
      inflight.set(cacheKey, promise);
      promise.finally(() => inflight.delete(cacheKey));
    }

    // Timeout: if AI hasn't responded in AI_TIMEOUT_MS, expose the heuristic fallback.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setTimedOut(true);
    }, AI_TIMEOUT_MS);

    promise.then((insight) => {
      if (cancelled) return;
      if (insight) setAiInsight(insight);
      setLoading(false);
      window.clearTimeout(timer);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cacheKey, args.enabled]);

  // Display rule:
  // - While AI is pending and not yet timed out: hide narrative text (no rationale, no smart_tip, no pick_advisor).
  // - Once AI returns: show AI fields, fall back to local for any missing piece.
  // - If AI times out: expose local heuristic narrative as the fallback.
  const merged = useMemo<FlightInsight | null>(() => {
    if (aiInsight) {
      if (!localInsight) return aiInsight;
      return {
        ...localInsight,
        ...aiInsight,
        ai_pick_id: aiInsight.ai_pick_id || localInsight.ai_pick_id,
        ai_pick_rationale:
          (aiInsight as any).ai_pick_rationale || (localInsight as any).ai_pick_rationale,
      } as FlightInsight;
    }
    if (!localInsight) return null;
    if (timedOut) return localInsight;
    // Pending: keep structural data (sparkline, urgency, pick id) but suppress AI-style narrative.
    return {
      ...localInsight,
      ai_pick_rationale: undefined,
      smart_tip: undefined,
      pick_advisor: undefined,
    } as FlightInsight;
  }, [aiInsight, localInsight, timedOut]);

  return { insight: merged, loading };
}
