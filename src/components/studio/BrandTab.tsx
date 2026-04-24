/**
 * BrandTab — first-run / always-on brand setup panel inside Studio.
 *
 * Lets a tenant admin upload a logo + favicon, set the site name & tagline,
 * and pick brand colors. As soon as a logo is uploaded, the colors are
 * auto-extracted client-side (no AI cost) so the tenant sees an on-brand
 * preview immediately. They can override any color manually, and an
 * "Improve with AI" button calls the extract-brand-palette edge function
 * for trickier logos.
 *
 * On Save:
 *   - tenants.settings.brand     ← logo_url, favicon_url, site_name, tagline
 *   - tenant_skin_config         ← primary_color, accent_color, background_color
 *
 * Saving bumps the live-preview iframe key in Studio so the change shows
 * up instantly without a hard reload.
 */

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
   Loader2,
   Upload,
   Sparkles,
   X,
   Image as ImageIcon,
   Palette,
   Wand2,
   RefreshCw,
 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  extractPaletteFromUrl,
  isValidHex,
  type BrandPalette,
} from "@/lib/brand/extractPalette";
import { colorTokenToHex, normalizeHslToken } from "@/lib/skins/designPresets";

type Props = {
  tenantId: string;
  tenantName: string;
  currentSkinKey?: string | null;
  initial: {
    logo_url: string | null;
    favicon_url: string | null;
    site_name: string | null;
    tagline: string | null;
    primary_color: string | null;
    accent_color: string | null;
    background_color: string | null;
  };
  onSaved: () => void;
};

function safeColor(value: string | null | undefined, fallback: string) {
  return colorTokenToHex(value) || fallback;
}

