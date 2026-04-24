import { Sparkles, TrendingDown, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlightInsight } from "./types";

interface Props {
  insight?: FlightInsight | null;
  loading?: boolean;
}

export default function FareInsightStrip({ insight, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 animate-pulse">
        <div className="h-9 w-9 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 bg-muted rounded" />
          <div className="h-2.5 w-2/3 bg-muted/60 rounded" />
        </div>
      </div>
    );
  }
  if (!insight) return null;

  const verdictTone =
    insight.price_verdict === "great_deal"
      ? "from-success/50/10 to-teal-500/5 border-success/50/30"
      : insight.price_verdict === "above_average"
      ? "from-warning/50/10 to-warning/50/5 border-warning/50/30"
      : "from-primary/10 to-primary/5 border-primary/30";

  const Icon =
    insight.price_verdict === "great_deal" ? TrendingDown :
    insight.price_verdict === "above_average" ? TrendingUp : Sparkles;

  return (
    <div className={cn(
      "rounded-2xl border bg-gradient-to-r p-4 sm:p-5",
      "shadow-sm transition-all hover:shadow-md",
      verdictTone
    )}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-10 w-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-border/50">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              {insight.headline}
            </h3>
            {insight.source === "ai" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-2.5 w-2.5" /> Vela AI
              </span>
            )}
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {insight.confidence} confidence
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{insight.recommendation}</p>
          {insight.fare_alerts?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {insight.fare_alerts.slice(0, 3).map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-background/80 border border-border/60 text-foreground">
                  <AlertCircle className="h-3 w-3" /> {a}
                </span>
              ))}
            </div>
          )}
        </div>
        {insight.best_book_window && (
          <div className="hidden sm:flex flex-col items-end shrink-0 px-3 py-1.5 rounded-xl bg-background/80 border border-border/60">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Best to book
            </span>
            <span className="text-sm font-semibold text-foreground capitalize">
              {insight.best_book_window}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
