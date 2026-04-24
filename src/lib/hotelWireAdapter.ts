/**
 * Hotel wire adapter
 *
 * The unified-hotel-search edge function masks supplier names in network
 * payloads (Tripjack/Hotelston) to prevent leakage of provider identity.
 * Outbound responses come back with `source` / `api_source` containing
 * opaque codes:
 *   ha → tripjack, hb → hotelston, hs → search, hd → database, hk → cache,
 *   hl → local_inventory
 *
 * Existing app code (HotelBooking, HotelDetail, Hotels, useTripSearch, etc.)
 * branches on these legacy names for image-CDN selection, currency choice,
 * and price conversion. This adapter re-hydrates the legacy names at the
 * network boundary so existing call sites keep working.
 */
const HOTEL_CODE_TO_SOURCE: Record<string, string> = {
  ha: "tripjack",
  hb: "hotelston",
  hs: "search",
  hd: "database",
  hk: "cache",
  hl: "local_inventory",
};

function hydrateSourceValue(v: any): any {
  if (typeof v !== "string") return v;
  if (v.includes("+")) {
    return v.split("+").map((p) => HOTEL_CODE_TO_SOURCE[p] || p).join("+");
  }
  return HOTEL_CODE_TO_SOURCE[v] || v;
}

/** Recursively re-hydrate `source` / `api_source` fields in any returned data. */
export function hydrateHotelDataFromWire<T = any>(data: T): T {
  if (data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    for (let i = 0; i < (data as any[]).length; i++) {
      (data as any[])[i] = hydrateHotelDataFromWire((data as any[])[i]);
    }
    return data;
  }
  const obj = data as any;
  for (const k of Object.keys(obj)) {
    if (k === "source" || k === "api_source") {
      obj[k] = hydrateSourceValue(obj[k]);
    } else if (typeof obj[k] === "object") {
      obj[k] = hydrateHotelDataFromWire(obj[k]);
    }
  }
  return obj;
}
