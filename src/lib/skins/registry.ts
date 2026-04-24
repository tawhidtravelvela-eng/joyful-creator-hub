import type { BlockInstance, SkinDefinition, SkinKey } from "./types";

/**
 * Canonical registry of the 6 platform skins.
 * Mirrors the rows seeded in `public.skin_definitions` and provides
 * the *default block stack* used when a tenant has no custom composition.
 */

const heroSearch = (vertical: "flight" | "hotel" | "tour" | "mixed"): BlockInstance => ({
  block_key: `hero.search-${vertical}`,
});

export const SKIN_REGISTRY: Record<SkinKey, SkinDefinition> = {
  "b2c-flight": {
    skin_key: "b2c-flight",
    display_name: "Flight-Forward Consumer",
    description: "Bold flight-led consumer site with immersive search hero",
    audience: "b2c",
    vertical: "flights",
    default_blocks: [
      heroSearch("flight"),
      { block_key: "trending.flights" },
      { block_key: "feature.why-choose-us" },
      { block_key: "destination.popular" },
      { block_key: "testimonial.standard" },
      { block_key: "newsletter.signup" },
    ],
  },
  "b2c-hotel": {
    skin_key: "b2c-hotel",
    display_name: "Hotel & Stays Consumer",
    description: "Photo-led hotel discovery with editorial property cards",
    audience: "b2c",
    vertical: "hotels",
    default_blocks: [
      heroSearch("hotel"),
      { block_key: "destination.hotel-cities" },
      { block_key: "feature.why-choose-us" },
      { block_key: "testimonial.standard" },
      { block_key: "newsletter.signup" },
    ],
  },
  "b2c-tour": {
    skin_key: "b2c-tour",
    display_name: "Tours & Experiences",
    description: "Inspirational tours-first layout with experience storytelling",
    audience: "b2c",
    vertical: "tours",
    default_blocks: [
      heroSearch("tour"),
      { block_key: "destination.popular" },
      { block_key: "feature.why-choose-us" },
      { block_key: "testimonial.standard" },
      { block_key: "newsletter.signup" },
    ],
  },
  "b2c-general": {
    skin_key: "b2c-general",
    display_name: "Balanced All-Round",
    description: "Balanced consumer site giving equal weight to all modules",
    audience: "b2c",
    vertical: "general",
    default_blocks: [
      heroSearch("mixed"),
      { block_key: "deals.tabbed-from-city" },
      { block_key: "promo.ai-planner-hybrid" },
      { block_key: "promo.grow-business" },
      { block_key: "testimonial.standard" },
      { block_key: "footer.skin-columns" },
    ],
  },
  "hybrid-full": {
    skin_key: "hybrid-full",
    display_name: "Hybrid Consumer + Agent",
    description: "Public consumer site with auth-aware agent dashboard on the same domain",
    audience: "hybrid",
    vertical: "mixed",
    default_blocks: [
      heroSearch("mixed"),
      { block_key: "deals.tabbed-from-city" },
      { block_key: "promo.ai-planner" },
      { block_key: "promo.grow-business" },
      { block_key: "testimonial.standard" },
      { block_key: "footer.skin-columns" },
    ],
    slug_compositions: {
      flights: [
        { block_key: "landing.flights-hybrid" },
        { block_key: "footer.skin-columns" },
      ],
      hotels: [
        { block_key: "landing.hotels-hybrid" },
        { block_key: "footer.skin-columns" },
      ],
      tours: [
        { block_key: "landing.tours-hybrid" },
        { block_key: "footer.skin-columns" },
      ],
      blog: [
        { block_key: "landing.blog-hybrid" },
        { block_key: "footer.skin-columns" },
      ],
    },
  },
  "b2b-corporate": {
    skin_key: "b2b-corporate",
    display_name: "B2B Corporate Travel",
    description: "Marketing homepage with auth-walled corporate booking portal",
    audience: "corporate",
    vertical: "corporate",
    default_blocks: [
      { block_key: "hero.corporate-marketing" },
      { block_key: "feature.why-choose-us" },
      { block_key: "cta.agent-signup" },
    ],
  },
};

export const SKIN_LIST: SkinDefinition[] = Object.values(SKIN_REGISTRY);

export function getSkin(key: string | null | undefined): SkinDefinition {
  if (key && key in SKIN_REGISTRY) return SKIN_REGISTRY[key as SkinKey];
  return SKIN_REGISTRY["b2c-general"];
}