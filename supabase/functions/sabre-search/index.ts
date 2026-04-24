// Sabre Flight Search — Bargain Finder Max (BFM) REST API
// Handles OAuth2 token exchange and normalizes results to unified format

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── OAuth2 token cache ──
let cachedToken: { token: string; expiresAt: number } | null = null;

interface SabreCredentials {
  client_id: string;
  client_secret: string;
  pcc: string;
  environment?: string; // "test" | "production"
}

function getSabreBaseUrl(env?: string): string {
  return env === "production"
    ? "https://api.havail.sabre.com"
    : "https://api-crt.cert.havail.sabre.com";
}

async function getCredentials(tenantCredentials?: SabreCredentials): Promise<SabreCredentials> {
  if (tenantCredentials?.client_id && tenantCredentials?.client_secret) {
    return tenantCredentials;
  }
  // Fall back to global secrets
  const client_id = Deno.env.get("SABRE_CLIENT_ID");
  const client_secret = Deno.env.get("SABRE_CLIENT_SECRET");
  const pcc = Deno.env.get("SABRE_PCC") || "";
  const environment = Deno.env.get("SABRE_ENVIRONMENT") || "test";

  if (!client_id || !client_secret) {
    throw new Error("Sabre credentials not configured");
  }
  return { client_id, client_secret, pcc, environment };
}

async function getAuthToken(creds: SabreCredentials): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }

  const baseUrl = getSabreBaseUrl(creds.environment);
  const tokenUrl = `${baseUrl}/v2/auth/token`;

  // Sabre uses client_credentials grant with Base64-encoded client_id:client_secret
  const encodedCredentials = btoa(`${creds.client_id}:${creds.client_secret}`);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encodedCredentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[sabre-search] Auth failed: ${response.status} ${text}`);
    throw new Error(`Sabre authentication failed: ${response.status}`);
  }

  const data = await response.json();
  const token = data.access_token;
  const expiresIn = data.expires_in || 604800; // Default 7 days

  cachedToken = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return token;
}

// ── Cabin class mapping ──
const CABIN_MAP: Record<string, string> = {
  Economy: "Y",
  PremiumEconomy: "S",
  Business: "C",
  First: "F",
};

// ── Search using Bargain Finder Max ──
async function searchFlights(
  creds: SabreCredentials,
  params: {
    from: string;
    to: string;
    departDate: string;
    returnDate?: string | null;
    adults: number;
    children?: number;
    infants?: number;
    cabinClass?: string;
    directFlight?: boolean;
  }
): Promise<any[]> {
  const token = await getAuthToken(creds);
  const baseUrl = getSabreBaseUrl(creds.environment);

  // Build OTA_AirLowFareSearchRQ for BFM
  const originDestinations: any[] = [
    {
      RPH: "1",
      DepartureDateTime: `${params.departDate}T00:00:00`,
      OriginLocation: { LocationCode: params.from },
      DestinationLocation: { LocationCode: params.to },
    },
  ];

  if (params.returnDate) {
    originDestinations.push({
      RPH: "2",
      DepartureDateTime: `${params.returnDate}T00:00:00`,
      OriginLocation: { LocationCode: params.to },
      DestinationLocation: { LocationCode: params.from },
    });
  }

  const passengers: any[] = [];
  for (let i = 0; i < (params.adults || 1); i++) {
    passengers.push({ Code: "ADT", Quantity: 1 });
  }
  if (params.children && params.children > 0) {
    passengers.push({ Code: "CNN", Quantity: params.children });
  }
  if (params.infants && params.infants > 0) {
    passengers.push({ Code: "INF", Quantity: params.infants });
  }

  // Deduplicate passenger types
  const paxMap = new Map<string, number>();
  passengers.forEach(p => paxMap.set(p.Code, (paxMap.get(p.Code) || 0) + p.Quantity));
  const dedupedPassengers = Array.from(paxMap.entries()).map(([Code, Quantity]) => ({ Code, Quantity }));

  const cabinPref = CABIN_MAP[params.cabinClass || "Economy"] || "Y";

  const requestBody = {
    OTA_AirLowFareSearchRQ: {
      Version: "5",
      POS: {
        Source: [{
          PseudoCityCode: creds.pcc,
          RequestorID: {
            Type: "1",
            ID: "1",
            CompanyName: { Code: "TN" },
          },
        }],
      },
      OriginDestinationInformation: originDestinations,
      TravelPreferences: {
        TPA_Extensions: {
          TripType: {
            Value: params.returnDate ? "Return" : "OneWay",
          },
          NumTrips: { Number: 50 },
          ...(params.directFlight ? { FlightStopsAsConnections: { Ind: true } } : {}),
        },
        CabinPref: [{ Cabin: cabinPref, PreferLevel: "Preferred" }],
      },
      TravelerInfoSummary: {
        AirTravelerAvail: [{
          PassengerTypeQuantity: dedupedPassengers,
        }],
      },
      TPA_Extensions: {
        IntelliSellTransaction: {
          RequestType: { Name: "50ITINS" },
        },
      },
    },
  };

  const response = await fetch(`${baseUrl}/v2/shop/flights/fares`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[sabre-search] BFM failed: ${response.status} ${text}`);
    throw new Error(`Sabre search failed: ${response.status}`);
  }

  const result = await response.json();
  return normalizeResults(result, params);
}

