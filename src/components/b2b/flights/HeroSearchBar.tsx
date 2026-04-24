import { Plane, ArrowLeftRight, Calendar, Users, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { B2BSearchContext } from "./types";

interface Props {
  ctx: B2BSearchContext;
  onModify?: () => void;
}

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
  } catch { return s; }
};

export const HeroSearchBar = ({ ctx, onModify }: Props) => (
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(220,55%,18%)] via-[hsl(220,60%,22%)] to-[hsl(225,55%,16%)] text-white shadow-[0_10px_30px_-10px_hsl(220,60%,15%/0.4)]">
    <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
      style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

    <div className="relative px-5 lg:px-7 py-5 flex items-center gap-4 lg:gap-6">
      <div className="hidden md:flex h-11 w-11 rounded-full bg-white/10 items-center justify-center shrink-0">
        <Plane className="h-5 w-5 -rotate-12" />
      </div>

      <div className="flex items-center gap-3 lg:gap-5 min-w-0">
        <div>
          <div className="text-2xl font-bold tracking-tight leading-none">{ctx.origin}</div>
          <div className="text-[11px] text-white/60 mt-1 font-medium">{ctx.originCity}</div>
        </div>
        <ArrowLeftRight className="h-4 w-4 text-white/50 shrink-0" />
        <div>
          <div className="text-2xl font-bold tracking-tight leading-none">{ctx.destination}</div>
          <div className="text-[11px] text-white/60 mt-1 font-medium">{ctx.destinationCity}</div>
        </div>
      </div>

      <div className="hidden md:block h-10 w-px bg-white/15" />

      <div className="hidden md:flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <Calendar className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-none">{fmtDate(ctx.departDate)}</div>
          {ctx.returnDate && <div className="text-[11px] text-white/60 mt-1 font-medium">→ {fmtDate(ctx.returnDate)}</div>}
        </div>
      </div>

      <div className="hidden lg:block h-10 w-px bg-white/15" />

      <div className="hidden lg:flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[14px] font-semibold leading-none">
            {ctx.adults + ctx.children + ctx.infants} Traveler{(ctx.adults + ctx.children + ctx.infants) > 1 ? "s" : ""}
          </div>
          <div className="text-[11px] text-white/60 mt-1 font-medium">{ctx.cabin}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <Button onClick={onModify} variant="outline"
          className="h-10 rounded-full bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white text-[13px] gap-2 px-4">
          <Pencil className="h-3.5 w-3.5" /> Modify Search
        </Button>
      </div>
    </div>
  </div>
);

export default HeroSearchBar;
