// Flight Price Grid — Lazy ±30-day backfill of cached fares for a route.
// Strategy:
//   1. Check flight_price_cache for existing rows in the ±30 day window.
//   2. If <50% of days are cached or oldest cache > 24h, backfill missing days
//      from external sources (Sky Scrapper primary → Aviasales fallback).
//   3. Persist into flight_price_cache (24h TTL) AND flight_price_trends
//      (long-term per-route history for sparkline / "below typical" verdicts).
// Designed to be called fire-and-forget from the client right after a flight
// search resolves. Returns immediately if cache is already warm.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  from: string;
  to: string;
  departDate: string;     // yyyy-MM-dd (centre of window)
  windowDays?: number;    // default 30 (so ±30 = 61 days)
  currency?: string;      // for trend storage
  cabinClass?: string;
  force?: boolean;        // bypass freshness check
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function buildDateWindow(centre: string, windowDays: number): string[] {
  const c = new Date(centre + "T00:00:00Z");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = -windowDays; i <= windowDays; i++) {
    const d = addDays(c, i);
    if (d < today) continue; // skip past dates
    out.push(ymd(d));
  }
  return out;
}

// Amadeus removed from price calendar/trend pipeline — Sky Scrapper is primary,
// AirScrapper is second fallback, Aviasales is third, our own flight_price_trends
// store fills remaining gaps.

interface PricePoint { date: string; price: number; currency: string; source: string }

// ── Aviasales (Travelpayouts) ──
// GET /aviasales/v3/prices_for_dates?origin=X&destination=Y&departure_at=2026-04 (month) | full date
// Returns cached lowest fares. Free with TRAVELPAYOUTS_TOKEN signup.

async function loadAviasalesToken(sb: ReturnType<typeof createClient>): Promise<string | null> {
  let token: string | null = null;
  try {
    const { data } = await sb.rpc("read_provider_secret", { p_name: "aviasales_token" });
    if (typeof data === "string" && data.trim()) token = data.trim();
  } catch {}
  if (!token) token = Deno.env.get("TRAVELPAYOUTS_TOKEN") || Deno.env.get("AVIASALES_TOKEN") || null;
  return token;
}

// ── Sky Scrapper (RapidAPI) ──
// GET /api/v1/flights/getPriceCalendar?originSkyId=X&destinationSkyId=Y&fromDate=YYYY-MM-DD&currency=USD
// Returns ~12 months of priced days in a single call with built-in low/medium/high
// classification — by far the broadest single-call coverage we have. Used as the
// PRIMARY bootstrap source for cold routes.

async function fetchSkyScrapperGrid(
  from: string,
  to: string,
  fromDate: string,
  currency: string = "USD",
): Promise<PricePoint[]> {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) {
    console.warn("[price-grid] RAPIDAPI_KEY missing — skipping skyscrapper");
    return [];
  }
  try {
    const url = `https://sky-scrapper.p.rapidapi.com/api/v1/flights/getPriceCalendar?originSkyId=${encodeURIComponent(from)}&destinationSkyId=${encodeURIComponent(to)}&fromDate=${encodeURIComponent(fromDate)}&currency=${encodeURIComponent(currency)}`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-host": "sky-scrapper.p.rapidapi.com",
        "x-rapidapi-key": key,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`[price-grid] skyscrapper HTTP ${res.status}`);
      return [];
    }
    const j = await res.json();
    const days = j?.data?.flights?.days;
    const responseCurrency = String(j?.data?.flights?.currency || currency).toUpperCase();
    if (!Array.isArray(days)) {
      console.warn("[price-grid] skyscrapper returned no days array");
      return [];
    }
    const out: PricePoint[] = [];
    for (const row of days) {
      const date = String(row?.day || "").slice(0, 10);
      const price = Number(row?.price);
      if (!date || !price || price <= 0) continue;
      out.push({ date, price, currency: responseCurrency, source: "skyscrapper" });
    }
    console.log(`[price-grid] skyscrapper returned ${out.length} priced days for ${from}-${to}`);
    return out;
  } catch (e) {
    console.warn("[price-grid] skyscrapper err", (e as Error).message);
    return [];
  }
}

