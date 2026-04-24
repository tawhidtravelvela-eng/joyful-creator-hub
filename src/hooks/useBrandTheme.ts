import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useB2B } from "@/contexts/B2BContext";
import { useAuth } from "@/contexts/AuthContext";

/** Convert "H S% L%" HSL triplet (as stored in tenant_skin_config) to a #hex. */
function hslTripletToHex(triplet: string | null | undefined): string | null {
  if (!triplet) return null;
  const m = triplet.trim().match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const mm = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round((n + mm) * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Normalise any stored color (hex w/ or w/o #, or HSL triplet) to a #hex. */
function normaliseToHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
  }
  return hslTripletToHex(trimmed);
}

/**
 * Lightweight inline palette helpers — extract the dominant non-neutral color
 * from the agent's uploaded logo via a canvas pass. Falls back to a
 * deterministic per-tenant seed when the image can't be decoded (CORS, SVG
 * without raster fallback, etc.).
 */
async function extractPaletteFromImage(url: string): Promise<{ primary: string }> {
  if (typeof window === "undefined" || !url) {
    throw new Error("palette extraction unavailable");
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const SIZE = 48;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return reject(new Error("canvas unsupported"));
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
        // Bucket by 5°-hue and accumulate weight by saturation*alpha
        const buckets: Record<number, { weight: number; r: number; g: number; b: number; n: number }> = {};
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 200) continue; // skip transparent pixels
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const l = (max + min) / 2 / 255;
          if (l < 0.08 || l > 0.92) continue; // skip near-black / near-white
          const d = max - min;
          if (d < 25) continue; // skip greys
          let h = 0;
          if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h = Math.round(h * 60);
          if (h < 0) h += 360;
          const key = Math.floor(h / 5) * 5;
          const sat = d / max;
          const w = sat * (a / 255);
          const slot = buckets[key] || (buckets[key] = { weight: 0, r: 0, g: 0, b: 0, n: 0 });
          slot.weight += w;
          slot.r += r; slot.g += g; slot.b += b; slot.n += 1;
        }
        const top = Object.values(buckets).sort((a, b) => b.weight - a.weight)[0];
        if (!top || top.n === 0) return reject(new Error("no dominant color"));
        const r = Math.round(top.r / top.n);
        const g = Math.round(top.g / top.n);
        const b = Math.round(top.b / top.n);
        const toHex = (n: number) => n.toString(16).padStart(2, "0");
        resolve({ primary: `#${toHex(r)}${toHex(g)}${toHex(b)}` });
      } catch (err) {
        reject(err as Error);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}
function fallbackPaletteFromString(seed: string): { primary: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const sat = 55 + (Math.abs(hash >> 8) % 20);
  const lit = 42;
  const c = (1 - Math.abs((2 * lit) / 100 - 1)) * (sat / 100);
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lit / 100 - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round((n + m) * 255))).toString(16).padStart(2, "0");
  return { primary: `#${toHex(r)}${toHex(g)}${toHex(b)}` };
}

/**
 * Resolves a brand color for the current B2B agent and exposes the CSS
 * custom-property overrides needed to retint the dashboard. The color is
 * derived from the agent's logo (or company name fallback) the very first time
 * we see them, then persisted to `profiles.brand_color`. The agent can later
 * override it manually — once `brand_color_locked` is true we never auto-pick
 * again until they explicitly reset.
 *
 * The hook ONLY returns CSS variables; the consumer (B2BLayout) decides where
 * to apply them so the global app shell stays untouched.
 */
export interface BrandThemeVars {
  "--primary": string;
  "--primary-foreground": string;
  "--ring": string;
  "--accent": string;
  "--accent-foreground": string;
  "--sidebar-primary": string;
  "--sidebar-primary-foreground": string;
  "--sidebar-accent": string;
  "--sidebar-background": string;
  "--sidebar-ring": string;
  "--background": string;
  "--card": string;
  "--muted": string;
  "--muted-foreground": string;
  "--border": string;
  "--input": string;
  "--secondary": string;
  "--secondary-foreground": string;
  "--success": string;
  "--success-foreground": string;
  "--warning": string;
  "--warning-foreground": string;
  "--info": string;
  "--info-foreground": string;
  "--danger": string;
  "--danger-foreground": string;
}

export interface UseBrandThemeResult {
  /** Inline CSS-variable map ready to spread into a `style` prop. */
  themeVars: React.CSSProperties | null;
  /** Hex color currently in effect (for pickers / settings UIs). */
  brandColor: string | null;
  /** True when the agent has manually pinned the color. */
  isLocked: boolean;
  /** Re-extract from the current logo and overwrite stored color. */
  reExtractFromLogo: () => Promise<void>;
  /** Manually set + lock a brand color. */
  setManualColor: (hex: string) => Promise<void>;
  /** Clear manual override so future logo changes auto-recolor again. */
  resetToAuto: () => Promise<void>;
}

