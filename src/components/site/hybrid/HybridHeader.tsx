import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Sparkles,
  Plane,
  Hotel,
  MapPin,
  Car,
  BookOpen,
  Phone,
  Mail,
  ArrowUpRight,
  Globe2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useTenant } from "@/hooks/useTenant";
import { useFooterData } from "@/hooks/useFooterData";
import { usePlatformModules } from "@/hooks/usePlatformModules";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Studio-preview link helper — preserves tenant + studio_preview params
 * across in-app navigation inside the studio iframe.
 */
const PREVIEW_KEY = "studio_preview_tenant_id";
const usePreviewLinkBuilder = () => {
  if (typeof window === "undefined") return (to: string) => to;
  const params = new URLSearchParams(window.location.search);
  let tenantId = params.get("tenant");
  let isPreview = params.get("studio_preview") === "1" && !!tenantId;
  if (!isPreview) {
    try {
      const stashed = sessionStorage.getItem(PREVIEW_KEY);
      if (stashed) { tenantId = stashed; isPreview = true; }
    } catch { /* sessionStorage may be unavailable */ }
  }
  return (to: string) => {
    if (!isPreview || !tenantId) return to;
    const [path, q = ""] = to.split("?");
    const merged = new URLSearchParams(q);
    merged.set("studio_preview", "1");
    merged.set("tenant", tenantId);
    return `${path}?${merged.toString()}`;
  };
};

/**
 * HybridHeader — editorial header (v3 — "Atelier").
 *
 * Distinct visual layout (no longer a platform clone):
 *  - Top "broadsheet" strip: monospaced ISSUE no., date, location chip,
 *    contact link → reads like a magazine masthead.
 *  - Centered serif wordmark with primary hairline rules either side
 *    (the brand sits between them, like a magazine title).
 *  - Below the wordmark: horizontally-centered nav with letter-spaced
 *    uppercase labels separated by tiny diamond separators.
 *  - Right-anchored "Plan with AI" pill CTA.
 *  - Brand-color glassy backdrop tightens on scroll into a single
 *    condensed bar with left-aligned wordmark + nav.
 */

const NAV = [
  { to: "/flights", label: "Flights", icon: Plane },
  { to: "/hotels", label: "Stays", icon: Hotel },
  { to: "/tours", label: "Experiences", icon: MapPin },
  { to: "/transfers", label: "Transfers", icon: Car },
  { to: "/blog", label: "Journal", icon: BookOpen },
] as const;

const issueDate = () =>
  new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

