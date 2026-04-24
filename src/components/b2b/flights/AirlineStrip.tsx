import { useRef } from "react";
import { ChevronLeft, ChevronRight, Sparkles, TrendingDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AirlineChip {
  code: string;
  name: string;
  count: number;
  price: number;
  /** Optional badge tag derived from sort signals */
  tag?: "cheapest" | "best" | "fastest";
}

interface Props {
  airlines: AirlineChip[];
  selected: string[];
  onToggle: (code: string) => void;
  currencySymbol: string;
}

const BADGE_META: Record<NonNullable<AirlineChip["tag"]>, { label: string; icon: typeof Sparkles; cls: string }> = {
  cheapest: { label: "Cheapest", icon: TrendingDown, cls: "bg-success/50 text-white" },
  best:     { label: "Best",     icon: Sparkles,     cls: "bg-primary text-primary-foreground" },
  fastest:  { label: "Fastest",  icon: Clock,        cls: "bg-warning/50 text-white" },
};

export const AirlineStrip = ({ airlines, selected, onToggle, currencySymbol }: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (!airlines.length) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-1 min-w-0 flex-1">
      <button
        type="button"
        aria-label="Scroll airlines left"
        onClick={() => scrollBy(-1)}
        className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <div
        ref={scrollerRef}
        className="flex items-stretch gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0 snap-x scroll-smooth py-2"
        style={{ scrollbarWidth: "none" }}
      >
        {airlines.map((a) => {
          const isActive = selected.includes(a.code);
          const badge = a.tag ? BADGE_META[a.tag] : null;
          const BadgeIcon = badge?.icon;
          return (
            <button
              key={a.code}
              onClick={() => onToggle(a.code)}
              className={cn(
                "relative snap-start shrink-0 flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl border transition-all bg-card",
                isActive
                  ? "border-primary/60 ring-1 ring-primary/30 shadow-[0_2px_10px_-4px_hsl(var(--primary)/0.4)]"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              )}
            >
              {badge && BadgeIcon && (
                <span
                  className={cn(
                    "absolute -top-2 left-2 flex items-center gap-0.5 px-1.5 py-[1px] rounded-full text-[8.5px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap",
                    badge.cls
                  )}
                >
                  <BadgeIcon className="h-2.5 w-2.5" />
                  {badge.label}
                </span>
              )}
              <div className="h-10 w-10 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={`https://pics.avs.io/64/64/${a.code}.png`}
                  alt={a.name}
                  className="w-7 h-7 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="text-left leading-tight pr-1">
                <div className={cn(
                  "text-[12px] font-extrabold tracking-tight",
                  isActive ? "text-primary" : "text-foreground"
                )}>
                  {a.code}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {a.count} {a.count === 1 ? "Result" : "Results"}
                </div>
                <div className={cn(
                  "text-[10.5px] font-bold tabular-nums mt-0.5",
                  isActive ? "text-primary" : "text-foreground/85"
                )}>
                  {currencySymbol}{Math.round(a.price).toLocaleString()}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Scroll airlines right"
        onClick={() => scrollBy(1)}
        className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default AirlineStrip;