/* ------------------------------------------------------------------ *
 *  Color helpers (HSL space — matches index.css token convention)     *
 * ------------------------------------------------------------------ */
const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m) return { h: 222, s: 55, l: 22 };
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** WCAG-ish luminance to decide foreground (white vs near-black). */
function relativeLuminance(hex: string): number {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m) return 0;
  const [r, g, b] = m.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Build the full CSS-variable map from a single brand hex. */
function buildThemeVars(hex: string): BrandThemeVars {
  const { h, s } = hexToHsl(hex);
  // Clamp to a usable range — too pale/too dark looks broken in the UI
  const primaryS = Math.min(72, Math.max(40, s));
  const primaryL = 42;          // solid, accessible primary

  const primaryHex = hslToHex(h, primaryS, primaryL);
  const fg = relativeLuminance(primaryHex) > 0.55 ? "222 30% 12%" : "0 0% 100%";

  // Keep accent in the SAME brand family — just a touch brighter / slightly
  // shifted. Big hue shifts (e.g. red → orange) made buttons look off-brand.
  const accentH  = h;
  const accentS  = Math.min(78, primaryS + 6);
  const accentL  = 48;

  // Tint strength scales with brand saturation but stays within readable
  // bounds. Two levels: a stronger one for chrome surfaces (sidebar/header),
  // a softer one for the page background. This is what makes the dashboard
  // visibly *theirs* instead of a generic platform shell.
  const chromeTintS = Math.min(55, Math.max(30, Math.round(primaryS / 1.4)));
  const pageTintS   = Math.min(32, Math.max(16, Math.round(primaryS / 2.6)));

  return {
    "--primary":                  `${h} ${primaryS}% ${primaryL}%`,
    "--primary-foreground":       fg,
    "--ring":                     `${h} ${primaryS}% ${primaryL}%`,
    "--accent":                   `${accentH} ${accentS}% ${accentL}%`,
    "--accent-foreground":        "0 0% 100%",

    // Sidebar — clearly tinted with the brand so the chrome reads as "theirs"
    "--sidebar-primary":          `${h} ${primaryS}% ${primaryL}%`,
    "--sidebar-primary-foreground": fg,
    "--sidebar-accent":           `${h} ${chromeTintS}% 90%`,
    "--sidebar-background":       `${h} ${chromeTintS}% 96%`,
    "--sidebar-ring":             `${h} ${primaryS}% ${primaryL}%`,

    // Page surfaces — softer wash so content stays readable on top
    "--background":               `${h} ${pageTintS}% 97%`,
    "--card":                     `0 0% 100%`,
    "--muted":                    `${h} ${pageTintS}% 94%`,
    "--muted-foreground":         `${h} 14% 38%`,
    "--border":                   `${h} ${pageTintS}% 86%`,
    "--input":                    `${h} ${pageTintS}% 86%`,
    "--secondary":                `${h} ${pageTintS + 4}% 93%`,
    "--secondary-foreground":     `${h} 35% 18%`,

    /* Status palette — tuned to harmonise with the brand. Hue stays
     * close to the conventional anchor (152 success / 38 warning /
     * 210 info / 0 danger) but saturation is borrowed from the brand
     * so flat status pills don't clash against tinted surfaces. */
    "--success":            `152 ${Math.min(60, Math.max(40, primaryS - 10))}% 40%`,
    "--success-foreground": "0 0% 100%",
    "--warning":            `38 ${Math.min(92, Math.max(70, primaryS + 18))}% 50%`,
    "--warning-foreground": "0 0% 12%",
    "--info":               `210 ${Math.min(92, Math.max(60, primaryS + 8))}% 50%`,
    "--info-foreground":    "0 0% 100%",
    "--danger":             `0 ${Math.min(78, Math.max(58, primaryS + 4))}% 51%`,
    "--danger-foreground":  "0 0% 100%",
  };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round((n + m) * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* ------------------------------------------------------------------ *
 *  Hook                                                                *
 * ------------------------------------------------------------------ */
export function useBrandTheme(): UseBrandThemeResult {
  const { user } = useAuth();
  const { profile, refresh } = useB2B();
  const [storedColor, setStoredColor] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [extracted, setExtracted] = useState<string | null>(null);
  // Color the agent explicitly picked for their public site (tenant_skin_config).
  // Wins over auto-extracted logo color so the dashboard matches the brand
  // they actually chose.
  const [tenantSkinColor, setTenantSkinColor] = useState<string | null>(null);
  // Tracks whether we've finished reading profiles.brand_color from the DB.
  // Without this gate, the auto-extract effect races the fetch and overwrites
  // a saved color with a freshly-seeded one on every page load.
  const [hydrated, setHydrated] = useState(false);
  const lastSourceRef = useRef<string>("");

  // Pull the persisted brand_color/lock for the signed-in agent.
  useEffect(() => {
    if (!user) {
      setStoredColor(null);
      setIsLocked(false);
      setHydrated(false);
      setTenantSkinColor(null);
      return;
    }
    let cancelled = false;
    setHydrated(false);
    (async () => {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("brand_color, brand_color_locked, tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profileRow?.brand_color && HEX_RE.test(profileRow.brand_color)) {
        setStoredColor(profileRow.brand_color);
      } else {
        setStoredColor(null);
      }
      setIsLocked(!!profileRow?.brand_color_locked);

      // Pull the tenant's chosen public-site brand color so the dashboard
      // mirrors the palette the agent actually picked.
      const tenantId = (profileRow as any)?.tenant_id;
      if (tenantId) {
        const { data: skinRow } = await supabase
          .from("tenant_skin_config")
          .select("primary_color")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (!cancelled) {
          setTenantSkinColor(normaliseToHex(skinRow?.primary_color));
        }
      } else {
        setTenantSkinColor(null);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Auto-extract from the logo when no stored color exists (lazy backfill +
  // first-time experience). Re-runs whenever the logo URL changes, unless the
  // agent has manually locked their color.
  useEffect(() => {
    if (!user) return;
    // Wait until we know what's actually persisted — otherwise we'd overwrite
    // the stored brand color with a fresh seed on every reload.
    if (!hydrated) return;
    if (storedColor) {
      setExtracted(storedColor);
      return;
    }
    const sourceUrl = profile.logo_url || "";
    const sourceKey = sourceUrl || `seed:${profile.company_name || user.email || user.id}`;
    if (lastSourceRef.current === sourceKey) return;
    lastSourceRef.current = sourceKey;

    let cancelled = false;
    const run = async () => {
      let hex: string | null = null;
      if (sourceUrl) {
        try {
          const palette = await extractPaletteFromImage(sourceUrl);
          hex = palette.primary;
        } catch {
          // CORS / SVG / decode failure → fall through to deterministic seed
        }
      }
      if (!hex) {
        hex = fallbackPaletteFromString(profile.company_name || user.email || user.id).primary;
      }
      if (cancelled || !hex) return;
      setExtracted(hex);
      // Persist so we don't recompute on every login
      await supabase
        .from("profiles")
        .update({ brand_color: hex } as any)
        .eq("user_id", user.id);
      setStoredColor(hex);
    };
    void run();
    return () => { cancelled = true; };
  }, [user, profile.logo_url, profile.company_name, storedColor, hydrated]);

  // Priority order:
  //   1. Manually locked profile color (agent explicitly pinned it here)
  //   2. Tenant's saved public-site primary color (the brand they chose)
  //   3. Stored profile color (auto-extracted earlier)
  //   4. Freshly extracted/seeded color
  const activeHex = (isLocked && storedColor)
    ? storedColor
    : (tenantSkinColor || storedColor || extracted);

  const themeVars = useMemo<React.CSSProperties | null>(() => {
    if (!activeHex) return null;
    return buildThemeVars(activeHex) as unknown as React.CSSProperties;
  }, [activeHex]);

  const reExtractFromLogo = async () => {
    if (!user || !profile.logo_url) return;
    let hex: string | null = null;
    try {
      const palette = await extractPaletteFromImage(profile.logo_url);
      hex = palette.primary;
    } catch {
      hex = fallbackPaletteFromString(profile.company_name || user.email || user.id).primary;
    }
    if (!hex) return;
    await supabase
      .from("profiles")
      .update({ brand_color: hex, brand_color_locked: false } as any)
      .eq("user_id", user.id);
    setStoredColor(hex);
    setIsLocked(false);
    refresh();
  };

  const setManualColor = async (hex: string) => {
    if (!user || !HEX_RE.test(hex)) return;
    const normalized = hex.startsWith("#") ? hex.toLowerCase() : `#${hex.toLowerCase()}`;
    await supabase
      .from("profiles")
      .update({ brand_color: normalized, brand_color_locked: true } as any)
      .eq("user_id", user.id);
    setStoredColor(normalized);
    setIsLocked(true);
    refresh();
  };

  const resetToAuto = async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ brand_color: null, brand_color_locked: false } as any)
      .eq("user_id", user.id);
    setStoredColor(null);
    setIsLocked(false);
    lastSourceRef.current = ""; // force re-extract effect to run
    refresh();
  };

  return {
    themeVars,
    brandColor: activeHex,
    isLocked,
    reExtractFromLogo,
    setManualColor,
    resetToAuto,
  };
}

export default useBrandTheme;