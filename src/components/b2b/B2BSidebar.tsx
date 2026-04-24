import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useB2B, type B2BPage } from "@/contexts/B2BContext";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import {
  LayoutDashboard, Search, Ticket, Users, Wallet, BarChart3,
  Headphones, UserPlus, Settings, TrendingUp, DollarSign,
  RefreshCw, Palette, Code, CreditCard,
  LogOut, Globe, Handshake,
} from "lucide-react";

interface NavItem { id: B2BPage; label: string; icon: any; badge?: number }

export const B2BSidebar = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { activePage, setActivePage, isSubAgent, bookings, profile } = useB2B();
  const { branding } = useSiteBranding();

  const pendingCount = bookings.filter(b => b.status === "Pending" || b.status === "Needs Payment" || b.status === "Awaiting Payment").length;

  const siteName = branding.site_name || "Travel Vela";

  // Sub-agents see a simpler, focused menu
  const subAgentNav: NavItem[] = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "search-book", label: "Search & Book", icon: Search },
    { id: "bookings", label: "Booking Queue", icon: Ticket, badge: pendingCount || undefined },
    { id: "customers", label: "Customers", icon: Users },
    { id: "requests", label: "After-Sales", icon: RefreshCw },
    { id: "wallet", label: "Wallet & Finance", icon: Wallet },
    { id: "markup", label: "Markup Settings", icon: DollarSign },
    { id: "earnings", label: "Earnings", icon: TrendingUp },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "support", label: "Support", icon: Headphones },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // Main agents get full menu with staff management, white-label, API, etc.
  const mainAgentNav: NavItem[] = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "search-book", label: "Search & Book", icon: Search },
    { id: "bookings", label: "Booking Queue", icon: Ticket, badge: pendingCount || undefined },
    { id: "customers", label: "Customers", icon: Users },
    { id: "requests", label: "After-Sales", icon: RefreshCw },
    { id: "wallet", label: "Wallet & Finance", icon: Wallet },
    { id: "markup", label: "Markup Settings", icon: DollarSign },
    { id: "earnings", label: "Earnings", icon: TrendingUp },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "support", label: "Support", icon: Headphones },
    { id: "staff", label: "Staff / Sub-Agents", icon: UserPlus },
    { id: "white-label", label: "Custom Website", icon: Palette },
    { id: "partner-applications", label: "Partner Applications", icon: Handshake },
    { id: "api-access", label: "API Access", icon: Code },
    { id: "payment-banks", label: "Payment & Banks", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const mainNav = isSubAgent ? subAgentNav : mainAgentNav;

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-border/60">
      {/* Logo — agent's own logo takes priority */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        {profile.logo_url ? (
          <img src={profile.logo_url} alt={profile.company_name || siteName} className="h-8 w-auto max-w-[160px] object-contain" />
        ) : branding.logo_url ? (
          <img src={branding.logo_url} alt={siteName} className="h-8 w-auto object-contain" />
        ) : (
          <>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shadow-sm">
              TV
            </div>
            <span className="text-sm font-bold text-foreground tracking-tight">{siteName}</span>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                }`}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className={`ml-auto text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-destructive/10 text-destructive"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border/50 space-y-0.5">
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
        >
          <Globe className="w-[18px] h-[18px]" />
          Main Site
        </button>
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
