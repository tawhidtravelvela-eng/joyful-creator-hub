import React from "react";
import { Plane, Hotel, Camera, Star, Zap } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import AirlineLogo from "./AirlineLogo";
import { getAirlineInfo } from "./tripPricingUtils";
import type { Itinerary } from "./tripTypes";

// ── Live Flight Card ──
export const LiveFlightCard: React.FC<{ flights: Itinerary["live_flights"] }> = ({ flights }) => {
  const { formatDirectPrice } = useCurrency();
  if (!flights?.length) return null;
  return (
    <div className="mt-4 border border-primary/20 rounded-xl overflow-hidden">
      <div className="bg-primary/5 px-4 py-2 flex items-center gap-2 border-b border-primary/10">
        <Plane className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold text-primary">Live Flight Options</span>
        <span className="ml-auto text-[10px] bg-success/10 text-success rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" /> Bookable
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {flights.slice(0, 3).map((f, i) => {
          const ai = getAirlineInfo(f.airline);
          return (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-primary/5 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <AirlineLogo code={ai.code} name={ai.name} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{ai.name}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{f.from} → {f.to}</span>
                  <span>•</span>
                  <span>{f.duration || "—"}</span>
                  <span>•</span>
                  <span className={f.stops === 0 ? "text-success font-medium" : ""}>
                    {f.stops === 0 ? "Direct" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-primary">{formatDirectPrice(f.price)}</p>
                <p className="text-[10px] text-muted-foreground">{f.return_flight ? "round trip" : "one way"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Live Hotel Card ──
export const LiveHotelCard: React.FC<{ hotels: Itinerary["live_hotels"] }> = ({ hotels }) => {
  const { formatDirectPrice } = useCurrency();
  if (!hotels?.length) return null;
  return (
    <div className="mt-3 border border-accent/20 rounded-xl overflow-hidden">
      <div className="bg-accent/5 px-4 py-2 flex items-center gap-2 border-b border-accent/10">
        <Hotel className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-bold text-accent">Live Hotel Options</span>
        <span className="ml-auto text-[10px] bg-success/10 text-success rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" /> Bookable
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {hotels.slice(0, 3).map((h, i) => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-primary/5 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Hotel className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{h.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: h.stars }).map((_, s) => (
                  <Star key={s} className="w-2.5 h-2.5 fill-warning text-warning" />
                ))}
                {h.meal_basis && <span className="text-[10px] text-muted-foreground ml-1">• {h.meal_basis}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-accent">{formatDirectPrice(h.price_per_night)}</p>
              <p className="text-[10px] text-muted-foreground">per night</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Live Activity Card ──
export const LiveActivityCard: React.FC<{ activities: Itinerary["live_activities"]; adults?: number; children?: number }> = ({ activities, adults, children }) => {
  const { formatDirectPrice } = useCurrency();
  if (!activities?.length) return null;
  const paxCount = (adults || 1) + (children || 0);
  return (
    <div className="mt-3 border border-success/20 rounded-xl overflow-hidden">
      <div className="bg-success/5 px-4 py-2 flex items-center gap-2 border-b border-success/10">
        <Camera className="w-3.5 h-3.5 text-success" />
        <span className="text-xs font-bold text-success">Live Activities</span>
        <span className="ml-auto text-[10px] bg-success/10 text-success rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" /> Bookable
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {activities.slice(0, 4).map((a, i) => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-primary/5 transition-colors">
            {a.image ? (
              <img src={a.image} alt={a.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <Camera className="w-4 h-4 text-success" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                {a.duration && <span>{a.duration}</span>}
                {a.rating > 0 && <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-warning text-warning" /> {Number(a.rating).toFixed(1)}</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-success">{formatDirectPrice(a.price * paxCount)}</p>
              <p className="text-[10px] text-muted-foreground">{paxCount > 1 ? `${paxCount} pax` : "per person"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
