import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import HybridHeader from "./HybridHeader";
import HybridFooter from "./HybridFooter";
import HybridPageHeader from "./HybridPageHeader";
import BackToTop from "@/components/layout/BackToTop";
import CrispChat from "@/components/layout/CrispChat";

/**
 * HybridLayout — drop-in replacement for the platform `Layout` on Hybrid
 * tenant pages. Provides editorial header + footer + ambient background so
 * functional pages (Flights/Hotels/Tours results, Detail, Booking, etc.)
 * never expose Travel Vela platform chrome.
 */
const HybridLayout = ({
  children,
  hideFooter = false,
}: {
  children: ReactNode;
  hideFooter?: boolean;
}) => {
  const { pathname, search } = useLocation();
  const headerBand = resolveHybridBand(pathname, search);
  return (
    <div className="hybrid-skin-active min-h-screen flex flex-col scroll-smooth bg-background relative">
      {/* Ambient editorial background — dotted grid + soft primary glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-[hsl(var(--primary)/0.10)] blur-[120px]" />
        <div className="absolute top-[40%] -left-40 w-[460px] h-[460px] rounded-full bg-[hsl(var(--accent)/0.08)] blur-[120px]" />
      </div>

      <HybridHeader />
      <main className="flex-1 basis-auto">
        {headerBand && (
          <HybridPageHeader
            eyebrow={headerBand.eyebrow}
            title={headerBand.title}
            subtitle={headerBand.subtitle}
          />
        )}
        {children}
      </main>
      {!hideFooter && <HybridFooter />}
      <BackToTop />
      <CrispChat />
    </div>
  );
};

export default HybridLayout;

/**
 * Decide whether to inject an editorial page-header band above the
 * functional content. Skipped on landing slugs (which already render
 * their own Hybrid hero block) and on full-bleed pages.
 */
function resolveHybridBand(
  pathname: string,
  search: string,
): { eyebrow?: string; title: string; subtitle?: string } | null {
  const hasQuery = !!search && search.length > 1;

  // Landing slugs — skin composition handles its own hero block.
  if (pathname === "/" || pathname === "/blog") return null;
  if (pathname === "/flights" && !hasQuery) return null;
  if (pathname === "/hotels" && !hasQuery) return null;
  if (pathname === "/tours" && !hasQuery) return null;
  // Partner / B2B landing slugs render their own editorial hero
  // (PartnerLanding.tsx) — never inject a duplicate page-header band.
  if (pathname === "/partners" || pathname.startsWith("/partners/")) return null;
  if (pathname.startsWith("/p/")) return null;

  if (pathname.startsWith("/flights/") && pathname.endsWith("/book"))
    return { eyebrow: "Booking", title: "Complete your booking", subtitle: "Secure checkout — your fare is held for the next few minutes." };
  if (pathname.startsWith("/flights/"))
    return { eyebrow: "Flight", title: "Review flight details" };
  if (pathname === "/flights")
    return { eyebrow: "Search results", title: "Flight options", subtitle: "Compare fares and pick the right departure for your trip." };

  if (pathname.match(/^\/hotels\/.+\/book$/))
    return { eyebrow: "Booking", title: "Complete your stay booking" };
  if (pathname.startsWith("/hotels/"))
    return { eyebrow: "Stay", title: "Review property details" };
  if (pathname === "/hotels")
    return { eyebrow: "Search results", title: "Available stays", subtitle: "Curated properties matched to your dates and destination." };

  if (pathname.match(/^\/tours\/.+\/book$/))
    return { eyebrow: "Booking", title: "Complete your experience booking" };
  if (pathname.startsWith("/tours/"))
    return { eyebrow: "Experience", title: "Review experience details" };
  if (pathname === "/tours")
    return { eyebrow: "Search results", title: "Experience matches", subtitle: "Handpicked tours and activities for your destination." };

  if (pathname === "/transfers")
    return { eyebrow: "Transfers", title: "Door-to-door ground transport" };
  if (pathname === "/trip-planner")
    return { eyebrow: "AI Planner", title: "Design your perfect trip", subtitle: "Tell us where and when. Our AI does the rest." };
  if (pathname === "/dashboard")
    return { eyebrow: "Dashboard", title: "Welcome back" };
  if (pathname === "/affiliate" || pathname === "/affiliate-portal")
    return { eyebrow: "Affiliates", title: "Affiliate dashboard" };
  if (pathname === "/flight-status")
    return { eyebrow: "Status", title: "Live flight status" };

  if (pathname.startsWith("/blog/author/"))
    return { eyebrow: "Journal", title: "Author" };
  if (pathname.startsWith("/blog/"))
    return { eyebrow: "Journal", title: "Story" };

  if (pathname === "/booking/confirmation")
    return { eyebrow: "Confirmation", title: "Your booking is confirmed" };
  if (pathname.startsWith("/booking/pay/"))
    return { eyebrow: "Payment", title: "Complete your payment" };
  if (pathname.startsWith("/booking/ticket/"))
    return { eyebrow: "Ticket", title: "Your e-ticket" };

  if (pathname === "/terms-and-conditions")
    return { eyebrow: "Legal", title: "Terms & Conditions" };
  if (pathname === "/privacy-policy")
    return { eyebrow: "Legal", title: "Privacy Policy" };
  if (pathname === "/refund-policy")
    return { eyebrow: "Legal", title: "Refund Policy" };

  return null;
}