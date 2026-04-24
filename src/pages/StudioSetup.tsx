/**
 * StudioSetup — first-run wizard for new tenants.
 *
 * 5 steps:
 *   1. Basics       — site name, tagline, audience, enabled modules
 *   2. Brand        — logo, favicon, colors (reuses BrandTab logic in-line)
 *   3. Skin         — pick visual style (with AI suggestion based on step 1)
 *   4. AI generate  — one click to fill home page copy via ai-rebuild-site
 *   5. Review       — live preview + Publish & finish
 *
 * Persists progress to tenants.settings.studio_wizard so a refresh
 * resumes where the user left off. After publish, redirects to /studio.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plane,
  Hotel,
  MapPin,
  Car,
  FileText,
  Sparkles,
  Upload,
  CheckCircle2,
  Wand2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import StepShell from "@/components/studio/setup/StepShell";
import { SKIN_LIST } from "@/lib/skins/registry";
import { getSkinPreset } from "@/lib/skins/designPresets";
import type { SkinKey } from "@/lib/skins/types";
import {
  extractPaletteFromUrl,
  isValidHex,
} from "@/lib/brand/extractPalette";
import { colorTokenToHex, normalizeHslToken } from "@/lib/skins/designPresets";

const TOTAL_STEPS = 5;

type Audience = "b2c" | "b2b" | "hybrid";

type ModuleKey = "flights" | "hotels" | "tours" | "transfers" | "visa";

const MODULE_OPTIONS: Array<{
  key: ModuleKey;
  label: string;
  icon: typeof Plane;
  blurb: string;
}> = [
  { key: "flights", label: "Flights", icon: Plane, blurb: "Air ticket search & booking" },
  { key: "hotels", label: "Hotels", icon: Hotel, blurb: "Property search & booking" },
  { key: "tours", label: "Tours", icon: MapPin, blurb: "Activities & day tours" },
  { key: "transfers", label: "Transfers", icon: Car, blurb: "Airport & city transfers" },
  { key: "visa", label: "Visa", icon: FileText, blurb: "Visa application services" },
];

type WizardState = {
  site_name: string;
  tagline: string;
  audience: Audience;
  modules: Record<ModuleKey, boolean>;
  logo_url: string;
  favicon_url: string;
  primary: string;
  accent: string;
  background: string;
  skin_key: SkinKey;
};

const DEFAULT_STATE: WizardState = {
  site_name: "",
  tagline: "",
  audience: "b2c",
  modules: { flights: true, hotels: true, tours: true, transfers: false, visa: false },
  logo_url: "",
  favicon_url: "",
  primary: "#0092ff",
  accent: "#ff6b2c",
  background: "#ffffff",
  skin_key: "b2c-general",
};

/** Suggest a skin from declared audience + active modules. */
function suggestSkin(s: WizardState): SkinKey {
  if (s.audience === "b2b") return "b2b-corporate";
  if (s.audience === "hybrid") return "hybrid-full";
  const enabled = (Object.keys(s.modules) as ModuleKey[]).filter((k) => s.modules[k]);
  const verticals = enabled.filter((k) => k === "flights" || k === "hotels" || k === "tours");
  if (verticals.length === 1) {
    if (verticals[0] === "flights") return "b2c-flight";
    if (verticals[0] === "hotels") return "b2c-hotel";
    if (verticals[0] === "tours") return "b2c-tour";
  }
  return "b2c-general";
}

