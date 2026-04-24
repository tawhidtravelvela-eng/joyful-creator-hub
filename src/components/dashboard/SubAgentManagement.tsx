import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  UserPlus, Wallet, Users, CheckCircle2, Loader2,
  ArrowUpRight, Send, Shield, CreditCard, Clock
} from "lucide-react";

interface SubAgent {
  user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  phone: string;
  is_approved: boolean;
  approval_status: string;
  created_at: string;
  credit_limit: number;
  wallet_balance: number;
}

interface SubAgentManagementProps {
  userId: string;
  walletBalance: number;
  onBalanceChange: () => void;
}

const SubAgentManagement = ({ userId, walletBalance, onBalanceChange }: SubAgentManagementProps) => {
  const { formatPrice } = useCurrency();
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundOpen, setFundOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SubAgent | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchSubAgents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("wallet-transfer", {
      body: { action: "list_sub_agents" },
    });
    if (data?.success) {
      setSubAgents(data.subAgents || []);
    } else {
      console.error("Failed to fetch sub-agents:", error || data?.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubAgents();
  }, [fetchSubAgents]);

  const handleFund = async () => {
    const amt = parseFloat(fundAmount);
    if (!amt || amt <= 0 || !selectedAgent) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > walletBalance) {
      toast.error("Insufficient wallet balance");
      return;
    }
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke("wallet-transfer", {
      body: { action: "fund_sub_agent", subAgentUserId: selectedAgent.user_id, amount: amt },
    });
    if (data?.success) {
      toast.success(`${formatPrice(amt)} funded to ${selectedAgent.full_name || selectedAgent.email}`);
      setFundOpen(false);
      setFundAmount("");
      setSelectedAgent(null);
      onBalanceChange();
      fetchSubAgents();
    } else {
      toast.error(data?.error || error?.message || "Transfer failed");
    }
    setProcessing(false);
  };

  const handleSetCreditLimit = async () => {
    const limit = parseFloat(creditLimit);
    if (isNaN(limit) || limit < 0 || !selectedAgent) {
      toast.error("Enter a valid credit limit");
      return;
    }
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke("wallet-transfer", {
      body: { action: "set_credit_limit", subAgentUserId: selectedAgent.user_id, creditLimit: limit },
    });
    if (data?.success) {
      toast.success("Credit limit updated");
      setCreditOpen(false);
      setCreditLimit("");
      setSelectedAgent(null);
      fetchSubAgents();
    } else {
      toast.error(data?.error || error?.message || "Failed to update");
    }
    setProcessing(false);
  };

  const handleApprove = async (sa: SubAgent) => {
    const { data, error } = await supabase.functions.invoke("wallet-transfer", {
      body: { action: "approve_sub_agent", subAgentUserId: sa.user_id },
    });
    if (data?.success) {
      toast.success(`${sa.full_name || sa.email} approved`);
      fetchSubAgents();
    } else {
      toast.error(data?.error || error?.message || "Approval failed");
    }
  };

  const openFundDialog = (sa: SubAgent) => {
    setSelectedAgent(sa);
    setFundAmount("");
    setFundOpen(true);
  };

  const openCreditDialog = (sa: SubAgent) => {
    setSelectedAgent(sa);
    setCreditLimit(String(sa.credit_limit || 0));
    setCreditOpen(true);
  };

  const pendingAgents = subAgents.filter(sa => !sa.is_approved || sa.approval_status === "pending");
  const activeAgents = subAgents.filter(sa => sa.is_approved && sa.approval_status !== "pending");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Sub-Agents</h2>
          <p className="text-sm text-muted-foreground">Manage your sub-agent network and fund their wallets</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <Wallet className="w-3 h-3" /> Your Balance: {formatPrice(walletBalance)}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Sub-Agents", value: subAgents.length, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: activeAgents.length, icon: CheckCircle2, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
          { label: "Pending Approval", value: pendingAgents.length, icon: Clock, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning))]/10" },
          { label: "Total Funded", value: formatPrice(subAgents.reduce((s, a) => s + a.wallet_balance, 0)), icon: ArrowUpRight, color: "text-accent", bg: "bg-accent/10" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-2`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending approvals */}
      {pendingAgents.length > 0 && (
        <Card className="mb-6 border-[hsl(var(--warning))]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[hsl(var(--warning))]" /> Pending Approvals ({pendingAgents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {pendingAgents.map((sa) => (
                <div key={sa.user_id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-[hsl(var(--warning))]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sa.full_name || sa.email}</p>
                    <p className="text-xs text-muted-foreground">{sa.company_name || sa.email}</p>
                  </div>
                  <Button size="sm" onClick={() => handleApprove(sa)}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active sub-agents table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Sub-Agents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          ) : activeAgents.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-1">No Sub-Agents Yet</h3>
              <p className="text-sm text-muted-foreground">Sub-agents will appear here once they sign up on your white-label site.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase">Name</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Email</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Balance</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Credit Limit</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Joined</TableHead>
                      <TableHead className="text-xs font-semibold uppercase text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAgents.map((sa) => (
                      <TableRow key={sa.user_id}>
                        <TableCell>
                          <p className="font-medium text-sm">{sa.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{sa.company_name}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sa.email}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-sm">{formatPrice(sa.wallet_balance)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{formatPrice(sa.credit_limit)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(sa.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openFundDialog(sa)}>
                              <Send className="w-3.5 h-3.5 mr-1" /> Fund
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openCreditDialog(sa)}>
                              <Shield className="w-3.5 h-3.5 mr-1" /> Credit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {activeAgents.map((sa) => (
                  <div key={sa.user_id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{sa.full_name || sa.email}</p>
                        <p className="text-xs text-muted-foreground">{sa.company_name}</p>
                      </div>
                      <span className="text-sm font-bold">{formatPrice(sa.wallet_balance)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openFundDialog(sa)}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Fund
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openCreditDialog(sa)}>
                        <Shield className="w-3.5 h-3.5 mr-1" /> Credit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Fund Dialog */}
      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" /> Fund Sub-Agent
            </DialogTitle>
            <DialogDescription>
              Transfer funds from your wallet to {selectedAgent?.full_name || selectedAgent?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Your Balance</span>
              <span className="text-sm font-bold">{formatPrice(walletBalance)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Sub-Agent Balance</span>
              <span className="text-sm font-bold">{formatPrice(selectedAgent?.wallet_balance || 0)}</span>
            </div>
            <div>
              <Label>Transfer Amount</Label>
              <Input
                type="number"
                min="1"
                step="any"
                placeholder="Enter amount"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="mt-1.5 text-lg font-semibold"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[50, 100, 250, 500, 1000].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant={fundAmount === String(amt) ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setFundAmount(String(amt))}
                >
                  {formatPrice(amt)}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundOpen(false)}>Cancel</Button>
            <Button onClick={handleFund} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Limit Dialog */}
      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Set Credit Limit
            </DialogTitle>
            <DialogDescription>
              Allow {selectedAgent?.full_name || selectedAgent?.email} to book beyond their wallet balance up to this limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Credit Limit</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0 = no credit"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="mt-1.5 text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Set to 0 to disable credit. Sub-agent can book up to wallet balance + credit limit.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)}>Cancel</Button>
            <Button onClick={handleSetCreditLimit} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SubAgentManagement;