function uploadAsset(file: File, folder: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `tenant-branding/${folder}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage
        .from("assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("assets").getPublicUrl(path);
      resolve(data.publicUrl);
    } catch (e) {
      reject(e);
    }
  });
}

export default function BrandTab({ tenantId, tenantName, currentSkinKey, initial, onSaved }: Props) {
  const [logoUrl, setLogoUrl] = useState(initial.logo_url || "");
  const [faviconUrl, setFaviconUrl] = useState(initial.favicon_url || "");
  const [siteName, setSiteName] = useState(initial.site_name || tenantName || "");
  const [tagline, setTagline] = useState(initial.tagline || "");

  const [primary, setPrimary] = useState(safeColor(initial.primary_color, "#0092ff"));
  const [accent, setAccent] = useState(safeColor(initial.accent_color, "#ff6b2c"));
  const [background, setBackground] = useState(
    safeColor(initial.background_color, "#ffffff"),
  );

  const [paletteCandidates, setPaletteCandidates] = useState<string[]>([]);
  const [paletteSource, setPaletteSource] = useState<BrandPalette["source"] | "manual">(
    "manual",
  );
  const [extracting, setExtracting] = useState(false);
  const [aiExtracting, setAiExtracting] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-sync if Studio passes a new initial set (e.g. tenant switched).
  useEffect(() => {
    setLogoUrl(initial.logo_url || "");
    setFaviconUrl(initial.favicon_url || "");
    setSiteName(initial.site_name || tenantName || "");
    setTagline(initial.tagline || "");
    setPrimary(safeColor(initial.primary_color, "#0092ff"));
    setAccent(safeColor(initial.accent_color, "#ff6b2c"));
    setBackground(safeColor(initial.background_color, "#ffffff"));
  }, [
    initial.logo_url,
    initial.favicon_url,
    initial.site_name,
    initial.tagline,
    initial.primary_color,
    initial.accent_color,
    initial.background_color,
    tenantName,
  ]);

  const runClientExtraction = async (url: string) => {
    if (!url) return;
    setExtracting(true);
    try {
      const palette = await extractPaletteFromUrl(url);
      setPrimary(palette.primary);
      setAccent(palette.accent);
      setBackground(palette.background);
      setPaletteCandidates(palette.candidates);
      setPaletteSource("client");
      toast.success("Colors picked from your logo", {
        description: "Tweak any swatch below or use AI to refine.",
      });
    } catch (e: any) {
      console.error("[brand] client extraction failed", e);
      toast.message("Couldn't auto-extract colors", {
        description: e?.message || "Pick colors manually below.",
      });
    } finally {
      setExtracting(false);
    }
  };

  const runAIExtraction = async () => {
    if (!logoUrl) {
      toast.message("Upload a logo first");
      return;
    }
    setAiExtracting(true);
    try {
      // Call the edge function directly with only the publishable apikey
      // (no user JWT). The platform gateway cannot verify ES256 user tokens
      // on this function, so forwarding the session would 401.
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/extract-brand-palette`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ logo_url: logoUrl, brand_name: siteName || tenantName }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(data?.error || data?.message || `AI extraction failed (${resp.status})`);
        return;
      }
      if (!data?.success) {
        toast.error(data?.error || "AI couldn't read your logo");
        return;
      }
      setPrimary(data.primary);
      setAccent(data.accent);
      setBackground(data.background);
      setPaletteSource("ai");
      toast.success("AI refined your palette", {
        description: data.rationale || "Saved to draft. Click Save brand to apply.",
      });
    } catch (e: any) {
      console.error("[brand] AI extraction failed", e);
      toast.error(e?.message || "AI extraction failed");
    } finally {
      setAiExtracting(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Logo must be under 4MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadAsset(file, "logos");
      setLogoUrl(url);
      // Auto-extract immediately so the tenant sees a branded preview without
      // an extra click.
      await runClientExtraction(url);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Favicon must be under 1MB");
      return;
    }
    setUploadingFavicon(true);
    try {
      const url = await uploadAsset(file, "favicons");
      setFaviconUrl(url);
      toast.success("Favicon uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!isValidHex(primary) || !isValidHex(accent) || !isValidHex(background)) {
      toast.error("All colors must be valid hex codes (e.g. #1570d6)");
      return;
    }
    setSaving(true);
    try {
      // 1. Persist brand metadata in tenants.settings.brand (jsonb merge).
      const { data: tRow, error: tFetchErr } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId)
        .maybeSingle();
      if (tFetchErr) throw tFetchErr;
      const currentSettings = (tRow?.settings as Record<string, any>) || {};
      const nextSettings = {
        ...currentSettings,
        brand: {
          ...(currentSettings.brand || {}),
          logo_url: logoUrl || null,
          favicon_url: faviconUrl || null,
          site_name: siteName.trim() || null,
          tagline: tagline.trim() || null,
          updated_at: new Date().toISOString(),
        },
      };
      const { error: tErr } = await supabase
        .from("tenants")
        .update({ settings: nextSettings })
        .eq("id", tenantId);
      if (tErr) throw tErr;

      // 2. Persist colors in tenant_skin_config so the live skin picks them up.
      const { error: skinErr } = await supabase
        .from("tenant_skin_config")
        .upsert(
          [
            {
              tenant_id: tenantId,
              // Required NOT NULL column. Default to the balanced consumer
              // skin so first-time saves from the Brand tab don't fail with
              // "null value in column skin_key" when no skin row exists yet.
              skin_key: currentSkinKey || "b2c-general",
              primary_color: normalizeHslToken(primary),
              accent_color: normalizeHslToken(accent),
              background_color: normalizeHslToken(background),
            },
          ] as any,
          { onConflict: "tenant_id" },
        );
      if (skinErr) throw skinErr;

      toast.success("Brand saved", {
        description: "Live preview reloaded with your colors.",
      });
      onSaved();
    } catch (e: any) {
      console.error("[brand] save failed", e);
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const previewStyle = useMemo(
    () => ({
      background,
      color: "#0a1929",
    }),
    [background],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="w-4 h-4 text-primary" />
                Brand identity
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your logo & favicon and set the site name. Colors auto-pick
                from the logo — you can always override.
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save brand
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo */}
          <div>
            <Label className="text-xs">Logo</Label>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <div className="flex h-16 w-32 items-center justify-center rounded-md border border-border bg-muted/40 overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild size="sm" variant="outline" disabled={uploadingLogo}>
                  <label className="cursor-pointer">
                    {uploadingLogo ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {logoUrl ? "Replace logo" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setLogoUrl("");
                      setPaletteCandidates([]);
                      setPaletteSource("manual");
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              PNG, JPG, SVG or WEBP up to 4MB. Transparent logos look best.
            </p>
          </div>

          {/* Favicon */}
          <div>
            <Label className="text-xs">Favicon</Label>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/40 overflow-hidden">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt="Favicon preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <Button asChild size="sm" variant="outline" disabled={uploadingFavicon}>
                <label className="cursor-pointer">
                  {uploadingFavicon ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {faviconUrl ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/x-icon,image/svg+xml"
                    onChange={handleFaviconUpload}
                    className="hidden"
                  />
                </label>
              </Button>
              {faviconUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setFaviconUrl("")}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Square PNG / ICO / SVG, ideally 512×512.
            </p>
          </div>

          {/* Name + tagline */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Site name</Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Travel Vela"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Tagline</Label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Travel simply."
                className="mt-1.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="w-4 h-4 text-primary" />
                Brand colors
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {paletteSource === "ai"
                  ? "Refined by AI from your logo. Override any swatch below."
                  : paletteSource === "client"
                    ? "Auto-picked from your logo. Override any swatch below."
                    : "Override any swatch or upload a logo to auto-pick."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => runClientExtraction(logoUrl)}
                disabled={!logoUrl || extracting || aiExtracting}
              >
                {extracting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Re-pick from logo
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={runAIExtraction}
                disabled={!logoUrl || aiExtracting || extracting}
              >
                {aiExtracting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                Improve with AI
                <Badge variant="outline" className="ml-2 text-[10px]">
                  1 credit
                </Badge>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <ColorField
              label="Primary"
              value={primary}
              onChange={(v) => {
                setPrimary(v);
                setPaletteSource("manual");
              }}
            />
            <ColorField
              label="Accent"
              value={accent}
              onChange={(v) => {
                setAccent(v);
                setPaletteSource("manual");
              }}
            />
            <ColorField
              label="Background"
              value={background}
              onChange={(v) => {
                setBackground(v);
                setPaletteSource("manual");
              }}
            />
          </div>

          {paletteCandidates.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Other colors detected in your logo
              </Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {paletteCandidates.map((hex) => (
                  <button
                    type="button"
                    key={hex}
                    onClick={() => {
                      setPrimary(hex);
                      setPaletteSource("manual");
                    }}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background pl-1 pr-2 text-[11px] font-mono text-foreground hover:border-primary"
                    title={`Use ${hex} as primary`}
                  >
                    <span
                      className="h-5 w-5 rounded border border-border/60"
                      style={{ backgroundColor: hex }}
                    />
                    {hex.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tiny preview chip */}
          <div
            className="rounded-lg border border-border p-4"
            style={previewStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Brand"
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-md"
                    style={{ backgroundColor: primary }}
                  />
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm">
                    {siteName || tenantName}
                  </div>
                  {tagline && (
                    <div className="text-[11px] opacity-70 truncate">
                      {tagline}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: primary }}
                >
                  Search flights
                </span>
                <span
                  className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: accent }}
                >
                  View deals
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Tip: AI rewrites in the AI tab will respect these colors when
            composing new sections.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5">
        <input
          type="color"
          value={isValidHex(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
          aria-label={`${label} color picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-mono outline-none"
          placeholder="#0092ff"
        />
      </div>
    </div>
  );
}