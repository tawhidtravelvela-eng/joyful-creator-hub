import { Plane, ArrowLeftRight, Calendar, Users, Pencil, ChevronDown, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HybridLeg {
  from: string;
  fromCity?: string;
  to: string;
  toCity?: string;
  date: string;
}

interface Props {
  /** "round" or "one" or "multi" */
  tripType: "one-way" | "round-trip" | "multi-city";
  /** Used for one-way / round-trip */
  origin?: string;
  originCity?: string;
  destination?: string;
  destinationCity?: string;
  departDate?: string;
  returnDate?: string;
  /** Used for multi-city */
  legs?: HybridLeg[];
  travelers: number;
  cabin: string;
  onModify?: () => void;
  modifyOpen?: boolean;
}

const fmtDate = (s?: string) => {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
  } catch { return s; }
};

/**
 * Brand-aware Hybrid hero search bar shown above flight results.
 * Displays one-way, round-trip and multi-city itineraries in a single
 * editorial-styled summary strip wired through to a parent "modify" handler.
 */
export const HybridFlightHeroBar = ({
  tripType,
  origin, originCity, destination, destinationCity,
  departDate, returnDate,
  legs,
  travelers, cabin,
  onModify, modifyOpen = false,
}: Props) => {
  const isMulti = tripType === "multi-city" && legs && legs.length > 0;
  const tripLabel =
    tripType === "multi-city" ? "Multi-city"
    : tripType === "round-trip" ? "Round trip"
    : "One way";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl text-white",
        "bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.92)] to-[hsl(var(--primary)/0.78)]",
        "shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.45)] ring-1 ring-white/10",
      )}
    >
      {/* editorial grid texture */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* warm corner glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[hsl(var(--accent)/0.35)] blur-3xl pointer-events-none" />

      <div className="relative px-4 sm:px-6 lg:px-7 py-4 lg:py-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* logo bubble + trip-type eyebrow */}
        <div className="hidden md:flex flex-col items-start shrink-0">
          <div className="h-11 w-11 rounded-full bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
            <Plane className="h-5 w-5 -rotate-12" />
          </div>
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">{tripLabel}</span>
          <span className="text-[11px] text-white/60 font-medium hidden sm:inline">
            {travelers} Traveler{travelers > 1 ? "s" : ""} · {cabin}
          </span>
        </div>

        <div className="hidden md:block h-10 w-px bg-white/15" />

        {/* Itinerary */}
        {isMulti ? (
          <div className="flex items-center gap-2 lg:gap-3 min-w-0 overflow-x-auto scrollbar-hover">
            {legs!.map((leg, i) => (
              <div key={i} className="flex items-center gap-2 lg:gap-3 shrink-0">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base lg:text-lg font-bold tracking-tight leading-none">{leg.from}</span>
                    <ChevronRight className="h-3 w-3 text-white/50" />
                    <span className="text-base lg:text-lg font-bold tracking-tight leading-none">{leg.to}</span>
                  </div>
                  <span className="text-[10px] text-white/60 mt-1 font-medium">{fmtDate(leg.date)}</span>
                </div>
                {i < legs!.length - 1 && (
                  <div className="h-6 w-px bg-white/15 mx-1" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 lg:gap-5 min-w-0">
              <div>
                <div className="text-xl lg:text-2xl font-bold tracking-tight leading-none">{origin}</div>
                <div className="text-[11px] text-white/60 mt-1 font-medium truncate max-w-[120px]">{originCity}</div>
              </div>
              <ArrowLeftRight className="h-4 w-4 text-white/50 shrink-0" />
              <div>
                <div className="text-xl lg:text-2xl font-bold tracking-tight leading-none">{destination}</div>
                <div className="text-[11px] text-white/60 mt-1 font-medium truncate max-w-[120px]">{destinationCity}</div>
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
          </>
        )}

        <div className="hidden lg:flex items-center gap-3 shrink-0 ml-2">
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
          <Button
            onClick={onModify}
            aria-expanded={modifyOpen}
            className={cn(
              "h-9 lg:h-10 rounded-full text-[12px] lg:text-[13px] gap-2 px-3 lg:px-4 font-bold transition-all",
              modifyOpen
                ? "bg-white/15 text-white hover:bg-white/20 ring-1 ring-white/30"
                : "bg-white text-[hsl(var(--primary))] hover:bg-white/90"
            )}
          >
            {modifyOpen ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            <span>{modifyOpen ? "Close" : "Modify"}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform hidden sm:inline", modifyOpen && "rotate-180")} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HybridFlightHeroBar;