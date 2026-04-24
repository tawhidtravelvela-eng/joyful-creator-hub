// Unified flight search edge function
// Orchestrates all providers, normalizes, applies markups/commissions, deduplicates,
// tracks popular routes, and caches prices — all on the backend.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────────────────────────────────────
// Provider masking — emit opaque tokens instead of provider names on the wire.
//   - srcToken   : HMAC-signed encoding of the internal source ('amadeus' | 'tripjack'
//                  | 'travelport' | 'sabre' | 'database'). Frontend treats it as
//                  a black box and round-trips it back with price/book actions.
//   - providerRefs: opaque blob holding raw provider artifacts (priceId, rawOffer,
//                  dictionaries, segments) keyed by neutral names. Frontend forwards
//                  it without inspecting field meanings.
//   - bookingFlow: 'instant' | 'twoStep' | 'verify' — drives frontend booking UX
//                  branching without exposing provider identities.
//   - needsPriceVerification: boolean flag — replaces explicit provider checks
//                  in fare-verification UIs.
// ──────────────────────────────────────────────────────────────────────────────

const SRC_SECRET = Deno.env.get("FLIGHT_SRC_SECRET") || "tv-default-rotate-me-please-2026";

async function hmacBase64Url(input: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SRC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signSrc(source: string): Promise<string> {
  // Token format: base64url(source).base64url(hmac).
  // Salt with a route-fixed prefix so tokens aren't trivially swappable across builds.
  const payload = btoa(`v1:${source}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = await hmacBase64Url(payload);
  return `${payload}.${sig}`;
}

async function verifySrc(token: string | undefined | null): Promise<string | null> {
  if (!token || typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacBase64Url(payload);
  if (sig !== expected) return null;
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    if (!decoded.startsWith("v1:")) return null;
    return decoded.slice(3);
  } catch {
    return null;
  }
}

function bookingFlowFor(source: string, flight: any): "instant" | "twoStep" | "verify" {
  // Tripjack instant-purchase fares (LCC or non-changeable) → 'instant' (charge then book).
  // Tripjack hold-eligible → 'twoStep' (hold PNR then charge).
  // Travelport / Amadeus / Sabre → 'verify' (re-price then book in one shot).
  // Database (own inventory) → 'instant'.
  if (source === "tripjack") {
    const isLcc = !!flight?.isLcc;
    const isa = flight?.tripjackConditions?.isa;
    return (isLcc || isa === false) ? "instant" : "twoStep";
  }
  if (source === "database") return "instant";
  return "verify"; // travelport, amadeus, sabre, anything else
}

function needsPriceVerificationFor(source: string): boolean {
  // Tripjack always re-reviews (separate priceId fetch); Travelport/Amadeus re-price
  // before booking. Database/own inventory and Sabre (revalidates inline) don't.
  return source === "tripjack" || source === "travelport" || source === "amadeus";
}

function buildProviderRefs(source: string, f: any): Record<string, any> {
  // Neutral keys hide provider identity. Backend hydrates back to provider-specific
  // names inside handlePriceAction / handleBookAction.
  const refs: Record<string, any> = {};
  if (f.tripjackPriceId) refs.priceId = f.tripjackPriceId;
  if (f.amadeusRawOffer) refs.rawOffer = f.amadeusRawOffer;
  if (f.amadeusDictionaries) refs.dictionaries = f.amadeusDictionaries;
  if (f.travelportRaw) refs.raw = f.travelportRaw;
  if (f.travelportRawOffer) refs.rawOffer = f.travelportRawOffer;
  // For Travelport/Sabre we also need segments preserved on the wire (already in
  // f.segments) — providerRefs.needsSegments tells the frontend to ship them back.
  if (source === "travelport" || source === "sabre") refs.needsSegments = true;
  return refs;
}

function hydrateProviderFields(internalSource: string, body: any): any {
  // Inverse of buildProviderRefs: when a request comes in with srcToken + providerRefs,
  // expand back into the field names vendor functions expect.
  const refs = body.providerRefs || {};
  const out: any = { ...body, source: internalSource };
  if (internalSource === "tripjack") {
    if (refs.priceId && !out.priceIds && !out.priceId) {
      out.priceIds = [refs.priceId];
      out.priceId = refs.priceId;
    }
  } else if (internalSource === "amadeus") {
    if (refs.rawOffer && !out.rawOffer) out.rawOffer = refs.rawOffer;
    if (refs.dictionaries && !out.dictionaries) out.dictionaries = refs.dictionaries;
  } else if (internalSource === "travelport") {
    if (refs.raw && !out.travelportRaw) out.travelportRaw = refs.raw;
    if (refs.rawOffer && !out.travelportRawOffer) out.travelportRawOffer = refs.rawOffer;
  }
  // Remove opaque tokens from the body forwarded to vendor functions
  delete out.srcToken;
  delete out.providerRefs;
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Wire-strip layer. The frontend has 15+ files that branch on provider names
// (`flight.source === "tripjack"`, `flight.tripjackPriceId`, etc.). To prevent
// supplier names from ever appearing on the network without a risky multi-file
// frontend rewrite, we:
//   1. Replace `source` value with a stable neutral code (`pa`, `pb`, `pc`, …)
//   2. Rename provider-specific keys (`tripjackPriceId`, `amadeusRawOffer`,
//      `travelportRaw`, `travelportRawOffer`, `tripjackConditions`,
//      `tripjackBookingId`, `tripjackTotalPriceInfo`, `tripjackSsrData`,
//      `amadeusDictionaries`) to neutral names prefixed `_p…`.
//   3. Accept either the legacy or the neutral names back on inbound
//      `price`/`book`/`ancillaries`/`fareRules` actions and translate.
// A tiny frontend adapter (src/lib/flightWireAdapter.ts) restores the legacy
// names on the client so existing code paths continue to function.
// ──────────────────────────────────────────────────────────────────────────────

const SOURCE_TO_CODE: Record<string, string> = {
  database: "pa",
  travelport: "pb",
  tripjack: "pc",
  amadeus: "pd",
  sabre: "pe",
};
const CODE_TO_SOURCE: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCE_TO_CODE).map(([k, v]) => [v, k]),
);

const FIELD_TO_NEUTRAL: Record<string, string> = {
  tripjackPriceId: "_pPriceId",
  tripjackBookingId: "_pBookingId",
  tripjackConditions: "_pConditions",
  tripjackTotalPriceInfo: "_pTotalPriceInfo",
  tripjackSsrData: "_pSsrData",
  amadeusRawOffer: "_pRawOffer",
  amadeusDictionaries: "_pDictionaries",
  travelportRaw: "_pRaw",
  travelportRawOffer: "_pRawOffer",
};
const NEUTRAL_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_TO_NEUTRAL).map(([k, v]) => [v, k]),
);

function maskFlightForWire(f: any): any {
  if (!f || typeof f !== "object") return f;
  const out: any = { ...f };
  // 1. Neutralize source
  if (typeof out.source === "string" && SOURCE_TO_CODE[out.source]) {
    out.source = SOURCE_TO_CODE[out.source];
  } else if (typeof out.source === "string" && !["pa","pb","pc","pd","pe"].includes(out.source)) {
    out.source = "pa";
  }
  // 2. Rename provider-specific keys
  for (const [legacy, neutral] of Object.entries(FIELD_TO_NEUTRAL)) {
    if (out[legacy] !== undefined) {
      out[neutral] = out[legacy];
      delete out[legacy];
    }
  }
  // 3. Strip the internal _internalSrc (defined on the unmasked object only)
  delete out._internalSrc;
  // 4. Mask nested segments / multi-city per-leg flights too
  if (Array.isArray(out._legs)) out._legs = out._legs.map(maskFlightForWire);
  if (Array.isArray(out.combo)) out.combo = out.combo.map(maskFlightForWire);
  return out;
}

function unmaskInboundBody(body: any): any {
  if (!body || typeof body !== "object") return body;
  const out: any = { ...body };
  // Source: accept neutral code, legacy name, or srcToken (handled separately).
  if (typeof out.source === "string" && CODE_TO_SOURCE[out.source]) {
    out.source = CODE_TO_SOURCE[out.source];
  }
  // Top-level provider keys
  for (const [neutral, legacy] of Object.entries(NEUTRAL_TO_FIELD)) {
    if (out[neutral] !== undefined && out[legacy] === undefined) {
      out[legacy] = out[neutral];
      delete out[neutral];
    }
  }
  // Nested flight payloads (price/book often forward { flight: {...} } too)
  if (out.flight && typeof out.flight === "object") {
    const f = { ...out.flight };
    if (typeof f.source === "string" && CODE_TO_SOURCE[f.source]) {
      f.source = CODE_TO_SOURCE[f.source];
    }
    for (const [neutral, legacy] of Object.entries(NEUTRAL_TO_FIELD)) {
      if (f[neutral] !== undefined && f[legacy] === undefined) {
        f[legacy] = f[neutral];
        delete f[neutral];
      }
    }
    out.flight = f;
  }
  return out;
}

// ── Rate limiter ──
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ── Search result cache (TTL based on days-to-departure) ──
// Two-tier: in-memory Map (hot, per-instance) + flight_search_cache table (warm, cross-instance).
interface CachedSearch { data: any; storedAt: number; ttlMs: number }
const searchCache = new Map<string, CachedSearch>();
const MAX_CACHE_ENTRIES = 200;

async function readDbSearchCache(sb: any, cacheKey: string): Promise<any | null> {
  try {
    const { data } = await sb
      .from("flight_search_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return data?.payload ?? null;
  } catch (e) {
    console.warn("[unified] db cache read failed:", (e as Error).message);
    return null;
  }
}

async function writeDbSearchCache(
  sb: any,
  cacheKey: string,
  body: any,
  payload: any,
  ttlMs: number,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await sb.from("flight_search_cache").upsert({
      cache_key: cacheKey,
      from_code: body.from || (body.legs?.[0]?.from ?? ""),
      to_code: body.to || (body.legs?.[body.legs.length - 1]?.to ?? ""),
      depart_date: body.departDate || body.legs?.[0]?.date || null,
      return_date: body.returnDate || null,
      tenant_id: body.tenant_id || null,
      result_count: Array.isArray(payload?.flights) ? payload.flights.length : 0,
      payload,
      expires_at: expiresAt,
    }, { onConflict: "cache_key" });
  } catch (e) {
    console.warn("[unified] db cache write failed:", (e as Error).message);
  }
}

function getSearchCacheTtlMs(departDate: string): number {
  const now = new Date();
  const dep = new Date(departDate + "T00:00:00");
  const daysOut = Math.max(0, Math.floor((dep.getTime() - now.getTime()) / 86_400_000));

  if (daysOut === 0) return 5 * 60_000;          // same day: 5 min
  if (daysOut <= 3) return 30 * 60_000;           // within 3 days: 30 min
  if (daysOut <= 7) return 60 * 60_000;           // within 7 days: 1 hour
  if (daysOut <= 14) return 6 * 3_600_000;        // within 14 days: 6 hours
  if (daysOut <= 30) return 12 * 3_600_000;       // within a month: 12 hours
  if (daysOut <= 90) return 24 * 3_600_000;       // within 3 months: 24 hours
  return 7 * 24 * 3_600_000;                      // beyond 3 months: 7 days
}

function buildSearchCacheKey(body: any): string {
  const parts = [
    body.from, body.to, body.departDate, body.returnDate || "",
    body.adults || 1, body.children || 0, body.infants || 0,
    body.cabinClass || "", body.directFlight ? "D" : "",
    body.studentFare ? "S" : "", body.currency || "BDT",
    body.tenant_id || "",
  ];
  if (body.legs?.length) {
    for (const l of body.legs) parts.push(`${l.from}-${l.to}-${l.date}`);
  }
  return parts.join("|");
}

function pruneSearchCache() {
  if (searchCache.size <= MAX_CACHE_ENTRIES) return;
  // Evict oldest entries
  const entries = [...searchCache.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt);
  const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
  for (const [key] of toRemove) searchCache.delete(key);
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Helper functions ──

function toFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeApiFareFields(f: any): { basePrice: number | undefined; taxes: number | undefined } {
  const basePrice =
    toFiniteNumber(f?.basePrice) ??
    toFiniteNumber(f?.base_price) ??
    toFiniteNumber(f?.baseFare);

  const taxes =
    toFiniteNumber(f?.taxes) ??
    toFiniteNumber(f?.tax) ??
    toFiniteNumber(f?.taxesAmount) ??
    toFiniteNumber(f?.taxes_amount);

  return { basePrice, taxes };
}

function flightDeduplicationKey(f: any): string {
  if (f.segments?.length) {
    return f.segments
      .map((s: any) => `${s.carrier || s.airline || f.airline}-${s.flightNumber || ""}-${s.departure}`)
      .join("|");
  }
  return `${f.airline}-${f.flightNumber || ""}-${f.departure}-${f.arrival}`;
}

function computeTotalFare(flight: any, adults: number, children: number, infants: number): number {
  const paxP = flight.paxPricing;
  const hasApi = flight.basePrice !== undefined && flight.taxes !== undefined;
  const aBase = Math.round(hasApi ? flight.basePrice : Number(flight.price));
  const aTax = Math.round(hasApi ? flight.taxes : 0);
  const adultPrice = aBase + aTax;
  const cBase = paxP?.CHD ? Math.round(paxP.CHD.base) : (hasApi ? Math.round(aBase * 0.75) : null);
  const cTax = paxP?.CHD ? Math.round(paxP.CHD.taxes) : (hasApi ? Math.round(aTax * 0.75) : null);
  const childPrice = cBase != null && cTax != null ? cBase + cTax : Math.round(adultPrice * 0.75);
  const iBase = paxP?.INF ? Math.round(paxP.INF.base) : (hasApi ? Math.round(aBase * 0.10) : null);
  const iTax = paxP?.INF ? Math.round(paxP.INF.taxes) : (hasApi ? Math.round(aTax * 0.10) : null);
  const infantPrice = iBase != null && iTax != null ? iBase + iTax : Math.round(adultPrice * 0.10);
  return adultPrice * adults + childPrice * children + infantPrice * infants;
}

// Per-currency sanity floor for trend storage. Anything below the floor for
// a given currency is almost certainly mis-labelled (a USD value tagged BDT,
// or a per-segment leg price instead of a full fare). Rejected rows do NOT
// enter flight_price_trends — they would otherwise poison the long-term
// median that drives the "below typical" verdict and the calendar popover.
//
// Floors are deliberately conservative: a real intra-Asia economy one-way is
// very unlikely to be cheaper than ~30 USD / 2,500 INR / 2,500 BDT / 25 EUR.
// We compare against the per-adult amount (totalPrice / pax) so multi-pax
// totals don't accidentally trip the guard.
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
  if (perAdult > 5_000_000) return false; // absurd upper bound
  const cur = String(currency || "").toUpperCase();
  const floor = TREND_MIN_PER_ADULT[cur];
  if (floor == null) return perAdult >= 10; // unknown currency: only block obvious junk
  return perAdult >= floor;
}

// ── Provider config ──

interface PerApiMarkup {
  global: number;
  airlines: Record<string, number>;
}

interface AitConfig {
  enabled: boolean;
  perApi: Record<string, number>; // e.g. { travelport: 0.3, amadeus: 0.5 }
}

interface ProviderConfig {
  showLocalInventory: boolean;
  travelportEnabled: boolean;
  amadeusEnabled: boolean;
  tripjackFlightEnabled: boolean;
  sabreEnabled: boolean;
  travelportStudentFare: boolean;
  amadeusStudentFare: boolean;
  tripjackStudentFare: boolean;
  sabreStudentFare: boolean;
  perApiMarkups: Record<string, PerApiMarkup>;
  commissionRules: { airline_code: string; api_source: string; commission_pct: number; markup_pct: number; origin?: string; destination?: string; type?: string; profit_type?: string; module?: string }[];
  ait: AitConfig;
}

async function loadProviderConfig(sb: any): Promise<ProviderConfig> {
  const config: ProviderConfig = {
    showLocalInventory: true,
    travelportEnabled: false,
    amadeusEnabled: false,
    tripjackFlightEnabled: false,
    sabreEnabled: false,
    travelportStudentFare: false,
    amadeusStudentFare: false,
    tripjackStudentFare: false,
    sabreStudentFare: false,
    perApiMarkups: {
      travelport: { global: 0, airlines: {} },
      amadeus: { global: 0, airlines: {} },
      tripjack: { global: 0, airlines: {} },
      sabre: { global: 0, airlines: {} },
    },
    commissionRules: [],
    ait: { enabled: false, perApi: { travelport: 0, amadeus: 0, tripjack: 0, sabre: 0 } },
  };

  const { data: settings } = await sb.from("api_settings").select("provider, is_active, settings");
  if (settings) {
    for (const s of settings) {
      if (s.provider === "local_inventory") config.showLocalInventory = s.is_active;
      if (s.provider === "travelport") {
        config.travelportEnabled = s.is_active;
        config.travelportStudentFare = !!(s.settings as any)?.student_fare_enabled;
      }
      if (s.provider === "amadeus") {
        config.amadeusEnabled = s.is_active;
        config.amadeusStudentFare = !!(s.settings as any)?.student_fare_enabled;
      }
      // travelvela removed
      if (s.provider === "tripjack_flight") {
        config.tripjackFlightEnabled = s.is_active;
        config.tripjackStudentFare = !!(s.settings as any)?.student_fare_enabled;
      }
      if (s.provider === "sabre") {
        config.sabreEnabled = s.is_active;
        config.sabreStudentFare = !!(s.settings as any)?.student_fare_enabled;
      }
      if (s.provider === "api_markup") {
        const m = s.settings as any;
        if (m?.per_api) {
          // New per-API format
          config.perApiMarkups = m.per_api;
        } else {
          // Legacy: single global for all
          const legacy: PerApiMarkup = { global: m?.markup_percentage || 0, airlines: m?.airline_markups || {} };
          config.perApiMarkups = {
            travelport: { ...legacy },
            amadeus: { global: legacy.global, airlines: {} },
            tripjack: { global: legacy.global, airlines: {} },
            sabre: { global: legacy.global, airlines: {} },
          };
        }
      }
      if (s.provider === "airline_commissions") {
        config.commissionRules = ((s.settings as any)?.rules || []);
      }
      if (s.provider === "ait_settings") {
        config.ait.enabled = s.is_active;
        const aitData = s.settings as any;
        if (aitData?.per_api) config.ait.perApi = aitData.per_api;
      }
    }
  }
  return config;
}

function getApiMarkup(config: ProviderConfig, airlineCode: string, apiSource: string): number {
  const apiConfig = config.perApiMarkups[apiSource];
  if (!apiConfig) return 0;
  if (apiConfig.airlines[airlineCode] !== undefined) return apiConfig.airlines[airlineCode];
  return apiConfig.global;
}

function applyCommissionMarkup(
  basePrice: number,
  airlineCode: string,
  apiSource: string,
  rules: ProviderConfig["commissionRules"],
  originCode?: string,
  destinationCode?: string
): number {
  // Find best matching rule: specific origin+dest > origin only > global (no origin/dest)
  const candidates = rules.filter(r => {
    if (r.airline_code !== airlineCode) return false;
    if (r.api_source !== apiSource && r.api_source !== "all") return false;
    if (r.module && r.module !== "flights") return false;
    // Origin filter
    if (r.origin && originCode && r.origin !== originCode) return false;
    if (r.origin && !originCode) return false;
    // Destination filter
    if (r.destination && destinationCode && r.destination !== destinationCode) return false;
    if (r.destination && !destinationCode) return false;
    return true;
  });

  // Score: specific api_source > "all", origin match > no origin, dest match > no dest
  const scored = candidates.map(r => {
    let score = 0;
    if (r.api_source === apiSource) score += 100;
    if (r.origin && r.origin === originCode) score += 10;
    if (r.destination && r.destination === destinationCode) score += 5;
    return { rule: r, score };
  }).sort((a, b) => b.score - a.score);

  const rule = scored[0]?.rule;
  if (!rule) return basePrice;

  const isFixed = rule.profit_type === "fixed";
  const ruleType = rule.type || "commission";

  if (ruleType === "commission") {
    const amount = isFixed ? rule.commission_pct : basePrice * (rule.commission_pct / 100);
    return Math.round((basePrice - amount) * 100) / 100;
  } else {
    // markup type
    const amount = isFixed ? rule.markup_pct : basePrice * (rule.markup_pct / 100);
    return Math.round((basePrice + amount) * 100) / 100;
  }
}

// ── Internal edge function caller ──

async function callEdgeFunction(functionName: string, body: any, timeoutOverrideMs?: number): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const controller = new AbortController();
  const timeoutMs = timeoutOverrideMs || 25_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[unified] ${functionName} HTTP ${response.status}: ${text}`);
      return null;
    }

    return await response.json();
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "AbortError";
    if (timedOut) {
      console.error(`[unified] ${functionName} timeout after ${timeoutMs}ms`);
    } else {
      console.error(`[unified] ${functionName} error:`, e);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Process provider results ──

function hasAirlineSpecificRule(
  airlineCode: string,
  apiSource: string,
  rules: ProviderConfig["commissionRules"],
  perApiMarkups: ProviderConfig["perApiMarkups"],
  originCode?: string,
  destinationCode?: string
): boolean {
  // Check if there's a commission rule for this airline
  const hasCommRule = rules.some(r => {
    if (r.airline_code !== airlineCode) return false;
    if (r.api_source !== apiSource && r.api_source !== "all") return false;
    if (r.module && r.module !== "flights") return false;
    if (r.origin && originCode && r.origin !== originCode) return false;
    if (r.origin && !originCode) return false;
    if (r.destination && destinationCode && r.destination !== destinationCode) return false;
    if (r.destination && !destinationCode) return false;
    return true;
  });
  if (hasCommRule) return true;
  // Check if there's an airline-specific API markup override
  const apiConfig = perApiMarkups[apiSource];
  if (apiConfig && apiConfig.airlines[airlineCode] !== undefined) return true;
  return false;
}

async function processProviderFlights(
  flights: any[],
  source: string,
  config: ProviderConfig,
  searchOrigin?: string,
  searchDestination?: string
): Promise<any[]> {
  // Sign once per source — same token for all flights from the same provider in
  // a given response. Frontend treats it as opaque; backend verifies on price/book.
  const srcToken = await signSrc(source);
  return flights.map((f: any) => {
    const { basePrice: rawBase, taxes } = normalizeApiFareFields(f);
    const flightOrigin = f.from_code || f.from || searchOrigin || "";
    const flightDest = f.to_code || f.to || searchDestination || "";

    // If this airline has a specific commission/markup rule, skip global markup
    const hasSpecificRule = hasAirlineSpecificRule(
      f.airline, source, config.commissionRules, config.perApiMarkups, flightOrigin, flightDest
    );

    const adjustedBase = rawBase != null
      ? applyCommissionMarkup(rawBase, f.airline, source, config.commissionRules, flightOrigin, flightDest)
      : undefined;
    const adjustedTotal = adjustedBase != null && taxes != null ? adjustedBase + taxes : f.price;
    const rawApiPrice = f.price;

    // Only apply global API markup if NO airline-specific rule exists
    const m = hasSpecificRule ? 0 : getApiMarkup(config, f.airline, source);
    const appliedMarkupPct = m;
    const markupMultiplier = m > 0 ? (1 + m / 100) : 1;

    const finalBase = adjustedBase != null ? Math.round(adjustedBase * markupMultiplier) : undefined;
    const finalTaxes = taxes != null ? Math.round(taxes * markupMultiplier) : undefined;
    const finalPrice = (finalBase != null && finalTaxes != null) 
      ? finalBase + finalTaxes 
      : Math.round(adjustedTotal * markupMultiplier);

    // Inject classOfBooking into segments for tripjack
    const segments = source === "tripjack" && f.segments
      ? f.segments.map((seg: any) => ({
          ...seg,
          bookingCode: seg.bookingCode || f.classOfBooking || undefined,
        }))
      : f.segments;

    // ── AIT calculation ──
    // AIT % is applied to total fare (base + taxes) and ALWAYS added on top.
    let aitAmount = 0;
    const aitPct = config.ait.enabled ? (config.ait.perApi[source] || 0) : 0;
    let displayPrice = finalPrice;
    let displayBase = finalBase;
    if (aitPct > 0) {
      aitAmount = Math.round(finalPrice * (aitPct / 100));
      displayPrice = finalPrice + aitAmount;
      if (displayBase != null) {
        displayBase = finalBase! + aitAmount;
      }
    }

    // ── Normalize paxPricing: ensure EVERY flight has a consistent paxPricing object ──
    let paxPricing = f.paxPricing ? { ...f.paxPricing } : null;

    // Build paxPricing from Tripjack's adultFare/childFare/infantFare if not already present
    if (!paxPricing && f.adultFare) {
      paxPricing = {
        ADT: { base: f.adultFare.baseFare || 0, taxes: f.adultFare.taxes || 0, total: f.adultFare.totalFare || 0 },
      };
      if (f.childFare) {
        paxPricing.CHD = { base: f.childFare.baseFare || 0, taxes: f.childFare.taxes || 0, total: f.childFare.totalFare || 0 };
      }
      if (f.infantFare) {
        paxPricing.INF = { base: f.infantFare.baseFare || 0, taxes: f.infantFare.taxes || 0, total: f.infantFare.totalFare || 0 };
      }
    }

    // If still no paxPricing, synthesize from basePrice/taxes (per-adult)
    if (!paxPricing && rawBase != null && taxes != null) {
      paxPricing = {
        ADT: { base: rawBase, taxes, total: rawBase + taxes },
      };
    }

    // Apply markup + AIT to paxPricing entries
    if (paxPricing) {
      const newPax: any = {};
      for (const [type, pricing] of Object.entries(paxPricing as Record<string, any>)) {
        let adjBase = pricing.base;
        // Apply commission markup to base
        if (adjBase != null) {
          adjBase = applyCommissionMarkup(adjBase, f.airline, source, config.commissionRules, flightOrigin, flightDest);
        }
        // Apply global API markup
        const mBase = adjBase != null ? Math.round(adjBase * markupMultiplier) : Math.round(pricing.base * markupMultiplier);
        const mTaxes = Math.round(pricing.taxes * markupMultiplier);
        let pBase = mBase;
        let pTotal = mBase + mTaxes;
        // Apply AIT on top
        if (aitPct > 0) {
          const paxAit = Math.round(pTotal * (aitPct / 100));
          pBase = mBase + paxAit;
          pTotal = pTotal + paxAit;
        }
        newPax[type] = { base: pBase, taxes: mTaxes, total: pTotal };
      }
      paxPricing = newPax;
    }

    // Build opaque provider refs BEFORE cleaning provider-specific fields off the wire.
    const providerRefs = buildProviderRefs(source, f);
    const bookingFlow = bookingFlowFor(source, f);
    const needsPriceVerification = needsPriceVerificationFor(source);

    // Clean up provider-specific fare fields — frontend only needs paxPricing,
    // and provider identity is hidden behind srcToken + providerRefs + bookingFlow.
    const result: any = {
      ...f,
      segments,
      basePrice: displayBase,
      taxes: finalTaxes,
      price: displayPrice,
      rawApiPrice,
      appliedMarkupPct,
      aitAmount,
      aitPct,
      // Opaque provider identity — frontend never sees the real source name.
      srcToken,
      providerRefs,
      bookingFlow,
      needsPriceVerification,
      paxPricing: paxPricing || null,
    };
    // TRANSITIONAL: legacy provider-name fields are kept on the wire so existing
    // frontend code paths continue working until the matching frontend swap
    // (FlightBooking/Flights/FlightDetailsPanel/etc.) lands. Once the frontend
    // reads exclusively from srcToken + providerRefs + bookingFlow, the deletes
    // below should be re-enabled to fully strip provider names from the payload.
    //
    //   delete result.source;
    //   delete result.tripjackPriceId;
    //   delete result.amadeusRawOffer;
    //   delete result.amadeusDictionaries;
    //   delete result.travelportRaw;
    //   delete result.travelportRawOffer;
    //
    // Internal-only cleanup (these never appear on the wire today, safe to drop).
    delete result.adultFare;
    delete result.childFare;
    delete result.infantFare;
    // Always force `source` to match the signed token's source so downstream
    // currency-conversion / cache-tracking remains consistent.
    result.source = source;
    // Hidden internal source — kept for backend-only multi-city builders below.
    // Stripped again on the final response just before send.
    Object.defineProperty(result, "_internalSrc", {
      value: source, enumerable: false, writable: false, configurable: true,
    });

    return result;
  });
}

// ── Currency conversion ──

const DEFAULT_SOURCE_CURRENCIES: Record<string, string> = {
  tripjack: "INR",
  travelport: "BDT",
  amadeus: "USD",
  sabre: "USD",
  database: "USD",
};

const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, BDT: 110.5, INR: 83, CNY: 7.24,
};

interface ExchangeConfig {
  rates: Record<string, number>;
  markup: number;
  sourceCurrencies: Record<string, string>;
}

async function loadExchangeConfig(sb: any): Promise<ExchangeConfig> {
  const config: ExchangeConfig = {
    rates: { ...DEFAULT_EXCHANGE_RATES },
    markup: 0,
    sourceCurrencies: { ...DEFAULT_SOURCE_CURRENCIES },
  };
  try {
    const { data } = await sb
      .from("api_settings")
      .select("settings")
      .eq("provider", "currency_rates")
      .maybeSingle();
    if (data?.settings) {
      const s = data.settings as any;
      if (s.live_rates) config.rates = { ...config.rates, ...s.live_rates };
      if (s.conversion_markup !== undefined) config.markup = s.conversion_markup;
      if (s.api_source_currencies) config.sourceCurrencies = { ...config.sourceCurrencies, ...s.api_source_currencies };
    }
  } catch {}
  return config;
}

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>, markup: number): number {
  if (fromCurrency === toCurrency) return Math.round(amount);
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  const markupMultiplier = 1 + markup / 100;
  return Math.round((amount / fromRate) * toRate * markupMultiplier);
}

