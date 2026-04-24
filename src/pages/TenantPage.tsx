import { useParams } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import TenantSiteRenderer from "@/components/site/TenantSiteRenderer";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/NotFound";
import { useTenantSiteTracking } from "@/hooks/useTenantSiteTracking";

/**
 * Renders any non-home tenant page by slug, e.g. /p/about, /p/contact.
 * - Only resolves on tenant domains. On the platform default domain it
 *   shows a 404 because these slugs are tenant-scoped.
 * - The renderer is responsible for falling back gracefully if no
 *   composition row exists for the slug.
 */
const TenantPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { tenant, loading } = useTenant();
  useTenantSiteTracking(tenant?.id || null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant || !slug) return <NotFound />;
  return <TenantSiteRenderer pageSlug={slug} />;
};

export default TenantPage;