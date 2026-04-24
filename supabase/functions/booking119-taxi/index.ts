// Booking119 (RapidAPI) — Taxi / Airport Transfer search
// Uses Google Places API for Place ID resolution (cached in DB)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RAPIDAPI_HOST = "booking119.p.rapidapi.com";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getConfig() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("api_settings")
    .select("is_active, settings")
    .eq("provider", "booking119_taxi")
    .maybeSingle();

  const isActive = data?.is_active ?? false;

  let apiKey = "";
  const { data: vaultKey } = await sb.rpc("read_provider_secret", { p_name: "booking119_taxi_rapidapi_key" });
  if (vaultKey) apiKey = vaultKey;
  if (!apiKey) apiKey = Deno.env.get("RAPIDAPI_KEY") || "";

  return { isActive, apiKey };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Google Places API — resolve Place ID (with DB cache) ──

interface PlaceResult { placeId: string; name: string; lat: number; lng: number }

async function resolveGooglePlaceId(query: string): Promise<PlaceResult | null> {
  const sb = getSupabaseAdmin();
  const normalizedQuery = query.trim().toLowerCase();

  // 1. Check cache — no TTL, only re-resolve if fail_count >= 3
  const { data: cached } = await sb
    .from("google_place_id_cache")
    .select("place_id, name, lat, lng, fail_count")
    .eq("query", normalizedQuery)
    .maybeSingle();

  if (cached?.place_id && (cached.fail_count || 0) < 3) {
    console.log(`[PlaceID] Cache HIT: "${query}" → ${cached.place_id}`);
    // Update last_used_at (fire-and-forget)
    sb.from("google_place_id_cache").update({ last_used_at: new Date().toISOString() }).eq("query", normalizedQuery).then(() => {});
    return { placeId: cached.place_id, name: cached.name || query, lat: cached.lat || 0, lng: cached.lng || 0 };
  }

  // 2. Need to resolve — call Google Places API
  const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!googleKey) {
    console.error("[PlaceID] GOOGLE_MAPS_API_KEY not configured");
    // If we have a stale cached entry, use it anyway
    if (cached?.place_id) return { placeId: cached.place_id, name: cached.name || query, lat: cached.lat || 0, lng: cached.lng || 0 };
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,geometry&key=${googleKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[PlaceID] Google API HTTP ${res.status}`);
      if (cached?.place_id) return { placeId: cached.place_id, name: cached.name || query, lat: cached.lat || 0, lng: cached.lng || 0 };
      return null;
    }
    const data = await res.json();
    
    if (data.status !== "OK" || !data.candidates?.length) {
      console.warn(`[PlaceID] No results for "${query}": ${data.status}`);
      if (cached?.place_id) return { placeId: cached.place_id, name: cached.name || query, lat: cached.lat || 0, lng: cached.lng || 0 };
      return null;
    }

    const candidate = data.candidates[0];
    const placeId = candidate.place_id;
    const name = candidate.name || query;
    const lat = candidate.geometry?.location?.lat || 0;
    const lng = candidate.geometry?.location?.lng || 0;

    if (!placeId) return null;

    console.log(`[PlaceID] Google resolved "${query}" → ${placeId} (${name}, ${lat}, ${lng})`);

    // 3. Cache permanently (no TTL) — reset fail_count
    await sb.from("google_place_id_cache").upsert({
      query: normalizedQuery,
      place_id: placeId,
      name,
      lat,
      lng,
      fail_count: 0,
      last_used_at: new Date().toISOString(),
    }, { onConflict: "query" }).then(({ error }) => {
      if (error) console.warn("[PlaceID] Cache write failed:", error.message);
    });

    return { placeId, name, lat, lng };
  } catch (err: any) {
    if (cached?.place_id) return { placeId: cached.place_id, name: cached.name || query, lat: cached.lat || 0, lng: cached.lng || 0 };
    return null;
  }
}

// Mark a cached Place ID as failed (increment fail_count; at 3 it gets re-resolved)
async function markPlaceIdFailed(query: string) {
  const sb = getSupabaseAdmin();
  const normalizedQuery = query.trim().toLowerCase();
  await sb.rpc("execute_sql", {} as any).catch(() => {}); // no-op fallback
  // Direct increment via update
  const { data: row } = await sb
    .from("google_place_id_cache")
    .select("fail_count")
    .eq("query", normalizedQuery)
    .maybeSingle();
  if (row) {
    await sb.from("google_place_id_cache")
      .update({ fail_count: (row.fail_count || 0) + 1 })
      .eq("query", normalizedQuery);
    console.log(`[PlaceID] Marked "${query}" as failed (count: ${(row.fail_count || 0) + 1})`);
  }
}

// ── searchTaxi: get transfer quotes ──
async function searchTaxi(
  pickup: PlaceResult,
  dropoff: PlaceResult,
  pickupDate: string,
  pickupTime: string,
  passengers: number,
  currency: string,
  apiKey: string
): Promise<any> {
  const params = new URLSearchParams({
    pick_up_place_id: pickup.placeId,
    drop_off_place_id: dropoff.placeId,
    pick_up_date: pickupDate,
    pick_up_time: pickupTime,
    currency_code: currency,
    pick_up_latitude: String(pickup.lat),
    pick_up_longitude: String(pickup.lng),
    drop_off_latitude: String(dropoff.lat),
    drop_off_longitude: String(dropoff.lng),
  });

  const url = `https://${RAPIDAPI_HOST}/api/v1/taxi/searchTaxi?${params.toString()}`;
  console.log(`[Booking119Taxi] searchTaxi: ${url}`);

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Booking119Taxi] searchTaxi error:", res.status, text);
    // If 400/422 error, the place IDs may be invalid — mark them for re-resolution
    if (res.status === 400 || res.status === 422) {
      await Promise.all([
        markPlaceIdFailed(pickup.name),
        markPlaceIdFailed(dropoff.name),
      ]);
    }
    return null;
  }

  const body = await res.json();
  console.log(`[Booking119Taxi] searchTaxi response:`, JSON.stringify(body).slice(0, 2000));
  return body;
}

