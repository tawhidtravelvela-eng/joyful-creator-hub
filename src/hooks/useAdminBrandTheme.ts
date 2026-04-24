/**
 * useAdminBrandTheme — applies the tenant admin's logo-derived brand color
 * to the /admin chrome. Mirrors useBrandTheme but does NOT depend on
 * B2BProvider (which isn't mounted under AdminLayout).
 *
 * - Super admins (no adminTenantId) → returns null themeVars (platform default).
 * - Tenant admins → reads their own profile (brand_color first, then logo_url
 *   for live extraction, then deterministic seed) and exposes CSS variables
 *   ready to spread on the admin wrapper.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m) return { h: 222, s: 55, l: 22 };
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
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

function relLum(hex: string): number {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m) return 0;
  const [r, g, b] = m.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function buildVars(hex: string): Record<string, string> {
  const { h, s } = hexToHsl(hex);
  const sat = Math.min(70, Math.max(35, s));
  const primary = `${h} ${sat}% 42%`;
  const onPrimary = relLum(hex) > 0.55 ? "222 47% 11%" : "0 0% 100%";
  return {
    "--primary": primary,
    "--primary-foreground": onPrimary,
    "--ring": primary,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": onPrimary,
    "--sidebar-accent": `${h} ${Math.max(20, sat - 20)}% 94%`,
    "--sidebar-ring": primary,
    "--accent": `${h} ${Math.max(20, sat - 15)}% 92%`,
    "--accent-foreground": "222 47% 11%",
  };
}

async function extractFromImage(url: string): Promise<string | null> {
  if (typeof window === "undefined" || !url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const SIZE = 48;
        const c = document.createElement("canvas");
        c.width = SIZE; c.height = SIZE;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
        const buckets: Record<number, { w: number; r: number; g: number; b: number; n: number }> = {};
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]; if (a < 200) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const l = (max + min) / 2 / 255;
          if (l < 0.08 || l > 0.92) continue;
          const d = max - min; if (d < 25) continue;
          let h = 0;
          if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h = Math.round(h * 60); if (h < 0) h += 360;
          const key = Math.floor(h / 5) * 5;
          const slot = buckets[key] || (buckets[key] = { w: 0, r: 0, g: 0, b: 0, n: 0 });
          slot.w += (d / max) * (a / 255);
          slot.r += r; slot.g += g; slot.b += b; slot.n += 1;
        }
        const top = Object.values(buckets).sort((a, b) => b.w - a.w)[0];
        if (!top || top.n === 0) return resolve(null);
        const toHex = (n: number) => n.toString(16).padStart(2, "0");
        resolve(`#${toHex(Math.round(top.r / top.n))}${toHex(Math.round(top.g / top.n))}${toHex(Math.round(top.b / top.n))}`);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function seedFromString(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const { h, s, l } = { h: hue, s: 60, l: 42 };
  // hsl → hex
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function useAdminBrandTheme() {
  const { user, adminTenantId } = useAuth();
  const [color, setColor] = useState<string | null>(null);
  const ranFor = useRef<string>("");

  useEffect(() => {
    // Super admins (no tenant) → no override
    if (!user || !adminTenantId) {
      setColor(null);
      ranFor.current = "";
      return;
    }
    const key = `${user.id}:${adminTenantId}`;
    if (ranFor.current === key) return;
    ranFor.current = key;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("brand_color, brand_color_locked, logo_url, company_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const stored = (data as any)?.brand_color as string | undefined;
      if (stored && HEX_RE.test(stored)) {
        setColor(stored);
        return;
      }
      const logo = (data as any)?.logo_url as string | undefined;
      let hex: string | null = null;
      if (logo) hex = await extractFromImage(logo);
      if (!hex) hex = seedFromString((data as any)?.company_name || user.email || user.id);
      if (cancelled || !hex) return;
      setColor(hex);
      // Persist for next load (skip if locked)
      if (!(data as any)?.brand_color_locked) {
        await supabase.from("profiles").update({ brand_color: hex } as any).eq("user_id", user.id);
      }
    })();

    return () => { cancelled = true; };
  }, [user, adminTenantId]);

  const themeVars = useMemo<CSSProperties | null>(() => {
    if (!color) return null;
    return buildVars(color) as unknown as CSSProperties;
  }, [color]);

  return { themeVars, brandColor: color };
}

export default useAdminBrandTheme;