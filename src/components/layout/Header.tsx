import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plane, Hotel, Map, Menu, X, User, LogOut, Shield, PenSquare, Sparkles, ChevronDown, ChevronUp, LayoutDashboard, Ticket, Settings, Briefcase } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, CURRENCIES, PICKER_CURRENCIES } from "@/contexts/CurrencyContext";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useTenant } from "@/hooks/useTenant";
import { cn } from "@/lib/utils";

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", BDT: "🇧🇩", CNY: "🇨🇳",
};

const CurrencyPicker = ({ currency, setCurrency, allowedCurrencies }: { currency: string; setCurrency: (c: any) => void; allowedCurrencies?: string[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Use market-restricted currencies if provided, otherwise default picker set
  const codes = allowedCurrencies && allowedCurrencies.length > 0
    ? allowedCurrencies.filter(c => CURRENCIES[c]) as string[]
    : Object.keys(PICKER_CURRENCIES);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-lg border border-border/50 hover:border-border transition-all duration-200"
      >
        <span>{CURRENCY_FLAGS[currency] || "💱"}</span>
        <span>{currency}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px] z-50"
          >
            {codes.map((code) => (
              <button
                key={code}
                onClick={() => { setCurrency(code); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium transition-colors",
                  code === currency
                    ? "bg-primary/8 text-primary font-semibold"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>{CURRENCY_FLAGS[code] || "💱"}</span>
                <span>{CURRENCIES[code]?.symbol}</span>
                <span>{code}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UserAvatarMenu = ({ email, isAdmin, onSignOut }: { email: string; isAdmin: boolean; onSignOut: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = email ? email.slice(0, 2).toUpperCase() : "U";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menuItems = [
    ...(isAdmin ? [{ label: "Admin Panel", icon: Shield, href: "/admin" }] : []),
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "My Bookings", icon: Ticket, href: "/dashboard" },
    { label: "Profile", icon: User, href: "/dashboard" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-border/50 hover:border-border bg-muted/40 hover:bg-muted pl-1 pr-2.5 py-1 transition-all duration-200"
      >
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary-foreground">{initials}</span>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[180px] z-50"
          >
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-[10px] text-muted-foreground font-medium truncate">{email}</p>
            </div>
            <div className="py-1">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="border-t border-border py-1">
              <button
                onClick={() => { setOpen(false); onSignOut(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/8 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const navItems = [
  { label: "Flights", icon: Plane, href: "/flights" },
  { label: "Hotels", icon: Hotel, href: "/hotels" },
  { label: "Tours", icon: Map, href: "/tours" },
  { label: "Blog", icon: PenSquare, href: "/blog" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { currency, setCurrency, isLocked, pickerMode, allowedCurrencies, marketNote } = useCurrency();
  const { branding, loading: brandingLoading } = useSiteBranding();
  const { tenant } = useTenant();
  // Subtle "For partners →" link surfaces on tenant domains so B2B
  // visitors can find their entry point without crowding the consumer
  // hero. Hidden on the platform site and inside the partner page itself.
  const partnerSlug = tenant?.b2b_landing_slug || "partners";
  const partnerHref = `/${partnerSlug}`;
  const showPartnerLink = !!tenant && location.pathname !== partnerHref;

  // Preserve studio_preview context so the logo in the wizard preview iframe
  // (and any other previewed view) returns to the tenant homepage instead of
  // dropping the query params and falling back to the platform Index.
  const previewParams = (() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get("studio_preview") === "1" && sp.get("tenant")) {
      return `?studio_preview=1&tenant=${sp.get("tenant")}`;
    }
    return "";
  })();
  const homeHref = `/${previewParams}`;

  useEffect(() => {
    const onScroll = () => {
      // Hysteresis: scroll down past 20px to trigger, scroll up past 5px to release
      setScrolled(prev => {
        if (!prev && window.scrollY > 20) return true;
        if (prev && window.scrollY < 5) return false;
        return prev;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const siteName = branding.site_name || "Travel Vela";
  const nameParts = siteName.length > 5 ? [siteName.slice(0, -4), siteName.slice(-4)] : [siteName, ""];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-500 ease-out",
        scrolled
          ? "bg-card/80 backdrop-blur-2xl border-b border-border/50 shadow-[0_1px_0_0_hsl(var(--primary)/0.06),var(--shadow-elevated)]"
          : "bg-card/60 backdrop-blur-xl border-b border-transparent"
      )}
    >
      <div className="container mx-auto px-4">
        <div className={cn(
          "flex items-center justify-between transition-all duration-500",
          scrolled ? "h-12" : "h-14"
        )}>
          {/* Logo */}
          <Link to={homeHref} className="flex items-center gap-2.5 min-w-[120px] group">
            {brandingLoading ? (
              <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
            ) : (
              <>
                {branding.logo_url ? (
                  <img src={branding.logo_url} alt={siteName} className="h-9 w-auto object-contain" />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                      <Plane className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="text-lg font-bold text-foreground tracking-tight">
                      {nameParts[0]}<span className="text-accent">{nameParts[1]}</span>
                    </span>
                  </div>
                )}
              </>
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const active = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "relative px-3.5 py-2 group rounded-lg transition-all duration-200",
                    active && "bg-primary/8"
                  )}
                >
                  <span className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold transition-colors duration-200",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    <item.icon className={cn(
                      "w-3.5 h-3.5 transition-all duration-200",
                      active ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
                    )} />
                    {item.label}
                  </span>
                  {/* Active indicator — animated underline */}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-primary rounded-full shadow-[0_0_8px_0_hsl(var(--primary)/0.4)]"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  {/* Hover underline for non-active */}
                  {!active && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-border scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                  )}
                </Link>
              );
            })}
            {/* AI Planner CTA */}
            <Link
              to="/trip-planner"
              className={cn(
                "ml-1 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all duration-300 border",
                location.pathname === "/trip-planner"
                  ? "bg-gradient-to-r from-accent to-accent/80 text-accent-foreground border-accent shadow-[0_0_24px_-4px_hsl(var(--accent)/0.6)]"
                  : "bg-gradient-to-r from-accent/20 to-accent/8 text-accent border-accent/40 shadow-[0_0_16px_-4px_hsl(var(--accent)/0.3)] hover:from-accent/30 hover:to-accent/15 hover:border-accent/60 hover:shadow-[0_0_26px_-4px_hsl(var(--accent)/0.5)]"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Planner
            </Link>
            {showPartnerLink && (
              <Link
                to={partnerHref}
                className="ml-2 hidden lg:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                <Briefcase className="w-3 h-3" />
                For travel agents →
              </Link>
            )}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-2">
            <AnimatePresence>
              {scrolled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm whitespace-nowrap"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    <ChevronUp className="w-3.5 h-3.5 mr-1" />
                    Back to Top
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {pickerMode === "show" && !isLocked ? (
              <CurrencyPicker currency={currency} setCurrency={setCurrency} allowedCurrencies={allowedCurrencies} />
            ) : pickerMode === "disabled" ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1.5 rounded-lg border border-border/50 cursor-not-allowed" title={marketNote || "Currency is fixed for your region"}>
                <span>{CURRENCY_FLAGS[currency] || "💱"}</span>
                <span>{currency}</span>
              </span>
            ) : pickerMode === "hide" && isLocked ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1.5 rounded-lg border border-border/50">
                <span>{CURRENCY_FLAGS[currency] || "💱"}</span>
                <span>{currency}</span>
              </span>
            ) : null}

            {user && <NotificationBell />}

            {user ? (
              <UserAvatarMenu
                email={user.email || ""}
                isAdmin={isAdmin}
                onSignOut={handleSignOut}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button size="sm" className="h-8 text-xs font-bold rounded-lg border border-primary/40 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/60 shadow-none" asChild>
                  <Link to="/auth">Register</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Menu className="w-5 h-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-14 bg-foreground/20 backdrop-blur-sm md:hidden z-40"
              onClick={() => setMobileOpen(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full left-0 right-0 md:hidden bg-card border-b border-border shadow-[var(--shadow-elevated)] z-50"
            >
              <div className="container mx-auto px-4 py-3 space-y-1">
                {navItems.map((item, i) => {
                  const active = location.pathname === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                    >
                      <Link
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/8 text-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <item.icon className={cn("w-4 h-4", active ? "text-primary" : "text-muted-foreground")} />
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}

                {/* AI Planner CTA - mobile */}
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navItems.length * 0.04, duration: 0.2 }}
                >
                  <Link
                    to="/trip-planner"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                      location.pathname === "/trip-planner"
                        ? "bg-accent/15 text-accent"
                        : "text-accent hover:bg-accent/10"
                    )}
                  >
                    <Sparkles className="w-4 h-4" />
                    🤖 AI Planner
                  </Link>
                </motion.div>

                <div className="pt-2 mt-2 border-t border-border space-y-1">
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">
                    {CURRENCIES[currency]?.symbol} {currency} — {CURRENCIES[currency]?.name}
                    </div>
                    {pickerMode === "show" && !isLocked && <CurrencyPicker currency={currency} setCurrency={setCurrency} allowedCurrencies={allowedCurrencies} />}
                  </div>
                  {marketNote && (
                    <p className="px-3 text-[10px] text-muted-foreground/70 italic">{marketNote}</p>
                  )}
                  {user ? (
                    <>
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                          <Shield className="w-4 h-4 text-muted-foreground" /> Admin
                        </Link>
                      )}
                      <Link to="/dashboard" onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                        <User className="w-4 h-4 text-muted-foreground" /> Dashboard
                      </Link>
                      <button
                        onClick={() => { handleSignOut(); setMobileOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </>
                  ) : (
                    <div className="flex gap-2 px-3 py-2">
                      <Button size="sm" className="flex-1 h-9 text-xs font-bold rounded-lg bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                        <Link to="/auth" onClick={() => setMobileOpen(false)}>Sign In / Register</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
