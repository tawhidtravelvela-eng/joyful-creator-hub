import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, DollarSign, MousePointerClick, TrendingUp, Loader2,
  Search, CheckCircle, XCircle, Eye, Percent, Wallet, CreditCard,
  BarChart3, ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import WhitelabelCouponManagement from "@/components/dashboard/WhitelabelCouponManagement";
import WhitelabelSettingsCard from "@/components/admin/WhitelabelSettingsCard";

interface Affiliate {
  id: string;
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
  status: string;
  company_name: string;
  website_url: string;
  total_earnings: number;
  total_paid: number;
  wallet_balance: number;
  min_payout: number;
  base_currency: string;
  notes: string;
  created_at: string;
}

interface Conversion {
  id: string;
  affiliate_id: string;
  booking_amount: number;
  commission_rate: number;
  commission_amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface Payout {
  id: string;
  affiliate_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_reference: string;
  admin_notes: string;
  processed_at: string | null;
  created_at: string;
}

const AdminAffiliates = () => {
  const { user } = useAuth();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editRate, setEditRate] = useState("");
  const [editMinPayout, setEditMinPayout] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const { formatFromSource, convertFromSource, formatDirectPrice } = useCurrency();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [aff, conv, pay] = await Promise.all([
      supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
      supabase.from("affiliate_conversions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("affiliate_payouts").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setAffiliates((aff.data || []) as any);
    setConversions((conv.data || []) as any);
    setPayouts((pay.data || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("affiliates").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    toast({ title: `Affiliate ${status}` });
    fetchData();
  };

  const openEdit = (aff: Affiliate) => {
    setSelectedAffiliate(aff);
    setEditRate(String(aff.commission_rate));
    setEditMinPayout(String(aff.min_payout));
    setEditNotes(aff.notes || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedAffiliate) return;
    await supabase.from("affiliates").update({
      commission_rate: Number(editRate),
      min_payout: Number(editMinPayout),
      notes: editNotes,
      updated_at: new Date().toISOString(),
    }).eq("id", selectedAffiliate.id);
    toast({ title: "Affiliate updated" });
    setEditOpen(false);
    fetchData();
  };

  const processPayoutAction = async (payoutId: string, action: "approved" | "rejected") => {
    const payout = payouts.find(p => p.id === payoutId);
    if (!payout) return;

    if (action === "approved") {
      // Credit to affiliate wallet balance is handled conceptually
      await supabase.from("affiliate_payouts").update({
        status: "completed",
        processed_at: new Date().toISOString(),
      }).eq("id", payoutId);

      // Deduct from affiliate wallet balance
      const aff = affiliates.find(a => a.id === payout.affiliate_id);
      if (aff) {
        await supabase.from("affiliates").update({
          wallet_balance: Math.max(0, aff.wallet_balance - payout.amount),
          total_paid: aff.total_paid + payout.amount,
          updated_at: new Date().toISOString(),
        }).eq("id", aff.id);
      }
    } else {
      await supabase.from("affiliate_payouts").update({
        status: "rejected",
        processed_at: new Date().toISOString(),
      }).eq("id", payoutId);
    }

    toast({ title: `Payout ${action}` });
    fetchData();
  };

  const filtered = affiliates.filter(a => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return a.affiliate_code.toLowerCase().includes(s) || a.company_name.toLowerCase().includes(s);
    }
    return true;
  });

  const totalAffiliates = affiliates.length;
  const activeAffiliates = affiliates.filter(a => a.status === "approved").length;
  // Normalize across each affiliate's base_currency / each payout's currency to the viewer's display currency
  const totalEarnings = affiliates.reduce(
    (s, a) => s + convertFromSource(Number(a.total_earnings) || 0, (a.base_currency || "USD").toUpperCase()),
    0,
  );
  const pendingPayouts = payouts
    .filter(p => p.status === "pending")
    .reduce((s, p) => s + convertFromSource(Number(p.amount) || 0, (p.currency || "USD").toUpperCase()), 0);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-[hsl(152,70%,42%/0.12)] text-[hsl(152,70%,42%)]",
      pending: "bg-[hsl(38,92%,50%/0.12)] text-[hsl(38,92%,50%)]",
      rejected: "bg-destructive/10 text-destructive",
      suspended: "bg-muted text-muted-foreground",
    };
    return map[status] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Affiliate Program</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage affiliates, commissions & payouts</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Affiliates", value: totalAffiliates, icon: Users, color: "hsl(205,100%,50%)" },
            { label: "Active Affiliates", value: activeAffiliates, icon: CheckCircle, color: "hsl(152,70%,42%)" },
            { label: "Total Commissions", value: formatDirectPrice(totalEarnings), icon: DollarSign, color: "hsl(280,70%,55%)" },
            { label: "Pending Payouts", value: formatDirectPrice(pendingPayouts), icon: Wallet, color: "hsl(38,92%,50%)" },
          ].map(kpi => (
            <Card key={kpi.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="p-2 rounded-lg w-fit mb-2" style={{ background: `${kpi.color}15` }}>
                  <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="affiliates" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="affiliates" className="text-xs">Affiliates</TabsTrigger>
            <TabsTrigger value="conversions" className="text-xs">Conversions</TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs">Payouts</TabsTrigger>
            <TabsTrigger value="wl-coupons" className="text-xs">WL Coupons</TabsTrigger>
            <TabsTrigger value="wl-settings" className="text-xs">WL Settings</TabsTrigger>
          </TabsList>

          {/* Affiliates Tab */}
          <TabsContent value="affiliates" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search affiliates..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Code</TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Rate</TableHead>
                    <TableHead className="text-xs">Earnings</TableHead>
                    <TableHead className="text-xs">Balance</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(aff => (
                    <TableRow key={aff.id}>
                      <TableCell className="font-mono text-xs">{aff.affiliate_code}</TableCell>
                      <TableCell className="text-sm">{aff.company_name || "—"}</TableCell>
                      <TableCell className="text-sm">{aff.commission_rate}%</TableCell>
                      <TableCell className="text-sm font-medium">{formatFromSource(aff.total_earnings, aff.base_currency || "USD")}</TableCell>
                      <TableCell className="text-sm">{formatFromSource(aff.wallet_balance, aff.base_currency || "USD")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge(aff.status)}>{aff.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(aff)}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          {aff.status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-[hsl(152,70%,42%)]" onClick={() => updateStatus(aff.id, "approved")}>
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => updateStatus(aff.id, "rejected")}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {aff.status === "approved" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => updateStatus(aff.id, "suspended")}>
                              Suspend
                            </Button>
                          )}
                          {aff.status === "suspended" && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-[hsl(152,70%,42%)]" onClick={() => updateStatus(aff.id, "approved")}>
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No affiliates found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Conversions Tab */}
          <TabsContent value="conversions">
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Affiliate</TableHead>
                    <TableHead className="text-xs">Booking Amount</TableHead>
                    <TableHead className="text-xs">Rate</TableHead>
                    <TableHead className="text-xs">Commission</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversions.map(c => {
                    const aff = affiliates.find(a => a.id === c.affiliate_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">{aff?.affiliate_code || "—"}</TableCell>
                        <TableCell className="text-sm">{formatFromSource(c.booking_amount, c.currency || "USD")}</TableCell>
                        <TableCell className="text-sm">{c.commission_rate}%</TableCell>
                        <TableCell className="text-sm font-medium">{formatFromSource(c.commission_amount, c.currency || "USD")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(c.status)}>{c.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {conversions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No conversions yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Affiliate</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map(p => {
                    const aff = affiliates.find(a => a.id === p.affiliate_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">{aff?.affiliate_code || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{formatFromSource(p.amount, p.currency || "USD")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(p.status)}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{p.payment_reference || "—"}</TableCell>
                        <TableCell>
                          {p.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-[hsl(152,70%,42%)]" onClick={() => processPayoutAction(p.id, "approved")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => processPayoutAction(p.id, "rejected")}>
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {payouts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No payout requests</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* WL Coupons Tab */}
          <TabsContent value="wl-coupons">
            {user && <WhitelabelCouponManagement userId={user.id} mode="admin" />}
          </TabsContent>

          {/* WL Settings Tab */}
          <TabsContent value="wl-settings">
            <WhitelabelSettingsCard />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Affiliate — {selectedAffiliate?.affiliate_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Commission Rate (%)</Label>
              <Input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} min={0} max={100} step={0.5} />
            </div>
            <div>
              <Label className="text-xs">Minimum Payout</Label>
              <Input type="number" value={editMinPayout} onChange={e => setEditMinPayout(e.target.value)} min={0} />
            </div>
            <div>
              <Label className="text-xs">Admin Notes</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAffiliates;
