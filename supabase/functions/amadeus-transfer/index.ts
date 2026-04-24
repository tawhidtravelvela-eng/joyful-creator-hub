// Amadeus Transfer Search & Booking edge function
// Uses Transfer Offers API (search) and Transfer Orders API (book)
// Endpoints: POST /v1/shopping/transfer-offers, POST /v1/ordering/transfer-orders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Auth & Config ──

interface AmadeusToken {
  access_token: string;
  expires_in: number;
}

let cachedToken: AmadeusToken | null = null;
let tokenExpiry = 0;

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getAmadeusConfig() {
  const sb = getSupabaseAdmin();

  // Check for transfer-specific settings first, then fall back to general amadeus
  const { data: transferData } = await sb
    .from("api_settings")
    .select("is_active, settings")
    .eq("provider", "amadeus_transfer")
    .maybeSingle();

  const { data: flightData } = await sb
    .from("api_settings")
    .select("is_active, settings")
    .eq("provider", "amadeus")
    .maybeSingle();

  // Use transfer settings if available, otherwise fall back to flight settings
  const isActive = transferData?.is_active ?? flightData?.is_active ?? false;
  const transferSettings = (transferData?.settings || {}) as Record<string, string>;
  const flightSettings = (flightData?.settings || {}) as Record<string, string>;
  const environment = transferSettings?.environment || flightSettings?.environment || "test";

  // Try to get credentials from Vault (transfer-specific first, then amadeus)
  let apiKey = "";
  let apiSecret = "";

  // Try transfer-specific vault secrets
  const { data: tkData } = await sb.rpc("read_provider_secret", { p_name: "amadeus_transfer_api_key" });
  if (tkData) apiKey = tkData;
  const { data: tsData } = await sb.rpc("read_provider_secret", { p_name: "amadeus_transfer_api_secret" });
  if (tsData) apiSecret = tsData;

  // Fall back to amadeus flight vault secrets
  if (!apiKey) {
    const { data: akData } = await sb.rpc("read_provider_secret", { p_name: "amadeus_api_key" });
    if (akData) apiKey = akData;
  }
  if (!apiSecret) {
    const { data: asData } = await sb.rpc("read_provider_secret", { p_name: "amadeus_api_secret" });
    if (asData) apiSecret = asData;
  }

  // Final fallback to env vars
  if (!apiKey) apiKey = Deno.env.get("AMADEUS_API_KEY") || "";
  if (!apiSecret) apiSecret = Deno.env.get("AMADEUS_API_SECRET") || "";

  return { isActive, apiKey, apiSecret, environment };
}

function getBaseUrl(env: string): string {
  return env === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";
}

