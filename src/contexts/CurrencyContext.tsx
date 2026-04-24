import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useMarketCurrency,
  buildMarketConfig,
  getEffectiveCurrency,
  canUserChangeCurrency,
  type MarketCurrencyRule,
  type MarketCurrencyConfig,
} from "@/hooks/useMarketCurrency";

// ── Supported currencies ──
export type CurrencyCode =
  | "USD" | "EUR" | "GBP" | "BDT" | "CNY" | "INR" | "JPY" | "KRW"
  | "AUD" | "CAD" | "SGD" | "MYR" | "THB" | "IDR" | "PHP" | "VND"
  | "AED" | "SAR" | "QAR" | "KWD" | "BHD" | "OMR" | "PKR" | "LKR"
  | "NPR" | "EGP" | "NGN" | "KES" | "ZAR" | "TRY" | "RUB" | "UAH"
  | "PLN" | "SEK" | "NOK" | "DKK" | "CHF" | "NZD" | "BRL" | "MXN"
  | "COP" | "ILS" | "JOD" | "HKD" | "TWD" | "MMK" | "KHR" | "MNT"
  | "UZS" | "YER" | "SDG" | "MAD" | "IQD" | "IRR" | "LBP";

// ── Currency metadata ──
const CURRENCY_META: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
  BDT: { symbol: "৳", name: "Bangladeshi Taka" },
  CNY: { symbol: "¥", name: "Chinese Yuan" },
  INR: { symbol: "₹", name: "Indian Rupee" },
  JPY: { symbol: "¥", name: "Japanese Yen" },
  KRW: { symbol: "₩", name: "South Korean Won" },
  AUD: { symbol: "A$", name: "Australian Dollar" },
  CAD: { symbol: "C$", name: "Canadian Dollar" },
  SGD: { symbol: "S$", name: "Singapore Dollar" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit" },
  THB: { symbol: "฿", name: "Thai Baht" },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah" },
  PHP: { symbol: "₱", name: "Philippine Peso" },
  VND: { symbol: "₫", name: "Vietnamese Dong" },
  AED: { symbol: "د.إ", name: "UAE Dirham" },
  SAR: { symbol: "﷼", name: "Saudi Riyal" },
  QAR: { symbol: "﷼", name: "Qatari Riyal" },
  KWD: { symbol: "د.ك", name: "Kuwaiti Dinar" },
  BHD: { symbol: "BD", name: "Bahraini Dinar" },
  OMR: { symbol: "﷼", name: "Omani Rial" },
  PKR: { symbol: "₨", name: "Pakistani Rupee" },
  LKR: { symbol: "Rs", name: "Sri Lankan Rupee" },
  NPR: { symbol: "Rs", name: "Nepalese Rupee" },
  EGP: { symbol: "E£", name: "Egyptian Pound" },
  NGN: { symbol: "₦", name: "Nigerian Naira" },
  KES: { symbol: "KSh", name: "Kenyan Shilling" },
  ZAR: { symbol: "R", name: "South African Rand" },
  TRY: { symbol: "₺", name: "Turkish Lira" },
  RUB: { symbol: "₽", name: "Russian Ruble" },
  UAH: { symbol: "₴", name: "Ukrainian Hryvnia" },
  PLN: { symbol: "zł", name: "Polish Zloty" },
  SEK: { symbol: "kr", name: "Swedish Krona" },
  NOK: { symbol: "kr", name: "Norwegian Krone" },
  DKK: { symbol: "kr", name: "Danish Krone" },
  CHF: { symbol: "CHF", name: "Swiss Franc" },
  NZD: { symbol: "NZ$", name: "New Zealand Dollar" },
  BRL: { symbol: "R$", name: "Brazilian Real" },
  MXN: { symbol: "MX$", name: "Mexican Peso" },
  COP: { symbol: "COL$", name: "Colombian Peso" },
  ILS: { symbol: "₪", name: "Israeli Shekel" },
  JOD: { symbol: "JD", name: "Jordanian Dinar" },
  HKD: { symbol: "HK$", name: "Hong Kong Dollar" },
  TWD: { symbol: "NT$", name: "Taiwan Dollar" },
  MMK: { symbol: "K", name: "Myanmar Kyat" },
  KHR: { symbol: "៛", name: "Cambodian Riel" },
  MNT: { symbol: "₮", name: "Mongolian Tugrik" },
  UZS: { symbol: "сўм", name: "Uzbekistani Som" },
  YER: { symbol: "﷼", name: "Yemeni Rial" },
  SDG: { symbol: "ج.س", name: "Sudanese Pound" },
  MAD: { symbol: "د.م.", name: "Moroccan Dirham" },
  IQD: { symbol: "ع.د", name: "Iraqi Dinar" },
  IRR: { symbol: "﷼", name: "Iranian Rial" },
  LBP: { symbol: "ل.ل", name: "Lebanese Pound" },
};

