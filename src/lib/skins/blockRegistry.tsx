import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { useBlockOverride } from "@/hooks/useBlockOverride";

/**
 * Block component registry.
 *
 * Each `block_key` from the skin registry maps to a lazy-loaded React
 * component. We deliberately re-use the existing homepage section
 * components so introducing the skin system requires zero new UI work.
 *
 * Unknown / future block keys fall through to a small placeholder.
 */

const HeroSection = lazy(() => import("@/components/home/HeroSection"));
const TrendingFlights = lazy(() => import("@/components/home/TrendingFlights"));
const HotelDestinations = lazy(() => import("@/components/home/HotelDestinations"));
const DestinationsSection = lazy(() => import("@/components/home/DestinationsSection"));
const WhyChooseUs = lazy(() => import("@/components/home/WhyChooseUs"));
const TestimonialsSection = lazy(() => import("@/components/home/TestimonialsSection"));
const NewsletterSection = lazy(() => import("@/components/home/NewsletterSection"));
const StatsBar = lazy(() => import("@/components/home/StatsBar"));
const DealsTabbedFromCity = lazy(() => import("@/components/home/blocks/DealsTabbedFromCity"));
const HybridHero = lazy(() => import("@/components/home/blocks/HybridHero"));
const AiPlannerBanner = lazy(() => import("@/components/home/blocks/AiPlannerBanner"));
const GrowYourBusiness = lazy(() => import("@/components/home/blocks/GrowYourBusiness"));
const SubscribeStrip = lazy(() => import("@/components/home/blocks/SubscribeStrip"));
const SkinFooter = lazy(() => import("@/components/home/blocks/SkinFooter"));
const HybridFlightsLanding = lazy(() => import("@/components/home/blocks/HybridFlightsLanding"));
const HybridHotelsLanding = lazy(() => import("@/components/home/blocks/HybridHotelsLanding"));
const HybridToursLanding = lazy(() => import("@/components/home/blocks/HybridToursLanding"));
const HybridBlogLanding = lazy(() => import("@/components/home/blocks/HybridBlogLanding"));
const HybridAiPlanner = lazy(() => import("@/components/home/blocks/HybridAiPlanner"));

function CtaAgentSignup() {
  const ov = useBlockOverride();
  const c = ov?.content || {};
  const headline =
    (c.headline as string) || "Become a registered travel partner";
  const subheadline =
    (c.subheadline as string) ||
    "Get wholesale rates, branded booking pages, and a wallet-funded settlement account.";
  const ctaLabel = (c.cta_label as string) || "Apply for an agent account";
  const ctaHref = (c.cta_href as string) || "/register/agent";
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-3">{headline}</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">
          {subheadline}
        </p>
        <a
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition"
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}

function CorporateMarketingHero() {
  const ov = useBlockOverride();
  const c = ov?.content || {};
  const headline = (c.headline as string) || "Corporate travel, controlled.";
  const subheadline =
    (c.subheadline as string) ||
    "A private booking portal for your team — negotiated fares, central billing, and full policy controls.";
  const ctaLabel = (c.cta_label as string) || "Sign in to your portal";
  const ctaHref = (c.cta_href as string) || "/auth";
  return (
    <section className="py-24 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 max-w-3xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          {headline}
        </h1>
        <p className="text-lg text-muted-foreground mb-8">{subheadline}</p>
        <a
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition"
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}

function PlaceholderBlock({ blockKey }: { blockKey: string }) {
  if (import.meta.env.PROD) return null;
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
        Block <code className="font-mono">{blockKey}</code> is not yet
        registered.
      </div>
    </div>
  );
}

/** Hero variants share the same component — variant selection comes later. */
const heroBlock: ComponentType = HeroSection;

export const BLOCK_COMPONENTS: Record<string, ComponentType<any>> = {
  "hero.search-flight": heroBlock,
  "hero.search-hotel": heroBlock,
  "hero.search-tour": heroBlock,
  "hero.search-mixed": HybridHero,
  "hero.corporate-marketing": CorporateMarketingHero,
  "trending.flights": TrendingFlights,
  "destination.popular": DestinationsSection,
  "destination.hotel-cities": HotelDestinations,
  "feature.why-choose-us": WhyChooseUs,
  "testimonial.standard": TestimonialsSection,
  "newsletter.signup": NewsletterSection,
  "stat.bar": StatsBar,
  "cta.agent-signup": CtaAgentSignup,
  "deals.tabbed-from-city": DealsTabbedFromCity,
  "promo.ai-planner": AiPlannerBanner,
  "promo.grow-business": GrowYourBusiness,
  "newsletter.subscribe-strip": SubscribeStrip,
  "footer.skin-columns": SkinFooter,
  "landing.flights-hybrid": HybridFlightsLanding,
  "landing.hotels-hybrid": HybridHotelsLanding,
  "landing.tours-hybrid": HybridToursLanding,
  "landing.blog-hybrid": HybridBlogLanding,
  "promo.ai-planner-hybrid": HybridAiPlanner,
};

const BlockFallback = () => (
  <div className="py-10 flex items-center justify-center">
    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
  </div>
);

export function renderBlock(
  blockKey: string,
  content?: Record<string, unknown>,
) {
  const Cmp = BLOCK_COMPONENTS[blockKey];
  if (!Cmp) return <PlaceholderBlock blockKey={blockKey} />;
  return (
    <Suspense fallback={<BlockFallback />}>
      <Cmp {...(content || {})} />
    </Suspense>
  );
}

/** All block keys known to the runtime (used by the studio block picker). */
export const KNOWN_BLOCK_KEYS = Object.keys(BLOCK_COMPONENTS).sort();