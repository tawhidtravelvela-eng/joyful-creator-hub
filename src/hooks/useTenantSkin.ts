import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { getSkin } from "@/lib/skins/registry";
import { resolveSkinTokens } from "@/lib/skins/designPresets";
import type {
  BlockInstance,
  DesignTokens,
  PageComposition,
  ResolvedTenantSkin,
  SkinKey,
} from "@/lib/skins/types";
import type { SkinVariantWhitelist } from "@/lib/skins/blockVariants";

interface State {
  data: ResolvedTenantSkin | null;
  loading: boolean;
  error: string | null;
}

const DEFAULT_MODULES = {
  flights: true,
  hotels: true,
  tours: true,
  transfers: true,
  ai_trip_planner: true,
};

/**
 * Resolves the active tenant's skin + page composition + design tokens.
 *
 * - When no tenant is matched (platform domain), returns null and the
 *   caller should render the platform default homepage.
 * - When a tenant is matched but has no skin row yet, falls back to the
 *   "b2c-general" skin so the site is never blank.
 */
export function useTenantSkin(pageSlug = "home", tenantIdOverride?: string | null) {
  const { tenant, loading: tenantLoading } = useTenant();
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const effectiveTenantId = tenantIdOverride || tenant?.id || null;
    const waitingForTenant = !tenantIdOverride && tenantLoading;

    if (waitingForTenant) return;
    if (!effectiveTenantId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [skinRes, pageRes, globalModulesRes, skinDefRes] = await Promise.all([
          supabase
            .from("tenant_skin_config")
            .select(
              "skin_key, enabled_modules, design_token_overrides, section_variant_overrides, locked_variants, locked_content, primary_color, accent_color, background_color, font_heading, font_body, border_radius, density",
            )
            .eq("tenant_id", effectiveTenantId)
            .maybeSingle(),
          supabase
            .from("tenant_page_composition")
            .select(
              "page_slug, page_title, meta_description, block_instances, is_published",
            )
            .eq("tenant_id", effectiveTenantId)
            .eq("page_slug", pageSlug)
            .maybeSingle(),
          supabase
            .from("platform_module_settings" as any)
            .select("module_key, is_enabled"),
          // Variant whitelist lives on the skin row itself so a designer can
          // curate "which variants are allowed for this skin" without
          // touching tenant rows.
          supabase
            .from("skin_definitions" as any)
            .select("skin_key, variant_whitelist"),
        ]);

        if (cancelled) return;

        const skinRow = skinRes.data;
        const pageRow = pageRes.data;

        const skinKey = (skinRow?.skin_key as SkinKey) || "b2c-general";
        const definition = getSkin(skinKey);

        // Resolve the variant whitelist for this skin (designer-curated DB
        // row). Missing row → empty whitelist; the variant resolver will
        // fall back to the first registered variant per block.
        const skinDefs =
          (skinDefRes.data as unknown as
            | Array<{ skin_key: string; variant_whitelist: SkinVariantWhitelist | null }>
            | null) || [];
        const skinDefRow = skinDefs.find((d) => d.skin_key === skinKey);
        const variantWhitelist: SkinVariantWhitelist =
          (skinDefRow?.variant_whitelist as SkinVariantWhitelist) || {};
        const variantOverrides =
          (skinRow?.section_variant_overrides as Record<string, string> | null) ||
          {};

        const rawBlocks = pageRow?.block_instances;
        // Prefer DB composition → skin's per-slug default → skin homepage default.
        const slugDefault =
          definition.slug_compositions?.[pageSlug] ?? definition.default_blocks;
        const blocks: BlockInstance[] = Array.isArray(rawBlocks)
          ? (rawBlocks as unknown as BlockInstance[])
          : slugDefault;

        const composition: PageComposition = {
          page_slug: pageSlug,
          page_title: pageRow?.page_title ?? null,
          meta_description: pageRow?.meta_description ?? null,
          blocks,
          is_published: pageRow?.is_published ?? true,
        };

        // Layer tenant overrides on top of the skin's signature preset so
        // every skin instantly looks distinct, even when the tenant has
        // not customised any tokens themselves.
        const designTokens: DesignTokens = resolveSkinTokens(skinKey, {
          primary_color: skinRow?.primary_color ?? null,
          accent_color: skinRow?.accent_color ?? null,
          background_color: skinRow?.background_color ?? null,
          font_heading: skinRow?.font_heading ?? null,
          font_body: skinRow?.font_body ?? null,
          border_radius: skinRow?.border_radius ?? null,
          density: (skinRow?.density as DesignTokens["density"]) ?? null,
        });

        // Build the global kill-switch map. Missing rows → assume enabled.
        const globalRows =
          (globalModulesRes.data as unknown as
            | Array<{ module_key: string; is_enabled: boolean }>
            | null) || [];
        const globalModules: Record<string, boolean> = {};
        for (const r of globalRows) globalModules[r.module_key] = !!r.is_enabled;

        // Tenant preference (or default), then AND with global flag — a
        // module disabled by the platform admin can never be enabled by a
        // tenant.
        const tenantPrefs = {
          ...DEFAULT_MODULES,
          ...((skinRow?.enabled_modules as Record<string, boolean>) || {}),
        };
        const enabledModules: Record<string, boolean> = {};
        for (const k of Object.keys(tenantPrefs)) {
          const tenantOn = !!tenantPrefs[k];
          const globalOn = globalModules[k] ?? true;
          enabledModules[k] = tenantOn && globalOn;
        }

        setState({
          data: {
            skin_key: skinKey,
            definition,
            enabled_modules: enabledModules,
            design_tokens: designTokens,
            composition,
            variant_whitelist: variantWhitelist,
            section_variant_overrides: variantOverrides,
          },
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: (e as Error).message,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenant?.id, tenantIdOverride, tenantLoading, pageSlug]);

  return state;
}