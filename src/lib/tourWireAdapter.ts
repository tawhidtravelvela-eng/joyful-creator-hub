/**
 * Tour wire adapter — re-hydrates tour `source` / `api_source` opaque codes
 * (ta/tx/td/tk/tl) back to legacy names (viator/experience/db/cache/local) so
 * existing frontend branching keeps working. Backend masks at network boundary.
 */
const TOUR_CODE_TO_SOURCE: Record<string, string> = {
  ta: "viator",
  tx: "experience",
  td: "db",
  tk: "cache",
  tl: "local",
};
function hydrateSourceValue(v: any): any {
  if (typeof v !== "string") return v;
  return TOUR_CODE_TO_SOURCE[v] || v;
}
export function hydrateTourDataFromWire<T = any>(data: T): T {
  if (data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    for (let i = 0; i < (data as any[]).length; i++) {
      (data as any[])[i] = hydrateTourDataFromWire((data as any[])[i]);
    }
    return data;
  }
  const obj = data as any;
  for (const k of Object.keys(obj)) {
    if (k === "source" || k === "api_source") {
      obj[k] = hydrateSourceValue(obj[k]);
    } else if (typeof obj[k] === "object") {
      obj[k] = hydrateTourDataFromWire(obj[k]);
    }
  }
  return obj;
}
