// Unified Transfer Search — aggregates transfer providers (Amadeus + future)
// Similar architecture to unified-flight-search and unified-hotel-search

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Wire supplier-name mask: replaces known supplier identifiers with opaque
// codes so network payloads do not leak provider identity. Frontend hydrates
// via src/lib/transferWireAdapter.ts.
const TRANSFER_SOURCE_TO_CODE: Record<string, string> = {
  amadeus: "xa",
  booking119: "xb",
};
function maskTransferSourceValue(v: any): any {
  if (typeof v !== "string") return v;
  return TRANSFER_SOURCE_TO_CODE[v] || v;
}
function maskTransferWire(node: any): any {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = maskTransferWire(node[i]);
    return node;
  }
  for (const k of Object.keys(node)) {
    if (k === "source" || k === "api_source") {
      node[k] = maskTransferSourceValue(node[k]);
    } else if (typeof node[k] === "object") {
      node[k] = maskTransferWire(node[k]);
    }
  }
  return node;
}

function json(data: any, status = 200) {
  const masked = maskTransferWire(data);
  return new Response(JSON.stringify(masked), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Provider: Amadeus Transfer ──

async function searchAmadeus(params: any): Promise<any[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/amadeus-transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        action: "search",
        startLocationCode: params.pickupAirport || params.startLocationCode,
        endLocationCode: params.dropoffAirport || params.endLocationCode,
        endAddressLine: params.dropoffAddress || params.endAddressLine,
        endCityName: params.dropoffCity || params.endCityName,
        endGeoCode: params.dropoffGeoCode || params.endGeoCode,
        transferType: params.transferType || "PRIVATE",
        startDateTime: params.pickupDateTime || params.startDateTime,
        passengers: params.passengers || 1,
        currency: params.currency,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[UnifiedTransfer] Amadeus error:", res.status, text);
      return [];
    }

    const data = await res.json();
    if (!data?.success || !data.offers?.length) return [];

    // Normalize to unified format
    return data.offers.map((offer: any) => ({
      id: offer.id,
      source: "amadeus",
      transferType: offer.transferType,
      vehicle: {
        category: offer.vehicle?.category || "Standard",
        description: offer.vehicle?.description || "",
        image: offer.vehicle?.imageURL || "",
        seats: offer.vehicle?.seats || 0,
        baggages: offer.vehicle?.baggages || 0,
      },
      provider: {
        code: offer.serviceProvider?.code || "",
        name: offer.serviceProvider?.name || "Transfer Provider",
        logo: offer.serviceProvider?.logoUrl || "",
      },
      price: parseFloat(offer.quotation?.monetaryAmount || "0"),
      currency: offer.quotation?.currencyCode || params.currency || "USD",
      isEstimated: offer.quotation?.isEstimated ?? false,
      pickup: {
        dateTime: offer.start?.dateTime,
        locationCode: offer.start?.locationCode,
      },
      dropoff: {
        dateTime: offer.end?.dateTime,
        locationCode: offer.end?.locationCode,
        address: offer.end?.address,
      },
      duration: offer.duration,
      distance: offer.distance,
      cancellationRules: offer.cancellationRules || [],
      _raw: offer._raw, // Keep raw for booking
    }));
  } catch (err) {
    console.error("[UnifiedTransfer] Amadeus exception:", err);
    return [];
  }
}

// ── Provider: Booking119 Taxi ──

async function searchBooking119(params: any): Promise<any[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/booking119-taxi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        action: "search",
        pickupAirport: params.pickupAirport || params.startLocationCode,
        dropoffAirport: params.dropoffAirport || params.endLocationCode,
        dropoffAddress: params.dropoffAddress || params.endAddressLine,
        dropoffCity: params.dropoffCity || params.endCityName,
        pickupDateTime: params.pickupDateTime || params.startDateTime,
        passengers: params.passengers || 1,
        currency: params.currency,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[UnifiedTransfer] Booking119 error:", res.status, text);
      return [];
    }

    const data = await res.json();
    if (!data?.success || !data.offers?.length) return [];

    return data.offers;
  } catch (err) {
    console.error("[UnifiedTransfer] Booking119 exception:", err);
    return [];
  }
}

// ── Check which providers are active ──

async function getActiveProviders(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("api_settings")
    .select("provider, is_active")
    .in("provider", ["amadeus", "amadeus_transfer", "booking119_taxi"])
    .eq("is_active", true);

  const providers = (data || []).map((r: any) => r.provider);
  // Treat amadeus_transfer as amadeus for backward compat
  if (providers.includes("amadeus_transfer") && !providers.includes("amadeus")) {
    providers.push("amadeus");
  }
  return providers;
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "search";

    if (action === "search") {
      // Validate required fields
      if (!body.pickupAirport && !body.startLocationCode) {
        return json({ success: false, error: "Missing pickup location (pickupAirport or startLocationCode)" }, 400);
      }
      if (!body.pickupDateTime && !body.startDateTime) {
        return json({ success: false, error: "Missing pickup date/time (pickupDateTime or startDateTime)" }, 400);
      }

      const activeProviders = await getActiveProviders();
      console.log(`[UnifiedTransfer] Active providers: ${activeProviders.join(", ") || "none"}`);

      if (activeProviders.length === 0) {
        return json({
          success: true,
          transfers: [],
          count: 0,
          message: "No transfer providers are currently enabled. Enable Amadeus in Admin → API Settings.",
          providers: [],
        });
      }

      // Search all active providers in parallel
      const providerResults: Promise<{ provider: string; offers: any[] }>[] = [];

      if (activeProviders.includes("amadeus")) {
        providerResults.push(
          searchAmadeus(body).then(offers => ({ provider: "amadeus", offers }))
        );
      }
      if (activeProviders.includes("booking119_taxi")) {
        providerResults.push(
          searchBooking119(body).then(offers => ({ provider: "booking119", offers }))
        );
      }
      // Future: if (activeProviders.includes("providerX")) { ... }

      const results = await Promise.all(providerResults);

      // Merge and sort by price
      let allTransfers: any[] = [];
      const providerStats: Record<string, number> = {};

      for (const r of results) {
        providerStats[r.provider] = r.offers.length;
        allTransfers = [...allTransfers, ...r.offers];
      }

      allTransfers.sort((a, b) => (a.price || 0) - (b.price || 0));

      console.log(`[UnifiedTransfer] Total: ${allTransfers.length} offers from ${Object.keys(providerStats).length} providers`);

      return json({
        success: true,
        transfers: allTransfers,
        count: allTransfers.length,
        providers: providerStats,
      });
    }

    if (action === "book") {
      // Route booking to the correct provider
      const source = body.source || body.transfer?.source;
      if (source === "amadeus") {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        const res = await fetch(`${supabaseUrl}/functions/v1/amadeus-transfer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": anonKey,
          },
          body: JSON.stringify({
            action: "book",
            offerId: body.offerId,
            passengers: body.passengers,
            rawOffer: body.rawOffer || body.transfer?._raw,
            note: body.note,
          }),
        });

        const data = await res.json();
        return json(data, res.ok ? 200 : 500);
      }

      return json({ success: false, error: `Booking not supported for source: ${source}` }, 400);
    }

    return json({ success: false, error: `Unknown action: ${action}. Supported: search, book` }, 400);

  } catch (err: any) {
    console.error("[UnifiedTransfer] Error:", err.message);
    return json({ success: false, error: err.message }, 500);
  }
});
