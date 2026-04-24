import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTenant } from "@/hooks/useTenant";
import { CreditCard, Building2, Wallet, Smartphone } from "lucide-react";

// Whitelabel runtime is being replaced by the new skin system. Until the
// replacement (Phase 0c) lands, behave as if no white-label gateway override
// is active so platform payment methods are returned unchanged.
const useWhitelabel = (): { config: { payment_gateway_overrides?: Record<string, boolean> } } | null => null;

export interface PaymentMethod {
  id: string;
  label: string;
  icon: any;
  description: string;
  source?: "tenant" | "global"; // which gateway will process the payment
}

export interface PaymentRoutingResult {
  methods: PaymentMethod[];
  loading: boolean;
  /** true when no payment methods available - show "Request to Book" */
  requestToBookOnly: boolean;
  /** info about tenant wallet if applicable */
  tenantWalletInfo?: {
    balance: number;
    sufficient: boolean;
  };
}

export function usePaymentMethods(): PaymentRoutingResult {
  const { currency } = useCurrency();
  const { tenant } = useTenant();
  const wl = useWhitelabel();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestToBookOnly, setRequestToBookOnly] = useState(false);
  const [tenantWalletInfo, setTenantWalletInfo] = useState<{ balance: number; sufficient: boolean } | undefined>();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);

      // 1. Load global payment settings
      const { data: globalData } = await supabase
        .from("api_settings")
        .select("settings")
        .eq("provider", "site_payment_public")
        .maybeSingle();

      const globalSettings = (globalData?.settings as Record<string, any>) || {};

      const globalMethods: PaymentMethod[] = [];
      if (globalSettings.stripe_enabled !== false) {
        globalMethods.push({ id: "card", label: "Credit / Debit Card", icon: CreditCard, description: "Visa, Mastercard, Amex", source: "global" });
      }
      if (globalSettings.bkash_enabled && currency === "BDT") {
        globalMethods.push({ id: "bkash", label: "bKash", icon: Smartphone, description: "bKash Mobile Banking", source: "global" });
      }
      if (globalSettings.nagad_enabled && currency === "BDT") {
        globalMethods.push({ id: "nagad", label: "Nagad", icon: Smartphone, description: "Nagad Digital Payment", source: "global" });
      }
      // Alipay disabled – integration not yet complete
      // if (globalSettings.alipay_enabled && currency === "CNY") {
      //   globalMethods.push({ id: "alipay", label: "Alipay", icon: Smartphone, description: "Alipay (支付宝)", source: "global" });
      // }
      if (globalSettings.airwallex_enabled) {
        globalMethods.push({ id: "airwallex", label: "Airwallex", icon: CreditCard, description: "Pay via Airwallex", source: "global" });
      }
      if (globalSettings.bank_transfer_enabled !== false) {
        globalMethods.push({ id: "bank", label: "Bank Transfer", icon: Building2, description: "Direct bank payment", source: "global" });
      }

      // 2. If no tenant context, return global methods
      if (!tenant) {
        if (globalMethods.length === 0) {
          globalMethods.push({ id: "card", label: "Credit / Debit Card", icon: CreditCard, description: "Visa, Mastercard, Amex", source: "global" });
        }
        setMethods(globalMethods);
        setRequestToBookOnly(false);
        setTenantWalletInfo(undefined);
        setLoading(false);
        return;
      }

      // 3. Tenant context: load tenant payment settings + wallet + preferences
      const [tenantPayRes, walletRes, tenantConfigRes] = await Promise.all([
        (supabase as any).from("tenant_payment_settings").select("*").eq("tenant_id", tenant.id).eq("is_active", true),
        supabase.rpc("get_tenant_wallet_balance", { _tenant_id: tenant.id }),
        supabase.from("tenants").select("settings").eq("id", tenant.id).maybeSingle(),
      ]);

      const tenantPaymentSettings = tenantPayRes.data || [];
      const walletBalance = Number(walletRes.data) || 0;
      const tenantConfig = (tenantConfigRes.data?.settings as Record<string, any>) || {};
      const isCommissionTenant = tenantConfig.business_model === "commission";
      const allowGlobalFallback = tenantConfig.allow_global_payment_fallback !== false;

      // Commission tenants always use global payment — they earn commission, platform handles payment
      if (isCommissionTenant) {
        const finalGlobal = globalMethods.length > 0 ? globalMethods : [{ id: "card", label: "Credit / Debit Card", icon: CreditCard, description: "Visa, Mastercard, Amex", source: "global" as const }];
        setMethods(finalGlobal);
        setRequestToBookOnly(false);
        setTenantWalletInfo(undefined);
        setLoading(false);
        return;
      }

      // 4. Build tenant payment methods for current currency
      const tenantMethods: PaymentMethod[] = [];
      const iconMap: Record<string, any> = { stripe: CreditCard, bkash: Smartphone, nagad: Smartphone, alipay: Smartphone, airwallex: CreditCard };
      const labelMap: Record<string, string> = { stripe: "Credit / Debit Card", bkash: "bKash", nagad: "Nagad", alipay: "Alipay", airwallex: "Airwallex" };
      const descMap: Record<string, string> = { stripe: "Visa, Mastercard, Amex", bkash: "bKash Mobile Banking", nagad: "Nagad Digital Payment", alipay: "Alipay (支付宝)", airwallex: "Pay via Airwallex" };
      const idMap: Record<string, string> = { stripe: "card", bkash: "bkash", nagad: "nagad", alipay: "alipay", airwallex: "airwallex" };

      tenantPaymentSettings.forEach((tp: any) => {
        const currencies: string[] = tp.supported_currencies || [];
        if (currencies.includes(currency)) {
          tenantMethods.push({
            id: idMap[tp.provider] || tp.provider,
            label: labelMap[tp.provider] || tp.provider,
            icon: iconMap[tp.provider] || CreditCard,
            description: descMap[tp.provider] || "",
            source: "tenant",
          });
        }
      });

      // 5. Payment routing logic
      const hasTenantMethods = tenantMethods.length > 0;
      const walletSufficient = walletBalance > 0; // Will be checked per-booking in the actual payment flow

      setTenantWalletInfo({ balance: walletBalance, sufficient: walletSufficient });

      if (hasTenantMethods && walletSufficient) {
        // Tenant has methods for this currency AND wallet has balance → use tenant gateway
        setMethods(tenantMethods);
        setRequestToBookOnly(false);
      } else if (hasTenantMethods && !walletSufficient) {
        // Tenant has methods but wallet empty → fallback to global or request-to-book
        if (allowGlobalFallback) {
          // Use global methods (filtered to exclude duplicates)
          const tenantIds = new Set(tenantMethods.map(m => m.id));
          const fallbackMethods = globalMethods.filter(m => !tenantIds.has(m.id));
          const combined = [...tenantMethods, ...fallbackMethods];
          setMethods(combined.length > 0 ? combined : globalMethods);
          setRequestToBookOnly(false);
        } else {
          // No fallback → request to book only
          setMethods([]);
          setRequestToBookOnly(true);
        }
      } else if (!hasTenantMethods) {
        // Tenant has no methods for this currency → use global if allowed
        if (allowGlobalFallback) {
          const finalGlobal = globalMethods.length > 0 ? globalMethods : [{ id: "card", label: "Credit / Debit Card", icon: CreditCard, description: "Visa, Mastercard, Amex", source: "global" as const }];
          setMethods(finalGlobal);
          setRequestToBookOnly(false);
        } else {
          // No tenant methods, no fallback → request to book
          setMethods([]);
          setRequestToBookOnly(true);
        }
      }

      setLoading(false);
    };
    fetch();
  }, [currency, tenant]);

  // White-label gateway filter: when running inside a WL site, the WL admin
  // explicitly chose which platform gateways are available. We keep only the
  // intersection. Empty selection = use all platform-default methods (fail-open).
  const filteredMethods = (() => {
    if (!wl) return methods;
    const overrides = wl.config.payment_gateway_overrides || {};
    const explicitlyEnabled = Object.entries(overrides)
      .filter(([, on]) => on === true)
      .map(([id]) => id);
    if (explicitlyEnabled.length === 0) return methods;
    return methods.filter((m) => explicitlyEnabled.includes(m.id));
  })();

  return {
    methods: filteredMethods,
    loading,
    requestToBookOnly: requestToBookOnly || (wl != null && filteredMethods.length === 0 && methods.length > 0),
    tenantWalletInfo,
  };
}