async function getAccessToken(apiKey: string, apiSecret: string, env: string): Promise<string> {
  if (!apiKey || !apiSecret) throw new Error("Amadeus API credentials not configured");

  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken.access_token;
  }

  const baseUrl = getBaseUrl(env);
  const res = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(apiSecret)}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus auth failed: ${res.status} ${text}`);
  }

  const token: AmadeusToken = await res.json();
  cachedToken = token;
  tokenExpiry = Date.now() + (token.expires_in - 60) * 1000;
  return token.access_token;
}

// ── Transfer Search ──

interface TransferSearchParams {
  startLocationCode: string;       // IATA airport code (e.g. "CDG")
  endLocationCode?: string;        // IATA code if ending at airport
  endAddressLine?: string;         // Street address for hotel/city
  endCityName?: string;            // City name
  endGeoCode?: { latitude: number; longitude: number };
  transferType: "PRIVATE" | "SHARED" | "TAXI" | "HOURLY" | "AIRPORT_EXPRESS" | "AIRPORT_BUS" | "HELICOPTER" | "LIMOUSINE";
  startDateTime: string;           // ISO date-time "2025-11-10T10:30:00"
  passengers: number;
  stopOvers?: { duration: string; sequenceNumber: number; addressLine: string; cityName: string; countryCode: string }[];
  startConnectedSegment?: { transportationType: string; transportationNumber: string; departure: { iataCode: string; terminal: string } };
  passengersCharacteristics?: { typeCode: string; age?: number }[];
  currency?: string;
}

async function searchTransfers(params: TransferSearchParams, accessToken: string, baseUrl: string) {
  // Build request body per Amadeus Transfer Offers API spec
  const body: any = {
    startLocationCode: params.startLocationCode,
    transferType: params.transferType || "PRIVATE",
    startDateTime: params.startDateTime,
    passengers: params.passengers || 1,
  };

  // End location — can be airport code, address, or geocode
  if (params.endLocationCode) {
    body.endLocationCode = params.endLocationCode;
  }
  if (params.endAddressLine) {
    body.endAddressLine = params.endAddressLine;
  }
  if (params.endCityName) {
    body.endCityName = params.endCityName;
  }
  if (params.endGeoCode) {
    body.endGeoCode = params.endGeoCode;
  }

  if (params.stopOvers) body.stopOvers = params.stopOvers;
  if (params.startConnectedSegment) body.startConnectedSegment = params.startConnectedSegment;
  if (params.passengersCharacteristics) body.passengersCharacteristics = params.passengersCharacteristics;
  if (params.currency) body.currency = params.currency;

  console.log("[AmadeusTransfer] Search request:", JSON.stringify(body));

  const res = await fetch(`${baseUrl}/v1/shopping/transfer-offers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[AmadeusTransfer] Search error:", res.status, errText);
    throw new Error(`Transfer search failed (${res.status}): ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const offers = data?.data || [];

  console.log(`[AmadeusTransfer] Found ${offers.length} transfer offers`);

  // Normalize offers for frontend consumption
  return offers.map((offer: any) => ({
    id: offer.id,
    transferType: offer.transferType,
    vehicle: {
      code: offer.vehicle?.code,
      category: offer.vehicle?.category,
      description: offer.vehicle?.description,
      imageURL: offer.vehicle?.imageURL,
      seats: offer.vehicle?.seats,
      baggages: offer.vehicle?.baggages,
    },
    serviceProvider: {
      code: offer.serviceProvider?.code,
      name: offer.serviceProvider?.name,
      logoUrl: offer.serviceProvider?.logoUrl,
    },
    quotation: {
      monetaryAmount: offer.quotation?.monetaryAmount,
      currencyCode: offer.quotation?.currencyCode,
      isEstimated: offer.quotation?.isEstimated ?? false,
      base: offer.quotation?.base,
      discount: offer.quotation?.discount,
      taxes: offer.quotation?.taxes,
      fees: offer.quotation?.fees,
      totalTaxes: offer.quotation?.totalTaxes,
      totalFees: offer.quotation?.totalFees,
    },
    start: {
      dateTime: offer.start?.dateTime,
      locationCode: offer.start?.locationCode,
    },
    end: {
      dateTime: offer.end?.dateTime,
      locationCode: offer.end?.locationCode,
      address: offer.end?.address,
    },
    duration: offer.duration,
    distance: offer.distance,
    cancellationRules: offer.cancellationRules,
    methodsOfPaymentAccepted: offer.methodsOfPaymentAccepted,
    // Keep raw for booking
    _raw: offer,
  }));
}

// ── Transfer Booking ──

interface TransferBookParams {
  offerId: string;
  passengers: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    contacts: {
      phoneNumber: string;
      email: string;
    };
  }[];
  note?: string;
  agency?: {
    contacts: { email: { address: string } }[];
  };
}

async function bookTransfer(params: TransferBookParams, rawOffer: any, accessToken: string, baseUrl: string) {
  // Build Transfer Order body
  const body: any = {
    data: {
      type: "transfer-order",
      passengers: params.passengers.map((p, idx) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth,
        contacts: {
          phoneNumber: p.contacts.phoneNumber,
          email: p.contacts.email,
        },
      })),
      transfers: [rawOffer],
    },
  };

  if (params.note) {
    body.data.note = params.note;
  }
  if (params.agency) {
    body.data.agency = params.agency;
  }

  console.log("[AmadeusTransfer] Booking with offerId:", params.offerId);

  const res = await fetch(`${baseUrl}/v1/ordering/transfer-orders?offerId=${encodeURIComponent(params.offerId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[AmadeusTransfer] Booking error:", res.status, errText);
    throw new Error(`Transfer booking failed (${res.status}): ${errText.slice(0, 500)}`);
  }

  const data = await res.json();
  const order = data?.data;

  return {
    orderId: order?.id,
    type: order?.type,
    status: order?.status,
    transfers: order?.transfers || [],
    passengers: order?.passengers || [],
    raw: order,
  };
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "search";

    const config = await getAmadeusConfig();
    if (!config.isActive) {
      return new Response(
        JSON.stringify({ success: false, error: "Amadeus transfers not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(config.apiKey, config.apiSecret, config.environment);
    const baseUrl = getBaseUrl(config.environment);

    // ── SEARCH ──
    if (action === "search") {
      if (!body.startLocationCode || !body.startDateTime) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields: startLocationCode, startDateTime" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const offers = await searchTransfers({
        startLocationCode: body.startLocationCode,
        endLocationCode: body.endLocationCode,
        endAddressLine: body.endAddressLine,
        endCityName: body.endCityName,
        endGeoCode: body.endGeoCode,
        transferType: body.transferType || "PRIVATE",
        startDateTime: body.startDateTime,
        passengers: body.passengers || 1,
        stopOvers: body.stopOvers,
        startConnectedSegment: body.startConnectedSegment,
        passengersCharacteristics: body.passengersCharacteristics,
        currency: body.currency,
      }, accessToken, baseUrl);

      return new Response(
        JSON.stringify({ success: true, offers, count: offers.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── BOOK ──
    if (action === "book") {
      if (!body.offerId || !body.passengers || !body.rawOffer) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields: offerId, passengers, rawOffer" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const order = await bookTransfer({
        offerId: body.offerId,
        passengers: body.passengers,
        note: body.note,
        agency: body.agency,
      }, body.rawOffer, accessToken, baseUrl);

      return new Response(
        JSON.stringify({ success: true, order }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TEST ──
    if (action === "test") {
      return new Response(
        JSON.stringify({ success: true, message: "Amadeus Transfer API credentials valid", environment: config.environment }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}. Supported: search, book, test` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[AmadeusTransfer] Error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
