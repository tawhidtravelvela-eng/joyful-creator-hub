import { cn } from "@/lib/utils";
import type { SortMode } from "./types";

interface TabData {
  key: SortMode;
  label: string;
  price?: number;
  duration?: string;
  earliestTime?: string;
}

interface Props {
  tabs: TabData[];
  active: SortMode;
  onChange: (mode: SortMode) => void;
  hasAiPick?: boolean;
  currencySymbol?: string;
  /** @deprecated kept for backwards compat — no longer rendered */
  earliestTime?: string;
  /** @deprecated kept for backwards compat — no longer rendered */
  resultCount?: number;
}

/**
 * Premium sort pills row. Renders ONLY the pill buttons.
 * Result count + "Sort by" label belong to the parent header card.
 */
export default function PillSortTabs({
  tabs,
  active,
  onChange,
  currencySymbol = "$",
}: Props) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const sub = tab.earliestTime
          ? tab.earliestTime
          : tab.price !== undefined && tab.price > 0
          ? `${currencySymbol}${Math.round(tab.price).toLocaleString()}${
              tab.duration ? ` · ${tab.duration}` : ""
            }`
          : tab.duration || "";

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 transition-all duration-150 inline-flex items-center gap-1.5 border",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-foreground border-border/60 hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            <span
              className={cn(
                "text-[12px] font-bold tracking-tight",
                isActive ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {tab.label}
            </span>
            {sub && (
              <span
                className={cn(
                  "text-[11px] font-semibold tabular-nums",
                  isActive ? "text-primary-foreground/85" : "text-muted-foreground"
                )}
              >
                · {sub}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
