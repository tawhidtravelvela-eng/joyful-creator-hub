import Layout from "@/components/site/hybrid/SkinAwareLayout";
import HeroSection from "@/components/home/HeroSection";
import StatsBar from "@/components/home/StatsBar";
import TrendingFlights from "@/components/home/TrendingFlights";
import DestinationsSection from "@/components/home/DestinationsSection";
import OffersSection from "@/components/home/OffersSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import NewsletterSection from "@/components/home/NewsletterSection";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import AppDownload from "@/components/home/AppDownload";
import BannersSection from "@/components/home/BannersSection";
import BlogSection from "@/components/home/BlogSection";
import AiTripPlanner from "@/components/home/AiTripPlanner";
import RecommendationsSection from "@/components/home/RecommendationsSection";
import DealsSection from "@/components/home/DealsSection";
import BudgetExplorer from "@/components/home/BudgetExplorer";
import SectionErrorBoundary from "@/components/home/SectionErrorBoundary";
import HomeJsonLd from "@/components/home/HomeJsonLd";
import { useSiteContent } from "@/hooks/useSiteContent";
import { usePlatformModules } from "@/hooks/usePlatformModules";

const sectionComponents: Record<string, React.ComponentType> = {
  hero: HeroSection,
  stats: StatsBar,
  banners: BannersSection,
  offers: OffersSection,
  ai_planner: AiTripPlanner,
  trending: TrendingFlights,
  destinations: DestinationsSection,
  recommendations: RecommendationsSection,
  deals: DealsSection,
  budget_explorer: BudgetExplorer,
  features: WhyChooseUs,
  testimonials: TestimonialsSection,
  app_download: AppDownload,
  blog: BlogSection,
  newsletter: NewsletterSection,
};

const defaultSections = [
  "hero", "stats", "trending", "ai_planner", "budget_explorer",
  "destinations", "features", "app_download", "blog", "newsletter",
];

const Index = () => {
  const { content } = useSiteContent();
  const { isEnabled } = usePlatformModules();
  const homepage = content.homepage;

  // Sections order and visibility from API, with fallback to defaults
  const sections: string[] = homepage.sections?.length ? homepage.sections : defaultSections;
  const hiddenSections: string[] = homepage.hidden_sections || [];

  // Platform-wide kill-switch: when admin disables the AI Trip Planner,
  // drop the AI planner section entirely from the homepage.
  const aiOff = !isEnabled("ai_trip_planner");

  return (
    <Layout>
      <HomeJsonLd />
      {sections
        .filter((id) => !hiddenSections.includes(id))
        .filter((id) => !(aiOff && id === "ai_planner"))
        .map((id) => {
          const Component = sectionComponents[id];
          return Component ? (
            <SectionErrorBoundary key={id} sectionName={id}>
              <Component />
            </SectionErrorBoundary>
          ) : null;
        })}
    </Layout>
  );
};

export default Index;