function convertFlightPrices(flight: any, targetCurrency: string, exchangeConfig: ExchangeConfig): any {
  // Source is stripped from the wire payload but preserved internally on _internalSrc
  // (non-enumerable). Fall back to "database" for own-inventory rows.
  const source = flight._internalSrc || flight.source || "database";
  const fromCurrency = exchangeConfig.sourceCurrencies[source] || "USD";

  // Always preserve the original API price & currency for admin reference
  const converted = {
    ...flight,
    originalCurrency: fromCurrency,
    originalPrice: flight.price != null ? Math.round(Number(flight.price)) : undefined,
    originalBasePrice: flight.basePrice != null ? Math.round(Number(flight.basePrice)) : undefined,
    originalTaxes: flight.taxes != null ? Math.round(Number(flight.taxes)) : undefined,
  };

  if (fromCurrency === targetCurrency) {
    return { ...converted, currency: targetCurrency };
  }
  
  const convert = (amount: number) => convertAmount(amount, fromCurrency, targetCurrency, exchangeConfig.rates, exchangeConfig.markup);
  converted.currency = targetCurrency;
  
  // Convert base and taxes first, then derive price from their sum to ensure consistency
  if (converted.basePrice != null) converted.basePrice = convert(converted.basePrice);
  if (converted.taxes != null) converted.taxes = convert(converted.taxes);
  // Price must equal basePrice + taxes to prevent rounding discrepancies
  if (converted.basePrice != null && converted.taxes != null) {
    converted.price = converted.basePrice + converted.taxes;
  } else if (converted.price != null) {
    converted.price = convert(converted.price);
  }
  if (converted.rawApiPrice != null) converted.rawApiPrice = convert(converted.rawApiPrice);
  // Convert totalPrice (all-pax grand total)
  if (converted.totalPrice != null) converted.totalPrice = convert(converted.totalPrice);
  
  // Convert paxPricing (preserve originals)
  if (converted.paxPricing) {
    const newPax: any = {};
    for (const [type, pricing] of Object.entries(converted.paxPricing as Record<string, any>)) {
      const convertedBase = convert(pricing.base);
      const convertedTaxes = convert(pricing.taxes);
      newPax[type] = {
        base: convertedBase,
        taxes: convertedTaxes,
        total: convertedBase + convertedTaxes, // Derive from components to ensure consistency
      };
    }
    converted.originalPaxPricing = { ...converted.paxPricing };
    converted.paxPricing = newPax;
  }
  
  return converted;
}

