// Unified Hotel Search Engine v5
// All hotel operations consolidated: search, detail, review, book, sync, admin
// Suppliers: Tripjack (via proxy), Hotelston (via edge function)
// Features: session engine, progressive pricing, supplier scoring

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Holidays are pre-cached by the sync-holidays cron job ──
// No per-request API calls needed; the unified-hotel-search just reads from high_demand_dates table.

// ── Helpers ──

// Wire supplier-name mask. Replaces known supplier identifiers in `source`/`api_source`
// fields with opaque codes so network payloads do not leak provider identity.
// The frontend hydrates these back to legacy names via src/lib/hotelWireAdapter.ts.
const HOTEL_SOURCE_TO_CODE: Record<string, string> = {
  tripjack: "ha",
  hotelston: "hb",
  search: "hs",
  database: "hd",
  cache: "hk",
  local_inventory: "hl",
};
function maskHotelSourceValue(v: any): any {
  if (typeof v !== "string") return v;
  // Composite (e.g. "tripjack+hotelston" from supplier merge) → mask each side
  if (v.includes("+")) {
    return v.split("+").map((p) => HOTEL_SOURCE_TO_CODE[p] || p).join("+");
  }
  return HOTEL_SOURCE_TO_CODE[v] || v;
}
function maskHotelWire(node: any): any {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = maskHotelWire(node[i]);
    return node;
  }
  for (const k of Object.keys(node)) {
    if (k === "source" || k === "api_source") {
      node[k] = maskHotelSourceValue(node[k]);
    } else if (typeof node[k] === "object") {
      node[k] = maskHotelWire(node[k]);
    }
  }
  return node;
}

function json(data: any, status = 200) {
  const masked = maskHotelWire(data);
  return new Response(JSON.stringify(masked), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Tripjack nationality resolver ──
// Tripjack expects numeric country IDs (e.g. "106" for India), but frontend sends ISO codes (e.g. "IN", "BD").
// Common mappings cached in-memory; unknown codes resolved via API on first use.
const NATIONALITY_MAP: Record<string, string> = {
  IN: "106", BD: "18", US: "225", GB: "230", AE: "226", SG: "196", MY: "131",
  TH: "211", LK: "203", NP: "152", PK: "163", SA: "194", QA: "178", KW: "117",
  OM: "162", BH: "17", AU: "13", CA: "38", DE: "82", FR: "75", IT: "108",
  JP: "112", KR: "116", CN: "45", HK: "99", PH: "165", ID: "101", VN: "233",
};
let nationalityApiCache: Record<string, string> = {};

async function resolveTripjackNationality(code: string | undefined, proxySecret: string): Promise<string> {
  if (!code) return "106";
  if (/^\d+$/.test(code)) return code;
  const upper = code.trim().toUpperCase();
  if (NATIONALITY_MAP[upper]) return NATIONALITY_MAP[upper];
  if (nationalityApiCache[upper]) return nationalityApiCache[upper];
  try {
    const url = `${PROXY_BASE}/hms/v1/nationality-info`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", "x-proxy-secret": proxySecret, "x-tripjack-env": "prod" },
    });
    if (res.ok) {
      const data = await res.json();
      const match = data?.nationalityInfos?.find((item: any) =>
        item?.code?.toUpperCase?.() === upper || item?.isoCode?.toUpperCase?.() === upper
      );
      if (match?.countryId) {
        const resolved = String(match.countryId);
        nationalityApiCache[upper] = resolved;
        console.log(`[tj-nationality] Resolved ${upper} → ${resolved}`);
        return resolved;
      }
    }
  } catch (e) {
    console.warn("[tj-nationality] lookup failed:", e);
  }
  return "106"; // fallback to India
}

// ── Rate limiter ──
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
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

// ── Supplier Scoring ──
const supplierScores = new Map<string, { totalMs: number; calls: number; failures: number }>();

function recordSupplierCall(supplier: string, durationMs: number, success: boolean) {
  const s = supplierScores.get(supplier) || { totalMs: 0, calls: 0, failures: 0 };
  s.totalMs += durationMs;
  s.calls++;
  if (!success) s.failures++;
  supplierScores.set(supplier, s);
}

function getSupplierTimeout(supplier: string, defaultMs: number): number {
  const s = supplierScores.get(supplier);
  if (!s || s.calls < 3) return defaultMs;
  const avgMs = s.totalMs / s.calls;
  const failRate = s.failures / s.calls;
  if (failRate > 0.5) return Math.min(defaultMs, 5000);
  return Math.min(defaultMs, Math.max(avgMs * 2, 5000));
}

// ── Provider config ──

interface HotelProviderConfig {
  tripjackEnabled: boolean;
  hotelstonEnabled: boolean;
  markupPercentage: number;
  perApiMarkups: Record<string, number>;
}

async function loadProviderConfig(sb: any): Promise<HotelProviderConfig> {
  const config: HotelProviderConfig = {
    tripjackEnabled: false,
    hotelstonEnabled: false,
    markupPercentage: 0,
    perApiMarkups: {},
  };

  const { data: settings } = await sb
    .from("api_settings")
    .select("provider, is_active, settings")
    .in("provider", ["tripjack_hotel", "hotelston_hotel", "api_markup"]);

  if (settings) {
    for (const s of settings) {
      if (s.provider === "tripjack_hotel") config.tripjackEnabled = !!s.is_active;
      if (s.provider === "hotelston_hotel") config.hotelstonEnabled = !!s.is_active;
      if (s.provider === "api_markup") {
        const m = s.settings as any;
        config.markupPercentage = m?.markup_percentage || 0;
        if (m?.per_api_hotel) config.perApiMarkups = m.per_api_hotel;
      }
    }
  }
  return config;
}

function getMarkup(config: HotelProviderConfig, source: string): number {
  if (config.perApiMarkups[source] !== undefined) return config.perApiMarkups[source];
  return config.markupPercentage;
}

// ── Surge pricing for high-demand dates ──

interface SurgeConfig {
  isHighDemand: boolean;
  surgePercentage: number; // extra % to add on top of base markup
  holidayLabel?: string;
}

async function loadSurgeConfig(sb: any, checkinDate?: string): Promise<SurgeConfig> {
  if (!checkinDate) return { isHighDemand: false, surgePercentage: 0 };
  try {
    const { data: hdRow } = await sb
      .from("high_demand_dates")
      .select("label")
      .eq("date", checkinDate)
      .limit(1)
      .maybeSingle();

    if (!hdRow) return { isHighDemand: false, surgePercentage: 0 };

    // Load configurable surge % from api_settings, default 5%
    const { data: surgeSettings } = await sb
      .from("api_settings")
      .select("settings")
      .eq("provider", "api_markup")
      .maybeSingle();

    const s = surgeSettings?.settings as any;
    const surgePercentage = s?.surge_markup_percentage ?? 5;

    console.log(`[unified-hotel] 🔥 Surge pricing active: ${hdRow.label || checkinDate} (+${surgePercentage}%)`);
    return { isHighDemand: true, surgePercentage, holidayLabel: hdRow.label || undefined };
  } catch (e) {
    console.error("[unified-hotel] Surge config error:", e);
    return { isHighDemand: false, surgePercentage: 0 };
  }
}

// ── Agent-specific markup layering ──

interface AgentMarkup {
  hasAgentMarkup: boolean;
  markupType: string; // "percentage" or "flat"
  markupValue: number;
}

async function loadAgentMarkup(sb: any, authHeader?: string | null): Promise<AgentMarkup> {
  const noMarkup: AgentMarkup = { hasAgentMarkup: false, markupType: "percentage", markupValue: 0 };
  if (!authHeader) return noMarkup;

  try {
    // Extract JWT to get user ID
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    ).auth.getUser();

    if (error || !user) return noMarkup;

    const { data: markupRow } = await sb
      .from("agent_markup_settings")
      .select("markup_type, markup_value, applies_to")
      .eq("user_id", user.id)
      .in("applies_to", ["hotel", "all"])
      .order("applies_to", { ascending: false }) // "hotel" before "all" (specific wins)
      .limit(1)
      .maybeSingle();

    if (!markupRow || !markupRow.markup_value) return noMarkup;

    console.log(`[unified-hotel] 🏷️ Agent markup: ${markupRow.markup_type} ${markupRow.markup_value} for user ${user.id}`);
    return {
      hasAgentMarkup: true,
      markupType: markupRow.markup_type || "percentage",
      markupValue: markupRow.markup_value,
    };
  } catch (e) {
    console.error("[unified-hotel] Agent markup error:", e);
    return noMarkup;
  }
}

// Apply surge + agent markup to a hotel price
function applyDynamicMarkups(price: number, surge: SurgeConfig, agent: AgentMarkup): number {
  let final = price;
  // 1. Surge markup (on top of base marked-up price)
  if (surge.isHighDemand && surge.surgePercentage > 0) {
    final = Math.round(final * (1 + surge.surgePercentage / 100));
  }
  // 2. Agent markup (on top of surge-adjusted price)
  if (agent.hasAgentMarkup && agent.markupValue > 0) {
    if (agent.markupType === "flat") {
      final = Math.round(final + agent.markupValue);
    } else {
      final = Math.round(final * (1 + agent.markupValue / 100));
    }
  }
  return final;
}

function applyDynamicMarkupsToHotel(hotel: NormalizedHotel, surge: SurgeConfig, agent: AgentMarkup): NormalizedHotel {
  if (!surge.isHighDemand && !agent.hasAgentMarkup) return hotel;

  const applyPrice = (p: number) => applyDynamicMarkups(p, surge, agent);
  return {
    ...hotel,
    price: applyPrice(hotel.price),
    crossedOutRate: hotel.crossedOutRate ? applyPrice(hotel.crossedOutRate) : 0,
    availableRooms: (hotel.availableRooms || []).map((r: any) => ({
      ...r,
      price: r.price ? applyPrice(r.price) : r.price,
      total_price: r.total_price ? applyPrice(r.total_price) : r.total_price,
    })),
  };
}

// ── Currency conversion ──

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
    sourceCurrencies: { tripjack: "INR", hotelston: "EUR" },
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
      if (s.api_source_currencies) {
        config.sourceCurrencies = { ...config.sourceCurrencies, ...s.api_source_currencies };
      }
    }
  } catch { }
  return config;
}

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>, markup: number): number {
  if (fromCurrency === toCurrency) return Math.round(amount);
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  return Math.round((amount / fromRate) * toRate * (1 + markup / 100));
}

function convertHotelPrices(hotel: NormalizedHotel, targetCurrency: string, exchangeConfig: ExchangeConfig): NormalizedHotel {
  const fromCurrency = exchangeConfig.sourceCurrencies[hotel.source] || hotel.currency || "USD";
  if (fromCurrency === targetCurrency) return { ...hotel, currency: targetCurrency };

  const convert = (amount: number) => convertAmount(amount, fromCurrency, targetCurrency, exchangeConfig.rates, exchangeConfig.markup);

  return {
    ...hotel,
    price: convert(hotel.price),
    crossedOutRate: hotel.crossedOutRate ? convert(hotel.crossedOutRate) : 0,
    currency: targetCurrency,
    availableRooms: hotel.availableRooms.map((r: any) => ({
      ...r,
      price: r.price ? convert(r.price) : r.price,
      total_price: r.total_price ? convert(r.total_price) : r.total_price,
      rate: r.rate ? convert(r.rate) : r.rate,
      discount_price: r.discount_price ? convert(r.discount_price) : r.discount_price,
    })),
  };
}

// ── Normalized hotel type ──

interface NormalizedHotel {
  id: string;
  name: string;
  city: string;
  country: string;
  rating: number;
  reviews: number;
  stars: number;
  price: number;         // per-night price (after toPerNightPricing)
  totalPrice: number;    // total price for all nights
  originalPrice: number;
  originalCurrency: string;
  crossedOutRate: number;
  discountPercentage: number;
  image: string | null;
  images: string[];
  amenities: string[];
  propertyType: string;
  landingUrl: string;
  roomTypeName: string;
  currency: string;
  availableRooms: any[];
  source: string;
  searchId?: string;
  description: string;
  mealBasis: string;
  latitude?: number | null;
  longitude?: number | null;
  isPreview?: boolean;
  popularityScore?: number;
  numNights?: number;
}

// ── Nights helper ──
function computeNights(checkin: string, checkout: string): number {
  try {
    const ci = new Date(checkin);
    const co = new Date(checkout);
    return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86_400_000));
  } catch { return 1; }
}

// Tripjack/Hotelston APIs return TOTAL stay price in the price field.
// Convert to per-night + keep total for display.
function toPerNightPricing(hotels: any[], numNights: number): any[] {
  const n = Math.max(1, numNights);
  return hotels.map(h => {
    const rawPrice = h.price || 0;
    // rawPrice is the total stay cost from the supplier API
    const perNight = n > 1 ? Math.round(rawPrice / n) : rawPrice;
    return {
      ...h,
      price: perNight,           // per-night price for display
      totalPrice: rawPrice,      // total stay price (what the API returned)
      pricePerNight: perNight,   // explicit per-night field
      numNights: n,
    };
  });
}

// ══════════════════════════════════════════════════
// TRIPJACK PROXY LAYER (formerly tripjack-hotel-search)
// ══════════════════════════════════════════════════

const PROXY_BASE = "http://65.20.67.77/tj";
const BATCH_SIZE = 100; // Tripjack max per request — proven working
const MAX_TOTAL_HIDS = 10_000; // Send ALL hotel IDs — Tripjack filters by availability
const BATCH_TIMEOUT_MS = 25_000;

interface TjProxyConfig {
  isActive: boolean;
  proxySecret: string;
}

async function getTjConfig(): Promise<TjProxyConfig> {
  const proxySecret = Deno.env.get("PROXY_SECRET_KEY");
  if (!proxySecret) throw new Error("PROXY_SECRET_KEY not configured");
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("api_settings").select("is_active, settings").eq("provider", "tripjack_hotel").maybeSingle();
  return { isActive: data?.is_active ?? false, proxySecret };
}

