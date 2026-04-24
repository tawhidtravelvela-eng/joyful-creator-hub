/**
 * WhatsNewPanel — lists newly-released platform features and lets the
 * tenant opt-in (for opt_in rollout) or just acknowledge (for auto rollout).
 * Auto-enabled features are pre-flipped on; tenant simply taps "Got it".
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Feature {
  feature_key: string;
  display_name: string;
  description: string | null;
  category: string;
  required_plan_flag: string | null;
  rollout_mode: "auto" | "opt_in" | "staged";
  default_enabled: boolean;
  released_at: string;
}
interface Status {
  feature_key: string;
  enabled: boolean;
  acknowledged: boolean;
}

export function WhatsNewPanel() {
  const { user } = useAuth();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({});
  const [modules, setModules] = useState<Record<string, any> | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    const tId = profile?.tenant_id;
    setTenantId(tId || null);

    const [{ data: feats }, { data: mods }, { data: stat }] = await Promise.all([
      supabase.from("platform_features").select("*").eq("is_active", true).order("released_at", { ascending: false }),
      (supabase as any).rpc("get_my_tenant_modules"),
      tId ? supabase.from("tenant_feature_status").select("*").eq("tenant_id", tId) : Promise.resolve({ data: [] as any[] }),
    ]);
    setFeatures((feats as any[]) || []);
    setModules(mods || {});
    const map: Record<string, Status> = {};
    ((stat as any[]) || []).forEach((s: any) => { map[s.feature_key] = s; });
    setStatusMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const isPlanOk = (f: Feature) => !f.required_plan_flag || !!modules?.[f.required_plan_flag];

  const isOn = (f: Feature) => {
    const s = statusMap[f.feature_key];
    if (s) return s.enabled;
    return f.rollout_mode === "auto" ? f.default_enabled : false;
  };

  const toggle = async (f: Feature, next: boolean) => {
    if (!tenantId) return;
    const payload = {
      tenant_id: tenantId, feature_key: f.feature_key, enabled: next,
      acknowledged: true, enabled_at: next ? new Date().toISOString() : null,
      enabled_by: user?.id ?? null,
    };
    const { error } = await (supabase as any).from("tenant_feature_status").upsert(payload, { onConflict: "tenant_id,feature_key" });
    if (error) { toast.error(error.message); return; }
    setStatusMap((m) => ({ ...m, [f.feature_key]: { ...payload } as any }));
    toast.success(next ? `${f.display_name} enabled` : `${f.display_name} disabled`);
  };

  const acknowledge = async (f: Feature) => {
    if (!tenantId) return;
    const next = isOn(f);
    await toggle(f, next);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!features.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> What's new
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {features.map((f) => {
          const planOk = isPlanOk(f);
          const on = isOn(f);
          const ack = statusMap[f.feature_key]?.acknowledged;
          return (
            <div key={f.feature_key} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">{f.display_name}</span>
                    <Badge variant={f.rollout_mode === "auto" ? "default" : "outline"} className="text-xs capitalize">
                      {f.rollout_mode === "auto" ? "Auto-enabled" : "Opt-in"}
                    </Badge>
                    {!planOk && <Badge variant="secondary" className="text-xs">Plan upgrade required</Badge>}
                  </div>
                  {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={on && planOk}
                    disabled={!planOk}
                    onCheckedChange={(v) => toggle(f, v)}
                  />
                </div>
              </div>
              {!ack && planOk && (
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="ghost" onClick={() => acknowledge(f)}>
                    <Check className="w-4 h-4 mr-1" /> Got it
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}