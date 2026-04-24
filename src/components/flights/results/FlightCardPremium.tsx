import { useState } from "react";
import { Plane, Clock, Luggage, Briefcase, ShieldCheck, ChevronDown, ChevronUp, Sparkles, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getAirlineName } from "@/data/airlines";
import type { PremiumFlight } from "./types";

interface Props {
  flight: PremiumFlight;
  isAiPick?: boolean;
  isCheapest?: boolean;
  isFastest?: boolean;
  aiRationale?: string;
  aiValueDeltaPct?: number;
  isStudentFare?: boolean;
  currencySymbol?: string;
  cheapestPrice?: number;
  bookedRecently?: number;
  onSelect: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onCompareToggle?: (id: string, on: boolean) => void;
  inCompare?: boolean;
}

function formatTime(t: string) {
  if (!t) return "--:--";
  // Provider times are airport-local wall-clock — extract HH:MM directly
  // and never let the browser convert them to the user's timezone.
  if (t.includes("T")) {
    const m = t.match(/T(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  return t;
}

export default function FlightCardPremium({
  flight, isAiPick, isCheapest, isFastest, aiRationale, aiValueDeltaPct,
  isStudentFare, currencySymbol = "$", cheapestPrice, bookedRecently,
  onSelect, onViewDetails, onCompareToggle, inCompare,
}: Props) {
  const [open, setOpen] = useState(false);
  const airlineName = getAirlineName(flight.airline);
  const stops = flight.stops || 0;
  const layoverIatas = (flight.segments || []).slice(0, -1).map(s => s.destination || "").filter(Boolean);
  const savings = cheapestPrice && cheapestPrice < flight.price ? null : (cheapestPrice && cheapestPrice > flight.price ? cheapestPrice - flight.price : null);

  return (
    <motion.article
      layout
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "relative rounded-2xl bg-card overflow-hidden transition-all",
        "shadow-sm hover:shadow-xl hover:shadow-primary/[0.06]",
        isAiPick
          ? "border-2 border-primary/40 ring-1 ring-primary/10"
          : "border border-border/50"
      )}
    >
      {/* AI Pick top banner */}
      {isAiPick && (
        <div className="bg-gradient-to-r from-primary via-fuchsia-500/90 to-danger/90 text-primary-foreground px-4 py-1.5 flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Recommended by Vela AI</span>
          {aiValueDeltaPct ? (
            <span className="ml-auto inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[11px] backdrop-blur">
              {aiValueDeltaPct}% more value
            </span>
          ) : null}
        </div>
      )}

      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-6">
        {/* Left: flight info */}
        <div className="space-y-3">
          {/* Header: airline + badges */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/40 overflow-hidden">
                <img
                  src={`https://pics.avs.io/64/64/${flight.airline}.png`}
                  alt={airlineName}
                  className="w-7 h-7 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.5 19h-11a4.5 4.5 0 010-9h.5L9 5l3 3 3-3 2 5h.5a4.5 4.5 0 010 9z"/></svg>';
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground truncate">{airlineName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {flight.flightNumber || flight.airline} • {flight.class}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              {isAiPick && <Badge className="bg-primary/15 text-primary border-primary/25 hover:bg-primary/20">Best Match</Badge>}
              {isCheapest && !isAiPick && <Badge variant="secondary" className="bg-success/50/10 text-success dark:text-success border-success/50/20">Cheapest</Badge>}
              {isFastest && !isAiPick && <Badge variant="secondary" className="bg-info/50/10 text-info dark:text-info border-info/50/20">Fastest</Badge>}
              {isStudentFare && (
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 gap-1">
                  <GraduationCap className="h-3 w-3" /> Student
                </Badge>
              )}
              {flight.baggageAllowance?.checkin && (
                <Badge variant="secondary" className="bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20 gap-1">
                  <Luggage className="h-3 w-3" /> Baggage Included
                </Badge>
              )}
            </div>
          </div>

          {/* Time / route visualization */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground tabular-nums">{formatTime(flight.departure)}</div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{flight.from_city}</div>
            </div>

            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Clock className="h-3 w-3" /> {flight.duration}
              </div>
              <div className="relative w-full h-px bg-border/80">
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  {layoverIatas.map((c, i) => (
                    <div key={i} className="flex flex-col items-center -translate-y-3">
                      <div className="h-2 w-2 rounded-full bg-warning/50 border-2 border-background" />
                      <span className="text-[9px] font-bold text-muted-foreground mt-0.5">{c}</span>
                    </div>
                  ))}
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                {stops === 0 ? "Non-stop" : `${stops} Stop${stops > 1 ? "s" : ""}${layoverIatas.length ? ` · ${layoverIatas.join(", ")}` : ""}`}
              </div>
            </div>

            <div className="text-left">
              <div className="text-2xl font-bold text-foreground tabular-nums">{formatTime(flight.arrival)}</div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{flight.to_city}</div>
            </div>
          </div>

          {/* Fare meta strip */}
          <div className="flex flex-wrap gap-2 pt-1">
            {flight.baggageAllowance?.checkin && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-muted/50 text-foreground font-medium">
                <Luggage className="h-3 w-3" /> {flight.baggageAllowance.checkin} Check-in
              </span>
            )}
            {flight.baggageAllowance?.cabin && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-muted/50 text-foreground font-medium">
                <Briefcase className="h-3 w-3" /> {flight.baggageAllowance.cabin} Cabin
              </span>
            )}
            {flight.isRefundable && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-400 font-medium">
                <ShieldCheck className="h-3 w-3" /> Refundable
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-muted/50 text-foreground font-medium">
              {flight.class}
            </span>
          </div>

          {/* AI rationale block */}
          {isAiPick && aiRationale && (
            <div className="rounded-xl bg-gradient-to-r from-primary/[0.06] via-fuchsia-500/[0.04] to-transparent border border-primary/15 p-3 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground">Why this is recommended?</div>
                <div className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{aiRationale}</div>
              </div>
            </div>
          )}

          {/* Compare checkbox */}
          {onCompareToggle && (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={`cmp-${flight.id}`}
                checked={!!inCompare}
                onCheckedChange={(c) => onCompareToggle(flight.id, !!c)}
              />
              <label htmlFor={`cmp-${flight.id}`} className="text-xs text-muted-foreground font-medium cursor-pointer">
                Compare
              </label>
            </div>
          )}
        </div>

        {/* Right: price + CTAs */}
        <div className="flex md:flex-col items-end justify-between md:justify-center gap-3 md:min-w-[180px] md:border-l md:border-border/50 md:pl-6">
          <div className="text-right">
            {savings && (
              <div className="inline-block bg-success/5 dark:bg-success/50/10 text-success dark:text-success text-[11px] font-bold px-2 py-0.5 rounded-full mb-1">
                Save {currencySymbol}{Math.round(savings).toLocaleString()}
              </div>
            )}
            <div className="text-2xl sm:text-[26px] font-extrabold text-foreground tabular-nums leading-tight">
              {currencySymbol}{Math.round(flight.price).toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium">per traveler</div>
          </div>
          <div className="flex flex-col gap-1.5 w-full sm:max-w-[170px]">
            <Button onClick={() => onSelect(flight.id)} className="w-full font-semibold shadow-sm">
              Select
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => (onViewDetails ? onViewDetails(flight.id) : setOpen(o => !o))}
              className="w-full text-xs font-semibold"
            >
              {open ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              View Details
            </Button>
            {bookedRecently && bookedRecently > 0 && (
              <div className="text-[10px] text-danger dark:text-danger font-semibold text-center mt-0.5 inline-flex items-center justify-center gap-1">
                <span>🔥</span> Booked {bookedRecently} times today
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/50 bg-muted/20"
          >
            <div className="p-4 sm:p-5 space-y-2">
              <div className="text-xs font-bold text-foreground uppercase tracking-wide">Itinerary details</div>
              {(flight.segments || []).map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground bg-card rounded-lg p-2.5 border border-border/50">
                  <Plane className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-mono text-foreground">{s.carrier}{s.flightNumber}</span>
                  <span>{s.origin} {formatTime(s.departure || "")} → {s.destination} {formatTime(s.arrival || "")}</span>
                  {s.duration && <span className="ml-auto">{s.duration}</span>}
                </div>
              ))}
              {flight.basePrice !== undefined && (
                <div className="flex justify-between text-xs pt-2 border-t border-border/50">
                  <span className="text-muted-foreground">Base fare + Taxes & fees</span>
                  <span className="font-bold text-foreground">
                    {currencySymbol}{Math.round(flight.basePrice)} + {currencySymbol}{Math.round(flight.taxes || 0)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
