import { useTenant } from "@/hooks/useTenant";
import Index from "@/pages/Index";
import TenantSiteRenderer from "@/components/site/TenantSiteRenderer";
import { Loader2 } from "lucide-react";
import { useTenantSiteTracking } from "@/hooks/useTenantSiteTracking";

/**
 * Renders the platform homepage on default domains and the
 * tenant skin-driven homepage when a tenant matches the hostname.
 */
const TenantHome = () => {
  const { tenant, loading } = useTenant();
  useTenantSiteTracking(tenant?.id || null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) return <Index />;
  return <TenantSiteRenderer pageSlug="home" />;
};

export default TenantHome;