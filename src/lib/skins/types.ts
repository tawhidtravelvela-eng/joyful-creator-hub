/**
 * Phase 0c — Skin & block system types.
 *
 * A "skin" is a high-level visual + layout family (e.g. "b2c-flight").
 * A "block" is a single page section (hero, search, deals, footer, …).
 * A tenant's homepage is composed of an ordered list of block instances,
 * each rendered by a registered React component.
 */

export type SkinKey =
  | "b2c-flight"
  | "b2c-hotel"
  | "b2c-tour"
  | "b2c-general"
  | "hybrid-full"
  | "b2b-corporate";

export interface SkinDefinition {
  skin_key: SkinKey;
  display_name: string;
  description: string;
  audience: "b2c" | "b2b" | "hybrid" | "corporate";
  vertical: "flights" | "hotels" | "tours" | "general" | "mixed" | "corporate";
  default_blocks: BlockInstance[];
  /**
   * Optional per-slug default compositions used when a tenant has no
   * `tenant_page_composition` row for that slug yet. Keyed by `page_slug`
   * (e.g. "flights", "hotels", "tours"). The "home" slug always reads from
   * `default_blocks` for backwards compatibility.
   */
  slug_compositions?: Record<string, BlockInstance[]>;
}

export interface BlockInstance {
  block_key: string;
  /** stable instance id so editors can reorder without remounting */
  instance_id?: string;
  /** per-instance content overrides merged into the block's defaults */
  content?: Record<string, unknown>;
  /** if false, block is hidden but kept in the composition for easy re-enable */
  enabled?: boolean;
}

export interface PageComposition {
  page_slug: string;
  page_title?: string | null;
  meta_description?: string | null;
  blocks: BlockInstance[];
  is_published: boolean;
}

export interface DesignTokens {
  primary_color?: string | null;
  accent_color?: string | null;
  background_color?: string | null;
  font_heading?: string | null;
  font_body?: string | null;
  border_radius?: string | null;
  density?: "compact" | "cozy" | "roomy" | null;
}

export interface ResolvedTenantSkin {
  skin_key: SkinKey;
  definition: SkinDefinition;
  enabled_modules: Record<string, boolean>;
  design_tokens: DesignTokens;
  composition: PageComposition;
  /**
   * Designer-curated whitelist of layout variants per block_key for this
   * skin (loaded from `skin_definitions.variant_whitelist`). The variant
   * resolver picks from `allowed`, falling back to `default`.
   */
  variant_whitelist?: Record<string, { allowed: string[]; default: string }>;
  /**
   * Per-block tenant variant overrides
   * (loaded from `tenant_skin_config.section_variant_overrides`).
   * Shape: `{ "<block_key>": "<variant_key>" }`.
   */
  section_variant_overrides?: Record<string, string>;
}