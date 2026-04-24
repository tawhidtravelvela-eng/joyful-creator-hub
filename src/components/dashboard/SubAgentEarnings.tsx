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
  TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft,
  Loader2, DollarSign, ArrowRightLeft, PiggyBank
} from "lucide-react";

interface SubAgentEarningsProps {
  userId: string;
}

interface Earning {
  id: string;
  sub_agent_user_id: string;
  booking_id: string;
  base_cost: number;
  markup_amount: number;
  created_at: string;
}

const SubAgentEarnings = ({ userId }: SubAgentEarningsProps) => {
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalSubsidies, setTotalSubsidies] = useState(0);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("booking-settlement", {
      body: { action: "earnings_summary" },
    });
    if (data?.success) {
      setEarnings(data.earnings || []);
      const positiveEarnings = (data.earnings || [])
        .filter((e: any) => Number(e.markup_amount) > 0)
        .reduce((s: number, e: any) => s + Number(e.markup_amount), 0);
      const negativeSubsidies = (data.earnings || [])
        .filter((e: any) => Number(e.markup_amount) < 0)
        .reduce((s: number, e: any) => s + Math.abs(Number(e.markup_amount)), 0);
      setTotalEarnings(positiveEarnings);
      setTotalSubsidies(negativeSubsidies);
    } else {
      console.error("Failed to fetch earnings:", error || data?.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  const netEarnings = totalEarnings - totalSubsidies;

  const handleTransfer = async () => {
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > netEarnings) {
      toast.error("Amount exceeds available earnings");
      return;
    }
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke("booking-settlement", {
      body: { action: "transfer_earnings", amount: amt },
    });
    if (data?.success) {
      toast.success(`${formatPrice(amt)} transferred to main wallet`);
      setTransferOpen(false);
      setTransferAmount("");
      fetchEarnings();
    } else {
      toast.error(data?.error || error?.message || "Transfer failed");
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Sub-Agent Earnings</h2>
          <p className="text-sm text-muted-foreground">Track profits from your sub-agent network bookings</p>
        </div>
        <Button onClick={() => setTransferOpen(true)} disabled={netEarnings <= 0} size="sm">
          <ArrowRightLeft className="w-4 h-4 mr-1" /> Transfer to Wallet
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Earned", value: formatPrice(totalEarnings), icon: TrendingUp, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
          { label: "Subsidies Paid", value: formatPrice(totalSubsidies), icon: ArrowDownLeft, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Net Earnings", value: formatPrice(netEarnings), icon: PiggyBank, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Bookings", value: earnings.length, icon: DollarSign, color: "text-accent", bg: "bg-accent/10" },
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

      {/* Earnings table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Earnings Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {earnings.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-1">No Earnings Yet</h3>
              <p className="text-sm text-muted-foreground">Earnings will appear here when sub-agents make bookings.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase">Booking</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Base Cost</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Markup</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.booking_id}</TableCell>
                        <TableCell className="text-sm">{formatPrice(e.base_cost)}</TableCell>
                        <TableCell>
                          <Badge variant={e.markup_amount >= 0 ? "default" : "destructive"} className="text-xs">
                            {e.markup_amount >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownLeft className="w-3 h-3 mr-0.5" />}
                            {e.markup_amount >= 0 ? "+" : ""}{formatPrice(e.markup_amount)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.markup_amount >= 0 ? (
                            <span className="text-[hsl(var(--success))]">Profit</span>
                          ) : (
                            <span className="text-destructive">Subsidy</span>
                          )}
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
                  <div key={e.id} className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-muted-foreground truncate">{e.booking_id}</p>
                      <p className="text-sm">Base: {formatPrice(e.base_cost)}</p>
                    </div>
                    <Badge variant={e.markup_amount >= 0 ? "default" : "destructive"} className="text-xs">
                      {e.markup_amount >= 0 ? "+" : ""}{formatPrice(e.markup_amount)}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Transfer Earnings
            </DialogTitle>
            <DialogDescription>
              Move sub-agent earnings to your main wallet balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Available Earnings</span>
              <span className="text-sm font-bold">{formatPrice(netEarnings)}</span>
            </div>
            <div>
              <Label>Transfer Amount</Label>
              <Input
                type="number"
                min="1"
                step="any"
                max={netEarnings}
                placeholder="Enter amount"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="mt-1.5 text-lg font-semibold"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setTransferAmount(String(netEarnings))}
            >
              Transfer All ({formatPrice(netEarnings)})
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wallet className="w-4 h-4 mr-1" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SubAgentEarnings;
