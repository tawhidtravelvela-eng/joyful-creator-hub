import React, { useState, useMemo } from "react";
import { buildTourUrl } from "@/utils/tourSlug";
import type { HolidayInfo } from "@/hooks/useTripHolidays";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Calendar as CalendarIcon, Users, Plane, Hotel,
  Camera, Bus, Star, Shield, Sparkles, Check, Zap, ChevronDown,
  ChevronRight, ShoppingCart, PencilLine, ArrowLeft, Clock,
  ChevronUp, AlertTriangle, Download, Loader2, DollarSign, Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItineraryDayCard, adaptDayPlanToCardData } from "./itinerary";
import { trackTripEvent } from "@/utils/tripTracking";
import {
  formatTravelers,
  type FlightLeg, type SelectedFlight, type SelectedHotel,
  type DayPlan, type ConversionSummary, type DecisionLayer, type BudgetEstimate,
} from "./types";

export interface MobileTripResultsProps {
  destination: string;
  tripTitle: string;
  durationDays: number;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  days: DayPlan[];
  selectedFlight?: SelectedFlight;
  selectedHotel?: SelectedHotel;
  hotelAlternatives?: any[];
  budgetEstimate: BudgetEstimate;
  decisionLayer?: DecisionLayer;
  conversionSummary?: ConversionSummary;
  conversionScore?: number;
  hasLivePrices?: boolean;
  formatPrice: (n: number) => string;
  loading: boolean;
  pdfDownloading: boolean;
  onBook: () => void;
  onCustomize: () => void;
  onDownloadPDF: () => void;
  onBack: () => void;
  onShowFlights: () => void;
  onShowHotels: () => void;
  onFlightBook: () => void;
  onHotelView: () => void;
  flightBookLabel?: string;
  hotelViewLabel?: string;
  allFlightsCount: number;
  allHotelsCount: number;
  hotelImage?: string;
  getAirlineInfo: (raw: string) => { name: string; code: string; logoUrl: string };
  formatFlightTime: (t: string | undefined) => string;
  resolveCity: (code: string) => string;
  AirlineLogo: React.FC<{ code: string; name: string; size?: number }>;
  getHolidaysForDay?: (dayNumber: number, dayCountry?: string) => HolidayInfo[];
}

const catIcon: Record<string, React.ElementType> = {
  flights: Plane, hotels: Hotel, activities: Camera, transport: Bus,
};

/* DayCard replaced by ItineraryDayCard below */