// ── Main search logic ──

interface SearchRequest {
  mode?: "search" | "date-prices";
  from: string;
  to: string;
  departDate: string;
  returnDate?: string | null;
  adults: number;
  children?: number;
  infants?: number;
  cabinClass?: string;
  directFlight?: boolean;
  studentFare?: boolean;
  legs?: { from: string; to: string; date: string }[];
  // For date-prices mode
  dates?: string[];
  // Tenant support
  tenant_id?: string;
  // Target display currency
  currency?: string;
}

// ── Tenant API settings loader ──

interface TenantProviderOverride {
  travelportCredentials?: any;
  amadeusCredentials?: any;
  sabreCredentials?: any;
  travelportEnabled: boolean;
  amadeusEnabled: boolean;
  sabreEnabled: boolean;
}

async function loadTenantOverrides(sb: any, tenantId: string): Promise<TenantProviderOverride | null> {
  const { data: rows } = await sb
    .from("tenant_api_settings")
    .select("provider, is_active, settings")
    .eq("tenant_id", tenantId);

  if (!rows || rows.length === 0) return null;

  const overrides: TenantProviderOverride = {
    travelportEnabled: false,
    amadeusEnabled: false,
    sabreEnabled: false,
  };

  let hasAny = false;
  for (const row of rows) {
    if (row.provider === "travelport" && row.is_active) {
      overrides.travelportEnabled = true;
      overrides.travelportCredentials = row.settings;
      hasAny = true;
    }
    if (row.provider === "amadeus" && row.is_active) {
      overrides.amadeusEnabled = true;
      overrides.amadeusCredentials = row.settings;
      hasAny = true;
    }
    if (row.provider === "sabre" && row.is_active) {
      overrides.sabreEnabled = true;
      overrides.sabreCredentials = row.settings;
      hasAny = true;
    }
  }

  return hasAny ? overrides : null;
}

