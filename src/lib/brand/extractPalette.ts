/**
 * Client-side palette extraction.
 *
 * Loads an image from a URL into a canvas, samples its pixels, buckets them
 * into HSL bins, and returns the most prominent colors. Then it picks a
 * sensible primary / accent / background trio for a travel-site skin.
 *
 * Stays browser-only (no canvas in node) and intentionally avoids any
 * dependency so we don't add weight to the Studio bundle. Good enough for
 * the ~90% of logos that have 1–3 dominant brand colors. The Studio offers
 * an "Improve with AI" button that calls the `extract-brand-palette` edge
 * function for trickier logos.
 */

export type BrandPalette = {
  primary: string;
  accent: string;
  background: string;
  candidates: string[];
  source: "client" | "ai";
};

type RGB = { r: number; g: number; b: number };

function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return { h, s, l };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = url;
  });
}

/**
 * Sample the image into a 64x64 canvas, bucket pixels by hue+lightness,
 * and return the most common non-grayscale colors sorted by frequency.
 */
export async function extractPaletteFromUrl(
  url: string,
  topN = 6,
): Promise<BrandPalette> {
  if (typeof document === "undefined") {
    throw new Error("Palette extraction only runs in the browser");
  }
  const img = await loadImage(url);
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  // Letterbox the image so very wide / tall logos don't get squashed.
  const ratio = Math.min(size / img.width, size / img.height);
  const w = Math.max(1, img.width * ratio);
  const h = Math.max(1, img.height * ratio);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, size, size).data;
  } catch {
    throw new Error(
      "Unable to read pixels — the logo URL must allow CORS access.",
    );
  }

  const buckets = new Map<string, { rgb: RGB; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 200) continue;
    const { s, l } = rgbToHsl({ r, g, b });
    // Skip near-white / near-black / very desaturated pixels — they're
    // background / outlines and rarely the brand color.
    if (l > 0.95 || l < 0.05) continue;
    if (s < 0.18 && (l > 0.85 || l < 0.15)) continue;
    // Quantize to 32-step bins per channel so similar colors merge.
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { rgb: { r, g, b }, count: 1 });
    }
  }

  const sorted = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN * 3);

  // Re-rank: prefer colors that are saturated and not too dark/light.
  const scored = sorted
    .map(({ rgb, count }) => {
      const { s, l } = rgbToHsl(rgb);
      const distFromMid = Math.abs(l - 0.5);
      const score = count * (0.5 + s) * (1 - distFromMid * 0.6);
      return { hex: rgbToHex(rgb), score, s, l };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      primary: "#0092ff",
      accent: "#ff6b2c",
      background: "#ffffff",
      candidates: [],
      source: "client",
    };
  }

  const primary = scored[0].hex;
  // Accent: strongest color whose hue is meaningfully different from primary.
  const primaryHue = rgbToHsl(hexToRgb(primary)).h;
  const accent =
    scored.find((c) => {
      const h = rgbToHsl(hexToRgb(c.hex)).h;
      return Math.abs(((h - primaryHue + 540) % 360) - 180) > 60;
    })?.hex || scored[Math.min(1, scored.length - 1)].hex;

  return {
    primary,
    accent,
    background: "#ffffff",
    candidates: scored.slice(0, topN).map((c) => c.hex),
    source: "client",
  };
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function isValidHex(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}