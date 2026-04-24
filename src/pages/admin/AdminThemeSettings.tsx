import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { themePresets, type ThemePreset } from "@/data/themePresets";
import { invalidateThemeCache } from "@/hooks/useThemeColors";
import { Check, Loader2, Palette, Save, RotateCcw, MessageSquareText } from "lucide-react";
import ThemeAiChat from "@/components/admin/ThemeAiChat";

function ThemePreviewCard({
  preset,
  selected,
  onSelect,
}: {
  preset: ThemePreset;
  selected: boolean;
  onSelect: () => void;
}) {
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
      {/* Mini preview */}
      <div className="rounded-lg overflow-hidden" style={{ background: preview.bg }}>
        {/* Header bar */}
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: preview.primary }}>
          <div className="w-5 h-5 rounded-full" style={{ background: preview.accent }} />
          <div className="h-2 rounded-full flex-1" style={{ background: "rgba(255,255,255,0.4)" }} />
          <div className="h-2 w-8 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
        </div>
        {/* Body */}
        <div className="p-3 space-y-2">
          <div className="h-2 w-3/4 rounded-full" style={{ background: preview.text, opacity: 0.7 }} />
          <div className="flex gap-2">
            <div className="rounded-md p-2 flex-1" style={{ background: preview.card, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div className="h-1.5 w-full rounded-full mb-1.5" style={{ background: preview.text, opacity: 0.15 }} />
              <div className="h-1.5 w-2/3 rounded-full" style={{ background: preview.primary, opacity: 0.6 }} />
            </div>
            <div className="rounded-md p-2 flex-1" style={{ background: preview.card, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div className="h-1.5 w-full rounded-full mb-1.5" style={{ background: preview.text, opacity: 0.15 }} />
              <div className="h-1.5 w-1/2 rounded-full" style={{ background: preview.accent, opacity: 0.7 }} />
            </div>
          </div>
          {/* Button row */}
          <div className="flex gap-2 mt-1">
            <div className="h-5 rounded-md flex-1" style={{ background: preview.primary }} />
            <div className="h-5 w-12 rounded-md border" style={{ borderColor: preview.primary + "60" }} />
          </div>
        </div>
      </div>
      {/* Name & description */}
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

export default function AdminThemeSettings() {
  const { adminTenantId } = useAuth();
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fontHeading, setFontHeading] = useState("");
  const [fontBody, setFontBody] = useState("");
  const [radius, setRadius] = useState("1");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current tenant settings
  useEffect(() => {
    const load = async () => {
      if (!adminTenantId) { setLoading(false); return; }
      const { data } = await supabase.from("tenants").select("settings").eq("id", adminTenantId).maybeSingle();
      const s = (data?.settings as Record<string, any>) || {};
      setSelectedPreset(s.theme_preset || "");
      setOverrides(s.theme_color_overrides || {});
      setFontHeading(s.theme_font_heading || "");
      setFontBody(s.theme_font_body || "");
      setRadius(s.theme_radius || "");
      setLoading(false);
    };
    load();
  }, [adminTenantId]);

  const activePreset = themePresets.find((p) => p.id === selectedPreset);

  const getEffectiveColor = (key: string) => {
    if (overrides[key]) return overrides[key];
    if (activePreset) return (activePreset.colors as Record<string, string>)[key] || "";
    return "";
  };

  const handleSave = async () => {
    if (!adminTenantId) { toast.error("No tenant context"); return; }
    setSaving(true);
    try {
      // Get existing settings, merge theme fields
      const { data: tenantData } = await supabase.from("tenants").select("settings").eq("id", adminTenantId).maybeSingle();
      const existing = (tenantData?.settings as Record<string, any>) || {};
      const updated = {
        ...existing,
        theme_preset: selectedPreset,
        theme_color_overrides: overrides,
        theme_font_heading: fontHeading,
        theme_font_body: fontBody,
        theme_radius: radius,
      };
      // Also write the effective colors as color_* keys so useThemeColors picks them up
      const preset = themePresets.find((p) => p.id === selectedPreset);
      if (preset) {
        for (const [key, val] of Object.entries(preset.colors)) {
          updated[`color_${key}`] = overrides[key] || val;
        }
      }
      const { error } = await supabase.from("tenants").update({ settings: updated }).eq("id", adminTenantId);
      if (error) throw error;
      invalidateThemeCache();
      toast.success("Theme saved! Refresh your site to see changes.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleResetOverrides = () => {
    setOverrides({});
    if (activePreset) {
      setFontHeading("");
      setFontBody("");
      setRadius("");
    }
    toast.info("Overrides cleared — using preset defaults");
  };

  const colorFields: { key: string; label: string }[] = [
    { key: "primary", label: "Primary" },
    { key: "primary_foreground", label: "Primary Text" },
    { key: "accent", label: "Accent" },
    { key: "accent_foreground", label: "Accent Text" },
    { key: "background", label: "Background" },
    { key: "foreground", label: "Text" },
    { key: "card", label: "Card" },
    { key: "card_foreground", label: "Card Text" },
    { key: "secondary", label: "Secondary" },
    { key: "muted", label: "Muted" },
    { key: "muted_foreground", label: "Muted Text" },
    { key: "border", label: "Border" },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Step 1: Choose preset */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Choose a Theme</CardTitle>
            <CardDescription>Select a base theme for your website. Each theme comes with its own color palette, typography, and style.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {themePresets.map((preset) => (
                <ThemePreviewCard
                  key={preset.id}
                  preset={preset}
                  selected={selectedPreset === preset.id}
                  onSelect={() => {
                    setSelectedPreset(preset.id);
                    setOverrides({});
                    setFontHeading("");
                    setFontBody("");
                    setRadius("");
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Customize */}
        {activePreset && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Customize Colors</CardTitle>
                    <CardDescription>Override individual colors from the {activePreset.name} theme, or leave blank to use defaults.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleResetOverrides}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Reset
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {colorFields.map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={getEffectiveColor(key)}
                          onChange={(e) => setOverrides((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="h-8 w-8 rounded cursor-pointer border border-border"
                        />
                        <Input
                          value={overrides[key] || ""}
                          onChange={(e) => setOverrides((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={getEffectiveColor(key)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Typography & Radius</CardTitle>
                <CardDescription>Override the default fonts and border radius for your theme.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Heading Font</Label>
                    <Input
                      value={fontHeading}
                      onChange={(e) => setFontHeading(e.target.value)}
                      placeholder={activePreset.fonts.heading}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Any Google Font name, e.g. "Poppins"</p>
                  </div>
                  <div>
                    <Label>Body Font</Label>
                    <Input
                      value={fontBody}
                      onChange={(e) => setFontBody(e.target.value)}
                      placeholder={activePreset.fonts.body}
                      className="mt-1"
                    />
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
          </>
        )}

        {/* AI Chat for tweaks */}
        {activePreset && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5" /> AI Theme Assistant
              </CardTitle>
              <CardDescription>Chat with AI to tweak your theme — describe what you want to change in plain language.</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeAiChat
                currentTheme={{
                  preset: selectedPreset,
                  overrides,
                  fontHeading: fontHeading || activePreset.fonts.heading,
                  fontBody: fontBody || activePreset.fonts.body,
                  radius: radius || activePreset.radius,
                }}
                onApplyChanges={(changes) => {
                  if (changes.color_changes) {
                    setOverrides((prev) => ({ ...prev, ...changes.color_changes }));
                  }
                  if (changes.font_heading) setFontHeading(changes.font_heading);
                  if (changes.font_body) setFontBody(changes.font_body);
                  if (changes.radius) setRadius(changes.radius);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !selectedPreset} size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Theme
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