// ── Provider group loader for white-label tenants ──

interface ProviderGroupConfig {
  travelport: boolean;
  amadeus: boolean;
  tripjack: boolean;
  sabre: boolean;
}

async function loadTenantProviderGroup(sb: any, tenantId: string): Promise<ProviderGroupConfig | null> {
  const { data: tenant } = await sb
    .from("tenants")
    .select("provider_group_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant?.provider_group_id) return null;

  const { data: group } = await sb
    .from("provider_groups")
    .select("providers")
    .eq("id", tenant.provider_group_id)
    .maybeSingle();

  if (!group?.providers) return null;

  const p = group.providers as Record<string, boolean>;
  return {
    travelport: !!p.travelport,
    amadeus: !!p.amadeus,
    tripjack: !!p.tripjack,
    sabre: !!p.sabre,
  };
}

// ── Quality scoring for journey combinations ──

interface LegCandidate {
  flight: any;
  qualityScore: number; // 0-100, higher is better
}

function scoreLegCandidate(f: any, allInLeg: any[]): number {
  if (allInLeg.length === 0) return 50;
  
  // Price score (0-40): how cheap relative to leg's range
  const prices = allInLeg.map((x: any) => x.price || Infinity);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  const priceScore = 40 * (1 - ((f.price || maxPrice) - minPrice) / priceRange);

  // Duration score (0-25): shorter is better
  const durations = allInLeg.map((x: any) => {
    const segs = x.segments || [];
    return segs.reduce((sum: number, s: any) => sum + (s.durationMinutes || 0) + (s.cT || 0), 0) || 999;
  });
  const minDur = Math.min(...durations);
  const maxDur = Math.max(...durations);
  const durRange = maxDur - minDur || 1;
  const flightDur = (f.segments || []).reduce((sum: number, s: any) => sum + (s.durationMinutes || 0) + (s.cT || 0), 0) || 999;
  const durationScore = 25 * (1 - (flightDur - minDur) / durRange);

  // Stops score (0-20): fewer stops is better
  const stops = f.stops ?? (f.segments ? Math.max(0, f.segments.length - 1) : 0);
  const stopsScore = stops === 0 ? 20 : stops === 1 ? 12 : stops === 2 ? 5 : 0;

  // Refundability bonus (0-10)
  const refundScore = f.isRefundable ? 10 : f.isPartialRefundable ? 5 : 0;

  // LCC penalty (0-5): full-service carriers get bonus
  const lccScore = f.isLcc ? 0 : 5;

  return Math.round(priceScore + durationScore + stopsScore + refundScore + lccScore);
}

function getFlightDuration(f: any): number {
  return (f.segments || []).reduce((sum: number, s: any) => sum + (s.durationMinutes || 0) + (s.cT || 0), 0) || 9999;
}

function getFlightStops(f: any): number {
  return f.stops ?? (f.segments ? Math.max(0, f.segments.length - 1) : 0);
}

function buildCombinedFlight(
  combo: any[],
  legs: { from: string; to: string; date: string }[],
  category: string
): any {
  const first = combo[0];
  const lastFlight = combo[combo.length - 1];
  const allSegments = combo.flatMap((f: any, i: number) =>
    (f.segments || []).map((s: any) => ({ ...s, group: i }))
  );
  const totalPrice = combo.reduce((sum: number, f: any) => sum + (f.price || 0), 0);
  const totalBasePrice = combo.reduce((sum: number, f: any) => sum + (f.basePrice || 0), 0);
  const totalTaxes = combo.reduce((sum: number, f: any) => sum + (f.taxes || 0), 0);
  const totalPriceAll = combo.reduce((sum: number, f: any) => sum + (f.totalPrice || f.price || 0), 0);
  const totalDuration = combo.reduce((sum: number, f: any) => sum + getFlightDuration(f), 0);

  return {
    ...first,
    id: `mc-${category}-${combo.map((f: any) => f.providerRefs?.priceId || f.id).join("-")}`,
    segments: allSegments,
    price: totalPrice,
    totalPrice: totalPriceAll,
    basePrice: totalBasePrice,
    taxes: totalTaxes,
    tripSection: "MULTI_CITY",
    journeyCategory: category,
    totalDurationMinutes: totalDuration,
    // multiCityPriceIds kept under providerRefs to avoid leaking provider name.
    providerRefs: {
      ...(first.providerRefs || {}),
      multiCityPriceIds: combo.map((f: any) => f.providerRefs?.priceId).filter(Boolean),
    },
    multiCityLegs: combo.map((f: any, i: number) => ({
      legIndex: i,
      from: legs[i]?.from || f.from_city,
      to: legs[i]?.to || f.to_city,
      date: legs[i]?.date,
      airline: f.airline,
      flightNumber: f.flightNumber,
      price: f.price,
      // Per-leg srcToken (opaque) — provider name is hidden.
      srcToken: f.srcToken,
      legPriceId: f.providerRefs?.priceId,
      sri: f.sri,
      msri: f.msri,
    })),
    to_city: lastFlight.to_city,
  };
}

function combineMultiCityLegs(
  legResults: any[][],
  legs: { from: string; to: string; date: string }[]
): any[] {
  if (legResults.length === 0 || legResults.some(l => l.length === 0)) return [];

  const numLegs = legResults.length;

  // ── Step 1: Per-leg shortlisting ──
  // For each leg, pick diverse top candidates across dimensions
  const perLeg: any[][] = legResults.map(flights => {
    // Sort copies for each dimension
    const byPrice = [...flights].sort((a, b) => (a.price || 0) - (b.price || 0));
    const byDuration = [...flights].sort((a, b) => getFlightDuration(a) - getFlightDuration(b));
    const byComfort = [...flights].sort((a, b) => {
      // Comfort: fewer stops, full-service, refundable, then shorter
      const aScore = getFlightStops(a) * 100 + (a.isLcc ? 50 : 0) + (!a.isRefundable ? 20 : 0) + getFlightDuration(a) * 0.01;
      const bScore = getFlightStops(b) * 100 + (b.isLcc ? 50 : 0) + (!b.isRefundable ? 20 : 0) + getFlightDuration(b) * 0.01;
      return aScore - bScore;
    });

    // Collect unique candidates: top 3 cheapest, top 3 fastest, top 4 most comfortable
    const seen = new Set<string>();
    const candidates: any[] = [];
    const addUnique = (f: any) => {
      const key = `${f.airline}-${f.flightNumber}-${f.departure}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(f);
      }
    };
    byPrice.slice(0, 3).forEach(addUnique);
    byDuration.slice(0, 3).forEach(addUnique);
    byComfort.slice(0, 4).forEach(addUnique);
    return candidates;
  });

  // ── Step 2: Generate all combinations (capped) ──
  const allCombos: any[][] = [];
  const MAX_COMBOS = 100;

  function generate(legIdx: number, current: any[]) {
    if (allCombos.length >= MAX_COMBOS) return;
    if (legIdx >= numLegs) {
      allCombos.push([...current]);
      return;
    }
    for (const flight of perLeg[legIdx]) {
      current.push(flight);
      generate(legIdx + 1, current);
      current.pop();
    }
  }
  generate(0, []);

  if (allCombos.length === 0) return [];

  // ── Step 3: Score each combination on multiple dimensions ──
  const scored = allCombos.map(combo => {
    const totalPrice = combo.reduce((s, f) => s + (f.price || 0), 0);
    const totalDuration = combo.reduce((s, f) => s + getFlightDuration(f), 0);
    const totalStops = combo.reduce((s, f) => s + getFlightStops(f), 0);
    const allFullService = combo.every(f => !f.isLcc);
    const allRefundable = combo.every(f => f.isRefundable);
    const airlines = new Set(combo.map(f => f.airline));
    const sameAirline = airlines.size === 1;
    const directAll = totalStops === 0;

    // Comfort score (higher = more comfortable)
    let comfortScore = 0;
    if (directAll) comfortScore += 40;
    else if (totalStops <= numLegs) comfortScore += 20;
    if (allFullService) comfortScore += 25;
    if (allRefundable) comfortScore += 15;
    if (sameAirline) comfortScore += 10;
    // Shorter duration = more comfortable
    comfortScore += Math.max(0, 10 - totalDuration / 120);

    // Value score: balance of price and comfort
    const valueScore = comfortScore * 0.5 - totalPrice * 0.0001;

    return { combo, totalPrice, totalDuration, totalStops, comfortScore, valueScore, sameAirline };
  });

  // ── Step 4: Curate categories ──
  const results: any[] = [];
  const usedKeys = new Set<string>();
  const comboKey = (combo: any[]) => combo.map(f => `${f.airline}${f.flightNumber}-${f.departure}`).join("|");

  const addResult = (combo: any[], category: string) => {
    const key = comboKey(combo);
    if (usedKeys.has(key)) return false;
    usedKeys.add(key);
    results.push(buildCombinedFlight(combo, legs, category));
    return true;
  };

  // CHEAPEST (1-2): lowest total price
  const byPrice = [...scored].sort((a, b) => a.totalPrice - b.totalPrice);
  let cheapestCount = 0;
  for (const s of byPrice) {
    if (cheapestCount >= 2) break;
    if (addResult(s.combo, "cheapest")) cheapestCount++;
  }

  // FASTEST (1-2): shortest total duration
  const bySpeed = [...scored].sort((a, b) => a.totalDuration - b.totalDuration);
  let fastestCount = 0;
  for (const s of bySpeed) {
    if (fastestCount >= 2) break;
    if (addResult(s.combo, "fastest")) fastestCount++;
  }

  // BEST VALUE (1-2): best balance of price + comfort
  const byValue = [...scored].sort((a, b) => b.valueScore - a.valueScore);
  let valueCount = 0;
  for (const s of byValue) {
    if (valueCount >= 2) break;
    if (addResult(s.combo, "best_value")) valueCount++;
  }

  // MOST COMFORTABLE (3-4): highest comfort score, diverse airlines
  const byComfort = [...scored].sort((a, b) => b.comfortScore - a.comfortScore);
  let comfortCount = 0;
  const comfortAirlines = new Set<string>();
  for (const s of byComfort) {
    if (comfortCount >= 4) break;
    // Ensure airline diversity in comfort picks
    const airlineKey = [...new Set(s.combo.map(f => f.airline))].sort().join("+");
    if (comfortCount >= 2 && comfortAirlines.has(airlineKey)) continue;
    if (addResult(s.combo, "comfortable")) {
      comfortCount++;
      comfortAirlines.add(airlineKey);
    }
  }

  console.log(`[unified] multi-city curated: ${cheapestCount} cheapest, ${fastestCount} fastest, ${valueCount} best_value, ${comfortCount} comfortable = ${results.length} total`);
  return results;
}

async function performSearch(
  body: SearchRequest,
  config: ProviderConfig,
  sb: any,
  tenantOverrides?: TenantProviderOverride | null,
  providerGroup?: ProviderGroupConfig | null
): Promise<any[]> {
  const hasBYOK = !!tenantOverrides;
  const hasGroup = !!providerGroup;
  const isMultiCity = body.legs && body.legs.length >= 2;

  // ── Determine which providers to use ──
  let useLocalInventory: boolean;
  let useTravelport: boolean;
  let useAmadeus: boolean;
  let useTripjack: boolean;
  let useSabre: boolean;

  if (hasBYOK) {
    useLocalInventory = false;
    useTravelport = tenantOverrides?.travelportEnabled ?? false;
    useAmadeus = tenantOverrides?.amadeusEnabled ?? false;
    useTripjack = false;
    useSabre = tenantOverrides?.sabreEnabled ?? false;
  } else if (hasGroup) {
    useLocalInventory = false;
    useTravelport = providerGroup!.travelport && config.travelportEnabled;
    useAmadeus = providerGroup!.amadeus && config.amadeusEnabled;
    useTripjack = providerGroup!.tripjack && config.tripjackFlightEnabled;
    useSabre = providerGroup!.sabre && config.sabreEnabled;
  } else {
    useLocalInventory = config.showLocalInventory;
    useTravelport = config.travelportEnabled;
    useAmadeus = config.amadeusEnabled;
    useTripjack = config.tripjackFlightEnabled;
    useSabre = config.sabreEnabled;
  }

  const isStudentFare = body.studentFare === true;
  if (isStudentFare) {
    useLocalInventory = false;
    if (!config.travelportStudentFare) useTravelport = false;
    if (!config.amadeusStudentFare) useAmadeus = false;
    if (!config.tripjackStudentFare) useTripjack = false;
    if (!config.sabreStudentFare) useSabre = false;
    console.log(`[unified] student fare filter: tp=${useTravelport}, am=${useAmadeus}, tj=${useTripjack}, sb=${useSabre}`);
  }

  // ══════════════════════════════════════════════════
  // MULTI-CITY: Leg-based intelligent journey builder
  // ══════════════════════════════════════════════════
  if (isMultiCity && body.legs && body.legs.length >= 2) {
    const legs = body.legs;
    console.log(`[unified] multi-city leg-based builder: ${legs.length} legs`);

    // Search each leg independently in parallel
    const legSearchPromises = legs.map((leg, legIdx) => {
      const legBody: any = {
        from: leg.from,
        to: leg.to,
        departDate: leg.date,
        returnDate: null,
        adults: body.adults,
        children: body.children || 0,
        infants: body.infants || 0,
        cabinClass: body.cabinClass || "Economy",
        directFlight: body.directFlight || false,
        studentFare: body.studentFare || false,
      };

      const providerCalls: Promise<any[]>[] = [];
      const providerTimeoutMs = 25_000;

      if (useTripjack) {
        providerCalls.push((async () => {
          const data = await callEdgeFunction("tripjack-search", legBody, providerTimeoutMs);
          if (data?.success && data?.flights?.length > 0) {
            return await processProviderFlights(data.flights, "tripjack", config, leg.from, leg.to);
          }
          return [];
        })());
      }

      if (useTravelport) {
        providerCalls.push((async () => {
          const tpBody = tenantOverrides?.travelportCredentials
            ? { ...legBody, tenantCredentials: tenantOverrides.travelportCredentials }
            : legBody;
          const data = await callEdgeFunction("travelport-search", tpBody, providerTimeoutMs);
          if (data?.success && data?.flights?.length > 0) {
            return await processProviderFlights(data.flights, "travelport", config, leg.from, leg.to);
          }
          return [];
        })());
      }

      if (useAmadeus) {
        providerCalls.push((async () => {
          const amBody = tenantOverrides?.amadeusCredentials
            ? { ...legBody, tenantCredentials: tenantOverrides.amadeusCredentials }
            : legBody;
          const data = await callEdgeFunction("amadeus-search", amBody, providerTimeoutMs);
          if (data?.success && data?.flights?.length > 0) {
            return await processProviderFlights(data.flights, "amadeus", config, leg.from, leg.to);
          }
          return [];
        })());
      }

      if (useSabre) {
        providerCalls.push((async () => {
          const sbBody = tenantOverrides?.sabreCredentials
            ? { ...legBody, tenantCredentials: tenantOverrides.sabreCredentials }
            : legBody;
          const data = await callEdgeFunction("sabre-search", sbBody, providerTimeoutMs);
          if (data?.success && data?.flights?.length > 0) {
            return await processProviderFlights(data.flights, "sabre", config, leg.from, leg.to);
          }
          return [];
        })());
      }

      return (async () => {
        const allResults = await Promise.all(providerCalls);
        const merged = allResults.flat();
        // Deduplicate within this leg
        const dedupMap = new Map<string, any>();
        for (const f of merged) {
          const key = flightDeduplicationKey(f);
          const existing = dedupMap.get(key);
          if (!existing || f.price < existing.price) dedupMap.set(key, f);
        }
        const deduped = Array.from(dedupMap.values());
        console.log(`[unified] leg ${legIdx} (${leg.from}→${leg.to}): ${deduped.length} flights from ${merged.length} raw`);
        return deduped;
      })();
    });

    const legResults = await Promise.all(legSearchPromises);

    // Check all legs have results
    const emptyLegs = legResults.map((r, i) => r.length === 0 ? i : -1).filter(i => i >= 0);
    if (emptyLegs.length > 0) {
      console.log(`[unified] multi-city: no results for leg(s) ${emptyLegs.join(", ")}`);
      // Return partial results if some legs have flights
      if (emptyLegs.length === legs.length) return [];
    }

    // Only combine if ALL legs have results
    if (emptyLegs.length === 0) {
      const combined = combineMultiCityLegs(legResults, legs);
      console.log(`[unified] multi-city: combined ${legs.length} legs → ${combined.length} journeys`);
      return combined;
    }

    return [];
  }

  // ══════════════════════════════════════════════════
  // ONE-WAY / ROUND-TRIP: Standard search
  // ══════════════════════════════════════════════════
  const results: any[] = [];
  const isQuickSearch = body.quickSearch === true;
  const providerTimeoutMs = isQuickSearch ? 15_000 : 25_000;
  if (isQuickSearch) console.log("[unified] quick-search mode: reduced timeouts");

  if (useLocalInventory) {
    try {
      const { data: dbFlights } = await sb.from("flights").select("*").eq("is_active", true);
      if (dbFlights) {
        // Run DB flights through processProviderFlights so they get the same
        // opaque srcToken / providerRefs / bookingFlow treatment as API providers.
        const dbProcessed = await processProviderFlights(
          dbFlights.map((f: any) => {
            const markup = f.markup_percentage || 0;
            const finalPrice = Math.round(f.price * (1 + markup / 100) * 100) / 100;
            return { ...f, price: finalPrice };
          }),
          "database",
          config,
          body.from,
          body.to,
        );
        results.push(...dbProcessed);
      }
    } catch (e) {
      console.error("[unified] local inventory error:", e);
    }
  }

  // Build common search body for providers
  const searchBody: any = {
    from: body.from,
    to: body.to,
    departDate: body.departDate,
    returnDate: body.returnDate || null,
    adults: body.adults,
    children: body.studentFare ? 0 : (body.children || 0),
    infants: body.studentFare ? 0 : (body.infants || 0),
    cabinClass: body.cabinClass || "Economy",
    directFlight: body.directFlight || false,
    studentFare: body.studentFare || false,
  };

  // Call providers in parallel
  const apiCalls: Promise<void>[] = [];

  if (useTravelport) {
    apiCalls.push((async () => {
      const tpBody = tenantOverrides?.travelportCredentials
        ? { ...searchBody, tenantCredentials: tenantOverrides.travelportCredentials }
        : searchBody;
      const data = await callEdgeFunction("travelport-search", tpBody, providerTimeoutMs);
      if (data?.success && data?.flights?.length > 0) {
        let tpFlights = await processProviderFlights(data.flights, "travelport", config, body.from, body.to);

        // For round-trip: pair outbound (group 0) and return (group 1) flights
        if (body.returnDate) {
          const outbound = tpFlights.filter((f: any) => {
            if (!f.segments?.length) return false;
            return f.segments.every((s: any) => String(s.group) === "0");
          });
          const returns = tpFlights.filter((f: any) => {
            if (!f.segments?.length) return false;
            return f.segments.every((s: any) => String(s.group) === "1");
          });
          const mixed = tpFlights.filter((f: any) => {
            if (!f.segments?.length) return true;
            const groups = new Set(f.segments.map((s: any) => String(s.group)));
            return groups.size > 1 || (!groups.has("0") && !groups.has("1"));
          });

          if (outbound.length > 0 && returns.length > 0) {
            returns.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
            const pairedFlights: any[] = [];

            for (const ob of outbound) {
              const sameAirlineReturn = returns.find((r: any) => r.airline === ob.airline);
              const ret = sameAirlineReturn || returns[0];
              if (!ret) continue;

              const combinedSegments = [
                ...(ob.segments || []),
                ...(ret.segments || []),
              ];

              const combinedRawPrice = (ob.rawApiPrice || 0) + (ret.rawApiPrice || 0);
              const combinedPrice = (ob.price || 0) + (ret.price || 0);
              const combinedBase = (ob.basePrice != null && ret.basePrice != null) ? ob.basePrice + ret.basePrice : undefined;
              const combinedTaxes = (ob.taxes != null && ret.taxes != null) ? ob.taxes + ret.taxes : undefined;

              let combinedPaxPricing = null;
              if (ob.paxPricing && ret.paxPricing) {
                combinedPaxPricing = {} as any;
                for (const paxType of Object.keys(ob.paxPricing)) {
                  const obPax = ob.paxPricing[paxType];
                  const retPax = ret.paxPricing[paxType];
                  if (obPax && retPax) {
                    combinedPaxPricing[paxType] = {
                      base: (obPax.base || 0) + (retPax.base || 0),
                      taxes: (obPax.taxes || 0) + (retPax.taxes || 0),
                      total: (obPax.total || 0) + (retPax.total || 0),
                    };
                  }
                }
              }

              pairedFlights.push({
                ...ob,
                segments: combinedSegments,
                price: combinedPrice,
                rawApiPrice: combinedRawPrice,
                basePrice: combinedBase,
                taxes: combinedTaxes,
                paxPricing: combinedPaxPricing,
                returnFlight: {
                  id: ret.id,
                  airline: ret.airline,
                  flightNumber: ret.flightNumber,
                },
              });
            }

            tpFlights = [...mixed, ...pairedFlights];
            console.log(`[unified] TP round-trip: paired ${outbound.length} outbound × ${returns.length} return → ${pairedFlights.length} combined, ${mixed.length} mixed`);
          }
        }

        results.push(...tpFlights);
      }
    })());
  }

  if (useAmadeus) {
    apiCalls.push((async () => {
      const amBody = tenantOverrides?.amadeusCredentials
        ? { ...searchBody, tenantCredentials: tenantOverrides.amadeusCredentials }
        : searchBody;
      const data = await callEdgeFunction("amadeus-search", amBody, providerTimeoutMs);
      if (data?.success && data?.flights?.length > 0) {
        let amFlights = await processProviderFlights(data.flights, "amadeus", config, body.from, body.to);

        if (body.returnDate) {
          const outbound = amFlights.filter((f: any) => {
            if (!f.segments?.length) return false;
            return f.segments.every((s: any) => String(s.group) === "0");
          });
          const returns = amFlights.filter((f: any) => {
            if (!f.segments?.length) return false;
            return f.segments.every((s: any) => String(s.group) === "1");
          });
          const mixed = amFlights.filter((f: any) => {
            if (!f.segments?.length) return true;
            const groups = new Set(f.segments.map((s: any) => String(s.group)));
            return groups.size > 1 || (!groups.has("0") && !groups.has("1"));
          });

          if (outbound.length > 0 && returns.length > 0) {
            returns.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
            const pairedFlights: any[] = [];

            for (const ob of outbound) {
              const sameAirlineReturn = returns.find((r: any) => r.airline === ob.airline);
              const ret = sameAirlineReturn || returns[0];
              if (!ret) continue;

              const combinedSegments = [
                ...(ob.segments || []),
                ...(ret.segments || []),
              ];

              let combinedPaxPricing = null;
              if (ob.paxPricing && ret.paxPricing) {
                combinedPaxPricing = {} as any;
                for (const paxType of Object.keys(ob.paxPricing)) {
                  const obPax = ob.paxPricing[paxType];
                  const retPax = ret.paxPricing[paxType];
                  if (obPax && retPax) {
                    combinedPaxPricing[paxType] = {
                      base: (obPax.base || 0) + (retPax.base || 0),
                      taxes: (obPax.taxes || 0) + (retPax.taxes || 0),
                      total: (obPax.total || 0) + (retPax.total || 0),
                    };
                  }
                }
              }

              pairedFlights.push({
                ...ob,
                segments: combinedSegments,
                price: (ob.price || 0) + (ret.price || 0),
                rawApiPrice: (ob.rawApiPrice || 0) + (ret.rawApiPrice || 0),
                basePrice: (ob.basePrice != null && ret.basePrice != null) ? ob.basePrice + ret.basePrice : undefined,
                taxes: (ob.taxes != null && ret.taxes != null) ? ob.taxes + ret.taxes : undefined,
                paxPricing: combinedPaxPricing,
                returnFlight: { id: ret.id, airline: ret.airline, flightNumber: ret.flightNumber },
              });
            }

            amFlights = [...mixed, ...pairedFlights];
            console.log(`[unified] AM round-trip: paired ${outbound.length} outbound × ${returns.length} return → ${pairedFlights.length} combined`);
          }
        }

        results.push(...amFlights);
      }
    })());
  }

  if (useTripjack) {
    apiCalls.push((async () => {
      const tjBody = {
        from: body.from,
        to: body.to,
        departDate: body.departDate,
        returnDate: body.returnDate,
        adults: body.adults,
        children: body.children || 0,
        infants: body.infants || 0,
        cabinClass: body.cabinClass || "Economy",
        directFlight: body.directFlight || false,
        studentFare: body.studentFare || false,
      };
      const data = await callEdgeFunction("tripjack-search", tjBody, providerTimeoutMs);
      if (data?.success && data?.flights?.length > 0) {
        let tjFlights = data.flights;

        // For round-trip: pair ONWARD + RETURN flights into combined entries
        if (body.returnDate) {
          const onwardFlights = tjFlights.filter((f: any) => f.tripSection === "ONWARD");
          const returnFlights = tjFlights.filter((f: any) => f.tripSection === "RETURN");
          const comboFlights = tjFlights.filter((f: any) => f.tripSection === "COMBO");

          if (onwardFlights.length > 0 && returnFlights.length > 0) {
            returnFlights.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
            const pairedFlights: any[] = [];

            for (const onward of onwardFlights) {
              const ret = returnFlights[0];
              if (!ret) continue;

              const combinedSegments = [
                ...(onward.segments || []).map((s: any) => ({ ...s, group: 0 })),
                ...(ret.segments || []).map((s: any) => ({ ...s, group: 1 })),
              ];

              pairedFlights.push({
                ...onward,
                segments: combinedSegments,
                price: (onward.price || 0) + (ret.price || 0),
                totalPrice: (onward.totalPrice || 0) + (ret.totalPrice || 0),
                basePrice: (onward.basePrice || 0) + (ret.basePrice || 0),
                taxes: (onward.taxes || 0) + (ret.taxes || 0),
                tripSection: "PAIRED",
                returnFlight: {
                  id: ret.id,
                  tripjackPriceId: ret.tripjackPriceId,
                  sri: ret.sri,
                  msri: ret.msri,
                  airline: ret.airline,
                  flightNumber: ret.flightNumber,
                  cabinBaggage: ret.cabinBaggage,
                  checkinBaggage: ret.checkinBaggage,
                },
              });
            }

            tjFlights = [...comboFlights, ...pairedFlights];
            console.log(`[unified] TJ round-trip: paired ${onwardFlights.length} onward × cheapest return → ${pairedFlights.length} combined, ${comboFlights.length} combos`);
          }
        }

        results.push(...(await processProviderFlights(tjFlights, "tripjack", config, body.from, body.to)));
      }
    })());
  }

  if (useSabre) {
    apiCalls.push((async () => {
      const sbBody = tenantOverrides?.sabreCredentials
        ? { ...searchBody, tenantCredentials: tenantOverrides.sabreCredentials }
        : searchBody;
      const data = await callEdgeFunction("sabre-search", sbBody, providerTimeoutMs);
      if (data?.success && data?.flights?.length > 0) {
        let sbFlights = await processProviderFlights(data.flights, "sabre", config, body.from, body.to);

        // For round-trip: pair outbound and return flights
        if (body.returnDate) {
          const outbound = sbFlights.filter((f: any) => f.segments?.every((s: any) => String(s.group) === "0"));
          const returns = sbFlights.filter((f: any) => f.segments?.every((s: any) => String(s.group) === "1"));
          const mixed = sbFlights.filter((f: any) => {
            if (!f.segments?.length) return true;
            const groups = new Set(f.segments.map((s: any) => String(s.group)));
            return groups.size > 1 || (!groups.has("0") && !groups.has("1"));
          });

          if (outbound.length > 0 && returns.length > 0) {
            returns.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
            const pairedFlights: any[] = [];
            for (const ob of outbound) {
              const ret = returns.find((r: any) => r.airline === ob.airline) || returns[0];
              if (!ret) continue;
              pairedFlights.push({
                ...ob,
                segments: [...(ob.segments || []), ...(ret.segments || [])],
                price: (ob.price || 0) + (ret.price || 0),
                rawApiPrice: (ob.rawApiPrice || 0) + (ret.rawApiPrice || 0),
                basePrice: (ob.basePrice != null && ret.basePrice != null) ? ob.basePrice + ret.basePrice : undefined,
                taxes: (ob.taxes != null && ret.taxes != null) ? ob.taxes + ret.taxes : undefined,
                returnFlight: { id: ret.id, airline: ret.airline, flightNumber: ret.flightNumber },
              });
            }
            sbFlights = [...mixed, ...pairedFlights];
            console.log(`[unified] SB round-trip: paired ${outbound.length} outbound × ${returns.length} return → ${pairedFlights.length} combined`);
          }
        }

        results.push(...sbFlights);
      }
    })());
  }

  await Promise.all(apiCalls);

  // Deduplicate: same itinerary → keep lowest fare
  const dedupMap = new Map<string, any>();
  for (const f of results) {
    const key = flightDeduplicationKey(f);
    const existing = dedupMap.get(key);
    if (!existing || f.price < existing.price) {
      dedupMap.set(key, f);
    }
  }

  return Array.from(dedupMap.values());
}

// ── Cache baggage data from search results (fire-and-forget) ──

async function cacheBaggageFromResults(
  flights: any[],
  body: SearchRequest,
  sb: any
): Promise<void> {
  if (flights.length === 0 || !body.from || !body.to) return;

  const isStudent = body.studentFare === true;
  const seen = new Set<string>();
  const airlineDefaults = new Map<string, { cabin: string; checkin: string }>();

  for (const f of flights) {
    const airlineCode = f.airline || "";
    const fareClass = f.classOfBooking || f.fareBasis || f.class || "";
    const cabinBag = f.cabinBaggage || f.baggageAllowance?.cabin || "";
    const checkinBag = f.checkinBaggage || f.baggageAllowance?.checkin || "";
    const source = f._internalSrc || f.source || "unknown";

    if (!airlineCode || (!cabinBag && !checkinBag)) continue;

    // Deduplicate within this batch
    const key = `${body.from}-${body.to}-${airlineCode}-${fareClass}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      await sb.rpc("upsert_baggage_cache", {
        p_from_code: body.from,
        p_to_code: body.to,
        p_airline_code: airlineCode,
        p_fare_class: fareClass,
        p_cabin_baggage: cabinBag,
        p_checkin_baggage: checkinBag,
        p_source: source,
        p_is_student: isStudent,
      });
    } catch (e) {
      // Fire-and-forget — don't let cache errors break search
    }

    // Collect airline defaults for auto-populating airline_settings
    if (!airlineDefaults.has(airlineCode) && (cabinBag || checkinBag)) {
      airlineDefaults.set(airlineCode, { cabin: cabinBag, checkin: checkinBag });
    }
  }

  console.log(`[unified] cached baggage for ${seen.size} unique airline/fare combos (student=${isStudent})`);

  // Auto-populate airline_settings with route-specific data (fire-and-forget)
  if (airlineDefaults.size > 0 && body.from && body.to) {
    for (const [code, bag] of airlineDefaults) {
      try {
        // Check if route-specific entry already exists
        const { data: existing } = await sb
          .from("airline_settings")
          .select("id")
          .eq("airline_code", code)
          .eq("scope_type", "route")
          .eq("from_code", body.from)
          .eq("to_code", body.to)
          .maybeSingle();

        if (!existing) {
          await sb.from("airline_settings").insert({
            airline_code: code,
            scope_type: "route",
            from_code: body.from,
            to_code: body.to,
            cabin_baggage: bag.cabin || "7 Kg",
            checkin_baggage: bag.checkin || "20 Kg",
          } as any);
        }
      } catch {
        // Ignore — might have unique constraint or permission issues
      }
    }
  }
}

// ── Enrich flights with cached/stored baggage data ──

async function enrichBaggageFromCache(
  flights: any[],
  body: SearchRequest,
  sb: any
): Promise<void> {
  if (flights.length === 0 || !body.from || !body.to) return;

  // Collect airlines that need baggage data
  const needsBaggage = flights.filter(f => {
    const hasCabin = f.cabinBaggage || f.baggageAllowance?.cabin;
    const hasCheckin = f.checkinBaggage || f.baggageAllowance?.checkin;
    return !hasCabin && !hasCheckin;
  });

  if (needsBaggage.length === 0) return;

  const isStudent = body.studentFare === true;
  const airlineCodes = [...new Set(needsBaggage.map(f => f.airline).filter(Boolean))];

  // 1. Load route-specific baggage_cache entries
  const cacheTable = isStudent ? "student_baggage_cache" : "baggage_cache";
  let cacheRows: any[] = [];
  try {
    const { data } = await sb
      .from(cacheTable)
      .select("airline_code, fare_class, cabin_baggage, checkin_baggage")
      .eq("from_code", body.from)
      .eq("to_code", body.to)
      .in("airline_code", airlineCodes)
      .gt("expires_at", new Date().toISOString());
    cacheRows = data || [];
  } catch {}

  // Build lookup: airline+fareClass → baggage
  const cacheMap = new Map<string, { cabin: string; checkin: string }>();
  const airlineFallback = new Map<string, { cabin: string; checkin: string }>();
  for (const row of cacheRows) {
    const key = `${row.airline_code}|${row.fare_class || ""}`;
    cacheMap.set(key, { cabin: row.cabin_baggage || "", checkin: row.checkin_baggage || "" });
    // Also keep airline-level fallback (first match)
    if (!airlineFallback.has(row.airline_code)) {
      airlineFallback.set(row.airline_code, { cabin: row.cabin_baggage || "", checkin: row.checkin_baggage || "" });
    }
  }

  // 2. Load airline_settings as final fallback
  let settingsRows: any[] = [];
  try {
    const { data } = await sb
      .from("airline_settings")
      .select("airline_code, scope_type, from_code, to_code, cabin_baggage, checkin_baggage")
      .in("airline_code", airlineCodes);
    settingsRows = data || [];
  } catch {}

  // Build settings lookup: prefer route-specific, fallback to global
  const settingsRoute = new Map<string, { cabin: string; checkin: string }>();
  const settingsGlobal = new Map<string, { cabin: string; checkin: string }>();
  for (const row of settingsRows) {
    const bag = { cabin: row.cabin_baggage || "", checkin: row.checkin_baggage || "" };
    if (row.scope_type === "route" && row.from_code === body.from && row.to_code === body.to) {
      settingsRoute.set(row.airline_code, bag);
    } else if (row.scope_type === "all" || !row.scope_type) {
      if (!settingsGlobal.has(row.airline_code)) settingsGlobal.set(row.airline_code, bag);
    }
  }

  // 3. Enrich flights
  let enriched = 0;
  for (const f of needsBaggage) {
    const airline = f.airline || "";
    const fareClass = f.classOfBooking || f.fareBasis || f.class || "";

    // Priority: cache (fare-class specific) → cache (airline fallback) → settings (route) → settings (global)
    const exact = cacheMap.get(`${airline}|${fareClass}`);
    const airlineFb = airlineFallback.get(airline);
    const routeSettings = settingsRoute.get(airline);
    const globalSettings = settingsGlobal.get(airline);

    const match = exact || airlineFb || routeSettings || globalSettings;
    if (match && (match.cabin || match.checkin)) {
      if (!f.baggageAllowance) f.baggageAllowance = {};
      if (match.cabin) f.baggageAllowance.cabin = match.cabin;
      if (match.checkin) f.baggageAllowance.checkin = match.checkin;
      if (match.cabin) f.cabinBaggage = match.cabin;
      if (match.checkin) f.checkinBaggage = match.checkin;
      f.baggageSource = exact ? "cache_exact" : airlineFb ? "cache_airline" : routeSettings ? "settings_route" : "settings_global";
      enriched++;
    }
  }

  if (enriched > 0) {
    console.log(`[unified] enriched baggage for ${enriched}/${needsBaggage.length} flights from cache/settings`);
  }
}


async function trackAndCache(
  flights: any[],
  body: SearchRequest,
  sb: any
): Promise<void> {
  if (flights.length === 0 || !body.from || !body.to) return;

  const lowest = flights.reduce((min, f) => f.price < min.price ? f : min, flights[0]);
  const adults = body.adults || 1;
  const children = body.children || 0;
  const infants = body.infants || 0;

  // Upsert popular route (fire-and-forget)
  try {
    await sb.rpc("upsert_popular_route", {
      p_from_code: body.from,
      p_to_code: body.to,
      p_from_city: lowest.from_city || body.from,
      p_to_city: lowest.to_city || body.to,
      p_price: lowest.price,
      p_currency: lowest.currency || "BDT",
      p_airline: lowest.airline || "",
      p_duration: lowest.duration || "",
      p_stops: lowest.stops ?? 0,
    });
  } catch { }

  // Compute total fare for caching
  const totalPrice = computeTotalFare(lowest, adults, children, infants);

  // Upsert price cache
  try {
    await sb.rpc("upsert_flight_price_cache", {
      p_from_code: body.from,
      p_to_code: body.to,
      p_travel_date: body.departDate || "",
      p_cabin_class: body.cabinClass || "Economy",
      p_adults: adults,
      p_children: children,
      p_infants: infants,
      p_lowest_price: totalPrice,
      p_currency: lowest.currency || "INR",
      p_source: lowest.source || "unknown",
    });
  } catch { }

  // Passive trend ingestion — every live search result becomes a long-term data point.
  // Builds our own price history organically so we have a fallback when Aviasales fails.
  // adultPrice = totalPrice / pax to normalise; trends are stored per-adult for consistency.
  if (body.departDate) {
    try {
      const pax = Math.max(1, adults + children + infants);
      const adultPrice = Math.round((totalPrice / pax) * 100) / 100;
      const trendCurrency = String(lowest.currency || "INR").toUpperCase();
      // Sanity-bound: reject mis-labelled / leg-only / corrupted prices so the
      // long-term trend store stays clean. Without this, a single rogue 252-BDT
      // sample would poison the per-route median for months.
      if (isTrendSamplePlausible(adultPrice, trendCurrency)) {
        await sb.from("flight_price_trends").insert({
          from_code: body.from,
          to_code: body.to,
          depart_date: body.departDate,
          sample_date: new Date().toISOString().slice(0, 10),
          min_price: adultPrice,
          avg_price: adultPrice,
          max_price: adultPrice,
          sample_count: 1,
          currency: trendCurrency,
        });
      } else {
        console.warn(
          `[unified] rejected implausible trend sample: ${body.from}-${body.to} ${adultPrice} ${trendCurrency}`,
        );
      }
    } catch { /* duplicate sample for today — fine, ignore */ }
  }
}

// ── Date prices mode ──

async function fetchDatePrices(
  body: SearchRequest,
  config: ProviderConfig,
  sb: any
): Promise<Record<string, { price: number; source: string } | null>> {
  const dates = body.dates || [];
  if (dates.length === 0) return {};

  const adults = body.adults || 1;
  const children = body.children || 0;
  const infants = body.infants || 0;

  // First check server cache
  const result: Record<string, { price: number; source: string } | null> = {};
  const toFetch: string[] = [];

  try {
    const { data: cachedRows } = await sb
      .from("flight_price_cache")
      .select("travel_date, lowest_price, currency, source, expires_at")
      .eq("from_code", body.from)
      .eq("to_code", body.to)
      .eq("cabin_class", body.cabinClass || "Economy")
      .eq("adults", adults)
      .eq("children", children)
      .eq("infants", infants)
      .in("travel_date", dates);

    const now = new Date();
    const cachedDates = new Set<string>();
    if (cachedRows) {
      for (const row of cachedRows) {
        if (new Date(row.expires_at) > now) {
          result[row.travel_date] = { price: Number(row.lowest_price), source: row.source };
          cachedDates.add(row.travel_date);
        }
      }
    }

    for (const d of dates) {
      if (!cachedDates.has(d)) toFetch.push(d);
    }
  } catch {
    toFetch.push(...dates);
  }

  if (toFetch.length === 0) return result;

  // Fetch uncached dates sequentially (2 at a time) to avoid WORKER_LIMIT
  for (let i = 0; i < toFetch.length; i += 2) {
    const batch = toFetch.slice(i, i + 2);
    await Promise.all(
      batch.map(async (dateStr) => {
        const searchBody: SearchRequest = {
          ...body,
          departDate: dateStr,
          mode: "search",
        };
        const flights = await performSearch(searchBody, config, sb);

        if (flights.length > 0) {
          const lowest = flights.reduce((min: any, f: any) => f.price < min.price ? f : min, flights[0]);
          const totalPrice = computeTotalFare(lowest, adults, children, infants);
          result[dateStr] = { price: totalPrice, source: lowest.source };

          // Cache it (fire-and-forget)
          sb.rpc("upsert_flight_price_cache", {
            p_from_code: body.from,
            p_to_code: body.to,
            p_travel_date: dateStr,
            p_cabin_class: body.cabinClass || "Economy",
            p_adults: adults,
            p_children: children,
            p_infants: infants,
            p_lowest_price: totalPrice,
            p_currency: lowest.currency || "INR",
            p_source: lowest.source || "unknown",
          }).then(() => {}, () => {});
        } else {
          result[dateStr] = null;
        }
      })
    );
  }

  return result;
}

// ── Main handler ──

// ── Internal proxy: route action-based requests to vendor functions ──
// This keeps vendor names off the frontend while adding negligible latency (~20ms same-instance hop)

const SUPABASE_FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

const VENDOR_ROUTE_MAP: Record<string, Record<string, string>> = {
  price: {
    travelport: "travelport-price",
    tripjack: "tripjack-review",
    amadeus: "amadeus-price",
    sabre: "sabre-price",
  },
  book: {
    travelport: "travelport-book",
    tripjack: "tripjack-book",
    amadeus: "amadeus-book",
    sabre: "sabre-book",
  },
  ancillaries: {
    travelport_seatmap: "travelport-seatmap",
    travelport_ancillaries: "travelport-ancillaries",
    tripjack: "tripjack-ssr",
  },
  fareRules: {
    travelport: "travelport-fare-rules",
    tripjack: "tripjack-fare-rules",
  },
};

async function proxyToVendor(functionName: string, payload: any): Promise<Response> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = `${SUPABASE_FUNCTIONS_URL}/${functionName}`;
  console.log(`[unified] proxying to ${functionName}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handlePriceAction(body: any): Promise<Response> {
  // Unmask any neutral keys ('pa'/'pb'/… and `_pPriceId`/`_pRawOffer`/…)
  // before resolving source / hydrating provider fields.
  body = unmaskInboundBody(body);
  // Prefer opaque srcToken; legacy `source` accepted for transitional inbound calls.
  const tokenSrc = await verifySrc(body.srcToken);
  const source = tokenSrc || body.source || body.flight?.source;
  if (!source) return new Response(JSON.stringify({ success: false, error: "Invalid or missing source token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const fn = VENDOR_ROUTE_MAP.price[source];
  if (!fn) return new Response(JSON.stringify({ success: false, error: "Unsupported provider for price verification" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Hydrate provider-specific field names from opaque providerRefs blob.
  const hydrated = hydrateProviderFields(source, body);
  return proxyToVendor(fn, hydrated);
}

async function handleBookAction(body: any): Promise<Response> {
  body = unmaskInboundBody(body);
  const tokenSrc = await verifySrc(body.srcToken);
  const source = tokenSrc || body.source || body.flight?.source;
  if (!source) return new Response(JSON.stringify({ success: false, error: "Invalid or missing source token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const fn = VENDOR_ROUTE_MAP.book[source];
  if (!fn) return new Response(JSON.stringify({ success: false, error: "Unsupported provider for booking" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const hydrated = hydrateProviderFields(source, body);
  return proxyToVendor(fn, hydrated);
}

async function handleAncillariesAction(body: any): Promise<Response> {
  body = unmaskInboundBody(body);
  const tokenSrc = await verifySrc(body.srcToken);
  const source = tokenSrc || body.source;
  if (!source) return new Response(JSON.stringify({ success: false, error: "Invalid or missing source token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  // Hydrate priceId/etc from providerRefs if caller used opaque form.
  body = hydrateProviderFields(source, body);

  if (source === "tripjack") {
    // If caller sent priceId but no bookingId, auto-review to get bookingId first
    if (!body.bookingId && body.priceId) {
      console.log("[unified] tripjack ancillaries: auto-reviewing priceId to get bookingId");
      const reviewRes = await proxyToVendor("tripjack-review", { priceId: body.priceId });
      const reviewData = await reviewRes.clone().json().catch(() => ({}));
      if (reviewData?.bookingId) {
        body.bookingId = reviewData.bookingId;
      } else {
        console.error("[unified] tripjack review failed for SSR:", JSON.stringify(reviewData).substring(0, 500));
        return new Response(JSON.stringify({ success: false, error: "Could not prepare flight for ancillary lookup" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    return proxyToVendor("tripjack-ssr", body);
  }

  if (source === "travelport") {
    // Fetch seatmap + ancillaries in parallel from two vendor functions
    const [seatRes, ancRes] = await Promise.all([
      proxyToVendor("travelport-seatmap", body),
      proxyToVendor("travelport-ancillaries", body),
    ]);

    const seatData = await seatRes.json().catch(() => ({}));
    const ancData = await ancRes.json().catch(() => ({}));

    return new Response(JSON.stringify({
      success: true,
      seatMaps: seatData.seatMaps || [],
      baggageOptions: ancData.baggageOptions || [],
      mealOptions: ancData.mealOptions || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: false, error: `Unsupported provider for ancillaries: ${source}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleFareRulesAction(body: any): Promise<Response> {
  body = unmaskInboundBody(body);
  const tokenSrc = await verifySrc(body.srcToken);
  const source = tokenSrc || body.source;
  if (!source) return new Response(JSON.stringify({ success: false, error: "Invalid or missing source token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  body = hydrateProviderFields(source, body);

  const fn = VENDOR_ROUTE_MAP.fareRules[source];
  if (!fn) return new Response(JSON.stringify({ success: false, error: "Unsupported provider for fare rules" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  return proxyToVendor(fn, body);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ success: false, error: "Rate limit exceeded" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();

    // Route action-based requests to vendor functions (price, book, ancillaries, fareRules)
    if (body.action === "price") return await handlePriceAction(body);
    if (body.action === "book") return await handleBookAction(body);
    if (body.action === "ancillaries") return await handleAncillariesAction(body);
    if (body.action === "fareRules") return await handleFareRulesAction(body);

    // Original search flow
    const mode = (body as SearchRequest).mode || "search";
    const sb = getSupabaseAdmin();

    console.log(`[unified] mode=${mode}, from=${body.from}, to=${body.to}, date=${body.departDate}, tenant=${body.tenant_id || "global"}`);

    // Load provider config and exchange config in parallel
    const [config, exchangeConfig] = await Promise.all([
      loadProviderConfig(sb),
      loadExchangeConfig(sb),
    ]);

    // Load tenant-specific API overrides and provider group if tenant_id provided
    let tenantOverrides: TenantProviderOverride | null = null;
    let providerGroup: ProviderGroupConfig | null = null;
    if (body.tenant_id) {
      const [byok, group] = await Promise.all([
        loadTenantOverrides(sb, body.tenant_id),
        loadTenantProviderGroup(sb, body.tenant_id),
      ]);
      tenantOverrides = byok;
      providerGroup = group;
      console.log(`[unified] tenant BYOK: tp=${tenantOverrides?.travelportEnabled}, am=${tenantOverrides?.amadeusEnabled}`);
      console.log(`[unified] tenant group: ${providerGroup ? `tp=${providerGroup.travelport}, am=${providerGroup.amadeus}, tj=${providerGroup.tripjack}` : "none"}`);
    }

    console.log(`[unified] providers: tp=${config.travelportEnabled}, am=${config.amadeusEnabled}, tj=${config.tripjackFlightEnabled}, sb=${config.sabreEnabled}, local=${config.showLocalInventory}`);

    const targetCurrency = body.currency || "BDT";
    console.log(`[unified] target currency: ${targetCurrency}`);

    if (mode === "date-prices") {
      const datePrices = await fetchDatePrices(body, config, sb);
      // Convert date prices to target currency
      const convertedDatePrices: Record<string, { price: number; source: string } | null> = {};
      for (const [dateStr, entry] of Object.entries(datePrices)) {
        if (entry && typeof entry === "object" && "price" in entry) {
          const source = entry.source || "unknown";
          const fromCurrency = exchangeConfig.sourceCurrencies[source] || "USD";
          convertedDatePrices[dateStr] = {
            price: convertAmount(entry.price, fromCurrency, targetCurrency, exchangeConfig.rates, exchangeConfig.markup),
            source: SOURCE_TO_CODE[entry.source] || "pa",
          };
        } else {
          convertedDatePrices[dateStr] = null;
        }
      }
      return new Response(
        JSON.stringify({ success: true, datePrices: convertedDatePrices, displayCurrency: targetCurrency }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Search-level cache (TTL scales by days-to-departure) ──
    const skipCache = body.skipCache === true || body.action === "price";
    const cacheKey = buildSearchCacheKey(body);
    const ttlMs = getSearchCacheTtlMs(body.departDate || "");

    if (!skipCache) {
      const cached = searchCache.get(cacheKey);
      if (cached && (Date.now() - cached.storedAt) < cached.ttlMs) {
        console.log(`[unified] CACHE HIT mem (ttl=${Math.round(cached.ttlMs / 60000)}min), key=${cacheKey.slice(0, 60)}`);
        return new Response(
          JSON.stringify({ ...cached.data, cached: true, cacheTier: "memory" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // DB-backed warm cache (survives cold starts)
      const dbPayload = await readDbSearchCache(sb, cacheKey);
      if (dbPayload) {
        console.log(`[unified] CACHE HIT db, key=${cacheKey.slice(0, 60)}`);
        // Re-hydrate memory tier so subsequent requests are fastest
        searchCache.set(cacheKey, { data: dbPayload, storedAt: Date.now(), ttlMs });
        pruneSearchCache();
        return new Response(
          JSON.stringify({ ...dbPayload, cached: true, cacheTier: "db" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Full search mode
    const flights = await performSearch(body, config, sb, tenantOverrides, providerGroup);

    // Sort by price
    flights.sort((a, b) => a.price - b.price);

    console.log(`[unified] total results after dedup: ${flights.length}`);

    // Track popular route + cache baggage (fire-and-forget) — skip route tracking for tenant searches
    if (!tenantOverrides && !providerGroup) {
      trackAndCache(flights, body, sb).catch(() => { });
    }
    // Always cache baggage data regardless of tenant (fire-and-forget)
    cacheBaggageFromResults(flights, body, sb).catch(() => { });

    // Enrich flights missing baggage — fire-and-forget to avoid WORKER_LIMIT
    // Baggage from the API response is already present; this only fills gaps
    try {
      await Promise.race([
        enrichBaggageFromCache(flights, body, sb),
        new Promise(resolve => setTimeout(resolve, 2000)), // 2s max for enrichment
      ]);
    } catch { }

    // Enrich flights with explicit leg summaries from segments
    for (const f of flights) {
      if (f.segments?.length) {
        // Determine max group index
        const maxGroup = Math.max(...f.segments.map((s: any) => s.group ?? 0));
        
        if (maxGroup >= 2 || f.tripSection === "MULTI_CITY") {
          // Multi-city: build per-leg summaries
          f.legs_summary = [];
          for (let g = 0; g <= maxGroup; g++) {
            const legSegs = f.segments.filter((s: any) => s.group === g);
            if (legSegs.length === 0) continue;
            const first = legSegs[0];
            const last = legSegs[legSegs.length - 1];
            f.legs_summary.push({
              legIndex: g,
              airline: first.carrier || first.airline || f.airline,
              flightNumber: first.flightNumber || "",
              from: first.origin || first.from || "",
              to: last.destination || last.to || "",
              departure: first.departure,
              arrival: last.arrival,
              stops: Math.max(0, legSegs.length - 1),
              segments: legSegs,
            });
          }
        } else {
          // One-way or round-trip
          const outSegs = f.segments.filter((s: any) => s.group === 0);
          const retSegs = f.segments.filter((s: any) => s.group === 1);

          if (outSegs.length > 0) {
            const first = outSegs[0];
            const last = outSegs[outSegs.length - 1];
            f.outbound = {
              airline: first.carrier || first.airline || f.airline,
              flightNumber: first.flightNumber || f.flightNumber,
              from: first.origin || f.from_code || body.from,
              to: last.destination || f.to_code || body.to,
              departure: first.departure,
              arrival: last.arrival,
              stops: Math.max(0, outSegs.length - 1),
              segments: outSegs,
            };
          }

          if (retSegs.length > 0) {
            const first = retSegs[0];
            const last = retSegs[retSegs.length - 1];
            f.return_leg = {
              airline: first.carrier || first.airline || f.airline,
              flightNumber: first.flightNumber || "",
              from: first.origin || f.to_code || body.to,
              to: last.destination || f.from_code || body.from,
              departure: first.departure,
              arrival: last.arrival,
              stops: Math.max(0, retSegs.length - 1),
              segments: retSegs,
            };
          }
        }
      }
    }

    // Compute totalPrice (all-pax grand total) for every flight using paxPricing
    const adults = body.adults || 1;
    const children = body.children || 0;
    const infants = body.infants || 0;

    for (const f of flights) {
      if (!f.totalPrice || f.totalPrice <= 0) {
        const pp = f.paxPricing;
        if (pp?.ADT) {
          // Use per-pax-type pricing for accurate total
          const adtTotal = pp.ADT.total ?? ((pp.ADT.base || 0) + (pp.ADT.taxes || 0));
          const chdTotal = pp.CHD ? (pp.CHD.total ?? ((pp.CHD.base || 0) + (pp.CHD.taxes || 0))) : Math.round(adtTotal * 0.75);
          const infTotal = pp.INF ? (pp.INF.total ?? ((pp.INF.base || 0) + (pp.INF.taxes || 0))) : Math.round(adtTotal * 0.10);
          f.totalPrice = Math.round(adtTotal * adults + chdTotal * children + infTotal * infants);
        } else {
          // No paxPricing — treat price as the grand total already
          f.totalPrice = Math.round(f.price || 0);
        }
      }
    }

    // Convert all prices to target currency
    const convertedFlights = flights
      .map(f => convertFlightPrices(f, targetCurrency, exchangeConfig))
      // Wire-strip: replace provider names + provider-specific keys with neutral
      // codes BEFORE the payload leaves the edge function.
      .map(maskFlightForWire);

    // Build providers response reflecting actual resolution
    const isTenantSearch = !!tenantOverrides || !!providerGroup;
    const resolvedProviders = tenantOverrides
      ? { local: false, travelport: tenantOverrides.travelportEnabled, amadeus: tenantOverrides.amadeusEnabled, tripjack: false, sabre: tenantOverrides.sabreEnabled }
      : providerGroup
        ? { local: false, travelport: providerGroup.travelport && config.travelportEnabled, amadeus: providerGroup.amadeus && config.amadeusEnabled, tripjack: providerGroup.tripjack && config.tripjackFlightEnabled, sabre: providerGroup.sabre && config.sabreEnabled }
        : { local: config.showLocalInventory, travelport: config.travelportEnabled, amadeus: config.amadeusEnabled, tripjack: config.tripjackFlightEnabled, sabre: config.sabreEnabled };

    const responsePayload = {
      success: true,
      flights: convertedFlights,
      count: convertedFlights.length,
      // Wire-strip: rename provider-keyed map to opaque codes so supplier
      // names never appear in the JSON payload.
      providers: {
        local: !!resolvedProviders.local,
        api: !!(resolvedProviders.travelport || resolvedProviders.amadeus || resolvedProviders.tripjack || resolvedProviders.sabre),
        pa: !!resolvedProviders.local,
        pb: !!resolvedProviders.travelport,
        pc: !!resolvedProviders.tripjack,
        pd: !!resolvedProviders.amadeus,
        pe: !!resolvedProviders.sabre,
      },
      displayCurrency: targetCurrency,
    };

    // Store in cache (skip for fare-validation / bypass requests)
    if (!skipCache && convertedFlights.length > 0) {
      searchCache.set(cacheKey, { data: responsePayload, storedAt: Date.now(), ttlMs });
      pruneSearchCache();
      // Persist to DB cache (cross-instance) — fire-and-forget
      writeDbSearchCache(sb, cacheKey, body, responsePayload, ttlMs).catch(() => {});
      console.log(`[unified] CACHE STORE ttl=${Math.round(ttlMs / 60000)}min, entries=${searchCache.size}`);
    }

    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[unified] error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
