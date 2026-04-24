/**
 * AdminPlatformFeatures — Super-admin UI to manage the platform feature catalog.
 * Add new features, edit metadata, toggle active state, and switch rollout mode
 * (auto / opt_in / staged) so tenants get the right onboarding experience.
 */
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Loader2, Sparkles, Settings2, Power, Plane, Hotel, MapPin, Car, Newspaper, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RolloutMode = "auto" | "opt_in" | "staged";

interface Feature {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  category: string;
  required_plan_flag: string | null;
  rollout_mode: RolloutMode;
  default_enabled: boolean;
  is_active: boolean;
  released_at: string;
}

const CATEGORIES = ["booking", "design", "ai", "domain", "marketing", "analytics", "other"];
const PLAN_FLAGS = ["", "flights", "hotels", "tours", "transfers", "ai_copy", "custom_domain", "remove_branding"];

export default function AdminPlatformFeatures() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Feature | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("platform_features")
      .select("*")
      .order("released_at", { ascending: false });
    if (error) toast.error(error.message);
    setFeatures((data as Feature[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upsert = async (f: Partial<Feature> & { feature_key: string; display_name: string }) => {
    const payload = {
      feature_key: f.feature_key,
      display_name: f.display_name,
      description: f.description || null,
      category: f.category || "other",
      required_plan_flag: f.required_plan_flag || null,
      rollout_mode: f.rollout_mode || "opt_in",
      default_enabled: f.default_enabled ?? false,
      is_active: f.is_active ?? true,
    };
    const { error } = await (supabase as any)
      .from("platform_features")
      .upsert(payload, { onConflict: "feature_key" });
    if (error) { toast.error(error.message); return; }
    toast.success("Feature saved");
    setEditing(null); setShowNew(false);
    load();
  };

  const toggleActive = async (f: Feature) => {
    const { error } = await (supabase as any)
      .from("platform_features").update({ is_active: !f.is_active }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> Platform Features
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Catalog of tenant-facing features. Set rollout mode to control onboarding.
            </p>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New feature
          </Button>
        </div>

        <GlobalModulesCard />

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : features.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No features yet. Click "New feature" to add the first one.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {features.map((f) => (
                  <div key={f.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-foreground">{f.display_name}</span>
                        <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{f.feature_key}</code>
                        <Badge variant="outline" className="capitalize text-xs">{f.category}</Badge>
                        <Badge
                          variant={f.rollout_mode === "auto" ? "default" : "secondary"}
                          className="capitalize text-xs"
                        >
                          {f.rollout_mode}
                        </Badge>
                        {f.required_plan_flag && (
                          <Badge variant="outline" className="text-xs">
                            requires: {f.required_plan_flag}
                          </Badge>
                        )}
                        {!f.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                      </div>
                      {f.description && (
                        <p className="text-sm text-muted-foreground">{f.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Released {new Date(f.released_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <Switch checked={f.is_active} onCheckedChange={() => toggleActive(f)} />
                        <span className="text-xs text-muted-foreground">Active</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(f)}>
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(editing || showNew) && (
        <FeatureDialog
          feature={editing}
          open={!!editing || showNew}
          onClose={() => { setEditing(null); setShowNew(false); }}
          onSave={upsert}
        />
      )}
    </AdminLayout>
  );
}

interface DialogProps {
  feature: Feature | null;
  open: boolean;
  onClose: () => void;
  onSave: (f: Partial<Feature> & { feature_key: string; display_name: string }) => void;
}

function FeatureDialog({ feature, open, onClose, onSave }: DialogProps) {
  const [form, setForm] = useState<Partial<Feature>>(
    feature || { rollout_mode: "opt_in", category: "other", default_enabled: false, is_active: true }
  );
  useEffect(() => {
    setForm(feature || { rollout_mode: "opt_in", category: "other", default_enabled: false, is_active: true });
  }, [feature]);

  const submit = () => {
    if (!form.feature_key || !form.display_name) {
      toast.error("Key and name are required");
      return;
    }
    onSave(form as any);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{feature ? "Edit feature" : "New platform feature"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Feature key</Label>
              <Input
                value={form.feature_key || ""}
                disabled={!!feature}
                onChange={(e) => setForm({ ...form, feature_key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="e.g. ai_copy_polish"
              />
            </div>
            <div>
              <Label className="text-xs">Display name</Label>
              <Input
                value={form.display_name || ""}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="AI Copy Polish"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={2}
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this feature does for tenants"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={form.category || "other"}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Required plan flag</Label>
              <Select
                value={form.required_plan_flag || "__none__"}
                onValueChange={(v) => setForm({ ...form, required_plan_flag: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— none —</SelectItem>
                  {PLAN_FLAGS.filter(Boolean).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Rollout mode</Label>
            <Select
              value={form.rollout_mode || "opt_in"}
              onValueChange={(v: RolloutMode) => setForm({ ...form, rollout_mode: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto — enabled for everyone immediately</SelectItem>
                <SelectItem value="opt_in">Opt-in — tenant must enable manually</SelectItem>
                <SelectItem value="staged">Staged — controlled per-tenant rollout</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Default enabled</div>
              <div className="text-xs text-muted-foreground">For auto rollout, pre-flips the tenant switch on.</div>
            </div>
            <Switch
              checked={!!form.default_enabled}
              onCheckedChange={(v) => setForm({ ...form, default_enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Hide from tenants without deleting.</div>
            </div>
            <Switch
              checked={form.is_active ?? true}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save feature</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GlobalModulesCard — platform-wide kill-switch for the five booking
// modules (Flights, Hotels, Tours, Transfers, Blog). When toggled OFF
// here, no tenant can enable the module on their site, even if their
// plan includes it.
// ─────────────────────────────────────────────────────────────────────

interface GlobalModuleRow {
  module_key: string;
  display_name: string;
  is_enabled: boolean;
  notes?: string | null;
  updated_at?: string | null;
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flights: Plane,
  hotels: Hotel,
  tours: MapPin,
  transfers: Car,
  blog: Newspaper,
  ai_trip_planner: Wand2,
};

function GlobalModulesCard() {
  const [rows, setRows] = useState<GlobalModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("platform_module_settings")
      .select("module_key, display_name, is_enabled, notes, updated_at")
      .order("module_key");
    if (error) toast.error(error.message);
    setRows((data as GlobalModuleRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (key: string, next: boolean) => {
    setSaving(key);
    const prev = rows;
    setRows((r) => r.map((x) => (x.module_key === key ? { ...x, is_enabled: next } : x)));
    const { error } = await (supabase as any)
      .from("platform_module_settings")
      .update({ is_enabled: next })
      .eq("module_key", key);
    setSaving(null);
    if (error) {
      setRows(prev);
      toast.error(`Couldn't update ${key}: ${error.message}`);
      return;
    }
    toast.success(
      next
        ? `${key} re-enabled platform-wide`
        : `${key} disabled platform-wide — no tenant can enable it`,
    );
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Power className="w-5 h-5 text-primary" /> Global module kill-switch
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Master switch for booking products. When you turn one OFF here, every
          tenant site instantly hides it and the tenant dashboard locks the
          toggle with a "contact admin to enable" note — regardless of their
          plan.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No modules configured yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r) => {
              const Icon = MODULE_ICONS[r.module_key] || Sparkles;
              return (
                <div
                  key={r.module_key}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                    r.is_enabled
                      ? "border-border bg-background"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center ${
                      r.is_enabled
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {r.display_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.is_enabled ? "Available to all tenants" : "Disabled platform-wide"}
                    </div>
                  </div>
                  <Switch
                    checked={r.is_enabled}
                    disabled={saving === r.module_key}
                    onCheckedChange={(v) => toggle(r.module_key, v)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
