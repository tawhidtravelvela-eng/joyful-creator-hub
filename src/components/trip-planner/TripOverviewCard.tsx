import React from "react";
import { motion } from "framer-motion";
import { MapPin, Calendar as CalendarIcon, Users, Hotel, Sparkles, Shield, Check, Zap } from "lucide-react";
import { formatTravelers, type ConversionSummary } from "./types";

interface TripOverviewProps {
  tripTitle: string;
  destination: string;
  durationDays: number;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  totalPrice: number;
  formatPrice: (n: number) => string;
  conversionSummary?: ConversionSummary;
  conversionScore?: number;
  hasLivePrices?: boolean;
  itineraryCode?: string | null;
}

const TripOverviewCard: React.FC<TripOverviewProps> = ({
  tripTitle, destination, durationDays, adults, children, infants, rooms,
  totalPrice, formatPrice, conversionSummary, conversionScore, hasLivePrices, itineraryCode,
}) => {
  const cities = destination.split(/[,•·→]/).map(c => c.trim()).filter(Boolean);
  const travelerText = formatTravelers(adults, children, infants);
  const confidenceLabel = (conversionScore || 0) >= 70 ? "High confidence plan" : (conversionScore || 0) >= 40 ? "Good confidence plan" : "Draft plan";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(var(--card)) 60%, hsl(var(--accent) / 0.06) 100%)`,
        border: `1px solid hsl(var(--primary) / 0.2)`,
        boxShadow: `0 8px 32px hsl(var(--primary) / 0.1)`,
      }}
    >
      {/* Route Cities */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {cities.map((city, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <div className="w-4 h-px bg-primary/30 flex-shrink-0" />
              )}
              <span className="text-sm font-bold flex items-center gap-1" style={{ color: `hsl(var(--p-text))` }}>
                <MapPin className="w-3 h-3 text-primary" />
                {city}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Meta chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--primary) / 0.1)` }}>
            <CalendarIcon className="w-3 h-3 text-primary" />
            {durationDays} {durationDays === 1 ? "Day" : "Days"}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--primary) / 0.1)` }}>
            <Users className="w-3 h-3 text-primary" />
            {travelerText}
          </span>
          {rooms > 1 && (
            <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--accent) / 0.1)` }}>
              <Hotel className="w-3 h-3 text-accent" />
              {rooms} Rooms
            </span>
          )}
        </div>

        {/* Trip Style */}
        {conversionSummary?.trip_style && (
          <div className="mt-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[13px] font-semibold italic" style={{ color: `hsl(var(--primary))` }}>
              "{conversionSummary.trip_style}"
            </span>
          </div>
        )}
      </div>

      {/* Price + Confidence */}
      <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: `hsl(var(--primary) / 0.1)`, background: `hsl(var(--primary) / 0.04)` }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>Total Package</p>
          <p className="text-xl font-extrabold text-primary leading-none mt-0.5">{formatPrice(totalPrice)}</p>
          <p className="text-[10px] mt-0.5" style={{ color: `hsl(var(--p-text-subtle))` }}>
            {formatPrice(Math.round(totalPrice / Math.max(1, adults + children + infants)))} per person
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-bold rounded-full px-2.5 py-1 flex items-center gap-1" style={{ color: `hsl(var(--success))`, backgroundColor: `hsl(var(--success) / 0.1)` }}>
            <Shield className="w-3 h-3" />
            {confidenceLabel}
          </span>
          {hasLivePrices && (
            <span className="text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-0.5" style={{ color: `hsl(var(--success))`, backgroundColor: `hsl(var(--success) / 0.08)` }}>
              <Zap className="w-2.5 h-2.5" /> Live Prices
            </span>
          )}
        </div>
      </div>

      {/* Inclusions quick list */}
      <div className="px-5 py-3 border-t flex items-center justify-between flex-wrap gap-2" style={{ borderColor: `hsl(var(--primary) / 0.08)`, background: `hsl(var(--p-card))` }}>
        <div className="flex items-center gap-3 flex-wrap">
          {["Flights", "Hotels", "Activities", "Transfers"].map((item) => (
            <span key={item} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: `hsl(var(--success))` }}>
              <Check className="w-3 h-3" /> {item} included
            </span>
          ))}
        </div>
        {itineraryCode && (
          <span className="text-[10px] font-mono font-bold tracking-wide px-2 py-0.5 rounded" style={{ color: `hsl(var(--primary))`, backgroundColor: `hsl(var(--primary) / 0.08)` }}>
            {itineraryCode}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default TripOverviewCard;
