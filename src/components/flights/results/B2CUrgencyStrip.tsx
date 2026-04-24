import { TrendingDown, Sparkles, Flame } from "lucide-react";

interface Props {
  pricePctLower?: number; // e.g. 12 for "12% lower"
  bookNowMessage?: string;
  seatsLeft?: number;
}

export const B2CUrgencyStrip = ({
  pricePctLower = 12,
  bookNowMessage = "Fares have trended up over the last 3 days",
  seatsLeft = 2,
}: Props) => (
  <div className="bg-card border border-border/50 rounded-2xl p-3 sm:p-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Prices lower */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-success/10 dark:bg-success/50/15 flex items-center justify-center shrink-0">
          <TrendingDown className="h-4 w-4 text-success dark:text-success" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-foreground leading-tight">
            Prices are <span className="text-success dark:text-success">{pricePctLower}% lower</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">than usual for your route</div>
        </div>
      </div>

      {/* Book now */}
      <div className="flex items-center gap-2.5 md:border-l md:border-border/50 md:pl-4">
        <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-violet-700 dark:text-violet-400" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-foreground leading-tight">
            Book Now, Prices May Rise
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{bookNowMessage}</div>
        </div>
      </div>

      {/* Seats left */}
      <div className="flex items-center gap-2.5 md:border-l md:border-border/50 md:pl-4">
        <div className="h-9 w-9 rounded-full bg-danger/10 dark:bg-danger/50/15 flex items-center justify-center shrink-0">
          <Flame className="h-4 w-4 text-danger dark:text-danger" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight text-danger dark:text-danger">
            Only {seatsLeft} seat{seatsLeft > 1 ? "s" : ""} left
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">at this price</div>
        </div>
      </div>
    </div>
  </div>
);

export default B2CUrgencyStrip;