// ── Country → currency mapping (fallback when no market_currency_rules exist) ──
const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  US: "USD", CA: "CAD", MX: "MXN", BR: "BRL", CO: "COP", AR: "USD",
  GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR",
  LU: "EUR", SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
  MT: "EUR", CY: "EUR",
  PL: "PLN", SE: "SEK", NO: "NOK", DK: "DKK", CH: "CHF",
  RO: "EUR", TR: "TRY", RU: "RUB", UA: "UAH",
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  JO: "JOD", IL: "ILS", LB: "LBP", IQ: "IQD", IR: "IRR", YE: "YER",
  PS: "ILS",
  IN: "INR", BD: "BDT", PK: "PKR", LK: "LKR", NP: "NPR",
  CN: "CNY", JP: "JPY", KR: "KRW", HK: "HKD", TW: "TWD", MN: "MNT",
  SG: "SGD", MY: "MYR", TH: "THB", ID: "IDR", PH: "PHP", VN: "VND",
  KH: "KHR", MM: "MMK", BN: "SGD", LA: "THB",
  AU: "AUD", NZ: "NZD",
  EG: "EGP", NG: "NGN", KE: "KES", ZA: "ZAR", SD: "SDG", MA: "MAD",
  ET: "USD",
  UZ: "UZS", BT: "INR",
};

// Fallback rates (used only until live rates load)
const DEFAULT_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, BDT: 110.5, CNY: 7.24, INR: 83.5,
  JPY: 149, KRW: 1320, AUD: 1.53, CAD: 1.36, SGD: 1.34, MYR: 4.72,
  THB: 35.5, IDR: 15800, PHP: 56, VND: 24500, AED: 3.67, SAR: 3.75,
  QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.38, PKR: 278, LKR: 310,
  NPR: 133, EGP: 30.9, NGN: 1550, KES: 153, ZAR: 18.8, TRY: 32,
  RUB: 92, UAH: 41, PLN: 4.05, SEK: 10.5, NOK: 10.7, DKK: 6.9,
  CHF: 0.88, NZD: 1.65, BRL: 5.0, MXN: 17.2, COP: 4000, ILS: 3.7,
  JOD: 0.71, HKD: 7.82, TWD: 31.5, MMK: 2100, KHR: 4100, MNT: 3440,
  UZS: 12400, YER: 250, SDG: 601, MAD: 10.1, IQD: 1310, IRR: 42000,
  LBP: 89500,
};

/** Get symbol for any currency code */
export function getSymbol(code: string): string {
  return CURRENCY_META[code]?.symbol || code + " ";
}

function isSupportedCurrency(code: string): code is CurrencyCode {
  return code in CURRENCY_META;
}

/** Resolve rate for a currency — live first, then fallback */
function getRate(code: string, liveRates: Record<string, number>): number {
  return liveRates[code] || DEFAULT_RATES[code] || 1;
}

interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rate: number;
}

// Full CURRENCIES map (all supported — used for backend conversion)
export const CURRENCIES: Record<string, CurrencyInfo> = Object.fromEntries(
  Object.entries(CURRENCY_META).map(([code, meta]) => [
    code,
    { code: code as CurrencyCode, ...meta, rate: DEFAULT_RATES[code] || 1 },
  ])
);

