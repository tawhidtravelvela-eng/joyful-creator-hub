import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { themePresets, getThemeFontUrl } from "@/data/themePresets";
import { resolveSkinTokens } from "@/lib/skins/designPresets";

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  primary_foreground: string;
  secondary: string;
  secondary_foreground: string;
  accent: string;
  accent_foreground: string;
  muted: string;
  muted_foreground: string;
  destructive: string;
  card: string;
  card_foreground: string;
  border: string;
}

const defaultColors: ThemeColors = {
  background: "#f7fafd",
  foreground: "#0a1929",
  primary: "#0092ff",
  primary_foreground: "#ffffff",
  secondary: "#e8f4ff",
  secondary_foreground: "#003d6b",
  accent: "#ff6b2c",
  accent_foreground: "#ffffff",
  muted: "#edf3f8",
  muted_foreground: "#5a7a99",
  destructive: "#e53935",
  card: "#ffffff",
  card_foreground: "#0a1929",
  border: "#d0e3f2",
};

type BrandThemeVars = Partial<Record<
  | "--background"
  | "--foreground"
  | "--primary"
  | "--primary-foreground"
  | "--secondary"
  | "--secondary-foreground"
  | "--accent"
  | "--accent-foreground"
  | "--muted"
  | "--muted-foreground"
  | "--card"
  | "--card-foreground"
  | "--border"
  | "--input"
  | "--ring",
  string
>>;

