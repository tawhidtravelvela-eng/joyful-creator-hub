import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Code, CheckCircle, Loader2, CreditCard, Tag, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  userId: string;
  walletBalance: number;
  onPurchased: () => void;
  /** Force a specific currency for pricing (overrides profile.billing_currency lookup) */
  forceCurrency?: string;
}

const DEFAULT_API_ACCESS_FEE = 3000;

const ApiAccessPurchaseGate = ({ userId, walletBalance, onPurchased, forceCurrency }: Props) => {
  const { toast } = useToast();
  const { formatFromSource, formatPrice } = useCurrency();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discount_percent: number; agent_id?: string } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [password, setPassword] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [price, setPrice] = useState(DEFAULT_API_ACCESS_FEE);
  const [priceCurrency, setPriceCurrency] = useState("USD");

  const discountPercent = appliedCoupon?.discount_percent || 0;
  const discountAmount = (price * discountPercent) / 100;
  const finalPrice = price - discountAmount;
  const fmtApiPrice = (amount: number) => formatFromSource(amount, priceCurrency);

  useEffect(() => {
    const check = async () => {
      const [purchaseRes, configRes, profileRes] = await Promise.all([
        supabase.from("whitelabel_purchases" as any).select("id").eq("user_id", userId).eq("product_type", "api_access").eq("status", "completed").maybeSingle(),
        supabase.functions.invoke("get-public-config"),
        supabase.from("profiles").select("billing_currency").eq("user_id", userId).maybeSingle(),
      ]);
      setHasPurchased(!!purchaseRes.data);

      const wlConfig = configRes.data?.whitelabel_config;
      const userCurrency = (forceCurrency || (profileRes.data as any)?.billing_currency || "USD").toUpperCase();
      const currencyFees = wlConfig?.api_access_currency_fees || {};

      if (currencyFees[userCurrency] != null) {
        setPrice(Number(currencyFees[userCurrency]));
        setPriceCurrency(userCurrency);
      } else {
        setPrice(Number(wlConfig?.api_access_fee ?? DEFAULT_API_ACCESS_FEE));
        setPriceCurrency(forceCurrency ? userCurrency : "USD");
      }

      setLoading(false);
    };
    check();
  }, [userId, forceCurrency]);

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    const { data, error } = await supabase
      .from("whitelabel_coupons" as any)
      .select("id, code, discount_percent, agent_id, product_type, max_uses, used_count")
      .eq("code", couponCode.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Invalid coupon code", variant: "destructive" });
      setAppliedCoupon(null);
    } else {
      const coupon = data as any;
      if (coupon.product_type !== "api_access" && coupon.product_type !== "both") {
        toast({ title: "This coupon is not valid for API access", variant: "destructive" });
        setAppliedCoupon(null);
      } else if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        toast({ title: "Coupon has been fully redeemed", variant: "destructive" });
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({ id: coupon.id, code: coupon.code, discount_percent: Number(coupon.discount_percent), agent_id: coupon.agent_id });
        toast({ title: `Coupon applied! ${coupon.discount_percent}% off` });
      }
    }
    setCouponValidating(false);
  };

  const handlePurchase = async () => {
    if (!password) return;
    setPurchasing(true);

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) {
      toast({ title: "Authentication error", variant: "destructive" });
      setPurchasing(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      toast({ title: "Incorrect password", variant: "destructive" });
      setPurchasing(false);
      return;
    }

    if (walletBalance < finalPrice) {
      toast({ title: "Insufficient wallet balance", description: `You need ${fmtApiPrice(finalPrice)} but have ${formatPrice(walletBalance)}.`, variant: "destructive" });
      setPurchasing(false);
      return;
    }

    // Deduct from wallet
    const { error: walletError } = await supabase.from("wallet_transactions").insert({
      user_id: userId,
      type: "debit",
      amount: finalPrice,
      currency: priceCurrency,
      description: `API access setup fee${appliedCoupon ? ` (coupon: ${appliedCoupon.code}, ${discountPercent}% off)` : ""} [${priceCurrency}]`,
      reference: "api_access_purchase",
      status: "completed",
      category: "api",
      actor_user_id: userData.user!.id,
    } as any);

    if (walletError) {
      toast({ title: "Payment failed", description: walletError.message, variant: "destructive" });
      setPurchasing(false);
      return;
    }

    const agentId = appliedCoupon?.agent_id || null;
    const agentCommissionPercent = agentId ? 25 - discountPercent : 0;
    const agentCommissionAmount = (price * agentCommissionPercent) / 100;

    // Record purchase (currency tracked via the linked wallet_transaction; purchases table has no currency column)
    const { error: purchaseError } = await supabase.from("whitelabel_purchases" as any).insert({
      user_id: userId,
      product_type: "api_access",
      base_price: price,
      coupon_id: appliedCoupon?.id || null,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      final_price: finalPrice,
      agent_commission_percent: agentCommissionPercent,
      agent_commission_amount: agentCommissionAmount,
      agent_id: agentId,
      status: "completed",
    });

    if (purchaseError) {
      await supabase.from("wallet_transactions").insert({
        user_id: userId, type: "credit", amount: finalPrice, currency: priceCurrency,
        description: `API access purchase auto-reversed (record failed: ${purchaseError.message}) [${priceCurrency}]`,
        reference: "api_access_reversal", status: "completed",
        category: "refund", actor_user_id: userData.user!.id,
      } as any);
      toast({ title: "Purchase could not be recorded", description: "Your wallet has been refunded. Please try again or contact support.", variant: "destructive" });
      setPurchasing(false);
      window.dispatchEvent(new Event("wallet:changed"));
      return;
    }

    // Credit agent commission
    if (agentId && agentCommissionAmount > 0) {
      await supabase.from("wallet_transactions").insert({
        user_id: agentId,
        type: "credit",
        amount: agentCommissionAmount,
        currency: priceCurrency,
        description: `API access commission (${agentCommissionPercent}%) from sub-agent purchase [${priceCurrency}]`,
        reference: "api_access_commission",
        status: "completed",
        category: "commission",
        actor_user_id: userData.user!.id,
      } as any);
    }

    // Increment coupon usage
    if (appliedCoupon) {
      await supabase.from("whitelabel_coupons" as any)
        .update({ used_count: (appliedCoupon as any).used_count ? (appliedCoupon as any).used_count + 1 : 1 } as any)
        .eq("id", appliedCoupon.id);
    }

    setHasPurchased(true);
    setShowDialog(false);
    setPassword("");
    setAppliedCoupon(null);
    setCouponCode("");
    toast({ title: "API Access purchased!", description: `${fmtApiPrice(finalPrice)} deducted from your wallet.` });
    setPurchasing(false);
    onPurchased();
    window.dispatchEvent(new Event("wallet:changed"));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasPurchased) return null;

  return (
    <>
      <Card className="border-border/50">
        <CardContent className="py-10 text-center space-y-5">
          <div className="mx-auto p-4 rounded-2xl bg-primary/10 w-fit">
            <Code className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">API Access Setup</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Integrate our booking engine into your systems with full REST API access.
            </p>
          </div>

          <div className="bg-muted/50 rounded-xl p-5 max-w-sm mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">One-time setup fee</span>
              <span className="text-2xl font-bold text-primary">{fmtApiPrice(price)}</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 text-left">
              <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Full REST API access</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Flight, hotel & tour search</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Booking management APIs</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" /> Dedicated API keys</li>
            </ul>
          </div>

          <Button size="lg" onClick={() => setShowDialog(true)} className="gap-2">
            <CreditCard className="h-4 w-4" /> Purchase API Access — {fmtApiPrice(price)}
          </Button>

          <p className="text-xs text-muted-foreground">Deducted from your wallet. Have a coupon? Apply at checkout.</p>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Purchase API Access
            </DialogTitle>
            <DialogDescription>Confirm your purchase with your account password.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Tag className="h-3 w-3" /> Coupon Code (optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  disabled={!!appliedCoupon}
                />
                {appliedCoupon ? (
                  <Button variant="outline" size="sm" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>Clear</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={validateCoupon} disabled={couponValidating || !couponCode.trim()}>
                    {couponValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                )}
              </div>
              {appliedCoupon && (
                <p className="text-xs text-primary font-medium">✓ {appliedCoupon.discount_percent}% discount applied</p>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Setup fee</span><span>{fmtApiPrice(price)}</span></div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-primary"><span>Discount ({discountPercent}%)</span><span>-{fmtApiPrice(discountAmount)}</span></div>
              )}
              <div className="flex justify-between font-bold border-t pt-1.5"><span>Total</span><span>{fmtApiPrice(finalPrice)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Wallet balance</span><span>{formatPrice(walletBalance)}</span></div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Account Password</Label>
              <Input
                type="password"
                placeholder="Enter your password to confirm"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handlePurchase} disabled={purchasing || !password || walletBalance < finalPrice}>
              {purchasing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
              Pay {fmtApiPrice(finalPrice)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApiAccessPurchaseGate;
