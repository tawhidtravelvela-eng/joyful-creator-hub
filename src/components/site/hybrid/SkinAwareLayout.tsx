import { ReactNode } from "react";
import Layout from "@/components/layout/Layout";
import HybridLayout from "./HybridLayout";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";
import { useApplyTenantTheme } from "@/hooks/useApplyTenantTheme";

/**
 * SkinAwareLayout — drop-in for `<Layout>` that automatically swaps to
 * `<HybridLayout>` when the active tenant uses the Hybrid skin. Lets
 * existing functional pages (Flights/Hotels/Tours results, Detail,
 * Booking, etc.) inherit Hybrid editorial chrome with a 1-line change.
 */
const SkinAwareLayout = ({
  children,
  hideFooter = false,
}: {
  children: ReactNode;
  hideFooter?: boolean;
}) => {
  const { isHybrid } = useIsHybridSkin();
  // Apply the active tenant's design tokens (primary/accent/background/fonts)
  // to :root so every page — including functional results/detail/booking
  // pages that don't go through TenantSiteRenderer — picks up the tenant's
  // brand colors via the existing shadcn semantic CSS variables.
  useApplyTenantTheme();
  if (isHybrid) return <HybridLayout hideFooter={hideFooter}>{children}</HybridLayout>;
  return <Layout hideFooter={hideFooter}>{children}</Layout>;
};

export default SkinAwareLayout;