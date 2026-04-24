/**
 * Admin Appearance — tenant admins pick a theme preset that styles ONLY their
 * admin dashboard chrome. Stored in tenants.settings.admin_theme_* keys, kept
 * separate from the existing public-site theme (theme_preset) so admins can
 * have a different look from their consumer-facing site.
 */
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { themePresets, type ThemePreset } from "@/data/themePresets";
import { invalidateAdminThemeCache } from "@/hooks/useAdminTheme";
import { Check, Loader2, Palette, Save, RotateCcw, Sparkles } from "lucide-react";

function PresetCard({ preset, selected, onSelect }: { preset: ThemePreset; selected: boolean; onSelect: () => void }) {
  const { preview } = preset;
  return (
    <button
      onClick={onSelect}
      className={`relative rounded-xl border-2 p-1 transition-all text-left w-full ${
        selected ? "border-primary ring-2 ring-primary/30 shadow-lg" : "border-border hover:border-muted-foreground/40"
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-0.5">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="rounded-lg overflow-hidden" style={{ background: preview.bg }}>
        {/* Mock admin sidebar + header */}
        <div className="flex h-24">
          <div className="w-1/4 flex flex-col gap-1 p-1.5" style={{ background: preview.card }}>
            <div className="h-1.5 w-full rounded-full" style={{ background: preview.primary, opacity: 0.85 }} />
            <div className="h-1 w-3/4 rounded-full" style={{ background: preview.text, opacity: 0.25 }} />
            <div className="h-1 w-2/3 rounded-full" style={{ background: preview.text, opacity: 0.2 }} />
            <div className="h-1 w-1/2 rounded-full" style={{ background: preview.text, opacity: 0.15 }} />
          </div>
          <div className="flex-1 flex flex-col">
            <div className="h-3" style={{ background: preview.card, borderBottom: `1px solid ${preview.text}10` }} />
            <div className="flex-1 p-1.5 space-y-1">
              <div className="h-1.5 w-1/2 rounded-full" style={{ background: preview.text, opacity: 0.6 }} />
              <div className="grid grid-cols-2 gap-1">
                <div className="h-6 rounded" style={{ background: preview.card, border: `1px solid ${preview.text}15` }} />
                <div className="h-6 rounded" style={{ background: preview.card, border: `1px solid ${preview.text}15` }} />
              </div>
              <div className="h-3 rounded flex items-center justify-end pr-1">
                <div className="h-2 w-8 rounded" style={{ background: preview.primary }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-2 py-2">
        <p className="font-semibold text-sm text-foreground">{preset.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{preset.description}</p>
        <div className="flex gap-1 mt-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{preset.fonts.heading}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{preset.radius} radius</Badge>
        </div>
      </div>
    </button>
  );
}

export default function AdminAppearance() {
  const { adminTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [fontHeading, setFontHeading] = useState("");
  const [fontBody, setFontBody] = useState("");
  const [radius, setRadius] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!adminTenantId) { setLoading(false); return; }
      const { data } = await supabase.from("tenants").select("settings").eq("id", adminTenantId).maybeSingle();
      const s = (data?.settings as Record<string, any>) || {};
      setSelectedPreset(s.admin_theme_preset || "");
      setFontHeading(s.admin_theme_font_heading || "");
      setFontBody(s.admin_theme_font_body || "");
      setRadius(s.admin_theme_radius || "");
      setLoading(false);
    };
    load();
  }, [adminTenantId]);

  const activePreset = themePresets.find((p) => p.id === selectedPreset);

  const handleSave = async () => {
    if (!adminTenantId) { toast.error("No tenant context — super admins don't have a tenant theme."); return; }
    setSaving(true);
    try {
      const { data: tenantData } = await supabase.from("tenants").select("settings").eq("id", adminTenantId).maybeSingle();
      const existing = (tenantData?.settings as Record<string, any>) || {};
      const updated = {
        ...existing,
        admin_theme_preset: selectedPreset || null,
        admin_theme_font_heading: fontHeading || null,
        admin_theme_font_body: fontBody || null,
        admin_theme_radius: radius || null,
      };
      const { error } = await supabase.from("tenants").update({ settings: updated }).eq("id", adminTenantId);
      if (error) throw error;
      invalidateAdminThemeCache();
      toast.success("Admin appearance saved — refresh to see the new look.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedPreset("");
    setFontHeading("");
    setFontBody("");
    setRadius("");
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  if (!adminTenantId) {
    return (
      <AdminLayout>
        <Card>
          <CardHeader>
            <CardTitle>Admin Appearance</CardTitle>
            <CardDescription>This page is only available for tenant admins. Super admins always see the platform default look.</CardDescription>
          </CardHeader>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Admin Appearance</CardTitle>
                <CardDescription>
                  Pick a design version for your admin dashboard chrome. This only affects how <em>your team</em> sees the
                  admin panel — your public website theme stays separate.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" /> Use platform default
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {themePresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  selected={selectedPreset === preset.id}
                  onSelect={() => {
                    setSelectedPreset(preset.id);
                    setFontHeading("");
                    setFontBody("");
                    setRadius("");
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {activePreset && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Typography & Radius</CardTitle>
              <CardDescription>Optional overrides on top of the {activePreset.name} preset.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Heading Font</Label>
                  <Input value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} placeholder={activePreset.fonts.heading} className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">Any Google Font name</p>
                </div>
                <div>
                  <Label>Body Font</Label>
                  <Input value={fontBody} onChange={(e) => setFontBody(e.target.value)} placeholder={activePreset.fonts.body} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Border Radius: {radius || activePreset.radius}</Label>
                <Slider
                  value={[parseFloat(radius || activePreset.radius) * 16]}
                  onValueChange={([v]) => setRadius((v / 16).toFixed(2) + "rem")}
                  min={0}
                  max={32}
                  step={1}
                  className="mt-2 max-w-xs"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Appearance
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}