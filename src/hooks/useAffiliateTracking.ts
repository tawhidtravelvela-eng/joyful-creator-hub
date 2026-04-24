import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Tracks top-level affiliate referral clicks via `?ref=<affiliate_code>`.
// Sub-affiliate (`?sub=`) tracking is temporarily disabled — the legacy
// whitelabel_sub_affiliates tables were dropped in Phase 0c and will be
// rebuilt in Phase 1 on top of the new tenant skin/block system.
export function useAffiliateTracking() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;

    sessionStorage.setItem("affiliate_ref", ref);

    (async () => {
      try {
        const { data: aff } = await supabase
          .from("affiliates")
          .select("id")
          .eq("affiliate_code", ref)
          .eq("status", "approved")
          .maybeSingle();

        if (aff) {
          sessionStorage.setItem("affiliate_id", aff.id);
          await supabase.from("affiliate_clicks").insert({
            affiliate_id: aff.id,
            page_url: window.location.pathname,
            referrer_url: document.referrer || "",
            user_agent: navigator.userAgent.slice(0, 200),
          });
        }
      } catch {
        // silent — tracking must never block UX
      }
    })();

    const url = new URL(window.location.href);
    url.searchParams.delete("ref");
    url.searchParams.delete("sub");
    window.history.replaceState({}, "", url.toString());
  }, []);
}

export function getAffiliateRef(): string | null {
  return sessionStorage.getItem("affiliate_ref");
}

export function getSubAffiliateRef(): string | null {
  return null;
}

export function getStoredAttribution(): {
  affiliateId: string | null;
  subAffiliateId: string | null;
  subAffiliateParentId: string | null;
} {
  return {
    affiliateId: sessionStorage.getItem("affiliate_id"),
    subAffiliateId: null,
    subAffiliateParentId: null,
  };
}

export function clearStoredAttribution() {
  sessionStorage.removeItem("affiliate_ref");
  sessionStorage.removeItem("affiliate_id");
}
