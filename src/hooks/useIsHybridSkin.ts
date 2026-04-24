import { useTenantSkin } from "@/hooks/useTenantSkin";

/**
 * Returns `true` when the active tenant uses the `hybrid-full` skin.
 *
 * Implemented as a thin wrapper around `useTenantSkin` so we share the
 * same data fetch (and the same auth/RLS context) that the SkinAware
 * layout already uses to pick the Hybrid header. Previously this hook
 * issued its own anonymous query against `tenant_skin_config`, but
 * RLS on that table only permits tenant members + super_admins to read,
 * which meant pre-auth fetches resolved as "no data" → `false` and the
 * page locked into the legacy non-Hybrid body even though the header
 * had already swapped to the Hybrid skin.
 */
export function useIsHybridSkin() {
  const { data, loading } = useTenantSkin();
  return {
    isHybrid: data?.skin_key === "hybrid-full",
    loading,
  };
}