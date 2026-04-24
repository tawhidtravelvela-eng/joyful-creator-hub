/**
 * useAdminTheme — applies a tenant-scoped theme preset to the admin dashboard chrome.
 *
 * Scope:
 *  - Tenant admins (adminTenantId set) → load that tenant's `admin_theme_preset` and
 *    apply it to admin pages only.
 *  - Super admins (adminTenantId null) → no override; default platform look stays.
 *
 * Storage: tenants.settings.{admin_theme_preset, admin_theme_font_heading,
 *   admin_theme_font_body, admin_theme_radius}. Kept SEPARATE from the existing
 *   theme_preset (which themes the public/B2B site) so admins can have a different
 *   look from their public website.
 *
 * The hook returns inline style + className helpers; we apply variables to a wrapper
 * div inside AdminLayout so they don't leak to other surfaces.
 */
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { themePresets, getThemeFontUrl } from "@/data/themePresets";

function hexToHslTriplet(hex?: string | null): string | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hh = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hh = (b - r) / d + 2; break;
      case b: hh = (r - g) / d + 4; break;
    }
    hh /= 6;
  }
  return `${Math.round(hh * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const COLOR_TO_VAR: Record<string, string> = {
  background: "--background",
  foreground: "--foreground",
  primary: "--primary",
  primary_foreground: "--primary-foreground",
  secondary: "--secondary",
  secondary_foreground: "--secondary-foreground",
  accent: "--accent",
  accent_foreground: "--accent-foreground",
  muted: "--muted",
  muted_foreground: "--muted-foreground",
  destructive: "--destructive",
  card: "--card",
  card_foreground: "--card-foreground",
  border: "--border",
};

let adminThemeCache: { tenantId: string; settings: Record<string, any> } | null = null;

export function invalidateAdminThemeCache() {
  adminThemeCache = null;
}

export function useAdminTheme() {
  const { adminTenantId } = useAuth();
  const [settings, setSettings] = useState<Record<string, any> | null>(
    adminThemeCache && adminTenantId === adminThemeCache.tenantId
      ? adminThemeCache.settings
      : null
  );

  useEffect(() => {
    if (!adminTenantId) {
      setSettings(null);
      return;
    }
    if (adminThemeCache && adminThemeCache.tenantId === adminTenantId) {
      setSettings(adminThemeCache.settings);
      return;
    }
    supabase
      .from("tenants")
      .select("settings")
      .eq("id", adminTenantId)
      .maybeSingle()
      .then(({ data }) => {
        const s = (data?.settings as Record<string, any>) || {};
        adminThemeCache = { tenantId: adminTenantId, settings: s };
        setSettings(s);
      });
  }, [adminTenantId]);

  const presetId = settings?.admin_theme_preset as string | undefined;
  const preset = presetId ? themePresets.find((p) => p.id === presetId) : null;

  const style = useMemo<CSSProperties>(() => {
    if (!preset) return {};
    const out: Record<string, string> = {};
    for (const [key, varName] of Object.entries(COLOR_TO_VAR)) {
      const overrides = (settings?.admin_theme_color_overrides as Record<string, string>) || {};
      const hex = overrides[key] || (preset.colors as Record<string, string>)[key];
      const triplet = hexToHslTriplet(hex);
      if (triplet) out[varName] = triplet;
    }
    // Mirror primary -> ring, border -> input
    const overrides = (settings?.admin_theme_color_overrides as Record<string, string>) || {};
    const ring = hexToHslTriplet(overrides.primary || preset.colors.primary);
    if (ring) out["--ring"] = ring;
    const input = hexToHslTriplet(overrides.border || preset.colors.border);
    if (input) out["--input"] = input;

    const heading = settings?.admin_theme_font_heading || preset.fonts.heading;
    const body = settings?.admin_theme_font_body || preset.fonts.body;
    const radius = settings?.admin_theme_radius || preset.radius;
    out["--font-heading"] = `'${heading}', serif`;
    out["--font-body"] = `'${body}', sans-serif`;
    out["--radius"] = radius;
    out.fontFamily = `'${body}', sans-serif`;
    return out as CSSProperties;
  }, [preset, settings]);

  // Lazy-load Google Fonts for the admin preset (separate <link> from public site)
  useEffect(() => {
    if (!preset) return;
    const heading = settings?.admin_theme_font_heading || preset.fonts.heading;
    const body = settings?.admin_theme_font_body || preset.fonts.body;
    const url = getThemeFontUrl(heading, body);
    let link = document.getElementById("admin-theme-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "admin-theme-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== url) link.href = url;
  }, [preset, settings]);

  return { style, hasTheme: !!preset, presetId };
}