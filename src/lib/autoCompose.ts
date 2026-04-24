/**
 * autoCompose — turns wizard answers into a fully-seeded Custom Website that
 * MIRRORS the main platform site (same sections, same functionality), with
 * tenant-specific branding + AI-generated unique copy.
 *
 * Phase 1 strategy:
 *   1. Resolve tenant + read their plan flags (allow_flights, allow_ai_copy, …).
 *   2. Seed the home page with the same section keys as the main-site Index,
 *      filtered by what the tenant's plan/products allow.
 *      Result: the tenant's Custom Website looks and works exactly like the
 *      platform site, but rendered inside their branded shell with their
 *      payment gateways, markups, currency lock and theme.
 *   3. Fire-and-forget the `generate-tenant-site-content` edge function to
 *      generate UNIQUE copy + SEO meta so the tenant's site reads completely
 *      differently from the main site (no SEO duplication penalty).
 *
 * Legacy variant-based templates have been removed. Tenants get a sensible
 * default theme + the mirror-mode section list.
 */
export type AudienceHint =
  | "families" | "couples" | "solo" | "business"
  | "luxury"   | "budget"  | "adventure";

export interface WizardAnswers {
  brandName: string;
  tagline?: string;
  subtitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  audience?: AudienceHint;
  /** Which products the tenant sells. Falls back to plan modules if omitted. */
  products?: { flights?: boolean; hotels?: boolean; tours?: boolean; transfers?: boolean };
  /** Hero region/destination focus, used to seed copy. */
  region?: string;
}

/**
 * Build the ordered list of main-site section KEYS for the tenant's homepage,
 * filtered by their plan/product flags. Same source-of-truth order as the
 * main-site `src/pages/Index.tsx` so launch parity is automatic.
 */
export function composeMirrorSectionKeys(
  modules: { flights?: boolean; hotels?: boolean; tours?: boolean; transfers?: boolean; ai_copy?: boolean },
  products?: WizardAnswers["products"],
): string[] {
  // Match the main-site default order from src/pages/Index.tsx
  const ALL = [
    "hero", "stats", "trending", "ai_planner", "budget_explorer",
    "destinations", "features", "app_download", "blog", "newsletter",
  ];
  // A product is enabled if either the plan or the wizard-products row allows it.
  const has = (k: keyof typeof modules) =>
    modules[k] === true || (products as any)?.[k] === true;

  return ALL.filter((key) => {
    if (key === "trending") return has("flights");
    if (key === "ai_planner") return modules.ai_copy === true;
    if (key === "budget_explorer") return has("hotels") || has("tours");
    return true;
  });
}
