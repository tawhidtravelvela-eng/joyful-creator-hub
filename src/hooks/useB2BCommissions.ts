import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CommissionRuleLite, AitSettings } from "@/lib/b2bFareBreakdown";

interface State {
  rules: CommissionRuleLite[];
  ait: AitSettings | null;
  loading: boolean;
}

let cached: { rules: CommissionRuleLite[]; ait: AitSettings | null } | null = null;
let inflight: Promise<void> | null = null;

const load = async () => {
  if (cached) return;
  if (inflight) return inflight;
  inflight = (async () => {
    const [rulesRes, aitRes] = await Promise.all([
      supabase
        .from("commission_rules")
        .select("carrier_code, api_provider, module, commission_type, profit_type, amount, is_active")
        .eq("is_active", true),
      supabase
        .from("api_settings")
        .select("is_active, settings")
        .eq("provider", "ait_settings")
        .maybeSingle(),
    ]);

    const rules: CommissionRuleLite[] = (rulesRes.data as any[] | null) || [];
    const aitData = aitRes.data as any;
    const ait: AitSettings | null = aitData
      ? { enabled: !!aitData.is_active, perApi: (aitData.settings?.per_api as Record<string, number>) || {} }
      : null;

    cached = { rules, ait };
  })();
  try { await inflight; } finally { inflight = null; }
};

export const useB2BCommissions = (): State => {
  const [state, setState] = useState<State>({
    rules: cached?.rules || [],
    ait: cached?.ait || null,
    loading: !cached,
  });

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    load().then(() => {
      if (cancelled || !cached) return;
      setState({ rules: cached.rules, ait: cached.ait, loading: false });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
};