import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;

/** Active B2B navigation page */
export type B2BPage =
  | "overview" | "search-book" | "bookings" | "customers" | "wallet"
  | "markup" | "reports" | "support" | "staff" | "settings"
  | "earnings" | "sub-agent-earnings" | "requests"
  | "white-label" | "api-access" | "payment-banks" | "profile"
  | "partner-applications";

export interface B2BProfile {
  full_name: string;
  email: string;
  company_name: string;
  created_at: string;
  parent_agent_id?: string | null;
  billing_currency: string;
  /** Optional list of currencies the agent may transact in. Empty = billing_currency only. */
  allowed_currencies: string[];
  avatar_url?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  company_address?: string | null;
  country?: string | null;
  trade_license?: string | null;
  timezone?: string | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", CNY: "¥", INR: "₹",
  AED: "د.إ", MYR: "RM", SGD: "S$", THB: "฿", SAR: "﷼",
  KWD: "د.ك", QAR: "﷼", OMR: "﷼", BHD: ".د.ب", JPY: "¥",
  KRW: "₩", PHP: "₱", IDR: "Rp", VND: "₫", LKR: "Rs",
};

interface B2BContextValue {
  activePage: B2BPage;
  setActivePage: (page: B2BPage) => void;
  bookings: Booking[];
  profile: B2BProfile;
  /** Balance in the currently active currency */
  walletBalance: number;
  /** All currency balances keyed by currency code */
  walletBalances: Record<string, number>;
  /** All currencies the agent can transact in (always includes billing_currency) */
  availableCurrencies: string[];
  /** Currently active currency for display, top-up, and purchases */
  activeCurrency: string;
  setActiveCurrency: (cur: string) => void;
  creditLimit: number;
  loading: boolean;
  isSubAgent: boolean;
  affiliateId: string | null;
  affiliateCode: string;
  totalConversions: number;
  /** Format amount in the active currency */
  fmtNative: (amt: number) => string;
  /** Format amount in any specific currency */
  fmtCurrency: (amt: number, cur: string) => string;
  /** Format booking total in its booked currency */
  fmtBooking: (b: Booking) => string;
  /** Refresh all data */
  refresh: () => void;
}

const defaultProfile: B2BProfile = {
  full_name: "", email: "", company_name: "", created_at: "",
  parent_agent_id: null, billing_currency: "USD", allowed_currencies: [],
  avatar_url: null, logo_url: null, phone: null, company_address: null,
  country: null, trade_license: null, timezone: null,
};