function hexToHSL(hex: string): string {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function isHexColor(value: string | null | undefined): value is string {
  return !!value && /^#?[0-9a-fA-F]{6}$/.test(value);
}

function hslTripletToHex(triplet: string | null | undefined): string | null {
  if (!triplet) return null;
  const match = triplet.trim().match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!match) return null;
  const h = Number(match[1]);
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c; g = x;
  } else if (h < 120) {
    r = x; g = c;
  } else if (h < 180) {
    g = c; b = x;
  } else if (h < 240) {
    g = x; b = c;
  } else if (h < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round((n + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance(hex: string): number {
  const expanded = hex.replace(/^#/, "");
  const pairs = expanded.match(/.{1,2}/g);
  if (!pairs) return 0;
  const [r, g, b] = pairs.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c; g = x;
  } else if (h < 120) {
    r = x; g = c;
  } else if (h < 180) {
    g = c; b = x;
  } else if (h < 240) {
    g = x; b = c;
  } else if (h < 300) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round((n + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function buildThemeVars(hex: string): BrandThemeVars {
  const source = hexToHSL(hex).match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!source) return {};
  const h = Number(source[1]);
  const s = Number(source[2]);
  const primaryS = Math.min(72, Math.max(40, s));
  const primaryL = 42;
  const primaryHex = hslToHex(h, primaryS, primaryL);
  const fg = relativeLuminance(primaryHex) > 0.55 ? "#0a1929" : "#ffffff";
  const accentS = Math.min(78, primaryS + 6);
  const pageTintS = Math.min(32, Math.max(16, Math.round(primaryS / 2.6)));
  return {
    "--primary": `${h} ${primaryS}% ${primaryL}%`,
    "--primary-foreground": hexToHSL(fg),
    "--ring": `${h} ${primaryS}% ${primaryL}%`,
    "--accent": `${h} ${accentS}% 48%`,
    "--accent-foreground": "0 0% 100%",
    "--background": `${h} ${pageTintS}% 97%`,
    "--card": "0 0% 100%",
    "--muted": `${h} ${pageTintS}% 94%`,
    "--muted-foreground": `${h} 14% 38%`,
    "--border": `${h} ${pageTintS}% 86%`,
    "--input": `${h} ${pageTintS}% 86%`,
    "--secondary": `${h} ${pageTintS + 4}% 93%`,
    "--secondary-foreground": `${h} 35% 18%`,
    "--foreground": `${h} 30% 12%`,
    "--card-foreground": `${h} 30% 12%`,
  };
}

function mergeThemeFromBrand(seedHex: string, colors: ThemeColors): ThemeColors {
  const vars = buildThemeVars(seedHex);
  const readHex = (cssVar: keyof BrandThemeVars, fallback: string) =>
    hslTripletToHex(vars[cssVar]) || fallback;
  return {
    ...colors,
    background: readHex("--background", colors.background),
    foreground: readHex("--foreground", colors.foreground),
    primary: readHex("--primary", colors.primary),
    primary_foreground: readHex("--primary-foreground", colors.primary_foreground),
    secondary: readHex("--secondary", colors.secondary),
    secondary_foreground: readHex("--secondary-foreground", colors.secondary_foreground),
    accent: readHex("--accent", colors.accent),
    accent_foreground: readHex("--accent-foreground", colors.accent_foreground),
    muted: readHex("--muted", colors.muted),
    muted_foreground: readHex("--muted-foreground", colors.muted_foreground),
    card: readHex("--card", colors.card),
    card_foreground: readHex("--card-foreground", colors.card_foreground),
    border: readHex("--border", colors.border),
  };
}

let cached: ThemeColors | null = null;
let cachedForTenant: string | null = null;

export function useThemeColors() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id || null;

  const [colors, setColors] = useState<ThemeColors>(
    cached && cachedForTenant === tenantId ? cached : defaultColors
  );

  useEffect(() => {
    // Skip root-level tenant theme on routes that scope their own brand theme
    // (B2B agent dashboard, Studio editor, Admin panel). Otherwise the tenant
    // public-site palette overrides the agent's logo-derived dashboard tint.
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      if (
        p.startsWith("/dashboard") ||
        p.startsWith("/studio") ||
        p.startsWith("/admin")
      ) {
        return;
      }
    }
    if (cached && cachedForTenant === tenantId) {
      applyColors(cached);
      applyTenantFontsAndRadius(tenant?.settings || {});
      return;
    }

    const load = async () => {
      try {
        let merged: ThemeColors = { ...defaultColors };

        if (tenant) {
          const ts = tenant.settings;
          // If tenant has a theme preset, start from that
          const presetId = ts.theme_preset;
          const preset = presetId ? themePresets.find((p) => p.id === presetId) : null;
          if (preset) {
            merged = { ...preset.colors };
          }

          // Apply overrides from theme_color_overrides
          const overrides = (ts.theme_color_overrides || {}) as Record<string, string>;
          for (const key of Object.keys(defaultColors) as (keyof ThemeColors)[]) {
            if (overrides[key]) merged[key] = overrides[key];
          }

          // Legacy: direct color_* keys override too
          for (const key of Object.keys(defaultColors) as (keyof ThemeColors)[]) {
            if (ts[`color_${key}`]) merged[key] = ts[`color_${key}`];
          }

          const { data: skinRow } = await supabase
            .from("tenant_skin_config")
            .select(
              "skin_key, primary_color, accent_color, background_color, font_heading, font_body, border_radius, density",
            )
            .eq("tenant_id", tenant.id)
            .maybeSingle();

          const resolvedTokens = resolveSkinTokens(
            (skinRow?.skin_key as any) || "b2c-general",
            skinRow
              ? {
                  primary_color: skinRow.primary_color,
                  accent_color: skinRow.accent_color,
                  background_color: skinRow.background_color,
                  font_heading: skinRow.font_heading,
                  font_body: skinRow.font_body,
                  border_radius: skinRow.border_radius,
                  density: skinRow.density as any,
                }
              : null,
          );

          const resolvedPrimaryHex = isHexColor(resolvedTokens.primary_color)
            ? resolvedTokens.primary_color.startsWith("#")
              ? resolvedTokens.primary_color
              : `#${resolvedTokens.primary_color}`
            : hslTripletToHex(resolvedTokens.primary_color);
          const resolvedAccentHex = isHexColor(resolvedTokens.accent_color)
            ? resolvedTokens.accent_color.startsWith("#")
              ? resolvedTokens.accent_color
              : `#${resolvedTokens.accent_color}`
            : hslTripletToHex(resolvedTokens.accent_color);
          const resolvedBackgroundHex = isHexColor(resolvedTokens.background_color)
            ? resolvedTokens.background_color.startsWith("#")
              ? resolvedTokens.background_color
              : `#${resolvedTokens.background_color}`
            : hslTripletToHex(resolvedTokens.background_color);

          if (resolvedPrimaryHex) {
            merged = mergeThemeFromBrand(resolvedPrimaryHex, merged);
            merged.primary = resolvedPrimaryHex;
          }
          if (resolvedAccentHex) merged.accent = resolvedAccentHex;
          if (resolvedBackgroundHex) merged.background = resolvedBackgroundHex;

          // Apply fonts and radius
          applyTenantFontsAndRadius({
            ...ts,
            theme_font_heading: ts.theme_font_heading || resolvedTokens.font_heading,
            theme_font_body: ts.theme_font_body || resolvedTokens.font_body,
            theme_radius: ts.theme_radius || resolvedTokens.border_radius,
          });
        } else {
          // Global: fetch from api_settings
          const { data } = await supabase
            .from("api_settings")
            .select("settings")
            .eq("provider", "site_branding")
            .maybeSingle();

          const s = (data?.settings as Record<string, any>) || {};
          for (const key of Object.keys(defaultColors) as (keyof ThemeColors)[]) {
            if (s[`color_${key}`]) merged[key] = s[`color_${key}`];
          }
        }

        cached = merged;
        cachedForTenant = tenantId;
        setColors(merged);
        applyColors(merged);
      } catch {
        // use defaults
      }
    };
    load();
  }, [tenant, tenantId]);

  return colors;
}

function applyTenantFontsAndRadius(settings: Record<string, any>) {
  const root = document.documentElement;
  const presetId = settings.theme_preset;
  const preset = presetId ? themePresets.find((p) => p.id === presetId) : null;

  // Set data-theme attribute for structural CSS overrides
  if (presetId) {
    root.setAttribute("data-theme", presetId);
  } else {
    root.removeAttribute("data-theme");
  }

  if (preset) {
    const heading = settings.theme_font_heading || preset.fonts.heading;
    const body = settings.theme_font_body || preset.fonts.body;
    const radius = settings.theme_radius || preset.radius;

    // Load Google Fonts
    const fontUrl = getThemeFontUrl(heading, body);
    let link = document.getElementById("tenant-theme-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "tenant-theme-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = fontUrl;

    root.style.setProperty("--font-heading", `'${heading}', serif`);
    root.style.setProperty("--font-body", `'${body}', sans-serif`);
    root.style.setProperty("--radius", radius);

    // Apply to existing CSS
    document.body.style.fontFamily = `'${body}', sans-serif`;
    document.querySelectorAll("h1, h2, h3").forEach((el) => {
      (el as HTMLElement).style.fontFamily = `'${heading}', serif`;
    });
  }
}

function applyColors(colors: ThemeColors) {
  const root = document.documentElement;
  const map: Record<keyof ThemeColors, string> = {
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

  for (const [key, cssVar] of Object.entries(map)) {
    const hex = colors[key as keyof ThemeColors];
    if (hex && hex.startsWith("#")) {
      root.style.setProperty(cssVar, hexToHSL(hex));
    }
  }
  if (colors.border?.startsWith("#")) root.style.setProperty("--input", hexToHSL(colors.border));
  if (colors.primary?.startsWith("#")) root.style.setProperty("--ring", hexToHSL(colors.primary));
}

export function invalidateThemeCache() {
  cached = null;
  cachedForTenant = null;
}
