import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import {
  TrendingUp, DollarSign, Wallet, Loader2, BarChart3,
  Plane, Building2, Map, ArrowUpRight
} from "lucide-react";

interface WhitelabelEarningsProps {
  userId: string;
}

interface BookingEarning {
  id: string;
  booking_id: string;
  title: string;
  type: string;
  total: number;
  base_cost: number;
  markup_profit: number;
  created_at: string;
  status: string;
}

const WhitelabelEarnings = ({ userId }: WhitelabelEarningsProps) => {
  const { formatPrice } = useCurrency();
  const [earnings, setEarnings] = useState<BookingEarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, [userId]);

  const fetchEarnings = async () => {
    setLoading(true);
    // Fetch bookings made through white-label (tenant_id set = white-label booking)
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .not("tenant_id", "is", null)
      .order("created_at", { ascending: false });

    const mapped: BookingEarning[] = (data || []).map((b: any) => {
      // Estimate base cost as 95% of total (placeholder until real base cost tracking)
      const baseCost = b.total * 0.95;
      return {
        id: b.id,
        booking_id: b.booking_id,
        title: b.title,
        type: b.type,
        total: b.total,
        base_cost: baseCost,
        markup_profit: b.total - baseCost,
        created_at: b.created_at,
        status: b.status,
      };
    });

    setEarnings(mapped);
    setLoading(false);
  };

  const totalRevenue = earnings.reduce((s, e) => s + e.total, 0);
  const totalProfit = earnings.reduce((s, e) => s + e.markup_profit, 0);
  const totalBaseCost = earnings.reduce((s, e) => s + e.base_cost, 0);
  const avgMarkup = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0";
  const confirmedEarnings = earnings.filter(e => e.status === "Paid" || e.status === "Confirmed");

  const typeIcon = (type: string) => {
    if (type === "Flight") return <Plane className="w-4 h-4 text-primary" />;
    if (type === "Hotel") return <Building2 className="w-4 h-4 text-primary" />;
    return <Map className="w-4 h-4 text-primary" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-bold mb-1 text-foreground">White-Label Earnings</h2>
      <p className="text-sm text-muted-foreground mb-5">Track your markup profits from white-label bookings</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total Revenue",
            value: formatPrice(totalRevenue),
            icon: TrendingUp,
            color: "text-primary",
            bg: "bg-primary/10",
            desc: "Customer payments collected",
          },
          {
            label: "Base Cost",
            value: formatPrice(totalBaseCost),
            icon: Wallet,
            color: "text-[hsl(var(--warning))]",
            bg: "bg-[hsl(var(--warning))]/10",
            desc: "Deducted from wallet",
          },
          {
            label: "Your Profit",
            value: formatPrice(totalProfit),
            icon: DollarSign,
            color: "text-[hsl(var(--success))]",
            bg: "bg-[hsl(var(--success))]/10",
            desc: "Markup earnings kept",
          },
          {
            label: "Avg Markup",
            value: `${avgMarkup}%`,
            icon: BarChart3,
            color: "text-accent",
            bg: "bg-accent/10",
            desc: `${earnings.length} bookings`,
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Earnings table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-primary" /> Booking Earnings Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {earnings.length === 0 ? (
            <div className="py-16 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-1">No White-Label Bookings Yet</h3>
              <p className="text-sm text-muted-foreground">Earnings from your white-label site bookings will appear here.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase">Booking</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Customer Paid</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Base Cost</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Your Profit</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <p className="font-medium text-sm truncate max-w-[180px]">{e.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.booking_id}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {typeIcon(e.type)}
                            <span className="text-xs">{e.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{formatPrice(e.total)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatPrice(e.base_cost)}</TableCell>
                        <TableCell>
                          <span className="font-bold text-[hsl(var(--success))]">+{formatPrice(e.markup_profit)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${
                            e.status === "Paid" || e.status === "Confirmed"
                              ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
                              : e.status === "Pending"
                                ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                          }`}>
                            {e.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-border">
                {earnings.map((e) => (
                  <div key={e.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {typeIcon(e.type)}
                        <p className="text-sm font-medium truncate">{e.title}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Customer paid: {formatPrice(e.total)}</span>
                      <span className="font-bold text-[hsl(var(--success))]">+{formatPrice(e.markup_profit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default WhitelabelEarnings;