// Persistent cache for B2B snapshot — render instantly on next visit
const B2B_CACHE_KEY = "tv_b2b_snapshot_v2";
const B2B_ACTIVE_CUR_KEY = "tv_b2b_active_currency";
interface B2BSnapshot {
  profile: B2BProfile;
  walletBalances: Record<string, number>;
  creditLimit: number;
  affiliateId: string | null;
  affiliateCode: string;
  totalConversions: number;
}
const readSnapshot = (uid: string): B2BSnapshot | null => {
  try {
    const raw = localStorage.getItem(`${B2B_CACHE_KEY}:${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const writeSnapshot = (uid: string, snap: B2BSnapshot) => {
  try { localStorage.setItem(`${B2B_CACHE_KEY}:${uid}`, JSON.stringify(snap)); } catch {}
};
const readActiveCur = (uid: string): string | null => {
  try { return localStorage.getItem(`${B2B_ACTIVE_CUR_KEY}:${uid}`); } catch { return null; }
};
const writeActiveCur = (uid: string, cur: string) => {
  try { localStorage.setItem(`${B2B_ACTIVE_CUR_KEY}:${uid}`, cur); } catch {}
};

const fmt = (cur: string, amt: number) => {
  const sym = CURRENCY_SYMBOLS[cur] || cur + " ";
  return `${sym}${amt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const B2BContext = createContext<B2BContextValue>({
  activePage: "overview",
  setActivePage: () => {},
  bookings: [],
  profile: defaultProfile,
  walletBalance: 0,
  walletBalances: {},
  availableCurrencies: ["USD"],
  activeCurrency: "USD",
  setActiveCurrency: () => {},
  creditLimit: 0,
  loading: true,
  isSubAgent: false,
  affiliateId: null,
  affiliateCode: "",
  totalConversions: 0,
  fmtNative: () => "",
  fmtCurrency: () => "",
  fmtBooking: () => "",
  refresh: () => {},
});

export const useB2B = () => useContext(B2BContext);

export const B2BProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const cached = user ? readSnapshot(user.id) : null;

  const [activePage, setActivePage] = useState<B2BPage>("overview");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<B2BProfile>(cached?.profile || defaultProfile);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>(cached?.walletBalances || {});
  const [creditLimit, setCreditLimit] = useState(cached?.creditLimit || 0);
  const [activeCurrency, setActiveCurrencyState] = useState<string>(
    user ? (readActiveCur(user.id) || cached?.profile.billing_currency || "USD") : "USD"
  );
  // Don't block render if we have a cached snapshot — hydrate in background
  const [loading, setLoading] = useState(!cached);
  const [affiliateId, setAffiliateId] = useState<string | null>(cached?.affiliateId || null);
  const [affiliateCode, setAffiliateCode] = useState(cached?.affiliateCode || "");
  const [totalConversions, setTotalConversions] = useState(cached?.totalConversions || 0);

  const setActiveCurrency = useCallback((cur: string) => {
    setActiveCurrencyState(cur);
    if (user) writeActiveCur(user.id, cur);
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const hasCache = !!readSnapshot(user.id);
    if (!hasCache) setLoading(true);

    try {
      const [bookingsRes, profileRes, walletRes, affiliateRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_transactions" as any).select("amount, type, status, currency").eq("user_id", user.id).eq("status", "completed"),
        supabase.from("affiliates").select("id, affiliate_code").eq("user_id", user.id).maybeSingle(),
      ]);

      setBookings(bookingsRes.data || []);

      let nextProfile = profile;
      let nextCreditLimit = creditLimit;
      if (profileRes.data) {
        const pd = profileRes.data as any;
        const allowed: string[] = Array.isArray(pd.allowed_currencies) ? pd.allowed_currencies.filter(Boolean) : [];
        nextProfile = {
          full_name: pd.full_name || "",
          email: pd.email || "",
          company_name: pd.company_name || "",
          created_at: pd.created_at || "",
          parent_agent_id: pd.parent_agent_id || null,
          billing_currency: pd.billing_currency || "USD",
          allowed_currencies: allowed,
          avatar_url: pd.avatar_url || null,
          logo_url: pd.logo_url || null,
          phone: pd.phone || null,
          company_address: pd.company_address || null,
          country: pd.country || null,
          trade_license: pd.trade_license || null,
          timezone: pd.timezone || null,
        };
        nextCreditLimit = pd.credit_limit || 0;
        setProfile(nextProfile);
        setCreditLimit(nextCreditLimit);
      }

      // Wallet balances: aggregate per currency
      const txns = (walletRes.data || []) as any[];
      const balances: Record<string, number> = {};
      txns.forEach((t: any) => {
        const cur = String(t.currency || nextProfile.billing_currency || "USD").toUpperCase();
        const sign = t.type === "credit" ? 1 : -1;
        balances[cur] = (balances[cur] || 0) + sign * Number(t.amount);
      });
      // Ensure billing_currency entry exists even if no txns yet
      if (!(nextProfile.billing_currency in balances)) {
        balances[nextProfile.billing_currency] = 0;
      }
      setWalletBalances(balances);

      // Validate active currency: if not in allowed set, fall back to billing
      const allowedSet = new Set([nextProfile.billing_currency, ...nextProfile.allowed_currencies]);
      if (!allowedSet.has(activeCurrency)) {
        const fallback = nextProfile.billing_currency;
        setActiveCurrencyState(fallback);
        if (user) writeActiveCur(user.id, fallback);
      }

      let nextAffId: string | null = null;
      let nextAffCode = "";
      if (affiliateRes.data) {
        nextAffId = affiliateRes.data.id;
        nextAffCode = affiliateRes.data.affiliate_code || "";
        setAffiliateId(nextAffId);
        setAffiliateCode(nextAffCode);
      } else {
        const code = "B2B" + user.id.slice(0, 8).toUpperCase();
        const { data: newAff } = await supabase.from("affiliates").insert({
          user_id: user.id,
          affiliate_code: code,
          status: "approved",
          commission_rate: 1.0,
        }).select("id, affiliate_code").single();
        if (newAff) {
          nextAffId = newAff.id;
          nextAffCode = newAff.affiliate_code || code;
          setAffiliateId(nextAffId);
          setAffiliateCode(nextAffCode);
        }
      }

      writeSnapshot(user.id, {
        profile: nextProfile,
        walletBalances: balances,
        creditLimit: nextCreditLimit,
        affiliateId: nextAffId,
        affiliateCode: nextAffCode,
        totalConversions,
      });
    } finally {
      setLoading(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (user) fetchData(); }, [user, fetchData]);

  // Global refresh hook: any code path that mutates the wallet (purchase, top-up, refund)
  // can dispatch `window.dispatchEvent(new Event("wallet:changed"))` and the chip updates instantly.
  useEffect(() => {
    if (!user) return;
    const handler = () => fetchData();
    window.addEventListener("wallet:changed", handler);
    return () => window.removeEventListener("wallet:changed", handler);
  }, [user, fetchData]);

  // Defer affiliate_conversions count
  useEffect(() => {
    if (!user || !affiliateId) return;
    const needsConversions = activePage === "white-label" || activePage === "api-access" || activePage === "earnings";
    if (!needsConversions) return;
    supabase
      .from("affiliate_conversions")
      .select("*", { count: "exact", head: true })
      .eq("affiliate_id", affiliateId)
      .then(({ count }) => {
        const c = count || 0;
        setTotalConversions(c);
        const snap = readSnapshot(user.id);
        if (snap) writeSnapshot(user.id, { ...snap, totalConversions: c });
      });
  }, [user, affiliateId, activePage]);

  const availableCurrencies = useMemo(() => {
    const base = [profile.billing_currency || "USD", ...(profile.allowed_currencies || [])];
    return Array.from(new Set(base.filter(Boolean)));
  }, [profile.billing_currency, profile.allowed_currencies]);

  const walletBalance = walletBalances[activeCurrency] || 0;

  const fmtCurrency = useCallback((amt: number, cur: string) => fmt(cur, amt), []);
  const fmtNative = useCallback((amt: number) => fmt(activeCurrency, amt), [activeCurrency]);
  const fmtBooking = useCallback((b: Booking) => {
    const cur = (b as any).booked_currency || activeCurrency;
    return fmt(cur, Number(b.total));
  }, [activeCurrency]);

  const isSubAgent = !!profile.parent_agent_id;

  return (
    <B2BContext.Provider value={{
      activePage, setActivePage, bookings, profile,
      walletBalance, walletBalances, availableCurrencies,
      activeCurrency, setActiveCurrency,
      creditLimit, loading, isSubAgent, affiliateId, affiliateCode, totalConversions,
      fmtNative, fmtCurrency, fmtBooking, refresh: fetchData,
    }}>
      {children}
    </B2BContext.Provider>
  );
};
