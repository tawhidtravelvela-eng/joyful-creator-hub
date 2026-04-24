import { Sparkles, TrendingUp, TrendingDown, Calendar, Headphones, ShieldCheck, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import mascot from "@/assets/vela-ai-mascot.png";
import type { FlightInsight } from "./types";

interface Props {
  insight?: FlightInsight | null;
  loading?: boolean;
  currencySymbol?: string;
  recentSearches?: { from: string; to: string; date?: string; price?: number; thumb?: string }[];
  paymentOffers?: { title: string; subtitle?: string; logoUrl?: string; badge?: string }[];
  onChatClick?: () => void;
  onCheaperDateClick?: (date: string) => void;
  onRecentClick?: (idx: number) => void;
}

function Sparkline({ values, currency = "$" }: { values: number[]; currency?: string }) {
  if (!values || values.length < 2) {
    return (
      <div className="h-24 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-xs text-muted-foreground">
        Building price history…
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const w = 220, h = 70;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h * 0.85 - 6}`);
  const polyline = pts.join(" ");

  // Pick today's index = 0 by convention (first value)
  const todayIdx = 0;
  const todayX = todayIdx * step;
  const todayY = h - ((values[todayIdx] - min) / range) * h * 0.85 - 6;

  // Sample 3 labels under the chart
  const tDates = ["Today", `+${Math.floor(values.length / 2)}d`, `+${values.length - 1}d`];
  const tVals = [values[0], values[Math.floor(values.length / 2)], values[values.length - 1]];

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20 overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sparkFill3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.30" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points={`0,${h} ${polyline} ${w},${h}`} fill="url(#sparkFill3)" stroke="none" />
          <polyline points={polyline} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => {
            const [x, y] = p.split(",").map(Number);
            return <circle key={i} cx={x} cy={y} r={i === todayIdx ? 3.5 : 2} fill="hsl(var(--primary))" />;
          })}
        </svg>
        {/* "Today" pill above today's point */}
        <div
          className="absolute bg-slate-900 text-slate-100 text-[10px] font-bold rounded-md px-1.5 py-0.5 -translate-x-1/2 -translate-y-full shadow"
          style={{ left: `${(todayX / w) * 100}%`, top: `${(todayY / h) * 100}%`, marginTop: "-6px" }}
        >
          {currency}
          {Math.round(values[todayIdx]).toLocaleString()}
          <div className="text-[8px] font-medium opacity-75">Today</div>
        </div>
      </div>
      <div className="grid grid-cols-3 mt-2 text-[10px] text-center">
        {tDates.map((d, i) => (
          <div key={i}>
            <div className="text-muted-foreground font-medium">{d}</div>
            <div className="font-bold text-foreground tabular-nums">
              {currency}
              {Math.round(tVals[i] || 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VelaAIInsightsPanel({
  insight, loading, currencySymbol = "$",
  onChatClick, onCheaperDateClick,
}: Props) {
  return (
    <aside className="space-y-3 sticky top-32">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-foreground">Vela AI Insights</span>
          <span className="text-[9px] font-bold tracking-wider bg-primary/15 text-primary rounded px-1.5 py-0.5">BETA</span>
        </div>
      </div>

      {/* Smart Tip + Mascot */}
      {(insight?.recommendation || loading) && (
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/8 via-fuchsia-500/4 to-card p-3.5 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">Smart Tip</div>
              {loading ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="h-2.5 w-full bg-muted rounded" />
                  <div className="h-2.5 w-3/4 bg-muted rounded" />
                </div>
              ) : (
                <p className="text-[12.5px] text-foreground leading-snug">{insight?.recommendation}</p>
              )}
              {insight?.ai_pick_rationale && (
                <p className="text-[11px] text-muted-foreground mt-2 italic leading-snug">"{insight.ai_pick_rationale}"</p>
              )}
            </div>
            <img
              src={mascot}
              alt="Vela AI"
              className="h-16 w-16 object-contain shrink-0 -mr-1 -mb-1 drop-shadow-md"
              loading="lazy"
              width={64}
              height={64}
            />
          </div>
        </div>
      )}

      {/* Price Trend */}
      {insight?.trend_sparkline && insight.trend_sparkline.length >= 2 && (
        <div className="rounded-xl border border-border/60 bg-card p-3.5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">Price Trend</div>
            {insight.predicted_change_pct !== 0 && (
              <span className={cn(
                "text-[10px] font-bold inline-flex items-center gap-0.5",
                insight.predicted_change_pct > 0 ? "text-warning dark:text-warning0" : "text-success dark:text-success0"
              )}>
                {insight.predicted_change_pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {insight.predicted_change_pct > 0 ? "+" : ""}{insight.predicted_change_pct}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">7 Days Forecast</p>
          <Sparkline values={insight.trend_sparkline} currency={currencySymbol} />
          <p className="text-[10.5px] text-success dark:text-success0 font-semibold mt-2 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success/50" />
            {insight.trend_direction === "down" || insight.predicted_change_pct < 0
              ? "Prices dropping. Good time to book!"
              : insight.trend_direction === "up" || insight.predicted_change_pct > 0
              ? "Prices rising. Book soon."
              : "Prices stable. Good time to book!"}
          </p>
        </div>
      )}

      {/* Cheaper Dates */}
      {insight?.route_insight?.cheaper_dates && insight.route_insight.cheaper_dates.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">Cheaper Dates</div>
            <span className="text-[10px] text-muted-foreground">±3 days</span>
          </div>
          <div className="space-y-1.5">
            {insight.route_insight.cheaper_dates.slice(0, 3).map((d, i) => (
              <button
                key={i}
                onClick={() => onCheaperDateClick?.(d.date)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-success/5 dark:bg-success/50/10 hover:bg-success/10 dark:hover:bg-success/50/15 transition-colors text-left"
              >
                <Calendar className="h-3.5 w-3.5 text-success dark:text-success0 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] font-bold text-foreground">
                    {new Date(d.date).toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" })}
                  </div>
                  <div className="text-[10px] text-success dark:text-success font-semibold">
                    Save {Math.abs(d.delta_pct)}%
                  </div>
                </div>
                <div className="text-[12px] font-bold text-foreground tabular-nums">
                  {currencySymbol}{Math.round(d.price).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Urgency */}
      {insight?.urgency && insight.urgency.level !== "low" && (
        <div className={cn(
          "rounded-xl border p-3 flex items-center gap-2.5",
          insight.urgency.level === "high"
            ? "bg-danger/5 dark:bg-danger/50/10 border-danger/60 dark:border-danger/50/30"
            : "bg-warning/5 dark:bg-warning/50/10 border-warning/60 dark:border-warning/50/30"
        )}>
          <Flame className={cn(
            "h-4 w-4 shrink-0",
            insight.urgency.level === "high" ? "text-danger" : "text-warning"
          )} />
          <div className="text-[11.5px] font-semibold text-foreground">{insight.urgency.message}</div>
        </div>
      )}

      {/* Trusted by Travelers */}
      <div className="rounded-xl border border-border/60 bg-card p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">Trusted by Travelers</div>
        </div>
        <ul className="space-y-1.5 text-[11.5px] text-muted-foreground">
          {(insight?.trust_signals || [
            "Live fares from multiple GDS partners",
            "Fare verified before payment",
            "24/7 booking support",
          ]).map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-success mt-0.5 font-bold">✓</span>
              <span className="leading-snug">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Need Help — Chat with Vela AI */}
      {onChatClick && (
        <div className="rounded-xl border border-border/60 bg-primary/5 p-3.5">
          <div className="flex items-start gap-3 mb-2.5">
            <div className="flex-1">
              <div className="text-[12.5px] font-bold text-foreground">Need Help?</div>
              <div className="text-[10.5px] text-muted-foreground leading-snug mt-0.5">
                Our travel experts are here 24/7
              </div>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Headphones className="h-4 w-4 text-primary" />
            </div>
          </div>
          <button
            onClick={onChatClick}
            className="w-full text-center rounded-lg bg-card border border-border/70 hover:border-primary/40 py-2 text-[11.5px] font-bold text-primary transition-colors"
          >
            Chat Now
          </button>
        </div>
      )}
    </aside>
  );
}
