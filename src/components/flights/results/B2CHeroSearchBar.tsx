import { Plane, ArrowLeftRight, Calendar, Users, Bell, Pencil, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departDate: string;
  returnDate?: string;
  travelers: number;
  cabin: string;
  onModify?: () => void;
  onPriceAlerts?: () => void;
  modifyOpen?: boolean;
}

const fmtDate = (s: string) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
  } catch { return s; }
};

export const B2CHeroSearchBar = ({
  origin, originCity, destination, destinationCity,
  departDate, returnDate, travelers, cabin,
  onModify, onPriceAlerts, modifyOpen = false,
}: Props) => (
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(220,55%,18%)] via-[hsl(220,60%,22%)] to-[hsl(225,55%,16%)] text-white shadow-[0_10px_30px_-10px_hsl(220,60%,15%/0.4)]">
    <div
      className="absolute inset-0 opacity-[0.04] pointer-events-none"
      style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
    />

    <div className="relative px-4 sm:px-6 lg:px-7 py-4 lg:py-5 flex flex-wrap items-center gap-4 lg:gap-6">
      <div className="hidden md:flex h-11 w-11 rounded-full bg-white/10 items-center justify-center shrink-0">
        <Plane className="h-5 w-5 -rotate-12" />
      </div>

      <div className="flex items-center gap-3 lg:gap-5 min-w-0">
        <div>
          <div className="text-xl lg:text-2xl font-bold tracking-tight leading-none">{origin}</div>
          <div className="text-[11px] text-white/60 mt-1 font-medium">{originCity}</div>
        </div>
        <ArrowLeftRight className="h-4 w-4 text-white/50 shrink-0" />
        <div>
          <div className="text-xl lg:text-2xl font-bold tracking-tight leading-none">{destination}</div>
          <div className="text-[11px] text-white/60 mt-1 font-medium">{destinationCity}</div>
        </div>
      </div>

      <div className="hidden md:block h-10 w-px bg-white/15" />

      <div className="hidden md:flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <Calendar className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[13px] lg:text-[14px] font-semibold leading-none">{fmtDate(departDate)}</div>
          {returnDate && <div className="text-[11px] text-white/60 mt-1 font-medium">→ {fmtDate(returnDate)}</div>}
        </div>
      </div>

      <div className="hidden lg:block h-10 w-px bg-white/15" />

      <div className="hidden lg:flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-none">
            {travelers} Traveler{travelers > 1 ? "s" : ""}
          </div>
          <div className="text-[11px] text-white/60 mt-1 font-medium">{cabin}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {onPriceAlerts && (
          <Button
            onClick={onPriceAlerts}
            variant="outline"
            className="h-9 lg:h-10 rounded-full bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white text-[12px] lg:text-[13px] gap-2 px-3 lg:px-4"
          >
            <Bell className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Price Alerts</span>
          </Button>
        )}
        <Button
          onClick={onModify}
          aria-expanded={modifyOpen}
          className={cn(
            "h-9 lg:h-10 rounded-full text-[12px] lg:text-[13px] gap-2 px-3 lg:px-4 font-bold transition-all",
            modifyOpen
              ? "bg-white/15 text-white hover:bg-white/20 ring-1 ring-white/30"
              : "bg-white text-[hsl(220,55%,18%)] hover:bg-white/90"
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>{modifyOpen ? "Close" : "Modify Search"}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", modifyOpen && "rotate-180")} />
        </Button>
      </div>
    </div>
  </div>
);

export default B2CHeroSearchBar;
