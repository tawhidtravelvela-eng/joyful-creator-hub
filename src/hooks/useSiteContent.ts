import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useBlockOverride, buildSlicePatch } from "@/hooks/useBlockOverride";

// Legacy CustomSite per-page content overrides — temporarily disabled until
// Phase 0c reintroduces them via tenant_page_composition.
const useTenantContent = (): { content?: Partial<SiteContent> } | null => null;

export interface SiteContent {
  hero: Record<string, any>;
  stats: Record<string, any>;
  features: Record<string, any>;
  newsletter: Record<string, any>;
  app_download: Record<string, any>;
  homepage: Record<string, any>;
  trending: Record<string, any>;
  destinations: Record<string, any>;
  deals: Record<string, any>;
  recommendations: Record<string, any>;
  budget_explorer: Record<string, any>;
  testimonials: Record<string, any>;
  blog: Record<string, any>;
  ai_planner: Record<string, any>;
  offers: Record<string, any>;
  banners: Record<string, any>;
}

const defaults: SiteContent = {
  hero: {},
  stats: {},
  features: {},
  newsletter: {},
  app_download: {},
  homepage: {},
  trending: {},
  destinations: {},
  deals: {},
  recommendations: {},
  budget_explorer: {},
  testimonials: {},
  blog: {},
  ai_planner: {},
  offers: {},
  banners: {},
};

let cached: SiteContent | null = null;
let cachedForTenant: string | null = null;

export function useSiteContent() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || null;
  // When rendered inside a Custom Website, prefer per-page AI overrides over
  // any platform/tenant defaults. This lets each tenant's site display its own
  // headlines, subtitles, CTA copy etc. without modifying every section.
  const tenantCtx = useTenantContent();
  // Per-block override published by `BlockOverrideProvider` in the Studio's
  // tenant renderer. Lets a single block instance override its section copy
  // without touching any home component.
  const blockOverride = useBlockOverride();

  const [content, setContent] = useState<SiteContent>(
    cached && cachedForTenant === tenantId ? cached : defaults
  );
  const [loading, setLoading] = useState(
    !(cached && cachedForTenant === tenantId)
  );

  useEffect(() => {
    if (cached && cachedForTenant === tenantId) return;

    const load = async () => {
      const result: SiteContent = { ...defaults };

      if (tenant) {
        const ts = tenant.settings;
        const keys = Object.keys(defaults) as (keyof SiteContent)[];
        keys.forEach((key) => {
          if (ts[key]) result[key] = ts[key];
        });
      } else {
        const { data } = await supabase
          .from("api_settings")
          .select("provider, settings")
          .in("provider", [
            "site_hero", "site_stats", "site_features",
            "site_newsletter", "site_app_download", "site_homepage",
            "site_trending", "site_destinations", "site_deals",
            "site_recommendations", "site_budget_explorer",
            "site_testimonials", "site_blog", "site_ai_planner",
            "site_offers", "site_banners",
          ]);

        data?.forEach((row) => {
          const key = row.provider.replace("site_", "") as keyof SiteContent;
          if (result[key] !== undefined) {
            result[key] = (row.settings as Record<string, any>) || {};
          }
        });
      }

      cached = result;
      cachedForTenant = tenantId;
      setContent(result);
      setLoading(false);
    };

    load();
  }, [tenant, tenantId]);

  // Merge tenant page overrides on top of the resolved content (custom website only).
  const merged: SiteContent = (() => {
    let out: SiteContent = content;
    if (tenantCtx?.content) {
      const o = tenantCtx.content;
      out = { ...content };
      (Object.keys(defaults) as (keyof SiteContent)[]).forEach((key) => {
        if (o[key] && typeof o[key] === "object") {
          out[key] = { ...(content[key] || {}), ...o[key] };
        }
      });
    }
    if (blockOverride?.section) {
      const patch = buildSlicePatch(blockOverride.content);
      if (Object.keys(patch).length > 0) {
        out = {
          ...out,
          [blockOverride.section]: {
            ...(out[blockOverride.section] || {}),
            ...patch,
          },
        };
      }
    }
    return out;
  })();

  return { content: merged, loading };
}

export function invalidateSiteContentCache() {
  cached = null;
  cachedForTenant = null;
}