// ── Picker-only currencies (shown in the UI dropdown when no market restrictions) ──
const PICKER_CURRENCY_CODES: CurrencyCode[] = [
  "USD", "EUR", "GBP", "BDT", "INR",
  "AED", "SAR", "SGD", "MYR", "THB",
  "JPY", "KRW", "AUD", "CAD", "CHF",
  "HKD", "CNY", "NZD",
];

export const PICKER_CURRENCIES: Record<string, CurrencyInfo> = Object.fromEntries(
  PICKER_CURRENCY_CODES
    .filter(code => CURRENCIES[code])
    .map(code => [code, CURRENCIES[code]])
);

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /** true when user is B2B/corporate or market forces single currency */
  isLocked: boolean;
  /** Resolved picker mode: "show" | "hide" | "disabled" */
  pickerMode: "show" | "hide" | "disabled";
  /** Currencies the user is allowed to pick from (empty = use default PICKER_CURRENCIES) */
  allowedCurrencies: CurrencyCode[];
  /** User-facing note when currency is forced */
  marketNote: string | null;
  /** Convert a USD-denominated price to the display currency */
  convertPrice: (usdPrice: number, source?: string) => number;
  /** Format a USD-denominated price as a display currency string */
  formatPrice: (usdPrice: number, source?: string) => string;
  /** Format an amount already in the display currency (no conversion) */
  formatDirectPrice: (amount: number) => string;
  /** Convert from any source currency to display currency (with markup) */
  convertFromSource: (amount: number, sourceCurrency: string) => number;
  /** Convert + format from any source currency to display currency string */
  formatFromSource: (amount: number, sourceCurrency: string) => string;
  /** Format a frozen booking amount in its booked currency (no conversion) */
  formatBookedPrice: (amount: number, bookedCurrency: string) => string;
  liveRates: Record<string, number>;
  conversionMarkup: number;
  apiSourceCurrencies: Record<string, string>;
  billingResolved: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
const CURRENCY_STORAGE_KEY = "tv_currency_preference";
const RATES_CACHE_KEY = "tv_cached_rates";
const RATES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const getCachedRates = (): { rates: Record<string, number>; markup: number; sources: Record<string, string> } | null => {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > RATES_CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
};

const setCachedRates = (rates: Record<string, number>, markup: number, sources: Record<string, string>) => {
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, markup, sources, ts: Date.now() }));
  } catch { /* ignore */ }
};

const getStoredCurrencyPreference = (): CurrencyCode | null => {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(CURRENCY_STORAGE_KEY) : null;
    return stored && isSupportedCurrency(stored) ? stored : null;
  } catch {
    return null;
  }
};

const setStoredCurrencyPreference = (currencyCode: CurrencyCode) => {
  try {
    if (typeof window !== "undefined") localStorage.setItem(CURRENCY_STORAGE_KEY, currencyCode);
  } catch { /* ignore */ }
};

const fetchGeoCountry = async (): Promise<string> => {
  const { detectCountryCode } = await import("@/utils/geolocation");
  return detectCountryCode();
};

