import { Sparkles, TrendingDown, TrendingUp, Activity, Lightbulb, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlightInsight } from "./types";

interface Props {
  insight?: FlightInsight | null;
  loading?: boolean;
  currencySymbol?: string;
}

function Sparkline({ values, dates, currency = "$" }: { values: number[]; dates?: string[]; currency?: string }) {
  if (!values || values.length < 2) {
    return (
      <div className="h-20 rounded-xl border border-dashed border-border/60 flex items-center justify-center text-xs text-muted-foreground">
        Building price history…
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const w = 100, h = 36;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const trendUp = last >= first;
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Price trend</div>
        <div className={cn("text-[11px] font-semibold flex items-center gap-1", trendUp ? "text-warning" : "text-success")}>
          {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {currency}{Math.round(last)}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12 overflow-visible">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={`0,${h} ${pts} ${w},${h}`} fill="url(#sparkFill)" stroke="none" />
        <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{currency}{Math.round(min)}</span>
        <span>{currency}{Math.round(max)}</span>
      </div>
    </div>
  );
}

export default function AiInsightsPanel({ insight, loading, currencySymbol = "$" }: Props) {
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Vela AI Insights</div>
            <div className="text-[10px] text-muted-foreground">
              {insight?.source === "ai" ? "AI-generated" : insight?.source === "cache" ? "From cache" : "Heuristic"}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 w-3/4 bg-muted rounded" />
            <div className="h-2.5 w-full bg-muted/60 rounded" />
            <div className="h-20 bg-muted/40 rounded-xl mt-3" />
          </div>
        ) : insight ? (
          <>
            <p className="text-sm font-medium text-foreground leading-snug">{insight.headline}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.recommendation}</p>

            <div className="mt-3">
              <Sparkline values={insight.trend_sparkline} dates={insight.trend_dates} currency={currencySymbol} />
            </div>

            {insight.predicted_change_pct !== 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Forecast next 7 days:</span>
                <span className={cn("font-semibold", insight.predicted_change_pct > 0 ? "text-warning" : "text-success")}>
                  {insight.predicted_change_pct > 0 ? "+" : ""}
                  {insight.predicted_change_pct}%
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Insights will appear once results load.</p>
        )}
      </div>

      {insight?.ai_pick_rationale && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-warning0" />
            <div className="text-sm font-semibold text-foreground">Why AI Pick</div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{insight.ai_pick_rationale}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <div className="text-sm font-semibold text-foreground">Trusted by Travelers</div>
        </div>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• Live fares from multiple GDS partners</li>
          <li>• Verified before payment</li>
          <li>• 24/7 booking support</li>
        </ul>
      </div>
    </aside>
  );
}
