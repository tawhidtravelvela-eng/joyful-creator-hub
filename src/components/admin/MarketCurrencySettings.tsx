import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, Loader2, Coins } from "lucide-react";
import { CURRENCIES } from "@/contexts/CurrencyContext";

interface MarketRule {
  id: string;
  country_code: string;
  country_name: string;
  default_currency: string;
  allowed_currencies: string[];
  force_single_currency: boolean;
  currency_picker_mode: string;
}

const PICKER_MODES = [
  { value: "auto", label: "Auto", desc: "Hide when single currency, show when multiple" },
  { value: "show", label: "Always Show", desc: "Always show picker regardless" },
  { value: "hide", label: "Always Hide", desc: "Never show picker" },
  { value: "disabled", label: "Disabled", desc: "Show as read-only badge" },
];

const ALL_CURRENCY_CODES = Object.keys(CURRENCIES);

const MarketCurrencySettings = () => {
  const [rules, setRules] = useState<MarketRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MarketRule | null>(null);

  // Form state
  const [form, setForm] = useState({
    country_code: "",
    country_name: "",
    default_currency: "USD",
    allowed_currencies: ["USD"] as string[],
    force_single_currency: false,
    currency_picker_mode: "auto",
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("market_currency_rules" as any)
        .select("*")
        .order("country_name");
      if (error) throw error;
      setRules((data as any[]) || []);
    } catch (err: any) {
      toast.error("Failed to load market rules: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingRule(null);
    setForm({ country_code: "", country_name: "", default_currency: "USD", allowed_currencies: ["USD"], force_single_currency: false, currency_picker_mode: "auto" });
    setDialogOpen(true);
  };

  const openEdit = (rule: MarketRule) => {
    setEditingRule(rule);
    setForm({
      country_code: rule.country_code,
      country_name: rule.country_name,
      default_currency: rule.default_currency,
      allowed_currencies: rule.allowed_currencies || ["USD"],
      force_single_currency: rule.force_single_currency,
      currency_picker_mode: rule.currency_picker_mode || "auto",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.country_code || form.country_code.length !== 2) {
      toast.error("Country code must be a 2-letter ISO code");
      return;
    }
    if (form.allowed_currencies.length === 0) {
      toast.error("At least one allowed currency is required");
      return;
    }
    // Ensure default_currency is in allowed list
    if (!form.allowed_currencies.includes(form.default_currency)) {
      toast.error("Default currency must be in the allowed currencies list");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        country_code: form.country_code.toUpperCase(),
        country_name: form.country_name,
        default_currency: form.default_currency,
        allowed_currencies: form.allowed_currencies,
        force_single_currency: form.force_single_currency,
        currency_picker_mode: form.currency_picker_mode,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("market_currency_rules" as any)
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
        toast.success("Market rule updated");
      } else {
        const { error } = await supabase
          .from("market_currency_rules" as any)
          .insert(payload);
        if (error) throw error;
        toast.success("Market rule created");
      }

      setDialogOpen(false);
      fetchRules();
      // Notify currency context to refresh
      window.dispatchEvent(new Event("market-rules-updated"));
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: MarketRule) => {
    if (!confirm(`Remove currency rules for ${rule.country_name || rule.country_code}?`)) return;
    try {
      const { error } = await supabase
        .from("market_currency_rules" as any)
        .delete()
        .eq("id", rule.id);
      if (error) throw error;
      toast.success("Market rule deleted");
      fetchRules();
      window.dispatchEvent(new Event("market-rules-updated"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleCurrency = (code: string) => {
    setForm((prev) => {
      const has = prev.allowed_currencies.includes(code);
      const next = has
        ? prev.allowed_currencies.filter((c) => c !== code)
        : [...prev.allowed_currencies, code];
      // If removing the default, reset default to first allowed
      const newDefault = next.includes(prev.default_currency)
        ? prev.default_currency
        : next[0] || "USD";
      return { ...prev, allowed_currencies: next, default_currency: newDefault };
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Coins className="w-5 h-5 text-primary" />
              Market Currency Rules
            </CardTitle>
            <CardDescription className="mt-1">
              Configure per-country currency restrictions and picker behavior. B2B/corporate users always use their profile currency regardless.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openNew} className="shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Add Market
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No market rules configured. All users see the full currency picker.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase">Country</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Default</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Allowed</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Picker</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Forced</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{rule.country_code}</span>
                        <span className="text-sm font-medium">{rule.country_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{rule.default_currency}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rule.allowed_currencies || []).map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{rule.currency_picker_mode}</Badge>
                    </TableCell>
                    <TableCell>
                      {(rule.force_single_currency || (rule.allowed_currencies || []).length <= 1) ? (
                        <Badge className="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 text-[10px]">Locked</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rule)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(rule)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit" : "Add"} Market Currency Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Country Code (ISO 2-letter)</Label>
                <Input
                  value={form.country_code}
                  onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value.toUpperCase().slice(0, 2) }))}
                  placeholder="BD"
                  maxLength={2}
                  className="mt-1 font-mono uppercase"
                  disabled={!!editingRule}
                />
              </div>
              <div>
                <Label className="text-xs">Country Name</Label>
                <Input
                  value={form.country_name}
                  onChange={(e) => setForm((p) => ({ ...p, country_name: e.target.value }))}
                  placeholder="Bangladesh"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block">Allowed Currencies</Label>
              <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-2 rounded-lg border border-border bg-muted/20">
                {ALL_CURRENCY_CODES.map((code) => {
                  const selected = form.allowed_currencies.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggleCurrency(code)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                        selected
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-background text-muted-foreground border-border hover:border-primary/30"
                      }`}
                    >
                      {CURRENCIES[code]?.symbol} {code}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Selected: {form.allowed_currencies.join(", ") || "None"}
              </p>
            </div>

            <div>
              <Label className="text-xs">Default Currency</Label>
              <Select value={form.default_currency} onValueChange={(v) => setForm((p) => ({ ...p, default_currency: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {form.allowed_currencies.map((code) => (
                    <SelectItem key={code} value={code}>
                      {CURRENCIES[code]?.symbol} {code} — {CURRENCIES[code]?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Currency Picker Mode</Label>
              <Select value={form.currency_picker_mode} onValueChange={(v) => setForm((p) => ({ ...p, currency_picker_mode: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PICKER_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {m.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.force_single_currency}
                onCheckedChange={(v) => setForm((p) => ({ ...p, force_single_currency: v }))}
              />
              <div>
                <Label className="text-xs font-medium">Force Single Currency</Label>
                <p className="text-[10px] text-muted-foreground">Lock to default even if multiple are listed</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MarketCurrencySettings;
