/**
 * SiteCapabilitiesPanel — shows which modules are enabled for the tenant
 * (driven by their B2B plan + per-tenant overrides). Read-only summary.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ModuleRow {
  key: string;
  label: string;
  enabled: boolean;
}

export function SiteCapabilitiesPanel() {
  const [rows, setRows] = useState<ModuleRow[] | null>(null);
  const [planKey, setPlanKey] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc("get_my_tenant_modules");
      if (!data) { setRows([]); return; }
      setPlanKey(data.plan_key || null);
      setExpired(!!data.is_expired);
      setRows([
        { key: "flights", label: "Flights search & booking", enabled: !!data.flights },
        { key: "hotels", label: "Hotels search & booking", enabled: !!data.hotels },
        { key: "tours", label: "Tours & activities", enabled: !!data.tours },
        { key: "transfers", label: "Airport transfers", enabled: !!data.transfers },
        { key: "custom_domain", label: "Custom domain", enabled: !!data.custom_domain },
        { key: "ai_copy", label: "AI copy enhancer", enabled: !!data.ai_copy },
        { key: "remove_branding", label: "Remove platform branding", enabled: !!data.remove_branding },
      ]);
    })();
  }, []);

  if (!rows) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Your site capabilities</span>
          {planKey && (
            <Badge variant={expired ? "destructive" : "secondary"} className="capitalize">
              {planKey} plan{expired ? " (expired)" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between py-3">
              <span className="text-sm text-foreground">{r.label}</span>
              {r.enabled ? (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <Check className="w-4 h-4" /> Enabled
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground text-sm">
                  <Lock className="w-4 h-4" /> Locked
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}