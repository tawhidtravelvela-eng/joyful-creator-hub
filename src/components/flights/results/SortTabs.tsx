import { Sparkles, TrendingDown, Zap, Sunrise, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortMode } from "./types";

const TABS: { key: SortMode; label: string; icon: any; subtitle?: string }[] = [
  { key: "best", label: "Best", icon: Trophy, subtitle: "Balanced" },
  { key: "cheapest", label: "Cheapest", icon: TrendingDown, subtitle: "Lowest price" },
  { key: "fastest", label: "Fastest", icon: Zap, subtitle: "Shortest" },
  { key: "earliest", label: "Earliest", icon: Sunrise, subtitle: "First out" },
  { key: "ai", label: "AI Pick", icon: Sparkles, subtitle: "Vela AI" },
];

interface Props {
  value: SortMode;
  onChange: (m: SortMode) => void;
  cheapestPrice?: string;
  fastestDuration?: string;
  earliestTime?: string;
}

export default function SortTabs({ value, onChange, cheapestPrice, fastestDuration, earliestTime }: Props) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-2 min-w-max">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = value === t.key;
          const meta =
            t.key === "cheapest" ? cheapestPrice :
            t.key === "fastest" ? fastestDuration :
            t.key === "earliest" ? earliestTime : undefined;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                "group relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all",
                "focus:outline-none focus:ring-2 focus:ring-primary/30",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card text-foreground border-border hover:border-primary/40 hover:shadow-sm"
              )}
            >
              <Icon className={cn("h-4 w-4", t.key === "ai" && active && "animate-pulse")} />
              <div className="text-left leading-tight">
                <div className="text-sm font-semibold">{t.label}</div>
                {(meta || t.subtitle) && (
                  <div className={cn("text-[10px] font-medium", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {meta || t.subtitle}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
