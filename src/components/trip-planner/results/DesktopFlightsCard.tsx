import React from "react";
import { motion } from "framer-motion";
import {
  Plane, Sparkles, Radio, ArrowRight, ArrowLeftRight, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DesktopFlightsCardProps {
  selectedFlight: any;
  displayItinerary: any;
  allSearchedFlights: any[];
  userSelectedFlight: any;
  userSelectedFlightsByLeg: Record<string, any>;
  formatPrice: (n: number) => string;
  calcFlightCost: (flight: any, adults: number, children: number, infants: number) => number;
  getPerAdultPrice: (flight: any) => number;
  resolveCity: (code: string) => string;
  generateFlightInsight: (flight: any, allFlights: any[]) => string;
  FlightLegRow: React.FC<any>;
  onViewDetails: () => void;
  onBook: () => void;
  onShowAllFlights: () => void;
  onSwapLeg?: (legId: string) => void;
}

const DesktopFlightsCard: React.FC<DesktopFlightsCardProps> = ({
  selectedFlight, displayItinerary, allSearchedFlights,
  userSelectedFlight, userSelectedFlightsByLeg,
  formatPrice, calcFlightCost, getPerAdultPrice, resolveCity,
  generateFlightInsight, FlightLegRow,
  onViewDetails, onBook, onShowAllFlights, onSwapLeg,
}) => {
  if (!selectedFlight) return null;

  const adults = displayItinerary.adults || displayItinerary.travelers || 1;
  const children = displayItinerary.children || 0;
  const infants = displayItinerary.infants || 0;
  const isUserPick = userSelectedFlight || Object.keys(userSelectedFlightsByLeg).length > 0;
  const isLive = selectedFlight.is_live_price;
  const hasMultiCity = !!selectedFlight.inter_city_legs?.length;

  const handleSwapLeg = (legId: string) => {
    if (onSwapLeg) {
      onSwapLeg(legId);
    } else {
      onShowAllFlights();
    }
  };

  // Build swap button for each leg
  const SwapBtn = ({ legId }: { legId: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-[10px] font-semibold gap-1 rounded-md text-primary hover:bg-primary/10 flex-shrink-0"
      onClick={(e) => { e.stopPropagation(); handleSwapLeg(legId); }}
    >
      <ArrowLeftRight className="w-3 h-3" /> Swap
    </Button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, boxShadow: `0 12px 40px hsl(var(--primary) / 0.2)` }}
      transition={{ delay: 0.15, duration: 0.25 }}
      className="rounded-2xl overflow-hidden backdrop-blur-sm cursor-default"
      style={{
        background: `linear-gradient(145deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--p-card)) 40%, hsl(var(--p-card)) 100%)`,
        border: `1px solid hsl(var(--primary) / 0.25)`,
        boxShadow: `0 4px 20px hsl(var(--p-shadow)), 0 0 0 1px hsl(var(--primary) / 0.08)`,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: `hsl(var(--primary) / 0.15)`, background: `linear-gradient(90deg, hsl(var(--primary) / 0.12) 0%, transparent 100%)` }}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Plane className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold" style={{ color: `hsl(var(--p-text))` }}>Flights</span>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> {isUserPick ? "Your Pick" : "Recommended by Vela AI"}
              </span>
              {isLive ? (
                <span className="text-[10px] bg-success/10 text-success rounded-full px-2 py-0.5 font-bold flex items-center gap-0.5">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> Live Price
                </span>
              ) : (
                <span className="text-[10px] bg-warning/10 text-warning rounded-full px-2 py-0.5 font-bold">
                  Estimated
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0 pl-3 max-w-[45%]">
          <p className="text-xl sm:text-2xl font-extrabold text-primary leading-tight truncate">
            {formatPrice(calcFlightCost(selectedFlight, adults, children, infants))}
          </p>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: `hsl(var(--p-text-subtle))` }}>
            {adults > 0 && <>{formatPrice(getPerAdultPrice(selectedFlight))}/adult</>}
            {' · '}{hasMultiCity ? 'multi-city' : 'round trip'}
          </p>
        </div>
      </div>

      {/* Flight Legs — each with a swap button */}
      <div className="px-4 py-1">
        {selectedFlight.outbound && (
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <FlightLegRow
                label={hasMultiCity ? `${resolveCity(selectedFlight.outbound.from)} → ${resolveCity(selectedFlight.outbound.to)}` : "Depart"}
                airline={selectedFlight.outbound.airline}
                flightNo={selectedFlight.outbound.flight_number}
                from={selectedFlight.outbound.from}
                to={selectedFlight.outbound.to}
                departure={selectedFlight.outbound.departure}
                arrival={selectedFlight.outbound.arrival}
                date={selectedFlight.outbound.date}
                duration={selectedFlight.outbound.duration}
                stops={selectedFlight.outbound.stops}
                cabinClass={selectedFlight.outbound.cabin_class}
              />
            </div>
            {allSearchedFlights.length > 0 && <SwapBtn legId="outbound" />}
          </div>
        )}
        {selectedFlight.inter_city_legs?.map((leg: any, legIdx: number) => (
          <div key={`inter-${legIdx}`} className="flex items-center gap-1 border-t border-dashed border-border/50 pt-1">
            <div className="flex-1 min-w-0">
              <FlightLegRow
                label={leg.label || `${resolveCity(leg.from)} → ${resolveCity(leg.to)}`}
                airline={leg.airline}
                flightNo={leg.flight_number}
                from={leg.from}
                to={leg.to}
                departure={leg.departure}
                arrival={leg.arrival}
                date={leg.date}
                duration={leg.duration}
                stops={leg.stops}
                cabinClass={leg.cabin_class}
              />
            </div>
            {allSearchedFlights.length > 0 && <SwapBtn legId={`inter-${legIdx}`} />}
          </div>
        ))}
        {selectedFlight.inbound && (
          <div className="flex items-center gap-1 border-t border-dashed border-border/50 pt-1">
            <div className="flex-1 min-w-0">
              <FlightLegRow
                label={hasMultiCity ? `${resolveCity(selectedFlight.inbound.from)} → ${resolveCity(selectedFlight.inbound.to)}` : "Return"}
                airline={selectedFlight.inbound.airline}
                flightNo={selectedFlight.inbound.flight_number}
                from={selectedFlight.inbound.from}
                to={selectedFlight.inbound.to}
                departure={selectedFlight.inbound.departure}
                arrival={selectedFlight.inbound.arrival}
                date={selectedFlight.inbound.date}
                duration={selectedFlight.inbound.duration}
                stops={selectedFlight.inbound.stops}
                cabinClass={selectedFlight.inbound.cabin_class}
              />
            </div>
            {allSearchedFlights.length > 0 && <SwapBtn legId="inbound" />}
          </div>
        )}
      </div>

      {/* AI Insight */}
      {(selectedFlight.reason || selectedFlight.outbound) && (
        <div className="px-4 py-2 border-t" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--primary) / 0.04)` }}>
          <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
            AI Insight: {generateFlightInsight(selectedFlight, allSearchedFlights)}
          </p>
        </div>
      )}

      {/* CTA Footer */}
      <div className="px-4 py-2.5 border-t flex items-center justify-end gap-2" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--p-card))` }}>
        <Button
          size="sm"
          variant="secondary"
          className="h-9 rounded-lg text-xs font-semibold gap-1"
          style={{ backgroundColor: `hsl(220 26% 28%)`, color: `hsl(210 40% 96%)`, border: `1px solid hsl(220 22% 34%)` }}
          onClick={onViewDetails}
        >
          View Details
        </Button>
        <Button
          size="sm"
          className="h-9 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-bold gap-1.5 shadow-md shadow-accent/20"
          onClick={onBook}
        >
          {isLive ? "Book Now" : "Search Flights"} <ArrowRight className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
};

export default React.memo(DesktopFlightsCard);
