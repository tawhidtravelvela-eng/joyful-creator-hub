/**
 * sectionVariants — registry of which design variants exist per main-site
 * section. Used by:
 *   - the AI prompt (so the model knows the legal variant keys to choose)
 *   - the renderer (to map a chosen key → component implementation)
 *   - the wizard / studio UI (future variant picker)
 *
 * NOTE: this file is the single source of truth. When you add a new variant,
 * register it here AND in the section component's switch.
 */

export interface VariantDef {
  key: string;
  label: string;
  description: string;
}

export interface SectionVariantSet {
  /** Default variant key — used when AI omits the section. */
  default: string;
  variants: VariantDef[];
}

export const SECTION_VARIANTS: Record<string, SectionVariantSet> = {
  hero: {
    default: "centered",
    variants: [
      { key: "centered",        label: "Centered",        description: "Big centered headline + subhead, search below." },
      { key: "split",           label: "Split",           description: "Headline + CTA on the left, image/illustration on the right." },
      { key: "video-bg",        label: "Video Background",description: "Looping muted video behind a contrast overlay." },
      { key: "search-overlay",  label: "Search Overlay",  description: "Image background with a glassy search card overlapping." },
    ],
  },
  destinations: {
    default: "image-heavy",
    variants: [
      { key: "minimal",        label: "Minimal",       description: "Text-led tiles with thumbnails and prices." },
      { key: "image-heavy",    label: "Image Heavy",   description: "Large rounded photo cards with overlaid labels." },
      { key: "premium-grid",   label: "Premium Grid",  description: "Editorial bento grid with mixed sizes." },
    ],
  },
  features: {
    default: "3-col",
    variants: [
      { key: "3-col",         label: "Three Columns", description: "Three benefit columns with icons + body." },
      { key: "icon-grid",     label: "Icon Grid",     description: "Six-up icon grid with terse labels." },
      { key: "split-image",   label: "Split Image",   description: "Large left image with stacked feature list on the right." },
    ],
  },
  testimonials: {
    default: "cards",
    variants: [
      { key: "cards",         label: "Cards",         description: "Three quote cards with avatar and rating." },
      { key: "quote-strip",   label: "Quote Strip",   description: "Single rotating headline quote with marquee logos." },
      { key: "video",         label: "Video",         description: "Featured video testimonial + supporting cards." },
    ],
  },
  footer: {
    default: "detailed",
    variants: [
      { key: "compact",   label: "Compact",   description: "One-line brand row + minimal links." },
      { key: "detailed",  label: "Detailed",  description: "Multi-column links, contact, social." },
      { key: "corporate", label: "Corporate", description: "Logo, regulatory blurb, B2B contact, certifications." },
    ],
  },
  newsletter: {
    default: "centered",
    variants: [
      { key: "centered", label: "Centered",        description: "Centered card with email capture and privacy note." },
      { key: "inline",   label: "Inline (Brand)",  description: "Full-bleed brand-color band with inline form on the right." },
      { key: "split",    label: "Split Image",     description: "Image on the left, form on the right inside a card." },
    ],
  },
};

// Lightweight "frame" variants — applied as a visual wrapper around the
// real main-site component (no data duplication). See SectionFrame.tsx.
const FRAME_VARIANTS: Record<string, SectionVariantSet> = {
  trending: {
    default: "default",
    variants: [
      { key: "default",   label: "Default",   description: "Standard platform look." },
      { key: "band",      label: "Brand Band",description: "Full-bleed brand-tint band — high emphasis." },
      { key: "spotlight", label: "Spotlight", description: "Editorial spotlight + subtle grid for premium feel." },
    ],
  },
  deals: {
    default: "default",
    variants: [
      { key: "default",   label: "Default",  description: "Standard platform look." },
      { key: "dark",      label: "Dark Strip",description: "Inverted dark band — bold offer emphasis." },
      { key: "band",      label: "Brand Band",description: "Brand-tint band for warmer call-out." },
    ],
  },
  blog: {
    default: "default",
    variants: [
      { key: "default",   label: "Default",  description: "Standard platform look." },
      { key: "magazine",  label: "Magazine", description: "Editorial top-rule with eyebrow label." },
      { key: "spotlight", label: "Spotlight",description: "Soft accent spotlight backdrop." },
    ],
  },
};

for (const [k, v] of Object.entries(FRAME_VARIANTS)) {
  SECTION_VARIANTS[k] = v;
}

/** Section keys whose variants are visual frames (not bridged components). */
export const FRAME_SECTION_KEYS = Object.keys(FRAME_VARIANTS);

/** Resolve a chosen variant key, falling back to the section's default. */
export function resolveVariant(sectionKey: string, chosen?: string | null): string {
  const set = SECTION_VARIANTS[sectionKey];
  if (!set) return chosen || "default";
  if (chosen && set.variants.some((v) => v.key === chosen)) return chosen;
  return set.default;
}

/** Sections that currently support variants (others render single component). */
export const VARIANT_SECTION_KEYS = Object.keys(SECTION_VARIANTS);

/** For prompt injection — compact list of legal variants per section. */
export function variantOptionsForPrompt(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, set] of Object.entries(SECTION_VARIANTS)) {
    out[key] = set.variants.map((v) => v.key);
  }
  return out;
}