// ── AirScrapper / global-flights-data (RapidAPI) ──
// GET /1.0/farefirst/flights/price-calendar?originSkyId=X&destinationSkyId=Y&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
// Returns round-trip quote bundles keyed by composite strings like
//   "*D*JFK*LHR*20260508*...|*D*LHR*JFK*20260520*..." → { Price, Currency }.
// We decompose each key, take the OUTBOUND leg's date for the requested O/D
// and keep the lowest price per day. Used as SECONDARY fallback after
// Sky Scrapper and before Aviasales. Window is capped to ~30 days per call.

async function fetchAirScrapperGrid(
  from: string,
  to: string,
  startDate: string,
  endDate: string,
): Promise<PricePoint[]> {
  const key = Deno.env.get("RAPIDAPI_KEY");
  if (!key) {
    console.warn("[price-grid] RAPIDAPI_KEY missing — skipping airscrapper");
    return [];
  }
  // API caps results at ~30 days; clamp the window to keep payload small.
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const maxEnd = addDays(start, 30);
  const clampedEnd = end > maxEnd ? maxEnd : end;
  const toDate = ymd(clampedEnd);
  try {
    const url = `https://global-flights-data.p.rapidapi.com/1.0/farefirst/flights/price-calendar?originSkyId=${encodeURIComponent(from)}&destinationSkyId=${encodeURIComponent(to)}&fromDate=${encodeURIComponent(startDate)}&toDate=${encodeURIComponent(toDate)}`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-host": "global-flights-data.p.rapidapi.com",
        "x-rapidapi-key": key,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.warn(`[price-grid] airscrapper HTTP ${res.status}`);
      return [];
    }
    const j = await res.json();
    const quotes = j?.quotes ?? j?.data?.quotes ?? {};
    if (!quotes || typeof quotes !== "object" || Array.isArray(quotes)) {
      console.warn("[price-grid] airscrapper returned no quotes object");
      return [];
    }
    const perDay = new Map<string, number>();
    const fromU = from.toUpperCase();
    const toU = to.toUpperCase();
    for (const [composite, quote] of Object.entries(quotes)) {
      const q = quote as { Price?: number; price?: number; Currency?: string; currency?: string };
      const price = Number(q?.Price ?? q?.price);
      if (!price || price <= 0) continue;
      // Composite looks like: "*D*FROM*TO*YYYYMMDD*..." possibly with a return leg
      // separated by "|". Take the first leg matching our O/D.
      const legs = String(composite).split("|");
      let outDate: string | null = null;
      for (const leg of legs) {
        const parts = leg.split("*").filter(Boolean);
        // Expected shape: ["D", FROM, TO, YYYYMMDD, ...]
        const o = parts[1]?.toUpperCase();
        const d = parts[2]?.toUpperCase();
        const dt = parts[3];
        if (o === fromU && d === toU && /^\d{8}$/.test(dt || "")) {
          outDate = `${dt!.slice(0, 4)}-${dt!.slice(4, 6)}-${dt!.slice(6, 8)}`;
          break;
        }
      }
      if (!outDate) continue;
      const prev = perDay.get(outDate);
      if (prev === undefined || price < prev) perDay.set(outDate, price);
    }
    // API does not consistently expose currency per-quote; assume USD (matches
    // RapidAPI default); persistPrices will normalise downstream if needed.
    const out: PricePoint[] = Array.from(perDay.entries()).map(([date, price]) => ({
      date, price, currency: "USD", source: "airscrapper",
    }));
    console.log(`[price-grid] airscrapper returned ${out.length} priced days for ${from}-${to} (window ${startDate}→${toDate})`);
    return out;
  } catch (e) {
    console.warn("[price-grid] airscrapper err", (e as Error).message);
    return [];
  }
}

