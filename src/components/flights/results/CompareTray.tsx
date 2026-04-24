import { GitCompare, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompareItem { id: string; airline: string; price: number; }

interface Props {
  items: CompareItem[];
  currencySymbol?: string;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCompare: () => void;
}

/**
 * Bottom sticky compare bar — dark navy / slate background w/ orange CTA.
 * Matches reference: "1 flight selected for comparison · Clear" + "Total Price" + "Compare Flights"
 */
export default function CompareTray({ items, currencySymbol = "$", onClear, onCompare }: Props) {
  if (items.length === 0) return null;

  const total = items.reduce((sum, it) => sum + it.price, 0);
  const canCompare = items.length >= 2;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-3xl">
      <div className={cn(
        "rounded-2xl shadow-2xl shadow-slate-900/30 px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4",
        "bg-slate-900 dark:bg-slate-950 text-slate-100 border border-slate-800"
      )}>
        {/* Icon + count */}
        <div className="relative shrink-0">
          <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <Layers className="h-4 w-4 text-slate-300" />
          </div>
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {items.length}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-100 leading-tight">
            {items.length} flight{items.length !== 1 ? "s" : ""} selected for comparison
          </div>
          <button
            onClick={onClear}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Total */}
        <div className="hidden sm:block text-right shrink-0">
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Price</div>
          <div className="text-base font-bold tabular-nums text-slate-100">
            {currencySymbol}{Math.round(total).toLocaleString()}
          </div>
        </div>

        {/* Orange Compare button */}
        <button
          onClick={onCompare}
          disabled={!canCompare}
          className={cn(
            "shrink-0 rounded-xl px-4 sm:px-5 py-2.5 text-sm font-bold transition-all gap-2 inline-flex items-center",
            canCompare
              ? "bg-warning/50 hover:bg-warning text-white shadow-lg shadow-warning/50/30"
              : "bg-slate-700 text-slate-400 cursor-not-allowed"
          )}
        >
          <GitCompare className="h-4 w-4" />
          Compare Flights
        </button>
      </div>
    </div>
  );
}
