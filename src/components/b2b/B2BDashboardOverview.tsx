import { useMemo } from "react";
import { useB2B } from "@/contexts/B2BContext";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "./shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Wallet, Clock, Plane, Hotel, Map, TrendingUp, Ticket, Shield,
  ChevronRight, Sparkles, DollarSign, Headphones,
} from "lucide-react";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart,
} from "recharts";

export const B2BDashboardOverview = () => {
  const { profile, bookings, walletBalance, creditLimit, fmtNative, fmtBooking, setActivePage } = useB2B();
  const navigate = useNavigate();

  const pendingBookings = bookings.filter(b =>
    b.status === "Pending" || b.status === "Needs Payment" || b.status === "Awaiting Payment"
  );
  const confirmedBookings = bookings.filter(b => b.status === "Confirmed" || b.status === "Paid");
  const recentBookings = bookings.slice(0, 5);

  // Build chart data from real bookings — group by month
  const chartData = useMemo(() => {
    const months: Record<string, { revenue: number; bookings: number }> = {};
    const now = new Date();
    // Show last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-US", { month: "short" });
      months[key] = { revenue: 0, bookings: 0 };
    }
    bookings.forEach(b => {
      const d = new Date(b.created_at);
      const key = d.toLocaleDateString("en-US", { month: "short" });
      if (months[key]) {
        months[key].revenue += Number(b.total) || 0;
        months[key].bookings += 1;
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [bookings]);

  // Top destinations from real bookings
  const topDestinations = useMemo(() => {
    const destMap: Record<string, number> = {};
    bookings.forEach(b => {
      const dest = b.subtitle || b.type || "Other";
      destMap[dest] = (destMap[dest] || 0) + 1;
    });
    const colors = [
      "from-info/40 to-info/50",
      "from-warning/40 to-warning/50",
      "from-success/40 to-teal-500",
    ];
    return Object.entries(destMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count], i) => ({ name, count, color: colors[i % colors.length] }));
  }, [bookings]);

  const totalRevenue = bookings.reduce((s, b) => s + (Number(b.total) || 0), 0);

  const kpis = [
    { title: "Total Bookings", value: String(bookings.length), icon: Ticket },
    { title: "Total Revenue", value: fmtNative(totalRevenue), icon: DollarSign },
    { title: "Confirmed Trips", value: String(confirmedBookings.length), icon: Plane, action: () => setActivePage("bookings"), actionLabel: "View All" },
    { title: "Pending Actions", value: String(pendingBookings.length), icon: Headphones, badge: pendingBookings.length > 0 ? "Pending" : undefined, badgeColor: "text-warning bg-warning/5" },
  ];

  const agentTools = [
    { label: "Flight Search", icon: Plane, color: "bg-info/50", action: () => navigate("/flights") },
    { label: "Hotel Finder", icon: Hotel, color: "bg-teal-500", action: () => navigate("/hotels") },
    { label: "Tour Packages", icon: Map, color: "bg-success/50", action: () => navigate("/tours") },
    { label: "Wallet Deposit", icon: Wallet, color: "bg-violet-500", action: () => setActivePage("wallet") },
  ];

  return (
    <div className="space-y-5 max-w-[1440px]">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="bg-card rounded-2xl border border-border/50 p-5 hover:shadow-lg hover:shadow-primary/[0.03] transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground">{kpi.title}</span>
              <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center text-primary/60 group-hover:bg-primary/12 transition-colors">
                <kpi.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-2xl font-bold text-foreground tracking-tight">{kpi.value}</span>
              {kpi.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${kpi.badgeColor}`}>
                  {kpi.badge}
                </span>
              )}
              {kpi.actionLabel && (
                <button onClick={kpi.action} className="text-[10px] font-semibold text-primary/70 hover:text-primary bg-primary/8 px-2 py-0.5 rounded-full transition-colors">
                  {kpi.actionLabel}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Sales Overview + Top Destinations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sales Chart */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-foreground">Sales Overview</h3>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/70" /> Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-info/40" /> Bookings</span>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground) / 0.5)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground) / 0.4)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    boxShadow: '0 8px 30px -10px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number, name: string) => [
                    name === "revenue" ? fmtNative(value) : value,
                    name === "revenue" ? "Revenue" : "Bookings"
                  ]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary) / 0.65)" radius={[6, 6, 0, 0]} barSize={28} />
                <Line type="monotone" dataKey="bookings" stroke="hsl(210 100% 65%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(210 100% 65%)', strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/30">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Wallet Balance</p>
              <span className="text-lg font-bold text-foreground">{fmtNative(walletBalance)}</span>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Total Bookings</p>
              <span className="text-lg font-bold text-foreground">{bookings.length}</span>
            </div>
          </div>
        </div>

        {/* Top Destinations */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Top Destinations</h3>
          </div>
          {topDestinations.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 text-center py-10">No booking data yet</p>
          ) : (
            <div className="space-y-3">
              {topDestinations.map((dest, i) => (
                <div key={dest.name} className="relative overflow-hidden rounded-xl h-[70px] flex items-end p-3 group cursor-pointer hover:scale-[1.02] transition-transform">
                  <div className={`absolute inset-0 bg-gradient-to-br ${dest.color} opacity-90`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="relative z-10">
                    <p className="text-sm font-bold text-white">{dest.name}</p>
                    <p className="text-[10px] text-white/70">{dest.count} Booking{dest.count !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="absolute top-2.5 right-3 z-10 text-[10px] font-bold text-white/80 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Bookings + Agent Tools + Notifications ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent Bookings */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border/50">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="text-sm font-bold text-foreground">Recent Bookings</h3>
            {bookings.length > 5 && (
              <button className="text-[10px] text-primary/60 hover:text-primary font-semibold flex items-center gap-0.5" onClick={() => setActivePage("bookings")}>
                View all <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          {recentBookings.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5 text-primary/40" />
              </div>
              <h3 className="text-sm font-semibold text-foreground/70 mb-1">No bookings yet</h3>
              <p className="text-xs text-muted-foreground/50 mb-4">Start searching to create your first booking</p>
              <Button size="sm" className="gap-2 text-xs" onClick={() => navigate("/flights")}>
                <Plane className="w-3.5 h-3.5" /> Search Flights
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Booking", "Type", "Date", "Status", "Amount"].map((h, i) => (
                      <th key={h} className={`${i === 0 ? "pl-5" : "pl-3"} ${i === 4 ? "pr-5 text-right" : ""} py-2.5 text-[10px] font-semibold text-muted-foreground/50 text-left uppercase tracking-wide`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b, i) => (
                    <tr key={b.id}
                      className={`group hover:bg-muted/30 transition-colors cursor-pointer ${i < recentBookings.length - 1 ? "border-b border-border/20" : ""}`}
                      onClick={() => navigate(`/booking/ticket/${b.id}`)}
                    >
                      <td className="pl-5 py-3 font-medium text-foreground/80 max-w-[160px] truncate">{b.title}</td>
                      <td className="pl-3 py-3 text-muted-foreground/60 capitalize">{b.type}</td>
                      <td className="pl-3 py-3 text-muted-foreground/50">{new Date(b.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="pl-3 py-3"><StatusBadge status={b.status} type="booking" /></td>
                      <td className="pr-5 py-3 text-right font-mono font-semibold text-foreground/70 tabular-nums">{fmtBooking(b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Agent Tools + Notifications */}
        <div className="lg:col-span-2 space-y-4">
          {/* Agent Tools */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Agent Tools</h3>
            <div className="space-y-2.5">
              {agentTools.map((tool) => (
                <button
                  key={tool.label}
                  onClick={tool.action}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 hover:shadow-sm transition-all group"
                >
                  <div className={`w-9 h-9 rounded-xl ${tool.color} flex items-center justify-center text-white shadow-md`}>
                    <tool.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground/80 group-hover:text-foreground flex-1 text-left">{tool.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Notifications</h3>
            </div>
            {pendingBookings.length === 0 && confirmedBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 text-center py-4">No new notifications</p>
            ) : (
              <div className="space-y-3">
                {pendingBookings.slice(0, 2).map(b => (
                  <div key={b.id} className="flex items-start gap-2.5 cursor-pointer" onClick={() => setActivePage("bookings")}>
                    <div className="w-7 h-7 rounded-lg bg-warning/10 dark:bg-warning/50/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-3 h-3 text-warning" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground/80 truncate">Pending: {b.title}</p>
                      <p className="text-[10px] text-muted-foreground/40">{new Date(b.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {confirmedBookings.slice(0, 1).map(b => (
                  <div key={b.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-success/10 dark:bg-success/50/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield className="w-3 h-3 text-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground/80 truncate">Confirmed: {b.title}</p>
                      <p className="text-[10px] text-muted-foreground/40">{new Date(b.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