async function uploadAsset(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `tenant-branding/${folder}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  return data.publicUrl;
}

const StudioSetup = () => {
  const { user, loading: authLoading, isAdmin, adminTenantId } = useAuth();
  const { tenant: hostTenant, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();

  const [fallbackTenant, setFallbackTenant] = useState<{
    id: string;
    name: string;
    settings: Record<string, any>;
  } | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  useEffect(() => {
    if (hostTenant || !adminTenantId) return;
    setFallbackLoading(true);
    supabase
      .from("tenants")
      .select("id, name, settings")
      .eq("id", adminTenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFallbackTenant({
            id: data.id,
            name: data.name,
            settings: (data.settings as Record<string, any>) || {},
          });
        }
        setFallbackLoading(false);
      });
  }, [hostTenant, adminTenantId]);

  const tenant = hostTenant || fallbackTenant;

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generationDone, setGenerationDone] = useState(false);

  // Hydrate from tenants.settings (use existing brand info if any)
  useEffect(() => {
    if (!tenant?.id || hydrated) return;
    const settings = (tenant.settings || {}) as Record<string, any>;
    const brand = (settings.brand || {}) as Record<string, any>;
    setState((s) => ({
      ...s,
      site_name: brand.site_name || tenant.name || "",
      tagline: brand.tagline || "",
      logo_url: brand.logo_url || "",
      favicon_url: brand.favicon_url || "",
    }));
    // Pull existing skin/colors if a row exists
    supabase
      .from("tenant_skin_config")
      .select("skin_key, primary_color, accent_color, background_color, enabled_modules")
      .eq("tenant_id", tenant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const mods = (data.enabled_modules as Record<string, boolean>) || {};
        setState((s) => ({
          ...s,
          skin_key: (data.skin_key as SkinKey) || s.skin_key,
          primary: colorTokenToHex(data.primary_color) || s.primary,
          accent: colorTokenToHex(data.accent_color) || s.accent,
          background: colorTokenToHex(data.background_color) || s.background,
          modules: {
            flights: mods.flights ?? s.modules.flights,
            hotels: mods.hotels ?? s.modules.hotels,
            tours: mods.tours ?? s.modules.tours,
            transfers: mods.transfers ?? s.modules.transfers,
            visa: mods.visa ?? s.modules.visa,
          },
        }));
      })
      .then(() => setHydrated(true));
  }, [tenant, hydrated]);

  // Loading & auth gates
  if (authLoading || tenantLoading || fallbackLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-20 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </div>
      </Layout>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!tenant) return <Navigate to="/studio" replace />;

  const canEdit = isAdmin && (!adminTenantId || adminTenantId === tenant.id);
  if (!canEdit) return <Navigate to="/studio" replace />;

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const toggleModule = (key: ModuleKey) => {
    setState((s) => ({ ...s, modules: { ...s.modules, [key]: !s.modules[key] } }));
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Logo must be under 4MB");
      return;
    }
    setUploading("logo");
    try {
      const url = await uploadAsset(file, "logos");
      update("logo_url", url);
      // Auto-extract palette
      setExtracting(true);
      try {
        const palette = await extractPaletteFromUrl(url);
        setState((s) => ({
          ...s,
          primary: palette.primary,
          accent: palette.accent,
          background: palette.background,
        }));
        toast.success("Colors picked from your logo");
      } catch {
        // ignore — user can pick manually
      } finally {
        setExtracting(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const handleFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Favicon must be under 1MB");
      return;
    }
    setUploading("favicon");
    try {
      const url = await uploadAsset(file, "favicons");
      update("favicon_url", url);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  /** Persist brand + skin/colors/modules to DB. Used between every step
   *  so the user never loses progress on refresh. */
  const persist = async () => {
    if (!tenant?.id) return;
    // tenants.settings.brand merge
    const { data: tRow } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenant.id)
      .maybeSingle();
    const currentSettings = (tRow?.settings as Record<string, any>) || {};
    const nextSettings = {
      ...currentSettings,
      brand: {
        ...(currentSettings.brand || {}),
        logo_url: state.logo_url || null,
        favicon_url: state.favicon_url || null,
        site_name: state.site_name.trim() || null,
        tagline: state.tagline.trim() || null,
        updated_at: new Date().toISOString(),
      },
      studio_wizard: { step, completed: false, updated_at: new Date().toISOString() },
    };
    await supabase.from("tenants").update({ settings: nextSettings }).eq("id", tenant.id);

    // tenant_skin_config upsert
    await supabase
      .from("tenant_skin_config")
      .upsert(
        {
          tenant_id: tenant.id,
          skin_key: state.skin_key,
          primary_color: normalizeHslToken(state.primary),
          accent_color: normalizeHslToken(state.accent),
          background_color: normalizeHslToken(state.background),
          enabled_modules: state.modules as any,
        } as any,
        { onConflict: "tenant_id" },
      );
  };

  const goNext = async () => {
    try {
      await persist();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  /**
   * Seed unpublished About / Contact / module landing pages with sensible
   * starter blocks so the tenant has a real multi-page site after the wizard
   * completes. Home is handled separately by `ai-rebuild-site`.
   *
   * Uses upsert with `onConflict` so re-running the wizard never duplicates
   * pages — existing edits are preserved (we only insert when missing).
   */
  const seedStandardPages = async () => {
    if (!tenant?.id) return;
    const brand = state.site_name || tenant.name || "Our travel brand";
    const tagline = state.tagline?.trim();

    type SeedPage = {
      page_slug: string;
      page_title: string;
      meta_description: string;
      block_instances: Array<{ block_key: string; enabled: boolean; content: Record<string, string> }>;
    };

    const pages: SeedPage[] = [];

    // Standard pages
    pages.push({
      page_slug: "about",
      page_title: `About ${brand}`,
      meta_description: tagline || `Learn more about ${brand} and how we plan unforgettable journeys.`,
      block_instances: [
        {
          block_key: "hero.corporate-marketing",
          enabled: true,
          content: {
            headline: `About ${brand}`,
            subheadline: tagline || "Travel built around the people who take it.",
            cta_label: "Talk to our team",
          },
        },
        {
          block_key: "feature.why-choose-us",
          enabled: true,
          content: {
            heading: "Why travellers choose us",
            subtitle: "Curated trips, transparent pricing, real human support.",
          },
        },
      ],
    });

    pages.push({
      page_slug: "contact",
      page_title: `Contact ${brand}`,
      meta_description: `Reach the ${brand} team for bookings, support and partnerships.`,
      block_instances: [
        {
          block_key: "hero.corporate-marketing",
          enabled: true,
          content: {
            headline: "Get in touch",
            subheadline: "Our travel specialists usually reply within an hour.",
            cta_label: "Send a message",
          },
        },
        {
          block_key: "newsletter.signup",
          enabled: true,
          content: {
            heading: "Stay in the loop",
            subtitle: "Be first to hear about new routes, deals and stays.",
          },
        },
      ],
    });

    // Per-module landing pages (only for enabled modules)
    const moduleSeeds: Record<string, { title: string; meta: string; heroBlock: string; heroHeadline: string; heroSub: string; secondaryBlock?: string }> = {
      flights: {
        title: `Flights · ${brand}`,
        meta: `Search and book flights with ${brand}.`,
        heroBlock: "hero.search-flight",
        heroHeadline: "Find your next flight",
        heroSub: "Compare fares across hundreds of airlines in one search.",
        secondaryBlock: "trending.flights",
      },
      hotels: {
        title: `Hotels · ${brand}`,
        meta: `Discover hand-picked stays with ${brand}.`,
        heroBlock: "hero.search-hotel",
        heroHeadline: "Stays you'll love",
        heroSub: "From boutique hideaways to city favourites.",
        secondaryBlock: "destination.hotel-cities",
      },
      tours: {
        title: `Tours & experiences · ${brand}`,
        meta: `Bookable tours and activities curated by ${brand}.`,
        heroBlock: "hero.search-tour",
        heroHeadline: "Experiences worth the trip",
        heroSub: "Skip-the-line tickets, day tours and unique activities.",
        secondaryBlock: "destination.popular",
      },
      transfers: {
        title: `Transfers · ${brand}`,
        meta: `Reliable airport and city transfers with ${brand}.`,
        heroBlock: "hero.search-mixed",
        heroHeadline: "Door-to-door transfers",
        heroSub: "Pre-book your ride and travel stress-free.",
      },
    };

    for (const [key, cfg] of Object.entries(moduleSeeds)) {
      if (!state.modules[key as ModuleKey]) continue;
      pages.push({
        page_slug: key,
        page_title: cfg.title,
        meta_description: cfg.meta,
        block_instances: [
          {
            block_key: cfg.heroBlock,
            enabled: true,
            content: { headline: cfg.heroHeadline, subheadline: cfg.heroSub },
          },
          ...(cfg.secondaryBlock
            ? [{ block_key: cfg.secondaryBlock, enabled: true, content: {} }]
            : []),
          { block_key: "cta.agent-signup", enabled: true, content: {} },
        ],
      });
    }

    // Only insert pages that don't exist yet — never overwrite tenant edits.
    const { data: existing } = await supabase
      .from("tenant_page_composition")
      .select("page_slug")
      .eq("tenant_id", tenant.id);
    const existingSlugs = new Set(
      (existing || []).map((r: any) => r.page_slug as string),
    );

    const toInsert = pages
      .filter((p) => !existingSlugs.has(p.page_slug))
      .map((p) => ({
        tenant_id: tenant.id,
        page_slug: p.page_slug,
        page_title: p.page_title,
        meta_description: p.meta_description,
        block_instances: p.block_instances as any,
        is_published: false,
        last_edited_by: user?.id || null,
      }));

    if (toInsert.length === 0) return;
    await supabase.from("tenant_page_composition").insert(toInsert as any);
  };

  const runAIGenerate = async () => {
    if (!tenant?.id) return;
    setGenerating(true);
    try {
      const [{ data, error }] = await Promise.all([
        supabase.functions.invoke("ai-rebuild-site", {
          body: {
            tenant_id: tenant.id,
            user_id: user.id,
            brand_name: state.site_name || tenant.name,
            tagline: state.tagline,
            audience: state.audience === "b2b" ? "corporate" : state.audience,
            tone: "warm, confident, modern",
            products: state.modules,
            primary_color: state.primary,
            accent_color: state.accent,
          },
        }),
        seedStandardPages(),
      ]);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      setGenerationDone(true);
      const moduleCount = Object.values(state.modules).filter(Boolean).length;
      toast.success("Your site copy is ready", {
        description: `Home + About + Contact${moduleCount ? ` + ${moduleCount} module page${moduleCount === 1 ? "" : "s"}` : ""} created.`,
      });
    } catch (e: any) {
      toast.error(e?.message || "AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const finish = async () => {
    if (!tenant?.id) return;
    setPublishing(true);
    try {
      // Mark wizard complete
      const { data: tRow } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenant.id)
        .maybeSingle();
      const currentSettings = (tRow?.settings as Record<string, any>) || {};
      await supabase
        .from("tenants")
        .update({
          settings: {
            ...currentSettings,
            studio_wizard: {
              ...(currentSettings.studio_wizard || {}),
              completed: true,
              completed_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", tenant.id);

      // Ensure home page is published
      await supabase
        .from("tenant_page_composition")
        .update({ is_published: true })
        .eq("tenant_id", tenant.id)
        .eq("page_slug", "home");

      toast.success("Your site is live", {
        description: "You can keep tweaking it any time in Studio.",
      });
      navigate("/studio", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const stepEl = (() => {
    switch (step) {
      case 1:
        return (
          <StepShell
            step={1}
            total={TOTAL_STEPS}
            title="Tell us about your business"
            subtitle="We'll use this to suggest the right look and copy."
            onNext={async () => {
              if (!state.site_name.trim()) {
                toast.error("Please enter your site name");
                return;
              }
              const enabledCount = Object.values(state.modules).filter(Boolean).length;
              if (enabledCount === 0) {
                toast.error("Pick at least one travel product to sell");
                return;
              }
              // Refresh AI-suggested skin based on step 1 answers
              update("skin_key", suggestSkin(state));
              await goNext();
            }}
            hideBack
            nextLabel="Continue"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="site_name">Site name *</Label>
                  <Input
                    id="site_name"
                    value={state.site_name}
                    onChange={(e) => update("site_name", e.target.value)}
                    placeholder="South Point Travel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={state.tagline}
                    onChange={(e) => update("tagline", e.target.value)}
                    placeholder="Connecting you to the world"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Who do you sell to?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "b2c", label: "Travelers (B2C)", desc: "Public consumer site" },
                    { key: "b2b", label: "Businesses (B2B)", desc: "Corporate/agent portal" },
                    { key: "hybrid", label: "Both", desc: "Consumer + agent on one domain" },
                  ] as const).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => update("audience", o.key)}
                      className={`text-left rounded-lg border p-3 transition ${
                        state.audience === o.key
                          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="font-medium text-sm">{o.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">What do you sell?</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {MODULE_OPTIONS.map((m) => {
                    const Icon = m.icon;
                    const on = state.modules[m.key];
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggleModule(m.key)}
                        className={`text-left rounded-lg border p-3 transition flex items-start gap-3 ${
                          on
                            ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 mt-0.5 ${on ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-1.5">
                            {m.label}
                            {on ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {m.blurb}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </StepShell>
        );

      case 2:
        return (
          <StepShell
            step={2}
            total={TOTAL_STEPS}
            title="Upload your brand"
            subtitle="Drop in a logo and we'll auto-pick your colors."
            onBack={goBack}
            onNext={goNext}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo */}
              <div>
                <Label className="mb-2 block">Logo</Label>
                <div className="rounded-lg border border-dashed border-border p-4 flex items-center gap-4">
                  {state.logo_url ? (
                    <img
                      src={state.logo_url}
                      alt="Logo"
                      className="w-20 h-20 object-contain rounded bg-muted/30 p-1"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded bg-muted/40 flex items-center justify-center text-muted-foreground text-xs">
                      No logo
                    </div>
                  )}
                  <label className="inline-flex">
                    <Button asChild variant="outline" size="sm" disabled={uploading === "logo"}>
                      <span>
                        {uploading === "logo" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        {state.logo_url ? "Replace" : "Upload"}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogo}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  PNG / SVG / WEBP up to 4MB
                </p>
              </div>

              {/* Favicon */}
              <div>
                <Label className="mb-2 block">Favicon</Label>
                <div className="rounded-lg border border-dashed border-border p-4 flex items-center gap-4">
                  {state.favicon_url ? (
                    <img
                      src={state.favicon_url}
                      alt="Favicon"
                      className="w-12 h-12 object-contain rounded bg-muted/30 p-1"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted/40 flex items-center justify-center text-muted-foreground text-[10px]">
                      —
                    </div>
                  )}
                  <label className="inline-flex">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      disabled={uploading === "favicon"}
                    >
                      <span>
                        {uploading === "favicon" ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        {state.favicon_url ? "Replace" : "Upload"}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFavicon}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Square 512×512 ideal
                </p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <Label>Brand colors</Label>
                {extracting ? (
                  <span className="text-xs text-muted-foreground inline-flex items-center">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Picking colors…
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: "primary" as const, label: "Primary" },
                  { key: "accent" as const, label: "Accent" },
                  { key: "background" as const, label: "Background" },
                ].map((c) => (
                  <div key={c.key} className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground mb-1.5">{c.label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={state[c.key]}
                        onChange={(e) => update(c.key, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={state[c.key]}
                        onChange={(e) => update(c.key, e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StepShell>
        );

      case 3: {
        const recommended = suggestSkin(state);
        return (
          <StepShell
            step={3}
            total={TOTAL_STEPS}
            title="Pick your skin"
            subtitle="We've highlighted the best fit — switch any time later."
            onBack={goBack}
            onNext={goNext}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SKIN_LIST.map((s) => {
                const active = s.skin_key === state.skin_key;
                const isRec = s.skin_key === recommended;
                const preset = getSkinPreset(s.skin_key);
                return (
                  <button
                    key={s.skin_key}
                    type="button"
                    onClick={() => update("skin_key", s.skin_key)}
                    className={`relative text-left rounded-lg border p-4 transition overflow-hidden ${
                      active
                        ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {isRec ? (
                      <Badge className="absolute top-2 right-2 text-[10px] gap-1">
                        <Sparkles className="w-3 h-3" />
                        Recommended
                      </Badge>
                    ) : null}
                    <div className="font-semibold text-sm">{s.display_name}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.description}
                    </p>
                    <div
                      className="mt-3 rounded-md border border-border/50 p-2.5 flex items-center gap-2"
                      style={{ background: `hsl(${preset.background_color})` }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ background: `hsl(${preset.primary_color})` }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ background: `hsl(${preset.accent_color})` }}
                      />
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                        {preset.density}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </StepShell>
        );
      }

      case 4:
        return (
          <StepShell
            step={4}
            total={TOTAL_STEPS}
            title="Generate your site copy"
            subtitle="Our AI will write your headline, features, and CTAs in your voice."
            onBack={goBack}
            onNext={generationDone ? goNext : runAIGenerate}
            nextLabel={generationDone ? "Continue" : "Generate with AI"}
            loading={generating}
          >
            <div className="text-center py-6">
              {generationDone ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                  <div className="font-semibold text-lg">Copy generated</div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Your homepage now has fresh, on-brand copy. Continue to
                    review the preview.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-primary" />
                  </div>
                  <div className="font-semibold text-lg">Ready to generate</div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    We'll write a fresh hero, features, and call-to-action copy
                    using your brand name, tagline, and selected products.
                    This costs <strong>50 AI credits</strong>.
                  </p>
                  <div className="text-xs text-muted-foreground pt-2">
                    Don't want AI copy? You can skip and edit text manually
                    later in Studio.
                  </div>
                  <Button variant="ghost" size="sm" onClick={goNext}>
                    Skip — I'll write copy myself
                  </Button>
                </div>
              )}
            </div>
          </StepShell>
        );

      case 5:
        return (
          <StepShell
            step={5}
            total={TOTAL_STEPS}
            title="Review & publish"
            subtitle="Here's how your site looks. Publish when you're ready."
            onBack={goBack}
            onNext={finish}
            nextLabel="Publish & open Studio"
            loading={publishing}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="w-3.5 h-3.5" />
                Live preview of your home page
              </div>
              <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
                <iframe
                  src={`/?studio_preview=1&tenant=${tenant.id}`}
                  className="w-full"
                  style={{ height: "520px", border: "none" }}
                  title="Site preview"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                After publishing you'll land in Studio where you can fine-tune
                every block, add pages, and re-run AI any time.
              </p>
            </div>
          </StepShell>
        );

      default:
        return null;
    }
  })();

  return <Layout hideFooter>{stepEl}</Layout>;
};

export default StudioSetup;