/**
 * PlanBillingCard — current plan, expiry countdown, 1-click renew, change plan,
 * and subscription history. Uses the `subscribe_tenant_plan` RPC which already
 * debits the wallet (in the agent's billing currency), sets the new expiry,
 * and writes to tenant_plan_subscriptions.
 *
 * All prices shown here are resolved server-side through `get_plan_price`,
 * which honours per-currency overrides in `b2b_plan_prices` and falls back to
 * USD × live FX. Renewals are 50% of first-year (DB-enforced).
 */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  RefreshCw,
  ArrowUpRight,
  Check,
  Loader2,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Plan = {
  plan_key: string;
  display_name: string;
  description: string | null;
  badge_label: string | null;
  is_featured: boolean;
  sort_order: number;
  first_year_price_usd: number;
  renewal_price_usd: number;
  monthly_price_usd: number;
  allow_flights: boolean;
  allow_hotels: boolean;
  allow_tours: boolean;
  allow_transfers: boolean;
  allow_blog: boolean;
  allow_custom_domain: boolean;
  allow_remove_branding: boolean;
  max_pages: number;
};

type SubRow = {
  id: string;
  plan_key: string;
  billing_cycle: string;
  amount_usd: number;
  starts_at: string;
  expires_at: string;
  is_renewal: boolean;
  source: string;
  created_at: string;
  notes: string | null;
};

interface Props {
  tenantId: string;
  currentPlanKey: string | null;
  expiresAt: string | null;
  onChange: () => void;
}