async function tjFetch(path: string, method: string, body?: any, proxySecret?: string): Promise<Response> {
  const url = `${PROXY_BASE}${path}`;
  console.log(`[tj-v2] ${method} ${url}`);
  const headers: Record<string, string> = { "x-vela-key": proxySecret || "", "x-tripjack-env": "prod" };
  if (body) headers["Content-Type"] = "application/json";
  return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

function toTripjackDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

function mapTripjackBookingStatus(tjStatus: string): string {
  const statusMap: Record<string, string> = {
    "SUCCESS": "success", "IN_PROGRESS": "success", "ON_HOLD": "on_hold",
    "PAYMENT_SUCCESS": "pending", "PAYMENT_PENDING": "pending", "PENDING": "pending",
    "ABORTED": "failed", "FAILED": "failed",
    "CANCELLATION_PENDING": "cancellation_pending", "CANCELLED": "cancelled",
  };
  return statusMap[tjStatus?.toUpperCase()] || "pending";
}

async function loadApiMarkup(sb: any): Promise<number> {
  try {
    const { data } = await sb.from("api_settings").select("settings").eq("provider", "api_markup").maybeSingle();
    if (data?.settings) {
      const m = data.settings as any;
      return m?.markup_percentage || (m?.per_api_hotel?.tripjack ?? 0);
    }
  } catch { }
  return 0;
}

interface BatchSearchResult {
  hotels: any[];
  searchData: any;
  errorCode?: string | null;
  invalidHotelIds?: string[];
}

function getTripjackErrorCode(payload: any, rawText: string): string | null {
  const directCode = payload?.errors?.[0]?.errCode || payload?.error?.errCode;
  if (directCode !== undefined && directCode !== null) return String(directCode);
  const match = rawText.match(/"errCode":"?(\d+)/i);
  return match?.[1] || null;
}

async function searchBatchV2(
  hids: string[], checkIn: string, checkOut: string,
  roomInfo: any[], nationality: string, currency: string,
  proxySecret: string, batchIndex: string | number
): Promise<BatchSearchResult> {
  const payload = {
    searchQuery: {
      checkinDate: toTripjackDate(checkIn),
      checkoutDate: toTripjackDate(checkOut),
      roomInfo,
      searchCriteria: { nationality: nationality || "106", currency: currency || "INR" },
      searchPreferences: { hids, fsc: true },
    },
    sync: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);

  try {
    const url = `${PROXY_BASE}/hms/v1/hotel-searchquery-list`;
    console.log(`[tj-v2] Batch ${batchIndex}: POST ${url} with ${hids.length} hids`);
    const t0 = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vela-key": proxySecret, "x-tripjack-env": "prod" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    console.log(`[tj-v2] Batch ${batchIndex}: status=${res.status} in ${Date.now() - t0}ms`);

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const errorCode = getTripjackErrorCode(parsed, text);
      console.warn(`[tj-v2] Batch ${batchIndex}: HTTP ${res.status}${errorCode ? ` errCode=${errorCode}` : ""} — ${text.substring(0, 200)}`);
      return { hotels: [], searchData: parsed, errorCode };
    }

    const data = parsed;
    if (!data) {
      console.warn(`[tj-v2] Batch ${batchIndex}: invalid JSON`);
      return { hotels: [], searchData: null };
    }

    if (!data?.status?.success) {
      const errorCode = getTripjackErrorCode(data, text);
      const errMsg = data?.errors?.[0]?.message || data?.error?.message || `httpStatus=${data?.status?.httpStatus || 'unknown'}`;
      console.warn(`[tj-v2] Batch ${batchIndex}: API error${errorCode ? ` errCode=${errorCode}` : ""} — ${errMsg}`);
      return { hotels: [], searchData: data, errorCode };
    }

    const hotelResults = data?.searchResult?.his || [];
    console.log(`[tj-v2] Batch ${batchIndex}: ${hotelResults.length} hotels found`);
    return { hotels: hotelResults, searchData: data, errorCode: null, invalidHotelIds: [] };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      console.warn(`[tj-v2] Batch ${batchIndex}: timeout after ${BATCH_TIMEOUT_MS}ms`);
    } else {
      console.error(`[tj-v2] Batch ${batchIndex}: error`, e);
    }
    return { hotels: [], searchData: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchBatchWithRecovery(
  hids: string[], checkIn: string, checkOut: string,
  roomInfo: any[], nationality: string, currency: string,
  proxySecret: string, batchIndex: string | number
): Promise<BatchSearchResult> {
  const result = await searchBatchV2(hids, checkIn, checkOut, roomInfo, nationality, currency, proxySecret, batchIndex);

  if (result.errorCode !== "6091") {
    return result;
  }

  if (hids.length === 1) {
    console.warn(`[tj-v2] Batch ${batchIndex}: isolated invalid hotel id ${hids[0]}`);
    return {
      hotels: [],
      searchData: result.searchData,
      errorCode: result.errorCode,
      invalidHotelIds: [hids[0]],
    };
  }

  const mid = Math.ceil(hids.length / 2);
  const left = hids.slice(0, mid);
  const right = hids.slice(mid);
  console.warn(`[tj-v2] Batch ${batchIndex}: splitting ${hids.length} hotel ids to isolate invalid Tripjack IDs`);

  const [leftResult, rightResult] = await Promise.all([
    searchBatchWithRecovery(left, checkIn, checkOut, roomInfo, nationality, currency, proxySecret, `${batchIndex}L`),
    searchBatchWithRecovery(right, checkIn, checkOut, roomInfo, nationality, currency, proxySecret, `${batchIndex}R`),
  ]);

  return {
    hotels: [...leftResult.hotels, ...rightResult.hotels],
    searchData: leftResult.searchData || rightResult.searchData,
    errorCode: null,
    invalidHotelIds: [...(leftResult.invalidHotelIds || []), ...(rightResult.invalidHotelIds || [])],
  };
}

// Map v2 search results
function mapHotelResultsV2(hotelResults: any[], staticDataMap: Map<number, any>, cityName: string) {
  return hotelResults.map((h: any) => {
    const uid = String(h.uid || "");
    const searchId = h.id || "";
    let lowestPrice = 0;
    let mealBasis = "";
    let isRefundable = h.ifca || false;
    const availableRooms: any[] = [];

    for (const opt of (h.ops || [])) {
      const optPrice = opt.tp || 0;
      if (optPrice > 0 && (lowestPrice === 0 || optPrice < lowestPrice)) {
        lowestPrice = optPrice;
        const firstRoom = opt.ris?.[0];
        mealBasis = firstRoom?.mb || "Room Only";
      }
      availableRooms.push({
        optionId: opt.id || "",
        price: Math.round(opt.tp || 0),
        mealBasis: opt.ris?.[0]?.mb || "Room Only",
        isRefundable: h.ifca || false,
        rooms: (opt.ris || []).map((ri: any) => ({
          id: ri.id, name: ri.rc || ri.rt || "",
          mealBasis: ri.mb || "Room Only", price: Math.round(ri.tp || 0),
        })),
      });
    }

    const sd = staticDataMap.get(Number(uid));
    const facilityNames = (sd?.facilities || []).map((f: any) => typeof f === "string" ? f : f?.name).filter(Boolean);
    const staticImages: string[] = (sd?.images || []).map((i: any) => typeof i === "string" ? i : i?.url).filter(Boolean);
    const thumbnail = sd?.hero_image_url || sd?.image_url || staticImages[0] || null;

    return {
      id: uid, tjHotelId: uid, searchId, name: h.name || sd?.name || "Unknown Hotel",
      city: h.ad?.ctn || sd?.city_name || cityName || "", country: h.ad?.cn || sd?.country_name || "",
      address: h.ad?.adr || sd?.address || "", stars: h.rt || sd?.rating || 0, rating: h.rt || sd?.rating || 0,
      price: Math.round(lowestPrice), currency: "INR", image: thumbnail, images: staticImages,
      amenities: facilityNames.slice(0, 10), propertyType: h.pt || sd?.property_type || "Hotel",
      latitude: sd?.latitude || null, longitude: sd?.longitude || null, source: "tripjack",
      mealBasis, isRefundable, hasFreeCancellation: isRefundable, availableRooms,
    };
  });
}

function mapV2Option(opt: any) {
  return {
    optionId: opt.id || "",
    price: Math.round(opt.tp || 0),
    mealBasis: opt.ris?.[0]?.mb || "Room Only",
    isRefundable: opt.cnp?.ifra || false,
    cancellation: opt.cnp || {},
    deadlineDate: opt.ddt || null,
    isPackageRate: opt.ispr || false,
    isPanRequired: opt.ipr || false,
    isPassportMandatory: opt.ipm || false,
    rooms: (opt.ris || []).map((ri: any) => ({
      id: ri.id, name: ri.rc || ri.rt || "", standardName: ri.srn || "",
      description: ri.des || "", mealBasis: ri.mb || "Room Only",
      price: Math.round(ri.tp || 0), adults: ri.adt || 0, children: ri.chd || 0,
      facilities: ri.fcs || [],
      images: (ri.imgs || []).map((img: any) => ({ url: img.url, size: img.sz })),
      roomDetails: ri.radi ? {
        roomId: ri.radi.rid, maxGuests: ri.radi.mga, maxAdults: ri.radi.maa,
        maxChildren: ri.radi.mca, views: ri.radi.vi || [],
        beds: (ri.radi.bds || []).map((b: any) => ({ type: b.bt, count: b.bc })),
        area: ri.radi.ar || {},
      } : null,
      occupancyPattern: ri.op || "", extraBenefits: ri.rexb || {},
    })),
    instructions: opt.inst || [],
  };
}

// ══════════════════════════════════════════════════
// SUPPLIER ADAPTERS
// ══════════════════════════════════════════════════

interface SupplierAdapter {
  name: string;
  search(params: SupplierSearchParams, config: HotelProviderConfig): Promise<NormalizedHotel[]>;
}

interface SupplierSearchParams {
  cityName: string;
  checkinDate: string;
  checkoutDate: string;
  adults: number;
  children: number;
  rooms: number;
  hotelIds?: string[];
  searchType?: string;
  actualCityName?: string;
  clientNationality?: string;
  testBatchSize?: number;
}

async function callEdgeFunction(functionName: string, body: any, timeoutMs = 12_000): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const controller = new AbortController();
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
      console.error(`[unified-hotel] ${functionName} HTTP ${response.status}: ${text.slice(0, 300)}`);
      return null;
    }
    return await response.json();
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "AbortError";
    if (timedOut) {
      console.error(`[unified-hotel] ${functionName} timeout after ${timeoutMs}ms`);
    } else {
      console.error(`[unified-hotel] ${functionName} error:`, e);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildRoomInfo(adults: number, children: number, rooms: number): { adults: number; child: number }[] {
  const effectiveRooms = Math.max(1, Math.min(rooms, adults));
  const baseAdults = Math.floor(adults / effectiveRooms);
  let remAdults = adults % effectiveRooms;
  return Array.from({ length: effectiveRooms }).map((_, i) => {
    const a = baseAdults + (remAdults > 0 ? 1 : 0);
    if (remAdults > 0) remAdults -= 1;
    return { adults: Math.max(1, a), child: i === 0 ? Math.max(0, children) : 0 };
  });
}

// Invalid hotel IDs are no longer cached — all IDs are attempted each search

// ── Tripjack Adapter (direct proxy, no intermediate edge function) ──

const tripjackAdapter: SupplierAdapter = {
  name: "tripjack",
  async search(params, config) {
    const t0 = Date.now();
    const timeout = getSupplierTimeout("tripjack", 58_000);
    try {
      // Direct Tripjack search via proxy
      const tjConfig = await getTjConfig();
      if (!tjConfig.isActive) {
        console.log("[unified-hotel] Tripjack disabled, skipping");
        return [];
      }

      // Resolve ISO nationality code to Tripjack numeric ID
      const resolvedNationality = await resolveTripjackNationality(params.clientNationality, tjConfig.proxySecret);
      console.log(`[unified-hotel] Tripjack nationality: ${params.clientNationality} → ${resolvedNationality}`);

      const rawRooms = buildRoomInfo(params.adults, params.children, params.rooms);
      const v2RoomInfo = rawRooms.map(r => ({
        numberOfAdults: r.adults,
        numberOfChild: r.child,
      }));

      let hotelIds: string[] = params.hotelIds || [];
      if (hotelIds.length === 0 && params.cityName) {
        const sb = getSupabaseAdmin();
        // Fetch ALL city map rows matching this city (case-insensitive) to merge variants
        const { data: cityMaps } = await sb
          .from("tripjack_city_hotel_map")
          .select("hotel_ids")
          .ilike("city_name", params.cityName.trim())
          .order("hotel_count", { ascending: false })
          .limit(10);
        if (cityMaps && cityMaps.length > 0) {
          const allIds = cityMaps.flatMap((m: any) => m.hotel_ids || []);
          hotelIds = Array.from(new Set(allIds));
        } else {
          const { data: partialMaps } = await sb
            .from("tripjack_city_hotel_map")
            .select("hotel_ids")
            .ilike("city_name", `%${params.cityName.trim()}%`)
            .order("hotel_count", { ascending: false })
            .limit(10);
          if (partialMaps && partialMaps.length > 0) {
            hotelIds = Array.from(new Set(partialMaps.flatMap((m: any) => m.hotel_ids || [])));
          }
        }

        // Supplement with tripjack_hotels table to catch any IDs missing from the map
        if (params.cityName) {
          const existingSet = new Set(hotelIds.map(String));
          const { data: extraHotels } = await sb
            .from("tripjack_hotels")
            .select("tj_hotel_id")
            .eq("is_deleted", false)
            .ilike("city_name", params.cityName.trim())
            .limit(10000);
          if (extraHotels) {
            for (const h of extraHotels) {
              const hid = String(h.tj_hotel_id || "");
              if (hid && !existingSet.has(hid)) {
                hotelIds.push(hid);
                existingSet.add(hid);
              }
            }
          }
          // If still no IDs, try partial match
          if (hotelIds.length === 0) {
            const { data: partialHotels } = await sb
              .from("tripjack_hotels")
              .select("tj_hotel_id")
              .eq("is_deleted", false)
              .ilike("city_name", `%${params.cityName.trim()}%`)
              .limit(10000);
            if (partialHotels) {
              for (const h of partialHotels) {
                const hid = String(h.tj_hotel_id || "");
                if (hid && !existingSet.has(hid)) {
                  hotelIds.push(hid);
                  existingSet.add(hid);
                }
              }
            }
          }
        }
      }

      const uniqueHotelIds = Array.from(new Set(hotelIds.map(String).filter(Boolean)));
      console.log(`[unified-hotel] City "${params.cityName}" resolved to ${uniqueHotelIds.length} unique hotel IDs`);

      if (uniqueHotelIds.length === 0) return [];

      const stringHids = uniqueHotelIds.slice(0, MAX_TOTAL_HIDS);
      const effectiveBatchSize = params.testBatchSize && params.testBatchSize >= 10 && params.testBatchSize <= 500 ? params.testBatchSize : BATCH_SIZE;
      const batches: string[][] = [];
      for (let i = 0; i < stringHids.length; i += effectiveBatchSize) {
        batches.push(stringHids.slice(i, i + effectiveBatchSize));
      }

      // Pre-fetch static data
      const sb2 = getSupabaseAdmin();
      const staticDataPromise = (async () => {
        const map = new Map<number, any>();
        const idsToFetch = stringHids.map(Number).filter(Boolean);
        if (idsToFetch.length === 0) return map;
        for (let i = 0; i < idsToFetch.length; i += 500) {
          const chunk = idsToFetch.slice(i, i + 500);
          const { data: staticRows } = await sb2
            .from("tripjack_hotels")
            .select("tj_hotel_id, unica_id, name, city_name, country_name, address, image_url, hero_image_url, images, latitude, longitude, facilities, rating, property_type")
            .eq("is_deleted", false)
            .or(`tj_hotel_id.in.(${chunk.join(",")})`);
          if (staticRows) {
            for (const r of staticRows) {
              if (r.tj_hotel_id) map.set(Number(r.tj_hotel_id), r);
            }
          }
        }
        return map;
      })();

      const allHotelResults: any[] = [];
      const invalidIdsDiscovered = new Set<string>();
      
      // Concurrency-limited parallel execution to avoid Tripjack rate limits
      const MAX_CONCURRENT = 3; // Max 3 parallel requests to avoid 6036 rate-limit
      const TIME_BOX_MS = 55_000; // 55s time-box (edge fn limit ~60s)
      const t0Batches = Date.now();
      console.log(`[unified-hotel] Tripjack: ${batches.length} batches (${stringHids.length} hids), concurrency=${MAX_CONCURRENT}`);
      
      let batchIdx = 0;
      const runNext = async (): Promise<void> => {
        while (batchIdx < batches.length) {
          if (Date.now() - t0Batches > TIME_BOX_MS) return; // time-box hit
          const idx = batchIdx++;
          const batch = batches[idx];
          try {
            const result = await searchBatchWithRecovery(batch, params.checkinDate, params.checkoutDate, v2RoomInfo, resolvedNationality, "INR", tjConfig.proxySecret, idx);
            if (result.hotels.length > 0) allHotelResults.push(...result.hotels);
            (result.invalidHotelIds || []).forEach((id) => invalidIdsDiscovered.add(id));
          } catch { /* logged inside */ }
        }
      };
      
      // Launch MAX_CONCURRENT workers, each processes batches sequentially
      const workers = Array.from({ length: Math.min(MAX_CONCURRENT, batches.length) }, () => runNext());
      const timeBox = new Promise<void>(resolve => setTimeout(resolve, TIME_BOX_MS));
      await Promise.race([Promise.all(workers), timeBox]);
      
      console.log(`[unified-hotel] Tripjack: ${allHotelResults.length} hotels collected from ${batches.length} batches (time-boxed at ${TIME_BOX_MS}ms)`);

      if (invalidIdsDiscovered.size > 0) {
        console.warn(`[unified-hotel] Tripjack: ${invalidIdsDiscovered.size} invalid hotel IDs discovered during 6091 recovery`);
      }

      const staticDataMap = await staticDataPromise;
      const mapped = mapHotelResultsV2(allHotelResults, staticDataMap, params.cityName);

      // Normalize to NormalizedHotel
      const markup = getMarkup(config, "tripjack");
      const hotels: NormalizedHotel[] = mapped.map((h: any) => {
        const price = Math.round((h.price || 0) * (1 + markup / 100));
        return {
          id: h.id, name: h.name, city: h.city, country: h.country,
          rating: h.rating || 0, reviews: 0, stars: h.stars || 0,
          price, originalPrice: h.price || 0, originalCurrency: "INR",
          crossedOutRate: 0, discountPercentage: 0,
          image: h.image, images: h.images || [], amenities: h.amenities || [],
          propertyType: h.propertyType || "Hotel", landingUrl: "", roomTypeName: "",
          currency: "INR", availableRooms: h.availableRooms || [],
          source: "tripjack", searchId: h.searchId || "",
          description: "", mealBasis: h.mealBasis || "",
          latitude: h.latitude, longitude: h.longitude,
        };
      });

      const duration = Date.now() - t0;
      recordSupplierCall("tripjack", duration, hotels.length > 0);
      console.log(`[unified-hotel] Tripjack: ${hotels.length} hotels in ${duration}ms`);
      return hotels;
    } catch (err) {
      recordSupplierCall("tripjack", Date.now() - t0, false);
      console.error("[unified-hotel] Tripjack error:", err);
      return [];
    }
  }
};

// ── Hotelston Adapter ──

const hotelstonAdapter: SupplierAdapter = {
  name: "hotelston",
  async search(params, config) {
    const t0 = Date.now();
    const timeout = getSupplierTimeout("hotelston", 25_000);
    try {
      const hotelstonCityName = params.searchType === "hotel"
        ? (params.actualCityName || params.cityName) : params.cityName;

      // Resolve Hotelston-specific hotel IDs from supplier mappings if available
      let hotelstonHotelIds: number[] | undefined;
      if (params.hotelIds?.length) {
        const sb = getSupabaseAdmin();
        const { data: mappings } = await sb
          .from("hotel_supplier_mappings")
          .select("supplier_hotel_id")
          .eq("supplier", "hotelston")
          .in("internal_hotel_id", params.hotelIds)
          .limit(200);
        if (mappings?.length) {
          hotelstonHotelIds = mappings.map((m: any) => parseInt(m.supplier_hotel_id)).filter(Boolean);
          console.log(`[unified-hotel] Hotelston: resolved ${hotelstonHotelIds.length} supplier hotel IDs from mappings`);
        }
      }

      const data = await callEdgeFunction("hotelston-hotel-search", {
        action: "search",
        checkIn: params.checkinDate,
        checkOut: params.checkoutDate,
        cityName: hotelstonCityName,
        adults: params.adults,
        children: params.children,
        rooms: params.rooms,
        clientNationality: params.clientNationality || "BD",
        skipImages: false,
        ...(hotelstonHotelIds?.length ? { hotelIds: hotelstonHotelIds } : {}),
      }, timeout);

      const markup = getMarkup(config, "hotelston");
      const hotels = normalizeHotelstonHotels(data, markup);
      const duration = Date.now() - t0;
      recordSupplierCall("hotelston", duration, hotels.length > 0);
      console.log(`[unified-hotel] Hotelston: ${hotels.length} hotels in ${duration}ms`);
      return hotels;
    } catch (err) {
      recordSupplierCall("hotelston", Date.now() - t0, false);
      console.error("[unified-hotel] Hotelston error:", err);
      return [];
    }
  }
};

// ── Normalizers ──

function normalizeHotelstonHotels(data: any, markup: number): NormalizedHotel[] {
  if (!data?.success || !data?.hotels?.length) return [];
  return data.hotels.map((h: any) => {
    const price = Math.round((h.price || 0) * (1 + markup / 100));
    const lowestRoom = h.rooms?.[0];
    return {
      id: h.id || `hotelston-${Math.random().toString(36).slice(2)}`,
      name: h.name || "Unknown Hotel", city: h.city || "", country: h.country || "",
      rating: h.stars || 0, reviews: 0, stars: h.stars || 0, price,
      originalPrice: h.price || 0, originalCurrency: "EUR",
      crossedOutRate: lowestRoom?.originalPrice && lowestRoom.originalPrice > lowestRoom.price
        ? Math.round(lowestRoom.originalPrice * (1 + markup / 100)) : 0,
      discountPercentage: lowestRoom?.specialOffer ? Math.round(((lowestRoom.originalPrice - lowestRoom.price) / lowestRoom.originalPrice) * 100) : 0,
      image: h.image || (h.images?.[0]) || null, images: h.images || [],
      amenities: [], propertyType: "Hotel", landingUrl: "",
      roomTypeName: lowestRoom?.roomTypeName || "", currency: "EUR",
      availableRooms: (h.rooms || []).map((r: any) => ({
        ...r,
        price: Math.round((r.price || 0) * (1 + markup / 100)),
        total_price: Math.round((r.price || 0) * (1 + markup / 100)),
        source: "hotelston",
      })),
      source: "hotelston", searchId: "", description: "",
      mealBasis: h.mealBasis || lowestRoom?.boardTypeName || "",
    };
  });
}

// ── Deduplication (merge, don't drop) ──

function hotelDeduplicationKey(h: NormalizedHotel): string {
  return `${h.name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${h.city.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

function mergeHotels(existing: NormalizedHotel, incoming: NormalizedHotel): NormalizedHotel {
  // Pick the one with better price as the base
  const base = existing.price <= incoming.price ? existing : incoming;
  const other = existing.price <= incoming.price ? incoming : existing;

  // Track distinct suppliers contributing to this merged hotel so the UI can
  // surface a "X rates compared" indicator without leaking supplier names.
  const sourceSet = new Set<string>();
  for (const s of [...String(base.source || "").split("+"), ...String(other.source || "").split("+")]) {
    const t = s.trim();
    if (t) sourceSet.add(t);
  }
  const supplierCount = sourceSet.size;

  return {
    ...base,
    // Prefer richer data
    image: base.image || other.image,
    images: base.images.length >= other.images.length ? base.images : other.images,
    amenities: [...new Set([...base.amenities, ...other.amenities])],
    description: base.description || other.description,
    stars: base.stars || other.stars,
    rating: Math.max(base.rating, other.rating),
    reviews: Math.max(base.reviews, other.reviews),
    latitude: base.latitude ?? other.latitude,
    longitude: base.longitude ?? other.longitude,
    // Merge room options from both suppliers
    availableRooms: [...(base.availableRooms || []), ...(other.availableRooms || [])],
    // Track merged source
    source: base.source === other.source ? base.source : `${base.source}+${other.source}`,
    // Display-layer hints (NOT supplier names — masked per provider-obfuscation rule)
    ...({
      _supplierCount: supplierCount,
      _highestPriceAcrossSuppliers: Math.max(base.price, other.price),
    } as any),
  };
}

function deduplicateHotels(hotels: NormalizedHotel[]): NormalizedHotel[] {
  const dedupMap = new Map<string, NormalizedHotel>();
  for (const h of hotels) {
    const key = hotelDeduplicationKey(h);
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, h);
    } else {
      dedupMap.set(key, mergeHotels(existing, h));
    }
  }
  return Array.from(dedupMap.values());
}

// ── Advanced Ranking Engine v3 ──
// 17-signal weighted scoring with traveler-profile awareness
// Traveler types: solo, couple, family, group — each gets different signal boosts
// Design: a cheap bad hotel must NOT beat a slightly pricier great hotel

type TravelerProfile = 'solo' | 'couple' | 'family' | 'group';

function classifyTravelers(adults: number, children: number, rooms: number): TravelerProfile {
  const total = adults + children;
  if (total <= 1) return 'solo';
  if (total === 2 && children === 0 && rooms <= 1) return 'couple';
  if (children > 0) return 'family';
  if (total >= 4 || rooms >= 2) return 'group';
  return adults === 2 ? 'couple' : 'solo';
}

// Profile-specific preferences used in scoring
const PROFILE_WEIGHTS: Record<TravelerProfile, {
  starMin: number;        // minimum stars preference
  mealBoost: number;      // multiplier for meal scoring
  cancelBoost: number;    // multiplier for free cancellation
  locationBoost: number;  // multiplier for centrality
  familyAmenities: string[];  // amenities that matter for this profile
  preferredPropertyTypes: string[];
}> = {
  solo: {
    starMin: 2, mealBoost: 0.8, cancelBoost: 1.0, locationBoost: 1.5,
    familyAmenities: ['wifi', 'workspace', 'gym'],
    preferredPropertyTypes: ['hostel', 'boutique', 'hotel'],
  },
  couple: {
    starMin: 3, mealBoost: 1.2, cancelBoost: 1.0, locationBoost: 1.3,
    familyAmenities: ['spa', 'pool', 'restaurant', 'bar'],
    preferredPropertyTypes: ['resort', 'boutique', 'villa'],
  },
  family: {
    starMin: 3, mealBoost: 1.5, cancelBoost: 1.5, locationBoost: 1.0,
    familyAmenities: ['pool', 'kids', 'family', 'playground', 'kitchen', 'laundry', 'connecting'],
    preferredPropertyTypes: ['resort', 'apartment', 'suite'],
  },
  group: {
    starMin: 2, mealBoost: 1.0, cancelBoost: 1.2, locationBoost: 1.2,
    familyAmenities: ['pool', 'bar', 'restaurant', 'parking'],
    preferredPropertyTypes: ['hotel', 'resort', 'villa'],
  },
};

interface RankingContext {
  popularityMap?: Map<string, { click_count: number; view_count: number; booking_count: number; popularity_rank: number }>;
  cityCenter?: { lat: number; lng: number } | null;
  medianPrice?: number;
  checkinDate?: string;    // for urgency scoring
  markupPct?: number;      // for margin-aware ranking
  travelerProfile?: TravelerProfile;
  adults?: number;
  children?: number;
  rooms?: number;
}

let _cachedPopularity: { map: Map<string, any>; fetchedAt: number } | null = null;
const POPULARITY_CACHE_TTL_MS = 5 * 60_000;

async function loadPopularityMap(sb: any): Promise<Map<string, any>> {
  if (_cachedPopularity && Date.now() - _cachedPopularity.fetchedAt < POPULARITY_CACHE_TTL_MS) {
    return _cachedPopularity.map;
  }
  const map = new Map<string, any>();
  try {
    const { data } = await sb
      .from("hotel_popularity_scores")
      .select("hotel_uid, click_count, view_count, booking_count, popularity_rank")
      .gt("popularity_rank", 0)
      .limit(5000);
    if (data) {
      for (const r of data) map.set(String(r.hotel_uid), r);
    }
    _cachedPopularity = { map, fetchedAt: Date.now() };
  } catch (e) {
    console.warn("[ranking] Failed to load popularity:", e);
  }
  return map;
}

function computeCityCenter(hotels: NormalizedHotel[]): { lat: number; lng: number } | null {
  const geoHotels = hotels.filter(h => h.latitude && h.longitude);
  if (geoHotels.length < 5) return null;
  const lats = geoHotels.map(h => h.latitude!).sort((a, b) => a - b);
  const lngs = geoHotels.map(h => h.longitude!).sort((a, b) => a - b);
  const mid = Math.floor(lats.length / 2);
  return { lat: lats[mid], lng: lngs[mid] };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Meal value tier mapping
const MEAL_VALUE_MAP: Record<string, number> = {
  "all inclusive": 5, "full board": 4, "half board": 3,
  "breakfast": 2, "bed and breakfast": 2, "continental breakfast": 2,
  "room only": 0, "": 0,
};
function getMealTier(mealBasis: string): number {
  const lower = (mealBasis || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(MEAL_VALUE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 0;
}

function rankHotelsAdvanced(hotels: NormalizedHotel[], ctx: RankingContext): NormalizedHotel[] {
  if (hotels.length === 0) return hotels;

  const popMap = ctx.popularityMap || new Map();
  const center = ctx.cityCenter || computeCityCenter(hotels);

  // Compute median price for value scoring (exclude 0-priced)
  const pricedHotels = hotels.filter(h => h.price > 0);
  const sortedPrices = pricedHotels.map(h => h.price).sort((a, b) => a - b);
  const medianPrice = ctx.medianPrice || (sortedPrices.length > 0
    ? sortedPrices[Math.floor(sortedPrices.length / 2)] : 0);

  // Days until check-in (for urgency scoring)
  let daysUntilCheckin = 30; // default = far future
  if (ctx.checkinDate) {
    const checkin = new Date(ctx.checkinDate);
    const now = new Date();
    daysUntilCheckin = Math.max(0, Math.floor((checkin.getTime() - now.getTime()) / 86_400_000));
  }

  const markupPct = ctx.markupPct || 0;
  const profile = ctx.travelerProfile || classifyTravelers(ctx.adults || 2, ctx.children || 0, ctx.rooms || 1);
  const pw = PROFILE_WEIGHTS[profile];

  return hotels.map(h => {
    let score = 0;

    // ═══ 1. QUALITY SCORE (max 30 pts) ═══
    const rating = h.rating || 0;
    const reviewCount = h.reviews || 0;
    const PRIOR_MEAN = 7.0;
    const PRIOR_WEIGHT = 50;
    const adjustedRating = reviewCount > 0
      ? (rating * reviewCount + PRIOR_MEAN * PRIOR_WEIGHT) / (reviewCount + PRIOR_WEIGHT)
      : PRIOR_MEAN * 0.8;
    score += Math.min(adjustedRating * 3, 30);

    // ═══ 2. STAR CLASS (max 15 pts) — profile-aware ═══
    const stars = h.stars || 0;
    score += Math.min(stars * 3, 15);
    // Penalty for below-profile-minimum stars
    if (stars > 0 && stars < pw.starMin) score -= (pw.starMin - stars) * 3;

    // ═══ 3. PRICE-VALUE RATIO (max 20 pts) ═══
    if (h.price > 0 && medianPrice > 0) {
      const priceRatio = h.price / medianPrice;
      const qualityIndex = ((h.stars || 2.5) / 5) * 0.6 + (adjustedRating / 10) * 0.4;

      if (priceRatio < 0.3 && qualityIndex < 0.4) {
        score += 2; // suspiciously cheap + low quality
      } else if (qualityIndex > 0.6 && priceRatio < 1.2) {
        score += Math.min(qualityIndex / priceRatio * 12, 20);
      } else {
        score += Math.min(qualityIndex / Math.max(priceRatio, 0.5) * 8, 15);
      }
    } else if (h.price > 0) {
      score += 5;
    }

    // ═══ 4. BOOKING & CLICK POPULARITY (max 15 pts) ═══
    const pop = popMap.get(String(h.id));
    if (pop) {
      score += Math.min((pop.booking_count || 0) * 5, 10);
      score += Math.min((pop.click_count || 0) * 0.5, 3);
      score += Math.min((pop.view_count || 0) * 0.1, 2);
    }

    // ═══ 5. CANCELLATION QUALITY (max 10 pts) — profile-scaled ═══
    const hasFreeCancellation = h.availableRooms?.some((r: any) => r.isRefundable);
    if (hasFreeCancellation) {
      const baseCancel = daysUntilCheckin > 14 ? 8 : 6;
      score += Math.min(baseCancel * pw.cancelBoost, 10);
    } else if (h.availableRooms?.length > 0) {
      score += 2;
    }

    // ═══ 6. LOCATION RELEVANCE (max 15 pts) — profile-scaled ═══
    if (center && h.latitude && h.longitude) {
      const distKm = haversineKm(center.lat, center.lng, h.latitude, h.longitude);
      let locScore = 0;
      if (distKm < 1) locScore = 10;
      else if (distKm < 3) locScore = 8;
      else if (distKm < 5) locScore = 6;
      else if (distKm < 10) locScore = 3;
      else locScore = 1;
      score += Math.min(locScore * pw.locationBoost, 15);
    } else {
      score += 4;
    }

    // ═══ 7. CONTENT QUALITY / CONFIDENCE (max 12 pts) ═══
    let contentScore = 0;
    if (h.image) contentScore += 3;
    if (h.images.length >= 3) contentScore += 2;
    if (h.images.length >= 8) contentScore += 1;
    if (h.amenities.length >= 3) contentScore += 2;
    if (h.amenities.length >= 7) contentScore += 1;
    if (h.description && h.description.length > 50) contentScore += 1;
    if (h.availableRooms.length >= 2) contentScore += 1;
    if (h.mealBasis && h.mealBasis !== "Room Only") contentScore += 1;
    score += Math.min(contentScore, 12);

    // ═══ 8. DISCOUNT / DEAL SIGNAL (max 5 pts) ═══
    if (h.discountPercentage > 0) {
      score += Math.min(h.discountPercentage / 10, 3);
    }
    if (h.crossedOutRate > 0 && h.crossedOutRate > h.price) {
      score += 2;
    }

    // ═══ 9. MULTI-SUPPLIER BOOST (max 5 pts) ═══
    if (h.source?.includes("+")) score += 5;

    // ═══ 10. MEAL VALUE SCORING (max 12 pts) — profile-scaled ═══
    // Families need breakfast; couples value half-board; solo doesn't care as much
    const mealTier = getMealTier(h.mealBasis);
    if (mealTier > 0) {
      const bestMealTier = Math.max(
        mealTier,
        ...h.availableRooms.map((r: any) => getMealTier(r.mealBasis || ""))
      );
      score += Math.min(bestMealTier * 1.6 * pw.mealBoost, 12);
    }

    // ═══ 11. MARGIN-AWARE RANKING (max 6 pts) ═══
    if (h.price > 0 && markupPct > 0 && medianPrice > 0) {
      const absoluteMargin = h.price * (markupPct / 100);
      const medianMargin = medianPrice * (markupPct / 100);
      const marginRatio = absoluteMargin / Math.max(medianMargin, 1);
      score += Math.min(Math.max(marginRatio - 0.5, 0) * 4, 6);
    }

    // ═══ 12. CHECK-IN URGENCY (max 6 pts) ═══
    if (daysUntilCheckin <= 3) {
      if (h.availableRooms.length > 0) score += 3;
      if (hasFreeCancellation) score += 2;
      if (h.availableRooms.length >= 3) score += 1;
    } else if (daysUntilCheckin <= 7) {
      if (h.availableRooms.length > 0) score += 2;
      if (hasFreeCancellation) score += 1;
    }

    // ═══ 13. REVIEW VOLUME CONFIDENCE (max 5 pts) ═══
    if (reviewCount > 0) {
      if (reviewCount >= 1000) score += 5;
      else if (reviewCount >= 500) score += 4;
      else if (reviewCount >= 100) score += 3;
      else if (reviewCount >= 30) score += 2;
      else score += 1;
    }

    // ═══ 14. ROOM OPTION DIVERSITY (max 4 pts) ═══
    const uniqueRoomTypes = new Set(h.availableRooms.map((r: any) => r.mealBasis || "")).size;
    score += Math.min(uniqueRoomTypes, 4);

    // ═══ 15. TRAVELER-FIT AMENITY MATCH (max 10 pts) — NEW ═══
    // Check if hotel amenities match the traveler profile's preferences
    const amenityLower = h.amenities.map((a: string) => a.toLowerCase());
    const descLower = (h.description || "").toLowerCase();
    const propTypeLower = (h.propertyType || "").toLowerCase();
    let amenityFit = 0;
    for (const pref of pw.familyAmenities) {
      if (amenityLower.some(a => a.includes(pref)) || descLower.includes(pref)) {
        amenityFit += 2;
      }
    }
    score += Math.min(amenityFit, 10);

    // ═══ 16. PROPERTY TYPE PREFERENCE (max 6 pts) — NEW ═══
    // Couples prefer boutique/resort; families prefer apartments/suites; solo prefers budget
    if (propTypeLower) {
      const typeMatch = pw.preferredPropertyTypes.some(t => propTypeLower.includes(t));
      if (typeMatch) score += 6;
    }

    // ═══ 17. ROOM CAPACITY FIT (max 8 pts) — NEW ═══
    // Boost hotels whose rooms can actually fit the travelers without needing extra rooms
    const totalGuests = (ctx.adults || 2) + (ctx.children || 0);
    const roomsNeeded = ctx.rooms || Math.ceil(totalGuests / 2);
    if (h.availableRooms.length > 0) {
      // Check if any room mentions family/connecting/suite for families
      if (profile === 'family') {
        const hasFamilyRoom = h.availableRooms.some((r: any) => {
          const rn = ((r.roomName || '') + ' ' + (r.standardName || '')).toLowerCase();
          return rn.includes('family') || rn.includes('connecting') || rn.includes('triple') || rn.includes('quad');
        });
        if (hasFamilyRoom) score += 8;
        else if (h.availableRooms.length >= roomsNeeded) score += 4;
      } else if (profile === 'group') {
        // Groups need multiple rooms — prefer hotels with plenty of availability
        if (h.availableRooms.length >= roomsNeeded * 2) score += 8;
        else if (h.availableRooms.length >= roomsNeeded) score += 5;
      } else {
        if (h.availableRooms.length >= roomsNeeded) score += 6;
      }
    }

    return { ...h, popularityScore: Math.round(score * 10) / 10 };
  }).sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
}

// Backward-compatible wrapper (sync, no DB)
function rankHotels(hotels: NormalizedHotel[]): NormalizedHotel[] {
  return rankHotelsAdvanced(hotels, {});
}

// Full ranking with all signals (async, loads popularity from DB)
async function rankHotelsWithContext(
  hotels: NormalizedHotel[], sb: any, checkinDate?: string, markupPct?: number,
  adults?: number, children?: number, rooms?: number
): Promise<NormalizedHotel[]> {
  const popularityMap = await loadPopularityMap(sb);
  return rankHotelsAdvanced(hotels, { popularityMap, checkinDate, markupPct, adults, children, rooms });
}

// ── Snapshot Writers (cache-first architecture) ──

function buildOccupancyKey(adults: number, children: number, rooms: number): string {
  return `${adults || 2}-${children || 0}-${rooms || 1}`;
}

async function writeSearchSnapshots(sb: any, hotels: NormalizedHotel[], checkin: string, checkout: string, occupancyKey: string): Promise<void> {
  if (!hotels.length) return;
  try {
    const now = new Date().toISOString();
    const snapshots = hotels.slice(0, 200).map(h => ({
      hotel_uid: h.id,
      search_hotel_id: h.searchId || '',
      checkin, checkout, occupancy_key: occupancyKey,
      min_price: h.originalPrice || h.price || 0,
      currency: h.originalCurrency || h.currency || 'INR',
      free_cancellation: h.availableRooms?.some((r: any) => r.isRefundable) || false,
      property_type: h.propertyType || 'Hotel',
      meal_basis: h.mealBasis || '',
      raw_search_json: { availableRooms: (h.availableRooms || []).slice(0, 5), source: h.source },
      stale_status: 'fresh',
      last_checked_at: now, updated_at: now,
    }));
    for (let i = 0; i < snapshots.length; i += 50) {
      await sb.from('hotel_search_snapshot').upsert(snapshots.slice(i, i + 50), { onConflict: 'hotel_uid,checkin,checkout,occupancy_key' });
    }
    const statics = hotels.slice(0, 200).filter(h => h.name).map(h => ({
      hotel_uid: h.id, name: h.name, rating: h.rating || 0, stars: h.stars || 0,
      address: '', city: h.city, country: h.country,
      latitude: h.latitude || null, longitude: h.longitude || null,
      property_type: h.propertyType || 'Hotel',
      hero_image_url: h.image || null,
      images_json: (h.images || []).slice(0, 10),
      facilities_json: (h.amenities || []).slice(0, 15),
      description: typeof h.description === 'string' ? h.description : '',
      source: h.source?.split('+')[0] || 'tripjack',
      updated_at: now,
    }));
    for (let i = 0; i < statics.length; i += 50) {
      await sb.from('hotel_static_cache').upsert(statics.slice(i, i + 50), { onConflict: 'hotel_uid,source' });
    }
    console.log(`[snapshots] Wrote ${snapshots.length} search + ${statics.length} static snapshots`);
  } catch (e) { console.warn('[snapshots] writeSearchSnapshots error:', e); }
}

function normalizeCancellation(opt: any): { type: string; deadline: string | null; isFree: boolean; text: string } {
  const cnp = opt.cancellation || opt.cnp || {};
  const ifra = cnp.ifra || opt.isRefundable || false;
  const ddt = opt.deadlineDate || opt.ddt || cnp.ddt || null;
  if (!ifra) return { type: 'non_refundable', deadline: null, isFree: false, text: 'Non-refundable' };
  if (ddt) {
    const deadlineDate = new Date(ddt);
    return { type: 'free_until', deadline: ddt, isFree: true, text: `Free cancellation until ${deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
  }
  return { type: 'policy', deadline: null, isFree: true, text: 'Free cancellation available' };
}

async function writeDetailSnapshots(sb: any, hotelUid: string, searchHotelId: string, checkin: string, checkout: string, occupancyKey: string, options: any[], rawDetail: any): Promise<void> {
  if (!options.length) return;
  try {
    const now = new Date().toISOString();
    await sb.from('hotel_detail_snapshot').upsert({
      hotel_uid: hotelUid, search_hotel_id: searchHotelId,
      checkin, checkout, occupancy_key: occupancyKey,
      raw_detail_json: rawDetail || {}, options_count: options.length,
      last_checked_at: now, updated_at: now,
    }, { onConflict: 'hotel_uid,checkin,checkout,occupancy_key' });

    const optSnaps: any[] = [];
    const roomSnaps: any[] = [];
    for (const opt of options) {
      const canc = normalizeCancellation(opt);
      optSnaps.push({
        option_id: opt.optionId || '', hotel_uid: hotelUid,
        checkin, checkout, occupancy_key: occupancyKey,
        total_price: opt.price || 0, currency: 'INR',
        cancellation_type: canc.type, cancellation_deadline_at: canc.deadline,
        cancellation_is_free: canc.isFree, cancellation_text: canc.text,
        cancellation_policy_raw_json: opt.cancellation || {},
        pan_required: opt.compliance?.panRequired || opt.isPanRequired || false,
        passport_required: opt.compliance?.passportRequired || opt.isPassportMandatory || false,
        is_package_rate: opt.isPackageRate || false,
        availability_status: 'available', meal_basis: opt.mealBasis || '',
        last_checked_at: now, updated_at: now,
      });
      for (const room of (opt.rooms || [])) {
        roomSnaps.push({
          room_id: room.id || '', option_id: opt.optionId || '', hotel_uid: hotelUid,
          room_name: room.name || '', standard_name: room.standardName || '',
          description: room.description || '', meal_basis: room.mealBasis || '',
          facilities_json: room.facilities || [],
          images_json: (room.images || []).map((img: any) => typeof img === 'string' ? img : img?.url || '').filter(Boolean),
          room_details_json: room.roomDetails || {},
          occupancy_json: { adults: room.adults || 0, children: room.children || 0 },
          updated_at: now,
        });
      }
    }
    if (optSnaps.length) await sb.from('hotel_option_snapshot').upsert(optSnaps, { onConflict: 'option_id,hotel_uid,checkin,checkout,occupancy_key' });
    if (roomSnaps.length) await sb.from('hotel_room_snapshot').upsert(roomSnaps, { onConflict: 'room_id,option_id' });
    console.log(`[snapshots] Wrote detail: ${optSnaps.length} options, ${roomSnaps.length} rooms for hotel ${hotelUid}`);
  } catch (e) { console.warn('[snapshots] writeDetailSnapshots error:', e); }
}

async function buildCachedDetailFallback(sb: any, hotelUid: string, checkin: string, checkout: string, occupancyKey: string) {
  const [{ data: staticHotel }, { data: detailSnap }, { data: optionSnaps }, { data: roomSnaps }] = await Promise.all([
    sb.from('tripjack_hotels').select('name, rating, address, property_type, hero_image_url, image_url, images, facilities').eq('tj_hotel_id', Number(hotelUid)).maybeSingle(),
    sb.from('hotel_detail_snapshot').select('search_hotel_id, raw_detail_json, options_count, last_checked_at').eq('hotel_uid', hotelUid).eq('checkin', checkin).eq('checkout', checkout).eq('occupancy_key', occupancyKey).order('last_checked_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('hotel_option_snapshot').select('option_id, total_price, currency, cancellation_type, cancellation_deadline_at, cancellation_is_free, cancellation_text, cancellation_policy_raw_json, pan_required, passport_required, is_package_rate, availability_status, meal_basis, last_checked_at').eq('hotel_uid', hotelUid).eq('checkin', checkin).eq('checkout', checkout).eq('occupancy_key', occupancyKey).order('last_checked_at', { ascending: false }),
    sb.from('hotel_room_snapshot').select('option_id, room_id, room_name, standard_name, description, meal_basis, facilities_json, images_json, room_details_json, occupancy_json, updated_at').eq('hotel_uid', hotelUid).order('updated_at', { ascending: false }),
  ]);

  if (!staticHotel || !optionSnaps?.length) return null;

  const allStaticImages: any[] = Array.isArray(staticHotel.images) ? staticHotel.images : [];
  const staticImages: string[] = allStaticImages.map((img: any) => typeof img === 'string' ? img : img?.url || '').filter(Boolean);

  // Build room-to-image map from static `rids` (mirrors live detail path)
  const roomImageMap = new Map<string, string[]>();
  for (const img of allStaticImages) {
    const url = typeof img === 'string' ? img : img?.url;
    const rids: string[] = (img && Array.isArray(img.rids)) ? img.rids : [];
    if (url && rids.length > 0) {
      for (const rid of rids) {
        if (!roomImageMap.has(rid)) roomImageMap.set(rid, []);
        roomImageMap.get(rid)!.push(url);
      }
    }
  }
  const resolveRoomImages = (roomImagesJson: any, roomId: string): { url: string; size: string }[] => {
    const fromSnap = (Array.isArray(roomImagesJson) ? roomImagesJson : []).filter(Boolean);
    if (fromSnap.length > 0) return fromSnap.map((url: string) => ({ url, size: '' }));
    if (roomId) {
      const exact = roomImageMap.get(roomId);
      if (exact?.length) return exact.map((url) => ({ url, size: '' }));
      const base = String(roomId).split(/[#]/)[0];
      for (const [rid, urls] of roomImageMap) {
        if (rid.startsWith(base) || base.startsWith(rid)) return urls.map((url) => ({ url, size: '' }));
      }
    }
    return [];
  };

  const roomsByOption = new Map<string, any[]>();
  for (const room of (roomSnaps || [])) {
    const optionId = String(room.option_id || '');
    if (!optionId) continue;
    if (!roomsByOption.has(optionId)) roomsByOption.set(optionId, []);
    roomsByOption.get(optionId)!.push({
      id: room.room_id || '',
      name: room.room_name || 'Room',
      standardName: room.standard_name || '',
      description: room.description || '',
      mealBasis: room.meal_basis || '',
      facilities: Array.isArray(room.facilities_json) ? room.facilities_json : [],
      images: resolveRoomImages(room.images_json, room.room_id || ''),
      roomDetails: room.room_details_json || null,
      adults: room.occupancy_json?.adults || 0,
      children: room.occupancy_json?.children || 0,
    });
  }

  const options = optionSnaps.map((opt: any) => ({
    optionId: opt.option_id || '',
    price: Number(opt.total_price || 0),
    mealBasis: opt.meal_basis || 'Room Only',
    isRefundable: !!opt.cancellation_is_free,
    cancellation: opt.cancellation_policy_raw_json || {},
    isPackageRate: !!opt.is_package_rate,
    isPanRequired: !!opt.pan_required,
    isPassportMandatory: !!opt.passport_required,
    roomLeft: 0,
    rooms: roomsByOption.get(String(opt.option_id || '')) || [],
  }));

  const raw = detailSnap?.raw_detail_json || {};
  return {
    id: detailSnap?.search_hotel_id || hotelUid,
    searchId: detailSnap?.search_hotel_id || hotelUid,
    tjHotelId: hotelUid,
    name: raw.name || staticHotel.name || '',
    rating: raw.rt || staticHotel.rating || 0,
    address: raw.ad || staticHotel.address || {},
    propertyType: raw.pt || staticHotel.property_type || 'Hotel',
    instructions: raw.inst || [],
    images: staticImages,
    options,
    cached: true,
  };
}

/** Resolve cached fallback detail when live API returns expired (errCode 6001/6003). */
async function tryCachedDetailFallback(sb: any, hotelUid: string, checkIn: string, checkOut: string, rooms: any): Promise<any | null> {
  if (!hotelUid || !checkIn || !checkOut) return null;
  try {
    const adults = Array.isArray(rooms) ? rooms.reduce((s: number, r: any) => s + (Number(r?.adults) || 1), 0) : 2;
    const children = Array.isArray(rooms) ? rooms.reduce((s: number, r: any) => s + (Number(r?.children) || 0), 0) : 0;
    const roomCount = Array.isArray(rooms) && rooms.length ? rooms.length : 1;
    const occKey = buildOccupancyKey(adults, children, roomCount);
    const result = await buildCachedDetailFallback(sb, hotelUid, checkIn, checkOut, occKey);
    if (result) console.log(`[unified-hotel] Detail fallback served from snapshot for hotel=${hotelUid}`);
    return result;
  } catch (e) {
    console.warn('[unified-hotel] tryCachedDetailFallback error:', e);
    return null;
  }
}

async function writePriceChange(sb: any, hotelUid: string, optionId: string, oldPrice: number, newPrice: number, checkin: string, checkout: string, changeType: string): Promise<void> {
  if (Math.abs(oldPrice - newPrice) < 1) return;
  try {
    await sb.from('hotel_price_history').insert({
      hotel_uid: hotelUid, option_id: optionId,
      checkin, checkout, old_price: oldPrice, new_price: newPrice,
      currency: 'INR', change_type: changeType,
    });
  } catch (e) { console.warn('[snapshots] writePriceChange error:', e); }
}

// ── Cache ──

function buildCacheKey(body: any): string {
  const parts = [
    body.cityName?.toLowerCase().trim(),
    body.checkinDate, body.checkoutDate,
    body.adults || 2, body.children || 0, body.rooms || 1,
    body.searchType || "city",
    (body.hotelIds || []).sort().join(","),
  ];
  return parts.join("|");
}

const CACHE_TTL = 7200;
const SESSION_TTL = 3600;

async function getCachedResults(sb: any, cacheKey: string): Promise<any[] | null> {
  try {
    const { data } = await sb.from("hotel_search_cache").select("results, result_count")
      .eq("cache_key", cacheKey).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (data?.results && data.result_count > 0) {
      console.log(`[unified-hotel] Postgres cache HIT: ${data.result_count} hotels`);
      return data.results;
    }
  } catch (e) { console.warn("[unified-hotel] Cache read error:", e); }
  return null;
}

async function setCachedResults(sb: any, cacheKey: string, results: any[]): Promise<void> {
  try {
    await sb.from("hotel_search_cache").upsert({
      cache_key: cacheKey, results, result_count: results.length,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL * 1000).toISOString(),
    }, { onConflict: "cache_key" });
  } catch (e) { console.warn("[unified-hotel] Cache write error:", e); }
}

// ── Session Engine ──

function generateSessionId(): string {
  return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function createSession(sb: any, sessionId: string, searchParams: any, hotels: NormalizedHotel[], currency: string, providerStats: any): Promise<void> {
  const sessionData = {
    session_id: sessionId, search_params: searchParams, hotels,
    hotel_count: hotels.length, provider_stats: providerStats,
    display_currency: currency, status: "complete",
  };
  await Promise.allSettled([
    sb.from("hotel_search_sessions").upsert({
      ...sessionData,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL * 1000).toISOString(),
    }, { onConflict: "session_id" }),
    updateHotelCityEstimates(sb, hotels, searchParams?.city || searchParams?.destination || "", currency),
  ]);
}

/** Capture avg per-night hotel prices from real searches into hotel_city_estimates */
async function updateHotelCityEstimates(sb: any, hotels: NormalizedHotel[], city: string, currency: string): Promise<void> {
  if (!hotels.length || !city) return;
  try {
    // Get prices in USD for consistency
    const prices = hotels.filter(h => h.price > 0).map(h => h.price);
    if (!prices.length) return;

    // Convert display-currency prices to USD estimate
    const rates: Record<string, number> = {
      USD: 1, EUR: 0.92, GBP: 0.79, BDT: 110.5, INR: 84, CNY: 7.24,
      AED: 3.67, MYR: 4.47, SGD: 1.34, THB: 34.5, LKR: 300, NPR: 134, PKR: 278,
    };
    const rate = rates[currency] || 1;
    const pricesUSD = prices.map(p => p / rate);
    const avgUSD = pricesUSD.reduce((a, b) => a + b, 0) / pricesUSD.length;
    const minUSD = Math.min(...pricesUSD);
    const sampleCount = prices.length;

    // Normalize city name
    const cityNorm = city.trim().split(",")[0].trim();
    if (!cityNorm) return;

    // Weighted update: blend with existing if from real searches
    const { data: existing } = await sb.from("hotel_city_estimates")
      .select("avg_per_night_usd, min_per_night_usd, sample_count, source")
      .eq("city", cityNorm).maybeSingle();

    if (existing && existing.source === "search" && existing.sample_count > 0) {
      // Exponential moving average: new data gets 40% weight
      const blendedAvg = existing.avg_per_night_usd * 0.6 + avgUSD * 0.4;
      const blendedMin = Math.min(existing.min_per_night_usd, minUSD);
      await sb.from("hotel_city_estimates").upsert({
        city: cityNorm, avg_per_night_usd: Math.round(blendedAvg * 100) / 100,
        min_per_night_usd: Math.round(blendedMin * 100) / 100,
        sample_count: existing.sample_count + sampleCount,
        source: "search", updated_at: new Date().toISOString(),
      }, { onConflict: "city" });
    } else {
      // First real data or replacing seed
      await sb.from("hotel_city_estimates").upsert({
        city: cityNorm, avg_per_night_usd: Math.round(avgUSD * 100) / 100,
        min_per_night_usd: Math.round(minUSD * 100) / 100,
        sample_count: sampleCount,
        source: "search", updated_at: new Date().toISOString(),
      }, { onConflict: "city" });
    }
    console.log(`[estimates] Updated hotel_city_estimates for ${cityNorm}: avg=$${Math.round(avgUSD)}/night from ${sampleCount} hotels`);
  } catch (e) {
    console.warn("[estimates] Failed to update hotel_city_estimates:", e);
  }
}

async function getSession(sb: any, sessionId: string): Promise<any | null> {
  try {
    const { data } = await sb.from("hotel_search_sessions").select("*")
      .eq("session_id", sessionId).gt("expires_at", new Date().toISOString()).maybeSingle();
    return data;
  } catch { return null; }
}

// ── Session-based filtering/sorting/pagination ──

function applySessionFilters(hotels: NormalizedHotel[], filters: any): NormalizedHotel[] {
  let result = [...hotels];
  if (filters.name) { const q = filters.name.toLowerCase(); result = result.filter(h => h.name.toLowerCase().includes(q)); }
  if (filters.stars?.length) result = result.filter(h => filters.stars.includes(h.stars));
  if (filters.priceMin !== undefined) result = result.filter(h => h.price >= filters.priceMin);
  if (filters.priceMax !== undefined) result = result.filter(h => h.price <= filters.priceMax);
  if (filters.propertyTypes?.length) result = result.filter(h => filters.propertyTypes.includes(h.propertyType));
  if (filters.sources?.length) result = result.filter(h => filters.sources.includes(h.source));
  const sortBy = filters.sortBy || "popularity";
  switch (sortBy) {
    case "price_asc": result.sort((a, b) => a.price - b.price); break;
    case "price_desc": result.sort((a, b) => b.price - a.price); break;
    case "rating": result.sort((a, b) => b.rating - a.rating); break;
    case "stars": result.sort((a, b) => b.stars - a.stars); break;
    default: result.sort((a, b) => (b.popularityScore || b.rating) - (a.popularityScore || a.rating));
  }
  return result;
}

function paginateResults(hotels: NormalizedHotel[], page: number, pageSize: number) {
  const totalResults = hotels.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  return { hotels: hotels.slice(start, start + pageSize), totalPages, totalResults };
}

function parseNumericHotelIds(ids: string[] = []): number[] {
  return ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
}

function buildTripjackHotelIdFilter(ids: number[]): string {
  return `unica_id.in.(${ids.join(",")}),tj_hotel_id.in.(${ids.join(",")})`;
}

async function resolveTripjackLiveHotelIds(sb: any, hotelIds: string[]): Promise<string[]> {
  const numericIds = parseNumericHotelIds(hotelIds);
  if (!numericIds.length) return [];
  const { data } = await sb.from("tripjack_hotels").select("tj_hotel_id, unica_id")
    .eq("is_deleted", false).or(buildTripjackHotelIdFilter(numericIds)).limit(Math.min(numericIds.length, 60));
  const liveIds = Array.from(new Set((data || []).map((row: any) => String(row.tj_hotel_id || row.unica_id || "")).filter(Boolean)));
  return liveIds.length ? liveIds : hotelIds;
}

async function loadTopTripjackLiveHotelIds(sb: any, cityName: string): Promise<string[]> {
  // Load ALL hotel IDs for the city — Tripjack filters by availability server-side
  const trimmed = cityName.trim();
  
  // First: city map (fastest, pre-aggregated)
  const { data: cityMaps } = await sb
    .from("tripjack_city_hotel_map")
    .select("hotel_ids")
    .ilike("city_name", trimmed)
    .order("hotel_count", { ascending: false })
    .limit(10);
  
  if (cityMaps && cityMaps.length > 0) {
    const allIds = cityMaps.flatMap((m: any) => m.hotel_ids || []);
    const unique = Array.from(new Set(allIds.map(String).filter(Boolean)));
    if (unique.length > 0) {
      console.log(`[loadTopIds] City "${trimmed}": ${unique.length} IDs from city map`);
      return unique;
    }
  }
  
  // Fallback: direct table query
  const { data: hotels } = await sb.from("tripjack_hotels")
    .select("tj_hotel_id")
    .eq("is_deleted", false)
    .ilike("city_name", trimmed)
    .limit(10000);
  
  if (hotels?.length) {
    const ids = hotels.map((h: any) => String(h.tj_hotel_id || "")).filter(Boolean);
    console.log(`[loadTopIds] City "${trimmed}": ${ids.length} IDs from direct query`);
    return Array.from(new Set(ids));
  }
  
  // Partial match fallback
  const { data: partialHotels } = await sb.from("tripjack_hotels")
    .select("tj_hotel_id")
    .eq("is_deleted", false)
    .ilike("city_name", `%${trimmed}%`)
    .limit(10000);
  
  const partialIds = (partialHotels || []).map((h: any) => String(h.tj_hotel_id || "")).filter(Boolean);
  console.log(`[loadTopIds] City "${trimmed}": ${partialIds.length} IDs from partial match`);
  return Array.from(new Set(partialIds));
}

// ── Orchestrator ──

async function performSearch(params: SupplierSearchParams, config: HotelProviderConfig): Promise<{ hotels: NormalizedHotel[]; providerStats: Record<string, any> }> {
  const t0 = Date.now();
  const adapters: SupplierAdapter[] = [];
  if (config.tripjackEnabled) adapters.push(tripjackAdapter);
  if (config.hotelstonEnabled) adapters.push(hotelstonAdapter);
  if (adapters.length === 0) return { hotels: [], providerStats: {} };

  console.log(`[unified-hotel] Running ${adapters.length} suppliers: ${adapters.map(a => a.name).join(", ")}`);

  const results = await Promise.allSettled(
    adapters.map(async (adapter) => {
      const t1 = Date.now();
      const hotels = await adapter.search(params, config);
      return { supplier: adapter.name, hotels, durationMs: Date.now() - t1 };
    })
  );

  const allHotels: NormalizedHotel[] = [];
  const providerStats: Record<string, any> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      const { supplier, hotels, durationMs } = r.value;
      providerStats[supplier] = { count: hotels.length, durationMs, success: true };
      allHotels.push(...hotels);
    } else {
      console.error("[unified-hotel] Supplier failed:", r.reason);
    }
  }

  console.log(`[unified-hotel] All suppliers done in ${Date.now() - t0}ms, raw: ${allHotels.length}`);
  const deduped = deduplicateHotels(allHotels);
  return { hotels: await rankHotelsWithContext(deduped, getSupabaseAdmin(), params.checkinDate, config.markupPercentage, params.adults, params.children, params.rooms), providerStats };
}

// ══════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════

console.log("[unified-hotel] Caching: Postgres only");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return json({ success: false, error: "Rate limit exceeded" }, 429);
  }

  try {
    const body = await req.json();
    const sb = getSupabaseAdmin();
    const action = body.action;

    // ══════════════════════════════════════════════════
    // TRIPJACK-SPECIFIC ACTIONS (formerly in tripjack-hotel-search)
    // ══════════════════════════════════════════════════

    // ── Test connectivity ──
    if (action === "test") {
      const tjConfig = await getTjConfig();
      const proxyBase = body.proxyBase || PROXY_BASE;
      const apiVersion = body.apiVersion || "v1";
      const endpoint = body.endpoint || "fetch-static-hotels";
      const testBody = body.testBody || {};
      const testMethod = body.testMethod || "POST";
      try {
        let url: string;
        if (endpoint.startsWith("/")) url = `${proxyBase}${endpoint}`;
        else if (endpoint === "fetch-static-hotels" || endpoint === "fetch-static-hotels/deleted") url = `${proxyBase}/hms/${apiVersion}/${endpoint}`;
        else url = `${proxyBase}/hms/${apiVersion}/hotel/${endpoint}`;
        console.log(`[tj-test] ${testMethod} ${url}`);
        const headers: Record<string, string> = { "x-vela-key": tjConfig.proxySecret || "", "x-tripjack-env": "prod" };
        if (testMethod === "POST") headers["Content-Type"] = "application/json";
        const res = await fetch(url, { method: testMethod, headers, body: testMethod === "POST" ? JSON.stringify(testBody) : undefined });
        const status = res.status;
        const text = await res.text();
        let idFields: any = null;
        try {
          const parsed = JSON.parse(text);
          const first = parsed?.hotelOpInfos?.[0];
          if (first) idFields = { hotelId: first.hotelId, tjHotelId: first.tjHotelId, unicaId: first.unicaId, id: first.id, uid: first.uid, hid: first.hid, keys: Object.keys(first).slice(0, 20) };
        } catch {}
        return json({ success: status === 200 || status === 400, status, preview: text.substring(0, 2000), idFields, url, apiVersion });
      } catch (e: any) {
        return json({ success: false, error: e.message, apiVersion });
      }
    }

    // ── Clear search cache (Postgres only) ──
    if (action === "clear-invalid-cache") {
      const cityName = body.cityName;
      if (cityName) {
        const sb = getSupabaseAdmin();
        await sb.from("hotel_search_cache").delete().ilike("cache_key", `%${cityName.toLowerCase()}%`);
        console.log(`[unified-hotel] Cleared search cache for "${cityName}"`);
      }
      return json({ success: true, message: "Search cache cleared" + (cityName ? ` for ${cityName}` : "") });
    }

    // ── Detail ──
    if (action === "detail") {
      const tjConfig = await getTjConfig();
      if (!tjConfig.isActive) return json({ success: false, error: "Tripjack Hotel API is not active" });

      const { searchId, id, hid, hotelId, checkIn, checkOut, rooms, nationality, targetCurrency } = body;
      let detailId = searchId || id || hid || hotelId;
      if (!detailId) return json({ success: false, error: "Missing search hotel id" }, 400);

      const lookupHotelId = String(hid || hotelId || id || searchId || "");
      const needsSearchResolution = !String(detailId).startsWith("hsid") && /^\d+$/.test(String(detailId));

      if (needsSearchResolution) {
        if (!checkIn || !checkOut) return json({ success: false, error: "Missing dates to resolve live room availability" }, 400);
        const normalizedRooms = Array.isArray(rooms) && rooms.length > 0
          ? rooms.map((room: any) => ({
              adults: Math.max(1, Number(room?.adults) || 1),
              ...(Number(room?.children) > 0 ? { children: Number(room.children) } : {}),
              ...(Array.isArray(room?.childAge) && room.childAge.length > 0 ? { childAge: room.childAge } : {}),
            }))
          : [{ adults: 2 }];
        const resolvedNat = await resolveTripjackNationality(nationality, tjConfig.proxySecret);
        const resolvedSearch = await searchBatchV2([String(detailId)], checkIn, checkOut, normalizedRooms, resolvedNat, "INR", tjConfig.proxySecret, 0);
        const liveHotel = (resolvedSearch.hotels || []).find((c: any) => String(c?.uid || "") === String(lookupHotelId || detailId));
        if (!liveHotel?.id) return json({ success: false, error: "Hotel/room no longer available. Please search again.", expired: true });
        detailId = liveHotel.id;
      }

      const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
      const [detailRes, apiMarkup, exchangeConfig, surgeConfig, agentMarkup] = await Promise.all([
        tjFetch("/hms/v1/hotelDetail-search", "POST", { id: detailId }, tjConfig.proxySecret),
        loadApiMarkup(sb),
        targetCurrency && targetCurrency !== "INR" ? loadExchangeConfig(sb) : Promise.resolve(null),
        checkIn ? loadSurgeConfig(sb, checkIn) : Promise.resolve({ isHighDemand: false, surgePercentage: 0 } as SurgeConfig),
        loadAgentMarkup(sb, authHeader),
      ]);

      if (!detailRes.ok) {
        const errText = await detailRes.text();
        let parsedError: any = null;
        try { parsedError = JSON.parse(errText); } catch { parsedError = null; }
        const upstreamError = parsedError?.upstreamBody || parsedError;
        const errCode = Number(upstreamError?.errors?.[0]?.errCode ?? upstreamError?.errors?.[0]?.code ?? upstreamError?.status?.httpStatus ?? detailRes.status);
        console.error("[tj-v2] detail error:", detailRes.status, errText.substring(0, 500));
        if (errCode === 6003 || errCode === 6001) {
          const fallback = await tryCachedDetailFallback(sb, lookupHotelId, checkIn, checkOut, rooms);
          if (fallback) return json({ success: true, hotel: fallback, displayCurrency: targetCurrency || "INR", cached: true });
          return json({ success: false, error: "Hotel/room no longer available. Please search again.", expired: true });
        }
        return json({ success: false, error: `Detail failed: ${detailRes.status}` }, 400);
      }

      const detailData = await detailRes.json();
      if (!detailData?.status?.success) {
        const errCode = Number(detailData?.errors?.[0]?.errCode ?? detailData?.errors?.[0]?.code ?? detailData?.status?.httpStatus);
        if (errCode === 6003 || errCode === 6001) {
          const fallback = await tryCachedDetailFallback(sb, lookupHotelId, checkIn, checkOut, rooms);
          if (fallback) return json({ success: true, hotel: fallback, displayCurrency: targetCurrency || "INR", cached: true });
          return json({ success: false, error: "Hotel/room no longer available. Please search again.", expired: true });
        }
        return json({ success: false, error: detailData?.errors?.[0]?.message || "Detail search failed" }, 400);
      }

      const hotel = detailData.hotel;
      if (!hotel) return json({ success: false, error: "No hotel data in response" }, 400);

      const transformPrice = (rawPrice: number): number => {
        // 1. Base API markup
        let price = Math.round(rawPrice * (1 + apiMarkup / 100));
        // 2. Surge + agent markups
        price = applyDynamicMarkups(price, surgeConfig, agentMarkup);
        // 3. Currency conversion
        if (targetCurrency && targetCurrency !== "INR" && exchangeConfig) {
          price = convertAmount(price, "INR", targetCurrency, (exchangeConfig as ExchangeConfig).rates, (exchangeConfig as ExchangeConfig).markup);
        }
        return price;
      };

      const options = (hotel.ops || []).map((opt: any) => {
        const mapped = mapV2Option(opt);
        return { ...mapped, price: transformPrice(opt.tp || 0), rooms: mapped.rooms.map((r: any) => ({ ...r, price: transformPrice(r.price) })) };
      });

      const uid = lookupHotelId;
      const { data: staticHotel } = await sb.from("tripjack_hotels").select("image_url, hero_image_url, images, facilities").eq("tj_hotel_id", Number(uid)).maybeSingle();
      const allStaticImages: any[] = staticHotel?.images || [];
      const staticImages: string[] = allStaticImages.map((i: any) => typeof i === "string" ? i : i?.url).filter(Boolean);

      // Build room-to-image map from static data rids
      const roomImageMap = new Map<string, string[]>();
      for (const img of allStaticImages) {
        const url = typeof img === "string" ? img : img?.url;
        const rids: string[] = img?.rids || [];
        if (url && rids.length > 0) {
          for (const rid of rids) {
            if (!roomImageMap.has(rid)) roomImageMap.set(rid, []);
            roomImageMap.get(rid)!.push(url);
          }
        }
      }

      // Inject room-specific images into options
      for (const opt of options) {
        for (const room of opt.rooms) {
          if ((!room.images || room.images.length === 0) && room.id) {
            // Try exact room ID match
            const matched = roomImageMap.get(room.id);
            if (matched && matched.length > 0) {
              room.images = matched.map((url: string) => ({ url, size: "" }));
            } else {
              // Try partial match: room ID prefix before ## or #
              const roomIdBase = room.id.split(/[#]/)[0];
              for (const [rid, urls] of roomImageMap) {
                if (rid.startsWith(roomIdBase) || roomIdBase.startsWith(rid)) {
                  room.images = urls.map((url: string) => ({ url, size: "" }));
                  break;
                }
              }
            }
          }
        }
      }

      // Write detail snapshots in background
      const detailOccKey = buildOccupancyKey(
        Array.isArray(rooms) ? rooms.reduce((s: number, r: any) => s + (r.adults || 1), 0) : 2,
        Array.isArray(rooms) ? rooms.reduce((s: number, r: any) => s + (r.children || 0), 0) : 0,
        Array.isArray(rooms) ? rooms.length : 1
      );
      writeDetailSnapshots(sb, uid, detailId, checkIn || '', checkOut || '', detailOccKey, options, { name: hotel.name, rt: hotel.rt, ad: hotel.ad, pt: hotel.pt }).catch(() => {});

      return json({
        success: true,
        hotel: {
          id: hotel.id, searchId: detailId, tjHotelId: uid, name: hotel.name || "",
          rating: hotel.rt || 0, address: hotel.ad || {}, propertyType: hotel.pt || "Hotel",
          instructions: hotel.inst || [], images: staticImages, options,
        },
        displayCurrency: targetCurrency || "INR",
      });
    }

    // ── Cancellation Policy ──
    if (action === "cancellation-policy") {
      const tjConfig = await getTjConfig();
      const { searchId, id, optionId } = body;
      const hotelSearchId = searchId || id;
      if (!hotelSearchId || !optionId) return json({ success: false, error: "Missing searchId or optionId" }, 400);
      const res = await tjFetch("/hms/v1/hotel-cancellation-policy", "POST", { id: hotelSearchId, optionId }, tjConfig.proxySecret);
      if (!res.ok) return json({ success: false, error: `Cancellation policy failed: ${res.status}` }, 400);
      const data = await res.json();
      if (!data?.status?.success) return json({ success: false, error: data?.errors?.[0]?.message || "Cancellation policy failed" });
      return json({ success: true, searchId: data.id, cancellationPolicy: data.cancellationPolicy });
    }

    // ── Revalidate (live price check before booking) ──
    if (action === "revalidate") {
      const tjConfig = await getTjConfig();
      if (!tjConfig.isActive) return json({ success: false, error: "Tripjack Hotel API is not active" });
      const { hotelUid, searchId, optionId, checkIn, checkOut, rooms: revalRooms, nationality: revalNat, targetCurrency: revalCurrency } = body;
      if (!optionId) return json({ success: false, error: "Missing optionId" }, 400);
      if (!hotelUid && !searchId) return json({ success: false, error: "Missing hotelUid or searchId" }, 400);

      // Look up cached option price
      let cachedPrice = 0;
      try {
        const { data: cached } = await sb.from('hotel_option_snapshot').select('total_price')
          .eq('option_id', optionId).eq('hotel_uid', hotelUid || '').limit(1).maybeSingle();
        cachedPrice = cached?.total_price || 0;
      } catch {}

      // Get fresh detail
      let detailId = searchId;
      if (!detailId || !/^hsid/.test(detailId)) {
        const resolvedNat = await resolveTripjackNationality(revalNat, tjConfig.proxySecret);
        const normalizedRooms = Array.isArray(revalRooms) && revalRooms.length > 0
          ? revalRooms.map((r: any) => ({ numberOfAdults: Math.max(1, Number(r?.adults) || 1), numberOfChild: Number(r?.children) || 0 }))
          : [{ numberOfAdults: 2, numberOfChild: 0 }];
        const searchResult = await searchBatchV2([String(hotelUid)], checkIn || '', checkOut || '', normalizedRooms, resolvedNat, 'INR', tjConfig.proxySecret, 'reval');
        const liveHotel = (searchResult.hotels || [])[0];
        if (!liveHotel?.id) return json({ success: false, error: 'Hotel no longer available', expired: true });
        detailId = liveHotel.id;
      }

      const revalAuthHeader = req.headers.get("authorization") || req.headers.get("Authorization");
      const [detailRes, revalApiMarkup, revalExchangeConfig, revalSurgeConfig, revalAgentMarkup] = await Promise.all([
        tjFetch('/hms/v1/hotelDetail-search', 'POST', { id: detailId }, tjConfig.proxySecret),
        loadApiMarkup(sb),
        revalCurrency && revalCurrency !== "INR" ? loadExchangeConfig(sb) : Promise.resolve(null),
        checkIn ? loadSurgeConfig(sb, checkIn) : Promise.resolve({ isHighDemand: false, surgePercentage: 0 } as SurgeConfig),
        loadAgentMarkup(sb, revalAuthHeader),
      ]);
      if (!detailRes.ok) return json({ success: false, error: 'Revalidation failed' });
      const detailData = await detailRes.json();
      if (!detailData?.status?.success) return json({ success: false, error: 'Hotel unavailable', expired: true });

      const hotel = detailData.hotel;
      const matchedOpt = (hotel?.ops || []).find((o: any) => o.id === optionId);
      if (!matchedOpt) {
        // Option sold out — suggest alternatives with markups applied
        const alternatives = (hotel?.ops || []).slice(0, 3).map((o: any) => {
          let altPrice = Math.round((o.tp || 0) * (1 + revalApiMarkup / 100));
          altPrice = applyDynamicMarkups(altPrice, revalSurgeConfig, revalAgentMarkup);
          if (revalCurrency && revalCurrency !== "INR" && revalExchangeConfig) {
            altPrice = convertAmount(altPrice, "INR", revalCurrency, (revalExchangeConfig as ExchangeConfig).rates, (revalExchangeConfig as ExchangeConfig).markup);
          }
          return {
            optionId: o.id, price: altPrice,
            mealBasis: o.ris?.[0]?.mb || 'Room Only',
            isRefundable: o.cnp?.ifra || false,
            roomName: o.ris?.[0]?.srn || o.ris?.[0]?.rt || 'Room',
          };
        });
        return json({ success: false, soldOut: true, error: 'Selected room sold out', alternatives });
      }

      let newPrice = Math.round((matchedOpt.tp || 0) * (1 + revalApiMarkup / 100));
      newPrice = applyDynamicMarkups(newPrice, revalSurgeConfig, revalAgentMarkup);
      if (revalCurrency && revalCurrency !== "INR" && revalExchangeConfig) {
        newPrice = convertAmount(newPrice, "INR", revalCurrency, (revalExchangeConfig as ExchangeConfig).rates, (revalExchangeConfig as ExchangeConfig).markup);
      }
      const priceChanged = cachedPrice > 0 && Math.abs(newPrice - cachedPrice) > 1;

      // Write price change if detected
      if (priceChanged) {
        writePriceChange(sb, hotelUid || '', optionId, cachedPrice, newPrice, checkIn || '', checkOut || '', 'revalidation').catch(() => {});
      }

      // Update option snapshot
      const occKey = buildOccupancyKey(
        Array.isArray(revalRooms) ? revalRooms.reduce((s: number, r: any) => s + (r.adults || 1), 0) : 2,
        Array.isArray(revalRooms) ? revalRooms.reduce((s: number, r: any) => s + (r.children || 0), 0) : 0,
        Array.isArray(revalRooms) ? revalRooms.length : 1
      );
      const canc = normalizeCancellation(matchedOpt);
      sb.from('hotel_option_snapshot').upsert({
        option_id: optionId, hotel_uid: hotelUid || '',
        checkin: checkIn, checkout: checkOut, occupancy_key: occKey,
        total_price: newPrice, currency: 'INR',
        cancellation_type: canc.type, cancellation_deadline_at: canc.deadline,
        cancellation_is_free: canc.isFree, cancellation_text: canc.text,
        cancellation_policy_raw_json: matchedOpt.cnp || {},
        pan_required: matchedOpt.ipr || false, passport_required: matchedOpt.ipm || false,
        is_package_rate: matchedOpt.ispr || false, availability_status: 'available',
        meal_basis: matchedOpt.ris?.[0]?.mb || '',
        last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'option_id,hotel_uid,checkin,checkout,occupancy_key' }).then(() => {}).catch(() => {});

      return json({
        success: true, validated: true, optionId,
        price: newPrice, previousPrice: cachedPrice || null,
        priceChanged, priceDelta: priceChanged ? newPrice - cachedPrice : 0,
        cancellation: canc,
        searchId: detailId,
      });
    }

    // ── Review ──
    if (action === "review") {
      const tjConfig = await getTjConfig();
      if (!tjConfig.isActive) return json({ success: false, error: "Tripjack Hotel API is not active" });
      const { searchId, id, hotelId, optionId } = body;
      const hotelSearchId = searchId || id || hotelId;
      if (!hotelSearchId) return json({ success: false, error: "Missing hotel search id (searchId)" }, 400);
      if (!optionId) return json({ success: false, error: "Missing optionId" }, 400);

      console.log(`[tj-v2] review: hotelId=${hotelSearchId}, optionId=${optionId}`);
      const res = await tjFetch("/hms/v1/hotel-review", "POST", { hotelId: hotelSearchId, optionId }, tjConfig.proxySecret);
      if (!res.ok) {
        const errText = await res.text();
        console.error("[tj-v2] review error:", res.status, errText.substring(0, 300));
        return json({ success: false, error: `Review failed: ${res.status}` }, 400);
      }
      const reviewData = await res.json();
      if (!reviewData?.status?.success) {
        const errCode = reviewData?.errors?.[0]?.code || reviewData?.status?.httpStatus;
        if (errCode === 6001 || errCode === 6022) return json({ success: false, error: "Room option no longer available", soldOut: true });
        if (errCode === 6003) return json({ success: false, error: "Hotel no longer available. Please search again.", expired: true });
        return json({ success: false, error: reviewData?.errors?.[0]?.message || "Review failed" });
      }
      const hInfo = reviewData.hInfo;
      const options = (hInfo?.ops || []).map(mapV2Option);
      return json({
        success: true, bookingId: reviewData.bookingId, conditions: reviewData.conditions || {},
        hotel: { id: hInfo?.id || hotelSearchId, tjHotelId: hInfo?.uid || "", name: hInfo?.name || "", rating: hInfo?.rt || 0, address: hInfo?.ad || {}, propertyType: hInfo?.pt || "Hotel", instructions: hInfo?.inst || [], options },
      });
    }

    // ── Book ──
    if (action === "book") {
      const tjConfig = await getTjConfig();
      if (!tjConfig.isActive) return json({ success: false, error: "Tripjack Hotel API is not active" });
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ success: false, error: "Authentication required" }, 401);
      const { bookingId, roomTravellerInfo, deliveryInfo, paymentInfos, paymentAmount } = body;
      if (!bookingId || !roomTravellerInfo) return json({ success: false, error: "Missing bookingId or roomTravellerInfo" }, 400);

      const bookPayload: any = {
        bookingId, type: "HOTEL",
        roomTravellerInfo: roomTravellerInfo.map((room: any) => ({
          travellerInfo: (room.travellerInfo || []).map((t: any) => ({
            ti: t.ti || "Mr", fN: t.fN || t.firstName || "", lN: t.lN || t.lastName || "", pt: t.pt || "ADULT",
            ...(t.pan ? { pan: t.pan } : {}), ...(t.pNum ? { pNum: t.pNum } : {}),
          })),
        })),
        deliveryInfo: deliveryInfo || { emails: [], contacts: [], code: [] },
      };
      if (paymentInfos) bookPayload.paymentInfos = paymentInfos;
      else if (paymentAmount) bookPayload.paymentInfos = [{ amount: paymentAmount }];

      console.log("[tj-v2] Book payload:", JSON.stringify(bookPayload).substring(0, 800));
      const bookRes = await tjFetch("/oms/v1/hotel/book", "POST", bookPayload, tjConfig.proxySecret);
      const bookText = await bookRes.text();
      console.log(`[tj-v2] Book response (${bookRes.status}): ${bookText.substring(0, 1000)}`);

      let bookData: any;
      try { bookData = JSON.parse(bookText); } catch { return json({ success: false, error: "Invalid booking response" }, 500); }
      if (!bookData?.status?.success) return json({ success: false, error: bookData?.errors?.[0]?.message || bookData?.error?.message || "Booking failed" });
      return json({ success: true, bookingId: bookData.bookingId || bookingId, note: "Booking initiated. Poll booking-status every 5s for up to 180s for confirmation." });
    }

    // ── Confirm Book ──
    if (action === "confirm-book") {
      const tjConfig = await getTjConfig();
      const { bookingId, paymentInfos, paymentAmount } = body;
      if (!bookingId) return json({ success: false, error: "Missing bookingId" }, 400);
      const confirmPayload: any = { bookingId };
      if (paymentInfos) confirmPayload.paymentInfos = paymentInfos;
      else if (paymentAmount) confirmPayload.paymentInfos = [{ amount: paymentAmount }];
      const res = await tjFetch("/oms/v1/hotel/confirm-book", "POST", confirmPayload, tjConfig.proxySecret);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { return json({ success: false, error: "Invalid response" }, 500); }
      if (!data?.status?.success) return json({ success: false, error: data?.errors?.[0]?.message || "Confirm booking failed" });
      return json({ success: true, bookingId: data.bookingId || bookingId });
    }

    // ── Booking Status ──
    if (action === "booking-status") {
      const tjConfig = await getTjConfig();
      const { bookingId } = body;
      if (!bookingId) return json({ success: false, error: "Missing bookingId" }, 400);
      const res = await tjFetch("/oms/v1/hotel/booking-details", "POST", { bookingId }, tjConfig.proxySecret);
      if (!res.ok) return json({ success: false, error: `Status check failed: ${res.status}` }, 400);
      const data = await res.json();
      if (!data?.status?.success) return json({ success: false, error: data?.errors?.[0]?.message || "Status check failed" });
      const order = data.order;
      const hotelInfo = data.itemInfos?.HOTEL?.hInfo;
      return json({
        success: true,
        order: {
          bookingId: order?.bookingId || bookingId, status: mapTripjackBookingStatus(order?.status || "PENDING"),
          rawStatus: order?.status || "PENDING", amount: order?.amount || 0, createdAt: order?.createdOn || new Date().toISOString(),
          hotel: hotelInfo ? { name: hotelInfo.name, rating: hotelInfo.rt, address: hotelInfo.ad, uid: hotelInfo.uid, options: (hotelInfo.ops || []).map(mapV2Option) } : {},
        },
        gstInfo: data.gstInfo || {},
      });
    }

    // ── Cancel ──
    if (action === "cancel") {
      const tjConfig = await getTjConfig();
      const { bookingId } = body;
      if (!bookingId) return json({ success: false, error: "Missing bookingId" }, 400);
      console.log(`[tj-v2] cancel: bookingId=${bookingId}`);
      const cancelRes = await tjFetch(`/oms/v1/hotel/cancel-booking/${bookingId}`, "POST", undefined, tjConfig.proxySecret);
      const cancelText = await cancelRes.text();
      let cancelData: any;
      try { cancelData = JSON.parse(cancelText); } catch { return json({ success: false, error: "Invalid cancellation response" }, 500); }
      if (!cancelData?.status?.success) return json({ success: false, error: cancelData?.errors?.[0]?.message || "Cancellation failed" });

      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const statusRes = await tjFetch("/oms/v1/hotel/booking-details", "POST", { bookingId }, tjConfig.proxySecret);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData?.status?.success) {
            const updatedStatus = statusData?.order?.status;
            return json({
              success: true, status: mapTripjackBookingStatus(updatedStatus || "CANCELLATION_PENDING"),
              rawStatus: updatedStatus,
              message: updatedStatus === "CANCELLED" ? "Booking cancelled successfully" : "Cancellation is being processed.",
            });
          }
        }
      } catch {}
      return json({ success: true, status: "cancellation_pending", rawStatus: "CANCELLATION_PENDING", message: "Cancellation is being processed." });
    }

    // ── Static Detail ──
    if (action === "static-detail") {
      const { hid } = body;
      if (!hid) return json({ success: false, error: "Missing hid" }, 400);
      const { data: hotel } = await sb.from("tripjack_hotels").select("*").eq("tj_hotel_id", Number(hid)).maybeSingle();
      if (!hotel) return json({ success: false, error: "Hotel not found in static data" }, 404);
      const images = (hotel.images || []).map((i: any) => ({
        url: typeof i === "string" ? i : i?.url || "", caption: typeof i === "string" ? "" : i?.caption || "",
        isHero: typeof i === "string" ? false : i?.is_hero_image || false,
      })).filter((i: any) => i.url);
      return json({
        success: true, tjHotelId: hotel.tj_hotel_id, unicaId: hotel.unica_id, name: hotel.name,
        heroImage: hotel.hero_image_url || images[0]?.url || null, images, rating: hotel.rating,
        propertyType: hotel.property_type, city: hotel.city_name, country: hotel.country_name,
        address: hotel.address, latitude: hotel.latitude, longitude: hotel.longitude,
        facilities: hotel.facilities || [], description: hotel.description || {}, contact: hotel.contact || {},
      });
    }

    // ── Sync Hotels ──
    if (action === "sync-hotels") {
      const tjConfig = await getTjConfig();
      const { maxPages = 10, freshStart = false, lastUpdateTime } = body;

      const { data: syncState } = await sb.from("tripjack_sync_state").select("*").eq("sync_type", "hotels").maybeSingle();
      let cursor: string | null = null;
      let totalHotelsProcessed = syncState?.total_hotels_synced || 0;
      let totalPagesProcessed = syncState?.pages_processed || 0;
      let totalCitiesSynced = syncState?.total_cities_synced || 0;

      if (freshStart) {
        cursor = null; totalHotelsProcessed = 0; totalPagesProcessed = 0; totalCitiesSynced = 0;
        console.log("[sync] Fresh start: clearing old hotel data...");
        await sb.from("tripjack_hotels").delete().neq("tj_hotel_id", 0);
        await sb.from("tripjack_city_hotel_map").delete().neq("hotel_count", -1);
        await sb.from("tripjack_sync_state").upsert({
          sync_type: "hotels", status: "syncing", next_cursor: null,
          total_hotels_synced: 0, total_cities_synced: 0, pages_processed: 0,
          started_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null,
        }, { onConflict: "sync_type" });
      } else if (syncState?.next_cursor && (syncState.status === "paused" || syncState.status === "syncing")) {
        cursor = syncState.next_cursor;
        console.log(`[sync] Resuming from cursor: ${cursor?.substring(0, 20)}...`);
        await sb.from("tripjack_sync_state").upsert({ sync_type: "hotels", status: "syncing", updated_at: new Date().toISOString() }, { onConflict: "sync_type" });
      } else if (syncState?.status === "completed") {
        return json({ success: true, totalHotelsProcessed: syncState.total_hotels_synced, pages: syncState.pages_processed, citiesSynced: syncState.total_cities_synced, complete: true, nextCursor: null, alreadyComplete: true, message: "Sync already completed. Use freshStart: true to re-sync." });
      } else {
        await sb.from("tripjack_sync_state").upsert({
          sync_type: "hotels", status: "syncing", next_cursor: null,
          total_hotels_synced: 0, total_cities_synced: 0, pages_processed: 0,
          started_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null,
        }, { onConflict: "sync_type" });
      }

      let batchHotels = 0, batchPages = 0;
      const citySets = new Map<string, { city: string; country: string; ids: Set<string> }>();
      const effectiveMaxPages = Math.min(maxPages, 10);

      for (let page = 0; page < effectiveMaxPages; page++) {
        const payload: any = {};
        if (cursor) payload.next = cursor;
        if (lastUpdateTime) payload.lastUpdateTime = lastUpdateTime;

        let res: Response;
        try { res = await tjFetch("/hms/v1/fetch-static-hotels", "POST", payload, tjConfig.proxySecret); }
        catch (err) { console.error(`Sync page ${page + 1} fetch error:`, err); break; }
        if (!res.ok) { console.error(`Sync page ${page + 1}: HTTP ${res.status}`); break; }

        let pageData: any;
        try { pageData = await res.json(); } catch { console.error(`Sync page ${page + 1}: Invalid JSON`); break; }
        if (!pageData?.status?.success) { cursor = null; break; }

        const hotels = pageData?.hotelOpInfos || [];
        if (hotels.length === 0) { cursor = null; break; }

        const upsertData = hotels.filter((h: any) => !h.isDeleted).map((h: any) => {
          const rawImages = h.images || [];
          const images = rawImages.map((img: any) => ({ url: img.url || "", caption: img.alt || "", is_hero_image: false, size: img.sz || "", rids: img.rids || [] })).filter((i: any) => i.url);
          // v2 API: hotelId is the ONLY ID in static data and is what goes into search hids
          return {
            tj_hotel_id: Number(h.hotelId) || 0, unica_id: null, name: h.name || "", rating: h.rating || 0,
            property_type: h.propertyType || "Hotel", city_name: h.cityName || h.address?.city?.name || "",
            city_code: h.address?.city?.code || "", state_name: h.address?.state?.name || "",
            country_name: h.countryName || h.address?.country?.name || "", country_code: h.address?.country?.code || "",
            latitude: h.geolocation?.lt ? parseFloat(h.geolocation.lt) : null,
            longitude: h.geolocation?.ln ? parseFloat(h.geolocation.ln) : null,
            address: h.address?.adr || "", postal_code: h.address?.postalCode || "",
            image_url: images[0]?.url || null, hero_image_url: images[0]?.url || null,
            images, facilities: h.facilities || [],
            description: typeof h.description === "string" ? { raw: h.description } : (h.description || {}),
            contact: h.contact || {}, is_deleted: false,
            synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          };
        }).filter((h: any) => h.tj_hotel_id > 0);

        if (upsertData.length > 0) {
          for (let ci = 0; ci < upsertData.length; ci += 20) {
            const chunk = upsertData.slice(ci, ci + 20);
            const { error: upsertError } = await sb.from("tripjack_hotels").upsert(chunk, { onConflict: "tj_hotel_id", ignoreDuplicates: false });
            if (upsertError) console.error(`Sync page ${page + 1} chunk error:`, upsertError.message);
          }
        }

        // hotelId is the correct ID for both search and deletion
        const deletedIds = hotels.filter((h: any) => h.isDeleted).map((h: any) => Number(h.hotelId)).filter(Boolean);
        if (deletedIds.length > 0) await sb.from("tripjack_hotels").update({ is_deleted: true, updated_at: new Date().toISOString() }).in("tj_hotel_id", deletedIds);

        // City map uses hotelId (the ID the search API accepts as hids)
        for (const h of hotels) {
          if (h.isDeleted) continue;
          const city = (h.cityName || h.address?.city?.name || "").trim();
          if (!city) continue;
          const country = h.countryName || h.address?.country?.name || "";
          const hotelId = String(h.hotelId || "");
          if (!hotelId || hotelId === "0") continue;
          const key = `${city}|${country}`;
          if (!citySets.has(key)) citySets.set(key, { city, country, ids: new Set() });
          citySets.get(key)!.ids.add(hotelId);
        }

        batchHotels += hotels.length; batchPages++;
        totalHotelsProcessed += hotels.length; totalPagesProcessed++;
        cursor = pageData.next || null;

        await sb.from("tripjack_sync_state").upsert({
          sync_type: "hotels", status: cursor ? "syncing" : "completed", next_cursor: cursor,
          total_hotels_synced: totalHotelsProcessed, total_cities_synced: totalCitiesSynced,
          pages_processed: totalPagesProcessed, updated_at: new Date().toISOString(),
          ...(!cursor ? { completed_at: new Date().toISOString() } : {}),
        }, { onConflict: "sync_type" });

        if (!cursor) break;
      }

      let batchCities = 0;
      for (const [, { city, country, ids: idSet }] of citySets) {
        const newIds = Array.from(idSet);
        const { data: existing } = await sb.from("tripjack_city_hotel_map").select("hotel_ids").eq("city_name", city).eq("country_name", country).maybeSingle();
        const mergedIds = [...new Set([...(existing?.hotel_ids || []), ...newIds])];
        await sb.from("tripjack_city_hotel_map").upsert(
          { city_name: city, country_name: country, hotel_ids: mergedIds, hotel_count: mergedIds.length, updated_at: new Date().toISOString() },
          { onConflict: "city_name,country_name" }
        );
        batchCities++;
      }

      totalCitiesSynced += batchCities;
      const isComplete = !cursor;

      // When sync completes, rebuild the entire city map from tripjack_hotels to eliminate stale IDs
      if (isComplete) {
        console.log("[sync] Sync complete — rebuilding full city map via backfill_tripjack_city_map()...");
        try {
          const { data: backfillResult, error: backfillErr } = await sb.rpc("backfill_tripjack_city_map");
          if (backfillErr) console.error("[sync] Backfill error:", backfillErr.message);
          else {
            console.log("[sync] City map rebuilt:", JSON.stringify(backfillResult));
            totalCitiesSynced = backfillResult?.cities || totalCitiesSynced;
          }
        } catch (e) { console.warn("[sync] Backfill failed:", e); }
        // Also clear stale search cache
        await sb.from("hotel_search_cache").delete().lt("expires_at", new Date(Date.now() + 86400000).toISOString());
        console.log("[sync] Cleared hotel search cache after full sync");
      }

      await sb.from("tripjack_sync_state").upsert({
        sync_type: "hotels", status: isComplete ? "completed" : "paused", next_cursor: cursor,
        total_hotels_synced: totalHotelsProcessed, total_cities_synced: totalCitiesSynced,
        pages_processed: totalPagesProcessed, updated_at: new Date().toISOString(),
        ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
      }, { onConflict: "sync_type" });

      return json({ success: true, totalHotelsProcessed, batchHotels, pages: totalPagesProcessed, batchPages, citiesSynced: totalCitiesSynced, complete: isComplete, nextCursor: cursor || null, status: isComplete ? "completed" : "paused" });
    }

    // ── Sync Deleted Hotels — POST /hms/v1/fetch-static-hotels/deleted ──
    if (action === "sync-deleted") {
      const tjConfig = await getTjConfig();
      const { lastUpdateTime, maxPages = 20 } = body;

      if (!lastUpdateTime) {
        return json({ success: false, error: "lastUpdateTime is required for sync-deleted" }, 400);
      }

      let cursor: string | null = null;
      let totalDeleted = 0;
      let pages = 0;

      for (let page = 0; page < maxPages; page++) {
        const payload: any = { lastUpdateTime };
        if (cursor) payload.next = cursor;

        let res: Response;
        try {
          res = await tjFetch("/hms/v1/fetch-static-hotels/deleted", "POST", payload, tjConfig.proxySecret);
        } catch (err) {
          console.error(`[sync-deleted] Page ${page + 1} fetch error:`, err);
          break;
        }
        if (!res.ok) { console.error(`[sync-deleted] Page ${page + 1}: HTTP ${res.status}`); break; }

        let pageData: any;
        try { pageData = await res.json(); } catch { break; }
        if (!pageData?.status?.success) break;

        const deletedHotels = pageData?.hotelOpInfos || [];
        if (deletedHotels.length === 0) { cursor = null; break; }

        const deletedIds = deletedHotels.map((h: any) => Number(h.hotelId)).filter(Boolean);
        if (deletedIds.length > 0) {
          // Mark as deleted in tripjack_hotels
          for (let i = 0; i < deletedIds.length; i += 50) {
            const chunk = deletedIds.slice(i, i + 50);
            await sb.from("tripjack_hotels").update({ is_deleted: true, updated_at: new Date().toISOString() }).in("tj_hotel_id", chunk);
          }
          // Remove from city map
          console.log(`[sync-deleted] Marked ${deletedIds.length} hotels as deleted`);
        }

        totalDeleted += deletedIds.length;
        pages++;
        cursor = pageData.next || null;
        if (!cursor) break;
      }

      // If any deletions, rebuild city map to remove stale IDs
      if (totalDeleted > 0) {
        console.log(`[sync-deleted] Rebuilding city map after ${totalDeleted} deletions...`);
        try {
          const { data: backfillResult, error: backfillErr } = await sb.rpc("backfill_tripjack_city_map");
          if (backfillErr) console.error("[sync-deleted] Backfill error:", backfillErr.message);
          else console.log("[sync-deleted] City map rebuilt:", JSON.stringify(backfillResult));
        } catch (e) { console.warn("[sync-deleted] Backfill failed:", e); }
      }

      return json({ success: true, totalDeleted, pages, complete: !cursor, nextCursor: cursor });
    }

    // ── Sync Status ──
    if (action === "sync-status") {
      const { data } = await sb.from("tripjack_sync_state").select("*").eq("sync_type", "hotels").maybeSingle();
      return json({ success: true, ...(data || { status: "idle", total_hotels_synced: 0, pages_processed: 0, total_cities_synced: 0 }) });
    }

    // ── Backfill City Map ──
    if (action === "backfill-city-map") {
      const cityData = new Map<string, { city: string; country: string; ids: Set<string> }>();
      let totalProcessed = 0, offset = 0;
      while (true) {
        const { data: hotelRows } = await sb.from("tripjack_hotels").select("tj_hotel_id, city_name, country_name")
          .eq("is_deleted", false).neq("city_name", "").range(offset, offset + 999);
        if (!hotelRows || hotelRows.length === 0) break;
        for (const h of hotelRows) {
          const city = (h.city_name || "").trim();
          if (!city) continue;
          const key = `${city}|${h.country_name || ""}`;
          if (!cityData.has(key)) cityData.set(key, { city, country: h.country_name || "", ids: new Set() });
          cityData.get(key)!.ids.add(String(h.tj_hotel_id));
        }
        totalProcessed += hotelRows.length; offset += hotelRows.length;
        if (hotelRows.length < 1000) break;
      }
      const allRows = Array.from(cityData.values()).map(({ city, country, ids }) => ({
        city_name: city, country_name: country, hotel_ids: Array.from(ids), hotel_count: ids.size, updated_at: new Date().toISOString(),
      }));
      let citiesUpserted = 0;
      for (let i = 0; i < allRows.length; i += 100) {
        const chunk = allRows.slice(i, i + 100);
        const { error: chunkErr } = await sb.from("tripjack_city_hotel_map").upsert(chunk, { onConflict: "city_name,country_name" });
        if (chunkErr) console.error("[backfill] chunk error:", chunkErr.message);
        else citiesUpserted += chunk.length;
      }
      await sb.from("tripjack_sync_state").upsert({
        sync_type: "hotels", status: "paused", total_hotels_synced: totalProcessed,
        total_cities_synced: citiesUpserted, pages_processed: Math.ceil(totalProcessed / 100), updated_at: new Date().toISOString(),
      }, { onConflict: "sync_type" });
      return json({ success: true, hotelsProcessed: totalProcessed, citiesUpserted, uniqueCities: cityData.size, complete: true });
    }

    // ══════════════════════════════════════════════════
    // SEARCH ACTIONS (original unified-hotel-search)
    // ══════════════════════════════════════════════════

    // ── Session Results ──
    if (action === "session-results") {
      const { sessionId, page = 1, pageSize = 15, filters = {} } = body;
      if (!sessionId) return json({ success: false, error: "sessionId required" }, 400);
      const session = await getSession(sb, sessionId);
      if (!session) return json({ success: false, error: "Session expired or not found" }, 404);
      const allHotels = session.hotels as NormalizedHotel[];
      const filtered = applySessionFilters(allHotels, filters);
      const paginated = paginateResults(filtered, page, pageSize);
      return json({ success: true, sessionId, hotels: paginated.hotels, totalResults: paginated.totalResults, totalPages: paginated.totalPages, page, pageSize, displayCurrency: session.display_currency, providerStats: session.provider_stats });
    }

    // ── Cache-First Search (returns cached pricing from snapshots) ──
    // Freshness-aware: uses tiered TTLs based on check-in proximity
    if (action === "cache-first-search") {
      const t0 = Date.now();
      let { cityName, checkinDate, checkoutDate, adults, children: childrenCount, rooms: roomCount, hotelIds, searchType, limit = 200, offset = 0, clientNationality, hotelName, targetCurrency: reqTargetCurrency } = body;
      if (!cityName && !hotelIds?.length) return json({ success: true, hotels: [], count: 0, totalInDatabase: 0, cached: true });

      // ── Resolve hotel-name fallback ──
      // Some entry points (legacy URLs, external links) pass a hotel name as
      // `cityName` without `hotelIds`. If the cityName doesn't match any real
      // city in the catalogue, look it up via the supplier-agnostic resolver
      // (`resolve_hotel_by_name` RPC, which UNIONs every supplier catalogue)
      // and pivot the request into a hotel-specific search (single hotel,
      // real city name). Works for Tripjack today and any future supplier
      // that registers in `hotel_supplier_mappings` automatically.
      if (cityName && !hotelIds?.length) {
        try {
          const trimmed = cityName.trim();
          const { data: cityRows } = await sb.from('tripjack_city_hotel_map')
            .select('city_name')
            .ilike('city_name', trimmed)
            .limit(1);
          if (!cityRows || cityRows.length === 0) {
            // No city match — try as a hotel name across ALL supplier catalogues.
            const { data: matches, error: rpcErr } = await sb
              .rpc('resolve_hotel_by_name', { p_query: trimmed, p_limit: 1 });
            if (rpcErr) {
              console.warn('[unified-hotel] resolve_hotel_by_name rpc error:', rpcErr.message);
            }
            const resolved = (matches as any[] | null)?.[0];
            if (resolved) {
              hotelIds = [String(resolved.canonical_id || resolved.supplier_hotel_id)];
              searchType = 'hotel';
              hotelName = resolved.name;
              cityName = resolved.city_name || cityName;
              console.log(
                `[unified-hotel] Resolved hotel-name "${trimmed}" → supplier=${resolved.supplier} ` +
                `id=${resolved.supplier_hotel_id} city=${cityName}`
              );
            }
          }
        } catch (e) {
          console.warn('[unified-hotel] hotel-name resolution failed:', (e as any)?.message);
        }
      }

      // Get total hotel count for this city from the city map
      let totalInDatabase = 0;
      if (cityName && !hotelIds?.length) {
        try {
          // Sum all matching city name variants (e.g. "Singapore", "SINGAPORE", etc.)
          const { data: cityRows } = await sb.from('tripjack_city_hotel_map')
            .select('hotel_count')
            .ilike('city_name', cityName.trim());
          if (cityRows?.length) {
            totalInDatabase = cityRows.reduce((sum: number, r: any) => sum + (r.hotel_count || 0), 0);
          }
        } catch {}
        // Fallback: count from tripjack_hotels if city map doesn't have it
        if (totalInDatabase === 0) {
          try {
            const { count } = await sb.from('tripjack_hotels')
              .select('tj_hotel_id', { count: 'exact', head: true })
              .eq('is_deleted', false)
              .ilike('city_name', cityName.trim());
            if (count) totalInDatabase = count;
          } catch {}
        }
      }

      // Holidays are pre-cached by sync-holidays cron — no per-request API calls needed

      const occKey = buildOccupancyKey(adults || 2, childrenCount || 0, roomCount || 1);

      // ── Freshness TTL based on check-in proximity + high-demand dates ──
      let freshTtlMinutes = 2880; // 48h default
      let isHighDemand = false;
      if (checkinDate) {
        try {
          const { data: hdRow } = await sb.from('high_demand_dates').select('id').eq('date', checkinDate).limit(1);
          isHighDemand = !!(hdRow && hdRow.length > 0);
        } catch {}
        const daysOut = Math.max(0, Math.floor((new Date(checkinDate).getTime() - Date.now()) / 86_400_000));
        if (isHighDemand) {
          freshTtlMinutes = daysOut <= 7 ? 60 : 720; // 60min or 12hr
        } else if (daysOut < 3) freshTtlMinutes = 60;          // <3d: 60 min
        else if (daysOut < 7) freshTtlMinutes = 720;            // <7d: 12 hr
        else if (daysOut < 30) freshTtlMinutes = 2880;          // <30d: 48 hr
        else freshTtlMinutes = 14400;                           // 30+: 240 hr (10d)
      }
      const freshCutoff = new Date(Date.now() - freshTtlMinutes * 60_000).toISOString();

      let cachedHotels: any[] = [];
      let cacheFreshness: 'fresh' | 'soft_stale' | 'hard_stale' = 'hard_stale';

      try {
        // Step 1: Check hotel_search_snapshot for cached pricing
        let snapQuery = sb.from('hotel_search_snapshot')
          .select('hotel_uid, search_hotel_id, min_price, currency, free_cancellation, property_type, meal_basis, stale_status, last_checked_at')
          .eq('checkin', checkinDate || '')
          .eq('checkout', checkoutDate || '')
          .eq('occupancy_key', occKey)
          .gt('min_price', 0)
          .order('min_price', { ascending: true })
          .range(offset, offset + limit - 1);

        if (hotelIds?.length) {
          snapQuery = snapQuery.in('hotel_uid', hotelIds.map(String));
        }

        const { data: snapshots } = await snapQuery;

        if (snapshots && snapshots.length > 0) {
          // Determine freshness: how many snapshots are within TTL?
          const freshCount = snapshots.filter((s: any) => s.last_checked_at && s.last_checked_at > freshCutoff).length;
          const freshRatio = freshCount / snapshots.length;
          if (freshRatio >= 0.7) cacheFreshness = 'fresh';
          else if (freshRatio >= 0.3) cacheFreshness = 'soft_stale';
          else cacheFreshness = 'hard_stale';

          // Step 2: Enrich with static data
          const hotelUids = snapshots.map((s: any) => s.hotel_uid);
          const { data: statics } = await sb.from('hotel_static_cache')
            .select('hotel_uid, name, rating, stars, city, country, property_type, hero_image_url, images_json, facilities_json, description, latitude, longitude')
            .in('hotel_uid', hotelUids);

          const staticMap = new Map<string, any>();
          for (const s of (statics || [])) staticMap.set(s.hotel_uid, s);

          cachedHotels = snapshots.map((snap: any) => {
            const st = staticMap.get(snap.hotel_uid) || {};
            const isFresh = snap.last_checked_at && snap.last_checked_at > freshCutoff;
            return {
              id: snap.hotel_uid, name: st.name || 'Hotel', city: st.city || cityName || '',
              country: st.country || '', rating: st.rating || 0, reviews: 0, stars: st.stars || 0,
              price: snap.min_price || 0, originalPrice: snap.min_price || 0, originalCurrency: snap.currency || 'INR',
              crossedOutRate: 0, discountPercentage: 0,
              image: st.hero_image_url || null,
              images: Array.isArray(st.images_json) ? st.images_json : [],
              amenities: Array.isArray(st.facilities_json) ? st.facilities_json.slice(0, 8) : [],
              propertyType: snap.property_type || st.property_type || 'Hotel',
              landingUrl: '', roomTypeName: '', currency: snap.currency || 'INR',
              availableRooms: [], source: 'tripjack', searchId: snap.search_hotel_id || '',
              description: st.description || '', mealBasis: snap.meal_basis || '',
              latitude: st.latitude || null, longitude: st.longitude || null,
              isPreview: false, hasFreeCancellation: snap.free_cancellation || false,
              staleStatus: isFresh ? 'fresh' : 'soft_stale',
              priceFresh: isFresh,
            };
          });
        }

        // Step 3: If no snapshot results, fall back to static cache
        // For hotel-specific searches, query by hotel_uid; for city searches, by city name
        if (cachedHotels.length === 0 && (cityName || hotelIds?.length)) {
          let cityStatics: any[] | null = null;
          if (hotelIds?.length) {
            const { data } = await sb.from('hotel_static_cache')
              .select('hotel_uid, name, rating, stars, city, country, property_type, hero_image_url, images_json, facilities_json, description, latitude, longitude')
              .in('hotel_uid', hotelIds.map(String))
              .order('rating', { ascending: false })
              .limit(limit);
            cityStatics = data;
          }
          if ((!cityStatics || cityStatics.length === 0) && cityName) {
            const lookupCity = (searchType === 'hotel' && body.actualCityName) ? body.actualCityName : cityName;
            const { data } = await sb.from('hotel_static_cache')
              .select('hotel_uid, name, rating, stars, city, country, property_type, hero_image_url, images_json, facilities_json, description, latitude, longitude')
              .ilike('city', lookupCity.trim())
              .order('rating', { ascending: false })
              .range(offset, offset + limit - 1);
            cityStatics = data;
          }

          if (cityStatics?.length) {
            cachedHotels = cityStatics.map((st: any) => ({
              id: st.hotel_uid, name: st.name || 'Hotel', city: st.city || cityName || '',
              country: st.country || '', rating: st.rating || 0, reviews: 0, stars: st.stars || 0,
              price: 0, originalPrice: 0, originalCurrency: 'INR',
              crossedOutRate: 0, discountPercentage: 0,
              image: st.hero_image_url || null,
              images: Array.isArray(st.images_json) ? st.images_json : [],
              amenities: Array.isArray(st.facilities_json) ? st.facilities_json.slice(0, 8) : [],
              propertyType: st.property_type || 'Hotel', landingUrl: '', roomTypeName: '',
              currency: 'INR', availableRooms: [], source: 'tripjack', searchId: '',
              description: st.description || '', mealBasis: '', latitude: st.latitude || null,
              longitude: st.longitude || null, isPreview: true, hasFreeCancellation: false,
              staleStatus: 'hard_stale', priceFresh: false,
            }));
          }
        }
      } catch (e) {
        console.warn('[cache-first-search] error:', e);
      }

      // ── Hotel name search: If hotelName provided, also search catalogue by name ──
      if (hotelName && cachedHotels.length < limit) {
        try {
          const nameQuery = hotelName.trim();
          // Search tripjack_hotels by name (ILIKE) within the city
          let nameFilter = sb.from("tripjack_hotels")
            .select("tj_hotel_id, name, city_name, country_name, rating, property_type, image_url, hero_image_url, images, latitude, longitude, facilities")
            .eq("is_deleted", false)
            .ilike("name", `%${nameQuery}%`);
          if (cityName) nameFilter = nameFilter.ilike("city_name", cityName.trim());
          const { data: nameResults } = await nameFilter.order("rating", { ascending: false }).limit(10);

          if (nameResults?.length) {
            const existingIds = new Set(cachedHotels.map((h: any) => String(h.id)));
            const newHotels = nameResults
              .filter((h: any) => !existingIds.has(String(h.tj_hotel_id)))
              .map((h: any) => ({
                id: String(h.tj_hotel_id), name: h.name || "Unknown", city: h.city_name || "", country: h.country_name || "",
                rating: h.rating || 0, reviews: 0, stars: h.rating || 0, price: 0,
                originalPrice: 0, originalCurrency: "INR", crossedOutRate: 0, discountPercentage: 0,
                image: h.hero_image_url || h.image_url || null,
                images: (h.images || []).map((i: any) => typeof i === "string" ? i : i?.url || "").filter(Boolean),
                amenities: (h.facilities || []).map((f: any) => typeof f === "string" ? f : f?.name).filter(Boolean).slice(0, 8),
                propertyType: h.property_type || "Hotel", landingUrl: "", roomTypeName: "",
                currency: "INR", availableRooms: [], source: "tripjack", searchId: "",
                description: "", mealBasis: "", latitude: h.latitude || null, longitude: h.longitude || null,
                isPreview: true, hasFreeCancellation: false, staleStatus: 'hard_stale', priceFresh: false,
                _nameMatch: true, // flag for prioritization
              }));
            if (newHotels.length > 0) {
              console.log(`[cache-first-search] 🔍 Hotel name search "${nameQuery}": found ${newHotels.length} additional matches`);
              // Prepend name-matched hotels so they appear first
              cachedHotels = [...newHotels, ...cachedHotels];
            }
          }
        } catch (e) {
          console.warn('[cache-first-search] hotel name search error:', e);
        }
      }

      // Fallback to instant-preview from tripjack_hotels if nothing in cache
      if (cachedHotels.length === 0) {
        let previewHotels: any[] = [];
        if (searchType === "hotel" && hotelIds?.length) {
          const numericIds = hotelIds.map((id: string) => Number(id)).filter(Boolean);
          if (numericIds.length > 0) {
            const { data } = await sb.from("tripjack_hotels")
              .select("tj_hotel_id, name, city_name, country_name, rating, property_type, image_url, hero_image_url, images, latitude, longitude, facilities")
              .eq("is_deleted", false).or(buildTripjackHotelIdFilter(numericIds)).limit(limit);
            previewHotels = data || [];
          }
        } else if (cityName) {
          const { data } = await sb.from("tripjack_hotels")
            .select("tj_hotel_id, name, city_name, country_name, rating, property_type, image_url, hero_image_url, images, latitude, longitude, facilities")
            .eq("is_deleted", false).ilike("city_name", cityName.trim()).order("rating", { ascending: false }).range(offset, offset + limit - 1);
          previewHotels = data || [];
        }
        cachedHotels = previewHotels.map((h: any) => ({
          id: String(h.tj_hotel_id), name: h.name || "Unknown", city: h.city_name || "", country: h.country_name || "",
          rating: h.rating || 0, reviews: 0, stars: h.rating || 0, price: 0,
          originalPrice: 0, originalCurrency: "INR", crossedOutRate: 0, discountPercentage: 0,
          image: h.hero_image_url || h.image_url || null,
          images: (h.images || []).map((i: any) => typeof i === "string" ? i : i?.url || "").filter(Boolean),
          amenities: (h.facilities || []).map((f: any) => typeof f === "string" ? f : f?.name).filter(Boolean).slice(0, 8),
          propertyType: h.property_type || "Hotel", landingUrl: "", roomTypeName: "",
          currency: "INR", availableRooms: [], source: "tripjack", searchId: "",
          description: "", mealBasis: "", latitude: h.latitude || null, longitude: h.longitude || null,
          isPreview: true, hasFreeCancellation: false, staleStatus: 'hard_stale', priceFresh: false,
        }));
      }

      // Apply ranking engine to cached results
      if (cachedHotels.length > 0) {
        cachedHotels = await rankHotelsWithContext(cachedHotels as NormalizedHotel[], sb, checkinDate, 0, adults, childrenCount, roomCount);
      }

      // ── Currency conversion: convert all hotel prices to targetCurrency ──
      const displayCurrency = reqTargetCurrency || undefined;
      if (displayCurrency) {
        const exchangeCfg = await loadExchangeConfig(sb);
        cachedHotels = cachedHotels.map((h: any) => convertHotelPrices(h as NormalizedHotel, displayCurrency, exchangeCfg));
      }

      const hasPricing = cachedHotels.some((h: any) => h.price > 0);
      const freshPricedCount = cachedHotels.filter((h: any) => h.priceFresh).length;
      console.log(`[cache-first-search] ${cachedHotels.length} hotels (${hasPricing ? 'with pricing' : 'preview only'}, freshness=${cacheFreshness}, freshPriced=${freshPricedCount}) in ${Date.now() - t0}ms`);
      const travelerProfile = classifyTravelers(adults || 2, childrenCount || 0, roomCount || 1);
      const nights = computeNights(checkinDate, checkoutDate);
      return json({
        success: true, hotels: toPerNightPricing(cachedHotels, nights), count: cachedHotels.length,
        totalInDatabase: totalInDatabase || cachedHotels.length,
        cached: true, hasPricing, cacheFreshness,
        freshPricedCount, freshTtlMinutes, travelerProfile, numNights: nights,
        displayCurrency: displayCurrency || undefined,
      });
    }

    // ── Instant Preview ──
    if (action === "instant-preview") {
      const t0 = Date.now();
      const { cityName, hotelIds, searchType, limit = 30 } = body;
      let previewHotels: any[] = [];

      if (searchType === "hotel" && hotelIds?.length) {
        const numericIds = hotelIds.map((id: string) => Number(id)).filter(Boolean);
        if (numericIds.length > 0) {
          const { data } = await sb.from("tripjack_hotels")
            .select("tj_hotel_id, name, city_name, country_name, rating, property_type, image_url, hero_image_url, images, latitude, longitude, facilities, description")
            .eq("is_deleted", false).or(buildTripjackHotelIdFilter(numericIds)).limit(limit);
          previewHotels = data || [];
        }
      } else if (cityName) {
        const { data } = await sb.from("tripjack_hotels")
          .select("tj_hotel_id, name, city_name, country_name, rating, property_type, image_url, hero_image_url, images, latitude, longitude, facilities")
          .eq("is_deleted", false).ilike("city_name", cityName.trim()).order("rating", { ascending: false }).limit(limit);
        previewHotels = data || [];
        if (previewHotels.length === 0) {
          const { data: partial } = await sb.from("tripjack_hotels")
            .select("tj_hotel_id, name, city_name, country_name, rating, property_type, image_url, hero_image_url, images, latitude, longitude, facilities")
            .eq("is_deleted", false).ilike("city_name", `%${cityName.trim()}%`).order("rating", { ascending: false }).limit(limit);
          previewHotels = partial || [];
        }
      }

      const mapped = previewHotels.map((h: any) => ({
        id: String(h.tj_hotel_id), name: h.name || "Unknown", city: h.city_name || "", country: h.country_name || "",
        rating: h.rating || 0, reviews: 0, stars: h.rating || 0, price: 0,
        originalPrice: 0, originalCurrency: "INR", crossedOutRate: 0, discountPercentage: 0,
        image: h.hero_image_url || h.image_url || null,
        images: (h.images || []).map((i: any) => typeof i === "string" ? i : i?.url || "").filter(Boolean),
        amenities: (h.facilities || []).map((f: any) => typeof f === "string" ? f : f?.name).filter(Boolean).slice(0, 8),
        propertyType: h.property_type || "Hotel", landingUrl: "", roomTypeName: "",
        currency: "INR", availableRooms: [], source: "tripjack", searchId: "",
        description: h.description || "", mealBasis: "",
        latitude: h.latitude || null, longitude: h.longitude || null, isPreview: true,
      }));

      const rankedPreview = mapped.sort((a, b) => {
        const aHasImage = Number(Boolean(a.image) || a.images.length > 0);
        const bHasImage = Number(Boolean(b.image) || b.images.length > 0);
        if (aHasImage !== bHasImage) return bHasImage - aHasImage;
        return (b.rating || 0) - (a.rating || 0);
      });

      console.log(`[unified-hotel] instant-preview: ${rankedPreview.length} hotels in ${Date.now() - t0}ms`);
      return json({ success: true, hotels: rankedPreview, count: rankedPreview.length, preview: true });
    }

    // ── Smart Price: Freshness-aware pricing for a batch of hotel IDs ──
    // Used for initial top-30 and scroll-triggered batches of 20
    if (action === "top-100-price" || action === "smart-price" || action === "scroll-price") {
      const t0 = Date.now();
      const {
        hotelIds: requestedIds, cityName: priceCityName,
        checkinDate: priceCheckin, checkoutDate: priceCheckout,
        adults: priceAdults, children: priceChildren, rooms: priceRooms,
        clientNationality: priceNat, currency: priceCurrency,
      } = body;

      if (!requestedIds?.length || !priceCheckin || !priceCheckout) {
        return json({ success: false, error: "hotelIds, checkinDate, checkoutDate required" }, 400);
      }

      const targetCurrency = priceCurrency || "BDT";
      // Cap: top-100-price/smart-price = 100, scroll-price = 30
      const maxIds = action === "scroll-price" ? 30 : 100;
      const limitedIds = requestedIds.slice(0, maxIds);
      const actionLabel = action === "scroll-price" ? "scroll-price" : "smart-price";
      console.log(`[${actionLabel}] Pricing ${limitedIds.length} hotels for ${priceCityName || 'unknown city'}`);

      // Holidays pre-cached by sync-holidays cron

      // ── Freshness check: skip hotels with fresh cached prices ──
      const occKey = buildOccupancyKey(priceAdults || 2, priceChildren || 0, priceRooms || 1);
      let daysOut = 30;
      try { daysOut = Math.max(0, Math.floor((new Date(priceCheckin).getTime() - Date.now()) / 86_400_000)); } catch {}
      let isHighDemandPrice = false;
      try {
        const { data: hdRow } = await sb.from('high_demand_dates').select('id').eq('date', priceCheckin).limit(1);
        isHighDemandPrice = !!(hdRow && hdRow.length > 0);
      } catch {}
      let freshTtlMinutes = 2880;
      if (isHighDemandPrice) {
        freshTtlMinutes = daysOut <= 7 ? 60 : 720;
      } else if (daysOut < 3) freshTtlMinutes = 60;
      else if (daysOut < 7) freshTtlMinutes = 720;
      else if (daysOut < 30) freshTtlMinutes = 2880;
      else freshTtlMinutes = 14400;
      const freshCutoff = new Date(Date.now() - freshTtlMinutes * 60_000).toISOString();

      // Check which IDs already have fresh prices
      let freshCachedHotels: NormalizedHotel[] = [];
      let idsNeedingPrice: string[] = limitedIds;
      try {
        const { data: freshSnaps } = await sb.from('hotel_search_snapshot')
          .select('hotel_uid, search_hotel_id, min_price, currency, free_cancellation, property_type, meal_basis')
          .eq('checkin', priceCheckin)
          .eq('checkout', priceCheckout)
          .eq('occupancy_key', occKey)
          .gt('min_price', 0)
          .gte('last_checked_at', freshCutoff)
          .in('hotel_uid', limitedIds.map(String));

        if (freshSnaps?.length) {
          const freshIds = new Set(freshSnaps.map((s: any) => String(s.hotel_uid)));
          idsNeedingPrice = limitedIds.filter((id: string) => !freshIds.has(String(id)));

          // Enrich fresh cached hotels with static data
          const freshUids = freshSnaps.map((s: any) => s.hotel_uid);
          const { data: statics } = await sb.from('hotel_static_cache')
            .select('hotel_uid, name, rating, stars, city, country, property_type, hero_image_url, images_json, facilities_json, latitude, longitude')
            .in('hotel_uid', freshUids);
          const staticMap = new Map<string, any>();
          for (const s of (statics || [])) staticMap.set(s.hotel_uid, s);

          freshCachedHotels = freshSnaps.map((snap: any) => {
            const st = staticMap.get(snap.hotel_uid) || {};
            return {
              id: snap.hotel_uid, name: st.name || 'Hotel', city: st.city || priceCityName || '',
              country: st.country || '', rating: st.rating || 0, reviews: 0, stars: st.stars || 0,
              price: snap.min_price, originalPrice: snap.min_price, originalCurrency: snap.currency || 'INR',
              crossedOutRate: 0, discountPercentage: 0, image: st.hero_image_url || null,
              images: Array.isArray(st.images_json) ? st.images_json : [],
              amenities: Array.isArray(st.facilities_json) ? st.facilities_json.slice(0, 8) : [],
              propertyType: snap.property_type || st.property_type || 'Hotel',
              landingUrl: '', roomTypeName: '', currency: snap.currency || 'INR',
              availableRooms: [], source: 'tripjack', searchId: snap.search_hotel_id || '',
              description: '', mealBasis: snap.meal_basis || '',
              latitude: st.latitude || null, longitude: st.longitude || null,
              hasFreeCancellation: snap.free_cancellation || false,
            } as NormalizedHotel;
          });
          console.log(`[${actionLabel}] ${freshCachedHotels.length} hotels have fresh cache, ${idsNeedingPrice.length} need live pricing`);
        }
      } catch (e) {
        console.warn(`[${actionLabel}] freshness check error:`, e);
      }

      // ── Only call suppliers for stale/missing IDs ──
      let livePricedHotels: NormalizedHotel[] = [];
      const providerStats: Record<string, any> = {};

      if (idsNeedingPrice.length > 0) {
        const [config, exchangeConfig] = await Promise.all([loadProviderConfig(sb), loadExchangeConfig(sb)]);
        const supplierPromises: Promise<{ supplier: string; hotels: NormalizedHotel[] }>[] = [];

        if (config.tripjackEnabled) {
          supplierPromises.push((async () => {
            try {
              const hotels = await tripjackAdapter.search({
                cityName: priceCityName || "", checkinDate: priceCheckin, checkoutDate: priceCheckout,
                adults: priceAdults || 2, children: priceChildren || 0, rooms: priceRooms || 1,
                hotelIds: idsNeedingPrice, searchType: "hotel", clientNationality: priceNat,
              }, config);
              return { supplier: "tripjack", hotels };
            } catch (e) {
              console.error(`[${actionLabel}] Tripjack error:`, e);
              return { supplier: "tripjack", hotels: [] };
            }
          })());
        }

        if (config.hotelstonEnabled) {
          supplierPromises.push((async () => {
            try {
              const hotels = await hotelstonAdapter.search({
                cityName: priceCityName || "", checkinDate: priceCheckin, checkoutDate: priceCheckout,
                adults: priceAdults || 2, children: priceChildren || 0, rooms: priceRooms || 1,
                hotelIds: idsNeedingPrice, searchType: "hotel", clientNationality: priceNat,
              }, config);
              return { supplier: "hotelston", hotels };
            } catch (e) {
              console.error(`[${actionLabel}] Hotelston error:`, e);
              return { supplier: "hotelston", hotels: [] };
            }
          })());
        }

        const supplierResults = await Promise.allSettled(supplierPromises);
        for (const r of supplierResults) {
          if (r.status === "fulfilled") {
            const { supplier, hotels } = r.value;
            providerStats[supplier] = { count: hotels.length, success: true };
            livePricedHotels.push(...hotels);
          }
        }

        // Write snapshots for newly priced hotels (background)
        if (livePricedHotels.length > 0) {
          writeSearchSnapshots(sb, livePricedHotels, priceCheckin, priceCheckout, occKey).catch(() => {});
        }

        // Currency convert live results
        const exchangeCfg = await loadExchangeConfig(sb);
        livePricedHotels = livePricedHotels.map(h => convertHotelPrices(h, targetCurrency, exchangeCfg));
      } else {
        console.log(`[${actionLabel}] ALL ${limitedIds.length} hotels served from fresh cache — 0 API calls!`);
      }

      // Convert cached hotels to target currency too
      if (freshCachedHotels.length > 0) {
        const exchangeCfg = await loadExchangeConfig(sb);
        freshCachedHotels = freshCachedHotels.map(h => convertHotelPrices(h, targetCurrency, exchangeCfg));
      }

      // Apply surge + agent markups
      const authHeader = req.headers.get("authorization");
      const [surgeConfig, agentMarkup] = await Promise.all([
        loadSurgeConfig(sb, priceCheckin), loadAgentMarkup(sb, authHeader),
      ]);
      // Merge: deduplicate live + cached, apply dynamic markups, then rank
      const allHotels = deduplicateHotels([...livePricedHotels, ...freshCachedHotels])
        .map(h => applyDynamicMarkupsToHotel(h, surgeConfig, agentMarkup));
      const ranked = await rankHotelsWithContext(allHotels, sb, priceCheckin, 0, priceAdults, priceChildren, priceRooms);

      const apiCallsMade = idsNeedingPrice.length > 0 ? Object.keys(providerStats).length : 0;
      console.log(`[${actionLabel}] ${ranked.length} priced hotels (${freshCachedHotels.length} cached + ${livePricedHotels.length} live, ${apiCallsMade} API calls) in ${Date.now() - t0}ms`);
      const nights = computeNights(priceCheckin, priceCheckout);
      return json({
        success: true,
        hotels: toPerNightPricing(ranked, nights),
        count: ranked.length,
        providerStats,
        displayCurrency: targetCurrency,
        durationMs: Date.now() - t0,
        fromCache: freshCachedHotels.length,
        fromLive: livePricedHotels.length,
        apiCallsSaved: freshCachedHotels.length > 0 ? 1 : 0,
        numNights: nights,
      });
    }

    // ── Supplier Search ──
    if (action === "supplier-search") {
      const t0 = Date.now();
      const { supplier, cityName, checkinDate, checkoutDate, adults, children, rooms, hotelIds, searchType, actualCityName, clientNationality, currency: reqCurrency } = body;
      if (!supplier || !cityName || !checkinDate || !checkoutDate) return json({ success: false, error: "supplier, cityName, checkinDate, checkoutDate required" }, 400);

      const targetCurrency = reqCurrency || "BDT";

      const authHeader = req.headers.get("authorization");
      const [config, exchangeConfig, surgeConfig, agentMarkup] = await Promise.all([
        loadProviderConfig(sb), loadExchangeConfig(sb),
        loadSurgeConfig(sb, checkinDate), loadAgentMarkup(sb, authHeader),
      ]);
      let resolvedHotelIds: string[] | undefined = hotelIds;
      if (supplier === "tripjack" && resolvedHotelIds?.length) resolvedHotelIds = await resolveTripjackLiveHotelIds(sb, resolvedHotelIds);
      if (supplier === "tripjack" && (!resolvedHotelIds || resolvedHotelIds.length === 0) && cityName) resolvedHotelIds = await loadTopTripjackLiveHotelIds(sb, cityName);

      const params: SupplierSearchParams = {
        cityName, checkinDate, checkoutDate, adults: adults || 2, children: children || 0, rooms: rooms || 1,
        hotelIds: resolvedHotelIds, searchType: resolvedHotelIds?.length ? "hotel" : searchType, actualCityName, clientNationality,
        testBatchSize: body.testBatchSize,
      };

      let adapter: SupplierAdapter | null = null;
      if (supplier === "tripjack" && config.tripjackEnabled) adapter = tripjackAdapter;
      if (supplier === "hotelston" && config.hotelstonEnabled) adapter = hotelstonAdapter;
      if (!adapter) return json({ success: true, supplier, hotels: [], count: 0, skipped: true });

      try {
        const hotels = await adapter.search(params, config);
        let converted = hotels.map(h => convertHotelPrices(h, targetCurrency, exchangeConfig));
        converted = converted.map(h => applyDynamicMarkupsToHotel(h, surgeConfig, agentMarkup));
        const ranked = await rankHotelsWithContext(converted, sb, checkinDate, config.markupPercentage, adults, children, rooms);
        // Write search snapshots in background
        const occKey = buildOccupancyKey(adults || 2, children || 0, rooms || 1);
        writeSearchSnapshots(sb, hotels, checkinDate, checkoutDate, occKey).catch(() => {});
        console.log(`[unified-hotel] supplier-search ${supplier}: ${ranked.length} hotels in ${Date.now() - t0}ms`);
        const nights = computeNights(checkinDate, checkoutDate);
        return json({ success: true, supplier, hotels: toPerNightPricing(ranked, nights), count: ranked.length, durationMs: Date.now() - t0, displayCurrency: targetCurrency, numNights: nights, surge: surgeConfig.isHighDemand ? surgeConfig.holidayLabel : undefined });
      } catch (err) {
        console.error(`[unified-hotel] supplier-search ${supplier} error:`, err);
        return json({ success: true, supplier, hotels: [], count: 0, error: String(err) });
      }
    }

    // ── Full Search (default) ──
    if (!body.cityName || !body.checkinDate || !body.checkoutDate) {
      return json({ success: false, error: "cityName, checkinDate, and checkoutDate are required (or specify an action)" }, 400);
    }

    const t0 = Date.now();
    const targetCurrency = body.currency || "BDT";
    const sessionId = generateSessionId();

    console.log(`[unified-hotel] Search: city=${body.cityName}, dates=${body.checkinDate}→${body.checkoutDate}, session=${sessionId}`);

    const cacheKey = buildCacheKey(body);
    const skipCache = body.skipCache === true;
    const authHeader = req.headers.get("authorization");
    const [cachedHotels, config, exchangeConfig, surgeConfig, agentMarkup] = await Promise.all([
      skipCache ? Promise.resolve(null) : getCachedResults(sb, cacheKey), loadProviderConfig(sb), loadExchangeConfig(sb),
      loadSurgeConfig(sb, body.checkinDate), loadAgentMarkup(sb, authHeader),
    ]);

    if (cachedHotels) {
      let converted = (cachedHotels as NormalizedHotel[]).map(h => convertHotelPrices(h, targetCurrency, exchangeConfig));
      converted = converted.map(h => applyDynamicMarkupsToHotel(h, surgeConfig, agentMarkup));
      const ranked = await rankHotelsWithContext(converted, sb, body.checkinDate, config.markupPercentage, body.adults, body.children, body.rooms);
      createSession(sb, sessionId, body, ranked, targetCurrency, { cached: true }).catch(() => {});

      const searchParams: SupplierSearchParams = {
        cityName: body.cityName, checkinDate: body.checkinDate, checkoutDate: body.checkoutDate,
        adults: body.adults || 2, children: body.children || 0, rooms: body.rooms || 1,
        hotelIds: body.hotelIds, searchType: body.searchType, actualCityName: body.actualCityName, clientNationality: body.clientNationality,
        testBatchSize: body.testBatchSize,
      };
      performSearch(searchParams, config).then(({ hotels }) => {
        if (hotels.length > 0) setCachedResults(sb, cacheKey, hotels).catch(() => {});
      }).catch(() => {});

      const nightsCached = computeNights(body.checkinDate, body.checkoutDate);
      return json({ success: true, sessionId, hotels: toPerNightPricing(ranked, nightsCached), count: ranked.length, providers: { tripjack: config.tripjackEnabled, hotelston: config.hotelstonEnabled }, displayCurrency: targetCurrency, cached: true, numNights: nightsCached, surge: surgeConfig.isHighDemand ? surgeConfig.holidayLabel : undefined });
    }

    const searchParams: SupplierSearchParams = {
      cityName: body.cityName, checkinDate: body.checkinDate, checkoutDate: body.checkoutDate,
      adults: body.adults || 2, children: body.children || 0, rooms: body.rooms || 1,
      hotelIds: body.hotelIds, searchType: body.searchType, actualCityName: body.actualCityName, clientNationality: body.clientNationality,
      testBatchSize: body.testBatchSize,
    };

    const { hotels, providerStats } = await performSearch(searchParams, config);
    console.log(`[unified-hotel] Total after dedup+rank: ${hotels.length} in ${Date.now() - t0}ms`);

    if (hotels.length > 0) setCachedResults(sb, cacheKey, hotels).catch(() => {});
    let converted = hotels.map(h => convertHotelPrices(h, targetCurrency, exchangeConfig));
    converted = converted.map(h => applyDynamicMarkupsToHotel(h, surgeConfig, agentMarkup));
    createSession(sb, sessionId, body, converted, targetCurrency, providerStats).catch(() => {});

    const nightsFresh = computeNights(body.checkinDate, body.checkoutDate);
    return json({ success: true, sessionId, hotels: toPerNightPricing(converted, nightsFresh), count: converted.length, providers: { tripjack: config.tripjackEnabled, hotelston: config.hotelstonEnabled }, providerStats, displayCurrency: targetCurrency, cached: false, numNights: nightsFresh, surge: surgeConfig.isHighDemand ? surgeConfig.holidayLabel : undefined });
  } catch (e) {
    console.error("[unified-hotel] error:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
