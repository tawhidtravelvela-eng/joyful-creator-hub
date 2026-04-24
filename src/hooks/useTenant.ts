import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  domain: string;
  name: string;
  is_active: boolean;
  settings: Record<string, any>;
  b2b_landing_slug?: string;
  show_partner_cta_on_home?: boolean;
}

const tenantCache = new Map<string, Tenant | null>();

// When the studio iframe boots with `?studio_preview=1&tenant=<id>` we stash
// the id in sessionStorage so subsequent in-iframe navigations (e.g. clicking
// the Header's "Flights" link) keep the tenant context, instead of reverting
// to the platform site.
const PREVIEW_KEY = "studio_preview_tenant_id";

function readPreviewTenantId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("studio_preview") === "1") {
      const id = params.get("tenant");
      if (id) {
        sessionStorage.setItem(PREVIEW_KEY, id);
        return id;
      }
    }
    // Fall back to the stashed id whenever sessionStorage carries one.
    // sessionStorage is per-tab, and the key is only ever set when the
    // tab was originally booted with `studio_preview=1`, so it can't
    // leak across normal browsing sessions. We previously gated this on
    // `window.self !== window.top`, but sandboxed studio iframes throw
    // on that comparison and we'd silently lose the preview tenant on
    // every in-app navigation (e.g. clicking Flights in the navbar).
    return sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    /* sessionStorage may be unavailable (sandboxed iframe) */
  }
  return null;
}

function getTenantCacheKey() {
  const previewTenantId = readPreviewTenantId();
  return previewTenantId
    ? `preview:${previewTenantId}`
    : `host:${window.location.hostname}`;
}

/**
 * Resolves the current tenant from window.location.hostname.
 * Returns null when no tenant matches (falls back to global/default).
 */
export function useTenant() {
  const cacheKey = getTenantCacheKey();
  const [tenant, setTenant] = useState<Tenant | null>(
    tenantCache.has(cacheKey) ? tenantCache.get(cacheKey) ?? null : null
  );
  const [loading, setLoading] = useState(!tenantCache.has(cacheKey));

  useEffect(() => {
    const nextCacheKey = getTenantCacheKey();
    if (tenantCache.has(nextCacheKey)) {
      setTenant(tenantCache.get(nextCacheKey) ?? null);
      setLoading(false);
      return;
    }

    const hostname = window.location.hostname;
    const previewTenantId = readPreviewTenantId();

    const normalizeTenant = (data: any): Tenant => ({
      id: data.id,
      domain: data.domain,
      name: data.name,
      is_active: data.is_active,
      settings: (data.settings as Record<string, any>) || {},
      b2b_landing_slug: data.b2b_landing_slug || "partners",
      show_partner_cta_on_home: data.show_partner_cta_on_home !== false,
    });

    if (previewTenantId) {
      supabase
        .from("tenants")
        .select("id, domain, name, is_active, settings, b2b_landing_slug, show_partner_cta_on_home")
        .eq("id", previewTenantId)
        .eq("is_active", true)
        .maybeSingle()
        .then(({ data }) => {
          const resolved = data ? normalizeTenant(data) : null;
          tenantCache.set(nextCacheKey, resolved);
          setTenant(resolved);
          setLoading(false);
        });
      return;
    }

    // Skip tenant resolution for localhost / lovable preview domains
    const isDefault =
      hostname === "localhost" ||
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lovableproject.com") ||
      hostname === "127.0.0.1";

    if (isDefault) {
      tenantCache.set(nextCacheKey, null);
      setTenant(null);
      setLoading(false);
      return;
    }

    // Tenants can ONLY be resolved via their own connected custom domain.
    // We intentionally do NOT match on travelvela.com subdomains — those
    // would otherwise show the platform site on unbranded URLs.
    const resolveByDomain = async () => {
      // Skip platform parent domain entirely
      if (hostname === "travelvela.com" || hostname.endsWith(".travelvela.com")) {
        return null;
      }

      // Exact domain match (custom domains only)
      const { data: exactMatch } = await supabase
        .from("tenants")
        .select("*")
        .eq("domain", hostname)
        .eq("is_active", true)
        .maybeSingle();

      return exactMatch || null;
    };

    resolveByDomain().then((data) => {
      const resolved = data ? normalizeTenant(data) : null;
      tenantCache.set(nextCacheKey, resolved);
      setTenant(resolved);
      setLoading(false);
    });
  }, [cacheKey]);

  return { tenant, loading, isTenant: !!tenant };
}

/** Call after admin edits a tenant to bust the cache */
export function invalidateTenantCache() {
  tenantCache.clear();
}
