import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Transfer Detection Patterns ──
const TRANSFER_PATTERNS = [
  /airport\s*transfer/i, /airport\s*pickup/i, /airport\s*drop/i,
  /private\s*transfer/i, /shared\s*transfer/i, /hotel\s*transfer/i,
  /chauffeur/i, /intercity\s*transfer/i, /speedboat\s*transfer/i,
  /seaplane/i, /resort\s*transfer/i, /port\s*transfer/i,
  /station\s*transfer/i, /ferry\s*transfer/i, /limousine/i,
  /private\s*car/i,
  /(?:to|from)\s+(?:airport|hotel|resort|port|station)/i,
  /pick[\s-]?up.*(?:airport|hotel)/i, /drop[\s-]?off.*(?:airport|hotel)/i,
];

function isTransferProduct(name: string): boolean {
  return TRANSFER_PATTERNS.some(p => p.test(name));
}

// ── Resort Destination Detection ──
// ONLY true island resorts without airports (or where boat is the only access method)
// Cities/islands WITH airports (e.g., Langkawi, Phuket, Bali) are NOT resort destinations
// for transport purposes — flights should be used instead.
const RESORT_DESTINATIONS = [
  "maldives", "bora bora", "fiji", "seychelles", "mauritius",
  "tahiti", "phi phi", "zanzibar",
];

// Destinations that have airports — NEVER assign speedboat/ferry for inter-city transport
const HAS_AIRPORT = new Set([
  "langkawi", "penang", "phuket", "bali", "ko samui", "koh samui",
  "krabi", "santorini", "cebu", "boracay",
]);

function isResortDestination(city: string, country: string): boolean {
  const combined = `${city} ${country}`.toLowerCase();
  // If the city has an airport, it's NOT a resort destination for transport
  if (HAS_AIRPORT.has(city.toLowerCase().trim())) return false;
  return RESORT_DESTINATIONS.some(r => combined.includes(r));
}

// ── Vehicle Class Recommendation ──
function recommendVehicle(passengers: number, luggage: string): string {
  if (passengers <= 2) return luggage === "heavy" ? "premium_suv" : "standard_sedan";
  if (passengers <= 4) return "family_mpv";
  if (passengers <= 6) return "premium_suv";
  return "private_van";
}

// ── Route Key Builder ──
function buildRouteKey(t: any): string {
  return [
    t.pickup_type || "airport",
    t.pickup_code || t.pickup_name || "unknown",
    t.dropoff_type || "hotel",
    t.dropoff_code || t.dropoff_name || "unknown",
    t.city || "unknown",
    t.passengers || 2,
    t.vehicle_class || "auto",
    t.time_bucket || "daytime",
  ].join("|").toLowerCase().replace(/\s+/g, "_");
}

