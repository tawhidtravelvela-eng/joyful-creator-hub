import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

/**
 * Real, tenant-specific facts the footer can advertise.
 *
 *  - paymentMethods: only the methods this tenant ACTUALLY accepts.
 *      • If the tenant context is set, we union three sources:
 *          1) tenant_payment_settings  (gateways the platform admin enabled
 *             for this tenant — bkash / nagad / airwallex / stripe)
 *          2) agent_payment_gateways   (the agent's own configured gateways
 *             — stripe / airwallex with credentials saved)
 *          3) agent_bank_accounts      (active bank rows → "Bank Transfer")
 *      • If the tenant has zero of the above, we DO NOT fall back to the
 *        platform's marketing list — we simply hide the badges. This is
 *        the whole point: a footer must not lie about what we accept.
 *      • If there is no tenant at all (platform site), we read the global
 *        site_payment_public flags from api_settings.
 *
 *  - topDestinations: derived from the tenant's recent bookings (180-day
 *    window). When there are too few to be meaningful, returns null so the
 *    caller can either hide the column or fall back to a curated list.
 */

export interface FooterPaymentMethod {
  id: string;          // stable key e.g. "card", "bank", "bkash"
  label: string;       // display label e.g. "Visa / Mastercard"
}

export interface FooterTopDestination {
  label: string;
  href: string;
}

export interface TenantFooterFacts {
  paymentMethods: FooterPaymentMethod[];
  topDestinations: FooterTopDestination[] | null;
  loading: boolean;
}

const factsCache = new Map<string, TenantFooterFacts>();

export function useTenantFooterFacts(): TenantFooterFacts {
  const { tenant } = useTenant();
  const cacheKey = tenant?.id || "__global__";
  const [facts, setFacts] = useState<TenantFooterFacts>(
    factsCache.get(cacheKey) || { paymentMethods: [], topDestinations: null, loading: true }
  );

  useEffect(() => {
    if (factsCache.has(cacheKey)) {
      setFacts(factsCache.get(cacheKey)!);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const result: TenantFooterFacts = {
        paymentMethods: [],
        topDestinations: null,
        loading: false,
      };

      try {
        if (!tenant) {
          // ─── Platform site: use global flags ───
          const { data } = await supabase
            .from("api_settings")
            .select("settings")
            .eq("provider", "site_payment_public")
            .maybeSingle();
          const s = (data?.settings as Record<string, any>) || {};
          const methods: FooterPaymentMethod[] = [];
          if (s.stripe_enabled !== false) methods.push({ id: "card", label: "Visa / Mastercard" });
          if (s.bkash_enabled) methods.push({ id: "bkash", label: "bKash" });
          if (s.nagad_enabled) methods.push({ id: "nagad", label: "Nagad" });
          if (s.airwallex_enabled) methods.push({ id: "airwallex", label: "Airwallex" });
          if (s.bank_transfer_enabled !== false) methods.push({ id: "bank", label: "Bank Transfer" });
          result.paymentMethods = methods;
        } else {
          // ─── Tenant context ───
          const tenantId = tenant.id;

          // Find the tenant-admin user_id so we can also pick up agent-level
          // gateways/banks that belong to this tenant.
          const adminProfilesP = supabase
            .from("profiles")
            .select("user_id")
            .eq("tenant_id", tenantId);

          const tenantPayP = (supabase as any)
            .from("tenant_payment_settings")
            .select("provider, is_active")
            .eq("tenant_id", tenantId)
            .eq("is_active", true);

          const [adminRes, tenantPayRes] = await Promise.all([adminProfilesP, tenantPayP]);
          const adminUserIds: string[] = (adminRes.data || []).map((r: any) => r.user_id).filter(Boolean);

          let agentGwRes: any = { data: [] };
          let agentBankRes: any = { data: [] };
          if (adminUserIds.length) {
            [agentGwRes, agentBankRes] = await Promise.all([
              (supabase as any)
                .from("agent_payment_gateways")
                .select("provider, is_active")
                .in("user_id", adminUserIds)
                .eq("is_active", true),
              (supabase as any)
                .from("agent_bank_accounts")
                .select("currency, is_active")
                .in("user_id", adminUserIds)
                .eq("is_active", true),
            ]);
          }

          // Build a de-duplicated set of methods.
          const seen = new Set<string>();
          const push = (m: FooterPaymentMethod) => {
            if (seen.has(m.id)) return;
            seen.add(m.id);
            result.paymentMethods.push(m);
          };
          const labelFor = (provider: string): FooterPaymentMethod | null => {
            switch (provider) {
              case "stripe":    return { id: "card",      label: "Visa / Mastercard" };
              case "airwallex": return { id: "airwallex", label: "Airwallex" };
              case "bkash":     return { id: "bkash",     label: "bKash" };
              case "nagad":     return { id: "nagad",     label: "Nagad" };
              case "alipay":    return { id: "alipay",    label: "Alipay" };
              default:          return null;
            }
          };
          (tenantPayRes.data || []).forEach((r: any) => {
            const m = labelFor(r.provider);
            if (m) push(m);
          });
          (agentGwRes.data || []).forEach((r: any) => {
            const m = labelFor(r.provider);
            if (m) push(m);
          });
          if ((agentBankRes.data || []).length > 0) {
            push({ id: "bank", label: "Bank Transfer" });
          }

          // ─── Top destinations from real bookings ───
          const sinceIso = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
          const { data: bookingRows } = await supabase
            .from("bookings")
            .select("title, subtitle, details, type, created_at")
            .eq("tenant_id", tenantId)
            .gte("created_at", sinceIso)
            .limit(500);

          const counts = new Map<string, number>();
          (bookingRows || []).forEach((b: any) => {
            const d = (b.details || {}) as Record<string, any>;
            const candidate =
              d.destination ||
              d.to_city ||
              d.toCity ||
              d.arrivalCity ||
              d.city ||
              (typeof b.subtitle === "string" ? b.subtitle.split(",")[0]?.trim() : "");
            if (typeof candidate === "string" && candidate.length > 1 && candidate.length < 40) {
              const key = candidate.trim();
              counts.set(key, (counts.get(key) || 0) + 1);
            }
          });
          if (counts.size >= 3) {
            result.topDestinations = [...counts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([label]) => ({ label, href: `/flights?to=${encodeURIComponent(label)}` }));
          } else {
            result.topDestinations = null;
          }
        }
      } catch {
        // best-effort: leave empties
      }

      if (cancelled) return;
      factsCache.set(cacheKey, result);
      setFacts(result);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, tenant]);

  return facts;
}