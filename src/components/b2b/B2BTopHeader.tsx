import { useState } from "react";
import { useB2B } from "@/contexts/B2BContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Menu, Search, Wallet, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { B2BSidebar } from "./B2BSidebar";

const PAGE_TITLES: Record<string, string> = {
  overview: "Dashboard",
  "search-book": "Search & Book",
  bookings: "Booking Queue",
  customers: "Customers",
  wallet: "Wallet & Finance",
  markup: "Markup Settings",
  earnings: "Earnings",
  "sub-agent-earnings": "Sub-Agent Earnings",
  reports: "Reports",
  requests: "After-Sales",
  support: "Support",
  staff: "Staff Management",
  "white-label": "White Label",
  "api-access": "API Access",
  "payment-banks": "Payment & Banks",
  settings: "Settings",
  profile: "Profile",
};

export const B2BTopHeader = () => {
  const {
    activePage, profile, bookings, walletBalance, fmtNative, fmtCurrency,
    availableCurrencies, activeCurrency, setActiveCurrency, walletBalances,
  } = useB2B();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [curOpen, setCurOpen] = useState(false);

  const pendingCount = bookings.filter(b => b.status === "Pending" || b.status === "Needs Payment").length;
  const hasMultipleCurrencies = availableCurrencies.length > 1;

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "AG";

  return (
    <header className="h-[60px] flex items-center justify-between border-b border-border/40 px-4 md:px-6 bg-sidebar/85 backdrop-blur-xl sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
              <Menu className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[220px] p-0"><B2BSidebar /></SheetContent>
        </Sheet>

        <div>
          <h1 className="text-base font-bold text-foreground tracking-tight leading-none">
            {PAGE_TITLES[activePage] || "Agent Portal"}
          </h1>
          {activePage === "overview" && (
            <p className="text-[11px] text-muted-foreground/50 mt-0.5 font-medium">Welcome back, {profile.full_name?.split(" ")[0] || "Agent"}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center relative group">
          <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground/30 group-focus-within:text-primary/50 transition-colors" />
          <Input
            placeholder="Search bookings, PNR…"
            className="h-9 w-48 lg:w-64 pl-9 pr-4 text-xs bg-muted/30 border-border/30 focus:border-primary/30 focus:bg-card focus:shadow-sm rounded-xl transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted/50 transition-all group">
          <Bell className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-destructive rounded-full ring-2 ring-card flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">{pendingCount}</span>
            </span>
          )}
        </button>

        {/* Wallet Balance + Currency Switcher */}
        {hasMultipleCurrencies ? (
          <Popover open={curOpen} onOpenChange={setCurOpen}>
            <PopoverTrigger asChild>
              <button
                className="hidden sm:flex items-center gap-2 bg-primary/8 hover:bg-primary/12 rounded-xl px-3 py-1.5 transition-colors"
                aria-label="Switch wallet currency"
              >
                <Wallet className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-xs font-bold text-foreground">{fmtNative(walletBalance)}</span>
                <span className="text-[10px] font-semibold text-muted-foreground/70 px-1.5 py-0.5 bg-card rounded">
                  {activeCurrency}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                Switch wallet currency
              </p>
              <div className="space-y-0.5">
                {availableCurrencies.map((cur) => {
                  const bal = walletBalances[cur] || 0;
                  const isActive = cur === activeCurrency;
                  const isPrimary = cur === profile.billing_currency;
                  return (
                    <button
                      key={cur}
                      onClick={() => { setActiveCurrency(cur); setCurOpen(false); }}
                      className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                          {cur}
                        </span>
                        {isPrimary && (
                          <span className="text-[9px] font-semibold uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold tabular-nums ${
                        bal < 0 ? "text-destructive" : isActive ? "text-primary" : "text-foreground"
                      }`}>
                        {fmtCurrency(bal, cur)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="hidden sm:flex items-center gap-2 bg-primary/8 rounded-xl px-3 py-1.5">
            <Wallet className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-xs font-bold text-foreground">{fmtNative(walletBalance)}</span>
          </div>
        )}

        {/* Divider */}
        <div className="hidden sm:block w-px h-7 bg-border/30" />

        {/* Profile */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => {}}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name || "Agent"} className="w-9 h-9 rounded-xl object-cover shadow-sm" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-[11px] shadow-md shadow-primary/20">
              {initials}
            </div>
          )}
          <div className="hidden lg:block">
            <p className="text-[12px] font-bold text-foreground leading-none">
              {profile.full_name || "Agent"}
            </p>
            <p className="text-[10px] text-muted-foreground/60 font-medium mt-0.5">
              {profile.company_name || "Agent"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
