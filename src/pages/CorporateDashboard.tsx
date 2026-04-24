import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  LayoutDashboard, CalendarCheck, Wallet, Users, Shield, PieChart,
  Plane, Building2, Map, ChevronRight, Menu, Clock, CreditCard,
  Download, UserCircle, Headphones, TrendingUp, DollarSign,
  FileText, CheckSquare, Briefcase, BarChart3, UsersRound,
  ArrowRight, Globe, Filter, UserPlus,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import WalletSection from "@/components/dashboard/WalletSection";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;

type ActivePage =
  | "overview" | "employee-bookings" | "travel-policy" | "approvals"
  | "cost-center" | "wallet" | "travelers" | "bulk-booking"
  | "analytics" | "profile" | "support";

const statusColors: Record<string, string> = {
  Paid: "bg-primary/10 text-primary border-primary/20",
  Pending: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  Confirmed: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20",
  Cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", CNY: "¥", INR: "₹",
  AED: "د.إ", MYR: "RM", SGD: "S$", THB: "฿",
};

const CorporateDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { isHybrid } = useIsHybridSkin();
  const [activePage, setActivePage] = useState<ActivePage>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [profile, setProfile] = useState({ full_name: "", email: "", company_name: "", created_at: "", billing_currency: "USD" });

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bookingsRes, profileRes, walletRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_transactions" as any).select("amount, type, status, currency").eq("user_id", user.id).eq("status", "completed"),
      ]);
      setBookings(bookingsRes.data || []);
      if (profileRes.data) {
        const pd = profileRes.data as any;
        setProfile({
          full_name: pd.full_name || "",
          email: pd.email || "",
          company_name: pd.company_name || "",
          created_at: pd.created_at || "",
          billing_currency: pd.billing_currency || "USD",
        });
      }
      // Wallet balance: only sum txns in the company billing currency to prevent mixed-currency arithmetic
      const billingCur = String((profileRes.data as any)?.billing_currency || "USD").toUpperCase();
      const txns = (walletRes.data || []) as any[];
      setWalletBalance(txns.reduce((s: number, t: any) => {
        const txCur = String(t.currency || "USD").toUpperCase();
        if (txCur !== billingCur) return s;
        return s + (t.type === "credit" ? Number(t.amount) : -Number(t.amount));
      }, 0));
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = bookings.filter(b => b.status !== "Cancelled").reduce((s, b) => s + Number(b.total), 0);
  const activeTrips = bookings.filter(b => b.status === "Confirmed" || b.status === "Paid").length;
  const pendingApprovals = bookings.filter(b => b.status === "Pending").length;

  /** Format amount in the company's billing currency — no USD conversion */
  const billingCur = profile.billing_currency || "USD";
  const fmtNative = (amt: number) => {
    const sym = CURRENCY_SYMBOLS[billingCur] || billingCur + " ";
    return `${sym}${Math.round(amt).toLocaleString()}`;
  };
  /** Format a booking's total using its own booked_currency */
  const fmtBooking = (b: Booking) => {
    const cur = (b as any).booked_currency || billingCur;
    const sym = CURRENCY_SYMBOLS[cur] || cur + " ";
    return `${sym}${Math.round(Number(b.total)).toLocaleString()}`;
  };

  const navSections = [
    {
      label: "Travel Management",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "employee-bookings", label: "Employee Bookings", icon: CalendarCheck },
        { id: "approvals", label: "Approvals", icon: CheckSquare },
        { id: "travelers", label: "Traveler Profiles", icon: UsersRound },
        { id: "bulk-booking", label: "Bulk Booking", icon: Briefcase },
      ],
    },
    {
      label: "Policy & Finance",
      items: [
        { id: "travel-policy", label: "Travel Policy", icon: Shield },
        { id: "cost-center", label: "Cost Center", icon: PieChart },
        { id: "wallet", label: "Wallet & Billing", icon: Wallet },
        { id: "analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Account",
      items: [
        { id: "profile", label: "Company Profile", icon: UserCircle },
        { id: "support", label: "Support", icon: Headphones },
      ],
    },
  ] as const;

  const handleNav = (page: ActivePage) => {
    setActivePage(page);
    setMobileOpen(false);
  };

  const initials = profile.company_name
    ? profile.company_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "CO";

  const renderSidebar = () => (
    <div className="flex flex-col h-full">
      {/* Company header */}
      <div className="p-5 border-b border-border bg-gradient-to-br from-[hsl(220,60%,15%)] to-[hsl(220,50%,20%)] text-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center font-bold text-sm backdrop-blur-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate text-sm">{profile.company_name || "Corporate"}</p>
            <Badge className="text-[10px] bg-white/15 text-white border-0 mt-0.5">Corporate</Badge>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id as ActivePage)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                    {item.id === "approvals" && pendingApprovals > 0 && (
                      <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">{pendingApprovals}</Badge>
                    )}
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Budget summary */}
      <div className="p-3 border-t border-border">
        <div className="rounded-xl bg-muted/50 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Monthly Spend</p>
          <p className="text-xl font-bold text-foreground">{fmtNative(totalSpent)}</p>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-primary rounded-full h-1.5" style={{ width: "35%" }} />
          </div>
          <p className="text-[10px] text-muted-foreground">35% of budget used</p>
        </div>
      </div>
    </div>
  );

  // --- Overview ---
  const renderOverview = () => (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-r from-[hsl(220,60%,15%)] via-[hsl(230,50%,20%)] to-[hsl(250,50%,25%)] p-6 md:p-8 text-white mb-6 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-1 font-serif">{profile.company_name || "Corporate"} Travel Hub</h1>
          <p className="text-white/70 text-sm">Manage employee travel, enforce policies, and control costs.</p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0" onClick={() => navigate("/flights")}>
              <Plane className="w-4 h-4 mr-1" /> Book Travel
            </Button>
            <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0" onClick={() => setActivePage("approvals")}>
              <CheckSquare className="w-4 h-4 mr-1" /> Review Approvals ({pendingApprovals})
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: "Total Bookings", value: bookings.length, icon: CalendarCheck, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Spend", value: fmtNative(totalSpent), icon: DollarSign, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
          { label: "Active Trips", value: activeTrips, icon: Plane, color: "text-accent", bg: "bg-accent/10" },
          { label: "Pending Approvals", value: pendingApprovals, icon: Clock, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning))]/10" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="hover:shadow-md transition-shadow border-border/50">
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick actions + Recent bookings */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Quick Actions</h3>
          {[
            { label: "Book Employee Travel", icon: Plane, action: () => navigate("/flights") },
            { label: "View Pending Approvals", icon: CheckSquare, action: () => setActivePage("approvals") },
            { label: "Cost Center Report", icon: PieChart, action: () => setActivePage("cost-center") },
            { label: "Manage Travelers", icon: UsersRound, action: () => setActivePage("travelers") },
          ].map((qa) => (
            <Card key={qa.label} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={qa.action}>
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <qa.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium flex-1">{qa.label}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Employee Bookings</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setActivePage("employee-bookings")}>
                  View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bookings.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No bookings yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {bookings.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        {b.type === "Flight" ? <Plane className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.title}</p>
                        <p className="text-xs text-muted-foreground">{b.booking_id}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${statusColors[b.status] || ""}`}>{b.status}</Badge>
                      <span className="text-sm font-semibold">{fmtBooking(b)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );

  // --- Employee Bookings ---
  const renderEmployeeBookings = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">Employee Bookings</h2>
          <p className="text-sm text-muted-foreground">{bookings.length} total bookings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-1" /> Filter</Button>
          <Button size="sm" onClick={() => navigate("/flights")}><Plane className="w-4 h-4 mr-1" /> New Booking</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase">Booking</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Amount</TableHead>
                <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                <TableHead className="text-xs font-semibold uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <p className="font-medium text-sm truncate max-w-[200px]">{b.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{b.booking_id}</p>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{b.type}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs ${statusColors[b.status] || ""}`}>{b.status}</Badge></TableCell>
                  <TableCell className="font-semibold">{fmtBooking(b)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(`/booking/ticket/${b.id}`, "_blank")}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );

  // --- Travel Policy ---
  const renderTravelPolicy = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-bold mb-1">Travel Policy</h2>
      <p className="text-sm text-muted-foreground mb-5">Set rules and limits for employee travel</p>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Budget Limits", desc: "Set per-trip and monthly budgets by department or role", icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
          { title: "Approved Airlines", desc: "Restrict bookings to preferred airline partners", icon: Plane, color: "text-accent", bg: "bg-accent/10" },
          { title: "Hotel Policies", desc: "Set max star rating and nightly rate limits", icon: Building2, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
          { title: "Approval Rules", desc: "Configure who needs to approve which bookings", icon: CheckSquare, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning))]/10" },
        ].map((p) => (
          <Card key={p.title} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center flex-shrink-0`}>
                <p.icon className={`w-5 h-5 ${p.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{p.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );

  // --- Approvals ---
  const renderApprovals = () => {
    const pending = bookings.filter(b => b.status === "Pending");
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl font-bold mb-1">Pending Approvals</h2>
        <p className="text-sm text-muted-foreground mb-5">{pending.length} booking{pending.length !== 1 ? "s" : ""} awaiting approval</p>
        {pending.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold mb-1">All Clear!</h3>
            <p className="text-sm text-muted-foreground">No pending approvals at this time.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {pending.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-[hsl(var(--warning))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.booking_id} · {new Date(b.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-semibold">{fmtBooking(b)}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs">Reject</Button>
                      <Button size="sm" className="h-8 text-xs">Approve</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  // --- Cost Center ---
  const renderCostCenter = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-bold mb-1">Cost Center Reporting</h2>
      <p className="text-sm text-muted-foreground mb-5">Track spend by department and cost center</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="p-5">
            <DollarSign className="w-5 h-5 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{fmtNative(totalSpent)}</p>
            <p className="text-xs opacity-80">Total Company Spend</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <Users className="w-5 h-5 mb-2 text-accent" />
            <p className="text-2xl font-bold">1</p>
            <p className="text-xs text-muted-foreground">Departments</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <TrendingUp className="w-5 h-5 mb-2 text-[hsl(var(--success))]" />
            <p className="text-2xl font-bold">{fmtNative(totalSpent / (bookings.length || 1))}</p>
            <p className="text-xs text-muted-foreground">Avg Cost / Booking</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <PieChart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">Department Breakdown</h3>
          <p className="text-sm text-muted-foreground">Detailed spend breakdown by department, project, and employee coming soon.</p>
        </CardContent>
      </Card>
    </motion.div>
  );

  // --- Travelers ---
  const renderTravelers = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">Traveler Profiles</h2>
          <p className="text-sm text-muted-foreground">Manage employee travel profiles</p>
        </div>
        <Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> Add Traveler</Button>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <UsersRound className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">Employee Travel Profiles</h3>
          <p className="text-sm text-muted-foreground">Store passport details, preferences, loyalty numbers, and department assignments.</p>
        </CardContent>
      </Card>
    </motion.div>
  );

  // --- Bulk Booking ---
  const renderBulkBooking = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-bold mb-1">Bulk Booking</h2>
      <p className="text-sm text-muted-foreground mb-5">Book travel for multiple employees at once</p>
      <Card>
        <CardContent className="py-12 text-center">
          <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-1">Group & Bulk Bookings</h3>
          <p className="text-sm text-muted-foreground mb-4">Book flights and hotels for teams, events, or conferences in one go.</p>
          <Button variant="outline" size="sm">Coming Soon</Button>
        </CardContent>
      </Card>
    </motion.div>
  );

  // --- Analytics ---
  const renderAnalytics = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-bold mb-1">Travel Analytics</h2>
      <p className="text-sm text-muted-foreground mb-5">Insights into your company's travel spending</p>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Spend Trends", desc: "Monthly and quarterly spend analysis", icon: TrendingUp },
          { title: "Savings Report", desc: "How much you saved vs market rates", icon: DollarSign },
          { title: "Top Destinations", desc: "Most visited cities and routes", icon: Globe },
          { title: "Policy Compliance", desc: "How well employees follow travel policies", icon: Shield },
        ].map((r) => (
          <Card key={r.title} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <r.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{r.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );

  // --- Profile ---
  const renderProfile = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-bold mb-1">Company Profile</h2>
      <p className="text-sm text-muted-foreground mb-6">Manage your company information</p>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label className="text-xs text-muted-foreground">Company Name</Label><Input value={profile.company_name} disabled className="mt-1 bg-muted/50" /></div>
            <div><Label className="text-xs text-muted-foreground">Admin Email</Label><Input value={profile.email} disabled className="mt-1 bg-muted/50" /></div>
            <div><Label className="text-xs text-muted-foreground">Primary Contact</Label><Input value={profile.full_name} disabled className="mt-1 bg-muted/50" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">Account Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b"><span className="text-sm text-muted-foreground">Account Type</span><Badge>Corporate</Badge></div>
            <div className="flex justify-between py-2 border-b"><span className="text-sm text-muted-foreground">Total Bookings</span><span className="text-sm font-medium">{bookings.length}</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-sm text-muted-foreground">Total Spend</span><span className="text-sm font-semibold">{fmtNative(totalSpent)}</span></div>
            <div className="flex justify-between py-2"><span className="text-sm text-muted-foreground">Since</span><span className="text-sm font-medium">{profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "N/A"}</span></div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activePage) {
      case "overview": return renderOverview();
      case "employee-bookings": return renderEmployeeBookings();
      case "travel-policy": return renderTravelPolicy();
      case "approvals": return renderApprovals();
      case "cost-center": return renderCostCenter();
      case "wallet": return <WalletSection userId={user!.id} balance={walletBalance} onBalanceChange={fetchData} />;
      case "travelers": return renderTravelers();
      case "bulk-booking": return renderBulkBooking();
      case "analytics": return renderAnalytics();
      case "profile": return renderProfile();
      case "support": return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold mb-1">Support</h2>
          <Card><CardContent className="py-12 text-center">
            <Headphones className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold mb-1">Corporate Support</h3>
            <p className="text-sm text-muted-foreground mb-4">Get dedicated support for your corporate account.</p>
            <Button variant="outline" size="sm">Contact Support</Button>
          </CardContent></Card>
        </motion.div>
      );
      default: return renderOverview();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex bg-background${isHybrid ? " hybrid-skin-active" : ""}`}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[270px] flex-shrink-0 border-r border-border flex-col sticky top-0 h-screen overflow-y-auto">
        {renderSidebar()}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9"><Menu className="w-5 h-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">{renderSidebar()}</SheetContent>
            </Sheet>
            <h1 className="text-sm font-semibold text-foreground hidden sm:block">Corporate Portal</h1>
          </div>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => navigate("/")}>
            <Globe className="w-3.5 h-3.5" /> Main Site
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default CorporateDashboard;