// ── Resolve a location to Google Place ID ──
async function resolveLocation(
  params: { iataCode?: string; address?: string; cityName?: string; placeId?: string; geoCode?: string }
): Promise<PlaceResult | null> {
  // If Google Place ID + coords already provided
  if (params.placeId && params.geoCode) {
    const [lat, lng] = params.geoCode.split(",").map(Number);
    if (lat && lng) return { placeId: params.placeId, name: params.placeId, lat, lng };
  }

  // If Place ID provided without coords, still valid
  if (params.placeId && params.placeId.startsWith("ChIJ")) {
    // We have a place ID but need coords — use Google Places Details
    // For now, just use it with 0,0 coords (searchTaxi uses place_id primarily)
    return { placeId: params.placeId, name: params.placeId, lat: 0, lng: 0 };
  }

  // Build search query
  let query = "";
  if (params.address) {
    query = params.address;
  } else if (params.iataCode) {
    query = `${params.iataCode} Airport`;
  } else if (params.cityName) {
    query = params.cityName;
  }

  if (!query) return null;

  // Resolve via Google Places API (with cache)
  return resolveGooglePlaceId(query);
}

// ── Normalize results to unified transfer format ──
// Real response: data.journeys[].legs[].results[]
function normalizeOffers(data: any, currency: string): any[] {
  if (!data?.status || !data?.data) return [];

  // Extract results from the real nested structure
  const journeys = data.data?.journeys || [];
  const allResults: any[] = [];
  let legMeta: any = null;

  for (const journey of journeys) {
    for (const leg of (journey.legs || [])) {
      if (!legMeta) legMeta = leg; // capture pickup/dropoff metadata
      for (const r of (leg.results || [])) {
        allResults.push({ ...r, _leg: leg });
      }
    }
  }

  if (!allResults.length) {
    console.warn("[Booking119Taxi] No results in journeys structure");
    return [];
  }

  return allResults.map((v: any, idx: number) => {
    const leg = v._leg;
    const pickup = leg?.pickupLocation;
    const dropoff = leg?.dropoffLocation;

    return {
      id: `b119_${v.resultReference || idx}_${Date.now()}`,
      source: "booking119",
      transferType: "PRIVATE",
      vehicle: {
        category: v.carDetails?.description || v.type || "Standard",
        description: v.carDetails?.modelDescription || v.carDetails?.model || "",
        image: v.imageUrl || "",
        seats: parseInt(v.maxPassenger) || 3,
        baggages: v.bags || 2,
      },
      provider: {
        code: "booking119",
        name: v.supplierName || "Transfer Provider",
        logo: "",
      },
      price: typeof v.price === "number" ? v.price : parseFloat(v.price) || 0,
      currency: v.currency || currency,
      isEstimated: false,
      pickup: {
        dateTime: v.predictedPickupDateTime || leg?.requestedPickupDateTime || null,
        locationCode: pickup?.airportCode || null,
        address: pickup?.name || null,
      },
      dropoff: {
        dateTime: null,
        address: dropoff?.name || null,
        locationCode: dropoff?.airportCode || null,
      },
      duration: v.duration ? `${v.duration} min` : null,
      durationMinutes: v.duration || null,
      distance: v.drivingDistance ? { value: v.drivingDistance, unit: "km" } : null,
      cancellationRules: v.twentyFourHourCancellation
        ? [{ description: `Free cancellation up to ${Math.round((v.cancellationLeadTimeMinutes || 1440) / 60)}h before pickup` }]
        : v.nonRefundable ? [{ description: "Non-refundable" }] : [],
      meetAndGreet: v.meetAndGreet ?? false,
      bookingLink: v.link || null,
      searchReference: leg?.searchReference || null,
      resultReference: v.resultReference || null,
      originalPrice: v.originalPrice || null,
      discountPercentage: v.priceDiscountPercentage || 0,
      _raw: v,
    };
  });
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "search";
    const { isActive, apiKey } = await getConfig();

    if (!isActive) {
      return json({ success: false, error: "Booking119 Taxi not enabled" }, 400);
    }
    if (!apiKey) {
      return json({ success: false, error: "RapidAPI key not configured" }, 500);
    }

    if (action === "search") {
      // Resolve pickup location (Google Place ID)
      const pickup = await resolveLocation({
        iataCode: body.pickupAirport || body.startLocationCode,
        address: body.pickupAddress,
        cityName: body.pickupCity,
        placeId: body.pickupPlaceId,
      });

      // Resolve dropoff location (Google Place ID)
      const dropoff = await resolveLocation({
        iataCode: body.dropoffAirport || body.endLocationCode,
        address: body.dropoffAddress || body.endAddressLine,
        cityName: body.dropoffCity || body.endCityName,
        placeId: body.dropoffPlaceId,
      });

      if (!pickup || !dropoff) {
        console.warn(`[Booking119Taxi] Could not resolve locations: pickup=${!!pickup}, dropoff=${!!dropoff}`);
        return json({ success: true, offers: [], count: 0, message: "Could not resolve pickup/dropoff locations to Google Place IDs" });
      }

      // Extract date and time
      let pickupDate = body.pickupDate || "";
      let pickupTime = body.pickupTime || "10:00";

      if (!pickupDate && (body.pickupDateTime || body.startDateTime)) {
        const dt = body.pickupDateTime || body.startDateTime;
        pickupDate = dt.split("T")[0];
        const timePart = dt.split("T")[1];
        if (timePart) pickupTime = timePart.substring(0, 5);
      }

      if (!pickupDate) {
        return json({ success: false, error: "Missing pickup date" }, 400);
      }

      const currency = body.currency || "USD";
      const passengers = body.passengers || 2;

      const result = await searchTaxi(pickup, dropoff, pickupDate, pickupTime, passengers, currency, apiKey);
      const offers = normalizeOffers(result, currency);
      console.log(`[Booking119Taxi] Found ${offers.length} offers`);

      return json({
        success: true,
        offers,
        count: offers.length,
        _debug: { pickup, dropoff, pickupDate, pickupTime },
      });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[Booking119Taxi] Error:", err.message);
    return json({ success: false, error: err.message }, 500);
  }
});
