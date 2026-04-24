// Tenant API — Public REST endpoint for external tenant integrations
// Validates API key, resolves tenant, and proxies to internal edge functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Rate limiting per API key
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number; limit: number }>();

function isRateLimited(apiKey: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKey);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(apiKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS, limit });
    return false;
  }
  entry.count++;
  return entry.count > entry.limit;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

interface TenantKeyInfo {
  tenant_id: string;
  tenant_name: string;
  rate_limit: number;
  key_id: string;
}

async function validateApiKey(apiKey: string): Promise<TenantKeyInfo | null> {
  const sb = getSupabaseAdmin();

  const { data: keyRow } = await sb
    .from("tenant_api_keys")
    .select("id, tenant_id, rate_limit_per_minute, is_active")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!keyRow) return null;

  // Get tenant info
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, name, is_active")
    .eq("id", keyRow.tenant_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!tenant) return null;

  // Update last_used_at (fire-and-forget)
  sb.from("tenant_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  return {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    rate_limit: keyRow.rate_limit_per_minute,
    key_id: keyRow.id,
  };
}

async function callEdgeFunction(functionName: string, body: any): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[tenant-api] ${functionName} HTTP ${response.status}: ${text}`);
      return { success: false, error: `Provider error: ${response.status}` };
    }
    return await response.json();
  } catch (e) {
    console.error(`[tenant-api] ${functionName} error:`, e);
    return { success: false, error: "Internal error" };
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Decode opaque source codes returned by unified-flight-search back to
// supplier names for internal routing only. Customers never see these names.
const FLIGHT_CODE_TO_SOURCE: Record<string, string> = {
  pa: "database",
  pb: "travelport",
  pc: "tripjack",
  pd: "amadeus",
  pe: "sabre",
};
function resolveFlightSource(flight: any): string {
  const raw = typeof flight?.source === "string" ? flight.source : "";
  return FLIGHT_CODE_TO_SOURCE[raw] || raw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract API key from header
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || !apiKey.startsWith("tvl_sk_")) {
    return jsonResponse({ success: false, error: "Missing or invalid API key. Pass it via x-api-key header." }, 401);
  }

  // Validate key
  const keyInfo = await validateApiKey(apiKey);
  if (!keyInfo) {
    return jsonResponse({ success: false, error: "Invalid or inactive API key" }, 401);
  }

  // Rate limit
  if (isRateLimited(apiKey, keyInfo.rate_limit)) {
    return jsonResponse({ success: false, error: "Rate limit exceeded" }, 429);
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (!action) {
      return jsonResponse({
        success: false,
        error: "Missing 'action' field. Supported: search, price, book",
        docs: {
          search: { action: "search", from: "DAC", to: "DXB", departDate: "2026-04-01", adults: 1, cabinClass: "Economy" },
          price: { action: "price", flight: "{ flight object from search }" },
          book: { action: "book", flight: "{ flight object }", passengers: "[ passenger objects ]", contact: "{ email, phone }" },
        },
      }, 400);
    }

    console.log(`[tenant-api] tenant=${keyInfo.tenant_name}, action=${action}`);

    // ── SEARCH ──
    if (action === "search") {
      const searchBody = {
        mode: body.mode || "search",
        from: body.from,
        to: body.to,
        departDate: body.departDate,
        returnDate: body.returnDate || null,
        adults: body.adults || 1,
        children: body.children || 0,
        infants: body.infants || 0,
        cabinClass: body.cabinClass || "Economy",
        directFlight: body.directFlight || false,
        tenant_id: keyInfo.tenant_id,
        // For date-prices mode
        dates: body.dates,
      };

      const result = await callEdgeFunction("unified-flight-search", searchBody);

      // Strip internal fields and opaque source codes from flights before returning.
      // Customers should never see supplier names OR our internal masking codes.
      if (result?.flights) {
        result.flights = result.flights.map((f: any) => {
          const { rawApiPrice, appliedMarkupPct, source, _pPriceId, _pBookingId,
                  _pConditions, _pTotalPriceInfo, _pSsrData, _pRawOffer,
                  _pDictionaries, _pRaw, ...clean } = f;
          // Preserve a single opaque routing token so customers can pass the
          // flight back into price/book actions without exposing the supplier.
          return { ...clean, _routeToken: source };
        });
      }

      return jsonResponse(result);
    }

    // ── PRICE VERIFICATION ──
    if (action === "price") {
      const flight = body.flight;
      if (!flight) return jsonResponse({ success: false, error: "Missing 'flight' object" }, 400);

      // Route to appropriate provider (decode opaque token → supplier name internally)
      const source = resolveFlightSource({ source: flight._routeToken || flight.source });
      let result;

      if (source === "travelport") {
        result = await callEdgeFunction("travelport-price", {
          ...body,
          tenantCredentials: undefined,
        });
      } else if (source === "tripjack") {
        result = await callEdgeFunction("tripjack-review", { priceId: flight.priceId || flight.id });
      } else if (source === "sabre") {
        result = await callEdgeFunction("sabre-price", {
          flight, adults: body.adults, children: body.children, infants: body.infants,
        });
      } else {
        return jsonResponse({ success: false, error: `Price verification not supported for source: ${source}` }, 400);
      }

      return jsonResponse(result);
    }

    // ── BOOKING ──
    if (action === "book") {
      const { flight, passengers, contact } = body;
      if (!flight || !passengers || !contact) {
        return jsonResponse({ success: false, error: "Missing required fields: flight, passengers, contact" }, 400);
      }

      const source = resolveFlightSource({ source: flight._routeToken || flight.source });
      let bookResult;

      if (source === "travelport") {
        bookResult = await callEdgeFunction("travelport-book", {
          flight, passengers, contact,
          tenantCredentials: undefined,
        });
      } else if (source === "tripjack") {
        bookResult = await callEdgeFunction("tripjack-book", {
          flight, passengers, contact,
        });
      } else if (source === "sabre") {
        bookResult = await callEdgeFunction("sabre-book", {
          flight, passengers, contact,
        });
      } else {
        return jsonResponse({ success: false, error: `Booking not supported for source: ${source}` }, 400);
      }

      // Store booking on platform with tenant_id
      if (bookResult?.success) {
        const sb = getSupabaseAdmin();
        const bookingId = `API-${Date.now().toString(36).toUpperCase()}`;
        try {
          await sb.from("bookings").insert({
            booking_id: bookingId,
            user_id: "00000000-0000-0000-0000-000000000000", // API booking — no user session
            tenant_id: keyInfo.tenant_id,
            type: "flight",
            title: `${flight.from_city || flight.from} → ${flight.to_city || flight.to}`,
            subtitle: `${flight.airline} • ${flight.departure}`,
            total: flight.price || 0,
            status: "Confirmed",
            details: { flight, passengers, contact, source: "tenant-api", api_key_id: keyInfo.key_id } as any,
            confirmation_data: bookResult as any,
          });
          bookResult.platform_booking_id = bookingId;
        } catch (e) {
          console.error("[tenant-api] booking save error:", e);
        }
      }

      return jsonResponse(bookResult);
    }

    // ── TRANSFER SEARCH ──
    if (action === "transfer_search") {
      const result = await callEdgeFunction("unified-transfer-search", {
        action: "search",
        pickupAirport: body.startLocationCode || body.pickupAirport,
        dropoffAirport: body.endLocationCode || body.dropoffAirport,
        dropoffCity: body.endCityName || body.dropoffCity,
        dropoffAddress: body.endAddressLine || body.dropoffAddress,
        dropoffGeoCode: body.endGeoCode || body.dropoffGeoCode,
        transferType: body.transferType || "PRIVATE",
        pickupDateTime: body.startDateTime || body.pickupDateTime,
        passengers: body.passengers || 1,
        currency: body.currency,
      });
      return jsonResponse(result);
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}. Supported: search, price, book, transfer_search` }, 400);

  } catch (e) {
    console.error("[tenant-api] error:", e);
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