// ── Normalize Sabre BFM response to unified format ──
function normalizeResults(result: any, params: any): any[] {
  const flights: any[] = [];

  try {
    const pricedItineraries =
      result?.OTA_AirLowFareSearchRS?.PricedItineraries?.PricedItinerary ||
      result?.groupedItineraryResponse?.itineraryGroups?.flatMap((g: any) => g.itineraries) ||
      [];

    for (const itin of pricedItineraries) {
      try {
        const normalized = normalizeItinerary(itin, params);
        if (normalized) flights.push(normalized);
      } catch (e) {
        console.error("[sabre-search] skip itinerary:", e);
      }
    }
  } catch (e) {
    console.error("[sabre-search] normalizeResults error:", e);
  }

  return flights;
}

function normalizeItinerary(itin: any, params: any): any | null {
  const airItinerary = itin.AirItinerary;
  const pricingInfo = itin.AirItineraryPricingInfo;

  if (!airItinerary || !pricingInfo) return null;

  const odSegments = airItinerary.OriginDestinationOptions?.OriginDestinationOption || [];
  const segments: any[] = [];
  let totalDurationMinutes = 0;

  for (let odIdx = 0; odIdx < odSegments.length; odIdx++) {
    const od = odSegments[odIdx];
    const flightSegs = od.FlightSegment || [];

    for (let i = 0; i < flightSegs.length; i++) {
      const seg = flightSegs[i];
      const dep = seg.DepartureDateTime || "";
      const arr = seg.ArrivalDateTime || "";
      const depAirport = seg.DepartureAirport?.LocationCode || "";
      const arrAirport = seg.ArrivalAirport?.LocationCode || "";
      const carrier = seg.MarketingAirline?.Code || seg.OperatingAirline?.Code || "";
      const flightNum = seg.FlightNumber || "";
      const equipment = seg.Equipment?.[0]?.AirEquipType || seg.Equipment?.AirEquipType || "";
      const bookingClass = seg.ResBookDesigCode || "";
      const cabinCode = seg.TPA_Extensions?.Cabin?.Cabin || "";
      const duration = seg.ElapsedTime || 0;

      // Connection time to next segment in same OD
      let connectionTime = 0;
      if (i < flightSegs.length - 1) {
        const nextDep = new Date(flightSegs[i + 1].DepartureDateTime);
        const thisArr = new Date(arr);
        connectionTime = Math.round((nextDep.getTime() - thisArr.getTime()) / 60000);
      }

      totalDurationMinutes += duration + connectionTime;

      segments.push({
        departure: dep,
        arrival: arr,
        from: depAirport,
        to: arrAirport,
        carrier,
        flightNumber: `${carrier}${flightNum}`,
        equipment,
        bookingCode: bookingClass,
        cabinClass: cabinCode === "Y" ? "Economy" : cabinCode === "C" ? "Business" : cabinCode === "F" ? "First" : "Economy",
        durationMinutes: duration,
        cT: connectionTime,
        group: odIdx,
      });
    }
  }

  if (segments.length === 0) return null;

  // ── Pricing ──
  const itinFare = pricingInfo.ItinTotalFare || {};
  const baseFare = parseFloat(itinFare.BaseFare?.Amount || "0");
  const taxes = parseFloat(itinFare.Taxes?.Tax?.[0]?.Amount || itinFare.Taxes?.Amount || "0");
  const totalFare = parseFloat(itinFare.TotalFare?.Amount || "0");
  const currency = itinFare.TotalFare?.CurrencyCode || "USD";

  // Per-pax pricing
  const paxPricing: any = {};
  const ptcBreakdowns = pricingInfo.PTC_FareBreakdowns?.PTC_FareBreakdown || [];
  for (const ptc of Array.isArray(ptcBreakdowns) ? ptcBreakdowns : [ptcBreakdowns]) {
    const code = ptc.PassengerTypeQuantity?.Code || "ADT";
    const pBase = parseFloat(ptc.PassengerFare?.BaseFare?.Amount || "0");
    const pTax = parseFloat(ptc.PassengerFare?.Taxes?.Tax?.[0]?.Amount || ptc.PassengerFare?.Taxes?.Amount || "0");
    const mappedCode = code === "ADT" ? "ADT" : code === "CNN" ? "CHD" : code === "INF" ? "INF" : code;
    paxPricing[mappedCode] = {
      base: pBase,
      taxes: pTax,
      total: pBase + pTax,
    };
  }

  const firstSeg = segments[0];
  const lastSeg = segments[segments.length - 1];
  const stops = Math.max(0, segments.filter(s => s.group === 0).length - 1);
  const airline = firstSeg.carrier;

  // Check refundability
  const fareInfo = pricingInfo.FareInfos?.FareInfo || [];
  const isNonRefundable = Array.isArray(fareInfo)
    ? fareInfo.some((fi: any) => fi.TPA_Extensions?.NonRefundable?.Ind === true)
    : fareInfo?.TPA_Extensions?.NonRefundable?.Ind === true;

  // Outbound summary
  const outboundSegs = segments.filter(s => s.group === 0);
  const outbound = outboundSegs.length > 0 ? {
    airline: outboundSegs[0].carrier,
    flightNumber: outboundSegs[0].flightNumber,
    departure: outboundSegs[0].departure,
    arrival: outboundSegs[outboundSegs.length - 1].arrival,
    stops: Math.max(0, outboundSegs.length - 1),
  } : undefined;

  // Return leg summary
  const returnSegs = segments.filter(s => s.group === 1);
  const return_leg = returnSegs.length > 0 ? {
    airline: returnSegs[0].carrier,
    flightNumber: returnSegs[0].flightNumber,
    departure: returnSegs[0].departure,
    arrival: returnSegs[returnSegs.length - 1].arrival,
    stops: Math.max(0, returnSegs.length - 1),
  } : undefined;

  return {
    id: `sabre-${airline}${firstSeg.flightNumber}-${firstSeg.departure}`,
    airline,
    flightNumber: firstSeg.flightNumber,
    from_city: params.from,
    to_city: params.to,
    departure: firstSeg.departure,
    arrival: lastSeg.arrival,
    duration: `${Math.floor(totalDurationMinutes / 60)}h ${totalDurationMinutes % 60}m`,
    stops,
    price: totalFare || (baseFare + taxes),
    basePrice: baseFare,
    taxes,
    currency,
    cabinClass: firstSeg.cabinClass,
    segments,
    paxPricing,
    isRefundable: !isNonRefundable,
    isLcc: false,
    source: "sabre",
    outbound,
    return_leg,
  };
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Test mode
    if (body.test) {
      try {
        const creds = await getCredentials(body.tenantCredentials);
        await getAuthToken(creds);
        return new Response(
          JSON.stringify({ success: true, message: "Sabre authentication successful" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const creds = await getCredentials(body.tenantCredentials);
    const flights = await searchFlights(creds, {
      from: body.from,
      to: body.to,
      departDate: body.departDate,
      returnDate: body.returnDate,
      adults: body.adults || 1,
      children: body.children || 0,
      infants: body.infants || 0,
      cabinClass: body.cabinClass || "Economy",
      directFlight: body.directFlight || false,
    });

    console.log(`[sabre-search] ${body.from}→${body.to}: ${flights.length} results`);

    return new Response(
      JSON.stringify({ success: true, flights, provider: "sabre" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[sabre-search] error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message, flights: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
