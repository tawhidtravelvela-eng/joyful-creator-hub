import type { B2BFareRow } from "@/components/b2b/flights/types";

export interface CommissionRuleLite {
  carrier_code: string;
  api_provider: string;
  module: string;
  commission_type: string; // "commission" | "discount" | ...
  profit_type: string;     // "percentage" | "fixed"
  amount: number;
  is_active: boolean;
}

export interface AitSettings {
  enabled: boolean;
  perApi: Record<string, number>; // % per provider, e.g. { travelport: 0.3 }
}

export interface FareBreakdown {
  baseFare: number;        // base component (best-effort)
  taxes: number;
  totalFare: number;       // base + tax (== sellFare)
  commissionPct: number;   // % applied (0 if none)
  commissionAmount: number;// base * pct/100
  aitPct: number;          // % applied (0 if disabled)
  aitAmount: number;       // total * pct/100
  netFare: number;         // ceil(total - commission + ait)
  hasCommission: boolean;
  currency: string;
}

/** Resolve the commission % for a given carrier+provider */
export const resolveCommissionPct = (
  airline: string,
  source: string | undefined,
  rules: CommissionRuleLite[],
): number => {
  if (!airline || !rules?.length) return 0;
  const code = airline.toUpperCase();
  const provider = (source || "").toLowerCase();
  // Prefer exact provider match, else any provider match
  const exact = rules.find(r =>
    r.is_active &&
    r.module === "flights" &&
    r.commission_type === "commission" &&
    r.profit_type === "percentage" &&
    r.carrier_code.toUpperCase() === code &&
    r.api_provider.toLowerCase() === provider
  );
  if (exact) return Number(exact.amount) || 0;
  const any = rules.find(r =>
    r.is_active &&
    r.module === "flights" &&
    r.commission_type === "commission" &&
    r.profit_type === "percentage" &&
    r.carrier_code.toUpperCase() === code
  );
  return any ? Number(any.amount) || 0 : 0;
};

export const resolveAitPct = (source: string | undefined, ait: AitSettings | null): number => {
  if (!ait?.enabled) return 0;
  const key = (source || "").toLowerCase();
  return Number(ait.perApi?.[key] || 0);
};

/**
 * Per the agreed B2B fare logic:
 *   Total      = base + tax  (== sellFare)
 *   Commission = base * commission%
 *   AIT        = total * ait%
 *   Net        = total − commission + ait   (rounded UP to whole)
 */
export const computeFareBreakdown = (
  row: B2BFareRow,
  rules: CommissionRuleLite[],
  ait: AitSettings | null,
): FareBreakdown => {
  const total = Number(row.sellFare) || 0;
  const taxes = Number(row.taxes) || 0;
  // Best-effort base: prefer explicit basePrice, else total - taxes
  const base = row.basePrice != null
    ? Number(row.basePrice)
    : Math.max(0, total - taxes);

  const commissionPct = resolveCommissionPct(row.airline, row.source, rules);
  const aitPct = resolveAitPct(row.source, ait);

  const commissionAmount = (base * commissionPct) / 100;
  const aitAmount = (total * aitPct) / 100;
  const rawNet = total - commissionAmount + aitAmount;
  const netFare = Math.ceil(rawNet);

  return {
    baseFare: base,
    taxes,
    totalFare: total,
    commissionPct,
    commissionAmount,
    aitPct,
    aitAmount,
    netFare,
    hasCommission: commissionPct > 0,
    currency: row.currency,
  };
};