const HybridHeader = () => {
  const { user, signOut } = useAuth();
  const { branding } = useSiteBranding();
  const { tenant } = useTenant();
  const { header: headerCfg } = useFooterData();
  const buildLink = usePreviewLinkBuilder();
  const { isEnabled } = usePlatformModules();
  const aiPlannerEnabled = isEnabled("ai_trip_planner");
  const ts = (tenant?.settings || {}) as Record<string, any>;
  const contact = (ts.contact || {}) as Record<string, string>;

  // Header display toggles (admin-controlled in Settings → Header).
  // Default to "show" so existing tenants don't lose anything if they never visit
  // the new tab. `!== false` means: explicit false hides, anything else shows.
  const showIssueStrip   = headerCfg?.show_issue_strip   !== false;
  const showPhone        = headerCfg?.show_phone         !== false;
  const showEmail        = headerCfg?.show_email         !== false;
  const showCity         = headerCfg?.show_city          !== false;
  // Hide AI Concierge entirely when the platform admin disables the AI Trip
  // Planner module — overrides the per-tenant header toggle.
  const showAiConcierge  = headerCfg?.show_ai_concierge  !== false && aiPlannerEnabled;
  const showTagline      = headerCfg?.show_tagline       !== false;
  const aiLabel          = (headerCfg?.ai_concierge_label as string) || "AI Concierge";
  const ctaLabel         = (headerCfg?.cta_label         as string) || "Plan a Journey";
  const cityChip =
    (ts.brand?.city as string) ||
    (ts.city as string) ||
    (contact.city as string) ||
    "Worldwide";
  const tagline =
    (ts.brand?.tagline as string) ||
    (ts.tagline as string) ||
    "Curated journeys · Concierge support";
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Hysteresis prevents flip-flopping near the threshold while scrolling
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        // Wide hysteresis: become "scrolled" only after passing 180px,
        // and only revert when the user has scrolled all the way back
        // to the very top — prevents flip-flopping near the threshold.
        setScrolled((prev) => (prev ? y > 20 : y > 180));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const siteName = branding.site_name || tenant?.name || "Travel";
  const initials = siteName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const showWordmark = !branding.logo_url;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-background/92 backdrop-blur-2xl shadow-[0_10px_36px_-18px_hsl(var(--primary)/0.28)]"
          : "bg-[hsl(var(--primary)/0.04)] backdrop-blur-md",
      )}
    >
      {/* ───── Broadsheet strip ───── */}
      <div
        className={cn(
          "overflow-hidden bg-foreground text-background transition-[max-height,opacity] duration-300 ease-out",
          scrolled || !showIssueStrip ? "max-h-0 opacity-0" : "max-h-9 opacity-100",
        )}
        aria-hidden={scrolled || !showIssueStrip}
      >
            <div className="container mx-auto px-4 lg:px-6">
              <div className="flex items-center justify-between h-9 text-[10.5px] font-mono tracking-[0.18em] uppercase">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-bold text-background">VOL · {String(new Date().getFullYear()).slice(-2)}</span>
                  <span className="opacity-30">/</span>
                  <span className="hidden sm:inline opacity-80">{issueDate()}</span>
                  {showCity && (
                    <>
                      <span className="opacity-30 hidden md:inline">/</span>
                      <span className="hidden md:inline-flex items-center gap-1.5 opacity-80">
                        <Globe2 className="w-3 h-3" /> {cityChip}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {showPhone && contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="hidden md:inline-flex items-center gap-1.5 hover:text-[hsl(var(--accent))] transition-colors"
                    >
                      <Phone className="w-3 h-3" /> {contact.phone}
                    </a>
                  )}
                  {showEmail && contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="hidden md:inline-flex items-center gap-1.5 hover:text-[hsl(var(--accent))] transition-colors"
                    >
                      <Mail className="w-3 h-3" /> {contact.email}
                    </a>
                  )}
                  {showAiConcierge && (
                    <Link
                      to={buildLink("/trip-planner")}
                      className="inline-flex items-center gap-1.5 text-[hsl(var(--accent))] font-bold hover:text-background transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> {aiLabel}
                    </Link>
                  )}
                </div>
              </div>
            </div>
      </div>

      {/* Top accent rule */}
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 50%, hsl(var(--primary)) 100%)",
        }}
      />

      <div className="container mx-auto px-4 lg:px-6">
        {/* ───── Editorial masthead (top state only) ───── */}
        <div
          className={cn(scrolled ? "hidden" : "block")}
          aria-hidden={scrolled}
        >
              <div className="hidden lg:flex items-center justify-between gap-6 pt-6 pb-3">
                {/* Left meta */}
                <div className="flex-1 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold">
                  <span className="h-px w-8 bg-primary/60" />
                  {(ts.brand?.estYear as string | number) ? (
                    <span>Est. {ts.brand?.estYear as string | number}</span>
                  ) : (
                    <span className="opacity-60">Curated travel</span>
                  )}
                </div>

                {/* Center brand lockup */}
                <Link to={buildLink("/")} className="flex items-center gap-3 group shrink-0">
                  {branding.logo_url ? (
                    <img
                      src={branding.logo_url}
                      alt={siteName}
                      className="h-12 w-auto object-contain"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground grid place-items-center font-bold text-sm shadow-md"
                      style={{
                        boxShadow:
                          "0 8px 22px -10px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.18)",
                      }}
                    >
                      {initials}
                    </div>
                  )}
                  {showWordmark && (
                    <div className="flex flex-col items-start leading-none">
                      <span
                        className="text-[34px] font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors"
                        style={{
                          fontFamily:
                            "'DM Serif Display', 'Playfair Display', Georgia, serif",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {siteName}
                      </span>
                      {showTagline && (
                        <span className="mt-1.5 text-[9.5px] uppercase tracking-[0.32em] text-primary font-bold">
                          — The Travel Atelier —
                        </span>
                      )}
                    </div>
                  )}
                </Link>

                {/* Right tagline + CTA */}
                <div className="flex-1 flex items-center justify-end gap-4">
                  <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold hidden xl:inline">
                    {tagline}
                  </span>
                  <span className="h-px w-8 bg-primary/60 hidden xl:block" />
                </div>
              </div>

              {/* Hairline rules either side of wordmark on smaller screens */}
              <div className="lg:hidden flex items-center justify-center gap-3 pt-5 pb-2">
                <span className="flex-1 h-px bg-border/60" />
                <Link to={buildLink("/")} className="flex items-center gap-2.5 group shrink-0">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt={siteName} className="h-8 w-auto object-contain" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground grid place-items-center font-bold text-xs shadow-md">
                      {initials}
                    </div>
                  )}
                  {showWordmark && (
                    <span
                      className="text-[22px] font-semibold tracking-tight text-foreground"
                      style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
                    >
                      {siteName}
                    </span>
                  )}
                </Link>
                <span className="flex-1 h-px bg-border/60" />
              </div>
        </div>

        {/* ───── Nav row (always visible) ───── */}
        <div
          className={cn(
            "flex items-center gap-4 transition-all duration-300",
            scrolled ? "h-14 lg:h-16" : "h-12 lg:h-14",
          )}
        >
          {/* Compact brand — only when scrolled */}
          {scrolled ? (
            <div className="shrink-0">
              <Link to={buildLink("/")} className="flex items-center gap-2.5 group">
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt={siteName} className="h-8 w-auto object-contain" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground grid place-items-center font-bold text-[10px] shadow-md">
                    {initials}
                  </div>
                )}
                {showWordmark && (
                  <span
                    className="text-base font-semibold text-foreground tracking-tight hidden sm:inline"
                    style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
                  >
                    {siteName}
                  </span>
                )}
              </Link>
            </div>
          ) : (
            <span className="shrink-0" />
          )}

          {/* Centered nav with diamond separators */}
          <nav className="hidden lg:flex flex-1 items-center justify-center gap-0.5 min-w-0">
            {NAV.map((item, idx) => {
              const active =
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/");
              return (
                <div key={item.to} className="flex items-center shrink-0">
                  <Link
                    to={buildLink(item.to)}
                    className={cn(
                      "relative px-2.5 xl:px-4 py-2 text-[11px] xl:text-[11.5px] font-semibold uppercase tracking-[0.14em] xl:tracking-[0.18em] whitespace-nowrap transition-colors",
                      active
                        ? "text-primary"
                        : "text-foreground/75 hover:text-foreground",
                    )}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="hybrid-nav-underline"
                        className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[2px] w-6 rounded-full bg-primary"
                      />
                    )}
                  </Link>
                  {idx < NAV.length - 1 && (
                    <span className="text-primary/40 text-[7px] rotate-45 inline-block">◆</span>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {aiPlannerEnabled && (
            <Link
              to={buildLink("/trip-planner")}
              className={cn(
                "hidden md:inline-flex items-center gap-1.5 px-3 xl:px-4 py-2 rounded-full text-[11px] xl:text-[11.5px] font-bold uppercase tracking-[0.14em] xl:tracking-[0.16em] whitespace-nowrap transition-all",
                "bg-foreground text-background hover:bg-primary",
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{ctaLabel}</span>
              <span className="xl:hidden">Plan</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
            )}

            {user ? (
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full hover:bg-muted/60 border border-transparent hover:border-border/60 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary grid place-items-center text-xs font-bold border border-primary/20">
                    {(user.email || "U").slice(0, 2).toUpperCase()}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-border/60 bg-muted/30">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                          Signed in as
                        </div>
                        <div className="text-sm font-medium text-foreground truncate mt-0.5">
                          {user.email}
                        </div>
                      </div>
                      <button
                        onClick={() => { setMenuOpen(false); navigate("/dashboard"); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-muted-foreground" /> Dashboard
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); signOut(); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/60 border-t border-border/60 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-muted-foreground" /> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Button
                onClick={() => navigate("/auth")}
                size="sm"
                variant="outline"
                className="rounded-full px-4 hidden md:inline-flex border-foreground/20 hover:bg-foreground hover:text-background text-[11.5px] uppercase tracking-[0.16em] font-bold"
              >
                Sign in
              </Button>
            )}

            <button
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/60 transition-colors"
              aria-label="Menu"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="lg:hidden overflow-hidden border-t border-border/60"
            >
              <div className="py-3 flex flex-col gap-0.5">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={buildLink(item.to)}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-foreground rounded-lg hover:bg-muted/60"
                    >
                      <Icon className="w-4 h-4 text-primary" />
                      {item.label}
                    </Link>
                  );
                })}
                {aiPlannerEnabled && (
                <Link
                  to={buildLink("/trip-planner")}
                  onClick={() => setOpen(false)}
                  className="mt-2 mx-1 px-3 py-3 text-sm font-bold uppercase tracking-[0.14em] text-background bg-foreground hover:bg-primary rounded-full flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {ctaLabel}
                </Link>
                )}
                {!user && (
                  <Button
                    onClick={() => { setOpen(false); navigate("/auth"); }}
                    variant="outline"
                    className="mt-2 w-full rounded-full uppercase tracking-[0.14em] font-bold"
                  >
                    Sign in
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default HybridHeader;