export default function PlanBillingCard({
  tenantId,
  currentPlanKey,
  expiresAt,
  onChange,
}: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [history, setHistory] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState<string>("USD");
  // Map of `${plan_key}:${kind}` → { amount, currency, source }
  const [priceMap, setPriceMap] = useState<
    Record<string, { amount: number; currency: string; source: string }>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) Load plans + history + the caller's billing currency in parallel.
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      const [pRes, hRes, profRes] = await Promise.all([
        supabase
          .from("b2b_plans")
          .select(
            "plan_key, display_name, description, badge_label, is_featured, sort_order, first_year_price_usd, renewal_price_usd, monthly_price_usd, allow_flights, allow_hotels, allow_tours, allow_transfers, allow_blog, allow_custom_domain, allow_remove_branding, max_pages",
          )
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("tenant_plan_subscriptions")
          .select(
            "id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, is_renewal, source, created_at, notes",
          )
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(10),
        userId
          ? supabase
              .from("profiles")
              .select("billing_currency")
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (cancelled) return;
      const loadedPlans = (pRes.data as Plan[]) || [];
      const resolvedCurrency = (
        ((profRes as any)?.data?.billing_currency as string | null) || "USD"
      ).toUpperCase();
      setPlans(loadedPlans);
      setHistory((hRes.data as SubRow[]) || []);
      setCurrency(resolvedCurrency);

      // 2) Resolve every displayed price through the same RPC the backend
      //    uses to charge the wallet. This guarantees the number we show is
      //    the number the agent will be debited.
      const kinds: Array<"first_year" | "renewal"> = ["first_year", "renewal"];
      const priceCalls = loadedPlans.flatMap((p) =>
        kinds.map((k) =>
          (supabase as any)
            .rpc("get_plan_price", {
              p_plan_key: p.plan_key,
              p_currency: resolvedCurrency,
              p_price_kind: k,
            })
            .then((r: any) => ({ key: `${p.plan_key}:${k}`, data: r.data })),
        ),
      );
      const settled = await Promise.all(priceCalls);
      if (cancelled) return;
      const map: Record<string, { amount: number; currency: string; source: string }> = {};
      for (const { key, data } of settled) {
        if (data && typeof data === "object") {
          map[key] = {
            amount: Number((data as any).amount) || 0,
            currency: ((data as any).currency as string) || resolvedCurrency,
            source: ((data as any).source as string) || "usd",
          };
        }
      }
      setPriceMap(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const fmt = (amount: number, ccy: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: ccy,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${ccy} ${amount.toFixed(2)}`;
    }
  };
  const priceOf = (planKey: string, kind: "first_year" | "renewal") =>
    priceMap[`${planKey}:${kind}`] ?? null;

  const currentPlan = plans.find((p) => p.plan_key === currentPlanKey) || null;
  const expDate = expiresAt ? new Date(expiresAt) : null;
  const now = Date.now();
  const daysLeft = expDate
    ? Math.ceil((expDate.getTime() - now) / (24 * 60 * 60 * 1000))
    : null;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 14;
  // Hub access stays available for 7 days after expiry (hard-lock kicks in on day 8).
  // Booking modules (flights/hotels/tours) are gated immediately at expiry by
  // `get_tenant_modules`, so we surface that distinction in the status text.
  const daysSinceExpiry = isExpired ? Math.abs(daysLeft as number) : 0;
  const graceDaysLeft = isExpired ? Math.max(0, 7 - daysSinceExpiry) : 0;
  const isInGrace = isExpired && graceDaysLeft > 0;

  // Renewal is always 50% of first-year (DB-enforced). Show authoritative number
  // resolved through get_plan_price in the agent's billing currency.
  const renewalPrice = currentPlan
    ? priceOf(currentPlan.plan_key, "renewal")
    : null;
  const firstYearPrice = currentPlan
    ? priceOf(currentPlan.plan_key, "first_year")
    : null;

  const handleSubscribe = async (planKey: string) => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("subscribe_tenant_plan", {
        p_tenant_id: tenantId,
        p_plan_key: planKey,
        p_billing_cycle: "yearly",
        p_currency: currency,
      });
      if (error) throw error;
      const result = data as any;
      const charged = Number(result?.amount) || 0;
      const chargedCcy = (result?.currency as string) || currency;
      toast({
        title: result?.is_renewal ? "Plan renewed" : "Plan activated",
        description: charged > 0
          ? `Charged ${fmt(charged, chargedCcy)}. Active until ${new Date(result.expires_at).toLocaleDateString()}.`
          : `Active until ${new Date(result.expires_at).toLocaleDateString()}.`,
      });
      setConfirmPlan(null);
      setShowPicker(false);
      onChange();
    } catch (e: any) {
      toast({
        title: "Subscription failed",
        description: e.message || "Please check your wallet balance and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const statusColor = isExpired
    ? "text-destructive border-destructive/40 bg-destructive/5"
    : isExpiringSoon
      ? "text-warning border-warning/25 bg-warning/5 dark:text-warning dark:border-warning dark:bg-amber-950/30"
      : "text-success border-success/25 bg-success/5 dark:text-success dark:border-success dark:bg-emerald-950/30";

  const expProgress =
    currentPlan && expDate && currentPlan.first_year_price_usd > 0
      ? Math.max(0, Math.min(100, 100 - ((daysLeft || 0) / 365) * 100))
      : 0;

  return (
    <>
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border bg-gradient-to-br from-primary/[0.04] to-transparent">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">Plan & billing</span>
              </div>
              {currentPlan && (
                <Badge variant="secondary" className="text-xs">
                  {currentPlan.display_name}
                </Badge>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {!currentPlan ? (
              <div className="text-center py-6 space-y-3">
                <AlertTriangle className="w-8 h-8 text-warning0 mx-auto" />
                <div className="text-sm text-foreground font-medium">No active plan</div>
                <div className="text-xs text-muted-foreground">
                  Choose a plan to unlock your white-label site.
                </div>
                <Button onClick={() => setShowPicker(true)} className="mt-2">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Choose a plan
                </Button>
              </div>
            ) : (
              <>
                {/* Status row */}
                <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${statusColor}`}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <div className="text-sm font-medium">
                      {isExpired
                        ? isInGrace
                          ? `Grace period — ${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"} until hub lockout`
                          : "Plan expired — hub locked"
                        : daysLeft === null
                          ? "Active"
                          : `${daysLeft} days remaining`}
                    </div>
                  </div>
                  {expDate && (
                    <div className="text-xs font-mono tabular-nums opacity-80">
                      {expDate.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                </div>

                {!isExpired && expDate && currentPlan.first_year_price_usd > 0 && (
                  <Progress value={expProgress} className="h-1" />
                )}

                {/* Renewal pricing note */}
                {currentPlan.first_year_price_usd > 0 && renewalPrice && firstYearPrice && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    Renewal is{" "}
                    <span className="font-mono tabular-nums text-foreground font-semibold">
                      {fmt(renewalPrice.amount, renewalPrice.currency)}/year
                    </span>{" "}
                    — 50% of the first-year price (
                    <span className="line-through">
                      {fmt(firstYearPrice.amount, firstYearPrice.currency)}
                    </span>
                    ).
                    {renewalPrice.source === "fx_unavailable" && (
                      <span className="ml-1 text-warning dark:text-warning">
                        FX rate unavailable — shown in USD.
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={isExpired || isExpiringSoon ? "default" : "outline"}
                    onClick={() => setConfirmPlan(currentPlan)}
                    disabled={busy}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {isExpired ? "Renew now" : "Renew"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowPicker(true)}>
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Change plan
                  </Button>
                </div>
              </>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Subscription history
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground capitalize truncate">
                          {h.plan_key} · {h.is_renewal ? "renewal" : "new"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString()} · expires{" "}
                          {new Date(h.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="font-mono tabular-nums text-foreground shrink-0">
                        {h.amount_usd > 0
                          ? // History stores the charged amount + currency in `notes`
                            // ("Charged 1234.00 EUR"). Parse it back so old USD-only
                            // rows still render correctly.
                            (() => {
                              const m = h.notes?.match(/Charged\s+([\d.]+)\s+([A-Z]{3})/);
                              const amt = m ? Number(m[1]) : Number(h.amount_usd);
                              const ccy = m ? m[2] : "USD";
                              return fmt(amt, ccy);
                            })()
                          : "free"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Plan picker dialog ─────────────────────────── */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose your plan</DialogTitle>
            <DialogDescription>
              All plans are billed yearly in{" "}
              <span className="font-semibold text-foreground">{currency}</span>. Renewals
              are charged at 50% of the first-year price and debit your wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2">
            {plans.map((p) => {
              const isCurrent = p.plan_key === currentPlanKey;
              const willRenew = isCurrent && !!expDate && !isExpired;
              const fyPrice = priceOf(p.plan_key, "first_year");
              const renPrice = priceOf(p.plan_key, "renewal");
              const shown =
                willRenew && p.first_year_price_usd > 0 ? renPrice : fyPrice;
              return (
                <button
                  key={p.plan_key}
                  type="button"
                  onClick={() => setConfirmPlan(p)}
                  className={`text-left rounded-xl border p-4 transition-all hover:border-primary/60 hover:shadow-md ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : p.is_featured
                        ? "border-accent/40"
                        : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground">{p.display_name}</span>
                    {isCurrent ? (
                      <Badge variant="default" className="text-[10px]">
                        Current
                      </Badge>
                    ) : p.badge_label ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {p.badge_label}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mb-1">
                    <span className="text-2xl font-bold text-foreground">
                      {shown
                        ? fmt(shown.amount, shown.currency).replace(/\.00$/, "")
                        : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">/year</span>
                  </div>
                  {willRenew && p.first_year_price_usd > 0 && (
                    <div className="text-[10px] text-success dark:text-success mb-2">
                      Renewal price (50% off)
                    </div>
                  )}
                  {p.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  <ul className="space-y-1 text-xs">
                    <Feat on={p.allow_flights} label="Flights" />
                    <Feat on={p.allow_hotels} label="Hotels" />
                    <Feat on={p.allow_tours} label="Tours" />
                    <Feat on={p.allow_transfers} label="Transfers" />
                    <Feat on={p.allow_custom_domain} label="Custom domain" />
                    <Feat on={p.allow_blog} label="Blog & SEO" />
                    <Feat on={p.allow_remove_branding} label="Remove branding" />
                    <li className="text-muted-foreground pt-1">
                      Up to {p.max_pages} pages
                    </li>
                  </ul>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm dialog ─────────────────────────────── */}
      <Dialog open={!!confirmPlan} onOpenChange={(v) => !v && setConfirmPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmPlan?.plan_key === currentPlanKey ? "Confirm renewal" : "Confirm subscription"}
            </DialogTitle>
            <DialogDescription>
              {confirmPlan && (() => {
                const isRenewal =
                  confirmPlan.plan_key === currentPlanKey && !!expDate;
                const resolved = priceOf(
                  confirmPlan.plan_key,
                  isRenewal && confirmPlan.first_year_price_usd > 0
                    ? "renewal"
                    : "first_year",
                );
                const amount = resolved?.amount ?? 0;
                const ccy = resolved?.currency ?? currency;
                return (
                  <>
                    {isRenewal ? "Renew" : "Activate"}{" "}
                    <span className="font-semibold text-foreground">
                      {confirmPlan.display_name}
                    </span>{" "}
                    for{" "}
                    <span className="font-mono tabular-nums text-foreground font-semibold">
                      {fmt(amount, ccy)}
                    </span>
                    . This will be debited from your wallet immediately.
                    {resolved?.source === "fx_unavailable" && (
                      <div className="mt-2 text-xs text-warning dark:text-warning">
                        Live FX rate unavailable — amount shown and charged in USD.
                      </div>
                    )}
                    {isRenewal && expDate && expDate.getTime() > now && (
                      <div className="mt-2 text-xs">
                        Your new expiration date will be{" "}
                        <span className="font-medium">
                          {new Date(expDate.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                        </span>
                        .
                      </div>
                    )}
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPlan(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmPlan && handleSubscribe(confirmPlan.plan_key)}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Confirm & pay</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Feat({ on, label }: { on: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 ${on ? "text-foreground" : "text-muted-foreground/60 line-through"}`}
    >
      <Check
        className={`w-3 h-3 ${on ? "text-success0" : "text-muted-foreground/40"}`}
      />
      {label}
    </li>
  );
}