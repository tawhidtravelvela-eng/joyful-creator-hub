// Tripjack Hotel API v2 edge function
// Direct API call to api.tripjack.com
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Proxy to Tripjack API
const PROXY_BASE = "http://65.20.67.77/tj";
const TJ_API_BASE = PROXY_BASE;

// ── Currency conversion helpers ──
const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, BDT: 110.5, INR: 83, CNY: 7.24,
};

interface ExchangeConfig { rates: Record<string, number>; markup: number; }

async function loadExchangeConfig(sb: any): Promise<ExchangeConfig> {
  const config: ExchangeConfig = { rates: { ...DEFAULT_EXCHANGE_RATES }, markup: 0 };
  try {
    const { data } = await sb.from("api_settings").select("settings").eq("provider", "currency_rates").maybeSingle();
    if (data?.settings) {
      const s = data.settings as any;
      if (s.live_rates) config.rates = { ...config.rates, ...s.live_rates };
      if (s.conversion_markup !== undefined) config.markup = s.conversion_markup;
    }
  } catch { }
  return config;
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

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>, markup: number): number {
  if (fromCurrency === toCurrency) return Math.round(amount);
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  return Math.round((amount / fromRate) * toRate * (1 + markup / 100));
}

interface ProxyConfig {
  isActive: boolean;
  proxySecret: string;
}

async function getConfig(): Promise<ProxyConfig> {
  const proxySecret = Deno.env.get("PROXY_SECRET_KEY");
  if (!proxySecret) throw new Error("PROXY_SECRET_KEY not configured");
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("api_settings").select("is_active, settings").eq("provider", "tripjack_hotel").maybeSingle();
  return { isActive: data?.is_active ?? false, proxySecret };
}

