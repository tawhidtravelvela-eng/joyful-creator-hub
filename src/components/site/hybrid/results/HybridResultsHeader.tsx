import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * HybridResultsHeader — editorial sort/results headline used at the top
 * of Hybrid skin Flights / Hotels / Tours results lists. Replaces the
 * platform's `bg-card border rounded-2xl` PillSortTabs container with a
 * glassmorphic editorial card carrying serif eyebrow + headline.
 */
interface SortTab<K extends string> {
  key: K;
  label: string;
  hint?: string; // optional secondary metric (e.g. "from $129", "1h 25m")
}

interface Props<K extends string> {
  eyebrow?: string;
  headline: string;
  meta?: string; // e.g. "84 flights from 6 airlines"
  tabs: SortTab<K>[];
  active: K;
  onChange: (k: K) => void;
  trailing?: ReactNode;
}

export function HybridResultsHeader<K extends string>({
  eyebrow = "Curated for you",
  headline,
  meta,
  tabs,
  active,
  onChange,
  trailing,
}: Props<K>) {
  return (
    <div
      className={cn(
        "relative rounded-3xl overflow-hidden",
        "bg-card/70 backdrop-blur-xl",
        "border border-border/40",
        "shadow-[0_2px_24px_-8px_hsl(var(--foreground)/0.08)]",
      )}
    >
      <div className="pointer-events-none absolute -top-20 right-10 w-60 h-60 rounded-full bg-[hsl(var(--primary)/0.08)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 w-60 h-60 rounded-full bg-[hsl(var(--accent)/0.06)] blur-3xl" />

      <div className="relative px-5 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80 mb-1.5">
              {eyebrow}
            </div>
            <h2
              className="text-[20px] sm:text-[22px] font-semibold text-foreground tracking-tight leading-tight"
              style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
            >
              {headline}
            </h2>
            {meta && <p className="text-[12px] text-muted-foreground mt-1">{meta}</p>}
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>

        {/* Sort segment */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={cn(
                  "group relative shrink-0 rounded-2xl border transition-all px-3.5 sm:px-4 py-2",
                  isActive
                    ? "border-primary/40 bg-primary/10 shadow-[0_6px_18px_-8px_hsl(var(--primary)/0.5)]"
                    : "border-border/50 bg-background/40 hover:border-primary/30 hover:bg-primary/5",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-[12.5px] font-semibold tracking-tight",
                      isActive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {t.label}
                  </span>
                  {t.hint && (
                    <span className={cn("text-[10.5px] tabular-nums", isActive ? "text-primary/80" : "text-muted-foreground")}>
                      {t.hint}
                    </span>
                  )}
                </div>
                {isActive && (
                  <div className="absolute -bottom-px left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HybridResultsHeader;
