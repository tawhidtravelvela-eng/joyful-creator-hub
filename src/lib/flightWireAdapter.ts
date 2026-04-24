/**
 * Flight wire adapter
 *
 * The unified-flight-search edge function strips supplier names from network
 * payloads to prevent leakage of provider identity (Tripjack/Amadeus/
 * Travelport/Sabre/etc.). Outbound responses come back with:
 *   - `flight.source`  → opaque code: 'pa' | 'pb' | 'pc' | 'pd' | 'pe'
 *   - `tripjackPriceId` / `tripjackBookingId` / `tripjackConditions` /
 *     `tripjackTotalPriceInfo` / `tripjackSsrData` / `amadeusRawOffer` /
 *     `amadeusDictionaries` / `travelportRaw` / `travelportRawOffer`
 *     → renamed to neutral keys prefixed `_p…`.
 *
 * Existing app code (15+ files: FlightBooking, Flights, FlightDetailsPanel,
 * AllFlightsPopup, FlightDetailDialog, useDisplayItinerary, tripPricingUtils,
 * tripCacheHelpers, useTripSearch, etc.) still reads the legacy field names.
 * Rather than rewriting every call site (high regression risk across all four
 * booking flows), we re-hydrate the legacy field names here on the boundary
 * between the network and the app, and then re-mask them when forwarding back
 * to the backend (inbound `price`/`book`/`ancillaries`/`fareRules` actions).
 *
 * The backend is tolerant of either form on inbound bodies — this adapter
 * exists primarily so the network payload itself stays clean.
 *
 * Future cleanup: once the frontend is rewritten to consume only opaque
 * `srcToken` + `providerRefs` + `bookingFlow` + `needsPriceVerification`,
 * this adapter can be deleted.
 */

const CODE_TO_SOURCE: Record<string, string> = {
  pa: "database",
  pb: "travelport",
  pc: "tripjack",
  pd: "amadeus",
  pe: "sabre",
};
const SOURCE_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_SOURCE).map(([k, v]) => [v, k]),
);

const NEUTRAL_TO_LEGACY: Array<[string, (src: string) => string]> = [
  ["_pPriceId",         (src) => src === "tripjack" ? "tripjackPriceId" : "_pPriceId"],
  ["_pBookingId",       (src) => src === "tripjack" ? "tripjackBookingId" : "_pBookingId"],
  ["_pConditions",      (src) => src === "tripjack" ? "tripjackConditions" : "_pConditions"],
  ["_pTotalPriceInfo",  (src) => src === "tripjack" ? "tripjackTotalPriceInfo" : "_pTotalPriceInfo"],
  ["_pSsrData",         (src) => src === "tripjack" ? "tripjackSsrData" : "_pSsrData"],
  ["_pRawOffer",        (src) => src === "amadeus" ? "amadeusRawOffer" : src === "travelport" ? "travelportRawOffer" : "_pRawOffer"],
  ["_pDictionaries",    (src) => src === "amadeus" ? "amadeusDictionaries" : "_pDictionaries"],
  ["_pRaw",             (src) => src === "travelport" ? "travelportRaw" : "_pRaw"],
];

const LEGACY_TO_NEUTRAL: Record<string, string> = {
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

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Re-hydrate one flight from wire → legacy field names. */
export function hydrateFlightFromWire<T extends Record<string, any>>(f: T): T {
  if (!isPlainObject(f)) return f;
  const out: any = { ...f };
  // 1. Restore source name from opaque code (frontend code branches on names).
  if (typeof out.source === "string" && CODE_TO_SOURCE[out.source]) {
    out.source = CODE_TO_SOURCE[out.source];
  }
  const src = typeof out.source === "string" ? out.source : "";
  // 2. Rename neutral keys back to provider-specific legacy keys.
  for (const [neutral, mapper] of NEUTRAL_TO_LEGACY) {
    if (out[neutral] !== undefined) {
      const legacy = mapper(src);
      if (out[legacy] === undefined) out[legacy] = out[neutral];
      delete out[neutral];
    }
  }
  // 3. Recurse into nested arrays of flights (multi-city _legs / combo).
  if (Array.isArray(out._legs)) out._legs = out._legs.map(hydrateFlightFromWire);
  if (Array.isArray(out.combo)) out.combo = out.combo.map(hydrateFlightFromWire);
  return out;
}

/** Re-hydrate a list of flights returned from `unified-flight-search`. */
export function hydrateFlightsFromWire<T extends Record<string, any>>(flights: T[]): T[] {
  return Array.isArray(flights) ? flights.map(hydrateFlightFromWire) : flights;
}

/**
 * Re-mask a body that the app is about to send to `unified-flight-search`
 * (price / book / ancillaries / fareRules actions). The backend accepts
 * either form, but masking on the way out keeps the wire clean.
 */
export function maskBodyForWire<T extends Record<string, any>>(body: T): T {
  if (!isPlainObject(body)) return body;
  const out: any = { ...body };
  if (typeof out.source === "string" && SOURCE_TO_CODE[out.source]) {
    out.source = SOURCE_TO_CODE[out.source];
  }
  for (const [legacy, neutral] of Object.entries(LEGACY_TO_NEUTRAL)) {
    if (out[legacy] !== undefined && out[neutral] === undefined) {
      out[neutral] = out[legacy];
      delete out[legacy];
    }
  }
  if (out.flight && isPlainObject(out.flight)) {
    const f: any = { ...out.flight };
    if (typeof f.source === "string" && SOURCE_TO_CODE[f.source]) {
      f.source = SOURCE_TO_CODE[f.source];
    }
    for (const [legacy, neutral] of Object.entries(LEGACY_TO_NEUTRAL)) {
      if (f[legacy] !== undefined && f[neutral] === undefined) {
        f[neutral] = f[legacy];
        delete f[legacy];
      }
    }
    out.flight = f;
  }
  return out;
}

/**
 * Convenience: invoke an `unified-flight-search` action with auto-mask on
 * the way out and auto-hydrate of any returned `flights` array on the way in.
 * Drop-in replacement for `supabase.functions.invoke("unified-flight-search", ...)`.
 */
export async function invokeFlightSearch(
  invoker: (name: string, opts: { body: any }) => Promise<{ data: any; error: any }>,
  body: any,
): Promise<{ data: any; error: any }> {
  const masked = maskBodyForWire(body);
  const res = await invoker("unified-flight-search", { body: masked });
  if (res?.data && Array.isArray(res.data.flights)) {
    res.data.flights = hydrateFlightsFromWire(res.data.flights);
  }
  return res;
}