import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, DollarSign, Plus, X, Globe, Code, Palette } from "lucide-react";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "BDT", "CNY", "MYR", "SGD", "INR", "AED", "SAR", "THB"];

interface CurrencyPricing {
  [currency: string]: number | "";
}

interface PricingConfig {
  setup_fee: number;
  api_access_fee: number;
  whitelabel_currency_fees: CurrencyPricing;
  api_access_currency_fees: CurrencyPricing;
}

const WhitelabelSettingsCard = () => {
  const [config, setConfig] = useState<PricingConfig>({
    setup_fee: 500,
    api_access_fee: 3000,
    whitelabel_currency_fees: {},
    api_access_currency_fees: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("api_settings")
        .select("settings")
        .eq("provider", "whitelabel_config")
        .maybeSingle();
      if (data?.settings) {
        const s = data.settings as Record<string, any>;
        setConfig({
          setup_fee: s.setup_fee ?? 500,
          api_access_fee: s.api_access_fee ?? 3000,
          whitelabel_currency_fees: s.whitelabel_currency_fees || {},
          api_access_currency_fees: s.api_access_currency_fees || {},
        });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (isNaN(config.setup_fee) || config.setup_fee < 0 || isNaN(config.api_access_fee) || config.api_access_fee < 0) {
      toast.error("Please enter valid fee amounts");
      return;
    }
    setSaving(true);

    const settings = { ...config };

    const { data: existing } = await supabase
      .from("api_settings")
      .select("id")
      .eq("provider", "whitelabel_config")
      .maybeSingle();

    if (existing) {
      await supabase.from("api_settings").update({ settings }).eq("provider", "whitelabel_config");
    } else {
      await supabase.from("api_settings").insert({ provider: "whitelabel_config", settings, is_active: true });
    }

    toast.success("Pricing settings updated");
    setSaving(false);
  };

  const updateCurrencyFee = (product: "whitelabel" | "api_access", currency: string, value: string) => {
    const key = product === "whitelabel" ? "whitelabel_currency_fees" : "api_access_currency_fees";
    setConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], [currency]: value === "" ? "" : Number(value) },
    }));
  };

  const removeCurrencyFee = (product: "whitelabel" | "api_access", currency: string) => {
    const key = product === "whitelabel" ? "whitelabel_currency_fees" : "api_access_currency_fees";
    setConfig(prev => {
      const copy = { ...prev[key] };
      delete copy[currency];
      return { ...prev, [key]: copy };
    });
  };

  /** Rename a currency row (e.g. change BDT → INR) while preserving its fee value */
  const renameCurrencyFee = (product: "whitelabel" | "api_access", oldCurrency: string, newCurrency: string) => {
    if (oldCurrency === newCurrency) return;
    const key = product === "whitelabel" ? "whitelabel_currency_fees" : "api_access_currency_fees";
    setConfig(prev => {
      const copy = { ...prev[key] };
      if (newCurrency in copy) {
        toast.error(`${newCurrency} is already configured. Remove it first.`);
        return prev;
      }
      copy[newCurrency] = copy[oldCurrency];
      delete copy[oldCurrency];
      return { ...prev, [key]: copy };
    });
  };

  const getAvailableCurrencies = (product: "whitelabel" | "api_access") => {
    const key = product === "whitelabel" ? "whitelabel_currency_fees" : "api_access_currency_fees";
    const used = Object.keys(config[key]);
    return SUPPORTED_CURRENCIES.filter(c => c !== "USD" && !used.includes(c));
  };

  const addCurrency = (product: "whitelabel" | "api_access") => {
    const available = getAvailableCurrencies(product);
    if (available.length === 0) return;
    updateCurrencyFee(product, available[0], "0");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderProductSection = (
    title: string,
    description: string,
    icon: React.ReactNode,
    product: "whitelabel" | "api_access",
    defaultFee: number,
    setDefaultFee: (v: number) => void,
    currencyFees: CurrencyPricing,
  ) => {
    const available = getAvailableCurrencies(product);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            <p className="text-[11px] text-muted-foreground">{description}</p>
          </div>
        </div>

        {/* USD default */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            Default Fee (USD)
            <Badge variant="outline" className="text-[9px] px-1.5 py-0">Base</Badge>
          </Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={defaultFee}
            onChange={e => setDefaultFee(Number(e.target.value) || 0)}
            placeholder="0"
            className="max-w-[200px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Used when no currency-specific fee is configured. Users see this converted if no override exists.
          </p>
        </div>

        {/* Per-currency overrides */}
        {Object.entries(currencyFees).length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Currency-specific fees (charged directly, no conversion)</Label>
            {Object.entries(currencyFees).map(([currency, fee]) => {
              const used = Object.keys(currencyFees);
              const rowOptions = SUPPORTED_CURRENCIES.filter(
                c => c !== "USD" && (c === currency || !used.includes(c))
              );
              return (
                <div key={currency} className="flex items-center gap-2">
                  <Select value={currency} onValueChange={(v) => renameCurrencyFee(product, currency, v)}>
                    <SelectTrigger className="w-[110px] h-9 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rowOptions.map(c => (
                        <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={fee}
                    onChange={e => updateCurrencyFee(product, currency, e.target.value)}
                    className="max-w-[160px]"
                    placeholder="Amount"
                  />
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeCurrencyFee(product, currency)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {available.length > 0 && (
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => addCurrency(product)}>
            <Plus className="h-3 w-3" /> Add Currency
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="border-border/50 max-w-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Service & Addon Pricing
        </CardTitle>
        <CardDescription className="text-xs">
          Manage pricing for all paid services. Set fees per currency — if a user's billing currency has a specific fee, they'll be charged that exact amount (no conversion). Otherwise, the USD default is converted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderProductSection(
          "White-Label Setup Fee",
          "One-time fee for creating a branded travel website",
          <Palette className="h-4 w-4 text-primary" />,
          "whitelabel",
          config.setup_fee,
          v => setConfig(p => ({ ...p, setup_fee: v })),
          config.whitelabel_currency_fees,
        )}

        <Separator />

        {renderProductSection(
          "API Access Fee",
          "One-time fee for REST API integration access",
          <Code className="h-4 w-4 text-primary" />,
          "api_access",
          config.api_access_fee,
          v => setConfig(p => ({ ...p, api_access_fee: v })),
          config.api_access_currency_fees,
        )}

        <Separator />

        <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground text-xs">How currency pricing works:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Each user has a <strong>billing currency</strong> set on their profile</li>
            <li>If a currency-specific fee exists for their billing currency, they're charged that exact amount</li>
            <li>If not, the USD default fee is converted to their display currency at live rates</li>
            <li>Wallet deductions and purchase records include the charged currency</li>
          </ul>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm" className="mt-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save Pricing
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhitelabelSettingsCard;
