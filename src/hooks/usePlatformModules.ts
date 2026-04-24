import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the platform-wide module kill-switch (`platform_module_settings`).
 * When a module's `is_enabled` is false, every tenant site AND the platform
 * homepage must hide it — no tenant can re-enable it from their dashboard.
 *
 * Returns `enabled[module_key]`. Missing rows default to `true` (enabled).
 */
export function usePlatformModules() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("platform_module_settings")
        .select("module_key, is_enabled");
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      for (const r of (data as Array<{ module_key: string; is_enabled: boolean }> | null) || []) {
        map[r.module_key] = !!r.is_enabled;
      }
      setEnabled(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /** True when the module is enabled platform-wide (default true if not configured). */
  const isEnabled = (key: string): boolean => enabled[key] ?? true;

  return { enabled, isEnabled, loading };
}
