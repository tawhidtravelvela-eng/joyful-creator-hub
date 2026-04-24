import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

// Tenant-level per-page content overrides used to live in the legacy
// CustomSite renderer. Until the new skin renderer (Phase 0c) lands we
// fall back to no overrides — branding still picks up tenant settings.
const useTenantContent = (): { brand?: { name?: string; logo_url?: string } } | null => null;

interface SiteBranding {
  site_name: string;
  tagline: string;
  seo_title: string;
  seo_description: string;
  logo_url: string;
  favicon_url: string;
  footer_text: string;
  primary_color: string;
  /** Secondary brand color (fallback derived from primary if absent). */
  accent_color: string;
}

const defaults: SiteBranding = {
  site_name: "Your Brand",
  tagline: "",
  seo_title: "",
  seo_description: "",
  logo_url: "",
  favicon_url: "",
  footer_text: "",
  primary_color: "#2563eb",
  accent_color: "#f59e0b",
};

let cachedBranding: SiteBranding | null = null;
let cachedForTenant: string | null = null;

export function useSiteBranding() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || null;
  const tenantContent = useTenantContent();

  const [branding, setBranding] = useState<SiteBranding>(
    cachedBranding && cachedForTenant === tenantId ? cachedBranding : defaults
  );
  const [loading, setLoading] = useState(
    !(cachedBranding && cachedForTenant === tenantId)
  );

  useEffect(() => {
    if (cachedBranding && cachedForTenant === tenantId) {
      updateFavicon(cachedBranding.favicon_url);
      return;
    }

    const load = async () => {
      try {
        // If tenant exists, use tenant settings for branding
        if (tenant) {
          const ts = (tenant.settings || {}) as Record<string, any>;
          // Studio's Brand tab writes to settings.brand.* — prefer that,
          // fall back to legacy flat fields for older tenants.
          const brand = (ts.brand || {}) as Record<string, any>;
          const merged: SiteBranding = {
            ...defaults,
            site_name:
              brand.site_name || ts.site_name || defaults.site_name,
            tagline: brand.tagline || ts.tagline || defaults.tagline,
            seo_title:
              brand.seo_title || ts.seo_title || defaults.seo_title,
            seo_description:
              brand.seo_description ||
              ts.seo_description ||
              defaults.seo_description,
            logo_url: brand.logo_url || ts.logo_url || defaults.logo_url,
            favicon_url:
              brand.favicon_url || ts.favicon_url || defaults.favicon_url,
            footer_text: ts.footer_text || defaults.footer_text,
            primary_color:
              brand.primary_color || ts.primary_color || defaults.primary_color,
            accent_color:
              brand.accent_color || ts.accent_color || defaults.accent_color,
          };
          cachedBranding = merged;
          cachedForTenant = tenantId;
          setBranding(merged);
          updateFavicon(merged.favicon_url);
          setLoading(false);
          return;
        }

        // Global: fetch from api_settings
        const [brandingRes, generalRes] = await Promise.all([
          supabase.from("api_settings").select("settings").eq("provider", "site_branding").maybeSingle(),
          supabase.from("api_settings").select("settings").eq("provider", "site_general").maybeSingle(),
        ]);

        const b = (brandingRes.data?.settings as Record<string, any>) || {};
        const g = (generalRes.data?.settings as Record<string, any>) || {};

        const merged: SiteBranding = {
          ...defaults,
          ...b,
          site_name: g.site_name || b.site_name || defaults.site_name,
        };

        cachedBranding = merged;
        cachedForTenant = tenantId;
        setBranding(merged);
        updateFavicon(merged.favicon_url);
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tenant, tenantId]);

  const resolvedBranding: SiteBranding = tenantContent?.brand
    ? {
        ...branding,
        site_name: tenantContent.brand.name || branding.site_name,
        logo_url: tenantContent.brand.logo_url || branding.logo_url,
      }
    : branding;

  return { branding: resolvedBranding, loading };
}

function updateFavicon(url: string) {
  if (!url) return;
  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}