const currencyFromCountry = (countryCode: string): CurrencyCode | null => {
  const cc = COUNTRY_TO_CURRENCY[countryCode];
  return cc && isSupportedCurrency(cc) ? cc : null;
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => getStoredCurrencyPreference() ?? "USD");
  const [billingResolved, setBillingResolved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pickerMode, setPickerMode] = useState<"show" | "hide" | "disabled">("show");
  const [allowedCurrencies, setAllowedCurrencies] = useState<CurrencyCode[]>([]);
  const [marketNote, setMarketNote] = useState<string | null>(null);

  const cached = getCachedRates();
  const [liveRates, setLiveRates] = useState<Record<string, number>>(cached?.rates ?? { USD: 1 });
  const [conversionMarkup, setConversionMarkup] = useState(cached?.markup ?? 2);
  const [apiSourceCurrencies, setApiSourceCurrencies] = useState<Record<string, string>>(
    cached?.sources ?? {
      travelport: "BDT",
      travelvela: "BDT",
      tripjack: "INR",
      amadeus: "USD",
      local_inventory: "USD",
    }
  );

  // Fetch market rules
  const { rules: marketRules, loading: marketLoading } = useMarketCurrency();

  // ── Resolve billing currency on mount ──
  useEffect(() => {
    if (marketLoading) return; // Wait for market rules to load

    const resolve = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      // Detect geo country for market rule lookup
      let geoCountry = "";
      try {
        geoCountry = await fetchGeoCountry();
      } catch { /* keep empty */ }

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("billing_currency, user_type")
          .eq("user_id", userId)
          .maybeSingle();

        const bc = (profile as any)?.billing_currency || "";
        const userType = (profile as any)?.user_type || "";
        const isNonB2C = userType === "b2b_agent" || userType === "corporate";

        // B2B/corporate users: ALWAYS lock to billing_currency, override market rules
        if (isNonB2C) {
          let lockedCurr: CurrencyCode = "USD";
          if (bc && isSupportedCurrency(bc)) {
            lockedCurr = bc;
          } else {
            const detected = currencyFromCountry(geoCountry);
            if (detected) {
              lockedCurr = detected;
              await supabase.from("profiles").update({ billing_currency: detected } as any).eq("user_id", userId);
            }
          }
          setCurrencyState(lockedCurr);
          setIsLocked(true);
          setPickerMode("hide");
          setAllowedCurrencies([lockedCurr]);
          setMarketNote("Currency is locked to your account");
          setBillingResolved(true);
          return;
        }

        // B2C user: apply market rules based on geo country
        const marketConfig = buildMarketConfig(marketRules, geoCountry);
        const storedCurrency = getStoredCurrencyPreference();

        if (marketConfig.allowedCurrencies.length > 0) {
          // Market rules exist for this country
          const effectiveCur = getEffectiveCurrency(marketRules, geoCountry, storedCurrency, bc);
          setCurrencyState(effectiveCur);
          setAllowedCurrencies(marketConfig.allowedCurrencies);
          setPickerMode(marketConfig.effectivePickerMode);
          setMarketNote(marketConfig.marketNote);
          setIsLocked(marketConfig.isForced);

          // Persist valid preference
          if (!marketConfig.isForced) {
            setStoredCurrencyPreference(effectiveCur);
          }
          // Sync to profile if different
          if (effectiveCur !== bc) {
            void supabase.from("profiles").update({ billing_currency: effectiveCur } as any).eq("user_id", userId);
          }
        } else {
          // No market rules — use existing B2C logic
          if (storedCurrency) {
            setCurrencyState(storedCurrency);
          } else if (bc && bc !== "USD" && isSupportedCurrency(bc)) {
            setCurrencyState(bc);
          } else {
            const detected = currencyFromCountry(geoCountry);
            if (detected) {
              setCurrencyState(detected);
              void supabase.from("profiles").update({ billing_currency: detected } as any).eq("user_id", userId);
            }
          }
          setPickerMode("show");
          setAllowedCurrencies([]);
          setMarketNote(null);
          setIsLocked(false);
        }

        setBillingResolved(true);
        return;
      }

      // Not logged in — apply market rules from geo detection
      const marketConfig = buildMarketConfig(marketRules, geoCountry);
      const storedCurrency = getStoredCurrencyPreference();

      if (marketConfig.allowedCurrencies.length > 0) {
        const effectiveCur = getEffectiveCurrency(marketRules, geoCountry, storedCurrency, null);
        setCurrencyState(effectiveCur);
        setAllowedCurrencies(marketConfig.allowedCurrencies);
        setPickerMode(marketConfig.effectivePickerMode);
        setMarketNote(marketConfig.marketNote);
        setIsLocked(marketConfig.isForced);

        // Clear invalid stored preference
        if (storedCurrency && !marketConfig.allowedCurrencies.includes(storedCurrency)) {
          setStoredCurrencyPreference(effectiveCur);
        }
      } else {
        // No market rules — geo-detect for display only
        if (storedCurrency) {
          setCurrencyState(storedCurrency);
        } else {
          const detected = currencyFromCountry(geoCountry);
          if (detected) setCurrencyState(detected);
        }
        setPickerMode("show");
        setAllowedCurrencies([]);
        setIsLocked(false);
      }

      setBillingResolved(true);
    };

    resolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        // Re-resolve on sign in
        resolve();
      }
    });

    return () => subscription.unsubscribe();
  }, [marketRules, marketLoading]);

  // ── Fetch live rates + markup from backend ──
  const fetchRates = useCallback(async (force = false) => {
    if (!force && getCachedRates()) return;
    try {
      const { data } = await supabase.functions.invoke("get-public-config");
      const s = data?.currency_rates;
      if (s) {
        const newRates = s.live_rates && typeof s.live_rates === "object"
          ? { ...DEFAULT_RATES, ...s.live_rates } : liveRates;
        const newMarkup = typeof s.conversion_markup === "number" ? s.conversion_markup : conversionMarkup;
        const newSources = s.api_source_currencies
          ? { ...apiSourceCurrencies, ...s.api_source_currencies } : apiSourceCurrencies;

        setLiveRates(newRates);
        setConversionMarkup(newMarkup);
        setApiSourceCurrencies(newSources);
        setCachedRates(newRates, newMarkup, newSources);
      }
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => {
    fetchRates();
    const handler = () => fetchRates(true);
    window.addEventListener("currency-rates-updated", handler);
    return () => window.removeEventListener("currency-rates-updated", handler);
  }, [fetchRates]);

  // ── Set display currency (persists to localStorage + profile) ──
  const setCurrency = useCallback(async (c: CurrencyCode) => {
    // Block changes for locked users (B2B/corporate or forced market)
    if (isLocked) return;

    // Validate against allowed currencies if market-restricted
    if (allowedCurrencies.length > 0 && !allowedCurrencies.includes(c)) return;

    setCurrencyState(c);
    setStoredCurrencyPreference(c);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      await supabase.from("profiles").update({ billing_currency: c } as any).eq("user_id", userId);
    }
  }, [isLocked, allowedCurrencies]);

  // ── Conversion helpers ──

  const convertPrice = useCallback(
    (price: number, source?: string) => {
      const markup = 1 + conversionMarkup / 100;
      if (source && source !== "database") {
        const sourceCurr = apiSourceCurrencies[source] || "USD";
        if (sourceCurr === currency) return Math.round(price * markup);
        const srcRate = getRate(sourceCurr, liveRates);
        const dstRate = getRate(currency, liveRates);
        return Math.round((price / srcRate) * dstRate * markup);
      }
      if (currency === "USD") return Math.round(price * markup);
      const dstRate = getRate(currency, liveRates);
      return Math.round(price * dstRate * markup);
    },
    [currency, liveRates, apiSourceCurrencies, conversionMarkup]
  );

  const formatPrice = useCallback(
    (price: number, source?: string) => {
      const converted = convertPrice(price, source);
      return `${getSymbol(currency)}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    },
    [currency, convertPrice]
  );

  const formatDirectPrice = useCallback(
    (amount: number) => `${getSymbol(currency)}${Math.round(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    [currency]
  );

  const convertFromSource = useCallback(
    (amount: number, sourceCurrency: string): number => {
      if (!amount || amount <= 0) return 0;
      if (sourceCurrency === currency) return Math.round(amount);
      const srcRate = getRate(sourceCurrency, liveRates);
      const dstRate = getRate(currency, liveRates);
      const markup = 1 + conversionMarkup / 100;
      return Math.round((amount / srcRate) * dstRate * markup);
    },
    [currency, liveRates, conversionMarkup]
  );

  const formatFromSource = useCallback(
    (amount: number, sourceCurrency: string): string => {
      const converted = convertFromSource(amount, sourceCurrency);
      return formatDirectPrice(converted);
    },
    [convertFromSource, formatDirectPrice]
  );

  const formatBookedPrice = useCallback(
    (amount: number, bookedCurrency: string): string => {
      return `${getSymbol(bookedCurrency)}${Math.round(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    },
    []
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        isLocked,
        pickerMode,
        allowedCurrencies,
        marketNote,
        convertPrice,
        formatPrice,
        formatDirectPrice,
        convertFromSource,
        formatFromSource,
        formatBookedPrice,
        liveRates,
        conversionMarkup,
        apiSourceCurrencies,
        billingResolved,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