// Aviasales REST — multi-endpoint fan-out for maximum coverage.
// Fetches from prices_for_dates (per-month, both direct and connecting variants)
// AND the v1 prices/cheap endpoint to capture additional cached fares the
// v3 endpoint may omit. Merges all results and keeps the lowest price per day.
async function fetchAviasalesGrid(
  sb: ReturnType<typeof createClient>,
  from: string,
  to: string,
  centreDate: string,
  _startDate: string,
  _endDate: string
): Promise<PricePoint[]> {
  const token = await loadAviasalesToken(sb);
  if (!token) {
    console.warn("[price-grid] aviasales token not configured (vault: aviasales_token)");
    return [];
  }

  const centre = new Date(centreDate + "T00:00:00Z");
  const months: string[] = [];
  for (const offset of [-1, 0, 1, 2]) {
    const d = new Date(Date.UTC(centre.getUTCFullYear(), centre.getUTCMonth() + offset, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const perDay = new Map<string, number>();
  let totalRaw = 0;
  const endpointStats: Record<string, number> = {};

  // Build all endpoint variants:
  //   - v3 prices_for_dates: per-month, with direct=false (all flights), direct=true (nonstop)
  //     and sort by price + departure for broader coverage
  //   - v1 prices/cheap: returns cheapest fare per day across whole month, broader cache
  //   - v2 prices/latest: most-recent observed fares
  type Variant = { url: string; tag: string };
  const variants: Variant[] = [];

  for (const month of months) {
    // Two passes per month: all-flights (direct=false) and nonstop-only (direct=true)
    for (const direct of ["false", "true"]) {
      for (const sort of ["price", "departure_at"]) {
        variants.push({
          url: `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${from}&destination=${to}&departure_at=${month}&one_way=true&direct=${direct}&currency=usd&limit=1000&sorting=${sort}&token=${token}`,
          tag: `v3:${month}:d=${direct}:s=${sort}`,
        });
      }
    }
    // v1 prices/cheap returns lowest-per-day for the whole month
    variants.push({
      url: `https://api.travelpayouts.com/v1/prices/cheap?origin=${from}&destination=${to}&depart_date=${month}&currency=usd&token=${token}`,
      tag: `v1cheap:${month}`,
    });
  }
  // v2 prices/latest — broad recent-cache scan, no date filter
  variants.push({
    url: `https://api.travelpayouts.com/v2/prices/latest?origin=${from}&destination=${to}&period_type=year&one_way=true&currency=usd&limit=1000&token=${token}`,
    tag: `v2latest`,
  });

  await Promise.all(variants.map(async ({ url, tag }) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        endpointStats[tag] = -res.status;
        return;
      }
      const j = await res.json();
      let count = 0;

      // v3 prices_for_dates → { data: [{ departure_at, price }] }
      if (Array.isArray(j?.data)) {
        for (const row of j.data) {
          const dt = String(row?.departure_at || row?.depart_date || "").slice(0, 10);
          const price = Number(row?.price ?? row?.value);
          if (!dt || !price) continue;
          const cur = perDay.get(dt);
          if (cur === undefined || price < cur) perDay.set(dt, price);
          count++;
        }
      }

      // v1 prices/cheap → { data: { "DEST": { "0": { price, departure_at }, ... } } }
      if (j?.data && !Array.isArray(j.data) && typeof j.data === "object") {
        for (const destKey of Object.keys(j.data)) {
          const offers = j.data[destKey];
          if (!offers || typeof offers !== "object") continue;
          for (const offerKey of Object.keys(offers)) {
            const offer = offers[offerKey];
            const dt = String(offer?.departure_at || "").slice(0, 10);
            const price = Number(offer?.price);
            if (!dt || !price) continue;
            const cur = perDay.get(dt);
            if (cur === undefined || price < cur) perDay.set(dt, price);
            count++;
          }
        }
      }

      endpointStats[tag] = count;
      totalRaw += count;
    } catch (e) {
      console.warn("[price-grid] aviasales fetch err", tag, (e as Error).message);
    }
  }));

  console.log(`[price-grid] aviasales merged ${perDay.size} unique days from ${totalRaw} raw rows (${variants.length} endpoints) for ${from}-${to}`);
  return Array.from(perDay.entries()).map(([date, price]) => ({
    date, price, currency: "USD", source: "aviasales",
  }));
}

// ── Trend fallback: synthesise prices from our own flight_price_trends store ──
// PRIMARY source — real searches our users actually performed. We pick the
// FRESHEST sample per depart_date (most recent sample_date wins). If multiple
// samples were recorded on the same day, we take the lowest min_price among
// them. Only falls back to a 30-day median when the freshest sample is older
// than 7 days, to smooth out one-off outliers in stale data.

