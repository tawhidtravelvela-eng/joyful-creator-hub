import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Monitor,
  Smartphone,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Wand2,
  History,
  Camera,
  Sparkles,
  Coins,
  Rocket,
  FileText,
  Plus,
  AlertTriangle,
  Lock,
  LockOpen,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useTenantSkin } from "@/hooks/useTenantSkin";
import { SKIN_LIST, getSkin } from "@/lib/skins/registry";
import { getSkinPreset } from "@/lib/skins/designPresets";
import { KNOWN_BLOCK_KEYS } from "@/lib/skins/blockRegistry";
import { autoComposeHomepage } from "@/lib/skins/autoCompose";
import type {
  BlockInstance,
  DesignTokens,
  SkinKey,
} from "@/lib/skins/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BrandTab from "@/components/studio/BrandTab";
import { invalidateThemeCache } from "@/hooks/useThemeColors";
import { useSiteBranding } from "@/hooks/useSiteBranding";

type SnapshotRow = {
  id: string;
  label: string;
  created_at: string;
  trigger_source: string;
  skin_key: string | null;
};

type CreditsRow = {
  monthly_allowance: number;
  used_this_period: number;
  top_up_balance: number;
};

type LedgerRow = {
  id: string;
  created_at: string;
  operation: string;
  amount_charged: number;
  charged_from: string;
  prompt_summary: string | null;
  metadata: Record<string, any> | null;
};

type PageRow = {
  page_slug: string;
  page_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  updated_at: string;
};

const HOME_SLUG = "home";

