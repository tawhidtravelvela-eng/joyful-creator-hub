import { useMemo } from "react";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { useTenantSkin } from "@/hooks/useTenantSkin";
import { renderBlock } from "@/lib/skins/blockRegistry";
import { Loader2 } from "lucide-react";
import type { DesignTokens } from "@/lib/skins/types";
import { BlockOverrideProvider } from "@/hooks/useBlockOverride";
import { useTenant } from "@/hooks/useTenant";
import TenantSeoHead from "@/components/site/TenantSeoHead";
import { useApplyTenantTheme } from "@/hooks/useApplyTenantTheme";
import { resolveBlockVariant } from "@/lib/skins/blockVariants";

function tokenStyle(tokens: DesignTokens): React.CSSProperties {
  const style: Record<string, string> = {};
  if (tokens.primary_color) style["--primary"] = tokens.primary_color;
  if (tokens.accent_color) style["--accent"] = tokens.accent_color;
  if (tokens.background_color) style["--background"] = tokens.background_color;
  if (tokens.border_radius) style["--radius"] = tokens.border_radius;
  if (tokens.font_heading) style["--font-heading"] = tokens.font_heading;
  if (tokens.font_body) style["--font-body"] = tokens.font_body;
  return style as React.CSSProperties;
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

function hexToHslTriplet(hex: string): string {
  const raw = hex.replace(/^#/, "");
  const expanded = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let h = 0;
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
  const parts = hex.replace(/^#/, "").match(/.{1,2}/g);
  if (!parts) return 0;
  const [r, g, b] = parts.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function buildRootThemeVars(tokens: DesignTokens): Record<string, string> {
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

/** Extract Google Font family names from a CSS font stack string. */
function extractGoogleFonts(...stacks: (string | null | undefined)[]): string[] {
  const known = new Set([
    "Sora",
    "Inter",
    "Playfair Display",
    "Fraunces",
    "Plus Jakarta Sans",
    "Source Serif 4",
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
 * Renders a tenant's homepage from its block composition.
 *
 * - Reads skin + composition + design tokens via `useTenantSkin`.
 * - Wraps blocks in the standard Layout (header + footer).
 * - Falls back to a loading state until resolution completes.
 */
export default function TenantSiteRenderer({
  pageSlug = "home",
}: {
  pageSlug?: string;
}) {
  const { data, loading, error } = useTenantSkin(pageSlug);
  const { tenant } = useTenant();
  // Apply tenant tokens + Google Fonts via the shared hook (also used by
  // SkinAwareLayout so functional pages inherit the same theme).
  useApplyTenantTheme();

  const style = useMemo(
    () => (data ? tokenStyle(data.design_tokens) : undefined),
    [data],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          Unable to load this site right now.
        </div>
      </Layout>
    );
  }

  // Hide the homepage Partner CTA when the tenant has switched it off
  // (Studio → Skin tab toggle). The dedicated /partners page remains the
  // canonical entry point for hybrid-skin agencies.
  const showPartnerCtaOnHome = tenant?.show_partner_cta_on_home !== false;
  const visibleBlocks = data.composition.blocks.filter((b) => {
    if (b.enabled === false) return false;
    if (
      pageSlug === "home" &&
      !showPartnerCtaOnHome &&
      (b.block_key === "cta.agent-signup" ||
        b.block_key === "cta.agent-signup-rich" ||
        b.block_key === "feature.agent-benefits" ||
        b.block_key === "hero.hybrid-split")
    ) {
      return false;
    }
    // Module gating — hide vertical-specific blocks when the tenant has
    // toggled that module off (or their plan doesn't allow it).
    const mods = data.enabled_modules || {};
    const k = b.block_key;
    if ((k.includes("flight") || k === "trending.flights") && mods.flights === false) return false;
    if ((k.includes("hotel") || k === "destination.hotel-cities") && mods.hotels === false) return false;
    if ((k.includes("tour") || k.startsWith("landing.tours")) && mods.tours === false) return false;
    if (k.includes("transfer") && mods.transfers === false) return false;
    if (k.startsWith("landing.blog") && mods.blog === false) return false;
    return true;
  });

  // If the composition contains its own footer block, suppress the global
  // Layout footer so the skin footer can replace it cleanly.
  const hasSkinFooter = visibleBlocks.some((b) =>
    b.block_key.startsWith("footer."),
  );

  return (
    <div style={style} className="tenant-skin-root">
      <TenantSeoHead
        pageTitle={data.composition.page_title}
        pageDescription={data.composition.meta_description}
        pageSlug={pageSlug}
      />
      <Layout hideFooter={hasSkinFooter}>
        {visibleBlocks.map((block, idx) => (
          <BlockOverrideProvider
            key={`${block.block_key}-${block.instance_id || idx}`}
            blockKey={block.block_key}
            content={block.content}
            enabledModules={data.enabled_modules}
            designTokens={data.design_tokens}
            variant={resolveBlockVariant(
              block.block_key,
              data.variant_whitelist,
              data.section_variant_overrides?.[block.block_key],
            )}
          >
            {renderBlock(block.block_key, block.content)}
          </BlockOverrideProvider>
        ))}
      </Layout>
    </div>
  );
}