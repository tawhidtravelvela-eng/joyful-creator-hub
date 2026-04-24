import { useEffect } from "react";
import { useTenantSkin } from "@/hooks/useTenantSkin";
import type { DesignTokens } from "@/lib/skins/types";

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
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round((n + m) * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHslTriplet(hex: string): string {
  const raw = hex.replace(/^#/, "");
  const expanded = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0, h = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round((n + m) * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance(hex: string): number {
  const parts = hex.replace(/^#/, "").match(/.{1,2}/g);
  if (!parts) return 0;
  const [r, g, b] = parts.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function buildRootThemeVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  const primaryHex = hslTripletToHex(tokens.primary_color || undefined);
  const accentHex = hslTripletToHex(tokens.accent_color || undefined);
  const backgroundHex = hslTripletToHex(tokens.background_color || undefined);

  if (primaryHex) {
    const source = hexToHslTriplet(primaryHex).match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
    if (source) {
      const h = Number(source[1]);
      const s = Number(source[2]);
      const primaryS = Math.min(72, Math.max(40, s));
      const primaryL = 42;
      const primarySolidHex = hslToHex(h, primaryS, primaryL);
      const primaryFg = relativeLuminance(primarySolidHex) > 0.55 ? "#0a1929" : "#ffffff";
      const accentS = Math.min(78, primaryS + 6);
      const pageTintS = Math.min(32, Math.max(16, Math.round(primaryS / 2.6)));

      vars["--primary"] = `${h} ${primaryS}% ${primaryL}%`;
      vars["--primary-foreground"] = hexToHslTriplet(primaryFg);
      vars["--ring"] = `${h} ${primaryS}% ${primaryL}%`;
      vars["--secondary"] = `${h} ${pageTintS + 4}% 93%`;
      vars["--secondary-foreground"] = `${h} 35% 18%`;
      vars["--muted"] = `${h} ${pageTintS}% 94%`;
      vars["--muted-foreground"] = `${h} 14% 38%`;
      vars["--border"] = `${h} ${pageTintS}% 86%`;
      vars["--input"] = `${h} ${pageTintS}% 86%`;
      vars["--foreground"] = `${h} 30% 12%`;
      vars["--card"] = "0 0% 100%";
      vars["--card-foreground"] = `${h} 30% 12%`;
      vars["--accent"] = accentHex ? hexToHslTriplet(accentHex) : `${h} ${accentS}% 48%`;
      vars["--accent-foreground"] = "0 0% 100%";
      if (!backgroundHex) vars["--background"] = `${h} ${pageTintS}% 97%`;
    }
  }

  if (backgroundHex) vars["--background"] = hexToHslTriplet(backgroundHex);
  if (accentHex) vars["--accent"] = hexToHslTriplet(accentHex);
  if (tokens.border_radius) vars["--radius"] = tokens.border_radius;
  if (tokens.font_heading) vars["--font-heading"] = tokens.font_heading;
  if (tokens.font_body) vars["--font-body"] = tokens.font_body;

  return vars;
}

function extractGoogleFonts(...stacks: (string | null | undefined)[]): string[] {
  const known = new Set([
    "Sora", "Inter", "Playfair Display", "Fraunces",
    "Plus Jakarta Sans", "Source Serif 4",
  ]);
  const found = new Set<string>();
  for (const stack of stacks) {
    if (!stack) continue;
    const matches = stack.match(/'([^']+)'|"([^"]+)"/g) || [];
    for (const m of matches) {
      const name = m.replace(/['"]/g, "");
      if (known.has(name)) found.add(name);
    }
  }
  return Array.from(found);
}

/**
 * Applies the active tenant's design tokens to `document.documentElement`
 * so every shadcn semantic class (bg-primary, text-foreground, border, etc.)
 * reflects the tenant's brand on ANY page — not just composition-rendered
 * homepages. Also injects the relevant Google Fonts stylesheet.
 */
export function useApplyTenantTheme() {
  const { data } = useTenantSkin();

  useEffect(() => {
    if (!data) return;
    const families = extractGoogleFonts(
      data.design_tokens.font_heading,
      data.design_tokens.font_body,
    );
    if (!families.length) return;
    const id = "tenant-skin-fonts";
    const href = `https://fonts.googleapis.com/css2?${families
      .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`)
      .join("&")}&display=swap`;
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    const vars = buildRootThemeVars(data.design_tokens);
    const previous = new Map<string, string>();
    Object.entries(vars).forEach(([key, value]) => {
      previous.set(key, root.style.getPropertyValue(key));
      root.style.setProperty(key, value);
    });
    return () => {
      Object.keys(vars).forEach((key) => {
        const prev = previous.get(key);
        if (prev) root.style.setProperty(key, prev);
        else root.style.removeProperty(key);
      });
    };
  }, [data]);
}
