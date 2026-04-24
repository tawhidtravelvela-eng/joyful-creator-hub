import { cn } from "@/lib/utils";
import { Sparkles, TrendingDown, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SortMode = "best" | "cheapest" | "fastest";

interface SortPill {
  mode: SortMode;
  label: string;
  icon: LucideIcon;
  price?: string;
  meta?: string;
}

interface Props {
  active: SortMode;
  onChange: (m: SortMode) => void;
  pills: SortPill[];
  total: number;
  currencySymbol: string;
  middleSlot?: ReactNode;
}

export const SortPillRow = ({ active, onChange, pills, total, currencySymbol, middleSlot }: Props) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-card border border-border/60 rounded-xl px-4 py-3">
    <div className="min-w-0 shrink-0">
      <div className="text-[18px] font-bold text-foreground tracking-tight leading-none">
        {total.toLocaleString()} <span className="text-foreground/80 font-semibold">Flight{total !== 1 ? "s" : ""} Found</span>
      </div>
      <div className="text-[11.5px] text-muted-foreground mt-1.5">
        Sorted by{" "}
        <span className="font-semibold text-primary">{pills.find(p => p.mode === active)?.label}</span>
      </div>
    </div>

    {middleSlot && (
      <div className="hidden md:flex items-center min-w-0 flex-1 px-2">
        {middleSlot}
      </div>
    )}

    <div className="flex items-stretch gap-1.5 ml-auto overflow-x-auto pb-0.5 shrink-0">
      {pills.map(p => {
        const Icon = p.icon;
        const isActive = p.mode === active;
        return (
          <button
            key={p.mode}
            onClick={() => onChange(p.mode)}
            className={cn(
              "min-w-[148px] px-3 py-2 rounded-xl border text-left transition-all relative group",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.4)]"
                : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-tight uppercase">
              <Icon className="h-3 w-3" /> {p.label}
            </div>
            {p.price && (
              <div className={cn("text-[14px] font-extrabold tabular-nums mt-1 leading-none",
                isActive ? "text-primary-foreground" : "text-foreground")}>
                {currencySymbol}{p.price}
                {p.meta && <span className={cn("text-[11px] font-semibold ml-1",
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>· {p.meta}</span>}
              </div>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export function buildDefaultPills(opts: {
  cheapestPrice: number;
  cheapestDuration: string;
  fastestPrice: number;
  fastestDuration: string;
  bestPrice: number;
  bestDuration: string;
}): SortPill[] {
  const fmt = (n: number) => n.toLocaleString();
  return [
    { mode: "best",      label: "Best Match", icon: Sparkles,    price: fmt(opts.bestPrice),    meta: opts.bestDuration },
    { mode: "cheapest",  label: "Cheapest",   icon: TrendingDown,price: fmt(opts.cheapestPrice),meta: opts.cheapestDuration },
    { mode: "fastest",   label: "Fastest",    icon: Clock,       price: fmt(opts.fastestPrice), meta: opts.fastestDuration },
  ];
}

export default SortPillRow;
