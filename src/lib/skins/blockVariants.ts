/**
 * Variant engine — global registry of layout variants per block.
 *
 * Two-layer model:
 *  1. **Global registry** (this file) — every variant a block *could* render,
 *     with a thumbnail and a short label for the Page Builder UI.
 *  2. **Skin whitelist** (`skin_definitions.variant_whitelist`) — per skin,
 *     which variants are *allowed* to be picked, plus the skin default.
 *
 * Tenants pick from the whitelist; AI auto-selection also picks from the
 * whitelist. A variant added here but not in any skin's whitelist is dormant.
 *
 * IMPORTANT: variants are presentation-only. They wrap the block's existing
 * functional UI (search forms, data fetchers, …) and never re-implement it.
 * That's how we guarantee the variant engine cannot break search, results,
 * booking, or any business logic.
 */

export interface VariantDescriptor {
  /** Stable variant key stored in tenant_skin_config.section_variant_overrides */
  key: string;
  /** Short human label for pickers */
  label: string;
  /** One-line description shown under the thumbnail */
  description: string;
  /** Optional preview image URL (added by designers; falls back to a CSS sketch) */
  preview_image_url?: string | null;
  /** Mood tags used by the AI auto-picker (luxury, bold, minimal, editorial, …) */
  mood_tags?: string[];
}

/**
 * Global variant catalogue keyed by `block_key`. To add a new variant:
 *  1. Add an entry here with a unique `key` for that block.
 *  2. Implement the rendering branch inside the block component, gated on
 *     `useBlockVariant(blockKey)`.
 *  3. Add the variant `key` to a skin's `variant_whitelist` in the database
 *     so it actually appears for tenants on that skin.
 */
export const BLOCK_VARIANTS: Record<string, VariantDescriptor[]> = {
  "hero.search-mixed": [
    {
      key: "cinematic",
      label: "Cinematic",
      description:
        "Full-bleed photo hero with a floating glass search card overlapping the bottom edge.",
      mood_tags: ["bold", "premium", "editorial"],
    },
    {
      key: "editorial-split",
      label: "Editorial Split",
      description:
        "Two-column layout — narrative copy on the left, search card on the right. Calmer, agency-style.",
      mood_tags: ["minimal", "editorial", "trustworthy"],
    },
  ],
};

/** All known variants for a block. Empty array when none are registered. */
export function getBlockVariants(blockKey: string): VariantDescriptor[] {
  return BLOCK_VARIANTS[blockKey] || [];
}

/** True when this block has 2+ variants and is therefore variant-aware. */
export function isVariantBlock(blockKey: string): boolean {
  return (BLOCK_VARIANTS[blockKey]?.length || 0) > 1;
}

export interface SkinVariantWhitelistEntry {
  allowed: string[];
  default: string;
}

export type SkinVariantWhitelist = Record<string, SkinVariantWhitelistEntry>;

/**
 * Resolve the variant for a block on a given skin, given the tenant's
 * per-block override (from `tenant_skin_config.section_variant_overrides`)
 * and the skin's variant whitelist (from `skin_definitions.variant_whitelist`).
 *
 * Resolution order:
 *   1. Tenant override, if it's in the skin's `allowed` list.
 *   2. Skin's `default` for this block.
 *   3. First entry of `BLOCK_VARIANTS[blockKey]`.
 *   4. `"default"` (handled by the block component).
 */
export function resolveBlockVariant(
  blockKey: string,
  whitelist: SkinVariantWhitelist | null | undefined,
  tenantOverride: string | null | undefined,
): string {
  const entry = whitelist?.[blockKey];
  if (tenantOverride && entry?.allowed?.includes(tenantOverride)) {
    return tenantOverride;
  }
  if (entry?.default) return entry.default;
  const first = BLOCK_VARIANTS[blockKey]?.[0]?.key;
  return first || "default";
}