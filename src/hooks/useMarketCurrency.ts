import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CurrencyCode } from "@/contexts/CurrencyContext";

// ── Types ──
export interface MarketCurrencyRule {
  country_code: string;
  country_name: string;
  default_currency: string;
  allowed_currencies: string[];
  force_single_currency: boolean;
  currency_picker_mode: "auto" | "show" | "hide" | "disabled";
}

export interface MarketCurrencyConfig {
  countryCode: string;
  defaultCurrency: CurrencyCode;
  allowedCurrencies: CurrencyCode[];
  pickerMode: "auto" | "show" | "hide" | "disabled";
  /** true when only 1 allowed currency OR force_single_currency is set */
  isForced: boolean;
  /** Resolved effective picker mode (auto resolved to show/hide) */
  effectivePickerMode: "show" | "hide" | "disabled";
  /** Optional user-facing note when currency is forced */
  marketNote: string | null;
}

const MARKET_CACHE_KEY = "tv_market_rules";
const MARKET_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Cache helpers ──
function getCachedRules(): MarketCurrencyRule[] | null {
  try {
    const raw = localStorage.getItem(MARKET_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > MARKET_CACHE_TTL) return null;
    return parsed.rules;
  } catch {
    return null;
  }
}

function setCachedRules(rules: MarketCurrencyRule[]) {
  try {
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify({ rules, ts: Date.now() }));
  } catch { /* ignore */ }
}

// ── Default fallback config (no market restrictions) ──
const DEFAULT_CONFIG: MarketCurrencyConfig = {
  countryCode: "",
  defaultCurrency: "USD",
  allowedCurrencies: [], // empty = no restrictions, show full PICKER_CURRENCIES
  pickerMode: "auto",
  isForced: false,
  effectivePickerMode: "show",
  marketNote: null,
};

/**
 * Resolve effective picker mode from admin setting + currency count.
 * - "auto": hide if single currency, show if multiple
 * - "show"/"hide"/"disabled": use as-is
 */
function resolvePickerMode(
  mode: "auto" | "show" | "hide" | "disabled",
  allowedCount: number
): "show" | "hide" | "disabled" {
  if (mode === "auto") return allowedCount <= 1 ? "hide" : "show";
  return mode;
}

// ── Exported helper functions ──

/**
 * Resolve the user's market country using priority:
 * 1. Profile country / assigned market
 * 2. Billing country
 * 3. Geo-detected country
 */
export function resolveUserMarket(
  profileCountry?: string | null,
  billingCountry?: string | null,
  geoCountry?: string | null
): string {
  return profileCountry || billingCountry || geoCountry || "";
}

/**
 * Get allowed currencies for a given market from the rules list.
 * Returns empty array if no rule exists (= no restrictions).
 */
export function getAllowedCurrenciesForMarket(
  rules: MarketCurrencyRule[],
  countryCode: string
): CurrencyCode[] {
  if (!countryCode) return [];
  const rule = rules.find((r) => r.country_code === countryCode);
  if (!rule) return [];
  return rule.allowed_currencies as CurrencyCode[];
}

/**
 * Get the effective currency considering market rules, stored preference, and profile.
 * If stored preference is not in the allowed list, returns market default.
 */
export function getEffectiveCurrency(
  rules: MarketCurrencyRule[],
  countryCode: string,
  storedPreference: CurrencyCode | null,
  profileBillingCurrency?: string | null
): CurrencyCode {
  if (!countryCode) return storedPreference || "USD";

  const rule = rules.find((r) => r.country_code === countryCode);
  if (!rule) return storedPreference || "USD";

  const allowed = rule.allowed_currencies as CurrencyCode[];
  const defaultCur = rule.default_currency as CurrencyCode;

  // If stored preference is in allowed list, keep it
  if (storedPreference && allowed.includes(storedPreference)) return storedPreference;

  // If profile billing currency is in allowed list, use it
  if (profileBillingCurrency && allowed.includes(profileBillingCurrency as CurrencyCode)) {
    return profileBillingCurrency as CurrencyCode;
  }

  // Fall back to market default
  return defaultCur;
}

/**
 * Determine if the user can change currency based on user type + market config.
 * B2B/corporate users NEVER can. B2C depends on market rules.
 */
export function canUserChangeCurrency(
  userType: string | null,
  marketConfig: MarketCurrencyConfig
): boolean {
  // B2B/corporate always locked to profile currency
  if (userType === "b2b_agent" || userType === "corporate") return false;

  // Market-level lock
  if (marketConfig.isForced) return false;

  // If effective picker mode is hide or disabled, user can't change
  if (marketConfig.effectivePickerMode === "hide" || marketConfig.effectivePickerMode === "disabled") return false;

  return true;
}

/**
 * Build a full MarketCurrencyConfig from rules + country code.
 */
export function buildMarketConfig(
  rules: MarketCurrencyRule[],
  countryCode: string
): MarketCurrencyConfig {
  if (!countryCode) return DEFAULT_CONFIG;

  const rule = rules.find((r) => r.country_code === countryCode);
  if (!rule) return { ...DEFAULT_CONFIG, countryCode };

  const allowed = rule.allowed_currencies as CurrencyCode[];
  const isForced = rule.force_single_currency || allowed.length <= 1;
  const pickerMode = rule.currency_picker_mode as "auto" | "show" | "hide" | "disabled";
  const effectivePickerMode = resolvePickerMode(pickerMode, allowed.length);

  return {
    countryCode,
    defaultCurrency: rule.default_currency as CurrencyCode,
    allowedCurrencies: allowed,
    pickerMode,
    isForced,
    effectivePickerMode,
    marketNote: isForced ? "Currency is fixed for your region" : null,
  };
}

// ── Hook ──
export function useMarketCurrency() {
  const [rules, setRules] = useState<MarketCurrencyRule[]>(() => getCachedRules() || []);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("market_currency_rules" as any)
        .select("country_code, country_name, default_currency, allowed_currencies, force_single_currency, currency_picker_mode");

      if (error) throw error;
      if (data && Array.isArray(data)) {
        const typed = data as unknown as MarketCurrencyRule[];
        setRules(typed);
        setCachedRules(typed);
      }
    } catch {
      // Keep cached/default rules
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  /** Get config for a specific country code */
  const getConfigForCountry = useCallback(
    (countryCode: string): MarketCurrencyConfig => buildMarketConfig(rules, countryCode),
    [rules]
  );

  return {
    rules,
    loading,
    getConfigForCountry,
    refetch: fetchRules,
  };
}