/* ── Main Component ── */
const MobileTripResults: React.FC<MobileTripResultsProps> = ({
  destination, tripTitle, durationDays, adults, children: childCount, infants, rooms,
  days, selectedFlight, selectedHotel, budgetEstimate, decisionLayer, conversionSummary,
  conversionScore, hasLivePrices, formatPrice, loading, pdfDownloading,
  onBook, onCustomize, onDownloadPDF, onBack, onShowFlights, onShowHotels,
  onFlightBook, onHotelView, allFlightsCount, allHotelsCount, hotelImage,
  getAirlineInfo, formatFlightTime, resolveCity, AirlineLogo, getHolidaysForDay,
}) => {
  const cities = destination.split(/[,•·→]/).map(c => c.trim()).filter(Boolean);
  const travelerText = formatTravelers(adults, childCount, infants);
  const pkgTotal = (budgetEstimate.breakdown.flights || 0) + (budgetEstimate.breakdown.hotels || 0) + (budgetEstimate.breakdown.activities || 0);
  const confidenceLabel = (conversionScore || 0) >= 70 ? "High" : (conversionScore || 0) >= 40 ? "Good" : "Draft";
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <div className="flex flex-col min-h-0" style={{ backgroundColor: `hsl(var(--p-surface-alt))` }}>

      {/* ═══ 1. STICKY TOP SUMMARY BAR ═══ */}
      <div className="sticky top-0 z-20 px-3 py-2.5 border-b backdrop-blur-xl"
        style={{
          borderColor: `hsl(var(--p-border))`,
          backgroundColor: `hsl(var(--p-surface) / 0.92)`,
          backdropFilter: 'blur(20px)',
        }}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 active:bg-primary/10"
            style={{ color: `hsl(var(--p-text))` }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold truncate" style={{ color: `hsl(var(--p-text))` }}>
              {cities.join(" • ")}
            </p>
            <p className="text-[10px]" style={{ color: `hsl(var(--p-text-muted))` }}>
              {durationDays} Days · {travelerText}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-extrabold text-primary leading-none">{formatPrice(pkgTotal)}</p>
            <p className="text-[9px]" style={{ color: `hsl(var(--p-text-faint))` }}>package</p>
          </div>
        </div>
      </div>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto pb-28 space-y-3 px-3 pt-3">

        {/* ═══ 2. HERO TRIP OVERVIEW ═══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--card)) 60%, hsl(var(--accent) / 0.05) 100%)`,
            border: `1px solid hsl(var(--primary) / 0.2)`,
            boxShadow: `0 4px 20px hsl(var(--primary) / 0.08)`,
          }}>
          {/* Route */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {cities.map((city, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className="w-3 h-px bg-primary/30 shrink-0" />}
                  <span className="text-[12px] font-bold flex items-center gap-1" style={{ color: `hsl(var(--p-text))` }}>
                    <MapPin className="w-3 h-3 text-primary" />{city}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Trip Style */}
            {conversionSummary?.trip_style && (
              <p className="text-[12px] font-medium italic mb-3" style={{ color: `hsl(var(--primary))` }}>
                <Sparkles className="w-3 h-3 inline mr-1" />"{conversionSummary.trip_style}"
              </p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { icon: Sparkles, label: "AI Optimized", color: "primary" },
                { icon: Users, label: "Family Friendly", color: "accent" },
                { icon: Plane, label: "Flights Included", color: "primary" },
                { icon: Hotel, label: "Hotels Included", color: "accent" },
              ].map(b => (
                <span key={b.label}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ color: `hsl(var(--${b.color}))`, backgroundColor: `hsl(var(--${b.color}) / 0.1)` }}>
                  <b.icon className="w-2.5 h-2.5" />{b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Inclusions row */}
          <div className="px-4 py-2.5 border-t flex items-center gap-3 flex-wrap"
            style={{ borderColor: `hsl(var(--primary) / 0.1)`, background: `hsl(var(--primary) / 0.03)` }}>
            {["Flights", "Hotels", "Tours", "Transfers"].map(item => (
              <span key={item} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: `hsl(var(--success))` }}>
                <Check className="w-3 h-3" />{item}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ═══ 3. WHY THIS PLAN WORKS ═══ */}
        {conversionSummary?.why_this_plan_works && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl p-4"
            style={{
              background: `hsl(var(--card))`,
              border: `1px solid hsl(var(--accent) / 0.15)`,
            }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1"
              style={{ color: `hsl(var(--accent))` }}>
              <Check className="w-3 h-3" /> Why This Plan Works
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: `hsl(var(--p-text))` }}>
              {conversionSummary.why_this_plan_works}
            </p>
          </motion.div>
        )}

        {/* ═══ SMART ALERTS ═══ */}
        {decisionLayer?.smart_alerts && decisionLayer.smart_alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
            className="rounded-2xl p-3 space-y-2"
            style={{ background: `hsl(var(--warning) / 0.06)`, border: `1px solid hsl(var(--warning) / 0.15)` }}>
            {decisionLayer.smart_alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-2">
                <Zap className="w-3 h-3 mt-0.5 shrink-0" style={{ color: `hsl(var(--warning))` }} />
                <p className="text-[11px] leading-relaxed" style={{ color: `hsl(var(--p-text))` }}>{alert}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ═══ CONFIDENCE MESSAGE ═══ */}
        {decisionLayer?.confidence_message && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: `hsl(var(--success) / 0.06)`, border: `1px solid hsl(var(--success) / 0.12)` }}>
            <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: `hsl(var(--success))` }} />
            <p className="text-[11px] font-medium" style={{ color: `hsl(var(--success))` }}>
              {decisionLayer.confidence_message}
            </p>
          </motion.div>
        )}

        {/* ═══ 4. TOP EXPERIENCES ═══ */}
        {conversionSummary?.highlight_experiences && conversionSummary.highlight_experiences.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1 px-1"
              style={{ color: `hsl(var(--primary))` }}>
              <Star className="w-3 h-3" /> Top Experiences
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {conversionSummary.highlight_experiences.slice(0, 5).map((exp, i) => (
                <div key={i}
                  className="shrink-0 rounded-xl px-3 py-2.5 min-w-[140px] max-w-[180px]"
                  style={{
                    background: `hsl(var(--card))`,
                    border: `1px solid hsl(var(--primary) / 0.15)`,
                  }}>
                  <Star className="w-3.5 h-3.5 fill-primary text-primary mb-1" />
                  <p className="text-[11px] font-semibold leading-snug" style={{ color: `hsl(var(--p-text))` }}>
                    {exp}
                  </p>
                  <span className="text-[9px] font-medium mt-1 inline-block" style={{ color: `hsl(var(--success))` }}>
                    Included
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ 5. PRICE + INCLUSIONS ═══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: `hsl(var(--card))`,
            border: `1px solid hsl(var(--primary) / 0.2)`,
          }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ background: `hsl(var(--primary) / 0.04)` }}>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>
                Total Package
              </p>
              <p className="text-xl font-extrabold text-primary leading-tight">{formatPrice(pkgTotal)}</p>
              <p className="text-[10px]" style={{ color: `hsl(var(--p-text-faint))` }}>
                {formatPrice(Math.round(pkgTotal / Math.max(1, adults + childCount + infants)))} per person
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-0.5"
                style={{ color: `hsl(var(--success))`, backgroundColor: `hsl(var(--success) / 0.1)` }}>
                <Shield className="w-2.5 h-2.5" />{confidenceLabel} Confidence
              </span>
              {hasLivePrices && (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-0.5"
                  style={{ color: `hsl(var(--success))`, backgroundColor: `hsl(var(--success) / 0.08)` }}>
                  <Zap className="w-2.5 h-2.5" /> Live Prices
                </span>
              )}
            </div>
          </div>
          <div className="px-4 py-2.5 grid grid-cols-2 gap-2">
            {Object.entries(budgetEstimate.breakdown).filter(([, v]) => v > 0).map(([key, val]) => {
              const Icon = catIcon[key] || DollarSign;
              return (
                <div key={key} className="flex items-center gap-1.5 text-[11px]">
                  <Icon className="w-3 h-3" style={{ color: `hsl(var(--primary))` }} />
                  <span className="capitalize" style={{ color: `hsl(var(--p-text-muted))` }}>{key}</span>
                  <span className="font-semibold ml-auto" style={{ color: `hsl(var(--p-text))` }}>{formatPrice(val)}</span>
                </div>
              );
            })}
          </div>
          {/* Trust */}
          <div className="px-4 py-2 border-t flex items-center gap-3" style={{ borderColor: `hsl(var(--p-border) / 0.5)` }}>
            <span className="text-[9px] flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
              <Sparkles className="w-2.5 h-2.5 text-primary" /> AI Optimized
            </span>
            <span className="text-[9px] flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
              <Shield className="w-2.5 h-2.5 text-success" /> Validated
            </span>
            <span className="text-[9px] flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
              <Check className="w-2.5 h-2.5 text-success" /> No Conflicts
            </span>
          </div>
        </motion.div>

        {/* ═══ 6. COMPONENT CARDS ═══ */}

        {/* ── FLIGHTS CARD ── */}
        {selectedFlight && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: `hsl(var(--card))`, border: `1px solid hsl(var(--p-border))` }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-2"
              style={{ borderColor: `hsl(var(--p-border) / 0.5)`, background: `linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--card)))` }}>
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center"
                style={{ boxShadow: `0 0 10px hsl(var(--primary) / 0.12)` }}>
                <Plane className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold" style={{ color: `hsl(var(--p-text))` }}>Flights</span>
                <span className="block text-[9px] font-medium" style={{ color: `hsl(var(--p-text-faint))` }}>
                  {selectedFlight.is_live_price !== false ? "Live Price" : "Estimated"}
                </span>
              </div>
              <span className="text-[9px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> Best
              </span>
            </div>

            <div className="p-4">
              {selectedFlight.summary && (
                <p className="text-[12px] font-semibold mb-2.5" style={{ color: `hsl(var(--p-text))` }}>
                  {selectedFlight.summary}
                </p>
              )}

              {/* Outbound leg */}
              {selectedFlight.outbound && (() => {
                const ai = getAirlineInfo(selectedFlight.outbound!.airline || selectedFlight.outbound!.flight_number || "");
                return (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl mb-2"
                    style={{ backgroundColor: `hsl(var(--p-surface) / 0.6)`, border: `1px solid hsl(var(--p-border) / 0.3)` }}>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                      <AirlineLogo code={ai.code} name={ai.name} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase text-primary">
                          {selectedFlight.inter_city_legs?.length ? `${resolveCity(selectedFlight.outbound!.from || "")} → ${resolveCity(selectedFlight.outbound!.to || "")}` : "Depart"}
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: `hsl(var(--p-text))` }}>
                          {ai.code ? `${ai.name} (${ai.code})` : ai.name}
                        </span>
                      </div>
                      <p className="text-[10px]" style={{ color: `hsl(var(--p-text-muted))` }}>
                        {formatFlightTime(selectedFlight.outbound!.departure)} → {formatFlightTime(selectedFlight.outbound!.arrival)} · {selectedFlight.outbound!.duration}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Inter-city legs */}
              {selectedFlight.inter_city_legs?.map((leg, idx) => {
                const ai = getAirlineInfo(leg.airline || leg.flight_number || "");
                return (
                  <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl mb-2"
                    style={{ backgroundColor: `hsl(var(--p-surface) / 0.6)`, border: `1px solid hsl(var(--p-border) / 0.3)` }}>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                      <AirlineLogo code={ai.code} name={ai.name} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase text-primary">
                          {leg.label || `${resolveCity(leg.from || "")} → ${resolveCity(leg.to || "")}`}
                        </span>
                      </div>
                      <p className="text-[10px]" style={{ color: `hsl(var(--p-text-muted))` }}>
                        {formatFlightTime(leg.departure)} → {formatFlightTime(leg.arrival)} · {leg.duration}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Return leg */}
              {selectedFlight.inbound && (() => {
                const ai = getAirlineInfo(selectedFlight.inbound!.airline || selectedFlight.inbound!.flight_number || "");
                return (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl mb-2"
                    style={{ backgroundColor: `hsl(var(--p-surface) / 0.6)`, border: `1px solid hsl(var(--p-border) / 0.3)` }}>
                    <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                      <AirlineLogo code={ai.code} name={ai.name} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase text-accent">
                          {selectedFlight.inter_city_legs?.length ? `${resolveCity(selectedFlight.inbound!.from || "")} → ${resolveCity(selectedFlight.inbound!.to || "")}` : "Return"}
                        </span>
                      </div>
                      <p className="text-[10px]" style={{ color: `hsl(var(--p-text-muted))` }}>
                        {formatFlightTime(selectedFlight.inbound!.departure)} → {formatFlightTime(selectedFlight.inbound!.arrival)} · {selectedFlight.inbound!.duration}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Price + actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: `hsl(var(--p-border) / 0.4)` }}>
                <div>
                  <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: `hsl(var(--p-text-faint))` }}>Total</p>
                  <p className="text-lg font-bold text-primary">{formatPrice(selectedFlight.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline"
                    className="h-8 rounded-xl text-[11px] font-semibold border-primary/20 text-primary hover:bg-primary/5"
                    onClick={onFlightBook}>
                    <Plane className="w-3 h-3 mr-1" /> Book
                  </Button>
                </div>
              </div>
            </div>

            {allFlightsCount > 0 && (
              <div className="border-t px-3 py-2" style={{ borderColor: `hsl(var(--p-border) / 0.5)` }}>
                <Button variant="outline" size="sm"
                  className="w-full h-8 text-[11px] font-semibold gap-1 rounded-lg border-primary/15 text-primary hover:bg-primary/5"
                  onClick={onShowFlights}>
                  <Plane className="w-3 h-3" /> Show {allFlightsCount} Flights
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── HOTELS CARD ── */}
        {selectedHotel && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: `hsl(var(--card))`, border: `1px solid hsl(var(--p-border))` }}>
            <div className="px-4 py-2.5 border-b flex items-center gap-2 bg-accent/[0.04]"
              style={{ borderColor: `hsl(var(--p-border) / 0.5)` }}>
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
                <Hotel className="w-4 h-4 text-accent" />
              </div>
              <span className="text-xs font-bold" style={{ color: `hsl(var(--p-text))` }}>Hotels</span>
              <span className="ml-auto text-[9px] font-bold text-accent bg-accent/10 rounded-full px-2 py-0.5">Best Value</span>
            </div>

            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ background: `hsl(var(--accent) / 0.1)` }}>
                  {hotelImage ? (
                    <img src={hotelImage} alt={selectedHotel.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Hotel className="w-6 h-6 text-accent/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: `hsl(var(--p-text))` }}>{selectedHotel.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: Math.min(selectedHotel.stars, 5) }).map((_, s) => (
                      <Star key={s} className="w-3 h-3 fill-warning text-warning" />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {selectedHotel.room_type && (
                      <span className="text-[10px] rounded px-1.5 py-0.5 font-medium"
                        style={{ color: `hsl(var(--p-text-muted))`, background: `hsl(var(--accent) / 0.08)` }}>
                        {selectedHotel.room_type}
                      </span>
                    )}
                    {(() => {
                      const mb = selectedHotel.meal_basis || "";
                      const hasBreakfast = /breakfast|bb|b&b|half.?board|full.?board|all.?inclusive/i.test(mb);
                      return mb && mb !== "Room Only" ? (
                        <span className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${hasBreakfast ? "text-success bg-success/10" : ""}`}
                          style={!hasBreakfast ? { color: `hsl(var(--p-text-muted))`, background: `hsl(var(--accent) / 0.08)` } : {}}>
                          {mb}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: `hsl(var(--p-border) / 0.4)` }}>
                <div>
                  <p className="text-lg font-bold text-accent">
                    {formatPrice(selectedHotel.price_per_night)}
                    <span className="text-[10px] font-normal" style={{ color: `hsl(var(--p-text-faint))` }}>/night</span>
                  </p>
                  <p className="text-[10px]" style={{ color: `hsl(var(--p-text-faint))` }}>
                    {selectedHotel.nights} nights · {formatPrice(selectedHotel.total_price)} total
                  </p>
                </div>
                <Button size="sm" variant="outline"
                  className="h-8 rounded-xl text-[11px] font-semibold border-accent/30 text-accent hover:bg-accent/5"
                  onClick={onHotelView}>
                  <Hotel className="w-3 h-3 mr-1" /> View Deal
                </Button>
              </div>
            </div>

            {allHotelsCount > 0 && (
              <div className="border-t px-3 py-2" style={{ borderColor: `hsl(var(--p-border) / 0.5)` }}>
                <Button variant="outline" size="sm"
                  className="w-full h-8 text-[11px] font-semibold gap-1 rounded-lg border-accent/15 text-accent hover:bg-accent/5"
                  onClick={onShowHotels}>
                  <Hotel className="w-3 h-3" /> Show {allHotelsCount} Hotels
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ 7. DAY-BY-DAY PREMIUM ITINERARY ═══ */}
        {days.map((day) => {
          const cardData = adaptDayPlanToCardData(day, formatPrice);
          return (
            <ItineraryDayCard
              key={day.day}
              day={cardData}
              defaultOpen={day.day === 1}
              formatPrice={formatPrice}
              onBookDay={() => onBook()}
              onCustomizeDay={() => onCustomize()}
            />
          );
        })}

        {/* ── INLINE PRICE CARD (before sticky bar) ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="mx-3 mb-3 rounded-2xl border overflow-hidden"
          style={{ backgroundColor: `hsl(var(--p-card))`, borderColor: `hsl(var(--primary) / 0.2)`, boxShadow: `0 4px 20px hsl(var(--primary) / 0.08)` }}>
          {/* Price header */}
          <div className="px-4 py-3 border-b" style={{ borderColor: `hsl(var(--p-border))`, background: `linear-gradient(135deg, hsl(var(--primary) / 0.06), transparent)` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>Total Package</p>
                <p className="text-xl font-extrabold text-primary leading-tight">{formatPrice(pkgTotal)}</p>
                {(adults + childCount + infants) > 1 && (
                  <p className="text-[10px] mt-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
                    {formatPrice(Math.round(pkgTotal / (adults + childCount + infants)))} per person approx
                  </p>
                )}
              </div>
              <span className="text-[9px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" /> Live
              </span>
            </div>
          </div>
          {/* Inclusions */}
          <div className="px-4 py-2.5 grid grid-cols-2 gap-1">
            {[
              { label: "Flights included", show: (budgetEstimate.breakdown.flights || 0) > 0 },
              { label: "Hotels included", show: (budgetEstimate.breakdown.hotels || 0) > 0 },
              { label: "Activities included", show: (budgetEstimate.breakdown.activities || 0) > 0 },
              { label: "Transfers included", show: true },
            ].filter(i => i.show).map(({ label }) => (
              <div key={label} className="flex items-center gap-1 text-[10px]" style={{ color: `hsl(var(--p-text-muted))` }}>
                <Check className="w-3 h-3 text-primary shrink-0" />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
          {/* Urgency */}
          <div className="px-4 py-2 border-t flex items-center gap-1.5" style={{ borderColor: `hsl(var(--p-border))` }}>
            <Zap className="w-3 h-3 shrink-0" style={{ color: `hsl(var(--warning))` }} />
            <span className="text-[9px] font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>
              Prices may increase soon
            </span>
          </div>
          {/* Trust */}
          <div className="px-4 py-2 border-t flex items-center justify-center gap-3" style={{ borderColor: `hsl(var(--p-border))` }}>
            <span className="text-[8px] font-medium flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
              <Shield className="w-2.5 h-2.5" /> Secure booking
            </span>
            <span className="text-[8px] font-medium flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
              <Zap className="w-2.5 h-2.5" /> Instant confirmation
            </span>
            <span className="text-[8px] font-medium flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
              <Headphones className="w-2.5 h-2.5" /> 24/7 support
            </span>
          </div>
          {/* PDF */}
          <div className="px-4 py-2 border-t flex justify-center" style={{ borderColor: `hsl(var(--p-border))` }}>
            <button onClick={() => { trackTripEvent("pdf_downloaded", { source: "mobile" }); onDownloadPDF(); }} disabled={pdfDownloading}
              className="flex items-center gap-1.5 text-[10px] font-medium transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ color: `hsl(var(--p-text-muted))` }}>
              {pdfDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {pdfDownloading ? "Generating…" : "Download Itinerary PDF"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* ═══ 10. STICKY BOTTOM CTA BAR ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-30 border-t safe-area-pb"
        style={{
          borderColor: `hsl(var(--p-border))`,
          backgroundColor: `hsl(var(--p-surface) / 0.95)`,
          backdropFilter: 'blur(20px)',
        }}>
        <div className="px-4 pt-2.5 pb-3">
          <div className="flex items-center gap-3">
            {/* Price column */}
            <div className="shrink-0">
              <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: `hsl(var(--p-text-faint))` }}>Package</p>
              <p className="text-base font-extrabold text-primary leading-tight">{formatPrice(pkgTotal)}</p>
            </div>
            {/* CTA buttons */}
            <div className="flex-1 flex gap-2">
              <Button
                onClick={() => { trackTripEvent("booking_clicked", { source: "mobile_sticky_cta" }); onBook(); }}
                disabled={loading}
                className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-bold gap-1.5"
                style={{ boxShadow: `0 0 16px hsl(var(--primary) / 0.3)` }}>
                <ShoppingCart className="w-4 h-4" /> Book Trip
              </Button>
              <Button
                onClick={() => { trackTripEvent("customize_clicked", { source: "mobile_sticky_cta" }); onCustomize(); }}
                disabled={loading}
                variant="outline"
                className="h-11 rounded-xl text-[11px] font-semibold px-3 border-accent/30 text-accent hover:bg-accent/5">
                <PencilLine className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MobileTripResults;
