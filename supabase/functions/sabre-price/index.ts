// Sabre Price Verification — Revalidate Itinerary
// Verifies that a selected flight's fare is still available and returns updated pricing

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SabreCredentials {
  client_id: string;
  client_secret: string;
  pcc: string;
  environment?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function getSabreBaseUrl(env?: string): string {
  return env === "production"
    ? "https://api.havail.sabre.com"
    : "https://api-crt.cert.havail.sabre.com";
}

async function getCredentials(tenantCredentials?: SabreCredentials): Promise<SabreCredentials> {
  if (tenantCredentials?.client_id && tenantCredentials?.client_secret) return tenantCredentials;
  const client_id = Deno.env.get("SABRE_CLIENT_ID");
  const client_secret = Deno.env.get("SABRE_CLIENT_SECRET");
  const pcc = Deno.env.get("SABRE_PCC") || "";
  const environment = Deno.env.get("SABRE_ENVIRONMENT") || "test";
  if (!client_id || !client_secret) throw new Error("Sabre credentials not configured");
  return { client_id, client_secret, pcc, environment };
}

async function getAuthToken(creds: SabreCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.token;
  const baseUrl = getSabreBaseUrl(creds.environment);
  const encoded = btoa(`${creds.client_id}:${creds.client_secret}`);
  const response = await fetch(`${baseUrl}/v2/auth/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Sabre auth failed: ${response.status}`);
  const data = await response.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 604800) * 1000 };
  return cachedToken.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { flight } = body;
    if (!flight) {
      return new Response(JSON.stringify({ success: false, error: "Missing flight object" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await getCredentials(body.tenantCredentials);
    const token = await getAuthToken(creds);
    const baseUrl = getSabreBaseUrl(creds.environment);

    // Build revalidation request from flight segments
    const segments = flight.segments || [];
    if (segments.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No segments in flight" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const odInfos = segments.map((seg: any, idx: number) => ({
      RPH: String(idx + 1),
      DepartureDateTime: seg.departure,
      OriginLocation: { LocationCode: seg.from },
      DestinationLocation: { LocationCode: seg.to },
      FlightSegment: [{
        DepartureDateTime: seg.departure,
        ArrivalDateTime: seg.arrival,
        FlightNumber: seg.flightNumber?.replace(/^[A-Z]{2}/, "") || "",
        ResBookDesigCode: seg.bookingCode || "Y",
        MarketingAirline: { Code: seg.carrier, FlightNumber: seg.flightNumber?.replace(/^[A-Z]{2}/, "") || "" },
      }],
    }));

    const passengers: any[] = [];
    const adults = body.adults || 1;
    const children = body.children || 0;
    const infants = body.infants || 0;
    if (adults > 0) passengers.push({ Code: "ADT", Quantity: adults });
    if (children > 0) passengers.push({ Code: "CNN", Quantity: children });
    if (infants > 0) passengers.push({ Code: "INF", Quantity: infants });

    const revalRequest = {
      OTA_AirLowFareSearchRQ: {
        Version: "5",
        POS: {
          Source: [{
            PseudoCityCode: creds.pcc,
            RequestorID: { Type: "1", ID: "1", CompanyName: { Code: "TN" } },
          }],
        },
        OriginDestinationInformation: odInfos,
        TravelerInfoSummary: {
          AirTravelerAvail: [{ PassengerTypeQuantity: passengers }],
        },
        TPA_Extensions: {
          IntelliSellTransaction: { RequestType: { Name: "REVALIDATE" } },
        },
      },
    };

    const response = await fetch(`${baseUrl}/v2/shop/flights/fares`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(revalRequest),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[sabre-price] revalidation failed: ${response.status} ${text}`);
      return new Response(JSON.stringify({
        success: false,
        error: `Fare revalidation failed: ${response.status}`,
        fareChanged: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const itineraries = result?.OTA_AirLowFareSearchRS?.PricedItineraries?.PricedItinerary || [];

    if (itineraries.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "Fare no longer available",
        fareChanged: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract updated pricing from first itinerary
    const firstItin = itineraries[0];
    const pricing = firstItin.AirItineraryPricingInfo;
    const totalFare = pricing?.ItinTotalFare;
    const newBase = parseFloat(totalFare?.BaseFare?.Amount || "0");
    const newTaxes = parseFloat(totalFare?.Taxes?.Tax?.[0]?.Amount || totalFare?.Taxes?.Amount || "0");
    const newTotal = parseFloat(totalFare?.TotalFare?.Amount || "0");
    const currency = totalFare?.TotalFare?.CurrencyCode || flight.currency || "USD";

    // Extract per-passenger-type pricing
    const paxPricing: Record<string, { base: number; taxes: number; total: number }> = {};
    const ptcBreakdowns = pricing?.PTC_FareBreakdowns?.PTC_FareBreakdown || [];
    const breakdownArr = Array.isArray(ptcBreakdowns) ? ptcBreakdowns : [ptcBreakdowns];
    for (const bd of breakdownArr) {
      const paxCode = bd?.PassengerTypeQuantity?.Code;
      if (!paxCode) continue;
      const normalCode = paxCode === "CNN" ? "CHD" : paxCode;
      if (paxPricing[normalCode]) continue;
      const pf = bd?.PassengerFare;
      if (pf) {
        paxPricing[normalCode] = {
          base: parseFloat(pf.BaseFare?.Amount || "0"),
          taxes: parseFloat(pf.Taxes?.Tax?.[0]?.Amount || pf.Taxes?.Amount || "0"),
          total: parseFloat(pf.TotalFare?.Amount || "0"),
        };
      }
    }

    const fareChanged = Math.abs(newTotal - (flight.price || 0)) > 1;

    console.log(`[sabre-price] revalidation: original=${flight.price}, new=${newTotal}, changed=${fareChanged}`);

    return new Response(JSON.stringify({
      success: true,
      fareChanged,
      originalPrice: flight.price,
      newPrice: newTotal,
      basePrice: newBase,
      taxes: newTaxes,
      currency,
      provider: "sabre",
      paxPricing: Object.keys(paxPricing).length > 0 ? paxPricing : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[sabre-price] error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
