import { Plane, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { B2BFareRow } from "./types";

interface Props {
  rows: B2BFareRow[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onCompare: () => void;
  currencySymbol: string;
}

export const StickyCompareBar = ({ rows, onRemove, onClear, onCompare, currencySymbol }: Props) => {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.sellFare, 0);
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(960px,calc(100%-2rem))]">
      <div className="bg-[hsl(220,55%,15%)] text-white rounded-2xl shadow-2xl shadow-black/20 px-4 py-3 flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <Plane className="h-4 w-4 -rotate-12" />
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-warning/50 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {rows.length}
          </span>
        </div>
        <div className="text-[13px] font-semibold whitespace-nowrap">
          {rows.length} flight{rows.length > 1 ? "s" : ""} selected for comparison
        </div>
        <button onClick={onClear} className="text-[12px] text-info hover:text-info font-semibold underline-offset-2 hover:underline">
          Clear
        </button>

        <div className="flex items-center gap-1.5 ml-2 overflow-x-auto">
          {rows.map(r => (
            <span key={r.id} className="hidden md:inline-flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-md text-[10.5px] font-mono whitespace-nowrap">
              {r.flightNumberSummary}
              <button onClick={() => onRemove(r.id)} className="text-white/60 hover:text-white">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-white/60 leading-none">Total Price</div>
            <div className="text-[15px] font-bold tabular-nums leading-tight">{currencySymbol}{total.toLocaleString()}</div>
          </div>
          <Button onClick={onCompare} disabled={rows.length < 2}
            className="bg-warning/50 hover:bg-warning text-white rounded-xl h-10 px-4 text-[13px] font-bold">
            Compare Flights
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StickyCompareBar;
