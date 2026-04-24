import React from "react";
import { motion } from "framer-motion";
import {
  Plane, Clock, Sparkles, Radio, Briefcase, Lightbulb, ArrowRight,
  CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import AirlineLogo from "./AirlineLogo";
import { maskBodyForWire } from "@/lib/flightWireAdapter";

interface FlightDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayItinerary: any;
  getAirlineInfo: (code: string) => { code: string; name: string };
  formatFlightTime: (t: string | undefined) => string;
  formatFlightDate: (dep: string | undefined, date: string | undefined) => string;
  formatDirectPrice: (n: number) => string;
  userSelectedFlight: any;
  userSelectedFlightsByLeg: Record<string, any>;
  allSearchedFlights: any[];
  getBaggageFromRawFlights: (sf: any, flights: any[]) => any;
  flightInfoPopup: any;
  setFlightInfoPopup: React.Dispatch<React.SetStateAction<any>>;
  supabase: any;
  generateFlightInsight: (sf: any, flights: any[]) => string;
  navigateToFlightBooking: (sf: any, flights: any[], travelers: number) => void;
  resolveCity: (code: string) => string;
}

const FlightDetailDialog: React.FC<FlightDetailDialogProps> = ({
  open, onOpenChange, displayItinerary,
  getAirlineInfo, formatFlightTime, formatFlightDate, formatDirectPrice,
  userSelectedFlight, userSelectedFlightsByLeg, allSearchedFlights,
  getBaggageFromRawFlights, flightInfoPopup, setFlightInfoPopup,
  supabase, generateFlightInsight, navigateToFlightBooking, resolveCity,
}) => {
  const sf = displayItinerary?.selected_flight;
  if (!sf) return null;

  const outAi = getAirlineInfo(sf.outbound?.airline || sf.outbound?.flight_number || "");
  const inAi = sf.inbound ? getAirlineInfo(sf.inbound.airline || sf.inbound.flight_number || "") : null;
  const hasReturn = !!sf.inbound;

  const getLayovers = (groupId: string) => {
    const segs = (sf._rawSegments || []).filter((s: any) => String(s.group) === groupId);
    if (segs.length <= 1) return [];
    const layovers: { city: string; code: string; duration: string }[] = [];
    for (let i = 0; i < segs.length - 1; i++) {
      const arrTime = segs[i].arrival || segs[i].arrTime;
      const depTime = segs[i + 1].departure || segs[i + 1].depTime;
      const city = segs[i].destination || segs[i].to || segs[i].da?.name || "";
      const code = segs[i].destinationCode || segs[i].destination || segs[i].to || "";
      let dur = "";
      if (arrTime && depTime) {
        try {
          const diff = new Date(depTime).getTime() - new Date(arrTime).getTime();
          if (diff > 0) {
            const hrs = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            dur = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          }
        } catch {}
      }
      layovers.push({ city, code, duration: dur });
    }
    return layovers;
  };

  const LegDetail = ({ leg, label, ai, layovers }: { leg: any; label: string; ai: any; layovers: { city: string; code: string; duration: string }[] }) => {
    if (!leg) return null;
    const depTime = formatFlightTime(leg.departure);
    const arrTime = formatFlightTime(leg.arrival);
    const displayDate = formatFlightDate(leg.departure, leg.date);
    const stops = (typeof leg.stops === "number" && !isNaN(leg.stops)) ? leg.stops : 0;
    const stopsLabel = stops === 0 ? "Non-stop" : `${stops} stop${stops > 1 ? "s" : ""}`;
    const isDepart = label === "Depart";
    const dotColor = isDepart ? `hsl(var(--primary))` : `hsl(25 95% 60%)`;
    const labelBg = isDepart ? `hsl(var(--primary) / 0.12)` : `hsl(25 95% 60% / 0.12)`;
    const labelColor = isDepart ? `hsl(var(--primary))` : `hsl(25 95% 60%)`;

    return (
      <div className="px-5 py-3.5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest rounded-md px-2.5 py-1" style={{ background: labelBg, color: labelColor }}>
            {label}
          </span>
          {displayDate && (
            <span className="text-[11px] flex items-center gap-1" style={{ color: `hsl(220 15% 68%)` }}>
              <CalendarIcon className="w-3 h-3" /> {displayDate}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1 shrink-0 w-14">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: `hsl(220 25% 23%)`, border: `1px solid hsl(220 22% 26%)` }}>
              <AirlineLogo code={ai.code} name={ai.name} size={28} />
            </div>
            <p className="text-[9px] font-semibold text-center line-clamp-2 leading-tight max-w-[56px]" style={{ color: `hsl(220 15% 70%)` }}>
              {ai.name || "Airline"}
            </p>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-left">
                <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: `hsl(220 15% 93%)` }}>{depTime}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: `hsl(220 15% 70%)` }}>{leg.from}</p>
              </div>
              <div className="flex-1 flex flex-col items-center px-1 gap-0.5">
                {leg.duration && (
                  <p className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: `hsl(220 15% 72%)` }}>
                    <Clock className="w-3 h-3" /> {leg.duration}
                  </p>
                )}
                <div className="w-full flex items-center gap-0.5">
                  <div className="w-1.5 h-1.5 rounded-full border-[1.5px] shrink-0" style={{ borderColor: dotColor }} />
                  <div className="h-px flex-1 border-t border-dashed relative" style={{ borderColor: `hsl(220 25% 28%)` }}>
                    <Plane className="w-3 h-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" style={{ color: dotColor }} />
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                  color: stops === 0 ? `hsl(160 60% 55%)` : `hsl(220 15% 70%)`,
                  backgroundColor: stops === 0 ? `hsl(160 60% 50% / 0.1)` : `hsl(220 25% 23%)`,
                }}>{stopsLabel}</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: `hsl(220 15% 93%)` }}>{arrTime}</p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: `hsl(220 15% 70%)` }}>{leg.to}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {leg.cabin_class && (
                <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5 flex items-center gap-0.5" style={{ color: labelColor, backgroundColor: labelBg }}>
                  💺 {leg.cabin_class}
                </span>
              )}
              {leg.flight_number && (
                <span className="text-[10px] font-mono rounded-full px-2.5 py-0.5" style={{ color: `hsl(220 15% 70%)`, backgroundColor: `hsl(220 26% 24%)` }}>
                  {leg.flight_number}
                </span>
              )}
            </div>
          </div>
        </div>

        {layovers.length > 0 && (
          <div className="mt-2.5 ml-[68px] flex flex-col gap-1">
            {layovers.map((lo, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-medium rounded-md px-2.5 py-1" style={{ background: `hsl(40 90% 50% / 0.08)`, color: `hsl(40 90% 60%)`, border: `1px solid hsl(40 90% 50% / 0.12)` }}>
                <Clock className="w-3 h-3 shrink-0" />
                <span>{lo.duration ? `${lo.duration} layover` : "Layover"}{(lo.city || lo.code) ? ` in ${lo.city || lo.code}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[520px] p-0 overflow-hidden rounded-2xl border-0 [&>button]:text-white/70 [&>button]:hover:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/5 [&>button]:transition-colors [&>button]:right-3 [&>button]:top-3 [&>button]:z-10"
        style={{
          background: `hsl(222 40% 10%)`,
          boxShadow: `0 25px 60px -15px rgba(0,0,0,0.6), inset 0 1px 0 hsl(220 25% 23%)`,
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3.5" style={{ borderBottom: `1px solid hsl(220 25% 23%)`, background: `linear-gradient(180deg, hsl(220 35% 13%) 0%, transparent 100%)` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: `hsl(220 25% 18%)`, border: `1px solid hsl(220 22% 26%)` }}>
              <AirlineLogo code={outAi.code} name={outAi.name} size={28} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-bold tracking-tight" style={{ color: `hsl(220 15% 93%)` }}>Flight Details</DialogTitle>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[9px] font-bold rounded-md px-2 py-0.5 flex items-center gap-0.5" style={{ background: `hsl(var(--primary) / 0.12)`, color: `hsl(var(--primary))` }}>
                  <Sparkles className="w-2.5 h-2.5" /> {(userSelectedFlight || Object.keys(userSelectedFlightsByLeg).length > 0) ? "Your Pick" : "Recommended by Vela AI"}
                </span>
                {sf.is_live_price && (
                  <span className="text-[9px] font-bold rounded-md px-1.5 py-0.5 flex items-center gap-0.5" style={{ background: `hsl(152 60% 45% / 0.12)`, color: `hsl(152 60% 55%)` }}>
                    <Radio className="w-2.5 h-2.5" /> Live
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-extrabold tracking-tight" style={{ color: `hsl(var(--primary))` }}>{formatDirectPrice(sf.price)}</p>
              <p className="text-[10px] mt-0.5" style={{ color: `hsl(220 15% 70%)` }}>
                {hasReturn ? "round trip" : "one way"}
              </p>
            </div>
          </div>
        </div>

        {/* Outbound Leg */}
        <LegDetail leg={sf.outbound} label={sf.inter_city_legs?.length ? `${resolveCity(sf.outbound?.from || "")} → ${resolveCity(sf.outbound?.to || "")}` : "Depart"} ai={outAi} layovers={getLayovers("0")} />

        {/* Inter-city legs */}
        {sf.inter_city_legs?.map((leg: any, legIdx: number) => {
          const legAi = getAirlineInfo(leg.airline || leg.flight_number || "");
          return (
            <React.Fragment key={`dialog-inter-${legIdx}`}>
              <div className="h-[1px] mx-8" style={{ background: `hsl(220 22% 26%)` }} />
              <LegDetail leg={leg} label={leg.label || `${resolveCity(leg.from)} → ${resolveCity(leg.to)}`} ai={legAi} layovers={[]} />
            </React.Fragment>
          );
        })}

        {/* Divider */}
        {hasReturn && <div className="h-[1px] mx-8" style={{ background: `hsl(220 22% 26%)` }} />}

        {/* Return Leg */}
        {hasReturn && <LegDetail leg={sf.inbound} label={sf.inter_city_legs?.length ? `${resolveCity(sf.inbound?.from || "")} → ${resolveCity(sf.inbound?.to || "")}` : "Return"} ai={inAi || outAi} layovers={getLayovers("1")} />}

        {/* Baggage & Fare Rules actions */}
        <div className="flex items-center gap-2 flex-wrap px-5 py-2.5 border-t" style={{ borderColor: `hsl(220 22% 26%)`, background: `hsl(222 28% 16%)` }}>
          <Briefcase className="w-3.5 h-3.5 shrink-0" style={{ color: `hsl(220 15% 68%)` }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(220 15% 70%)` }}>Info</span>
          {(() => {
            const matchedFlight = allSearchedFlights.find((f: any) => {
              if ((sf as any)._rawId && (f.id === (sf as any)._rawId || f.tripjackPriceId === (sf as any)._rawId)) return true;
              const outFn = (sf.outbound?.flight_number || "").replace(/\s+/g, "");
              const fNum = (f.flightNumber || "").replace(/\s+/g, "");
              const seg0Fn = (f.segments?.[0]?.flightNumber || "").replace(/\s+/g, "");
              if (outFn && (fNum === outFn || seg0Fn === outFn || fNum.endsWith(outFn) || outFn.endsWith(fNum))) return true;
              const fFrom = f.from_city || f.segments?.[0]?.origin || "";
              if (fFrom === sf.outbound?.from && f.airline === sf.outbound?.airline) return true;
              return false;
            });
            const flightSource = matchedFlight?.source || (sf as any)._rawSource || (sf as any).source || "";
            const fId = matchedFlight?.tripjackPriceId || matchedFlight?.id || (sf as any)._rawId || "";
            if (!fId || !flightSource) return null;
            return (
              <button
                className="flex items-center gap-1 text-[10px] font-semibold rounded-md px-2.5 py-1.5 transition-all hover:brightness-125"
                style={{ color: `hsl(220 15% 72%)`, background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 25% 24%)` }}
                onClick={() => {
                  const searchBag = getBaggageFromRawFlights(sf, allSearchedFlights) || (matchedFlight ? getBaggageFromRawFlights(sf, [matchedFlight]) : null);
                  if (flightSource === "tripjack" && (searchBag?.cabin || searchBag?.checkin)) {
                    setFlightInfoPopup((prev: any) => prev?.id === fId && prev?.tab === "baggage" ? null : {
                      id: fId, tab: "baggage", loading: false, data: null, flightRef: matchedFlight,
                      _searchBaggage: searchBag,
                    });
                    return;
                  }
                  setFlightInfoPopup((prev: any) => prev?.id === fId && prev?.tab === "baggage" ? null : { id: fId, tab: "baggage", loading: true, data: null, flightRef: matchedFlight });
                  supabase.functions.invoke("unified-flight-search", { body: maskBodyForWire({ action: "ancillaries", source: flightSource, priceId: fId }) })
                    .then(({ data: d }: any) => setFlightInfoPopup((prev: any) => prev?.id === fId ? { ...prev, loading: false, data: d } : prev))
                    .catch(() => setFlightInfoPopup((prev: any) => prev?.id === fId ? { ...prev, loading: false, error: true } : prev));
                }}
              >
                <Briefcase className="w-3 h-3" /> Baggage
              </button>
            );
          })()}
        </div>

        {/* Baggage Info Panel */}
        {flightInfoPopup && flightInfoPopup.tab === "baggage" && (
          <div className="px-5 py-3 border-t" style={{ borderColor: `hsl(220 22% 26%)`, background: `hsl(222 28% 15%)` }}>
            {flightInfoPopup.loading ? (
              <div className="flex items-center gap-2 py-2">
                <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                <span className="text-[11px]" style={{ color: `hsl(220 15% 72%)` }}>Loading baggage info…</span>
              </div>
            ) : (flightInfoPopup as any).error ? (
              <p className="text-[11px] py-1" style={{ color: `hsl(0 60% 60%)` }}>Failed to load baggage info.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: `hsl(220 15% 72%)` }}>
                  <Briefcase className="w-3 h-3" /> Included Baggage
                </p>
                {(() => {
                  const searchBag = (flightInfoPopup as any)?._searchBaggage || getBaggageFromRawFlights(sf, allSearchedFlights);
                  const hasBagFromSearch = searchBag?.cabin || searchBag?.checkin;
                  const d = flightInfoPopup.data;
                  const ssrInfo = d?.ssrInfo || d?.tripjackData?.ssrInfo || d;
                  const baggageList = ssrInfo?.BAGGAGE || d?.baggage || d?.baggageOptions || [];
                  const hasApiExtras = Array.isArray(baggageList) && baggageList.length > 0;
                  const ref = flightInfoPopup.flightRef;
                  const tpBag = ref?.baggageAllowance;
                  const hasTpIncluded = tpBag?.cabin || tpBag?.checkin;

                  if (hasBagFromSearch || hasTpIncluded) {
                    const cabin = searchBag?.cabin || tpBag?.cabin || "";
                    const checkin = searchBag?.checkin || tpBag?.checkin || "";
                    return (
                      <>
                        <div className="space-y-1.5">
                          {cabin && (
                            <div className="flex items-center justify-between text-[11px] rounded-md px-2.5 py-2" style={{ background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}>
                              <span className="flex items-center gap-1.5" style={{ color: `hsl(220 15% 75%)` }}>🧳 Cabin Baggage</span>
                              <span className="font-bold" style={{ color: `hsl(var(--primary))` }}>{cabin}</span>
                            </div>
                          )}
                          {checkin && (
                            <div className="flex items-center justify-between text-[11px] rounded-md px-2.5 py-2" style={{ background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}>
                              <span className="flex items-center gap-1.5" style={{ color: `hsl(220 15% 75%)` }}>🎒 Check-in Baggage</span>
                              <span className="font-bold" style={{ color: `hsl(var(--primary))` }}>{typeof checkin === 'string' ? checkin : JSON.stringify(checkin)}</span>
                            </div>
                          )}
                        </div>
                        {hasApiExtras && (
                          <>
                            <p className="text-[10px] font-bold uppercase tracking-wider mt-3 flex items-center gap-1.5" style={{ color: `hsl(220 15% 72%)` }}>Extra Baggage Options</p>
                            {baggageList.slice(0, 6).map((b: any, bi: number) => (
                              <div key={bi} className="flex items-center justify-between text-[11px] rounded-md px-2.5 py-1.5" style={{ background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}>
                                <span style={{ color: `hsl(220 15% 75%)` }}>{b.desc || b.description || `${b.weight || b.code || "Baggage"}`}</span>
                                {b.amount !== undefined && <span className="font-bold" style={{ color: `hsl(var(--primary))` }}>{formatDirectPrice(b.amount)}</span>}
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    );
                  }
                  if (hasApiExtras) {
                    return baggageList.slice(0, 8).map((b: any, bi: number) => (
                      <div key={bi} className="flex items-center justify-between text-[11px] rounded-md px-2.5 py-1.5" style={{ background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}>
                        <span style={{ color: `hsl(220 15% 75%)` }}>{b.desc || b.description || `${b.weight || b.code || "Baggage"}`}</span>
                        {b.amount !== undefined && <span className="font-bold" style={{ color: `hsl(var(--primary))` }}>{formatDirectPrice(b.amount)}</span>}
                      </div>
                    ));
                  }
                  return <p className="text-[11px]" style={{ color: `hsl(220 15% 72%)` }}>No baggage details available for this fare.</p>;
                })()}
              </div>
            )}
          </div>
        )}

        {/* AI Insight */}
        {(sf.reason || sf.outbound) && (
          <div className="px-5 py-2.5 border-t" style={{ borderColor: `hsl(220 22% 26%)`, background: `hsl(222 28% 16%)` }}>
            <p className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: `hsl(var(--primary))` }}>
              <Lightbulb className="w-3.5 h-3.5 shrink-0" />
              AI Insight: {generateFlightInsight(sf, allSearchedFlights)}
            </p>
          </div>
        )}

        {/* Summary */}
        {sf.summary && (
          <div className="px-5 py-2 text-[11px] leading-relaxed" style={{ color: `hsl(220 15% 68%)` }}>
            {sf.summary}
          </div>
        )}

        {/* CTA */}
        <div className="px-5 py-4 border-t" style={{ borderColor: `hsl(220 22% 26%)` }}>
          <Button
            className="w-full h-11 rounded-xl font-bold text-sm gap-2 transition-all duration-200"
            style={{
              background: `linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.85))`,
              color: `white`,
              boxShadow: `0 0 20px hsl(var(--accent) / 0.3), 0 4px 16px hsl(var(--accent) / 0.2)`,
            }}
            onClick={() => {
              if (sf.is_live_price) {
                navigateToFlightBooking(sf, allSearchedFlights, displayItinerary.travelers || 1);
              } else if (sf.outbound) {
                const params = new URLSearchParams({
                  from: sf.outbound.from, to: sf.outbound.to,
                  departDate: sf.outbound.date || '',
                  ...(sf.inbound?.date ? { returnDate: sf.inbound.date } : {}),
                  adults: String(displayItinerary.travelers || 1),
                  cabinClass: sf.outbound.cabin_class || 'Economy',
                });
                window.open(`/flights?${params.toString()}`, '_blank');
              }
              onOpenChange(false);
            }}
          >
            {sf.is_live_price ? "Book This Flight" : "Search & Book"} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlightDetailDialog;
