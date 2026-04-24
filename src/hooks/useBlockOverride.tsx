import { createContext, useContext, type ReactNode } from "react";
import type { SiteContent } from "@/hooks/useSiteContent";
import type { DesignTokens } from "@/lib/skins/types";

/**
 * Per-block content override system.
 *
 * The Studio stores per-block edits ({ headline, subheadline, cta_label,
 * cta_href }) on each entry of `tenant_page_composition.blocks`. To make those
 * overrides actually appear on the rendered tenant site, we wrap each block
 * with a `BlockOverrideProvider` that publishes the override map plus the
 * matching `SiteContent` section key to the inner component tree.
 *
 * `useSiteContent()` then consults this context and merges the override on
 * top of the resolved content slice for that section, so existing home
 * components (which already read from `content.<section>.heading` etc.) pick
 * up the edits with no per-component changes.
 */

export interface BlockOverride {
  blockKey: string;
  /** Section slice in `SiteContent` that this block controls, if any. */
  section: keyof SiteContent | null;
  /** Raw content map saved on the block instance. */
  content: Record<string, unknown>;
  /** Tenant-level enabled product modules (flights/hotels/tours/transfers/visa). */
  enabledModules?: Record<string, boolean>;
  /** Resolved design tokens for the active tenant skin. */
  designTokens?: DesignTokens;
  /**
   * Resolved layout variant key for this block (e.g. "cinematic",
   * "editorial-split"). Read inside block components via `useBlockVariant()`.
   * Defaults to `"default"` when the block has no registered variants.
   */
  variant?: string;
}

const BlockOverrideContext = createContext<BlockOverride | null>(null);

/**
 * Map a `block_key` to the `SiteContent` section it visually controls so a
 * single override map can be merged into the right slice.
 */
export function sectionForBlock(blockKey: string): keyof SiteContent | null {
  if (blockKey.startsWith("hero.")) return "hero";
  if (blockKey.startsWith("trending.")) return "trending";
  if (blockKey.startsWith("destination.")) return "destinations";
  if (blockKey.startsWith("feature.")) return "features";
  if (blockKey.startsWith("testimonial.")) return "testimonials";
  if (blockKey.startsWith("newsletter.")) return "newsletter";
  if (blockKey.startsWith("stat.")) return "stats";
  return null;
}

/**
 * Translate the Studio's editor field names into the keys used inside the
 * matching `SiteContent` slice. Most home sections use `heading`/`subtitle`
 * already; the Studio uses `headline`/`subheadline` because those are more
 * editor-friendly. Any unknown key is passed through unchanged so blocks can
 * also override section-specific keys (e.g. `badge`, `button_text`).
 */
const FIELD_ALIASES: Record<string, string> = {
  headline: "heading",
  subheadline: "subtitle",
  cta_label: "cta_text",
};

/**
 * Build a slice patch from a raw block content map. Empty values are dropped
 * so editors can clear a field by saving it blank without erasing platform
 * defaults.
 */
export function buildSlicePatch(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === "") continue;
    const target = FIELD_ALIASES[key] || key;
    patch[target] = value;
  }
  return patch;
}

export function BlockOverrideProvider({
  blockKey,
  content,
  enabledModules,
  designTokens,
  variant,
  children,
}: {
  blockKey: string;
  content?: Record<string, unknown>;
  enabledModules?: Record<string, boolean>;
  designTokens?: DesignTokens;
  variant?: string;
  children: ReactNode;
}) {
  const value: BlockOverride = {
    blockKey,
    section: sectionForBlock(blockKey),
    content: content || {},
    enabledModules,
    designTokens,
    variant: variant || "default",
  };
  return (
    <BlockOverrideContext.Provider value={value}>
      {children}
    </BlockOverrideContext.Provider>
  );
}

/** Read the active block override (null when not inside a tenant block). */
export function useBlockOverride(): BlockOverride | null {
  return useContext(BlockOverrideContext);
}

/**
 * Convenience hook for variant-aware blocks. Returns the resolved variant key
 * (e.g. "cinematic") or `"default"` when no variant is set / outside a block.
 */
export function useBlockVariant(): string {
  const ov = useContext(BlockOverrideContext);
  return ov?.variant || "default";
}