async function fetchFromTrendStore(
  sb: ReturnType<typeof createClient>,
  from: string,
  to: string,
  dates: string[]
): Promise<PricePoint[]> {
  if (dates.length === 0) return [];
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const freshCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await sb
      .from("flight_price_trends")
      .select("depart_date, min_price, avg_price, currency, sample_date")
      .eq("from_code", from)
      .eq("to_code", to)
      .in("depart_date", dates)
      .gte("sample_date", cutoff)
      .order("sample_date", { ascending: false });
    if (error || !Array.isArray(data) || data.length === 0) return [];

    // Bucket by depart_date. Track the freshest sample_date and all prices
    // recorded on that freshest date — plus the broader 30-day pool for a
    // median fallback when fresh data is stale.
    type Bucket = {
      freshestDate: string;
      freshestPrices: number[];
      allPrices: number[];
      currency: string;
    };
    const buckets = new Map<string, Bucket>();
    for (const row of data as any[]) {
      const dt = row.depart_date as string;
      const price = Number(row.min_price);
      const sd = row.sample_date as string;
      if (!dt || !price || !sd) continue;
      let b = buckets.get(dt);
      if (!b) {
        b = { freshestDate: sd, freshestPrices: [price], allPrices: [price], currency: row.currency || "USD" };
      } else {
        b.allPrices.push(price);
        if (sd > b.freshestDate) {
          b.freshestDate = sd;
          b.freshestPrices = [price];
        } else if (sd === b.freshestDate) {
          b.freshestPrices.push(price);
        }
      }
      buckets.set(dt, b);
    }
    const out: PricePoint[] = [];
    for (const [date, b] of buckets.entries()) {
      // Fresh (≤7 days old): use the lowest price from the freshest sample day.
      // Stale (>7 days): fall back to the 30-day median to avoid trusting a single
      // outdated outlier.
      const isFresh = b.freshestDate >= freshCutoff;
      let chosen: number;
      if (isFresh) {
        chosen = Math.min(...b.freshestPrices);
      } else {
        const sorted = [...b.allPrices].sort((a, c) => a - c);
        chosen = sorted[Math.floor(sorted.length / 2)];
      }
      out.push({ date, price: chosen, currency: b.currency, source: "trend-store" });
    }
    console.log(`[price-grid] trend-store filled ${out.length} dates from ${data.length} samples (freshness-weighted)`);
    return out;
  } catch (e) {
    console.warn("[price-grid] trend-store err", (e as Error).message);
    return [];
  }
}

// ── AI Estimate Fallback ──
// AI estimates have been intentionally removed from the calendar pipeline.
// Calendar prices must come from real sources only:
//   trend-store → Sky Scrapper → AirScrapper → Aviasales.
// If every real source is empty, the day stays blank rather than showing
// synthetic numbers that would mislead users.

// ── Persistence ──

// Per-currency sanity floor for trend storage. Mirrors the floor used inside
// unified-flight-search.trackAndCache so both write paths stay consistent.
// Anything below the floor for a given currency is almost certainly mis-labelled
// (a USD value tagged BDT, or a per-segment leg price) and would otherwise
// poison the long-term median that powers calendar popovers + "below typical"
// verdicts. Floors are deliberately conservative.
const TREND_MIN_PER_ADULT: Record<string, number> = {
  USD: 30,
  EUR: 25,
  GBP: 22,
  AED: 110,
  SAR: 110,
  INR: 2500,
  BDT: 2500,
  PKR: 8000,
  LKR: 9000,
  NPR: 4000,
  THB: 1000,
  MYR: 130,
  SGD: 40,
  IDR: 450000,
  VND: 700000,
  PHP: 1700,
  JPY: 4000,
  CNY: 200,
  HKD: 230,
  KRW: 40000,
  TRY: 1000,
  AUD: 45,
  NZD: 50,
  CAD: 40,
  CHF: 30,
  ZAR: 550,
};

function isTrendSamplePlausible(perAdult: number, currency: string): boolean {
  if (!Number.isFinite(perAdult) || perAdult <= 0) return false;
  if (perAdult > 5_000_000) return false;
  const cur = String(currency || "").toUpperCase();
  const floor = TREND_MIN_PER_ADULT[cur];
  if (floor == null) return perAdult >= 10;
  return perAdult >= floor;
}

