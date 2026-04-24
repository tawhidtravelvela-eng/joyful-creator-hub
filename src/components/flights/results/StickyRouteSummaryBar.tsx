import { Plane, ArrowRight, Bell, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  fromCode: string;
  fromCity?: string;
  toCode: string;
  toCity?: string;
  departLabel?: string;
  returnLabel?: string;
  travelers: number;
  cabinClass: string;
  onModify: () => void;
  onPriceAlert?: () => void;
  hasPriceAlert?: boolean;
}

/**
 * Dark-navy sticky route summary bar matching the enterprise reference design.
 * Layout: [Plane icon] DAC ⇄ LHR | Date range | Traveler info | Price Alerts | Modify Search
 */
export default function StickyRouteSummaryBar({
  fromCode, fromCity, toCode, toCity, departLabel, returnLabel,
  travelers, cabinClass, onModify, onPriceAlert, hasPriceAlert,
}: Props) {
  return (
    <div className="sticky top-16 z-30 bg-slate-900 dark:bg-slate-950 border-b border-slate-800 shadow-lg shadow-slate-900/20">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-slate-100">
          {/* Plane icon + route */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 ring-1 ring-primary/30">
              <Plane className="h-5 w-5 text-primary -rotate-45" />
            </div>
            <div className="flex items-center gap-3">
              <div className="leading-tight">
                <div className="text-base font-bold tabular-nums text-white">{fromCode}</div>
                {fromCity && <div className="text-[10px] text-slate-400 truncate max-w-[80px]">{fromCity}</div>}
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
              <div className="leading-tight">
                <div className="text-base font-bold tabular-nums text-white">{toCode}</div>
                {toCity && <div className="text-[10px] text-slate-400 truncate max-w-[80px]">{toCity}</div>}
              </div>
            </div>
          </div>

          {/* Date */}
          {(departLabel || returnLabel) && (
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="text-slate-200 font-medium whitespace-nowrap">
                {departLabel}
                {returnLabel && <span className="text-slate-500 mx-1.5">–</span>}
                {returnLabel}
              </span>
            </div>
          )}

          {/* Traveler + class */}
          <div className="hidden sm:flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            <div className="text-sm leading-tight">
              <div className="text-slate-200 font-medium">{travelers} Traveler{travelers !== 1 ? "s" : ""}</div>
              <div className="text-[10px] text-slate-400 capitalize">{cabinClass}</div>
            </div>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {onPriceAlert && (
              <button
                onClick={onPriceAlert}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors"
              >
                <Bell className={cn("h-3.5 w-3.5", hasPriceAlert ? "fill-warning/40 text-warning" : "text-slate-400")} />
                Price Alerts
              </button>
            )}
            <button
              onClick={onModify}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/30 transition-colors"
            >
              Modify Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
