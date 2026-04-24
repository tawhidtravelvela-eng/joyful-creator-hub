import type { DesignTokens, SkinKey } from "./types";

/**
 * Skin design presets.
 *
 * Each of the 6 platform skins ships with its own signature visual
 * identity — color palette, typography pair, density and radius. When a
 * tenant selects a skin (and has not overridden tokens themselves) these
 * defaults are applied automatically so each skin instantly *looks*
 * distinct, not just structurally different.
 *
 * Colors are stored as raw HSL triplets ("H S% L%") so they can be dropped
 * straight into CSS variables that are already declared as `hsl(var(--x))`
 * across the design system.
 */

export interface SkinDesignPreset {
  // Color tokens (HSL triplets, no `hsl()` wrapper)
  primary_color: string;
  accent_color: string;
  background_color: string;

  // Typography
  font_heading: string;
  font_body: string;

  // Layout feel
  border_radius: string; // e.g. "0.5rem"
  density: "compact" | "cozy" | "roomy";

  // Marketing chrome — surfaced in the Studio preview swatches
  mood: string;
  hero_treatment: "immersive" | "editorial" | "inspirational" | "balanced" | "split" | "restrained";
}

export const SKIN_DESIGN_PRESETS: Record<SkinKey, SkinDesignPreset> = {
  // Bold consumer flight — energetic blue + sunset accent, immersive hero
  "b2c-flight": {
    primary_color: "217 91% 55%",
    accent_color: "24 95% 58%",
    background_color: "222 47% 6%",
    font_heading: "'Sora', system-ui, sans-serif",
    font_body: "'Inter', system-ui, sans-serif",
    border_radius: "0.75rem",
    density: "cozy",
    mood: "Bold · Energetic · Night sky",
    hero_treatment: "immersive",
  },

  // Editorial hotel — warm cream + terracotta, magazine layout
  "b2c-hotel": {
    primary_color: "16 65% 48%",
    accent_color: "32 78% 60%",
    background_color: "36 33% 97%",
    font_heading: "'Playfair Display', Georgia, serif",
    font_body: "'Inter', system-ui, sans-serif",
    border_radius: "0.375rem",
    density: "roomy",
    mood: "Warm · Editorial · Hospitality",
    hero_treatment: "editorial",
  },

  // Tours / experiences — rich emerald + coral, inspirational
  "b2c-tour": {
    primary_color: "160 64% 38%",
    accent_color: "8 85% 62%",
    background_color: "150 22% 97%",
    font_heading: "'Fraunces', Georgia, serif",
    font_body: "'Inter', system-ui, sans-serif",
    border_radius: "1rem",
    density: "roomy",
    mood: "Inspirational · Wanderlust · Earthy",
    hero_treatment: "inspirational",
  },

  // Balanced general — neutral indigo, clean sans, all-rounder
  "b2c-general": {
    primary_color: "238 75% 58%",
    accent_color: "190 85% 50%",
    background_color: "0 0% 100%",
    font_heading: "'Inter', system-ui, sans-serif",
    font_body: "'Inter', system-ui, sans-serif",
    border_radius: "0.5rem",
    density: "cozy",
    mood: "Balanced · Neutral · Trustworthy",
    hero_treatment: "balanced",
  },

  // Hybrid consumer + agent — confident violet + amber accent
  "hybrid-full": {
    primary_color: "262 72% 55%",
    accent_color: "38 92% 55%",
    background_color: "240 20% 98%",
    font_heading: "'Plus Jakarta Sans', system-ui, sans-serif",
    font_body: "'Inter', system-ui, sans-serif",
    border_radius: "0.625rem",
    density: "cozy",
    mood: "Confident · Dual-audience · Versatile",
    hero_treatment: "split",
  },

  // B2B corporate — restrained navy + steel, serif headings
  "b2b-corporate": {
    primary_color: "215 60% 25%",
    accent_color: "200 25% 55%",
    background_color: "210 20% 98%",
    font_heading: "'Source Serif 4', Georgia, serif",
    font_body: "'Inter', system-ui, sans-serif",
    border_radius: "0.25rem",
    density: "compact",
    mood: "Restrained · Corporate · Authoritative",
    hero_treatment: "restrained",
  },
};

/**
 * Returns the preset tokens with any tenant overrides layered on top.
 * Empty / null override values fall back to the preset.
 */
export function resolveSkinTokens(
  skinKey: SkinKey,
  overrides?: Partial<DesignTokens> | null,
): DesignTokens {
  const preset = SKIN_DESIGN_PRESETS[skinKey] || SKIN_DESIGN_PRESETS["b2c-general"];
  const pick = <T,>(o: T | null | undefined, fallback: T): T =>
    o === null || o === undefined || o === "" ? fallback : o;

  return {
    primary_color: normalizeHslToken(pick(overrides?.primary_color, preset.primary_color)),
    accent_color: normalizeHslToken(pick(overrides?.accent_color, preset.accent_color)),
    background_color: normalizeHslToken(pick(overrides?.background_color, preset.background_color)),
    font_heading: pick(overrides?.font_heading, preset.font_heading),
    font_body: pick(overrides?.font_body, preset.font_body),
    border_radius: pick(overrides?.border_radius, preset.border_radius),
    density: pick(overrides?.density, preset.density),
  };
}

export function getSkinPreset(skinKey: SkinKey): SkinDesignPreset {
  return SKIN_DESIGN_PRESETS[skinKey] || SKIN_DESIGN_PRESETS["b2c-general"];
}

/**
 * Convert any color value to the HSL-triplet string Tailwind expects
 * (e.g. `217 91% 55%`).
 *
 * - Already-triplet values (`"217 91% 55%"`) pass through.
 * - Hex values (`"#FF6B35"` or `"FF6B35"`) are converted.
 * - `null`/empty/invalid values are returned untouched so the caller's
 *   fallback chain still works.
 *
 * Why: tenant brand colors picked from the wizard are stored as raw hex.
 * `index.css` declares `--primary` as an HSL triplet and Tailwind wraps it
 * in `hsl(var(--primary))`, so a raw hex breaks the entire color system on
 * the live site. Normalising at resolve time fixes both new and existing
 * tenants without a data migration.
 */
export function normalizeHslToken<T>(value: T): T {
  if (typeof value !== "string") return value;
  const v = value.trim();
  if (!v) return value;
  // Already an HSL triplet — three space-separated parts, last two with `%`.
  if (/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(v)) return value;
  // Hex (3 or 6 digits, optional leading #).
  const hexMatch = v.replace(/^#/, "").match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hexMatch) return value;
  return hexToHslTriplet(v) as unknown as T;
}

/** Pure hex → "H S% L%" converter. */
export function hexToHslTriplet(hex: string): string {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hue = (b - r) / d + 2; break;
      case b: hue = (r - g) / d + 4; break;
    }
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Converts either a stored HSL triplet or a hex string to UI-safe hex. */
export function colorTokenToHex(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const raw = hexMatch[1];
    const expanded =
      raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    return `#${expanded.toLowerCase()}`;
  }

  const hslMatch = trimmed.match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!hslMatch) return null;

  const h = Number(hslMatch[1]);
  const s = Number(hslMatch[2]) / 100;
  const l = Number(hslMatch[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round((n + m) * 255)))
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}