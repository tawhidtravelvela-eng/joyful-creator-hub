import { Sparkles, Luggage, Briefcase, RefreshCw, Tag, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { B2CFlightCardProps } from "@/components/flights/results/B2CFlightCard";

/**
 * Bespoke Hybrid editorial flight card.
 * Drop-in replacement for B2CFlightCard with serif headings, glass surfaces,
 * primary gradient CTA and softer ambient shadows. Same props/contract.
 */
export const HybridFlightCard = ({
  airlineCode, airlineName, flightNumber, aircraft,
  origin, destination, departureTime, arrivalTime, duration, stops, layoverSummary,
  baggageCheckin, baggageCabin, refundable, fareType,
  price, perTravelerLabel = "per traveler", savings,
  isAiPick, isCheapest, isFastest,
  aiRationale, seatsLeft,
  inCompare, onCompareToggle, onSelect, onViewDetails,
}: B2CFlightCardProps) => {
  const stopLabel =
    stops === 0
      ? "Non-stop"
      : `${stops} Stop${stops > 1 ? "s" : ""}${layoverSummary ? ` · ${layoverSummary}` : ""}`;

  return (
    <article
      className={cn(
        "relative rounded-3xl overflow-hidden transition-all duration-500",
        "bg-card/80 backdrop-blur-xl",
        "shadow-[0_2px_24px_-8px_hsl(var(--foreground)/0.08)] hover:shadow-[0_24px_60px_-24px_hsl(var(--primary)/0.32)]",
        "hover:-translate-y-0.5",
        isAiPick
          ? "border border-primary/40 ring-1 ring-primary/20"
          : "border border-border/40 hover:border-primary/30"
      )}
    >
      {/* Editorial top accent for AI Pick */}
      {isAiPick && (
        <div className="relative px-5 py-2.5 border-b border-primary/15 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{ background: "linear-gradient(120deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)" }}
          />
          <div className="relative flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-primary uppercase tracking-[0.18em]">
              <Sparkles className="h-3 w-3" /> Editor's Pick
            </span>
            <span className="text-[12px] font-medium text-foreground/80" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Curated by Vela AI
            </span>
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-12 gap-5">
          {/* Left */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9 space-y-4 min-w-0">
            {/* Airline header */}
            <div className="flex items-start gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 border border-border/40 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                <img
                  src={`https://pics.avs.io/64/64/${airlineCode}.png`}
                  alt={airlineName}
                  className="w-8 h-8 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[16px] font-bold text-foreground tracking-tight leading-tight"
                    style={{ fontFamily: "'DM Serif Display', serif" }}
                  >
                    {airlineName}
                  </span>
                  {isCheapest && !isAiPick && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      Best Price
                    </span>
                  )}
                  {isFastest && !isAiPick && (
                    <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                      Fastest
                    </span>
                  )}
                  {refundable && (
                    <span className="text-[10px] font-bold text-success dark:text-success bg-success/50/10 px-2 py-0.5 rounded-full border border-success/50/20 inline-flex items-center gap-1">
                      <RefreshCw className="h-2.5 w-2.5" /> Refundable
                    </span>
                  )}
                  {typeof seatsLeft === "number" && seatsLeft > 0 && seatsLeft <= 4 && (
                    <span className="text-[10px] font-bold text-danger dark:text-danger bg-danger/50/10 px-2 py-0.5 rounded-full border border-danger/50/20 inline-flex items-center gap-1">
                      <AlertCircle className="h-2.5 w-2.5" />
                      Only {seatsLeft} left
                    </span>
                  )}
                </div>
                {(flightNumber || aircraft) && (
                  <div className="text-[11px] text-muted-foreground mt-1 font-medium tracking-wide">
                    {flightNumber && <span className="font-mono">{flightNumber}</span>}
                    {flightNumber && aircraft && " · "}
                    {aircraft}
                  </div>
                )}
              </div>
            </div>

            {/* Times / route timeline */}
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5 pt-1">
              <div className="text-left">
                <div
                  className="text-2xl sm:text-[28px] tabular-nums leading-none text-foreground"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  {departureTime}
                </div>
                <div className="text-[11px] font-bold text-muted-foreground mt-2 uppercase tracking-[0.12em]">{origin}</div>
              </div>
              <div className="flex flex-col items-center gap-2 px-1 sm:px-2 min-w-0">
                <div className="text-[10.5px] text-foreground font-bold tabular-nums uppercase tracking-[0.1em]">{duration}</div>
                <div className="relative w-full h-px bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary ring-2 ring-primary/20" />
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary ring-2 ring-primary/20" />
                  {stops > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-accent/30"
                      style={{ left: "50%", transform: "translate(-50%, -50%)" }}
                    />
                  )}
                </div>
                <div className="text-[10.5px] font-bold text-primary text-center truncate max-w-full">{stopLabel}</div>
              </div>
              <div className="text-right">
                <div
                  className="text-2xl sm:text-[28px] tabular-nums leading-none text-foreground"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  {arrivalTime}
                </div>
                <div className="text-[11px] font-bold text-muted-foreground mt-2 uppercase tracking-[0.12em]">{destination}</div>
              </div>
            </div>

            {/* Fare meta strip */}
            {(baggageCheckin || baggageCabin || fareType) && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-border/30">
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
              <div
                className="rounded-2xl p-3.5 flex items-start gap-2.5 border border-primary/15"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--accent) / 0.04) 100%)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="text-[12px] text-foreground/85 leading-relaxed">
                  <span className="font-bold text-primary">Why we recommend this: </span>
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
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Compare</span>
              </label>
            </div>
          </div>

          {/* Right: pricing + CTA */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-row lg:flex-col items-end lg:items-stretch justify-between gap-3 lg:border-l lg:border-border/30 lg:pl-5 min-w-0">
            <div className="text-right min-w-0 flex-1 lg:flex-initial">
              {savings && (
                <div className="inline-block bg-success/50/10 text-success dark:text-success border border-success/50/20 text-[10px] font-extrabold px-2 py-0.5 rounded-full mb-1.5 uppercase tracking-wider">
                  Save {savings}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.14em] mb-0.5">From</div>
              <div
                className="text-[24px] sm:text-[26px] xl:text-[28px] tabular-nums leading-tight text-foreground break-words"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                {price}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 italic">{perTravelerLabel}</div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-[180px] shrink-0">
              <Button
                onClick={onSelect}
                className="h-11 rounded-full font-bold text-[13px] shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 bg-gradient-to-r from-primary to-primary/85 hover:from-primary/95 hover:to-primary/80 transition-all gap-1.5"
              >
                Select <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              {onViewDetails && (
                <Button
                  variant="outline"
                  onClick={onViewDetails}
                  className="h-9 rounded-full text-[11.5px] font-semibold border-border/60 hover:border-primary/40 hover:bg-primary/5 uppercase tracking-wider"
                >
                  Details
                </Button>
              )}
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
      "inline-flex items-center gap-1.5 text-[11px] font-semibold",
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

export default HybridFlightCard;