import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Loader2,
  ExternalLink,
  Sparkles,
  Eye,
  Plane,
  Hotel,
  MapPin,
  Car,
  Newspaper,
  CheckCircle2,
  Wand2,
  XCircle,
  AlertCircle,
  FileText,
  Plus,
  History,
  Palette,
  Pencil,
  Rocket,
  Globe2,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getSkin } from "@/lib/skins/registry";
import DomainConnectCard from "@/components/dashboard/website/DomainConnectCard";
import CreditsCard from "@/components/dashboard/website/CreditsCard";
import AnalyticsCard from "@/components/dashboard/website/AnalyticsCard";
import PlanBillingCard from "@/components/dashboard/website/PlanBillingCard";
import { Lock } from "lucide-react";

type SkinRow = {
  skin_key: string | null;
  primary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  font_heading: string | null;
  font_body: string | null;
  updated_at?: string | null;
  enabled_modules?: Record<string, boolean> | null;
};
type PageRow = {
  page_slug: string;
  page_title: string | null;
  block_instances: any;
  is_published: boolean | null;
  published_at?: string | null;
  updated_at?: string | null;
};
type SnapRow = { id: string; created_at: string; label: string };
type CreditsRow = {
  monthly_allowance: number | null;
  used_this_period: number | null;
  top_up_balance: number | null;
  period_end: string | null;
};
type LedgerRow = {
  id: string;
  operation: string;
  amount_charged: number;
  prompt_summary: string | null;
  created_at: string;
};
type PlanRow = {
  display_name: string;
  allow_flights: boolean;
  allow_hotels: boolean;
  allow_tours: boolean;
  allow_transfers: boolean;
  allow_blog: boolean;
  allow_custom_domain: boolean;
  allow_remove_branding: boolean;
  max_pages: number;
};
type TenantRow = {
  id: string;
  name: string;
  domain: string | null;
  plan_key: string | null;
  plan_expires_at: string | null;
  settings: Record<string, any> | null;
};

interface Props {
  parentBrandName?: string;
}

