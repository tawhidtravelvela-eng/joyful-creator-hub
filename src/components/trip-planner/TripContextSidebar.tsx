import React from "react";
import {
  MapPin, Calendar as CalendarIcon, Users,
  Plane, Hotel, Camera, Bus, Sparkles, Shield, Check, DollarSign,
} from "lucide-react";

import { formatTravelers, type ConversionSummary } from "./types";

interface TripContextSidebarProps {
  destination: string;
  durationDays: number;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  travelType?: string;
  travelStyle?: string;
  totalPrice: number;
  formatPrice: (n: number) => string;
  breakdown: Record<string, number>;
  conversionSummary?: ConversionSummary;
  conversionScore?: number;
  included?: string[];
  excluded?: string[];
  tips?: string[];
}

const categoryIcon: Record<string, React.ElementType> = {
  flights: Plane, hotels: Hotel, activities: Camera, transport: Bus,
};

const TripContextSidebar: React.FC<TripContextSidebarProps> = ({
  destination, durationDays, adults, children, infants, rooms,
  travelType, travelStyle, totalPrice, formatPrice, breakdown,
  conversionSummary, conversionScore, included, excluded, tips,
}) => {
  const cities = destination.split(/[,•·→]/).map(c => c.trim()).filter(Boolean);
  const confidenceLabel = (conversionScore || 0) >= 70 ? "High" : (conversionScore || 0) >= 40 ? "Good" : "Draft";

  return (
    <div className="h-full flex flex-col overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
      {/* Trip Route */}
      <div className="p-4 border-b" style={{ borderColor: `hsl(var(--p-border))` }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>Your Trip</span>
        </div>
        
        {/* City route */}
        <div className="space-y-1.5">
          {cities.map((city, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-primary" : i === cities.length - 1 ? "bg-accent" : "bg-primary/40"}`} />
              <span className="text-sm font-semibold" style={{ color: `hsl(var(--p-text))` }}>{city}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trip Details */}
      <div className="p-4 border-b space-y-2.5" style={{ borderColor: `hsl(var(--p-border))` }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: `hsl(var(--p-text))` }}>
          <CalendarIcon className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold">{durationDays} Days</span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: `hsl(var(--p-text))` }}>
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold">{formatTravelers(adults, children, infants)}</span>
        </div>
        {rooms > 1 && (
          <div className="flex items-center gap-2 text-xs" style={{ color: `hsl(var(--p-text))` }}>
            <Hotel className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold">{rooms} Rooms</span>
          </div>
        )}
        {conversionSummary?.trip_style && (
          <div className="flex items-center gap-2 text-xs mt-1" style={{ color: `hsl(var(--primary))` }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-medium italic text-[11px]">{conversionSummary.trip_style}</span>
          </div>
        )}
      </div>

      {/* Budget Breakdown */}
      <div className="p-4 border-b" style={{ borderColor: `hsl(var(--p-border))` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>Budget</span>
          <span className="text-sm font-extrabold text-primary">{formatPrice(totalPrice)}</span>
        </div>
        <div className="space-y-2">
          {Object.entries(breakdown).filter(([, v]) => v > 0).map(([key, val]) => {
            const Icon = categoryIcon[key] || DollarSign;
            return (
              <div key={key} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 capitalize" style={{ color: `hsl(var(--p-text-muted))` }}>
                  <Icon className="w-3 h-3" /> {key}
                </span>
                <span className="font-semibold" style={{ color: `hsl(var(--p-text))` }}>{formatPrice(val)}</span>
              </div>
            );
          })}
        </div>
      </div>


      {/* Confidence */}
      <div className="p-4 mt-auto">
        <div className="rounded-xl p-3" style={{ background: `hsl(var(--success) / 0.06)`, border: `1px solid hsl(var(--success) / 0.15)` }}>
          <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: `hsl(var(--success))` }}>
            <Shield className="w-3.5 h-3.5" />
            {confidenceLabel} Confidence Plan
          </div>
          <div className="flex items-center gap-3 mt-2 text-[9px]" style={{ color: `hsl(var(--p-text-muted))` }}>
            <span className="flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI Optimized</span>
            <span className="flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" /> Validated</span>
            <span className="flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> No Conflicts</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripContextSidebar;
