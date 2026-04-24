/**
 * layoutPresets — six identity-defining presets the AI picks from when seeding
 * a tenant site. Each preset bundles:
 *   - default home-page section ORDER (mirror-mode keys)
 *   - default section VARIANT picks (overridable by AI)
 *   - suggested font pairing (heading + body)
 *   - palette nudge hints (the AI uses brand color first; this is a fallback)
 *   - audience/personality affinity used to score presets vs wizard inputs
 *
 * Why a registry: lets the AI return just `layout_preset: "luxury"` and the
 * renderer + seeder resolve the rest deterministically — keeps prompts short
 * and outputs stable.
 */

export type LayoutPresetKey =
  | "ota"
  | "corporate"
  | "hotel"
  | "flight"
  | "tour"
  | "ai_powered";

export interface LayoutPreset {
  key: LayoutPresetKey;
  label: string;
  description: string;
  /** Default ordered section keys for the home page. Mirror-mode keys. */
  defaultSections: string[];
  /** Default variant per section. Section keys not listed get the section's own default. */
  defaultVariants: Record<string, string>;
  fonts: { heading: string; body: string };
  paletteHint: { primary: string; accent: string };
  /** Audience/personality affinities the AI scores against the wizard. */
  affinity: {
    audience?: string[];
    productFocus?: string[];
    personality?: string[];
  };
}

export const LAYOUT_PRESETS: Record<LayoutPresetKey, LayoutPreset> = {
  ota: {
    key: "ota",
    label: "Modern OTA",
    description: "Search-first, conversion-optimized, dense.",
    defaultSections: [
      "hero", "stats", "trending", "deals", "destinations",
      "features", "testimonials", "newsletter",
    ],
    defaultVariants: {
      hero: "search-overlay",
      destinations: "image-heavy",
      features: "3-col",
      testimonials: "cards",
      footer: "detailed",
    },
    fonts: { heading: "Inter", body: "Inter" },
    paletteHint: { primary: "#0F62FE", accent: "#0B3D91" },
    affinity: { audience: ["leisure", "mixed"], productFocus: ["flights", "mixed"], personality: ["modern", "bold"] },
  },

  corporate: {
    key: "corporate",
    label: "Corporate Travel",
    description: "Trust-led, muted palette, B2B tone.",
    defaultSections: [
      "hero", "features", "trending", "destinations", "testimonials", "newsletter",
    ],
    defaultVariants: {
      hero: "split",
      destinations: "minimal",
      features: "icon-grid",
      testimonials: "quote-strip",
      footer: "corporate",
    },
    fonts: { heading: "Inter", body: "Inter" },
    paletteHint: { primary: "#1F2A44", accent: "#5B6B8C" },
    affinity: { audience: ["corporate", "agents"], productFocus: ["flights", "hotels"], personality: ["classic", "minimal"] },
  },

  hotel: {
    key: "hotel",
    label: "Hotel-First",
    description: "Hotel-centric hero, room search, neighborhood picks.",
    defaultSections: [
      "hero", "destinations", "trending", "features", "testimonials", "newsletter",
    ],
    defaultVariants: {
      hero: "split",
      destinations: "premium-grid",
      features: "split-image",
      testimonials: "cards",
      footer: "detailed",
    },
    fonts: { heading: "Playfair Display", body: "Inter" },
    paletteHint: { primary: "#7A4E2D", accent: "#D9B382" },
    affinity: { audience: ["leisure", "luxury"], productFocus: ["hotels"], personality: ["warm", "premium"] },
  },

  flight: {
    key: "flight",
    label: "Flight-First",
    description: "Flight-centric hero, deals strip, route inspiration.",
    defaultSections: [
      "hero", "trending", "deals", "destinations", "features", "newsletter",
    ],
    defaultVariants: {
      hero: "search-overlay",
      destinations: "image-heavy",
      features: "3-col",
      testimonials: "cards",
      footer: "compact",
    },
    fonts: { heading: "Inter", body: "Inter" },
    paletteHint: { primary: "#D32F2F", accent: "#1E1E1E" },
    affinity: { audience: ["leisure", "agents", "mixed"], productFocus: ["flights"], personality: ["bold", "modern"] },
  },

  tour: {
    key: "tour",
    label: "Tour & Experience",
    description: "Editorial cards, story tone, large imagery.",
    defaultSections: [
      "hero", "destinations", "trending", "features", "testimonials", "blog", "newsletter",
    ],
    defaultVariants: {
      hero: "video-bg",
      destinations: "premium-grid",
      features: "split-image",
      testimonials: "video",
      footer: "detailed",
    },
    fonts: { heading: "Playfair Display", body: "Inter" },
    paletteHint: { primary: "#0E7C66", accent: "#F5C24A" },
    affinity: { audience: ["leisure", "luxury"], productFocus: ["tours"], personality: ["warm", "premium", "bold"] },
  },

  ai_powered: {
    key: "ai_powered",
    label: "AI-Powered",
    description: "AI planner front-and-center for inspiration-led discovery.",
    defaultSections: [
      "hero", "ai_planner", "trending", "destinations", "features", "testimonials", "newsletter",
    ],
    defaultVariants: {
      hero: "centered",
      destinations: "image-heavy",
      features: "icon-grid",
      testimonials: "cards",
      footer: "compact",
    },
    fonts: { heading: "Inter", body: "Inter" },
    paletteHint: { primary: "#7C3AED", accent: "#22D3EE" },
    affinity: { audience: ["leisure", "mixed"], productFocus: ["mixed", "tours"], personality: ["modern", "bold"] },
  },
};

export const ALL_PRESET_KEYS = Object.keys(LAYOUT_PRESETS) as LayoutPresetKey[];

/** Resolve preset key → preset (defaults to `ota` if unknown). */
export function getPreset(key?: string | null): LayoutPreset {
  if (key && (LAYOUT_PRESETS as any)[key]) return LAYOUT_PRESETS[key as LayoutPresetKey];
  return LAYOUT_PRESETS.ota;
}

/**
 * Score-based local fallback when the AI doesn't pick a preset (offline / fail).
 * Picks the preset whose affinity best matches the wizard inputs.
 */
export function suggestPresetLocally(input: {
  audience?: string;
  productFocus?: string;
  personality?: string;
}): LayoutPresetKey {
  let best: LayoutPresetKey = "ota";
  let bestScore = -1;
  for (const p of Object.values(LAYOUT_PRESETS)) {
    let score = 0;
    if (input.audience && p.affinity.audience?.includes(input.audience)) score += 2;
    if (input.productFocus && p.affinity.productFocus?.includes(input.productFocus)) score += 3;
    if (input.personality && p.affinity.personality?.includes(input.personality)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = p.key;
    }
  }
  return best;
}