export default function CustomWebsiteHub({ parentBrandName }: Props) {
  const { adminTenantId } = useAuth();
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [skin, setSkin] = useState<SkinRow | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [snapshots, setSnapshots] = useState<SnapRow[]>([]);
  const [credits, setCredits] = useState<CreditsRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!adminTenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [tRes, sRes, pRes, snRes, cRes, lRes] = await Promise.all([
        supabase
          .from("tenants")
          .select("id, name, domain, plan_key, plan_expires_at, settings")
          .eq("id", adminTenantId)
          .maybeSingle(),
        supabase
          .from("tenant_skin_config")
          .select(
            "skin_key, primary_color, accent_color, background_color, font_heading, font_body, updated_at, enabled_modules",
          )
          .eq("tenant_id", adminTenantId)
          .maybeSingle(),
        supabase
          .from("tenant_page_composition")
          .select("page_slug, page_title, block_instances, is_published, published_at, updated_at")
          .eq("tenant_id", adminTenantId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("tenant_site_snapshots")
          .select("id, created_at, label")
          .eq("tenant_id", adminTenantId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("tenant_ai_credits")
          .select("monthly_allowance, used_this_period, top_up_balance, period_end")
          .eq("tenant_id", adminTenantId)
          .maybeSingle(),
        supabase
          .from("tenant_ai_credit_ledger")
          .select("id, operation, amount_charged, prompt_summary, created_at")
          .eq("tenant_id", adminTenantId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      if (tRes.data) setTenant(tRes.data as any);
      setSkin((sRes.data as SkinRow) || null);
      setPages((pRes.data as PageRow[]) || []);
      setSnapshots((snRes.data as SnapRow[]) || []);
      setCredits((cRes.data as CreditsRow) || null);
      setLedger((lRes.data as LedgerRow[]) || []);

      const planKey = (tRes.data as any)?.plan_key;
      if (planKey) {
        const { data: planData } = await supabase
          .from("b2b_plans")
          .select(
            "display_name, allow_flights, allow_hotels, allow_tours, allow_transfers, allow_blog, allow_custom_domain, allow_remove_branding, max_pages",
          )
          .eq("plan_key", planKey)
          .maybeSingle();
        if (!cancelled) setPlan((planData as PlanRow) || null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminTenantId, refreshKey]);

  if (!adminTenantId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          You don't have a tenant site assigned yet. Contact {parentBrandName || "your administrator"} to enable your white-label site.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const refresh = () => setRefreshKey((k) => k + 1);

  // ── Plan gating: hard lock when no plan or expired > 7 days ─────────
  const expDateGate = tenant?.plan_expires_at ? new Date(tenant.plan_expires_at) : null;
  const daysSinceExpiry = expDateGate
    ? Math.floor((Date.now() - expDateGate.getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const hasNoPlan = !tenant?.plan_key || tenant.plan_key === "starter";
  const isHardLocked =
    hasNoPlan ||
    (daysSinceExpiry !== null && daysSinceExpiry > 7);
  const isInGrace =
    daysSinceExpiry !== null && daysSinceExpiry > 0 && daysSinceExpiry <= 7;

  if (isHardLocked) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/[0.06] via-card to-card p-8">
          <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-destructive/15 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col items-center text-center space-y-4 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <Lock className="w-7 h-7 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                {hasNoPlan ? "Choose a plan to unlock your white-label site" : "Plan expired"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasNoPlan
                  ? "The Custom Website Hub is available on paid plans. Pick a plan below to activate your branded site, custom domain, AI credits, and booking modules."
                  : `Your plan expired ${daysSinceExpiry} days ago and the 7-day grace period has ended. Renew to restore access to your site, AI credits, and analytics.`}
              </p>
            </div>
          </div>
        </div>
        <PlanBillingCard
          tenantId={adminTenantId}
          currentPlanKey={tenant?.plan_key || null}
          expiresAt={tenant?.plan_expires_at || null}
          onChange={refresh}
        />
      </div>
    );
  }

  const skinDef = getSkin(skin?.skin_key);
  const homePage = pages.find((p) => p.page_slug === "home") || null;
  const homeBlockCount = Array.isArray(homePage?.block_instances)
    ? (homePage!.block_instances as any[]).length
    : skinDef.default_blocks.length;

  // Custom-domain only model: legacy *.travelvela.com / *.lovable.app are
  // treated as "not connected" and ignored — see migration 20260422081611.
  const rawDomain = tenant?.domain || null;
  const isPlatformSub =
    !!rawDomain &&
    (/\.travelvela\.com$/i.test(rawDomain) || /\.lovable\.app$/i.test(rawDomain));
  const customDomain = rawDomain && !isPlatformSub ? rawDomain : null;
  const liveUrl = customDomain ? `https://${customDomain}` : null;
  const previewPath = `/?studio_preview=1&tenant=${tenant?.id || ""}`;

  const settings = (tenant?.settings || {}) as Record<string, any>;
  const brand = (settings.brand || {}) as Record<string, any>;
  const branding = {
    logo_url: brand.logo_url || settings.logo_url || null,
    favicon_url: brand.favicon_url || settings.favicon_url || null,
    site_name: brand.site_name || settings.site_name || tenant?.name || null,
    contact_email: brand.contact_email || settings.contact_email || null,
    contact_phone: brand.contact_phone || settings.contact_phone || null,
    footer_text: brand.footer_text || settings.footer_text || null,
    seo_title: brand.seo_title || settings.seo_title || null,
    seo_description: brand.seo_description || settings.seo_description || null,
    social_facebook: brand.social_facebook || settings.social_facebook || null,
    social_instagram: brand.social_instagram || settings.social_instagram || null,
  };

  const allowance = Number(credits?.monthly_allowance || 0);
  const used = Number(credits?.used_this_period || 0);
  const topup = Number(credits?.top_up_balance || 0);
  const periodEnd = credits?.period_end ? new Date(credits.period_end) : null;

  const hasUnpublished = pages.some((p) => {
    if (!p.is_published) return true;
    if (!p.published_at) return false;
    return p.updated_at && new Date(p.updated_at) > new Date(p.published_at);
  });
  const publishedCount = pages.filter((p) => p.is_published).length;

  const checklist = [
    { key: "domain", label: "Custom domain connected", done: !!customDomain },
    { key: "logo", label: "Logo uploaded", done: !!branding.logo_url },
    { key: "site_name", label: "Site name set", done: !!branding.site_name },
    { key: "contact", label: "Contact info filled", done: !!(branding.contact_email || branding.contact_phone) },
    { key: "seo", label: "SEO title & description", done: !!(branding.seo_title && branding.seo_description) },
    { key: "favicon", label: "Favicon set", done: !!branding.favicon_url },
    { key: "social", label: "Social links added", done: !!(branding.social_facebook || branding.social_instagram) },
    { key: "footer", label: "Footer text set", done: !!branding.footer_text },
    { key: "published", label: "Homepage published", done: !!homePage?.is_published },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistPct = Math.round((checklistDone / checklist.length) * 100);

  // Merge ledger + page edits + snapshots into a single activity stream
  const activity = [
    ...ledger.map((l) => ({
      id: `c_${l.id}`,
      kind: "credit" as const,
      label: l.operation.replace(/_/g, " "),
      detail: l.prompt_summary,
      amount: Number(l.amount_charged),
      at: l.created_at,
    })),
    ...snapshots.map((s) => ({
      id: `s_${s.id}`,
      kind: "snapshot" as const,
      label: s.label || "Snapshot saved",
      detail: null as string | null,
      amount: 0,
      at: s.created_at,
    })),
    ...pages
      .filter((p) => p.updated_at)
      .slice(0, 5)
      .map((p) => ({
        id: `p_${p.page_slug}`,
        kind: "page" as const,
        label: `Edited ${p.page_title || p.page_slug}`,
        detail: p.is_published ? "Published" : "Draft",
        amount: 0,
        at: p.updated_at!,
      })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* ── Hero header ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.06] p-6">
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Your white-label website
              </span>
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              {branding.site_name || "Your travel brand"}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {customDomain ? (
                <Badge variant="outline" className="font-mono text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1 text-success0" />
                  {customDomain}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  No domain connected
                </Badge>
              )}
              {plan && (
                <Badge variant="secondary" className="text-xs">{plan.display_name}</Badge>
              )}
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground text-xs">
                {publishedCount}/{pages.length || 1} pages live · {homeBlockCount} blocks
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={previewPath} target="_blank" rel="noreferrer">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </a>
            </Button>
            {liveUrl && (
              <Button variant="outline" asChild>
                <a href={liveUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit live
                </a>
              </Button>
            )}
            <Button asChild>
              <Link to="/studio">
                <Sparkles className="w-4 h-4 mr-2" />
                Open Studio
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────── */}
      {isInGrace && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="font-medium text-foreground">
              Your plan expired. {7 - (daysSinceExpiry || 0)} days until lockout.
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              Renew to keep your site, AI credits, and analytics active.
            </span>
          </div>
        </div>
      )}
      {hasUnpublished && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">You have unpublished changes.</span>
            <span className="text-muted-foreground hidden sm:inline">
              Publish from Studio to push them live.
            </span>
          </div>
          <Button size="sm" asChild>
            <Link to="/studio">
              <Rocket className="w-3.5 h-3.5 mr-1.5" />
              Publish
            </Link>
          </Button>
        </div>
      )}

      {/* ── Domain + Credits + Analytics (top row) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DomainConnectCard
          tenantId={adminTenantId!}
          currentDomain={customDomain}
          onChange={refresh}
        />
        <CreditsCard
          tenantId={adminTenantId!}
          allowance={allowance}
          used={used}
          topup={topup}
          periodEnd={periodEnd}
          onTopup={refresh}
        />
        <AnalyticsCard tenantId={adminTenantId!} liveUrl={liveUrl} />
      </div>

      {/* ── Quick actions ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickAction
          icon={Plus}
          label="New page"
          desc="Add an About, Contact or custom page"
          href="/studio?action=new-page"
        />
        <QuickAction
          icon={Sparkles}
          label="AI rewrite"
          desc="Refresh hero copy with one click"
          href="/studio?tab=ai"
        />
        <QuickAction
          icon={Palette}
          label="Theme & colors"
          desc="Switch skin, fonts, palette"
          href="/studio?tab=skin"
        />
        <QuickAction
          icon={History}
          label="Snapshots"
          desc="Roll back to a previous version"
          href="/studio?tab=history"
        />
      </div>

      {/* ── Pages + Activity + Checklist ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pages overview */}
        <Card className="lg:col-span-2 border-border/60">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">Your pages</span>
                <Badge variant="outline" className="text-[10px] h-5">
                  {pages.length}/{plan?.max_pages || "∞"}
                </Badge>
              </div>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/studio?action=new-page">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New page
                </Link>
              </Button>
            </div>
            {pages.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No pages yet. Open Studio to compose your homepage.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pages.slice(0, 6).map((p) => {
                  const blocks = Array.isArray(p.block_instances) ? (p.block_instances as any[]).length : 0;
                  const isStale = p.is_published && p.published_at && p.updated_at
                    ? new Date(p.updated_at) > new Date(p.published_at)
                    : !p.is_published;
                  return (
                    <div
                      key={p.page_slug}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate flex items-center gap-2">
                          {p.page_title || p.page_slug}
                          {p.page_slug === "home" && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">home</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.page_slug === "home" ? "/" : `/p/${p.page_slug}`} · {blocks} blocks
                          {p.updated_at && ` · ${timeAgo(p.updated_at)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isStale ? (
                          <Badge variant="outline" className="text-warning border-warning/25 dark:text-warning dark:border-warning text-xs">
                            {p.is_published ? "Draft changes" : "Unpublished"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-success border-success/25 dark:text-success dark:border-success text-xs">
                            Live
                          </Badge>
                        )}
                        <Button size="sm" variant="ghost" asChild className="opacity-60 group-hover:opacity-100">
                          <a
                            href={`/studio?page=${p.page_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup checklist */}
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">Setup</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {checklistDone}/{checklist.length}
              </span>
            </div>
            <Progress value={checklistPct} className="h-1.5" />
            <ul className="space-y-1.5 text-sm pt-1">
              {checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-2">
                  {c.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success0 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Plan modules + Activity feed ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PlanBillingCard
          tenantId={adminTenantId!}
          currentPlanKey={tenant?.plan_key || null}
          expiresAt={tenant?.plan_expires_at || null}
          onChange={refresh}
        />
        {plan && (
          <ModulesCard
            tenantId={adminTenantId!}
            plan={plan}
            enabledModules={(skin?.enabled_modules as Record<string, boolean> | null) || null}
            currentSkinKey={skin?.skin_key || null}
            onChange={refresh}
          />
        )}

        <Card className={`border-border/60 ${plan ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">Recent activity</span>
              </div>
            </div>
            {activity.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No activity yet. Edits, AI generations and snapshots will appear here.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        row.kind === "credit" ? "bg-accent/15" : row.kind === "snapshot" ? "bg-primary/10" : "bg-muted"
                      }`}>
                        {row.kind === "credit" ? (
                          <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
                        ) : row.kind === "snapshot" ? (
                          <History className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground capitalize truncate">{row.label}</div>
                        {row.detail && (
                          <div className="text-xs text-muted-foreground truncate">{row.detail}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {row.kind === "credit" && row.amount !== 0 && (
                        <div className={`text-sm font-mono tabular-nums ${
                          row.amount < 0 ? "text-success dark:text-success" : "text-foreground"
                        }`}>
                          {row.amount < 0 ? "+" : "−"}${Math.abs(row.amount).toFixed(2)}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground">{timeAgo(row.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  desc,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/[0.04] group-hover:to-transparent transition-colors" />
      <div className="relative flex flex-col gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="font-semibold text-foreground text-sm">{label}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

function ModuleRow({
  label,
  icon: Icon,
  on,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  on: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md border ${
        on ? "border-border bg-background" : "border-dashed border-border bg-muted/30"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${on ? "text-primary" : "text-muted-foreground"}`} />
      <span className={`text-xs ${on ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      {on ? (
        <CheckCircle2 className="w-3 h-3 text-success0 ml-auto" />
      ) : (
        <XCircle className="w-3 h-3 text-muted-foreground ml-auto" />
      )}
    </div>
  );
}

function ModulesCard({
  tenantId,
  plan,
  enabledModules,
  currentSkinKey,
  onChange,
}: {
  tenantId: string;
  plan: PlanRow;
  enabledModules: Record<string, boolean> | null;
  currentSkinKey: string | null;
  onChange: () => void;
}) {
  // Plan-allowed flag per module key
  const planAllows: Record<string, boolean> = {
    flights: plan.allow_flights,
    hotels: plan.allow_hotels,
    tours: plan.allow_tours,
    transfers: plan.allow_transfers,
    blog: plan.allow_blog,
    // AI Trip Planner ships with every plan; it's only gated by the
    // platform-wide kill-switch.
    ai_trip_planner: true,
  };
  // Default ON when allowed (matches useTenantSkin defaults)
  const initial: Record<string, boolean> = {
    flights: enabledModules?.flights ?? planAllows.flights,
    hotels: enabledModules?.hotels ?? planAllows.hotels,
    tours: enabledModules?.tours ?? planAllows.tours,
    transfers: enabledModules?.transfers ?? planAllows.transfers,
    blog: enabledModules?.blog ?? planAllows.blog,
    ai_trip_planner: enabledModules?.ai_trip_planner ?? planAllows.ai_trip_planner,
  };
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [globalDisabled, setGlobalDisabled] = useState<Record<string, boolean>>({});

  // Pull the platform kill-switch so a module the admin turned off can
  // never be re-enabled by a tenant.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("platform_module_settings")
        .select("module_key, is_enabled");
      if (cancelled || !data) return;
      const map: Record<string, boolean> = {};
      for (const r of data as Array<{ module_key: string; is_enabled: boolean }>) {
        if (!r.is_enabled) map[r.module_key] = true;
      }
      setGlobalDisabled(map);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async (key: string, next: boolean) => {
    if (globalDisabled[key]) {
      toast.error(`${key} is disabled by the platform admin. Contact admin to enable.`);
      return;
    }
    if (!planAllows[key]) {
      toast.error(`${key} is not included in your ${plan.display_name} plan. Upgrade to enable.`);
      return;
    }
    const prev = state[key];
    setState((s) => ({ ...s, [key]: next }));
    setSaving(key);
    try {
      // Merge with existing row to preserve other fields
      const merged = { ...(enabledModules || {}), ...state, [key]: next };
      // skin_key is NOT NULL in tenant_skin_config, so we must always
      // include it in upserts. Fall back to a sensible default for
      // tenants who haven't set one yet, otherwise the row insert fails
      // with a 400 ("violates not-null constraint").
      const safeSkinKey = currentSkinKey || "b2c-general";
      const { error } = await supabase
        .from("tenant_skin_config")
        .upsert(
          {
            tenant_id: tenantId,
            skin_key: safeSkinKey,
            enabled_modules: merged as any,
          } as any,
          { onConflict: "tenant_id" },
        );
      if (error) throw error;
      toast.success(`${key} ${next ? "enabled" : "disabled"} on your site`);
      onChange();
    } catch (e: any) {
      setState((s) => ({ ...s, [key]: prev }));
      toast.error(`Couldn't update ${key}: ${e.message || "unknown error"}`);
    } finally {
      setSaving(null);
    }
  };

  const items: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: "flights", label: "Flights", icon: Plane },
    { key: "hotels", label: "Hotels", icon: Hotel },
    { key: "tours", label: "Tours", icon: MapPin },
    { key: "transfers", label: "Transfers", icon: Car },
    { key: "blog", label: "Blog", icon: Newspaper },
    { key: "ai_trip_planner", label: "AI Trip Planner", icon: Wand2 },
  ];

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">Site modules</span>
            <span className="text-xs text-muted-foreground">
              Toggle what shows on your white-label site
            </span>
          </div>
          <Badge variant="secondary" className="text-xs">{plan.display_name}</Badge>
        </div>
        <div className="space-y-1.5">
          {items.map((it) => {
            const allowed = planAllows[it.key];
            const blockedByAdmin = !!globalDisabled[it.key];
            const on = !!state[it.key] && allowed && !blockedByAdmin;
            return (
              <div
                key={it.key}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border ${
                  blockedByAdmin
                    ? "border-dashed border-destructive/30 bg-destructive/5"
                    : allowed
                      ? "border-border bg-background"
                      : "border-dashed border-border bg-muted/30"
                }`}
              >
                <it.icon className={`w-4 h-4 ${on ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${allowed && !blockedByAdmin ? "text-foreground" : "text-muted-foreground"}`}>
                    {it.label}
                  </div>
                  {blockedByAdmin ? (
                    <div className="text-[10px] text-destructive flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Disabled by platform admin — contact admin to enable
                    </div>
                  ) : !allowed && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Not included in plan
                    </div>
                  )}
                </div>
                <Switch
                  checked={on}
                  disabled={!allowed || blockedByAdmin || saving === it.key}
                  onCheckedChange={(v) => toggle(it.key, v)}
                  className="data-[state=unchecked]:bg-muted-foreground/25"
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
          <Globe2 className="w-3 h-3" />
          <span>Disabled modules are hidden from your live site & search.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
