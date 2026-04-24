import { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useTenantSkin } from "@/hooks/useTenantSkin";
import TenantSiteRenderer from "@/components/site/TenantSiteRenderer";
import { Loader2 } from "lucide-react";
import { useTenantSiteTracking } from "@/hooks/useTenantSiteTracking";

/**
 * Decides per-vertical (`/flights`, `/hotels`, `/tours`) whether to render
 * the tenant's skin-driven editorial landing page or the platform's
 * functional search page.
 *
 * Rules:
 * 1. No tenant matched (platform domain) → platform `fallback` page.
 * 2. Tenant matched, but their active skin defines no per-slug composition
 *    AND there's no published custom row → platform `fallback` page.
 *    (e.g. b2c-flight, b2c-hotel skins reuse the functional search.)
 * 3. Tenant matched and the slug resolves to skin blocks → render the skin
 *    landing page via `TenantSiteRenderer`.
 */
interface Props {
  pageSlug: "flights" | "hotels" | "tours" | "blog";
  fallback: ReactNode;
}

const TenantVerticalRoute = ({ pageSlug, fallback }: Props) => {
  const { tenant, loading: tenantLoading } = useTenant();
  const { data, loading: skinLoading } = useTenantSkin(pageSlug);
  useTenantSiteTracking(tenant?.id || null);
  const [searchParams] = useSearchParams();

  // When the URL carries real search intent (e.g. user submitted the hero
  // search form), always render the functional search/results page so the
  // user actually sees results — even if the tenant's skin defines an
  // editorial landing for this vertical. Otherwise hitting "Search" on
  // the homepage would just bounce them to the landing page with no results.
  const SEARCH_INTENT_KEYS: Record<Props["pageSlug"], string[]> = {
    flights: ["from", "to", "date", "legs"],
    hotels: ["city", "locationId", "checkin"],
    tours: ["q", "city", "destination"],
    blog: [],
  };
  const hasSearchIntent = (SEARCH_INTENT_KEYS[pageSlug] || []).some((k) =>
    searchParams.get(k),
  );

  if (tenantLoading || (tenant && skinLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Platform domain → keep the existing global page.
  if (!tenant || !data) return <>{fallback}</>;

  // Search intent in URL → always show the functional results page.
  if (hasSearchIntent) return <>{fallback}</>;

  // Tenant skin must explicitly opt-in to a skin-rendered vertical landing,
  // either through a per-slug default composition (registry.ts) or by the
  // tenant having edited the page in Studio. Otherwise we render the
  // platform's functional search page so verticals like b2c-flight don't
  // accidentally lose their search UX.
  const hasSlugComposition =
    !!data.definition.slug_compositions?.[pageSlug];
  if (!hasSlugComposition) return <>{fallback}</>;

  return <TenantSiteRenderer pageSlug={pageSlug} />;
};

export default TenantVerticalRoute;