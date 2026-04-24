import { TrendingDown, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlightInsight } from "./types";

interface Props {
  insight?: FlightInsight | null;
  loading?: boolean;
  seatsLeft?: number;
}

/**
 * Reference urgency insights row (3 horizontal cards in one bordered container):
 * ┌──────────────────────┬──────────────────────┬──────────────────────┐
 * │ ↗ Prices are 12% low │ 📅 Book Now, Prices  │ 🔥 Only 2 seats left│
 * │   than usual         │   May Rise           │   at this price      │
 * └──────────────────────┴──────────────────────┴──────────────────────┘
 */
export default function SmartInsightsRow({ insight, loading, seatsLeft }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-2/3 bg-muted rounded" />
                <div className="h-2 w-full bg-muted/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pctLower = insight?.predicted_change_pct && insight.predicted_change_pct < 0
    ? Math.abs(insight.predicted_change_pct)
    : 12;
  const trendUp = (insight?.predicted_change_pct ?? 0) > 0;

  const cards = [
    {
      icon: <TrendingDown className="h-4 w-4" />,
      iconBg: "bg-success/10 dark:bg-success/50/15",
      iconColor: "text-success dark:text-success",
      titleColor: "text-success dark:text-success",
      title: trendUp ? `Prices are ${insight?.predicted_change_pct}% higher` : `Prices are ${pctLower}% lower`,
      sub: trendUp ? "than usual for your route" : "than usual for your route",
    },
    {
      icon: <Clock className="h-4 w-4" />,
      iconBg: "bg-violet-100 dark:bg-violet-500/15",
      iconColor: "text-violet-600 dark:text-violet-400",
      titleColor: "text-violet-700 dark:text-violet-400",
      title: "Book Now, Prices May Rise",
      sub: "Fares have trended up over the last 3 days",
    },
    {
      icon: <Flame className="h-4 w-4" />,
      iconBg: "bg-warning/10 dark:bg-warning/50/15",
      iconColor: "text-warning dark:text-warning",
      titleColor: "text-warning dark:text-warning",
      title: `Only ${seatsLeft ?? 2} seats left`,
      sub: "at this price",
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
        {cards.map((c, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 min-w-0">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", c.iconBg, c.iconColor)}>
              {c.icon}
            </div>
            <div className="min-w-0">
              <div className={cn("text-sm font-bold leading-tight truncate", c.titleColor)}>{c.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