async function persistPrices(
  sb: ReturnType<typeof createClient>,
  from: string,
  to: string,
  cabinClass: string,
  points: PricePoint[]
) {
  if (points.length === 0) return 0;
  const now = Date.now();
  // Real-source prices (skyscrapper/aviasales/trend-store) live for 7 days — they refresh slowly
  // upstream and we want the cache to persist until the travel date passes naturally.
  const realExpiry = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const cacheRows = points.map((p) => ({
    from_code: from,
    to_code: to,
    travel_date: p.date,
    cabin_class: cabinClass,
    adults: 1,
    children: 0,
    infants: 0,
    lowest_price: p.price,
    currency: p.currency,
    source: p.source,
    expires_at: realExpiry,
    cached_at: new Date().toISOString(),
  }));
  // Upsert in chunks
  for (let i = 0; i < cacheRows.length; i += 100) {
    const batch = cacheRows.slice(i, i + 100);
    const { error } = await sb
      .from("flight_price_cache")
      .upsert(batch as any, {
        onConflict: "from_code,to_code,travel_date,cabin_class,adults,children,infants",
      });
    if (error) console.warn("[price-grid] cache upsert error", error.message);
  }

  // Long-term trend snapshot — only for live external sources (skip trend-store backfills
  // to avoid feedback loops where our own median data inflates the trend table).
  // Long-term trend snapshot — only for live external sources (skip trend-store backfills
  // and AI estimates to avoid feedback loops where synthetic data inflates the trend table).
  // Sanity-bound: drop any per-currency-implausible row so a single bad provider response
  // can't poison the long-term median for an entire route.
  const livePoints = points.filter((p) => {
    if (p.source === "trend-store" || p.source === "ai-estimate") return false;
    if (!isTrendSamplePlausible(p.price, p.currency)) {
      console.warn(`[price-grid] rejected implausible trend sample: ${from}-${to} ${p.date} ${p.price} ${p.currency} (${p.source})`);
      return false;
    }
    return true;
  });
  if (livePoints.length > 0) {
    const sampleDate = ymd(new Date());
    const trendRows = livePoints.map((p) => ({
      from_code: from,
      to_code: to,
      depart_date: p.date,
      sample_date: sampleDate,
      min_price: p.price,
      avg_price: p.price,
      max_price: p.price,
      sample_count: 1,
      currency: p.currency,
    }));
    for (let i = 0; i < trendRows.length; i += 100) {
      const batch = trendRows.slice(i, i + 100);
      const { error } = await sb
        .from("flight_price_trends")
        .upsert(batch as any, {
          onConflict: "from_code,to_code,depart_date,sample_date,currency",
          ignoreDuplicates: true,
        });
      if (error) {
        const { error: insErr } = await sb.from("flight_price_trends").insert(batch as any);
        if (insErr && !String(insErr.message).includes("duplicate")) {
          console.warn("[price-grid] trend insert error", insErr.message);
        }
      }
    }
  }
  return points.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body: ReqBody = await req.json();
    const { from, to, departDate } = body || {};
    if (!from || !to || !departDate) {
      return new Response(JSON.stringify({ success: false, error: "from, to, departDate required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Aggressive prefill: support up to 200-day windows. Sky Scrapper's getPriceCalendar
    // returns ~12 months of data per call, so a single bootstrap can seed ~6 months
    // forward + 1 month back of cache for the calendar popover.
    const windowDays = Math.min(200, Math.max(7, body.windowDays || 90));
    const cabinClass = body.cabinClass || "Economy";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const dates = buildDateWindow(departDate, windowDays);
    if (dates.length === 0) {
      return new Response(JSON.stringify({ success: true, cached: 0, fetched: 0, skipped: "all-past" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];

    // Freshness check — only count REAL-source (aviasales/amadeus/trend-store) rows fetched
    // within the last 24h. Past dates are excluded from coverage math (they can't be re-priced).
    // Skip the external fetch only when ≥85% of in-window future dates are already real & fresh.
    if (!body.force) {
      const today = ymd(new Date());
      const futureDates = dates.filter((d) => d >= today);
      const { data: existing } = await sb
        .from("flight_price_cache")
        .select("travel_date, cached_at, source")
        .eq("from_code", from)
        .eq("to_code", to)
        .gte("travel_date", startDate)
        .lte("travel_date", endDate);
      const fresh = (existing || []).filter((r: any) => {
        if (!r.cached_at) return false;
        if (r.source === "ai-estimate") return false; // AI rows don't count as fresh real data
        return Date.now() - new Date(r.cached_at).getTime() < 24 * 60 * 60 * 1000;
      });
      const denom = Math.max(1, futureDates.length);
      const coverage = fresh.length / denom;
      if (coverage >= 0.85) {
        return new Response(JSON.stringify({
          success: true, cached: fresh.length, fetched: 0, coverage,
          message: "cache-warm",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Source strategy — OWN DATA FIRST, APIs fill the gaps:
    //   1. flight_price_trends (real user searches recorded by unified-flight-search)
    //      is the PRIMARY source. It's the freshest signal we have for any date a
    //      real customer has actually queried — those prices override everything.
    //   2. Sky Scrapper backfills dates we have no own-data for (one call ≈ 12 months).
    //   3. Aviasales backfills any remaining gaps when Sky Scrapper has nothing.
    //   4. Once a real user search later observes a new price for a date, the trend
    //      store is rewritten by unified-flight-search and overrides the API cache
    //      on the next grid call (own-data priority above).
    //   (Amadeus is intentionally NOT used here — reserved for live booking flows.)
    const todayIso = ymd(new Date());

    // ── PRIMARY: own observed prices (full window, broader sample lookup) ──
    const ownData = await fetchFromTrendStore(sb, from, to, dates);
    const merged = new Map<string, PricePoint>();
    for (const p of ownData) merged.set(p.date, { ...p, source: "trend-store" });

    // ── BACKFILL #1: Sky Scrapper for missing dates ──
    const missingAfterOwn = dates.filter((d) => !merged.has(d));
    let skyscrapper: PricePoint[] = [];
    if (missingAfterOwn.length > 0) {
      skyscrapper = await fetchSkyScrapperGrid(from, to, startDate, body.currency || "USD");
      for (const p of skyscrapper) {
        // Own data wins — only fill genuinely empty days.
        if (!merged.has(p.date)) merged.set(p.date, p);
      }
    } else {
      console.log(`[price-grid] own data fully covered ${dates.length} days for ${from}-${to} — Sky Scrapper skipped`);
    }

    // ── BACKFILL #2: AirScrapper (global-flights-data) for dates still missing ──
    const missingAfterSky = dates.filter((d) => !merged.has(d));
    let airscrapper: PricePoint[] = [];
    if (missingAfterSky.length > 0) {
      airscrapper = await fetchAirScrapperGrid(from, to, startDate, endDate);
      for (const p of airscrapper) {
        if (!merged.has(p.date)) merged.set(p.date, p);
      }
    }

    // ── BACKFILL #3: Aviasales for any dates still missing ──
    const missingAfterAir = dates.filter((d) => !merged.has(d));
    let aviasales: PricePoint[] = [];
    if (missingAfterAir.length > 0) {
      aviasales = await fetchAviasalesGrid(sb, from, to, departDate, startDate, endDate);
      for (const p of aviasales) {
        if (!merged.has(p.date)) merged.set(p.date, p);
      }
    }

    // Persist EVERY future-dated point. Own-data rows are re-stamped into
    // flight_price_cache so the calendar popover query (cache-first) stays fast.
    const finalPoints = Array.from(merged.values()).filter((p) => p.date >= todayIso);
    const trendStore = ownData; // back-compat for the response payload below
    const inserted = await persistPrices(sb, from, to, cabinClass, finalPoints);
    console.log(`[price-grid] persisted ${inserted} points (skyscrapper=${skyscrapper.length}, airscrapper=${airscrapper.length}, aviasales=${aviasales.length}, trend=${trendStore.length}) for ${from}-${to} window=${windowDays}d`);

    return new Response(JSON.stringify({
      success: true,
      fetched: finalPoints.length,
      inserted,
      sources: {
        skyscrapper: skyscrapper.length,
        airscrapper: airscrapper.length,
        aviasales: aviasales.length,
        trend_store: trendStore.length,
      },
      window: { start: startDate, end: endDate, days: dates.length },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[price-grid] error", e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