async function tjFetch(path: string, method: string, body?: any, proxySecret?: string): Promise<Response> {
  const url = `${PROXY_BASE}${path}`;
  console.log(`[tj-v2] ${method} ${url}`);
  const headers: Record<string, string> = { "x-vela-key": proxySecret || "" };
  if (body) headers["Content-Type"] = "application/json";
  return fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

// ── Tripjack booking status mapping ──
function mapTripjackBookingStatus(tjStatus: string): string {
  const statusMap: Record<string, string> = {
    "SUCCESS": "success", "IN_PROGRESS": "success", "ON_HOLD": "on_hold",
    "PAYMENT_SUCCESS": "pending", "PAYMENT_PENDING": "pending", "PENDING": "pending",
    "ABORTED": "failed", "FAILED": "failed",
    "CANCELLATION_PENDING": "cancellation_pending", "CANCELLED": "cancelled",
  };
  return statusMap[tjStatus?.toUpperCase()] || "pending";
}

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Date format helper (Tripjack expects YYYY-MM-DD per v2 docs) ──
function toTripjackDate(dateStr: string): string {
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Convert DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

// ── Batch size for search (v2 max 100 hids per request) ──
// Proxy can only handle ~1 concurrent request, so we send sequentially
const BATCH_SIZE = 100;   // Tripjack max per request
const MAX_TOTAL_HIDS = 200; // Cap total to avoid function timeout
const BATCH_TIMEOUT_MS = 25_000; // Per-batch timeout (sequential so shorter is OK)

interface BatchSearchResult { hotels: any[]; searchData: any; }

async function searchBatchV2(
  hids: string[],
  checkIn: string,
  checkOut: string,
  roomInfo: any[],
  nationality: string,
  currency: string,
  apiKey: string,
  batchIndex: number
): Promise<BatchSearchResult> {
  // v2 search uses nested searchQuery structure
  const payload = {
    searchQuery: {
      checkinDate: toTripjackDate(checkIn),
      checkoutDate: toTripjackDate(checkOut),
      roomInfo,
      searchCriteria: {
        nationality: nationality || "106",
        currency: currency || "INR",
      },
      searchPreferences: {
        hids: hids,
        fsc: true,
      },
    },
    sync: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS);

  try {
    const url = `${TJ_API_BASE}/hms/v1/hotel-searchquery-list`;
    console.log(`[tj-v2] Batch ${batchIndex}: POST ${url} with ${hids.length} hids`);
    const t0 = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": apiKey,  },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    console.log(`[tj-v2] Batch ${batchIndex}: status=${res.status} in ${Date.now() - t0}ms`);

    const text = await res.text();
    if (!res.ok) {
      console.warn(`[tj-v2] Batch ${batchIndex}: HTTP ${res.status} — ${text.substring(0, 200)}`);
      return { hotels: [], searchData: null };
    }

    let data: any;
    try { data = JSON.parse(text); } catch {
      console.warn(`[tj-v2] Batch ${batchIndex}: invalid JSON`);
      return { hotels: [], searchData: null };
    }

    if (!data?.status?.success) {
      const errMsg = data?.errors?.[0]?.message || data?.error?.message || `httpStatus=${data?.status?.httpStatus || 'unknown'}`;
      console.warn(`[tj-v2] Batch ${batchIndex}: API error — ${errMsg}`);
      return { hotels: [], searchData: data };
    }

    // v2 response: searchResult.his[]
    const hotelResults = data?.searchResult?.his || [];
    console.log(`[tj-v2] Batch ${batchIndex}: ${hotelResults.length} hotels found`);
    return { hotels: hotelResults, searchData: data };
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

// ── Map v2 search results to normalized output ──
// v2 hotel: { id: "hsid...", name, rt, ad: {adr, ctn, cn}, pt, ops: [{ris: [{id, rc, mb, tp}], id, tp}], uid, ifca }
function mapHotelResultsV2(hotelResults: any[], staticDataMap: Map<number, any>, cityName: string) {
  return hotelResults.map((h: any) => {
    const uid = String(h.uid || "");
    const searchId = h.id || ""; // hsid... used for detail/review
    let lowestPrice = 0;
    let mealBasis = "";
    let isRefundable = h.ifca || false;
    const availableRooms: any[] = [];

    for (const opt of (h.ops || [])) {
      const optPrice = opt.tp || 0;
      if (optPrice > 0 && (lowestPrice === 0 || optPrice < lowestPrice)) {
        lowestPrice = optPrice;
        // Get meal basis from first room in the option
        const firstRoom = opt.ris?.[0];
        mealBasis = firstRoom?.mb || "Room Only";
      }
      availableRooms.push({
        optionId: opt.id || "",
        price: Math.round(opt.tp || 0),
        mealBasis: opt.ris?.[0]?.mb || "Room Only",
        isRefundable: h.ifca || false,
        rooms: (opt.ris || []).map((ri: any) => ({
          id: ri.id,
          name: ri.rc || ri.rt || "",
          mealBasis: ri.mb || "Room Only",
          price: Math.round(ri.tp || 0),
        })),
      });
    }

    // Resolve static data by uid (tj_hotel_id)
    const sd = staticDataMap.get(Number(uid));
    const facilityNames = (sd?.facilities || []).map((f: any) => typeof f === "string" ? f : f?.name).filter(Boolean);

    const staticImages: string[] = (sd?.images || [])
      .map((i: any) => typeof i === "string" ? i : i?.url)
      .filter(Boolean);
    const thumbnail = sd?.hero_image_url || sd?.image_url || staticImages[0] || null;

    return {
      id: uid,
      tjHotelId: uid,
      searchId, // hsid... needed for detail/review calls
      name: h.name || sd?.name || "Unknown Hotel",
      city: h.ad?.ctn || sd?.city_name || cityName || "",
      country: h.ad?.cn || sd?.country_name || "",
      address: h.ad?.adr || sd?.address || "",
      stars: h.rt || sd?.rating || 0,
      rating: h.rt || sd?.rating || 0,
      price: Math.round(lowestPrice),
      currency: "INR",
      image: thumbnail,
      images: staticImages,
      amenities: facilityNames.slice(0, 10),
      propertyType: h.pt || sd?.property_type || "Hotel",
      latitude: sd?.latitude || null,
      longitude: sd?.longitude || null,
      source: "tripjack",
      mealBasis,
      isRefundable,
      hasFreeCancellation: isRefundable,
      availableRooms,
    };
  });
}

// ── Map v2 option from detail/review response ──
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
      id: ri.id,
      name: ri.rc || ri.rt || "",
      standardName: ri.srn || "",
      description: ri.des || "",
      mealBasis: ri.mb || "Room Only",
      price: Math.round(ri.tp || 0),
      adults: ri.adt || 0,
      children: ri.chd || 0,
      facilities: ri.fcs || [],
      images: (ri.imgs || []).map((img: any) => ({ url: img.url, size: img.sz })),
      roomDetails: ri.radi ? {
        roomId: ri.radi.rid,
        maxGuests: ri.radi.mga,
        maxAdults: ri.radi.maa,
        maxChildren: ri.radi.mca,
        views: ri.radi.vi || [],
        beds: (ri.radi.bds || []).map((b: any) => ({ type: b.bt, count: b.bc })),
        area: ri.radi.ar || {},
      } : null,
      occupancyPattern: ri.op || "",
      extraBenefits: ri.rexb || {},
    })),
    instructions: opt.inst || [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return jsonRes({ success: false, error: "Rate limit exceeded" }, 429);
  }

  try {
    const body = await req.json();
    const { action } = body;
    const config = await getConfig();

    if (!config.isActive && action !== "test" && action !== "sync-hotels" && action !== "sync-status" && action !== "static-detail" && action !== "backfill-city-map") {
      return jsonRes({ success: false, error: "Tripjack Hotel API is not active" });
    }

    // ── Test connectivity ──
    if (action === "test") {
      const apiBase = body.apiBase || TJ_API_BASE;
      const apiVersion = body.apiVersion || "v1";
      const endpoint = body.endpoint || "fetch-static-hotels"; // allow testing any endpoint
      const testBody = body.testBody || {};
      const testMethod = body.testMethod || "POST";
      try {
        // Build URL based on endpoint type
        let url: string;
        if (endpoint.startsWith("/")) {
          url = `${apiBase}${endpoint}`;
        } else if (endpoint === "fetch-static-hotels" || endpoint === "fetch-static-hotels/deleted") {
          url = `${apiBase}/hms/${apiVersion}/${endpoint}`;
        } else {
          // v3 dynamic endpoints: listing, pricing, review
          url = `${apiBase}/hms/${apiVersion}/hotel/${endpoint}`;
        }
        console.log(`[tj-test] ${testMethod} ${url}`);
        const headers: Record<string, string> = { "apikey": config.proxySecret || "",  };
        if (testMethod === "POST") headers["Content-Type"] = "application/json";
        const res = await fetch(url, {
          method: testMethod,
          headers,
          body: testMethod === "POST" ? JSON.stringify(testBody) : undefined,
        });
        const status = res.status;
        const text = await res.text();
        // Extract hotel ID fields from first hotel for debugging
        let idFields: any = null;
        try {
          const parsed = JSON.parse(text);
          const first = parsed?.hotelOpInfos?.[0];
          if (first) {
            idFields = { hotelId: first.hotelId, id: first.id, uid: first.uid, hid: first.hid, keys: Object.keys(first).slice(0, 20) };
          }
        } catch {}
        return jsonRes({ success: status === 200 || status === 400, status, preview: text.substring(0, 2000), idFields, url, apiVersion });
      } catch (e: any) {
        return jsonRes({ success: false, error: e.message, apiVersion });
      }
    }

    // ══════════════════════════════════════════════════════════
    // SEARCH — v2: POST /hms/v1/hotel-searchquery-list
    // ══════════════════════════════════════════════════════════
    if (action === "search") {
      const { checkinDate, checkoutDate, checkIn, checkOut, roomInfo, rooms, cityName, nationality, ratings, hids: providedHids, currency } = body;

      const ciDate = checkinDate || checkIn;
      const coDate = checkoutDate || checkOut;
      if (!ciDate || !coDate) {
        return jsonRes({ success: false, error: "Missing check-in/check-out dates" }, 400);
      }

      // Build v2 roomInfo format: [{numberOfAdults, numberOfChild, childAge?}]
      const rawRooms = roomInfo || rooms || [{ adults: 2 }];
      const v2RoomInfo = (Array.isArray(rawRooms) ? rawRooms : [rawRooms]).map((r: any) => {
        const obj: any = {
          numberOfAdults: r.numberOfAdults || r.adults || 2,
          numberOfChild: r.numberOfChild || r.child || r.children || 0,
        };
        if (obj.numberOfChild > 0 && r.childAge) {
          obj.childAge = r.childAge;
        }
        return obj;
      });

      // Resolve nationality to numeric ID
      let tripjackNationality = nationality || "106";
      if (!/^\d+$/.test(String(tripjackNationality))) {
        try {
          const natRes = await tjFetch("/hms/v1/nationality-info", "GET", undefined, config.proxySecret);
          if (natRes.ok) {
            const natData = await natRes.json();
            const code = String(tripjackNationality).trim().toUpperCase();
            const match = natData?.nationalityInfos?.find((item: any) =>
              item?.code?.toUpperCase?.() === code || item?.isoCode?.toUpperCase?.() === code
            );
            if (match?.countryId) tripjackNationality = String(match.countryId);
          }
        } catch (e) {
          console.warn("[tj-v2] nationality lookup failed:", e);
        }
      }

      // Get hotel IDs from catalogue
      let hotelIds: string[] = providedHids || [];

      if (hotelIds.length === 0 && cityName) {
        const sb = getSupabaseAdmin();
        const t0 = Date.now();
        const { data: cityMap } = await sb
          .from("tripjack_city_hotel_map")
          .select("hotel_ids")
          .ilike("city_name", cityName.trim())
          .order("hotel_count", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cityMap?.hotel_ids) {
          hotelIds = cityMap.hotel_ids;
        } else {
          const { data: partialMap } = await sb
            .from("tripjack_city_hotel_map")
            .select("hotel_ids")
            .ilike("city_name", `%${cityName.trim()}%`)
            .limit(1)
            .maybeSingle();
          if (partialMap?.hotel_ids) hotelIds = partialMap.hotel_ids;
        }
        console.log(`[tj-v2] City map: ${hotelIds.length} hids for "${cityName}" in ${Date.now() - t0}ms`);
      }

      if (hotelIds.length === 0) {
        return jsonRes({
          success: true, hotels: [], count: 0,
          note: `No hotels found in catalogue for "${cityName || 'unknown'}". Run sync-hotels to populate.`,
        });
      }

      // v2 hids are strings — cap to MAX_TOTAL_HIDS
      const stringHids = hotelIds.map(String).slice(0, MAX_TOTAL_HIDS);

      // Split into batches of BATCH_SIZE (100)
      const batches: string[][] = [];
      for (let i = 0; i < stringHids.length; i += BATCH_SIZE) {
        batches.push(stringHids.slice(i, i + BATCH_SIZE));
      }

      console.log(`[tj-v2] Sequential search: ${stringHids.length} hids in ${batches.length} batches`);

      // Pre-fetch static data in parallel with first batch
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

      // Send batches SEQUENTIALLY (proxy has concurrency limit ~1)
      const allHotelResults: any[] = [];
      let successfulBatches = 0;
      let consecutiveEmptyBatches = 0;
      const t0 = Date.now();

      for (let i = 0; i < batches.length; i++) {
        // Check total elapsed time — abort if running long
        if (Date.now() - t0 > 50_000) {
          console.warn(`[tj-v2] Stopping at batch ${i}/${batches.length} — elapsed ${Date.now() - t0}ms`);
          break;
        }
        // Early bail-out: if 2 consecutive batches return 0 hotels, stop
        if (consecutiveEmptyBatches >= 2) {
          console.warn(`[tj-v2] Bailing out after ${consecutiveEmptyBatches} consecutive empty batches (likely stale IDs)`);
          break;
        }
        const result = await searchBatchV2(batches[i], ciDate, coDate, v2RoomInfo, tripjackNationality, currency || "INR", config.proxySecret, i);
        if (result.hotels.length > 0) {
          allHotelResults.push(...result.hotels);
          successfulBatches++;
          consecutiveEmptyBatches = 0;
        } else {
          consecutiveEmptyBatches++;
        }
      }

      const staticDataMap = await staticDataPromise;
      console.log(`[tj-v2] Total: ${allHotelResults.length} hotels from ${successfulBatches}/${batches.length} batches in ${Date.now() - t0}ms, static: ${staticDataMap.size}`);

      if (allHotelResults.length === 0) {
        return jsonRes({
          success: true, hotels: [], count: 0,
          note: `No availability found for "${cityName || 'unknown'}" on ${ciDate}`,
          batches: batches.length,
        });
      }

      const mappedHotels = mapHotelResultsV2(allHotelResults, staticDataMap, cityName);

      return jsonRes({
        success: true,
        hotels: mappedHotels,
        count: mappedHotels.length,
        totalResults: allHotelResults.length,
        batches: batches.length,
      });
    }

    // ══════════════════════════════════════════════════════════
    // DETAIL — v2: POST /hms/v1/hotelDetail-search
    // Uses search hotel id (hsid...) from search response
    // ══════════════════════════════════════════════════════════
    if (action === "detail") {
      const { searchId, id, hid, hotelId, checkIn, checkOut, rooms, nationality, targetCurrency } = body;

      let detailId = searchId || id || hid || hotelId;
      if (!detailId) {
        return jsonRes({ success: false, error: "Missing search hotel id (searchId from search response)" }, 400);
      }

      const lookupHotelId = String(hid || hotelId || id || searchId || "");
      const needsSearchResolution = !String(detailId).startsWith("hsid") && /^\d+$/.test(String(detailId));

      if (needsSearchResolution) {
        if (!checkIn || !checkOut) {
          return jsonRes({ success: false, error: "Missing dates to resolve live room availability" }, 400);
        }

        const normalizedRooms = Array.isArray(rooms) && rooms.length > 0
          ? rooms.map((room: any) => ({
              adults: Math.max(1, Number(room?.adults) || 1),
              ...(Number(room?.children) > 0 ? { children: Number(room.children) } : {}),
              ...(Array.isArray(room?.childAge) && room.childAge.length > 0 ? { childAge: room.childAge } : {}),
            }))
          : [{ adults: 2 }];

        const resolvedSearch = await searchBatchV2(
          [String(detailId)],
          checkIn,
          checkOut,
          normalizedRooms,
          nationality || "106",
          "INR",
          config.proxySecret,
          0,
        );

        const liveHotel = (resolvedSearch.hotels || []).find(
          (candidate: any) => String(candidate?.uid || "") === String(lookupHotelId || detailId)
        );

        if (!liveHotel?.id) {
          return jsonRes({ success: false, error: "Hotel/room no longer available. Please search again.", expired: true });
        }

        detailId = liveHotel.id;
      }

      const sb = getSupabaseAdmin();
      const [detailRes, apiMarkup, exchangeConfig] = await Promise.all([
        tjFetch("/hms/v1/hotelDetail-search", "POST", { id: detailId }, config.proxySecret),
        loadApiMarkup(sb),
        targetCurrency && targetCurrency !== "INR" ? loadExchangeConfig(sb) : Promise.resolve(null),
      ]);

      if (!detailRes.ok) {
        const errText = await detailRes.text();
        let parsedError: any = null;
        try {
          parsedError = JSON.parse(errText);
        } catch {
          parsedError = null;
        }
        const upstreamError = parsedError?.upstreamBody || parsedError;
        const errCode = Number(
          upstreamError?.errors?.[0]?.errCode ??
          upstreamError?.errors?.[0]?.code ??
          upstreamError?.status?.httpStatus ??
          detailRes.status
        );
        console.error("[tj-v2] detail error:", detailRes.status, errText.substring(0, 500));
        if (errCode === 6003 || errCode === 6001) {
          return jsonRes({ success: false, error: "Hotel/room no longer available. Please search again.", expired: true });
        }
        return jsonRes({ success: false, error: `Detail failed: ${detailRes.status}` }, 400);
      }

      const detailData = await detailRes.json();

      if (!detailData?.status?.success) {
        const errCode = Number(detailData?.errors?.[0]?.errCode ?? detailData?.errors?.[0]?.code ?? detailData?.status?.httpStatus);
        if (errCode === 6003 || errCode === 6001) {
          return jsonRes({ success: false, error: "Hotel/room no longer available. Please search again.", expired: true });
        }
        return jsonRes({ success: false, error: detailData?.errors?.[0]?.message || "Detail search failed" }, 400);
      }

      const hotel = detailData.hotel;
      if (!hotel) {
        return jsonRes({ success: false, error: "No hotel data in response" }, 400);
      }

      const transformPrice = (rawPrice: number): number => {
        let price = Math.round(rawPrice * (1 + apiMarkup / 100));
        if (targetCurrency && targetCurrency !== "INR" && exchangeConfig) {
          price = convertAmount(price, "INR", targetCurrency, exchangeConfig.rates, exchangeConfig.markup);
        }
        return price;
      };

      const options = (hotel.ops || []).map((opt: any) => {
        const mapped = mapV2Option(opt);
        return {
          ...mapped,
          price: transformPrice(opt.tp || 0),
          rooms: mapped.rooms.map((r: any) => ({ ...r, price: transformPrice(r.price) })),
        };
      });

      const uid = hotel.uid || "";
      const { data: staticHotel } = await sb
        .from("tripjack_hotels")
        .select("image_url, hero_image_url, images, facilities")
        .eq("tj_hotel_id", Number(uid))
        .maybeSingle();

      const staticImages: string[] = (staticHotel?.images || [])
        .map((i: any) => typeof i === "string" ? i : i?.url)
        .filter(Boolean);

      const displayCurrency = targetCurrency || "INR";
      console.log(`[tj-v2] detail: markup=${apiMarkup}%, currency=INR→${displayCurrency}, options=${options.length}`);

      return jsonRes({
        success: true,
        hotel: {
          id: hotel.id,
          searchId: detailId,
          tjHotelId: uid,
          name: hotel.name || "",
          rating: hotel.rt || 0,
          address: hotel.ad || {},
          propertyType: hotel.pt || "Hotel",
          instructions: hotel.inst || [],
          images: staticImages,
          options,
        },
        displayCurrency,
      });
    }

    // ══════════════════════════════════════════════════════════
    // CANCELLATION POLICY — v2: POST /hms/v1/hotel-cancellation-policy
    // ══════════════════════════════════════════════════════════
    if (action === "cancellation-policy") {
      const { searchId, id, optionId } = body;
      const hotelSearchId = searchId || id;
      if (!hotelSearchId || !optionId) {
        return jsonRes({ success: false, error: "Missing searchId or optionId" }, 400);
      }

      const res = await tjFetch("/hms/v1/hotel-cancellation-policy", "POST",
        { id: hotelSearchId, optionId }, config.proxySecret);

      if (!res.ok) {
        const errText = await res.text();
        return jsonRes({ success: false, error: `Cancellation policy failed: ${res.status}` }, 400);
      }

      const data = await res.json();
      if (!data?.status?.success) {
        return jsonRes({ success: false, error: data?.errors?.[0]?.message || "Cancellation policy failed" });
      }

      return jsonRes({
        success: true,
        searchId: data.id,
        cancellationPolicy: data.cancellationPolicy,
      });
    }

    // ══════════════════════════════════════════════════════════
    // REVIEW — v2: POST /hms/v1/hotel-review
    // Returns bookingId + final pricing for booking
    // ══════════════════════════════════════════════════════════
    if (action === "review") {
      const { searchId, id, hotelId, optionId } = body;

      const hotelSearchId = searchId || id || hotelId;
      if (!hotelSearchId) {
        return jsonRes({ success: false, error: "Missing hotel search id (searchId)" }, 400);
      }
      if (!optionId) {
        return jsonRes({ success: false, error: "Missing optionId" }, 400);
      }

      console.log(`[tj-v2] review: hotelId=${hotelSearchId}, optionId=${optionId}`);

      const res = await tjFetch("/hms/v1/hotel-review", "POST",
        { hotelId: hotelSearchId, optionId }, config.proxySecret);

      if (!res.ok) {
        const errText = await res.text();
        console.error("[tj-v2] review error:", res.status, errText.substring(0, 300));
        return jsonRes({ success: false, error: `Review failed: ${res.status}` }, 400);
      }

      const reviewData = await res.json();

      if (!reviewData?.status?.success) {
        const errCode = reviewData?.errors?.[0]?.code || reviewData?.status?.httpStatus;
        if (errCode === 6001 || errCode === 6022) {
          return jsonRes({ success: false, error: "Room option no longer available", soldOut: true });
        }
        if (errCode === 6003) {
          return jsonRes({ success: false, error: "Hotel no longer available. Please search again.", expired: true });
        }
        return jsonRes({ success: false, error: reviewData?.errors?.[0]?.message || "Review failed" });
      }

      const hInfo = reviewData.hInfo;
      const options = (hInfo?.ops || []).map(mapV2Option);

      return jsonRes({
        success: true,
        bookingId: reviewData.bookingId,
        conditions: reviewData.conditions || {},
        hotel: {
          id: hInfo?.id || hotelSearchId,
          tjHotelId: hInfo?.uid || "",
          name: hInfo?.name || "",
          rating: hInfo?.rt || 0,
          address: hInfo?.ad || {},
          propertyType: hInfo?.pt || "Hotel",
          instructions: hInfo?.inst || [],
          options,
        },
      });
    }

    // ══════════════════════════════════════════════════════════
    // BOOK — v2: POST /oms/v1/hotel/book
    // ══════════════════════════════════════════════════════════
    if (action === "book") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return jsonRes({ success: false, error: "Authentication required" }, 401);
      }

      const { bookingId, roomTravellerInfo, deliveryInfo, paymentInfos, paymentAmount } = body;
      if (!bookingId || !roomTravellerInfo) {
        return jsonRes({ success: false, error: "Missing bookingId or roomTravellerInfo" }, 400);
      }

      console.log(`[tj-v2] book: bookingId=${bookingId}`);

      const bookPayload: any = {
        bookingId,
        type: "HOTEL",
        roomTravellerInfo: roomTravellerInfo.map((room: any) => ({
          travellerInfo: (room.travellerInfo || []).map((t: any) => ({
            ti: t.ti || "Mr",
            fN: t.fN || t.firstName || "",
            lN: t.lN || t.lastName || "",
            pt: t.pt || "ADULT",
            ...(t.pan ? { pan: t.pan } : {}),
            ...(t.pNum ? { pNum: t.pNum } : {}),
          })),
        })),
        deliveryInfo: deliveryInfo || { emails: [], contacts: [], code: [] },
      };

      // Instant booking: include paymentInfos. Hold booking: omit paymentInfos.
      if (paymentInfos) {
        bookPayload.paymentInfos = paymentInfos;
      } else if (paymentAmount) {
        bookPayload.paymentInfos = [{ amount: paymentAmount }];
      }

      console.log("[tj-v2] Book payload:", JSON.stringify(bookPayload).substring(0, 800));

      const bookRes = await tjFetch("/oms/v1/hotel/book", "POST", bookPayload, config.proxySecret);
      const bookText = await bookRes.text();
      console.log(`[tj-v2] Book response (${bookRes.status}): ${bookText.substring(0, 1000)}`);

      let bookData: any;
      try { bookData = JSON.parse(bookText); } catch {
        return jsonRes({ success: false, error: "Invalid booking response" }, 500);
      }

      if (!bookData?.status?.success) {
        return jsonRes({
          success: false,
          error: bookData?.errors?.[0]?.message || bookData?.error?.message || "Booking failed",
        });
      }

      return jsonRes({
        success: true,
        bookingId: bookData.bookingId || bookingId,
        note: "Booking initiated. Poll booking-status every 5s for up to 180s for confirmation.",
      });
    }

    // ══════════════════════════════════════════════════════════
    // CONFIRM BOOK — v2: POST /oms/v1/hotel/confirm-book
    // For hold bookings — confirm before deadline
    // ══════════════════════════════════════════════════════════
    if (action === "confirm-book") {
      const { bookingId, paymentInfos, paymentAmount } = body;
      if (!bookingId) {
        return jsonRes({ success: false, error: "Missing bookingId" }, 400);
      }

      const confirmPayload: any = { bookingId };
      if (paymentInfos) {
        confirmPayload.paymentInfos = paymentInfos;
      } else if (paymentAmount) {
        confirmPayload.paymentInfos = [{ amount: paymentAmount }];
      }

      const res = await tjFetch("/oms/v1/hotel/confirm-book", "POST", confirmPayload, config.proxySecret);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        return jsonRes({ success: false, error: "Invalid response" }, 500);
      }

      if (!data?.status?.success) {
        return jsonRes({ success: false, error: data?.errors?.[0]?.message || "Confirm booking failed" });
      }

      return jsonRes({ success: true, bookingId: data.bookingId || bookingId });
    }

    // ══════════════════════════════════════════════════════════
    // BOOKING STATUS — v2: POST /oms/v1/hotel/booking-details
    // ══════════════════════════════════════════════════════════
    if (action === "booking-status") {
      const { bookingId } = body;
      if (!bookingId) {
        return jsonRes({ success: false, error: "Missing bookingId" }, 400);
      }

      const res = await tjFetch("/oms/v1/hotel/booking-details", "POST", { bookingId }, config.proxySecret);
      if (!res.ok) {
        const errText = await res.text();
        return jsonRes({ success: false, error: `Status check failed: ${res.status}` }, 400);
      }

      const data = await res.json();
      if (!data?.status?.success) {
        return jsonRes({ success: false, error: data?.errors?.[0]?.message || "Status check failed" });
      }

      const order = data.order;
      const hotelInfo = data.itemInfos?.HOTEL?.hInfo;

      return jsonRes({
        success: true,
        order: {
          bookingId: order?.bookingId || bookingId,
          status: mapTripjackBookingStatus(order?.status || "PENDING"),
          rawStatus: order?.status || "PENDING",
          amount: order?.amount || 0,
          createdAt: order?.createdOn || new Date().toISOString(),
          hotel: hotelInfo ? {
            name: hotelInfo.name,
            rating: hotelInfo.rt,
            address: hotelInfo.ad,
            uid: hotelInfo.uid,
            options: (hotelInfo.ops || []).map(mapV2Option),
          } : {},
        },
        gstInfo: data.gstInfo || {},
      });
    }

    // ══════════════════════════════════════════════════════════
    // CANCEL — v2: POST /oms/v1/hotel/cancel-booking/{bookingId}
    // ══════════════════════════════════════════════════════════
    if (action === "cancel") {
      const { bookingId } = body;
      if (!bookingId) {
        return jsonRes({ success: false, error: "Missing bookingId" }, 400);
      }

      console.log(`[tj-v2] cancel: bookingId=${bookingId}`);

      // v2 cancel uses path parameter, no request body
      const cancelRes = await tjFetch(`/oms/v1/hotel/cancel-booking/${bookingId}`, "POST", undefined, config.proxySecret);
      const cancelText = await cancelRes.text();
      console.log(`[tj-v2] Cancel response (${cancelRes.status}): ${cancelText.substring(0, 1000)}`);

      let cancelData: any;
      try { cancelData = JSON.parse(cancelText); } catch {
        return jsonRes({ success: false, error: "Invalid cancellation response" }, 500);
      }

      if (!cancelData?.status?.success) {
        return jsonRes({
          success: false,
          error: cancelData?.errors?.[0]?.message || cancelData?.error?.message || "Cancellation failed",
        });
      }

      // Check status via booking-details after a delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const statusRes = await tjFetch("/oms/v1/hotel/booking-details", "POST", { bookingId }, config.proxySecret);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData?.status?.success) {
            const updatedStatus = statusData?.order?.status;
            const mapped = mapTripjackBookingStatus(updatedStatus || "CANCELLATION_PENDING");
            return jsonRes({
              success: true,
              status: mapped,
              rawStatus: updatedStatus,
              message: updatedStatus === "CANCELLED"
                ? "Booking cancelled successfully"
                : "Cancellation is being processed. Please check status again in a few minutes.",
            });
          }
        }
      } catch { /* ignore follow-up check error */ }

      return jsonRes({
        success: true,
        status: "cancellation_pending",
        rawStatus: "CANCELLATION_PENDING",
        message: "Cancellation is being processed. Poll booking-status once per day.",
      });
    }

    // ══════════════════════════════════════════════════════════
    // STATIC DETAIL — uses local DB (no v3 endpoint needed)
    // ══════════════════════════════════════════════════════════
    if (action === "static-detail") {
      const { hid } = body;
      if (!hid) {
        return jsonRes({ success: false, error: "Missing hid" }, 400);
      }

      const sb = getSupabaseAdmin();
      const { data: hotel } = await sb
        .from("tripjack_hotels")
        .select("*")
        .eq("tj_hotel_id", Number(hid))
        .maybeSingle();

      if (!hotel) {
        return jsonRes({ success: false, error: "Hotel not found in static data" }, 404);
      }

      const images = (hotel.images || []).map((i: any) => ({
        url: typeof i === "string" ? i : i?.url || "",
        caption: typeof i === "string" ? "" : i?.caption || "",
        isHero: typeof i === "string" ? false : i?.is_hero_image || false,
      })).filter((i: any) => i.url);

      return jsonRes({
        success: true,
        tjHotelId: hotel.tj_hotel_id,
        unicaId: hotel.unica_id,
        name: hotel.name,
        heroImage: hotel.hero_image_url || images[0]?.url || null,
        images,
        rating: hotel.rating,
        propertyType: hotel.property_type,
        city: hotel.city_name,
        country: hotel.country_name,
        address: hotel.address,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        facilities: hotel.facilities || [],
        description: hotel.description || {},
        contact: hotel.contact || {},
      });
    }

    // ══════════════════════════════════════════════════════════
    // SYNC HOTELS — v2: POST /hms/v1/fetch-static-hotels
    // ══════════════════════════════════════════════════════════
    if (action === "sync-hotels") {
      const { maxPages = 10, freshStart = false, lastUpdateTime } = body;
      const sb = getSupabaseAdmin();

      // Load or reset sync state
      const { data: syncState } = await sb
        .from("tripjack_sync_state").select("*").eq("sync_type", "hotels").maybeSingle();

      let cursor: string | null = null;
      let totalHotelsProcessed = syncState?.total_hotels_synced || 0;
      let totalPagesProcessed = syncState?.pages_processed || 0;
      let totalCitiesSynced = syncState?.total_cities_synced || 0;

      if (freshStart) {
        cursor = null;
        totalHotelsProcessed = 0;
        totalPagesProcessed = 0;
        totalCitiesSynced = 0;
        // Delete old data to avoid stale/invalid IDs polluting search
        console.log("[sync] Fresh start: clearing old hotel data...");
        await sb.from("tripjack_hotels").delete().neq("tj_hotel_id", 0);
        await sb.from("tripjack_city_hotel_map").delete().neq("hotel_count", -1);
        console.log("[sync] Cleared tripjack_hotels and tripjack_city_hotel_map");
        await sb.from("tripjack_sync_state").upsert({
          sync_type: "hotels", status: "syncing", next_cursor: null,
          total_hotels_synced: 0, total_cities_synced: 0, pages_processed: 0,
          started_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null,
        }, { onConflict: "sync_type" });
      } else if (syncState?.next_cursor && (syncState.status === "paused" || syncState.status === "syncing")) {
        cursor = syncState.next_cursor;
        console.log(`[sync] Resuming from cursor: ${cursor?.substring(0, 20)}..., prev hotels: ${totalHotelsProcessed}`);
        await sb.from("tripjack_sync_state").upsert({
          sync_type: "hotels", status: "syncing", updated_at: new Date().toISOString(),
        }, { onConflict: "sync_type" });
      } else if (syncState?.status === "completed") {
        // Allow incremental re-sync if lastUpdateTime is provided (cron delta sync)
        if (lastUpdateTime) {
          cursor = null;
          console.log(`[sync] Incremental sync from lastUpdateTime=${lastUpdateTime}`);
          await sb.from("tripjack_sync_state").upsert({
            sync_type: "hotels", status: "syncing", next_cursor: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "sync_type" });
        } else {
          return jsonRes({
            success: true, totalHotelsProcessed: syncState.total_hotels_synced,
            pages: syncState.pages_processed, citiesSynced: syncState.total_cities_synced,
            complete: true, nextCursor: null, alreadyComplete: true,
            message: "Sync already completed. Use freshStart: true to re-sync or lastUpdateTime for incremental.",
          });
        }
      } else {
        await sb.from("tripjack_sync_state").upsert({
          sync_type: "hotels", status: "syncing", next_cursor: null,
          total_hotels_synced: 0, total_cities_synced: 0, pages_processed: 0,
          started_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null,
        }, { onConflict: "sync_type" });
      }

      let batchHotels = 0;
      let batchPages = 0;
      const citySets = new Map<string, { city: string; country: string; ids: Set<string> }>();
      const effectiveMaxPages = Math.min(maxPages, 10);

      for (let page = 0; page < effectiveMaxPages; page++) {
        const payload: any = {};
        if (cursor) payload.next = cursor;
        if (lastUpdateTime) payload.lastUpdateTime = lastUpdateTime;

        let res: Response;
        try {
          res = await tjFetch("/hms/v1/fetch-static-hotels", "POST", payload, config.proxySecret);
        } catch (err) {
          console.error(`Sync page ${page + 1} fetch error:`, err);
          break;
        }

        if (!res.ok) {
          console.error(`Sync page ${page + 1}: HTTP ${res.status}`);
          break;
        }

        let pageData: any;
        try { pageData = await res.json(); } catch {
          console.error(`Sync page ${page + 1}: Invalid JSON`);
          break;
        }

        if (!pageData?.status?.success) {
          console.log(`Sync page ${page + 1}: API says no more data`);
          cursor = null;
          break;
        }

        const hotels = pageData?.hotelOpInfos || [];
        if (hotels.length === 0) { cursor = null; break; }

        // v2 static response format: hotelOpInfos[].{name, description, rating, geolocation, address, cityName, countryName, images, facilities, propertyType, contact, hotelId, isDeleted}
        const upsertData = hotels.filter((h: any) => !h.isDeleted).map((h: any) => {
          // v2 images: [{url, sz}]
          const rawImages = h.images || [];
          const images = rawImages.map((img: any) => ({
            url: img.url || "",
            caption: img.alt || "",
            is_hero_image: false,
            size: img.sz || "",
          })).filter((i: any) => i.url);

          const firstImageUrl = images[0]?.url || null;

          return {
            // v2 API: hotelId is the ONLY ID in static data and is what goes into search hids
            tj_hotel_id: Number(h.hotelId) || 0,
            unica_id: null,
            name: h.name || "",
            rating: h.rating || 0,
            property_type: h.propertyType || "Hotel",
            city_name: h.cityName || h.address?.city?.name || "",
            city_code: h.address?.city?.code || "",
            state_name: h.address?.state?.name || "",
            country_name: h.countryName || h.address?.country?.name || "",
            country_code: h.address?.country?.code || "",
            latitude: h.geolocation?.lt ? parseFloat(h.geolocation.lt) : null,
            longitude: h.geolocation?.ln ? parseFloat(h.geolocation.ln) : null,
            address: h.address?.adr || "",
            postal_code: h.address?.postalCode || "",
            image_url: firstImageUrl,
            hero_image_url: firstImageUrl,
            images: images,
            facilities: h.facilities || [],
            description: typeof h.description === "string" ? { raw: h.description } : (h.description || {}),
            contact: h.contact || {},
            is_deleted: false,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }).filter((h: any) => h.tj_hotel_id > 0);

        if (upsertData.length > 0) {
          const CHUNK = 20;
          for (let ci = 0; ci < upsertData.length; ci += CHUNK) {
            const chunk = upsertData.slice(ci, ci + CHUNK);
            const { error: upsertError } = await sb
              .from("tripjack_hotels").upsert(chunk, { onConflict: "tj_hotel_id", ignoreDuplicates: false });
            if (upsertError) {
              console.error(`Sync page ${page + 1} chunk ${Math.floor(ci / CHUNK) + 1} upsert error:`, upsertError.message);
            }
          }
        }

        // Mark deleted hotels
        const deletedIds = hotels.filter((h: any) => h.isDeleted).map((h: any) => Number(h.hotelId)).filter(Boolean);
        if (deletedIds.length > 0) {
          await sb.from("tripjack_hotels").update({ is_deleted: true, updated_at: new Date().toISOString() })
            .in("tj_hotel_id", deletedIds);
        }

        // Collect city-to-hotel mappings
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

        batchHotels += hotels.length;
        batchPages++;
        totalHotelsProcessed += hotels.length;
        totalPagesProcessed++;
        cursor = pageData.next || null;

        await sb.from("tripjack_sync_state").upsert({
          sync_type: "hotels",
          status: cursor ? "syncing" : "completed",
          next_cursor: cursor,
          total_hotels_synced: totalHotelsProcessed,
          total_cities_synced: totalCitiesSynced,
          pages_processed: totalPagesProcessed,
          updated_at: new Date().toISOString(),
          ...(!cursor ? { completed_at: new Date().toISOString() } : {}),
        }, { onConflict: "sync_type" });

        console.log(`[sync] Page ${totalPagesProcessed}: ${hotels.length} hotels, cursor=${cursor ? 'yes' : 'none'}`);
        if (!cursor) break;
      }

      // Update city-to-hotel-ID mapping table
      let batchCities = 0;
      for (const [, { city, country, ids: idSet }] of citySets) {
        const newIds = Array.from(idSet);
        const { data: existing } = await sb
          .from("tripjack_city_hotel_map").select("hotel_ids")
          .eq("city_name", city).eq("country_name", country).maybeSingle();

        const existingIds = existing?.hotel_ids || [];
        const mergedIds = [...new Set([...existingIds, ...newIds])];

        await sb.from("tripjack_city_hotel_map").upsert(
          { city_name: city, country_name: country, hotel_ids: mergedIds, hotel_count: mergedIds.length, updated_at: new Date().toISOString() },
          { onConflict: "city_name,country_name" }
        );
        batchCities++;
      }

      totalCitiesSynced += batchCities;
      const isComplete = !cursor;

      // When sync completes, rebuild the entire city map to eliminate stale IDs
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
        // Clear stale search cache
        await sb.from("hotel_search_cache").delete().lt("expires_at", new Date(Date.now() + 86400000).toISOString());
        console.log("[sync] Cleared hotel search cache after full sync");
      }

      await sb.from("tripjack_sync_state").upsert({
        sync_type: "hotels", status: isComplete ? "completed" : "paused",
        next_cursor: cursor, total_hotels_synced: totalHotelsProcessed,
        total_cities_synced: totalCitiesSynced, pages_processed: totalPagesProcessed,
        updated_at: new Date().toISOString(),
        ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
      }, { onConflict: "sync_type" });

      return jsonRes({
        success: true, totalHotelsProcessed, batchHotels,
        pages: totalPagesProcessed, batchPages, citiesSynced: totalCitiesSynced,
        complete: isComplete, nextCursor: cursor || null,
        status: isComplete ? "completed" : "paused",
      });
    }

    // ── SYNC STATUS ──
    if (action === "sync-status") {
      const sb = getSupabaseAdmin();
      const { data } = await sb.from("tripjack_sync_state").select("*").eq("sync_type", "hotels").maybeSingle();
      return jsonRes({
        success: true,
        ...(data || { status: "idle", total_hotels_synced: 0, pages_processed: 0, total_cities_synced: 0 }),
      });
    }

    // ── BACKFILL CITY MAP ──
    if (action === "backfill-city-map") {
      const sb = getSupabaseAdmin();
      console.log("[backfill] Calling SQL function backfill_tripjack_city_map()...");

      const { data, error } = await sb.rpc("backfill_tripjack_city_map");
      if (error) {
        console.error("[backfill] SQL function error:", error.message);
        return jsonRes({ success: false, error: error.message }, 500);
      }

      console.log("[backfill] Complete:", JSON.stringify(data));

      await sb.from("tripjack_sync_state").upsert({
        sync_type: "hotels", status: "paused",
        total_hotels_synced: data?.hotels || 0, total_cities_synced: data?.cities || 0,
        pages_processed: Math.ceil((data?.hotels || 0) / 100), updated_at: new Date().toISOString(),
      }, { onConflict: "sync_type" });

      return jsonRes({ success: true, ...data, complete: true });
    }

    return jsonRes({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[tj-v2] Unhandled error:", err);
    return jsonRes({ success: false, error: err.message || "Internal error" }, 500);
  }
});
