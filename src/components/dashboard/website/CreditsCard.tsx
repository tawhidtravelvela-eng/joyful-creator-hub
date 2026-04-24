import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Wallet, Sparkles, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  allowance: number;
  used: number;
  topup: number;
  periodEnd: Date | null;
  onTopup: () => void;
}

const PRESETS = [5, 10, 25, 50];

/**
 * Inline credits balance + one-click top-up. Calls tenant-ai-credit-topup
 * which debits the caller's wallet and credits the tenant pool 1:1 USD.
 */
export default function CreditsCard({ tenantId, allowance, used, topup, periodEnd, onTopup }: Props) {
  const [busy, setBusy] = useState<number | null>(null);
  const poolRemaining = Math.max(0, allowance - used);
  const totalAvailable = poolRemaining + topup;
  const usagePct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  const low = totalAvailable <= 1;

  async function handleTopup(amount: number) {
    setBusy(amount);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-ai-credit-topup", {
        body: { tenant_id: tenantId, amount_usd: amount },
      });
      // supabase.functions.invoke throws on non-2xx but the body still has our
      // structured payload (e.g. 402 → "Insufficient wallet balance"). Parse it
      // so the user sees the actionable message instead of a blank screen.
      if (error) {
        let friendly = error.message || "Top-up failed";
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.message) friendly = body.message;
            else if (body?.error) friendly = body.error;
          }
        } catch { /* ignore parse errors */ }
        toast.error(friendly);
        return;
      }
      if (data && data.success === false) {
        toast.error(data.message || data.error || "Top-up failed");
        return;
      }
      toast.success(`Added $${amount.toFixed(2)} in AI credits`);
      onTopup();
    } catch (e: any) {
      toast.error(e?.message || "Top-up failed — check wallet balance");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-accent/[0.04]">
      <div className="absolute -top-20 -left-20 w-56 h-56 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <CardContent className="relative p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <div className="font-semibold text-foreground">AI credits</div>
              <div className="text-xs text-muted-foreground">Used by Studio rewrites & auto-blog</div>
            </div>
          </div>
          {low && (
            <span className="text-[10px] uppercase tracking-wide font-semibold text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-2 py-0.5">
              Low
            </span>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-bold text-foreground tabular-nums">
              ${totalAvailable.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">available to spend</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Top-up balance</div>
            <div className="text-sm font-mono text-foreground tabular-nums">${topup.toFixed(2)}</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Plan pool used</span>
            <span className="font-mono tabular-nums">
              ${used.toFixed(2)} / ${allowance.toFixed(2)}
            </span>
          </div>
          <Progress value={usagePct} className="h-1.5" />
          {periodEnd && (
            <div className="text-[11px] text-muted-foreground mt-1.5">
              Resets {periodEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Top up instantly
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((amt) => (
              <Button
                key={amt}
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => handleTopup(amt)}
                className="h-9"
              >
                {busy === amt ? <Loader2 className="w-3 h-3 animate-spin" /> : `$${amt}`}
              </Button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <Wallet className="w-2.5 h-2.5" /> Charges your wallet · 1 USD = 1 credit
          </div>
        </div>
      </CardContent>
    </Card>
  );
}