// ── AI Estimation via Lovable AI ──
// Enhanced with real distance/duration data when available
async function aiEstimateTransfer(transfer: any, _currency: string): Promise<any | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("[resolve-transfers] LOVABLE_API_KEY not configured, skipping AI estimation");
    return null;
  }

  // Build context with distance data if available
  const distanceContext = transfer.distance_km
    ? `\nKnown distance: ${transfer.distance_km.toFixed(1)} km (calculated from real coordinates)`
    : "";
  const durationContext = transfer.estimated_duration_minutes
    ? `\nEstimated drive time: ${transfer.estimated_duration_minutes} minutes`
    : "";
  const hotelContext = transfer.hotel_name
    ? `\nActual hotel: ${transfer.hotel_name}`
    : "";
  const airportContext = transfer.airport_name
    ? `\nActual airport: ${transfer.airport_name}`
    : "";

  const prompt = `You are a travel logistics pricing expert. Estimate the cost of a private airport transfer.

IMPORTANT PRICING GUIDELINES:
- Airport transfers are simple point-to-point car rides, NOT city tours
- Typical airport transfer prices worldwide:
  * Short distance (<15km): $15-35 USD
  * Medium distance (15-40km): $25-55 USD  
  * Long distance (40-80km): $40-80 USD
  * Very long (80km+): $60-120 USD
- Southeast Asia is generally 30-50% cheaper than Western prices
- These are arranged private transfers with a sedan, not luxury limousines

Route: ${transfer.pickup_name || transfer.pickup_code || "Airport"} → ${transfer.dropoff_name || transfer.dropoff_code || "Hotel"}
City: ${transfer.city}, ${transfer.country}${distanceContext}${durationContext}${hotelContext}${airportContext}
Passengers: ${transfer.passengers || 2} (${transfer.adults || 2} adults, ${transfer.children || 0} children, ${transfer.infants || 0} infants)
Transfer type: ${transfer.transfer_type || "airport_hotel"}
Vehicle: ${transfer.vehicle_class || "auto"}
Time: ${transfer.time_bucket || "daytime"}

Provide a JSON response with:
- total_price_usd: estimated total price in USD (realistic private car transfer, NOT a tour)
- duration_minutes: estimated travel time
- mode: vehicle/transport mode (e.g. "private_car")
- vehicle_class: one of standard_sedan, family_mpv, premium_suv, private_van
- confidence: 0.0-1.0
- reason: one-sentence explanation
- is_mandatory: boolean
- tags: array of relevant tags
- policies: { baggage: string, meeting_point: string }`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a travel transfer pricing engine. Return ONLY valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "estimate_transfer",
            description: "Return structured transfer estimation",
            parameters: {
              type: "object",
              properties: {
                total_price_usd: { type: "number" },
                duration_minutes: { type: "number" },
                mode: { type: "string" },
                vehicle_class: { type: "string" },
                confidence: { type: "number" },
                reason: { type: "string" },
                is_mandatory: { type: "boolean" },
                tags: { type: "array", items: { type: "string" } },
                policies: {
                  type: "object",
                  properties: {
                    baggage: { type: "string" },
                    meeting_point: { type: "string" },
                  },
                },
              },
              required: ["total_price_usd", "duration_minutes", "mode", "vehicle_class", "confidence", "reason"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "estimate_transfer" } },
      }),
    });

    if (!resp.ok) {
      console.error(`[resolve-transfers] AI estimation failed: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;

    const est = JSON.parse(toolCall.function.arguments);
    
    // Reject if AI returned no meaningful price
    if (!est.total_price_usd || est.total_price_usd <= 0) {
      console.warn("[resolve-transfers] AI returned zero/null price, skipping");
      return null;
    }

    // Validate vehicle/mode — override nonsensical water/air vehicles for land-based transfers
    const isResort = isResortDestination(transfer.city || "", transfer.country || "");
    let mode = est.mode || "private_car";
    let vehicleClass = est.vehicle_class || "standard_sedan";
    if (!isResort && ["resort_speedboat", "speedboat", "seaplane", "domestic_flight_boat", "boat", "ferry"].includes(mode)) {
      mode = "private_car";
    }
    if (!isResort && ["resort_speedboat", "speedboat", "seaplane", "domestic_flight_boat"].includes(vehicleClass)) {
      vehicleClass = recommendVehicle(transfer.passengers || 2, transfer.luggage_class || "standard");
    }
    
    return {
      total_price: est.total_price_usd,
      currency: "USD",
      duration_minutes: est.duration_minutes || 35,
      mode,
      vehicle_class: vehicleClass,
      confidence_score: est.confidence || 0.6,
      reason_text: est.reason || "Arranged private transfer",
      is_mandatory: est.is_mandatory || false,
      tags: est.tags || [],
      policies: est.policies || {},
      pricing_source: "AI_ESTIMATED",
      price_accuracy: est.confidence >= 0.7 ? "MEDIUM" : "LOW",
      bookability: "arrange_manually",
    };
  } catch (e) {
    console.error("[resolve-transfers] AI estimation error:", e);
    return null;
  }
}

// baselineEstimate removed — no hardcoded prices

// ── Currency Conversion Helper ──
const defaultRates: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, BDT: 121, INR: 83.5, SGD: 1.34,
  MYR: 4.7, THB: 35.5, AED: 3.67, JPY: 155, AUD: 1.55, CAD: 1.37,
  MVR: 15.4, LKR: 310, PKR: 278, IDR: 15800, VND: 25300, KRW: 1350,
  CHF: 0.88, QAR: 3.64, SAR: 3.75, OMR: 0.385, BHD: 0.377,
};

function convertFromUSD(usd: number, toCurrency: string): number {
  const rate = defaultRates[toCurrency] || 1;
  return Math.round(usd * rate);
}

// ── Product Match Logic ──
// MAX_TRANSFER_PRICE_USD: airport transfers should never cost this much
const MAX_TRANSFER_PRICE_USD = 120;

function matchTransferProducts(transfer: any, products: any[], targetCurrency: string): any | null {
  if (!products || products.length === 0) return null;

  const transferProducts = products.filter(p => isTransferProduct(p.name || ""));
  if (transferProducts.length === 0) return null;

  const cityNorm = (transfer.city || "").toLowerCase();

  // Filter by city
  const cityMatches = transferProducts.filter(p => {
    const pCity = (p._searchCity || p.city || "").toLowerCase();
    return pCity.includes(cityNorm) || cityNorm.includes(pCity);
  });

  const pool = cityMatches.length > 0 ? cityMatches : transferProducts;

  // Score each product
  let bestProduct: any = null;
  let bestScore = 0;

  for (const p of pool) {
    const name = (p.name || "").toLowerCase();
    let score = 0;

    // Reject products that are clearly tours, not transfers
    // Tours typically have "tour", "day trip", "sightseeing" in the name
    if (/(?:day\s*trip|sightseeing|guided\s*tour|city\s*tour|full\s*day|half\s*day)/i.test(name)) {
      continue; // Skip — this is a tour product, not a transfer
    }

    // Price sanity check — convert product price to USD for comparison
    const productPriceUsd = estimatePriceInUsd(p.price || 0, p.currency || targetCurrency);
    if (productPriceUsd > MAX_TRANSFER_PRICE_USD) {
      console.log(`[resolve-transfers] ⚠️ Rejecting product "${p.name}" — price $${productPriceUsd.toFixed(0)} USD exceeds transfer max`);
      continue; // Way too expensive for a simple transfer
    }

    // Transfer type match
    if (transfer.transfer_type === "airport_hotel" || transfer.position === "arrival") {
      if (name.includes("airport") && (name.includes("hotel") || name.includes("city"))) score += 3;
      if (name.includes("pickup") || name.includes("arrival")) score += 2;
    }
    if (transfer.position === "departure") {
      if (name.includes("drop") || name.includes("departure")) score += 2;
    }

    // Private vs shared preference
    if (name.includes("private")) score += 1;
    if (name.includes("shared") && (transfer.passengers || 2) <= 2) score += 0.5;

    // Vehicle suitability
    if ((transfer.passengers || 2) > 4 && (name.includes("van") || name.includes("mpv"))) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestProduct = p;
    }
  }

  // Only accept if we got a meaningful match with a decent score
  if (!bestProduct || bestScore < 1) return null;

  return bestProduct;
}

// Convert price to approximate USD for sanity checking
function estimatePriceInUsd(price: number, currency: string): number {
  const rate = defaultRates[currency] || 1;
  return price / rate;
}

// ── Main Handler ──
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transfers, currency, available_products } = await req.json();

    if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
      return new Response(JSON.stringify({ error: "transfers array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const targetCurrency = currency || "USD";

    let cacheHits = 0;
    let apiCalls = 0;
    let estimationCount = 0;

    const resolvedTransfers: any[] = [];

    for (const t of transfers) {
      const routeKey = buildRouteKey(t);
      console.log(`[resolve-transfers] Processing: ${routeKey}`);

      // ── Check Cache ──
      const { data: cached } = await sb
        .from("transfer_route_cache")
        .select("*")
        .eq("route_key", routeKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log(`[resolve-transfers] ✅ Cache hit: ${routeKey}`);
        cacheHits++;
        const resolved = cached.resolved_data as any;
        // Convert currency if needed
        if (resolved.currency !== targetCurrency && resolved.currency === "USD") {
          resolved.total_price = convertFromUSD(resolved.total_price, targetCurrency);
          if (resolved.per_person_price) resolved.per_person_price = convertFromUSD(resolved.per_person_price, targetCurrency);
          resolved.currency = targetCurrency;
        }
        resolved.day_index = t.day_index;
        resolved.position = t.position;
        resolvedTransfers.push(resolved);
        continue;
      }

      // ── LEVEL 1: Call Unified Transfer Search API if providers are active ──
      const airportCode = t.pickup_type === "airport" ? t.pickup_code : t.dropoff_code;
      if (airportCode) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

          const hotelName = t.pickup_type === "hotel" ? t.pickup_name : t.dropoff_name;
          const hotelCity = t.city || "";

          // Build a reasonable pickup datetime (today + 7 days at daytime)
          const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const timeMap: Record<string, string> = { early_morning: "06:00", daytime: "10:00", evening: "18:00", late_night: "22:00" };
          const timeStr = timeMap[t.time_bucket || "daytime"] || "10:00";
          const pickupDateTime = `${futureDate.toISOString().split("T")[0]}T${timeStr}:00`;

          const searchBody: any = {
            action: "search",
            startLocationCode: t.pickup_type === "airport" ? airportCode : undefined,
            endLocationCode: t.dropoff_type === "airport" ? airportCode : undefined,
            endCityName: t.dropoff_type === "hotel" ? hotelCity : undefined,
            endAddressLine: t.dropoff_type === "hotel" ? hotelName : undefined,
            startDateTime: pickupDateTime,
            pickupDateTime: pickupDateTime,
            pickupAirport: t.pickup_type === "airport" ? airportCode : undefined,
            dropoffCity: t.dropoff_type === "hotel" ? hotelCity : undefined,
            dropoffAddress: t.dropoff_type === "hotel" ? hotelName : undefined,
            passengers: t.passengers || 2,
            currency: targetCurrency,
            transferType: "PRIVATE",
          };

          const apiRes = await fetch(`${supabaseUrl}/functions/v1/unified-transfer-search`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify(searchBody),
          });

          if (apiRes.ok) {
            const apiData = await apiRes.json();
            const offers = apiData?.transfers || [];
            if (offers.length > 0) {
              const best = offers[0]; // Already sorted by price
              const pax = t.passengers || 2;
              console.log(`[resolve-transfers] ✅ LIVE API hit: ${offers.length} offers for ${routeKey}, best=${best.price} ${best.currency}`);
              apiCalls++;

              const normalized: any = {
                id: `tf-${crypto.randomUUID().slice(0, 8)}`,
                title: `${best.provider?.name || "Private"} Transfer · ${best.vehicle?.category || "Sedan"}`,
                transfer_type: t.transfer_type || "airport_hotel",
                mode: "private_car",
                vehicle_class: best.vehicle?.category?.toLowerCase()?.includes("van") ? "private_van"
                  : best.vehicle?.category?.toLowerCase()?.includes("mpv") ? "family_mpv"
                  : best.vehicle?.category?.toLowerCase()?.includes("suv") ? "premium_suv"
                  : "standard_sedan",
                duration_minutes: best.duration ? parseInt(best.duration) || 30 : 30,
                pricing_source: "UNIFIED_API",
                price_accuracy: best.isEstimated ? "HIGH" : "EXACT",
                currency: best.currency || targetCurrency,
                total_price: Math.round(best.price || 0),
                is_roundtrip: false,
                tags: ["live_price", best.source || "api"],
                reason_text: `Live price from ${best.provider?.name || best.source || "transfer provider"}`,
                confidence_score: 0.95,
                is_mandatory: false,
                bookability: "live_bookable" as const,
                pickup_type: t.pickup_type,
                pickup_code: t.pickup_code,
                pickup_name: t.pickup_name,
                dropoff_type: t.dropoff_type,
                dropoff_code: t.dropoff_code,
                dropoff_name: t.dropoff_name,
                day_index: t.day_index,
                position: t.position,
                traveler_fit: pax <= 2 ? "Perfect for couple" : pax <= 4 ? "Suitable for family" : "Suitable for group",
                luggage_fit: `Up to ${best.vehicle?.baggages || 2} bags`,
                policies: {
                  cancellation: best.cancellationRules?.[0]?.freeRefund ? "Free cancellation" : "Non-refundable",
                },
              };

              // Cache live results for 24h
              await sb.from("transfer_route_cache").upsert({
                route_key: routeKey,
                pickup_type: t.pickup_type || "airport",
                pickup_code: t.pickup_code,
                pickup_name: t.pickup_name,
                dropoff_type: t.dropoff_type || "hotel",
                dropoff_code: t.dropoff_code,
                dropoff_name: t.dropoff_name,
                passenger_count: pax,
                luggage_class: t.luggage_class || "standard",
                vehicle_class: normalized.vehicle_class,
                time_bucket: t.time_bucket || "daytime",
                pricing_source: "UNIFIED_API",
                price_accuracy: normalized.price_accuracy,
                bookability: "live_bookable",
                currency: normalized.currency,
                total_price: normalized.total_price,
                transfer_type: t.transfer_type || "airport_hotel",
                mode: "private_car",
                duration_minutes: normalized.duration_minutes,
                is_roundtrip: false,
                is_mandatory: false,
                confidence_score: 0.95,
                recommendation_text: normalized.reason_text,
                tags: normalized.tags,
                resolved_data: normalized,
                country: t.country,
                city: t.city,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              }, { onConflict: "route_key" });

              resolvedTransfers.push(normalized);
              continue;
            }
          }
        } catch (apiErr) {
          console.warn(`[resolve-transfers] LEVEL 1 API error for ${routeKey}:`, apiErr);
          // Fall through to LEVEL 2
        }
      }

      // ── LEVEL 2: Product Match from available tour/activity inventory ──
      const productMatch = matchTransferProducts(t, available_products || [], targetCurrency);
      if (productMatch) {
        console.log(`[resolve-transfers] ✅ Product match: "${productMatch.name}" for ${routeKey}`);
        const pax = t.passengers || 2;
        const isResort = isResortDestination(t.city || "", t.country || "");

        const normalized: any = {
          id: `tf-${crypto.randomUUID().slice(0, 8)}`,
          title: productMatch.name,
          transfer_type: t.transfer_type || "airport_hotel",
          mode: isResort ? "resort_speedboat" : "private_car",
          vehicle_class: isResort ? "resort_speedboat" : recommendVehicle(pax, t.luggage_class || "standard"),
          duration_minutes: productMatch.duration ? parseInt(productMatch.duration) || 30 : 30,
          pricing_source: "PRODUCT_MATCH",
          price_accuracy: "HIGH",
          currency: targetCurrency,
          // Product prices from available_products are ALREADY in target currency — do NOT convert again
          total_price: productMatch.price ? Math.round(productMatch.price) : 0,
          per_person_price: productMatch.pricingType === "PER_PERSON" ? Math.round(productMatch.price || 0) : undefined,
          is_roundtrip: (productMatch.name || "").toLowerCase().includes("roundtrip") || (productMatch.name || "").toLowerCase().includes("round trip"),
          tags: ["matched", isResort ? "resort" : "private"],
          reason_text: `Matched to available product: ${productMatch.name}`,
          confidence_score: 0.85,
          is_mandatory: isResort,
          bookability: "likely_bookable" as const,
          pickup_type: t.pickup_type,
          pickup_code: t.pickup_code,
          pickup_name: t.pickup_name,
          dropoff_type: t.dropoff_type,
          dropoff_code: t.dropoff_code,
          dropoff_name: t.dropoff_name,
          product_code: productMatch.productCode || productMatch.product_code,
          product_name: productMatch.name,
          day_index: t.day_index,
          position: t.position,
          traveler_fit: pax <= 2 ? "Perfect for couple" : pax <= 4 ? "Suitable for family" : "Suitable for group",
          luggage_fit: "Standard luggage included",
        };

        // Cache it
        await sb.from("transfer_route_cache").upsert({
          route_key: routeKey,
          pickup_type: t.pickup_type || "airport",
          pickup_code: t.pickup_code,
          pickup_name: t.pickup_name,
          dropoff_type: t.dropoff_type || "hotel",
          dropoff_code: t.dropoff_code,
          dropoff_name: t.dropoff_name,
          passenger_count: pax,
          luggage_class: t.luggage_class || "standard",
          vehicle_class: normalized.vehicle_class,
          time_bucket: t.time_bucket || "daytime",
          pricing_source: "PRODUCT_MATCH",
          price_accuracy: "HIGH",
          bookability: "likely_bookable",
          currency: targetCurrency,
          total_price: Math.round(productMatch.price || 0),
          transfer_type: t.transfer_type || "airport_hotel",
          mode: normalized.mode,
          duration_minutes: normalized.duration_minutes,
          is_roundtrip: normalized.is_roundtrip,
          is_mandatory: normalized.is_mandatory,
          confidence_score: 0.85,
          recommendation_text: normalized.reason_text,
          tags: normalized.tags,
          resolved_data: normalized,
          country: t.country,
          city: t.city,
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "route_key" });

        resolvedTransfers.push(normalized);
        continue;
      }

      // ── LEVEL 3 & 4: AI Estimation (no hardcoded fallback) ──
      const estimation = await aiEstimateTransfer(t, targetCurrency);
      
      if (!estimation) {
        console.log(`[resolve-transfers] ⏭️ Skipping ${routeKey} — no live product and AI estimation failed`);
        continue;
      }

      estimationCount++;
      apiCalls++;

      const pax = t.passengers || 2;
      const normalized: any = {
        id: `tf-${crypto.randomUUID().slice(0, 8)}`,
        title: t.position === "arrival" ? "Arranged Airport Pickup"
          : t.position === "departure" ? "Hotel to Airport Drop-off"
          : t.position === "resort" ? "Resort Transfer"
          : "Private Transfer Arranged",
        transfer_type: t.transfer_type || "airport_hotel",
        mode: estimation.mode,
        vehicle_class: estimation.vehicle_class,
        duration_minutes: estimation.duration_minutes,
        pricing_source: estimation.pricing_source,
        price_accuracy: estimation.price_accuracy,
        currency: targetCurrency,
        total_price: convertFromUSD(estimation.total_price, targetCurrency),
        per_person_price: undefined,
        is_roundtrip: false,
        tags: estimation.tags || ["arranged"],
        reason_text: estimation.reason_text,
        confidence_score: estimation.confidence_score,
        is_mandatory: estimation.is_mandatory,
        bookability: estimation.bookability,
        policies: estimation.policies,
        pickup_type: t.pickup_type,
        pickup_code: t.pickup_code,
        pickup_name: t.pickup_name,
        dropoff_type: t.dropoff_type,
        dropoff_code: t.dropoff_code,
        dropoff_name: t.dropoff_name,
        day_index: t.day_index,
        position: t.position,
        traveler_fit: pax <= 2 ? "Perfect for couple" : pax <= 4 ? "Suitable for family" : "Suitable for group",
        luggage_fit: estimation.policies?.baggage || "Standard luggage included",
      };

      // Cache estimation
      await sb.from("transfer_route_cache").upsert({
        route_key: routeKey,
        pickup_type: t.pickup_type || "airport",
        pickup_code: t.pickup_code,
        pickup_name: t.pickup_name,
        dropoff_type: t.dropoff_type || "hotel",
        dropoff_code: t.dropoff_code,
        dropoff_name: t.dropoff_name,
        passenger_count: pax,
        luggage_class: t.luggage_class || "standard",
        vehicle_class: normalized.vehicle_class,
        time_bucket: t.time_bucket || "daytime",
        pricing_source: estimation.pricing_source,
        price_accuracy: estimation.price_accuracy,
        bookability: estimation.bookability,
        currency: "USD",
        total_price: estimation.total_price,
        transfer_type: t.transfer_type || "airport_hotel",
        mode: estimation.mode,
        duration_minutes: estimation.duration_minutes,
        is_roundtrip: false,
        is_mandatory: estimation.is_mandatory,
        confidence_score: estimation.confidence_score,
        recommendation_text: normalized.reason_text,
        tags: normalized.tags,
        resolved_data: normalized,
        country: t.country,
        city: t.city,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "route_key" });

      resolvedTransfers.push(normalized);
    }

    console.log(`[resolve-transfers] Done: ${resolvedTransfers.length} transfers resolved (${cacheHits} cached, ${apiCalls} API, ${estimationCount} estimated)`);

    return new Response(JSON.stringify({
      transfers: resolvedTransfers,
      cache_hits: cacheHits,
      api_calls: apiCalls,
      estimation_count: estimationCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[resolve-transfers] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
