/**
 * Sub-affiliate commission resolver — STUBBED for Phase 0c.
 *
 * The legacy whitelabel_sub_affiliate_* tables were dropped. Until Phase 1
 * rebuilds the tiered commission system on the new schema, this module
 * returns the default rate unchanged so the rest of the app keeps compiling.
 */

export type ProductType =
  | "hotel"
  | "flight"
  | "tour"
  | "transfer"
  | "package"
  | "other";

export interface VolumeTier {
  id: string;
  tier_name: string;
  min_conversions: number;
  bonus_rate: number;
  is_active: boolean;
}

export interface ProductRateOverride {
  product_type: ProductType;
  commission_rate: number;
  is_active: boolean;
}

export interface ResolvedRate {
  effectiveRate: number;
  baseRate: number;
  bonusRate: number;
  source: "product_override" | "default";
  matchedTier: VolumeTier | null;
  nextTier: VolumeTier | null;
}

export function normalizeProductType(raw: string | null | undefined): ProductType {
  const t = (raw || "").toLowerCase().trim();
  if (t === "hotel" || t === "hotels") return "hotel";
  if (t === "flight" || t === "flights") return "flight";
  if (t === "tour" || t === "tours" || t === "activity" || t === "activities") return "tour";
  if (t === "transfer" || t === "transfers" || t === "transport") return "transfer";
  if (t === "package" || t === "packages" || t === "trip") return "package";
  return "other";
}

export function resolveRate(opts: {
  defaultRate: number;
  productType: ProductType;
  productOverrides: ProductRateOverride[];
  volumeTiers: VolumeTier[];
  totalConversions: number;
}): ResolvedRate {
  const rate = Number(opts.defaultRate || 0);
  return {
    effectiveRate: rate,
    baseRate: rate,
    bonusRate: 0,
    source: "default",
    matchedTier: null,
    nextTier: null,
  };
}

export async function resolveSubAffiliateRate(opts: {
  subAffiliateId: string;
  parentAffiliateId: string;
  defaultRate: number;
  productType: ProductType;
  totalConversions: number;
}): Promise<ResolvedRate> {
  const rate = Number(opts.defaultRate || 0);
  return {
    effectiveRate: rate,
    baseRate: rate,
    bonusRate: 0,
    source: "default",
    matchedTier: null,
    nextTier: null,
  };
}