/** Slugify a free-text page name into a URL-safe slug. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const Studio = () => {
  const { user, loading: authLoading, isAdmin, adminTenantId } = useAuth();
  const { tenant: hostTenant, loading: tenantLoading } = useTenant();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const skipWizardRedirect = searchParams.get("skip_setup") === "1";
  const [activePageSlug, setActivePageSlug] = useState<string>(HOME_SLUG);
  // Brand identity (logo / favicon / site name / tagline) lives on the tenant
  // record under settings.brand. We hydrate it once per tenant so the Brand
  // tab can render immediately without re-fetching on every open.
  const [brandInfo, setBrandInfo] = useState<{
    logo_url: string | null;
    favicon_url: string | null;
    site_name: string | null;
    tagline: string | null;
  }>({ logo_url: null, favicon_url: null, site_name: null, tagline: null });
  const [brandRefreshKey, setBrandRefreshKey] = useState(0);
  // The Studio can be opened either from a tenant's connected custom domain
  // (in which case useTenant() resolves it from the hostname) OR from the
  // platform dashboard, where we fall back to the admin's assigned tenant.
  const [fallbackTenant, setFallbackTenant] = useState<{
    id: string;
    domain: string;
    name: string;
    is_active: boolean;
    settings: Record<string, any>;
  } | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const tenant = hostTenant || fallbackTenant;
  const skinState = useTenantSkin(activePageSlug, tenant?.id || null);

  useEffect(() => {
    if (hostTenant || !adminTenantId) return;
    setFallbackLoading(true);
    supabase
      .from("tenants")
      .select("id, domain, name, is_active, settings")
      .eq("id", adminTenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFallbackTenant({
            id: data.id,
            domain: data.domain,
            name: data.name,
            is_active: data.is_active,
            settings: (data.settings as Record<string, any>) || {},
          });
        }
        setFallbackLoading(false);
      });
  }, [hostTenant, adminTenantId]);

  const previewSrc = useMemo(() => {
    const params = new URLSearchParams({ studio_preview: "1" });
    if (tenant?.id) params.set("tenant", tenant.id);
    const query = params.toString();
    return activePageSlug === HOME_SLUG
      ? `/?${query}`
      : `/p/${activePageSlug}?${query}`;
  }, [tenant?.id, activePageSlug]);

  const [skinKey, setSkinKey] = useState<SkinKey>("b2c-general");
  const [tokens, setTokens] = useState<DesignTokens>({});
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [lockedBlockKeys, setLockedBlockKeys] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotsRefreshKey, setSnapshotsRefreshKey] = useState(0);

  // AI Compose state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiComposing, setAiComposing] = useState(false);
  const [credits, setCredits] = useState<CreditsRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [creditsRefreshKey, setCreditsRefreshKey] = useState(0);

  // AI Rewrite state — track which slot/page is currently being rewritten
  // so we can disable the right button and show a spinner.
  const [rewritingKey, setRewritingKey] = useState<string | null>(null);

  // Top-up dialog state.
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(10);
  const [topUpCustom, setTopUpCustom] = useState<string>("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  // Rebuild-site dialog state. The rebuild flow re-picks the skin and the
  // entire block stack from updated brand inputs, snapshots first, and
  // charges 50 credits. Hard-capped at 1 rebuild per 24h server-side.
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildBrandName, setRebuildBrandName] = useState("");
  const [rebuildTagline, setRebuildTagline] = useState("");
  const [rebuildAudience, setRebuildAudience] = useState("general");
  const [rebuildRegion, setRebuildRegion] = useState("");
  const [rebuildTone, setRebuildTone] = useState("warm, confident, modern");
  const [rebuildPrimaryColor, setRebuildPrimaryColor] = useState("");
  const [rebuildAccentColor, setRebuildAccentColor] = useState("");

  // Plan capability flag — controls whether the "Rebuild site with AI"
  // button is offered. Resolved from the tenant's current plan; defaults
  // to true so we don't accidentally hide the action while the row loads.
  const [allowFullRebuild, setAllowFullRebuild] = useState<boolean>(true);
  const [planDisplayName, setPlanDisplayName] = useState<string>("");

  // Pre-run cost-confirmation dialog for the bulk AI rewrites. Each
  // action goes through this so the tenant sees the credit cost +
  // current balance before committing — required by the plan's
  // "every AI action shows estimated cost before running" guardrail.
  const [confirmAction, setConfirmAction] = useState<
    null | { kind: "page" | "site"; cost: number; label: string; description: string }
  >(null);

  // Multi-page management. The Studio can edit any tenant_page_composition
  // row; "home" is the implicit landing page and always exists. Other pages
  // are tenant-defined (about, contact, custom slugs) and rendered via
  // /p/<slug> on the live site.
  const [pages, setPages] = useState<PageRow[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesRefreshKey, setPagesRefreshKey] = useState(0);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [creatingPage, setCreatingPage] = useState(false);
  const [pageTitleDraft, setPageTitleDraft] = useState("");
  const [pageMetaDraft, setPageMetaDraft] = useState("");
  const [pageIsPublished, setPageIsPublished] = useState(true);

  // Hybrid-skin partner-page settings (saved to the tenants row).
  const [partnerSlug, setPartnerSlug] = useState<string>("partners");
  const [showPartnerCtaOnHome, setShowPartnerCtaOnHome] = useState<boolean>(true);

  // Hydrate local state once skin resolves
  useEffect(() => {
    if (!skinState.data) return;
    setSkinKey(skinState.data.skin_key);
    setTokens(skinState.data.design_tokens);
    setBlocks(
      skinState.data.composition.blocks.map((b) => ({
        ...b,
        instance_id: b.instance_id || cryptoId(),
      })),
    );
    setPageTitleDraft(skinState.data.composition.page_title || "");
    setPageMetaDraft(skinState.data.composition.meta_description || "");
    setPageIsPublished(skinState.data.composition.is_published !== false);
  }, [skinState.data]);

  useEffect(() => {
    setPreviewLoading(true);
  }, [activePageSlug, previewKey]);

  // Hydrate the locked-block list for the active page. Kept in a
  // separate effect so the AI rewrite guardrail stays in sync when the
  // user switches between pages without a full page reload.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    supabase
      .from("tenant_page_composition")
      .select("locked_block_keys")
      .eq("tenant_id", tenant.id)
      .eq("page_slug", activePageSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data as any)?.locked_block_keys;
        setLockedBlockKeys(Array.isArray(list) ? list : []);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, activePageSlug, saving]);

  // Resolve plan capability for the active tenant. Done in its own
  // effect so it survives page switches and re-runs only when the
  // tenant changes.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    (async () => {
      const { data: t } = await supabase
        .from("tenants")
        .select("plan_key")
        .eq("id", tenant.id)
        .maybeSingle();
      const planKey = (t as any)?.plan_key;
      if (!planKey) {
        if (!cancelled) {
          setAllowFullRebuild(true);
          setPlanDisplayName("");
        }
        return;
      }
      const { data: plan } = await supabase
        .from("b2b_plans")
        .select("allow_full_rebuild, display_name")
        .eq("plan_key", planKey)
        .maybeSingle();
      if (cancelled) return;
      setAllowFullRebuild((plan as any)?.allow_full_rebuild !== false);
      setPlanDisplayName((plan as any)?.display_name || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  // Load the tenant's full page list so we can show a switcher and let the
  // user create / delete / rename pages.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    setPagesLoading(true);
    supabase
      .from("tenant_page_composition")
      .select("page_slug, page_title, meta_description, is_published, updated_at")
      .eq("tenant_id", tenant.id)
      .order("page_slug", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data || []) as PageRow[];
        // Always make "home" appear first even if it has no row yet.
        const hasHome = rows.some((r) => r.page_slug === HOME_SLUG);
        const merged = hasHome
          ? rows
          : ([
              {
                page_slug: HOME_SLUG,
                page_title: "Home",
                meta_description: null,
                is_published: true,
                updated_at: new Date().toISOString(),
              },
              ...rows,
            ] as PageRow[]);
        merged.sort((a, b) => {
          if (a.page_slug === HOME_SLUG) return -1;
          if (b.page_slug === HOME_SLUG) return 1;
          return a.page_slug.localeCompare(b.page_slug);
        });
        setPages(merged);
        setPagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, pagesRefreshKey]);

  // Load brand identity (logo, favicon, site name, tagline) from
  // tenants.settings.brand. Re-runs when the user saves from the Brand tab.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const settings = (data?.settings as Record<string, any>) || {};
        const brand = settings.brand || {};
        const wizard = settings.studio_wizard || {};
        setBrandInfo({
          logo_url: brand.logo_url ?? null,
          favicon_url: brand.favicon_url ?? null,
          site_name: brand.site_name ?? null,
          tagline: brand.tagline ?? null,
        });
        // First-run redirect: if the tenant has no logo AND hasn't
        // completed the setup wizard, send them to /studio/setup so
        // they get a guided onboarding instead of a blank editor.
        // The ?skip_setup=1 query param lets users escape the redirect
        // (used by the "Skip setup" link inside the wizard).
        if (
          !skipWizardRedirect &&
          !brand.logo_url &&
          wizard.completed !== true &&
          brandRefreshKey === 0
        ) {
          navigate("/studio/setup", { replace: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, brandRefreshKey, navigate, skipWizardRedirect]);

  // Hydrate hybrid-skin partner-page settings from the tenants row.
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    supabase
      .from("tenants")
      .select("b2b_landing_slug, show_partner_cta_on_home")
      .eq("id", tenant.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPartnerSlug((data as any).b2b_landing_slug || "partners");
        setShowPartnerCtaOnHome((data as any).show_partner_cta_on_home !== false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  // Load snapshot list
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    supabase
      .from("tenant_site_snapshots")
      .select("id, label, created_at, trigger_source, skin_key")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled && data) setSnapshots(data as SnapshotRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, saving, snapshotsRefreshKey]);

  // Load AI credits + recent ledger (compose history)
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    Promise.all([
      supabase
        .from("tenant_ai_credits")
        .select("monthly_allowance, used_this_period, top_up_balance")
        .eq("tenant_id", tenant.id)
        .maybeSingle(),
      supabase
        .from("tenant_ai_credit_ledger")
        .select("id, created_at, operation, amount_charged, charged_from, prompt_summary, metadata")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]).then(([cRes, lRes]) => {
      if (cancelled) return;
      if (cRes.data) setCredits(cRes.data as CreditsRow);
      if (lRes.data) setLedger(lRes.data as LedgerRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, creditsRefreshKey]);

  const skinDef = useMemo(() => getSkin(skinKey), [skinKey]);

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

  if (!tenant) {
    return (
      <Layout>
        <div className="container mx-auto py-16 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Studio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The Studio is the tenant site editor. Open it from a tenant's
                connected custom domain to manage that tenant's homepage.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Access control:
  // - Super admins (isAdmin && !adminTenantId) can edit any tenant they visit.
  // - Tenant admins can edit only their own tenant.
  // - Everyone else is blocked.
  const canEdit =
    isAdmin && (!adminTenantId || adminTenantId === tenant.id);

  if (!canEdit) {
    return (
      <Layout>
        <div className="container mx-auto py-16 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Studio access required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              You need tenant admin permissions to edit this site.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const toggleBlock = (idx: number) => {
    setBlocks((curr) =>
      curr.map((b, i) =>
        i === idx ? { ...b, enabled: b.enabled === false ? true : false } : b,
      ),
    );
  };

  const toggleBlockLock = (idx: number) => {
    const key = blocks[idx]?.block_key;
    if (!key) return;
    setLockedBlockKeys((curr) =>
      curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key],
    );
  };

  const removeBlock = (idx: number) => {
    setBlocks((curr) => curr.filter((_, i) => i !== idx));
  };

  const addBlock = (key: string) => {
    setBlocks((curr) => [
      ...curr,
      { block_key: key, enabled: true, instance_id: cryptoId() },
    ]);
  };

  const resetToSkinDefaults = () => {
    setBlocks(
      skinDef.default_blocks.map((b) => ({
        ...b,
        instance_id: b.instance_id || cryptoId(),
      })),
    );
    toast.message(`Reset to ${skinDef.display_name} defaults`);
  };

  /**
   * Switch to a different skin and immediately persist + refresh the preview.
   *
   * Without this the user clicks a skin card, sees no change in the live
   * preview iframe (which reads from the DB), and has to manually press
   * "Reset blocks to defaults" + "Save". This handler does all three in one
   * atomic step so the preview reflects the selected skin instantly.
   */
  const handleSelectSkin = async (nextKey: SkinKey) => {
    if (nextKey === skinKey) return;
    if (!tenant?.id) {
      setSkinKey(nextKey);
      return;
    }
    const nextDef = getSkin(nextKey);
    const nextPreset = getSkinPreset(nextKey);
    const nextBlocks: BlockInstance[] = nextDef.default_blocks.map((b) => ({
      ...b,
      instance_id: cryptoId(),
    }));
    const nextTokens: DesignTokens = {
      primary_color: nextPreset.primary_color,
      accent_color: nextPreset.accent_color,
      background_color: nextPreset.background_color,
      font_heading: nextPreset.font_heading,
      font_body: nextPreset.font_body,
      border_radius: nextPreset.border_radius,
      density: nextPreset.density,
    };

    // Optimistic local update so the editor reflects the new skin instantly.
    setSkinKey(nextKey);
    setTokens(nextTokens);
    setBlocks(nextBlocks);

    setSaving(true);
    try {
      // Snapshot prior state so the user can revert from the History tab.
      await supabase.from("tenant_site_snapshots").insert({
        tenant_id: tenant.id,
        label: `Pre-skin-switch · ${new Date().toLocaleString()}`,
        trigger_source: "before_skin_change",
        skin_key: skinState.data?.skin_key || null,
        design_tokens: skinState.data?.design_tokens as any,
        page_composition: {
          home: skinState.data?.composition.blocks || [],
        } as any,
        enabled_modules: skinState.data?.enabled_modules as any,
      });

      const { error: skinErr } = await supabase
        .from("tenant_skin_config")
        .upsert(
          {
            tenant_id: tenant.id,
            skin_key: nextKey,
            // Persist the preset's tokens so the live preview & tenant site
            // pick up the new colors immediately. Previously these were set
            // to null, which forced users to re-save the Brand tab before
            // the skin's colors actually took effect.
            primary_color: nextPreset.primary_color,
            accent_color: nextPreset.accent_color,
            background_color: nextPreset.background_color,
            font_heading: nextPreset.font_heading,
            font_body: nextPreset.font_body,
            border_radius: nextPreset.border_radius,
            density: nextPreset.density,
          },
          { onConflict: "tenant_id" },
        );
      if (skinErr) throw skinErr;
      invalidateThemeCache();

      const { error: pageErr } = await supabase
        .from("tenant_page_composition")
        .upsert(
          {
            tenant_id: tenant.id,
            page_slug: HOME_SLUG,
            page_title: pageTitleDraft || null,
            meta_description: pageMetaDraft || null,
            block_instances: nextBlocks as any,
            is_published: pageIsPublished,
            last_edited_by: user?.id,
            locked_block_keys: [] as any,
          },
          { onConflict: "tenant_id,page_slug" },
        );
      if (pageErr) throw pageErr;

      toast.success(`Switched to ${nextDef.display_name}`, {
        description: "Preview updated with the new skin defaults.",
      });
      setPreviewKey((k) => k + 1);
      setPagesRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error("[studio] skin switch failed", e);
      toast.error(e.message || "Could not switch skin");
    } finally {
      setSaving(false);
    }
  };

  const autoComposeFromTenant = () => {
    const result = autoComposeHomepage({
      enabledModules: skinState.data?.enabled_modules || {},
      audience: skinState.data?.definition.audience,
    });
    setSkinKey(result.skin_key);
    setBlocks(
      result.blocks.map((b) => ({ ...b, instance_id: cryptoId() })),
    );
    toast.success("Homepage composed", { description: result.rationale });
  };

  /**
   * Call the ai-compose-page edge function. The server picks a skin + block
   * stack from a free-text prompt, debits 1 AI credit, and writes a ledger
   * row that doubles as compose history. The UI then loads the result into
   * local editor state — the user still has to click "Save changes" to
   * publish it.
   */
  const runAICompose = async () => {
    if (!tenant?.id) return;
    if (!aiPrompt.trim()) {
      toast.message("Describe the site you want first");
      return;
    }
    setAiComposing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-compose-page", {
        body: {
          tenant_id: tenant.id,
          user_id: user?.id,
          prompt: aiPrompt.trim(),
          enabled_modules: skinState.data?.enabled_modules || {},
          audience: skinState.data?.definition.audience,
          brand_name: tenant.name,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.message || data?.error || "AI compose failed";
        if (data?.error === "Out of AI credits") {
          toast.error("Out of AI credits", { description: msg });
        } else {
          toast.error(msg);
        }
        return;
      }
      setSkinKey(data.skin_key as SkinKey);
      setBlocks(
        (data.blocks as BlockInstance[]).map((b) => ({
          ...b,
          enabled: true,
          instance_id: cryptoId(),
        })),
      );
      toast.success("AI composed your homepage", {
        description:
          data.rationale ||
          `Picked ${data.skin_key}.`,
      });
      setCreditsRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error("[studio] AI compose failed", e);
      toast.error(e.message || "AI compose failed");
    } finally {
      setAiComposing(false);
    }
  };

  const updateBlockContent = (idx: number, field: string, value: string) => {
    setBlocks((curr) =>
      curr.map((b, i) =>
        i === idx
          ? {
              ...b,
              content: { ...(b.content || {}), [field]: value },
            }
          : b,
      ),
    );
  };

  /**
   * Inline ✨ rewrite for a single field on a single block. Calls
   * ai-rewrite-slot, charges 1 credit, replaces the local value.
   */
  const rewriteSlot = async (
    idx: number,
    field: string,
    instruction?: string,
  ) => {
    if (!tenant?.id) return;
    const block = blocks[idx];
    if (!block) return;
    const key = `${block.instance_id || idx}:${field}`;
    setRewritingKey(key);
    try {
      const current = (block.content || {}) as Record<string, unknown>;
      const { data, error } = await supabase.functions.invoke("ai-rewrite-slot", {
        body: {
          tenant_id: tenant.id,
          user_id: user?.id,
          block_key: block.block_key,
          field,
          current_value: (current[field] as string) || "",
          instruction: instruction || "Make it punchier and more on-brand.",
          brand_name: tenant.name,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.message || data?.error || "Rewrite failed";
        if (data?.error === "Out of AI credits") toast.error("Out of AI credits", { description: msg });
        else toast.error(msg);
        return;
      }
      updateBlockContent(idx, field, String(data.value || ""));
      toast.success("Rewrote with AI", {
        description: "1 credit used",
      });
      setCreditsRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Rewrite failed");
    } finally {
      setRewritingKey(null);
    }
  };

  /**
   * Rewrite every editable field across every block on the current page in one
   * batched AI call. Charges 5 credits.
   */
  const rewritePage = async () => {
    if (!tenant?.id) return;
    if (blocks.length === 0) {
      toast.message("Add some blocks first");
      return;
    }
    setRewritingKey("__page__");
    try {
      const payload = blocks.map((b) => ({
        block_key: b.block_key,
        content: b.content || {},
      }));
      const { data, error } = await supabase.functions.invoke("ai-rewrite-page", {
        body: {
          tenant_id: tenant.id,
          user_id: user?.id,
          blocks: payload,
          instruction: "Refresh every block. Punchy, clear, on-brand. Keep voice consistent.",
          brand_name: tenant.name,
          locked_block_keys: lockedBlockKeys,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.message || data?.error || "Page rewrite failed";
        if (data?.error === "Out of AI credits") toast.error("Out of AI credits", { description: msg });
        else toast.error(msg);
        return;
      }
      const updated = data.blocks as { block_key: string; content: Record<string, any> }[];
      setBlocks((curr) =>
        curr.map((b, i) => {
          const next = updated[i];
          if (!next || next.block_key !== b.block_key) return b;
          return { ...b, content: next.content };
        }),
      );
      toast.success("Rewrote page copy", {
        description: "5 credits used",
      });
      setCreditsRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Page rewrite failed");
    } finally {
      setRewritingKey(null);
    }
  };

  /**
   * Rewrite copy across every page composition the tenant has saved. Auto-snapshots
   * server-side first. Charges 30 credits. Triggers a re-fetch so local state
   * picks up the new copy.
   */
  const rewriteSite = async () => {
    if (!tenant?.id) return;
    setRewritingKey("__site__");
    try {
      const { data, error } = await supabase.functions.invoke("ai-rewrite-site", {
        body: {
          tenant_id: tenant.id,
          user_id: user?.id,
          instruction: "Refresh all site copy. Punchy, modern, cohesive brand voice.",
          brand_name: tenant.name,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.message || data?.error || "Site rewrite failed";
        if (data?.error === "Out of AI credits") toast.error("Out of AI credits", { description: msg });
        else toast.error(msg);
        return;
      }
      toast.success("Rewrote whole site", {
        description: `${data.pages_rewritten} page(s) · 30 credits used`,
      });
      setCreditsRefreshKey((k) => k + 1);
      setSnapshotsRefreshKey((k) => k + 1);
      setPreviewKey((k) => k + 1);
      // Force skinState re-fetch by remounting via key bump on next save.
    } catch (e: any) {
      toast.error(e.message || "Site rewrite failed");
    } finally {
      setRewritingKey(null);
    }
  };

  /**
   * Buy more AI credits using the tenant wallet. Server FX-converts USD into
   * the wallet's currency, debits, and credits `top_up_balance` 1:1 in USD.
   */
  const runTopUp = async () => {
    if (!tenant?.id) return;
    const usd =
      topUpAmount === -1 ? Number(topUpCustom) : topUpAmount;
    if (!Number.isFinite(usd) || usd <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setTopUpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "tenant-ai-credit-topup",
        { body: { tenant_id: tenant.id, amount_usd: usd } },
      );
      // 402 / 4xx come back as `error` here; the response body still has the
      // structured payload, so surface its `message` to the user.
      if (error) {
        let title = "Top-up failed";
        let description: string | undefined;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            title = body?.error || title;
            description = body?.message;
          }
        } catch { /* ignore */ }
        toast.error(title, description ? { description } : undefined);
        return;
      }
      if (!data?.success) {
        toast.error(data?.error || "Top-up failed", {
          description: data?.message,
        });
        return;
      }
      toast.success(`Added $${usd.toFixed(2)} of AI credit`, {
        description: `Charged ${data.charge_amount} ${data.charge_currency} from your wallet.`,
      });
      setTopUpOpen(false);
      setTopUpCustom("");
      setCreditsRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Top-up failed");
    } finally {
      setTopUpLoading(false);
    }
  };

  /**
   * Full site rebuild: re-pick skin + block stack + fresh hero copy from
   * updated brand inputs. Server snapshots first (pre_rebuild), enforces a
   * 24h cooldown, and charges 50 credits.
   */
  const runRebuild = async () => {
    if (!tenant?.id) return;
    if (!rebuildBrandName.trim()) {
      toast.error("Brand name is required");
      return;
    }
    setRebuildLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "ai-rebuild-site",
        {
          body: {
            tenant_id: tenant.id,
            user_id: user?.id,
            brand_name: rebuildBrandName.trim(),
            tagline: rebuildTagline.trim() || undefined,
            audience: rebuildAudience,
            region: rebuildRegion.trim() || undefined,
            tone: rebuildTone.trim() || undefined,
            primary_color: rebuildPrimaryColor.trim() || undefined,
            accent_color: rebuildAccentColor.trim() || undefined,
            products: skinState.data?.enabled_modules || {},
          },
        },
      );
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.message || data?.error || "Rebuild failed";
        if (data?.error === "Out of AI credits") {
          toast.error("Out of AI credits", { description: msg });
        } else if (data?.error === "Rebuild cooldown") {
          toast.error("Rebuild cooldown active", { description: msg });
        } else {
          toast.error(msg);
        }
        return;
      }
      // Apply the new skin + blocks to local editor state immediately so the
      // preview updates without a reload.
      setSkinKey(data.skin_key as SkinKey);
      setBlocks(
        (data.blocks as BlockInstance[]).map((b) => ({
          ...b,
          enabled: true,
          instance_id: cryptoId(),
        })),
      );
      if (rebuildPrimaryColor.trim() || rebuildAccentColor.trim()) {
        setTokens((t) => ({
          ...t,
          ...(rebuildPrimaryColor.trim()
            ? { primary_color: rebuildPrimaryColor.trim() }
            : {}),
          ...(rebuildAccentColor.trim()
            ? { accent_color: rebuildAccentColor.trim() }
            : {}),
        }));
      }
      toast.success("Rebuilt your site with AI", {
        description:
          data.rationale ||
          `New skin: ${data.skin_key} · 50 credits used`,
      });
      setRebuildOpen(false);
      setCreditsRefreshKey((k) => k + 1);
      setSnapshotsRefreshKey((k) => k + 1);
      setPreviewKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Rebuild failed");
    } finally {
      setRebuildLoading(false);
    }
  };

  /**
   * Capture the *currently saved* state into a new snapshot row. Reads the
   * resolved skin/composition (not unsaved local edits) so the snapshot
   * matches what visitors actually see.
   */
  const saveManualSnapshot = async () => {
    if (!tenant?.id) return;
    setSnapshotting(true);
    try {
      const { error } = await supabase.from("tenant_site_snapshots").insert({
        tenant_id: tenant.id,
        label: `Manual save · ${new Date().toLocaleString()}`,
        trigger_source: "manual_button",
        skin_key: skinState.data?.skin_key || null,
        design_tokens: skinState.data?.design_tokens as any,
        page_composition: {
          home: skinState.data?.composition.blocks || [],
        } as any,
        enabled_modules: skinState.data?.enabled_modules as any,
        created_by: user?.id || null,
      });
      if (error) throw error;
      toast.success("Snapshot saved");
      setSnapshotsRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Snapshot failed");
    } finally {
      setSnapshotting(false);
    }
  };

  /**
   * One-click rollback: load a snapshot's skin/tokens/blocks into the editor
   * AND immediately persist them so the live site reflects the rollback.
   * A safety snapshot is taken first so the user can undo the restore.
   */
  const restoreSnapshot = async (snapId: string) => {
    if (!tenant?.id) return;
    setRestoringId(snapId);
    try {
      // 1. Load the full snapshot row.
      const { data: snap, error: loadErr } = await supabase
        .from("tenant_site_snapshots")
        .select(
          "id, label, skin_key, design_tokens, page_composition, enabled_modules",
        )
        .eq("id", snapId)
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (loadErr) throw loadErr;
      if (!snap) throw new Error("Snapshot not found");

      // 2. Take a safety snapshot of the current live state.
      await supabase.from("tenant_site_snapshots").insert({
        tenant_id: tenant.id,
        label: `Pre-restore (${snap.label}) · ${new Date().toLocaleString()}`,
        trigger_source: "pre_restore",
        skin_key: skinState.data?.skin_key || null,
        design_tokens: skinState.data?.design_tokens as any,
        page_composition: {
          home: skinState.data?.composition.blocks || [],
        } as any,
        enabled_modules: skinState.data?.enabled_modules as any,
        created_by: user?.id || null,
      });

      // 3. Apply snapshot to live config.
      const tokens = (snap.design_tokens as any) || {};
      const composition = (snap.page_composition as any) || {};
      const homeBlocks: BlockInstance[] = Array.isArray(composition.home)
        ? composition.home
        : [];
      const restoredKey = (snap.skin_key as SkinKey) || "b2c-general";

      const { error: skinErr } = await supabase
        .from("tenant_skin_config")
        .upsert(
          {
            tenant_id: tenant.id,
            skin_key: restoredKey,
            primary_color: tokens.primary_color ?? null,
            accent_color: tokens.accent_color ?? null,
            background_color: tokens.background_color ?? null,
            font_heading: tokens.font_heading ?? null,
            font_body: tokens.font_body ?? null,
            border_radius: tokens.border_radius ?? null,
            density: tokens.density ?? null,
            enabled_modules: snap.enabled_modules as any,
          },
          { onConflict: "tenant_id" },
        );
      if (skinErr) throw skinErr;

      const { error: pageErr } = await supabase
        .from("tenant_page_composition")
        .upsert(
          {
            tenant_id: tenant.id,
            page_slug: activePageSlug,
            block_instances: homeBlocks as any,
            is_published: true,
            last_edited_by: user?.id || null,
          },
          { onConflict: "tenant_id,page_slug" },
        );
      if (pageErr) throw pageErr;

      // 4. Sync local editor state to the restored values.
      setSkinKey(restoredKey);
      setTokens({
        primary_color: tokens.primary_color ?? null,
        accent_color: tokens.accent_color ?? null,
        background_color: tokens.background_color ?? null,
        font_heading: tokens.font_heading ?? null,
        font_body: tokens.font_body ?? null,
        border_radius: tokens.border_radius ?? null,
        density: tokens.density ?? null,
      });
      setBlocks(
        homeBlocks.map((b) => ({
          ...b,
          instance_id: b.instance_id || cryptoId(),
        })),
      );

      toast.success("Snapshot restored", {
        description: "A safety snapshot of the previous state was saved first.",
      });
      setPreviewKey((k) => k + 1);
      setSnapshotsRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error("[studio] restore failed", e);
      toast.error(e.message || "Restore failed");
    } finally {
      setRestoringId(null);
    }
  };

  /**
   * Create a new tenant page composition row with a fresh, mostly-empty block
   * stack. Picked-up immediately by the page list and selected as active.
   */
  const createPage = async () => {
    if (!tenant?.id) return;
    const slug = slugify(newPageSlug || newPageTitle);
    const title = newPageTitle.trim() || slug;
    if (!slug) {
      toast.error("Page slug is required");
      return;
    }
    if (slug === HOME_SLUG) {
      toast.error("'home' is reserved");
      return;
    }
    if (pages.some((p) => p.page_slug === slug)) {
      toast.error("A page with this slug already exists");
      return;
    }
    setCreatingPage(true);
    try {
      const starterBlocks: BlockInstance[] = [
        { block_key: "hero.simple", enabled: true, instance_id: cryptoId(), content: { headline: title } },
      ];
      const { error } = await supabase.from("tenant_page_composition").insert({
        tenant_id: tenant.id,
        page_slug: slug,
        page_title: title,
        block_instances: starterBlocks as any,
        is_published: false,
        last_edited_by: user?.id || null,
      });
      if (error) throw error;
      toast.success("Page created", {
        description: `Available at /p/${slug} once published.`,
      });
      setNewPageOpen(false);
      setNewPageTitle("");
      setNewPageSlug("");
      setPagesRefreshKey((k) => k + 1);
      setActivePageSlug(slug);
    } catch (e: any) {
      toast.error(e.message || "Failed to create page");
    } finally {
      setCreatingPage(false);
    }
  };

  /**
   * Delete a page (cannot delete "home"). Switches the active page back to
   * home so the editor never points at a missing row.
   */
  const deletePage = async (slug: string) => {
    if (!tenant?.id) return;
    if (slug === HOME_SLUG) {
      toast.error("Home page can't be deleted");
      return;
    }
    if (!confirm(`Delete page "${slug}"? Visitors will see a 404 at /p/${slug}.`))
      return;
    try {
      const { error } = await supabase
        .from("tenant_page_composition")
        .delete()
        .eq("tenant_id", tenant.id)
        .eq("page_slug", slug);
      if (error) throw error;
      toast.success("Page deleted");
      if (activePageSlug === slug) setActivePageSlug(HOME_SLUG);
      setPagesRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    }
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      // 1. Snapshot current state
      await supabase.from("tenant_site_snapshots").insert({
        tenant_id: tenant.id,
        label: `Pre-save ${new Date().toLocaleString()}`,
        trigger_source: "manual",
        skin_key: skinState.data?.skin_key || null,
        design_tokens: skinState.data?.design_tokens as any,
        page_composition: {
          home: skinState.data?.composition.blocks || [],
        } as any,
        enabled_modules: skinState.data?.enabled_modules as any,
      });

      // 2. Upsert skin config
      const { error: skinErr } = await supabase
        .from("tenant_skin_config")
        .upsert(
          {
            tenant_id: tenant.id,
            skin_key: skinKey,
            primary_color: tokens.primary_color || null,
            accent_color: tokens.accent_color || null,
            background_color: tokens.background_color || null,
            font_heading: tokens.font_heading || null,
            font_body: tokens.font_body || null,
            border_radius: tokens.border_radius || null,
            density: tokens.density || null,
          },
          { onConflict: "tenant_id" },
        );
      if (skinErr) throw skinErr;
      invalidateThemeCache();

      // 3. Upsert page composition
      const { error: pageErr } = await supabase
        .from("tenant_page_composition")
        .upsert(
          {
            tenant_id: tenant.id,
            page_slug: activePageSlug,
            page_title: pageTitleDraft || null,
            meta_description: pageMetaDraft || null,
            block_instances: blocks as any,
            is_published: pageIsPublished,
            last_edited_by: user.id,
            locked_block_keys: lockedBlockKeys as any,
          },
          { onConflict: "tenant_id,page_slug" },
        );
      if (pageErr) throw pageErr;

      // 4. Persist hybrid-skin partner page settings on the tenants row.
      if (skinKey === "hybrid-full") {
        const slugClean = (partnerSlug || "partners")
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "partners";
        const { error: tErr } = await supabase
          .from("tenants")
          .update({
            b2b_landing_slug: slugClean,
            show_partner_cta_on_home: showPartnerCtaOnHome,
          } as any)
          .eq("id", tenant.id);
        if (tErr) throw tErr;
      }

      toast.success("Site updated");
      // Bump iframe key so the preview reloads with the new composition.
      setPreviewKey((k) => k + 1);
      setPagesRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error("[studio] save failed", e);
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Premium top bar — slim, glassy, sticky */}
      <div className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <a href="/dashboard">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Dashboard
              </a>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground">Studio</span>
              <span className="text-xs text-muted-foreground/70 hidden sm:inline truncate">
                · {branding.site_name || tenant?.name || "Tenant"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2 py-1 text-xs shadow-sm">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={activePageSlug}
                onChange={(e) => setActivePageSlug(e.target.value)}
                className="bg-transparent outline-none text-foreground font-medium pr-1 max-w-[180px]"
                disabled={pagesLoading}
              >
                {pages.map((p) => (
                  <option key={p.page_slug} value={p.page_slug}>
                    {p.page_title || p.page_slug}
                    {p.page_slug === HOME_SLUG ? " (home)" : ` · /p/${p.page_slug}`}
                    {p.is_published === false ? " · draft" : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/studio/setup")}
              title="Re-run the guided setup: brand, skin, AI copy"
              className="h-8"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden md:inline">Generate with AI</span>
              <span className="md:hidden">AI</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-8 shadow-sm"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </div>
        </div>
      </div>

      {/* Workspace: left editor rail + full-bleed live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-0 min-h-[calc(100vh-3.5rem)]">
        <aside className="border-r border-border/40 bg-card/40 backdrop-blur-sm overflow-y-auto max-h-[calc(100vh-3.5rem)] p-4 md:p-5">
          <Tabs defaultValue="skin">
          <TabsList>
            <TabsTrigger value="ai">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              AI
            </TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="skin">Skin</TabsTrigger>
            <TabsTrigger value="pages">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Pages
            </TabsTrigger>
            <TabsTrigger value="blocks">Blocks</TabsTrigger>
            <TabsTrigger value="tokens">Design tokens</TabsTrigger>
            <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-6 space-y-4">
            {credits && (() => {
              const allowance = credits.monthly_allowance || 0;
              const used = credits.used_this_period || 0;
              const poolLeft = Math.max(0, allowance - used);
              const topUp = credits.top_up_balance || 0;
              const totalLeft = poolLeft + topUp;
              const pct = allowance > 0 ? used / allowance : 0;
              if (totalLeft <= 0) {
                return (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-foreground">
                        You're out of AI credits
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Top up to keep using AI rewrites and rebuilds, or
                        upgrade your plan for a bigger monthly allowance.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setTopUpOpen(true)}>
                      Top up
                    </Button>
                  </div>
                );
              }
              if (pct >= 0.8 && topUp === 0) {
                return (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-foreground">
                        Running low — {poolLeft} of {allowance} credits left this period
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Top up now or upgrade your plan to avoid interruptions.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setTopUpOpen(true)}>
                      Top up
                    </Button>
                  </div>
                );
              }
              return null;
            })()}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      AI Compose
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Describe the site and AI picks the skin + blocks for you.
                      Costs 1 credit per generation.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs rounded-md border border-border px-2.5 py-1.5 bg-muted/30">
                    <Coins className="w-3.5 h-3.5 text-primary" />
                    {credits ? (
                      <span>
                        <span className="font-semibold text-foreground">
                          {Math.max(
                            0,
                            (credits.monthly_allowance || 0) -
                              (credits.used_this_period || 0),
                          )}
                        </span>
                        <span className="text-muted-foreground"> pool · </span>
                        <span className="font-semibold text-foreground">
                          {credits.top_up_balance || 0}
                        </span>
                        <span className="text-muted-foreground"> top-up</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">credits…</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setTopUpOpen(true)}
                  >
                    <Coins className="w-3.5 h-3.5 mr-1.5" />
                    Top up
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. A premium honeymoon-focused travel site for Maldives & Bali — soft cream palette, hotel-led, with featured destinations and a newsletter sign-up."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={runAICompose}
                    disabled={aiComposing || !aiPrompt.trim()}
                  >
                    {aiComposing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Compose with AI
                  </Button>
                  <Button
                    variant="outline"
                    onClick={autoComposeFromTenant}
                    disabled={aiComposing}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Quick compose (free)
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  After composing, click <strong>Save changes</strong> to publish.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-4 h-4 text-primary" />
                  Recent AI activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ledger.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No AI generations yet.
                  </p>
                ) : (
                  ledger.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-md border border-border p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground capitalize">
                          {l.operation.replace(/_/g, " ")}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          −{l.amount_charged} · {l.charged_from}
                        </Badge>
                      </div>
                      {l.prompt_summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {l.prompt_summary}
                        </p>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(l.created_at).toLocaleString()}
                        {l.metadata?.skin_key
                          ? ` · ${l.metadata.skin_key}`
                          : ""}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brand" className="mt-6">
            {tenant ? (
              <BrandTab
                tenantId={tenant.id}
                tenantName={tenant.name}
                currentSkinKey={skinKey}
                initial={{
                  logo_url: brandInfo.logo_url,
                  favicon_url: brandInfo.favicon_url,
                  site_name: brandInfo.site_name,
                  tagline: brandInfo.tagline,
                  primary_color: skinState.data?.design_tokens.primary_color || null,
                  accent_color: skinState.data?.design_tokens.accent_color || null,
                  background_color:
                    skinState.data?.design_tokens.background_color || null,
                }}
                onSaved={() => {
                  setBrandRefreshKey((k) => k + 1);
                  setPreviewKey((k) => k + 1);
                }}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="skin" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SKIN_LIST.map((s) => {

                const active = s.skin_key === skinKey;
                const preset = getSkinPreset(s.skin_key);
                return (
                  <button
                    key={s.skin_key}
                    type="button"
                    onClick={() => handleSelectSkin(s.skin_key)}
                    disabled={saving}
                    className={`text-left rounded-lg border p-4 transition overflow-hidden ${
                      active
                        ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                        : "border-border hover:border-primary/50"
                    } ${saving ? "opacity-60 cursor-wait" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">
                        {s.display_name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {s.audience}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.description}
                    </p>
                    {/* Live preset preview — colors, type pair, mood */}
                    <div
                      className="mt-3 rounded-md border border-border/50 p-3"
                      style={{
                        background: `hsl(${preset.background_color})`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-5 h-5 rounded-full border border-black/10"
                          style={{ background: `hsl(${preset.primary_color})` }}
                          title="Primary"
                        />
                        <span
                          className="w-5 h-5 rounded-full border border-black/10"
                          style={{ background: `hsl(${preset.accent_color})` }}
                          title="Accent"
                        />
                        <span
                          className="w-5 h-5 rounded-full border border-black/10"
                          style={{ background: `hsl(${preset.background_color})` }}
                          title="Background"
                        />
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                          {preset.density} · {preset.hero_treatment}
                        </span>
                      </div>
                      <div
                        className="text-base font-semibold leading-tight"
                        style={{
                          fontFamily: preset.font_heading,
                          color: `hsl(${preset.primary_color})`,
                        }}
                      >
                        Travel beautifully.
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{
                          fontFamily: preset.font_body,
                          color: `hsl(${preset.background_color.split(" ")[0]} ${preset.background_color.split(" ")[1]} ${parseFloat(preset.background_color.split(" ")[2]) > 50 ? "20%" : "75%"})`,
                        }}
                      >
                        {preset.mood}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={autoComposeFromTenant}>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate homepage
              </Button>
              <Button variant="outline" onClick={resetToSkinDefaults}>
                Reset blocks to {skinDef.display_name} defaults
              </Button>
              <Button
                variant="secondary"
                disabled={!allowFullRebuild}
                title={
                  !allowFullRebuild
                    ? `Full site rebuild isn't included in the ${planDisplayName || "current"} plan. Upgrade to unlock.`
                    : undefined
                }
                onClick={() => {
                  setRebuildBrandName(tenant?.name || "");
                  setRebuildPrimaryColor(
                    skinState.data?.design_tokens.primary_color || "",
                  );
                  setRebuildAccentColor(
                    skinState.data?.design_tokens.accent_color || "",
                  );
                  setRebuildOpen(true);
                }}
              >
                <Rocket className="w-4 h-4 mr-2" />
                Rebuild site with AI
                <Badge variant="outline" className="ml-2 text-[10px]">
                  50 credits
                </Badge>
              </Button>
            </div>
            {skinKey === "hybrid-full" && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base">Partner page</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Hybrid skin includes a dedicated B2B landing page with a sign-in + apply form.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="partner_slug">URL slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {tenant?.domain || "yourdomain.com"}/
                      </span>
                      <Input
                        id="partner_slug"
                        value={partnerSlug}
                        onChange={(e) => setPartnerSlug(e.target.value)}
                        placeholder="partners"
                        maxLength={40}
                        className="max-w-[200px]"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Lowercase letters, numbers, and hyphens. Default: <code>partners</code>. (Subdomain support coming soon.)
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPartnerCtaOnHome}
                      onChange={(e) => setShowPartnerCtaOnHome(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm">
                      <span className="font-medium text-foreground">Show partner CTA on homepage</span>
                      <span className="block text-xs text-muted-foreground">
                        When off, the homepage stays consumer-only and B2B traffic goes through the partner page.
                      </span>
                    </span>
                  </label>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pages" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Pages
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    The home page is your domain root. Other pages live at
                    <span className="font-mono"> /p/&lt;slug&gt;</span>.
                  </p>
                </div>
                <Button size="sm" onClick={() => setNewPageOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  New page
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {pagesLoading ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    Loading pages…
                  </div>
                ) : (
                  pages.map((p) => {
                    const isActive = p.page_slug === activePageSlug;
                    return (
                      <div
                        key={p.page_slug}
                        className={`flex items-center justify-between gap-2 rounded-md border p-3 text-sm transition ${
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActivePageSlug(p.page_slug)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="font-medium text-foreground flex items-center gap-2">
                            {p.page_title || p.page_slug}
                            {p.page_slug === HOME_SLUG && (
                              <Badge variant="outline" className="text-[10px]">
                                home
                              </Badge>
                            )}
                            {p.is_published === false && (
                              <Badge variant="outline" className="text-[10px]">
                                draft
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {p.page_slug === HOME_SLUG ? "/" : `/p/${p.page_slug}`}
                          </div>
                        </button>
                        <div className="flex items-center gap-1">
                          {p.page_slug !== HOME_SLUG && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deletePage(p.page_slug)}
                              title="Delete page"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active page settings</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Edits apply to <span className="font-mono">{activePageSlug}</span>.
                  Save to publish.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Page title</Label>
                  <Input
                    value={pageTitleDraft}
                    onChange={(e) => setPageTitleDraft(e.target.value)}
                    placeholder="e.g. About us"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Meta description</Label>
                  <Textarea
                    rows={2}
                    value={pageMetaDraft}
                    onChange={(e) => setPageMetaDraft(e.target.value)}
                    placeholder="Short description shown in search results."
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={pageIsPublished}
                    onChange={(e) => setPageIsPublished(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span>Published (visible to visitors)</span>
                </label>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocks" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Block stack</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {blocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No blocks. Add one from the picker below.
                  </p>
                ) : (
                  <SortableBlockList
                    blocks={blocks}
                    onReorder={setBlocks}
                    onToggle={toggleBlock}
                    onRemove={removeBlock}
                    onContentChange={updateBlockContent}
                    onAIRewrite={rewriteSlot}
                    rewritingKey={rewritingKey}
                    lockedBlockKeys={lockedBlockKeys}
                    onToggleLock={toggleBlockLock}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI rewrite
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Refresh copy across multiple blocks at once.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (blocks.length === 0) {
                      toast.message("Add some blocks first");
                      return;
                    }
                    setConfirmAction({
                      kind: "page",
                      cost: 5,
                      label: "Rewrite this page",
                      description: `Refreshes copy across all ${blocks.length} block${blocks.length === 1 ? "" : "s"} on this page. Locked blocks are skipped.`,
                    });
                  }}
                  disabled={rewritingKey !== null || blocks.length === 0}
                >
                  {rewritingKey === "__page__" ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Rewrite this page
                  <Badge variant="outline" className="ml-2 text-[10px]">5 credits</Badge>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setConfirmAction({
                      kind: "site",
                      cost: 30,
                      label: "Rewrite whole site",
                      description:
                        "Refreshes copy on every page of your site. Auto-snapshots first so you can roll back. Locked blocks are skipped.",
                    })
                  }
                  disabled={rewritingKey !== null}
                >
                  {rewritingKey === "__site__" ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Rewrite whole site
                  <Badge variant="outline" className="ml-2 text-[10px]">30 credits</Badge>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add a block</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {KNOWN_BLOCK_KEYS.map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant="outline"
                    onClick={() => addBlock(k)}
                  >
                    + {k}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tokens" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Design tokens</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TokenField
                  label="Primary color (HSL e.g. 220 90% 56%)"
                  value={tokens.primary_color || ""}
                  onChange={(v) =>
                    setTokens((t) => ({ ...t, primary_color: v }))
                  }
                />
                <TokenField
                  label="Accent color (HSL)"
                  value={tokens.accent_color || ""}
                  onChange={(v) =>
                    setTokens((t) => ({ ...t, accent_color: v }))
                  }
                />
                <TokenField
                  label="Background color (HSL)"
                  value={tokens.background_color || ""}
                  onChange={(v) =>
                    setTokens((t) => ({ ...t, background_color: v }))
                  }
                />
                <TokenField
                  label="Border radius (e.g. 0.5rem)"
                  value={tokens.border_radius || ""}
                  onChange={(v) =>
                    setTokens((t) => ({ ...t, border_radius: v }))
                  }
                />
                <TokenField
                  label="Heading font"
                  value={tokens.font_heading || ""}
                  onChange={(v) =>
                    setTokens((t) => ({ ...t, font_heading: v }))
                  }
                />
                <TokenField
                  label="Body font"
                  value={tokens.font_body || ""}
                  onChange={(v) => setTokens((t) => ({ ...t, font_body: v }))}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="snapshots" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    Recent snapshots
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Restore a previous version with one click. The current
                    state is auto-saved before restoring.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveManualSnapshot}
                  disabled={snapshotting}
                >
                  {snapshotting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 mr-2" />
                  )}
                  Save snapshot now
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {snapshots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No snapshots yet. Saving any change creates one
                    automatically.
                  </p>
                ) : (
                  snapshots.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          {s.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString()} ·{" "}
                          {s.trigger_source}
                          {s.skin_key ? ` · ${s.skin_key}` : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreSnapshot(s.id)}
                        disabled={restoringId === s.id}
                      >
                        {restoringId === s.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Restore
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
        </aside>

        {/* Live preview — full-bleed canvas */}
        <section className="relative bg-gradient-to-b from-muted/40 via-muted/20 to-muted/40 flex flex-col min-h-[calc(100vh-3.5rem)]">
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-12 border-b border-border/40 bg-background/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-semibold text-foreground">Live preview</span>
              <span className="hidden sm:inline text-muted-foreground/60">
                · {previewMode === "mobile" ? "390 × auto" : "Desktop"}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 p-0.5 shadow-sm">
              <Button
                size="sm"
                variant={previewMode === "desktop" ? "default" : "ghost"}
                onClick={() => setPreviewMode("desktop")}
                title="Desktop"
                className="h-7 px-2"
              >
                <Monitor className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant={previewMode === "mobile" ? "default" : "ghost"}
                onClick={() => setPreviewMode("mobile")}
                title="Mobile"
                className="h-7 px-2"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewKey((k) => k + 1)}
                title="Refresh preview"
                className="h-7 px-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex items-stretch justify-center p-4 md:p-6 overflow-auto">
            <div
              className={`relative overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_30px_80px_-20px_hsl(var(--foreground)/0.18),0_8px_24px_-12px_hsl(var(--foreground)/0.12)] transition-all duration-300 ${
                previewMode === "mobile"
                  ? "w-[390px] max-h-[860px] flex-shrink-0"
                  : "w-full max-w-[1600px]"
              }`}
            >
              {/* Faux browser chrome dots */}
              <div className="absolute top-0 left-0 right-0 h-7 bg-gradient-to-b from-muted/80 to-muted/40 border-b border-border/50 flex items-center px-3 gap-1.5 z-20">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-[10px] font-mono text-muted-foreground/60 truncate">
                  {previewSrc}
                </span>
              </div>
              {previewLoading && (
                <div className="absolute inset-0 top-7 z-10 flex flex-col items-center justify-center gap-4 bg-background/96 px-6 text-center">
                  <div className="flex items-center gap-3 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Loading preview
                  </div>
                  <div className="w-full max-w-md space-y-3">
                    <div className="h-10 rounded-md bg-muted/80" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="h-28 rounded-md bg-muted/70" />
                      <div className="h-28 rounded-md bg-muted/70" />
                    </div>
                    <div className="h-40 rounded-md bg-muted/60" />
                  </div>
                </div>
              )}
              <iframe
                key={previewKey}
                src={previewSrc}
                title="Tenant site preview"
                onLoad={() => setPreviewLoading(false)}
                className={`w-full bg-background block pt-7 ${
                  previewMode === "mobile" ? "h-[860px]" : "h-[calc(100vh-7rem)]"
                }`}
              />
            </div>
          </div>
        </section>
      </div>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmAction(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {confirmAction?.label}
            </DialogTitle>
            <DialogDescription>{confirmAction?.description}</DialogDescription>
          </DialogHeader>
          {confirmAction && (() => {
            const allowance = Number(credits?.monthly_allowance || 0);
            const used = Number(credits?.used_this_period || 0);
            const topUp = Number(credits?.top_up_balance || 0);
            const available = Math.max(0, allowance - used) + topUp;
            const insufficient = available < confirmAction.cost;
            return (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estimated cost</span>
                    <span className="font-semibold">{confirmAction.cost} credits</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Available balance</span>
                    <span className={insufficient ? "text-destructive font-semibold" : "font-medium"}>
                      {available} credits
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">After this action</span>
                    <span className="font-medium">
                      {Math.max(0, available - confirmAction.cost)} credits
                    </span>
                  </div>
                </div>
                {insufficient && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
                    Not enough credits. Top up or upgrade your plan to run this action.
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setConfirmAction(null)}>
                    Cancel
                  </Button>
                  {insufficient ? (
                    <Button
                      onClick={() => {
                        setConfirmAction(null);
                        setTopUpOpen(true);
                      }}
                    >
                      <Coins className="w-4 h-4 mr-2" />
                      Top up credits
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        const action = confirmAction;
                        setConfirmAction(null);
                        if (action.kind === "page") rewritePage();
                        else rewriteSite();
                      }}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Run for {confirmAction.cost} credits
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              Top up AI credits
            </DialogTitle>
            <DialogDescription>
              Buy more credits using your wallet. Credits never expire and stack on
              top of your monthly pool.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 25, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setTopUpAmount(v);
                    setTopUpCustom("");
                  }}
                  className={`rounded-md border px-3 py-3 text-center text-sm font-semibold transition ${
                    topUpAmount === v && !topUpCustom
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5 text-foreground"
                      : "border-border hover:border-primary/50 text-foreground"
                  }`}
                >
                  ${v}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTopUpAmount(-1)}
                className={`rounded-md border px-3 py-3 text-center text-sm font-semibold transition ${
                  topUpAmount === -1
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                Custom
              </button>
            </div>

            {topUpAmount === -1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Custom amount (USD)</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={topUpCustom}
                  onChange={(e) => setTopUpCustom(e.target.value)}
                  placeholder="e.g. 35"
                />
                <p className="text-[11px] text-muted-foreground">
                  Min $1 · Max $500.
                </p>
              </div>
            )}

            <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
              Charged from your wallet in your billing currency at today's FX rate.
              Credits are added in USD and never expire.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setTopUpOpen(false)}
              disabled={topUpLoading}
            >
              Cancel
            </Button>
            <Button onClick={runTopUp} disabled={topUpLoading}>
              {topUpLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Coins className="w-4 h-4 mr-2" />
              )}
              Add credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rebuildOpen} onOpenChange={setRebuildOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Rebuild site with AI
            </DialogTitle>
            <DialogDescription>
              We'll snapshot your current site, then re-pick the skin and
              regenerate the homepage from your brand inputs. Costs 50
              credits. Limited to one rebuild per 24 hours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Brand name *</Label>
              <Input
                value={rebuildBrandName}
                onChange={(e) => setRebuildBrandName(e.target.value)}
                placeholder="e.g. Azure Travel Co."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tagline</Label>
              <Input
                value={rebuildTagline}
                onChange={(e) => setRebuildTagline(e.target.value)}
                placeholder="e.g. Slow travel, beautifully planned"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Audience</Label>
                <select
                  value={rebuildAudience}
                  onChange={(e) => setRebuildAudience(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="general">General travelers</option>
                  <option value="luxury">Luxury</option>
                  <option value="families">Families</option>
                  <option value="couples">Couples / honeymoon</option>
                  <option value="solo">Solo / adventure</option>
                  <option value="business">Business / corporate</option>
                  <option value="budget">Budget</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Region focus</Label>
                <Input
                  value={rebuildRegion}
                  onChange={(e) => setRebuildRegion(e.target.value)}
                  placeholder="e.g. Southeast Asia"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tone of voice</Label>
              <Input
                value={rebuildTone}
                onChange={(e) => setRebuildTone(e.target.value)}
                placeholder="warm, confident, modern"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Primary color (HSL)</Label>
                <Input
                  value={rebuildPrimaryColor}
                  onChange={(e) => setRebuildPrimaryColor(e.target.value)}
                  placeholder="220 90% 50%"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Accent color (HSL)</Label>
                <Input
                  value={rebuildAccentColor}
                  onChange={(e) => setRebuildAccentColor(e.target.value)}
                  placeholder="40 95% 55%"
                />
              </div>
            </div>

            <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-foreground">
              <strong>Heads up:</strong> Your current homepage will be
              auto-snapshotted before any changes — you can restore it from the
              History tab any time.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setRebuildOpen(false)}
              disabled={rebuildLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={runRebuild}
              disabled={rebuildLoading || !rebuildBrandName.trim()}
            >
              {rebuildLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              Rebuild now (50 credits)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Create a new page
            </DialogTitle>
            <DialogDescription>
              Add a custom page like About or Contact. It'll be live at
              <span className="font-mono"> /p/&lt;slug&gt;</span> once you
              publish it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Page title</Label>
              <Input
                value={newPageTitle}
                onChange={(e) => {
                  setNewPageTitle(e.target.value);
                  if (!newPageSlug) setNewPageSlug(slugify(e.target.value));
                }}
                placeholder="e.g. About us"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={newPageSlug}
                onChange={(e) => setNewPageSlug(slugify(e.target.value))}
                placeholder="about-us"
              />
              <p className="text-[11px] text-muted-foreground">
                URL: <span className="font-mono">/p/{newPageSlug || "your-slug"}</span>
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setNewPageOpen(false)}
              disabled={creatingPage}
            >
              Cancel
            </Button>
            <Button
              onClick={createPage}
              disabled={creatingPage || !newPageTitle.trim()}
            >
              {creatingPage ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function TokenField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/** Common per-block content fields the Studio knows how to edit. */
const EDITABLE_FIELDS: Record<string, { key: string; label: string; multiline?: boolean }[]> = {
  default: [
    { key: "headline", label: "Headline" },
    { key: "subheadline", label: "Subheadline", multiline: true },
    { key: "cta_label", label: "CTA label" },
    { key: "cta_href", label: "CTA link" },
  ],
};

function getEditableFields(blockKey: string) {
  return EDITABLE_FIELDS[blockKey] || EDITABLE_FIELDS.default;
}

function SortableBlockList({
  blocks,
  onReorder,
  onToggle,
  onRemove,
  onContentChange,
  onAIRewrite,
  rewritingKey,
  lockedBlockKeys,
  onToggleLock,
}: {
  blocks: BlockInstance[];
  onReorder: (next: BlockInstance[]) => void;
  onToggle: (idx: number) => void;
  onRemove: (idx: number) => void;
  onContentChange: (idx: number, field: string, value: string) => void;
  onAIRewrite: (idx: number, field: string, instruction?: string) => Promise<void>;
  rewritingKey: string | null;
  lockedBlockKeys: string[];
  onToggleLock: (idx: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const ids = blocks.map(
    (b, i) => b.instance_id || `${b.block_key}-${i}`,
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(blocks, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {blocks.map((b, idx) => (
            <SortableBlockRow
              key={ids[idx]}
              id={ids[idx]}
              block={b}
              index={idx}
              onToggle={() => onToggle(idx)}
              onRemove={() => onRemove(idx)}
              onContentChange={(field, value) =>
                onContentChange(idx, field, value)
              }
              onAIRewrite={(field) => onAIRewrite(idx, field)}
              rewritingKey={rewritingKey}
              isLocked={lockedBlockKeys.includes(b.block_key)}
              onToggleLock={() => onToggleLock(idx)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableBlockRow({
  id,
  block,
  index,
  onToggle,
  onRemove,
  onContentChange,
  onAIRewrite,
  rewritingKey,
  isLocked,
  onToggleLock,
}: {
  id: string;
  block: BlockInstance;
  index: number;
  onToggle: () => void;
  onRemove: () => void;
  onContentChange: (field: string, value: string) => void;
  onAIRewrite: (field: string) => void;
  rewritingKey: string | null;
  isLocked: boolean;
  onToggleLock: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const [expanded, setExpanded] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  const fields = getEditableFields(block.block_key);
  const content = (block.content || {}) as Record<string, unknown>;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-border bg-card ${
        block.enabled === false ? "opacity-50" : ""
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="font-mono text-xs text-foreground">
            {block.block_key}
          </span>
          <span className="text-[10px] text-muted-foreground">#{index + 1}</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleLock}
            title={
              isLocked
                ? "Locked — AI page/site rewrites will skip this block"
                : "Lock to protect from AI page/site rewrites"
            }
          >
            {isLocked ? (
              <Lock className="w-4 h-4 text-primary" />
            ) : (
              <LockOpen className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
          <Button size="icon" variant="ghost" onClick={onToggle}>
            {block.enabled === false ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/30">
          {fields.map((f) => {
            const slotKey = `${block.instance_id || index}:${f.key}`;
            const isThisSlot = rewritingKey === slotKey;
            const anyRewrite = rewritingKey !== null;
            const fieldVal = (content[f.key] as string) || "";
            return (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">{f.label}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-primary hover:text-primary"
                    disabled={anyRewrite}
                    onClick={() => onAIRewrite(f.key)}
                    title="Rewrite with AI · 1 credit"
                  >
                    {isThisSlot ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    AI
                  </Button>
                </div>
                {f.multiline ? (
                  <Textarea
                    rows={2}
                    value={fieldVal}
                    onChange={(e) => onContentChange(f.key, e.target.value)}
                    disabled={isThisSlot}
                  />
                ) : (
                  <Input
                    value={fieldVal}
                    onChange={(e) => onContentChange(f.key, e.target.value)}
                    disabled={isThisSlot}
                  />
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground">
            Leave fields blank to use the block's default content. Inline AI rewrite costs 1 credit per field.
          </p>
        </div>
      )}
    </div>
  );
}

export default Studio;