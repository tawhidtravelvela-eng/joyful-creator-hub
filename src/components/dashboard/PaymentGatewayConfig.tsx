import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CreditCard, Loader2, Shield, CheckCircle2, Key } from "lucide-react";

interface PaymentGatewayConfigProps {
  userId: string;
}

interface GatewayConfig {
  id?: string;
  provider: string;
  settings: Record<string, string>;
  is_active: boolean;
}

const PROVIDERS = [
  {
    id: "stripe",
    label: "Stripe",
    description: "Accept credit/debit cards worldwide",
    fields: [
      { key: "publishable_key", label: "Publishable Key", placeholder: "pk_live_..." },
      { key: "secret_key", label: "Secret Key", placeholder: "sk_live_...", sensitive: true },
      { key: "webhook_secret", label: "Webhook Secret (optional)", placeholder: "whsec_...", sensitive: true },
    ],
  },
  {
    id: "airwallex",
    label: "Airwallex",
    description: "Multi-currency payments for international bookings",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "Your Airwallex Client ID" },
      { key: "api_key", label: "API Key", placeholder: "Your Airwallex API Key", sensitive: true },
      { key: "environment", label: "Environment", placeholder: "production or demo" },
    ],
  },
];

const PaymentGatewayConfig = ({ userId }: PaymentGatewayConfigProps) => {
  const [gateways, setGateways] = useState<Record<string, GatewayConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    fetchGateways();
  }, [userId]);

  const fetchGateways = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("agent_payment_gateways")
      .select("*")
      .eq("user_id", userId);

    const map: Record<string, GatewayConfig> = {};
    const forms: Record<string, Record<string, string>> = {};

    (data || []).forEach((row: any) => {
      map[row.provider] = {
        id: row.id,
        provider: row.provider,
        settings: row.settings || {},
        is_active: row.is_active,
      };
      // For display, mask sensitive fields
      const fields: Record<string, string> = {};
      Object.entries(row.settings || {}).forEach(([k, v]) => {
        const provDef = PROVIDERS.find(p => p.id === row.provider);
        const fieldDef = provDef?.fields.find(f => f.key === k);
        fields[k] = fieldDef?.sensitive ? "••••••••" : (v as string);
      });
      forms[row.provider] = fields;
    });

    setGateways(map);
    setFormData(forms);
    setLoading(false);
  };

  const handleFieldChange = (provider: string, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [key]: value },
    }));
  };

  const handleSave = async (providerId: string) => {
    const providerFields = formData[providerId] || {};
    const provDef = PROVIDERS.find(p => p.id === providerId);
    if (!provDef) return;

    // Build settings, keeping existing values for masked fields
    const existing = gateways[providerId]?.settings || {};
    const settings: Record<string, string> = {};
    provDef.fields.forEach(f => {
      const val = providerFields[f.key];
      if (val && val !== "••••••••") {
        settings[f.key] = val;
      } else if (existing[f.key]) {
        settings[f.key] = existing[f.key];
      }
    });

    setSaving(providerId);
    const existingGw = gateways[providerId];

    if (existingGw?.id) {
      const { error } = await supabase
        .from("agent_payment_gateways")
        .update({ settings, updated_at: new Date().toISOString() })
        .eq("id", existingGw.id);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`${provDef.label} settings saved`);
      }
    } else {
      const { error } = await supabase
        .from("agent_payment_gateways")
        .insert({ user_id: userId, provider: providerId, settings, is_active: true });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`${provDef.label} gateway configured`);
      }
    }

    setSaving(null);
    fetchGateways();
  };

  const handleToggle = async (providerId: string, active: boolean) => {
    const gw = gateways[providerId];
    if (!gw?.id) return;

    await supabase
      .from("agent_payment_gateways")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", gw.id);

    setGateways(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], is_active: active },
    }));

    toast.success(`${PROVIDERS.find(p => p.id === providerId)?.label} ${active ? "enabled" : "disabled"}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
        <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Configure your own payment gateway to collect payments directly from customers on your white-label site.
          Credentials are stored securely and never shared.
        </p>
      </div>

      {PROVIDERS.map(provider => {
        const gw = gateways[provider.id];
        const isConfigured = !!gw?.id;
        const fields = formData[provider.id] || {};

        return (
          <Card key={provider.id} className={`border-border/50 ${isConfigured && gw.is_active ? "border-primary/20" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isConfigured ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <CreditCard className={`w-5 h-5 ${isConfigured ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      {provider.label}
                      {isConfigured && (
                        <Badge variant="outline" className="text-[10px] bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" /> Configured
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                  </div>
                </div>
                {isConfigured && (
                  <Switch
                    checked={gw.is_active}
                    onCheckedChange={(checked) => handleToggle(provider.id, checked)}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {provider.fields.map(field => (
                <div key={field.key}>
                  <Label className="text-xs flex items-center gap-1">
                    {field.sensitive && <Key className="w-3 h-3 text-muted-foreground" />}
                    {field.label}
                  </Label>
                  <Input
                    type={field.sensitive ? "password" : "text"}
                    value={fields[field.key] || ""}
                    onChange={(e) => handleFieldChange(provider.id, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="h-9 text-sm mt-1"
                  />
                </div>
              ))}
              <Button
                size="sm"
                onClick={() => handleSave(provider.id)}
                disabled={saving === provider.id}
                className="w-full"
              >
                {saving === provider.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                {isConfigured ? "Update Credentials" : "Save & Enable"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PaymentGatewayConfig;
