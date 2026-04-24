/**
 * Transfer wire adapter — re-hydrates transfer `source` opaque codes
 * (xa/xb) back to legacy names (amadeus/booking119) for compatibility.
 */
const TRANSFER_CODE_TO_SOURCE: Record<string, string> = {
  xa: "amadeus",
  xb: "booking119",
};
function hydrateSourceValue(v: any): any {
  if (typeof v !== "string") return v;
  return TRANSFER_CODE_TO_SOURCE[v] || v;
}
export function hydrateTransferDataFromWire<T = any>(data: T): T {
  if (data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    for (let i = 0; i < (data as any[]).length; i++) {
      (data as any[])[i] = hydrateTransferDataFromWire((data as any[])[i]);
    }
    return data;
  }
  const obj = data as any;
  for (const k of Object.keys(obj)) {
    if (k === "source" || k === "api_source") {
      obj[k] = hydrateSourceValue(obj[k]);
    } else if (typeof obj[k] === "object") {
      obj[k] = hydrateTransferDataFromWire(obj[k]);
    }
  }
  return obj;
}
