import { Sparkles, Luggage, Briefcase, RefreshCw, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import AdvisorBlock from "./AdvisorBlock";
import type { AdvisorPayload } from "./types";

export interface B2CFlightCardProps {
  airlineCode: string;
  airlineName: string;
  flightNumber?: string;
  aircraft?: string;

  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  layoverSummary?: string; // e.g. "2h 10m DOH"

  baggageCheckin?: string;
  baggageCabin?: string;
  refundable: boolean;
  fareType?: string;

  price: string; // already formatted, e.g. "৳ 78,500"
  perTravelerLabel?: string;
  savings?: string; // already formatted

  isAiPick?: boolean;
  isCheapest?: boolean;
  isFastest?: boolean;

  aiRationale?: string;
  pickAdvisor?: AdvisorPayload;
  bookedTodayCount?: number;
  /** Real per-flight seats remaining. Only renders badge when > 0 and ≤ 4. */
  seatsLeft?: number;

  inCompare: boolean;
  onCompareToggle: (on: boolean) => void;
  onSelect: () => void;
  onViewDetails?: () => void;
}

export const B2CFlightCard = ({
  airlineCode, airlineName, flightNumber, aircraft,
  origin, destination, departureTime, arrivalTime, duration, stops, layoverSummary,
  baggageCheckin, baggageCabin, refundable, fareType,
  price, perTravelerLabel = "per traveler", savings,
  isAiPick, isCheapest, isFastest,
  aiRationale, bookedTodayCount, seatsLeft,
  inCompare, onCompareToggle, onSelect, onViewDetails,
}: B2CFlightCardProps) => {
  const stopLabel =
    stops === 0
      ? "Non-stop"
      : `${stops} Stop${stops > 1 ? "s" : ""}${layoverSummary ? ` · ${layoverSummary}` : ""}`;

  return (
    <article
      className={cn(
        "relative rounded-2xl bg-card overflow-hidden transition-all",
        "shadow-[0_1px_3px_-1px_hsl(var(--foreground)/0.05)] hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.18)]",
        isAiPick
          ? "border-2 border-primary ring-2 ring-primary/15"
          : "border border-border/50 hover:border-primary/30"
      )}
    >
      {isAiPick && (
        <div className="bg-gradient-to-r from-primary/[0.06] via-primary/[0.10] to-transparent border-b border-primary/15 px-4 py-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-primary uppercase tracking-wider bg-primary/15 px-2.5 py-1 rounded-md">
            <Sparkles className="h-3 w-3" /> AI Pick
          </span>
          <span className="text-[12px] font-semibold text-foreground">
            Recommended by Vela AI
          </span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-12 gap-4">
          {/* Left */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-3 min-w-0">
            {/* Airline header */}
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={`https://pics.avs.io/64/64/${airlineCode}.png`}
                  alt={airlineName}
                  className="w-8 h-8 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-bold text-foreground tracking-tight">
                    {airlineName}
                  </span>
                  {isCheapest && !isAiPick && (
                    <span className="text-[10px] font-bold text-warning dark:text-warning bg-warning/10 dark:bg-warning/50/15 px-2 py-0.5 rounded-md">
                      Cheapest
                    </span>
                  )}
                  {isFastest && !isAiPick && (
                    <span className="text-[10px] font-bold text-info dark:text-info bg-info/10 dark:bg-info/50/15 px-2 py-0.5 rounded-md">
                      Fastest
                    </span>
                  )}
                  {refundable && (
                    <span className="text-[10px] font-bold text-success dark:text-success bg-success/10 dark:bg-success/50/15 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <RefreshCw className="h-2.5 w-2.5" /> Refundable
                    </span>
                  )}
                  {typeof seatsLeft === "number" && seatsLeft > 0 && seatsLeft <= 4 && (
                    <span
                      className="text-[10px] font-bold text-danger dark:text-danger bg-danger/10 dark:bg-danger/50/15 px-2 py-0.5 rounded-md inline-flex items-center gap-1"
                      title="Live seat availability from the airline"
                    >
                      <AlertCircle className="h-2.5 w-2.5" />
                      Only {seatsLeft} seat{seatsLeft > 1 ? "s" : ""} left
                    </span>
                  )}
                </div>
                {(flightNumber || aircraft) && (
                  <div className="text-[11.5px] text-muted-foreground mt-0.5">
                    {flightNumber && <span className="font-mono">{flightNumber}</span>}
                    {flightNumber && aircraft && " · "}
                    {aircraft}
                  </div>
                )}
              </div>
            </div>

            {/* Times / route timeline */}
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 mt-1">
              <div className="text-left">
                <div className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none text-foreground">
                  {departureTime}
                </div>
                <div className="text-[11px] font-semibold text-foreground/80 mt-1.5">{origin}</div>
              </div>
              <div className="flex flex-col items-center gap-1.5 px-1 sm:px-2 min-w-0">
                <div className="text-[11px] text-foreground font-semibold tabular-nums">{duration}</div>
                <div className="relative w-full h-px bg-border">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                  {stops > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-warning/50"
                      style={{ left: "50%", transform: "translate(-50%, -50%)" }}
                    />
                  )}
                </div>
                <div className="text-[10.5px] sm:text-[11px] font-semibold text-primary text-center truncate max-w-full">{stopLabel}</div>
              </div>
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none text-foreground">
                  {arrivalTime}
                </div>
                <div className="text-[11px] font-semibold text-foreground/80 mt-1.5">{destination}</div>
              </div>
            </div>

            {/* Fare meta strip */}
            {(baggageCheckin || baggageCabin || fareType) && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-border/50">
                {baggageCheckin && <Meta icon={Luggage} label={`${baggageCheckin} Check-in`} />}
                {baggageCabin && <Meta icon={Briefcase} label={`${baggageCabin} Cabin`} />}
                <Meta
                  icon={RefreshCw}
                  label={refundable ? "Partial Refund" : "Non-refundable"}
                  tone={refundable ? "good" : "muted"}
                />
                {fareType && <Meta icon={Tag} label={fareType} />}
              </div>
            )}

            {/* Why AI picked */}
            {isAiPick && aiRationale && (
              <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-3 flex items-start gap-2.5">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="text-[12px] text-foreground/90 leading-relaxed">
                  <span className="font-bold text-primary">Why Vela AI recommends this: </span>
                  {aiRationale}
                </div>
              </div>
            )}

            {/* Compare */}
            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={inCompare}
                  onCheckedChange={(v) => onCompareToggle(!!v)}
                  className="h-3.5 w-3.5 rounded-[3px]"
                />
                <span className="text-[11.5px] text-muted-foreground font-medium">Compare</span>
              </label>
            </div>
          </div>

          {/* Right: pricing + CTA */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-row lg:flex-col items-end lg:items-stretch justify-between gap-3 lg:border-l lg:border-border/50 lg:pl-4 xl:pl-5 min-w-0">
            <div className="text-right min-w-0 flex-1 lg:flex-initial">
              {savings && (
                <div className="inline-block bg-success/10 text-success dark:bg-success/50/15 dark:text-success text-[10.5px] font-extrabold px-2 py-0.5 rounded-md mb-1">
                  Save {savings}
                </div>
              )}
              <div className="text-[20px] sm:text-[22px] lg:text-[22px] xl:text-[24px] font-extrabold tabular-nums leading-tight text-foreground break-words">
                {price}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{perTravelerLabel}</div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-[180px] shrink-0">
              <Button
                onClick={onSelect}
                className={cn(
                  "h-10 rounded-xl font-bold text-[13px] shadow-sm",
                  isAiPick && "bg-primary hover:bg-primary/90"
                )}
              >
                Select
              </Button>
              {onViewDetails && (
                <Button
                  variant="outline"
                  onClick={onViewDetails}
                  className="h-9 rounded-xl text-[12px] font-semibold border-border"
                >
                  View Details
                </Button>
              )}
              {/* "Booked X times" removed — was synthetic, not real booking data */}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

const Meta = ({
  icon: Icon,
  label,
  tone = "default",
}: {
  icon: any;
  label: string;
  tone?: "default" | "good" | "muted" | "warn";
}) => (
  <div
    className={cn(
      "inline-flex items-center gap-1.5 text-[11.5px] font-medium",
      tone === "good" && "text-success dark:text-success",
      tone === "muted" && "text-muted-foreground",
      tone === "warn" && "text-warning dark:text-warning",
      tone === "default" && "text-foreground/80"
    )}
  >
    <Icon className="h-3 w-3" />
    {label}
  </div>
);

export default B2CFlightCard;
