import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Wallet, Plus, Minus, Search, Loader2, ArrowUpRight, ArrowDownRight,
  Users, RefreshCw, CheckCircle2, XCircle, Eye, Clock, ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminTenantFilter } from "@/hooks/useAdminTenantFilter";
import { toast } from "@/hooks/use-toast";

interface WalletTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  reference: string | null;
  status: string | null;
  receipt_url: string | null;
  created_at: string;
}

interface UserBalance {
  user_id: string;
  email: string | null;
  full_name: string | null;
  balance: number;
  currency: string;
  total_credits: number;
  total_debits: number;
  transaction_count: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", CNY: "¥", INR: "₹",
  AED: "د.إ", MYR: "RM", SGD: "S$", THB: "฿",
};

const fmtAmt = (amount: number, currency: string) => {
  const sym = CURRENCY_SYMBOLS[currency] || currency + " ";
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const WalletManagement = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { email: string | null; full_name: string | null; billing_currency: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustCurrency, setAdjustCurrency] = useState("BDT");
  const [adjustDescription, setAdjustDescription] = useState("");
  const [adjustReference, setAdjustReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTxId, setRejectTxId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const { adminTenantId } = useAdminTenantFilter();

  const fetchData = async () => {
    setLoading(true);
    const [txRes, profileRes] = await Promise.all([
      supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, email, full_name, billing_currency"),
    ]);

    setTransactions((txRes.data as WalletTransaction[]) || []);
    const profileMap: Record<string, { email: string | null; full_name: string | null; billing_currency: string | null }> = {};
    (profileRes.data || []).forEach((p: any) => {
      profileMap[p.user_id] = { email: p.email, full_name: p.full_name, billing_currency: p.billing_currency };
    });
    setProfiles(profileMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [adminTenantId]);

  // Pending transactions
  const pendingTransactions = useMemo(() =>
    transactions.filter(tx => tx.status === "pending"),
  [transactions]);

  // Compute user balances (only completed transactions count)
  const userBalances = useMemo(() => {
    const map: Record<string, UserBalance> = {};
    transactions.forEach((tx) => {
      if (tx.status !== "completed") return;
      if (!map[tx.user_id]) {
        const profile = profiles[tx.user_id];
        map[tx.user_id] = {
          user_id: tx.user_id,
          email: profile?.email || null,
          full_name: profile?.full_name || null,
          balance: 0,
          currency: tx.currency || "USD",
          total_credits: 0,
          total_debits: 0,
          transaction_count: 0,
        };
      }
      const entry = map[tx.user_id];
      entry.transaction_count++;
      const amt = Number(tx.amount);
      if (tx.type === "credit" || tx.type === "deposit" || tx.type === "refund") {
        entry.balance += amt;
        entry.total_credits += amt;
      } else {
        entry.balance -= Math.abs(amt);
        entry.total_debits += Math.abs(amt);
      }
    });
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [transactions, profiles]);

  // Summary stats
  const stats = useMemo(() => {
    const totalBalance = userBalances.reduce((s, u) => s + u.balance, 0);
    const totalCredits = userBalances.reduce((s, u) => s + u.total_credits, 0);
    const totalDebits = userBalances.reduce((s, u) => s + u.total_debits, 0);
    return { totalBalance, totalCredits, totalDebits, activeWallets: userBalances.filter(u => u.balance > 0).length, pendingCount: pendingTransactions.length };
  }, [userBalances, pendingTransactions]);

  // Filtered transactions (completed/rejected only for history)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.status === "pending") return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const profile = profiles[tx.user_id];
        return (
          tx.user_id.toLowerCase().includes(s) ||
          (tx.description || "").toLowerCase().includes(s) ||
          (tx.reference || "").toLowerCase().includes(s) ||
          (profile?.email || "").toLowerCase().includes(s) ||
          (profile?.full_name || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [transactions, typeFilter, searchTerm, profiles]);

  // Filtered balances
  const filteredBalances = useMemo(() => {
    if (!searchTerm) return userBalances;
    const s = searchTerm.toLowerCase();
    return userBalances.filter(u =>
      (u.email || "").toLowerCase().includes(s) ||
      (u.full_name || "").toLowerCase().includes(s) ||
      u.user_id.toLowerCase().includes(s)
    );
  }, [userBalances, searchTerm]);

  const handleAdjust = async () => {
    if (!adjustUserId || !adjustAmount || Number(adjustAmount) <= 0) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("wallet_transactions").insert({
      user_id: adjustUserId,
      type: adjustType,
      amount: Number(adjustAmount),
      currency: adjustCurrency,
      description: adjustDescription || `Admin ${adjustType}`,
      reference: adjustReference || null,
      status: "completed",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Wallet ${adjustType} of ${fmtAmt(Number(adjustAmount), adjustCurrency)} applied.` });
      setDialogOpen(false);
      setAdjustUserId("");
      setAdjustAmount("");
      setAdjustDescription("");
      setAdjustReference("");
      fetchData();
    }
    setSubmitting(false);
  };

  const handleApprove = async (txId: string) => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("approve_wallet_deposit", {
      p_transaction_id: txId,
      p_admin_note: approveNote || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data && !(data as any).success) {
      toast({ title: "Error", description: (data as any).error, variant: "destructive" });
    } else {
      toast({ title: "Approved!", description: "Deposit has been credited to the agent's wallet." });
      setApproveNote("");
      fetchData();
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    if (!rejectTxId) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("reject_wallet_deposit", {
      p_transaction_id: rejectTxId,
      p_reason: rejectReason || "Rejected by admin",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data && !(data as any).success) {
      toast({ title: "Error", description: (data as any).error, variant: "destructive" });
    } else {
      toast({ title: "Rejected", description: "Deposit request has been rejected." });
      setRejectDialogOpen(false);
      setRejectTxId("");
      setRejectReason("");
      fetchData();
    }
    setSubmitting(false);
  };

  const txTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      credit: "bg-[hsl(152,70%,42%/0.12)] text-[hsl(152,70%,42%)] border-[hsl(152,70%,42%/0.2)]",
      deposit: "bg-[hsl(152,70%,42%/0.12)] text-[hsl(152,70%,42%)] border-[hsl(152,70%,42%/0.2)]",
      refund: "bg-primary/10 text-primary border-primary/20",
      debit: "bg-destructive/10 text-destructive border-destructive/20",
      payment: "bg-[hsl(38,92%,50%/0.12)] text-[hsl(38,92%,50%)] border-[hsl(38,92%,50%/0.2)]",
    };
    return styles[type] || "bg-muted text-muted-foreground";
  };

  const statusBadge = (status: string | null) => {
    if (status === "completed") return "bg-[hsl(152,70%,42%/0.12)] text-[hsl(152,70%,42%)] border-[hsl(152,70%,42%/0.2)]";
    if (status === "pending") return "bg-[hsl(38,92%,50%/0.12)] text-[hsl(38,92%,50%)] border-[hsl(38,92%,50%/0.2)]";
    if (status === "rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Active Wallets", value: String(stats.activeWallets), icon: Users, color: "hsl(280, 70%, 55%)" },
          { label: "Pending Approvals", value: String(stats.pendingCount), icon: Clock, color: "hsl(38, 92%, 50%)" },
          { label: "Total Credits", value: String(stats.totalCredits.toLocaleString()), icon: ArrowUpRight, color: "hsl(152, 70%, 42%)" },
          { label: "Total Debits", value: String(stats.totalDebits.toLocaleString()), icon: ArrowDownRight, color: "hsl(0, 72%, 51%)" },
          { label: "Net Balance", value: String(stats.totalBalance.toLocaleString()), icon: Wallet, color: "hsl(205, 100%, 50%)" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border/50 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 rounded-lg" style={{ background: `${kpi.color}15` }}>
                  <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold text-foreground mt-0.5 tracking-tight">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by user, email, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adjust Wallet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manual Wallet Adjustment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "credit" | "debit")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (Add Funds)</SelectItem>
                    <SelectItem value="debit">Debit (Deduct Funds)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">User</Label>
                <Select value={adjustUserId} onValueChange={(uid) => {
                  setAdjustUserId(uid);
                  const p = profiles[uid];
                  if (p?.billing_currency) setAdjustCurrency(p.billing_currency);
                }}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select user..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(profiles).map(([uid, p]) => (
                      <SelectItem key={uid} value={uid}>
                        {p.full_name || p.email || uid.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={adjustCurrency} onValueChange={setAdjustCurrency}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["BDT", "USD", "EUR", "GBP", "INR", "AED", "MYR", "SGD", "THB", "CNY"].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea placeholder="Reason for adjustment..." value={adjustDescription} onChange={(e) => setAdjustDescription(e.target.value)} className="text-xs min-h-[60px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reference (optional)</Label>
                <Input placeholder="Invoice or booking reference" value={adjustReference} onChange={(e) => setAdjustReference(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="sm" className="text-xs">Cancel</Button>
              </DialogClose>
              <Button size="sm" onClick={handleAdjust} disabled={submitting} className={`text-xs gap-1.5 ${adjustType === "debit" ? "bg-destructive hover:bg-destructive/90" : ""}`}>
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {adjustType === "credit" ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                {adjustType === "credit" ? "Add Credit" : "Deduct"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs: Pending Approvals / Balances / History */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" /> Pending Approvals
            {pendingTransactions.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-[hsl(38,92%,50%)] text-white border-0">
                {pendingTransactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="balances" className="text-xs">User Balances</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">Transaction History</TabsTrigger>
        </TabsList>

        {/* Pending Approvals Tab */}
        <TabsContent value="pending">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Pending Top-Up Requests</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Review and approve or reject pending bank transfer deposits</p>
            </CardHeader>
            <CardContent className="p-0">
              {pendingTransactions.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {pendingTransactions.map((tx) => {
                    const profile = profiles[tx.user_id];
                    return (
                      <div key={tx.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-foreground">{profile?.full_name || "Unknown"}</p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-[hsl(38,92%,50%/0.12)] text-[hsl(38,92%,50%)] border-[hsl(38,92%,50%/0.2)]">
                                Pending
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{profile?.email || tx.user_id.slice(0, 12)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{tx.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(tx.created_at).toLocaleString()}
                              {tx.reference && <> · Ref: <span className="font-mono">{tx.reference}</span></>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-foreground">
                              {fmtAmt(tx.amount, tx.currency || "USD")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{tx.currency || "USD"}</p>
                          </div>
                        </div>
                        
                        {/* Receipt preview */}
                        {tx.receipt_url && (
                          <div className="mt-2">
                            <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={() => setReceiptPreview(tx.receipt_url)}>
                              <ImageIcon className="h-3 w-3" /> View Receipt
                            </Button>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex-1">
                            <Input
                              placeholder="Admin note (optional)..."
                              className="h-8 text-xs"
                              value={approveNote}
                              onChange={(e) => setApproveNote(e.target.value)}
                            />
                          </div>
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs h-8 bg-[hsl(152,70%,42%)] hover:bg-[hsl(152,70%,35%)]"
                            disabled={submitting}
                            onClick={() => handleApprove(tx.id)}
                          >
                            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8 text-destructive hover:bg-destructive/10"
                            disabled={submitting}
                            onClick={() => {
                              setRejectTxId(tx.id);
                              setRejectDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mb-3 text-[hsl(152,70%,42%)]" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs mt-1">No pending deposit requests to review.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Balances Tab */}
        <TabsContent value="balances">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">User Balances</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredBalances.length} users with wallet activity</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold">User</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Credits</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Debits</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Txns</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBalances.length > 0 ? filteredBalances.map((u) => (
                      <TableRow key={u.user_id} className="hover:bg-muted/20">
                        <TableCell>
                          <div>
                            <p className="text-xs font-medium text-foreground">{u.full_name || "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{u.email || u.user_id.slice(0, 12)}</p>
                          </div>
                        </TableCell>
                        <TableCell className={`text-xs font-bold text-right ${u.balance >= 0 ? "text-[hsl(152,70%,42%)]" : "text-destructive"}`}>
                          {fmtAmt(u.balance, u.currency)}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{fmtAmt(u.total_credits, u.currency)}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{fmtAmt(u.total_debits, u.currency)}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{u.transaction_count}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">No wallet users found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="history">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Transaction History</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{filteredTransactions.length} transactions</p>
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Filter type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold">Date</TableHead>
                      <TableHead className="text-xs font-semibold">User</TableHead>
                      <TableHead className="text-xs font-semibold">Type</TableHead>
                      <TableHead className="text-xs font-semibold">Description</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length > 0 ? filteredTransactions.slice(0, 100).map((tx) => {
                      const profile = profiles[tx.user_id];
                      const isCredit = tx.type === "credit" || tx.type === "deposit" || tx.type === "refund";
                      return (
                        <TableRow key={tx.id} className="hover:bg-muted/20">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-xs font-medium text-foreground">{profile?.full_name || "—"}</p>
                              <p className="text-[10px] text-muted-foreground">{profile?.email || tx.user_id.slice(0, 12)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${txTypeBadge(tx.type)}`}>
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {tx.description || "—"}
                          </TableCell>
                          <TableCell className={`text-xs font-semibold text-right ${isCredit ? "text-[hsl(152,70%,42%)]" : "text-destructive"}`}>
                            {isCredit ? "+" : "-"}{fmtAmt(Math.abs(tx.amount), tx.currency || "USD")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadge(tx.status)}`}>
                              {tx.status || "completed"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">No transactions found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filteredTransactions.length > 100 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t border-border/40">
                  Showing 100 of {filteredTransactions.length} transactions
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Deposit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Reason for rejection</Label>
            <Textarea
              placeholder="e.g. Receipt doesn't match amount, invalid transfer reference..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="text-xs">Cancel</Button>
            </DialogClose>
            <Button size="sm" variant="destructive" className="text-xs gap-1.5" disabled={submitting} onClick={handleReject}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <XCircle className="h-3.5 w-3.5" /> Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={!!receiptPreview} onOpenChange={() => setReceiptPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptPreview && (
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <img src={receiptPreview} alt="Receipt" className="w-full h-auto" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletManagement;
