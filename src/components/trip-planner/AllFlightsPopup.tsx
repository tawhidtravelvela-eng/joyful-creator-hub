import React from "react";
import { motion } from "framer-motion";
import {
  Plane, Clock, Sparkles, Check, X, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import AirlineLogo from "./AirlineLogo";
import { maskBodyForWire } from "@/lib/flightWireAdapter";

interface AllFlightsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allSearchedFlights: any[];
  displayItinerary: any;
  formatDirectPrice: (n: number) => string;
  formatFlightTime: (t: string | undefined) => string;
  getAirlineInfo: (code: string) => { code: string; name: string };
  formatAirlineDisplay: (ai: { code: string; name: string }) => string;
  prefixFlightNumber: (fn: string, airline: string) => string;
  computeFlightDuration: (dep: string | undefined, arr: string | undefined) => string;
  getBaggageFromRawFlights: (sf: any, flights: any[]) => any;
  resolveCity: (code: string) => string;
  userSelectedFlight: any;
  setUserSelectedFlight: (f: any) => void;
  userSelectedFlightsByLeg: Record<string, any>;
  setUserSelectedFlightsByLeg: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  flightFilterStops: number | null;
  setFlightFilterStops: (s: number | null) => void;
  flightFilterAirline: string | null;
  setFlightFilterAirline: (a: string | null) => void;
  flightSortBy: string;
  setFlightSortBy: (s: string) => void;
  flightLegTab: string;
  setFlightLegTab: (t: string) => void;
  flightInfoPopup: any;
  setFlightInfoPopup: React.Dispatch<React.SetStateAction<any>>;
  supabase: any;
  toast: (opts: any) => void;
}

const AllFlightsPopup: React.FC<AllFlightsPopupProps> = ({
  open, onOpenChange, allSearchedFlights, displayItinerary,
  formatDirectPrice, formatFlightTime, getAirlineInfo, formatAirlineDisplay,
  prefixFlightNumber, computeFlightDuration, getBaggageFromRawFlights, resolveCity,
  userSelectedFlight, setUserSelectedFlight, userSelectedFlightsByLeg, setUserSelectedFlightsByLeg,
  flightFilterStops, setFlightFilterStops, flightFilterAirline, setFlightFilterAirline,
  flightSortBy, setFlightSortBy, flightLegTab, setFlightLegTab,
  flightInfoPopup, setFlightInfoPopup, supabase, toast,
}) => {
  const getFlightStops = (f: any) => f.stops ?? (f.segments ? Math.max(0, f.segments.length - 1) : 0);
  const getOutboundSegs = (f: any) => (f.segments || []).filter((s: any) => String(s.group) === "0" || !s.group);
  const getReturnSegs = (f: any) => {
    const grouped = (f.segments || []).filter((s: any) => String(s.group) === "1");
    if (grouped.length > 0) return grouped;
    if (f.return_leg) {
      const rl = f.return_leg;
      return [{ from: rl.from || rl.origin || f.to_city || "", to: rl.to || rl.destination || f.from_city || "", departure: rl.departure || rl.departureTime || "", arrival: rl.arrival || rl.arrivalTime || "", airline: rl.airline || f.airline || "", flightNumber: rl.flight_number || rl.flightNumber || "", duration: rl.duration || "", stops: rl.stops ?? 0, group: "1", _synthetic: true }];
    }
    return [];
  };
  const getLayoverInfo = (segs: any[]) => {
    if (segs.length <= 1) return [];
    const layovers: { city: string; duration: string }[] = [];
    for (let i = 0; i < segs.length - 1; i++) {
      const arrTime = segs[i].arrival || segs[i].arrivalTime;
      const depTime = segs[i + 1].departure || segs[i + 1].departureTime;
      let durationStr = "";
      if (arrTime && depTime) {
        const arr = new Date(arrTime).getTime();
        const dep = new Date(depTime).getTime();
        if (!isNaN(arr) && !isNaN(dep) && dep > arr) {
          const mins = Math.round((dep - arr) / 60000);
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        }
      }
      if (!durationStr && segs[i].cT) {
        const mins = Math.round(segs[i].cT / 60);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
      layovers.push({ city: segs[i].to || segs[i].destination || "—", duration: durationStr });
    }
    return layovers;
  };
  const calcLegDuration = (segs: any[]) => {
    if (!segs.length) return "";
    const firstDep = segs[0]?.departure || segs[0]?.departureTime;
    const lastArr = segs[segs.length - 1]?.arrival || segs[segs.length - 1]?.arrivalTime;
    if (firstDep && lastArr) {
      const dep = new Date(firstDep).getTime();
      const arr = new Date(lastArr).getTime();
      if (!isNaN(dep) && !isNaN(arr) && arr > dep) {
        const mins = Math.round((arr - dep) / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
    }
    return "";
  };
  const getBaggage = (f: any) => {
    const bag = getBaggageFromRawFlights(displayItinerary?.selected_flight, [f]) || {};
    const segs = f.segments || [];
    let cabin = bag.cabin || "";
    let checkin = bag.checkin || "";
    if (!cabin && segs[0]?.baggage?.cabin) cabin = segs[0].baggage.cabin;
    if (!checkin && segs[0]?.baggage?.checkin) checkin = segs[0].baggage.checkin;
    if (!checkin && f.baggage) checkin = typeof f.baggage === "string" ? f.baggage : f.baggage?.checkin || "";
    if (!cabin && f.cabinBaggage) cabin = typeof f.cabinBaggage === "string" ? f.cabinBaggage : "";
    return { cabin, checkin };
  };

  const allAirlines = Array.from(new Set(allSearchedFlights.map((f: any) => getAirlineInfo(f.airline || f.flightNumber || "").name).filter(Boolean)));
  const allStopCounts = Array.from(new Set(allSearchedFlights.map(getFlightStops))).sort();

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setFlightFilterStops(null);
      setFlightFilterAirline(null);
      setFlightSortBy("price");
      setFlightInfoPopup(null);
      setFlightLegTab("all");
    }
  };

  const LegVisual = ({ segs, label, colorClass, f }: { segs: any[]; label: string; colorClass: string; f: any }) => {
    if (!segs.length) return null;
    const depTime = formatFlightTime(segs[0]?.departure || segs[0]?.departureTime);
    const arrTime = formatFlightTime(segs[segs.length - 1]?.arrival || segs[segs.length - 1]?.arrivalTime);
    const fromCode = resolveCity(segs[0]?.from || segs[0]?.origin || f.from_city || "—");
    const toCode = resolveCity(segs[segs.length - 1]?.to || segs[segs.length - 1]?.destination || f.to_city || "—");
    const isSynthetic = segs.length === 1 && (segs[0] as any)?._synthetic;
    const stops = isSynthetic ? (segs[0].stops ?? 0) : Math.max(0, segs.length - 1);
    const dur = isSynthetic
      ? (segs[0].duration || f.return_leg?.duration || computeFlightDuration(segs[0]?.departure, segs[segs.length - 1]?.arrival))
      : calcLegDuration(segs);
    const layovers = getLayoverInfo(segs);

    const legFlightNumbers = segs.map((seg) => {
      const segAirline = seg?.airline || seg?.carrier || f.airline || "";
      const segFn = seg?.flightNumber || seg?.fD?.fN || "";
      return prefixFlightNumber(segFn, segAirline);
    }).filter(Boolean);
    const uniqueFlightNums = [...new Set(legFlightNumbers)];

    const isPrimary = colorClass === "primary";
    const dotColor = isPrimary ? `hsl(var(--primary))` : `hsl(25 95% 60%)`;
    const lineColor = isPrimary ? `hsl(var(--primary) / 0.35)` : `hsl(25 95% 60% / 0.35)`;
    const labelBg = isPrimary ? `hsl(var(--primary) / 0.12)` : `hsl(25 95% 60% / 0.12)`;
    const labelColor = isPrimary ? `hsl(var(--primary))` : `hsl(25 95% 60%)`;

    return (
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-bold rounded-md px-2 py-1 shrink-0 text-center" style={{ background: labelBg, color: labelColor }}>
            {label}
          </span>
          {uniqueFlightNums.length > 0 && uniqueFlightNums.map((fn, fi) => (
            <span key={fi} className="text-[10px] font-mono font-medium rounded-md px-1.5 py-[2px]" style={{ color: `hsl(220 15% 70%)`, background: `hsl(220 26% 24%)` }}>
              {fn}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 pl-1">
          <div className="text-center shrink-0 min-w-[50px]">
            <p className="text-sm font-bold tabular-nums leading-none" style={{ color: `hsl(220 15% 90%)` }}>{depTime}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: `hsl(220 15% 68%)` }}>{fromCode}</p>
          </div>

          <div className="flex-1 flex flex-col items-center min-w-[80px]">
            <p className="text-[9px] font-medium mb-1" style={{ color: `hsl(220 15% 72%)` }}>
              {dur || "—"}{stops > 0 ? ` · ${stops} stop${stops > 1 ? "s" : ""}` : " · Direct"}
            </p>
            <div className="w-full flex items-center">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
              <div className="flex-1 h-[1.5px] relative" style={{ background: lineColor }}>
                {stops > 0 && layovers.map((l, si) => (
                  <div key={si} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${((si + 1) / (stops + 1)) * 100}%`, transform: `translate(-50%, -50%)` }}>
                    <div className="w-[7px] h-[7px] rounded-full" style={{ background: `hsl(220 25% 23%)`, border: `1.5px solid ${dotColor}` }} />
                  </div>
                ))}
              </div>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />
            </div>
            {layovers.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center">
                {layovers.map((l, li) => (
                  <span key={li} className="inline-flex items-center gap-1 text-[9px] font-medium rounded-md px-1.5 py-[1px]" style={{ color: `hsl(35 80% 60%)`, backgroundColor: `hsl(35 80% 50% / 0.08)`, border: `1px solid hsl(35 80% 50% / 0.12)` }}>
                    <Clock className="w-2.5 h-2.5" />
                    {l.duration ? `${l.duration} in ${l.city}` : `via ${l.city}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-center shrink-0 min-w-[50px]">
            <p className="text-sm font-bold tabular-nums leading-none" style={{ color: `hsl(220 15% 90%)` }}>{arrTime}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: `hsl(220 15% 68%)` }}>{toCode}</p>
          </div>
        </div>
      </div>
    );
  };

  // Filter and sort
  let filtered = [...allSearchedFlights];
  if (flightLegTab !== "all") {
    filtered = filtered.filter((f: any) => f._legLabel === flightLegTab);
  }
  if (flightFilterStops !== null) filtered = filtered.filter((f: any) => getFlightStops(f) === flightFilterStops);
  if (flightFilterAirline) filtered = filtered.filter((f: any) => getAirlineInfo(f.airline || f.flightNumber || "").name === flightFilterAirline);

  const getLegDurationMins = (segs: any[]) => {
    if (!segs.length) return 0;
    const firstDep = segs[0]?.departure || segs[0]?.departureTime;
    const lastArr = segs[segs.length - 1]?.arrival || segs[segs.length - 1]?.arrivalTime;
    const dep = firstDep ? new Date(firstDep).getTime() : NaN;
    const arr = lastArr ? new Date(lastArr).getTime() : NaN;
    return !isNaN(dep) && !isNaN(arr) && arr > dep ? Math.round((arr - dep) / 60000) : 0;
  };
  const getTotalDurationMins = (f: any) => {
    const outSegs = getOutboundSegs(f);
    const retSegs = getReturnSegs(f);
    const allSegs = f.segments || [];
    const outMins = getLegDurationMins(outSegs.length > 0 ? outSegs : allSegs);
    const retMins = retSegs.length > 0 ? getLegDurationMins(retSegs) : 0;
    return (outMins + retMins) || 9999;
  };

  filtered.sort((a: any, b: any) => {
    if (flightSortBy === "duration") return getTotalDurationMins(a) - getTotalDurationMins(b);
    if (flightSortBy === "stops") return getFlightStops(a) - getFlightStops(b);
    return (a.price || 0) - (b.price || 0);
  });

  const isMultiLeg = allSearchedFlights.some((fl: any) => fl._legType);
  filtered.sort((a: any, b: any) => {
    const aSelected = isMultiLeg ? (a._legLabel && userSelectedFlightsByLeg[a._legLabel]?.id === a.id) : userSelectedFlight?.id === a.id;
    const bSelected = isMultiLeg ? (b._legLabel && userSelectedFlightsByLeg[b._legLabel]?.id === b.id) : userSelectedFlight?.id === b.id;
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return 0;
  });

  const cheapestPrice = filtered.length > 0 ? Math.min(...filtered.map((f: any) => f.price || Infinity)) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[640px] max-h-[92vh] flex flex-col p-0 overflow-hidden border-0 rounded-2xl [&>button]:text-white/70 [&>button]:hover:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/5 [&>button]:transition-colors" style={{ background: `hsl(222 40% 10%)`, boxShadow: `0 25px 60px -15px rgba(0,0,0,0.6), inset 0 1px 0 hsl(220 28% 20%)` }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3.5" style={{ borderBottom: `1px solid hsl(220 25% 23%)` }}>
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`, boxShadow: `0 4px 12px hsl(var(--primary) / 0.25)` }}>
              <Plane className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight" style={{ color: `hsl(220 15% 93%)` }}>Available Flights</h2>
              <p className="text-[11px] mt-0.5" style={{ color: `hsl(220 15% 68%)` }}>
                {allSearchedFlights.length} option{allSearchedFlights.length !== 1 ? "s" : ""} · Sorted by {flightSortBy === "price" ? "lowest price" : flightSortBy === "duration" ? "shortest duration" : "fewest stops"}
              </p>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 p-[3px] rounded-lg" style={{ background: `hsl(220 25% 23%)`, border: `1px solid hsl(220 22% 26%)` }}>
              {[null, ...allStopCounts].map((s) => (
                <button key={String(s)} onClick={() => setFlightFilterStops(s)} className="px-2.5 py-[5px] rounded-md text-[11px] font-semibold transition-all whitespace-nowrap" style={flightFilterStops === s ? { background: `hsl(var(--primary))`, color: `white`, boxShadow: `0 1px 6px hsl(var(--primary) / 0.35)` } : { color: `hsl(220 15% 68%)` }}>
                  {s === null ? "All" : s === 0 ? "Direct" : `${s} Stop${s > 1 ? "s" : ""}`}
                </button>
              ))}
            </div>

            {allAirlines.length > 1 && (
              <select className="h-7 text-[11px] font-medium rounded-lg px-2.5 outline-none cursor-pointer appearance-none pr-6" style={{ backgroundColor: `hsl(220 25% 23%)`, border: `1px solid hsl(220 22% 26%)`, color: `hsl(220 15% 70%)`, backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 4px center`, backgroundRepeat: `no-repeat`, backgroundSize: `16px` }} onChange={(e) => setFlightFilterAirline(e.target.value === "all" ? null : e.target.value)} defaultValue="all">
                <option value="all">All Airlines</option>
                {allAirlines.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}

            <div className="flex items-center gap-0.5 p-[3px] rounded-lg ml-auto" style={{ background: `hsl(220 25% 23%)`, border: `1px solid hsl(220 22% 26%)` }}>
              {["price", "duration", "stops"].map(s => (
                <button key={s} onClick={() => setFlightSortBy(s)} className="px-2.5 py-[5px] rounded-md text-[11px] font-semibold transition-all capitalize whitespace-nowrap" style={flightSortBy === s ? { background: `hsl(var(--primary))`, color: `white`, boxShadow: `0 1px 6px hsl(var(--primary) / 0.35)` } : { color: `hsl(220 15% 68%)` }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Leg Tabs (multi-city) */}
          {(() => {
            const hasMultiLeg = allSearchedFlights.some((f: any) => f._legType);
            if (!hasMultiLeg) return null;
            const legLabels = [...new Set(allSearchedFlights.map((f: any) => f._legLabel).filter(Boolean))];
            legLabels.sort((a, b) => {
              const aFlights = allSearchedFlights.filter((f: any) => f._legLabel === a);
              const bFlights = allSearchedFlights.filter((f: any) => f._legLabel === b);
              const getEarliestDep = (flights: any[]) => {
                const dates = flights.map((f: any) => { const segs = f.segments || []; return segs[0]?.departure || f.departure || ""; }).filter(Boolean).sort();
                return dates[0] || "9999";
              };
              const typeOrder: Record<string, number> = { outbound: 0, intercity: 1, return: 2 };
              const aType = aFlights[0]?._legType || "intercity";
              const bType = bFlights[0]?._legType || "intercity";
              if (typeOrder[aType] !== typeOrder[bType]) return (typeOrder[aType] ?? 1) - (typeOrder[bType] ?? 1);
              return getEarliestDep(aFlights).localeCompare(getEarliestDep(bFlights));
            });
            return (
              <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                <button onClick={() => setFlightLegTab("all")} className="text-[10px] font-bold rounded-full px-3 py-1.5 transition-all whitespace-nowrap" style={flightLegTab === "all" ? { background: `hsl(var(--primary))`, color: `white`, boxShadow: `0 2px 8px hsl(var(--primary) / 0.3)` } : { color: `hsl(220 15% 72%)`, background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}>
                  All ({allSearchedFlights.length})
                </button>
                {legLabels.map(label => {
                  const count = allSearchedFlights.filter((f: any) => f._legLabel === label).length;
                  const isLegSelected = !!userSelectedFlightsByLeg[label];
                  return (
                    <button key={label} onClick={() => setFlightLegTab(label)} className="text-[10px] font-bold rounded-full px-3 py-1.5 transition-all whitespace-nowrap flex items-center gap-1" style={flightLegTab === label ? { background: `hsl(var(--primary))`, color: `white`, boxShadow: `0 2px 8px hsl(var(--primary) / 0.3)` } : isLegSelected ? { color: `hsl(152 60% 55%)`, background: `hsl(152 60% 45% / 0.12)`, border: `1px solid hsl(152 60% 45% / 0.2)` } : { color: `hsl(220 15% 72%)`, background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}>
                      {isLegSelected && <Check className="w-2.5 h-2.5" />}<Plane className="w-2.5 h-2.5" /> {label} ({count})
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Flight List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: `hsl(220 22% 26%) transparent` }}>
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-sm" style={{ color: `hsl(220 15% 70%)` }}>No flights match your filters.</div>
          ) : filtered.map((f: any, i: number) => {
            const ai = getAirlineInfo(f.airline || f.flightNumber || "");
            const isSelected = isMultiLeg ? (f._legLabel && userSelectedFlightsByLeg[f._legLabel]?.id === f.id) : userSelectedFlight?.id === f.id;
            const isAiPick = isMultiLeg ? (!userSelectedFlightsByLeg[f._legLabel] && i === 0) : (!userSelectedFlight && i === 0);
            const isCheapest = f.price === cheapestPrice && i === filtered.indexOf(filtered.find((x: any) => x.price === cheapestPrice)!);
            const outSegs = getOutboundSegs(f);
            const retSegs = getReturnSegs(f);
            const hasReturn = retSegs.length > 0 || !!f.return_leg;
            const baggage = getBaggage(f);

            return (
              <motion.div key={f.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }} className="group rounded-xl overflow-hidden transition-all" style={{ background: isSelected ? `hsl(220 35% 16%)` : `hsl(222 30% 15%)`, border: isSelected ? `1.5px solid hsl(var(--primary) / 0.5)` : `1px solid hsl(220 25% 18%)`, boxShadow: isSelected ? `0 0 24px hsl(var(--primary) / 0.08), inset 0 1px 0 hsl(var(--primary) / 0.1)` : `inset 0 1px 0 hsl(220 25% 23%)` }}>
                <div className="flex items-center gap-3 px-4 pt-3.5 pb-1">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ backgroundColor: `hsl(220 25% 23%)`, border: `1px solid hsl(220 22% 26%)` }}>
                    <AirlineLogo code={ai.code} name={ai.name} size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: `hsl(220 15% 85%)` }}>
                      {formatAirlineDisplay(ai)}{ai.code ? <span className="font-normal ml-1" style={{ color: `hsl(220 15% 72%)` }}>· {f.flightNumber || ""}</span> : ""}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isAiPick && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold rounded-md px-1.5 py-[2px]" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08))`, color: `hsl(var(--primary))`, border: `1px solid hsl(var(--primary) / 0.15)` }}>
                          <Sparkles className="w-2.5 h-2.5" /> Recommended
                        </span>
                      )}
                      {isCheapest && (
                        <span className="text-[9px] font-bold rounded-md px-1.5 py-[2px]" style={{ background: `hsl(152 60% 45% / 0.12)`, color: `hsl(152 60% 55%)`, border: `1px solid hsl(152 60% 45% / 0.1)` }}>
                          Lowest Price
                        </span>
                      )}
                      {f.isRefundable && <span className="text-[9px] font-medium rounded-md px-1.5 py-[2px]" style={{ color: `hsl(220 15% 72%)`, background: `hsl(220 26% 24%)` }}>Refundable</span>}
                      {f.cabinClass && f.cabinClass !== "Economy" && <span className="text-[9px] font-medium rounded-md px-1.5 py-[2px]" style={{ color: `hsl(45 80% 60%)`, background: `hsl(45 80% 60% / 0.1)` }}>{f.cabinClass}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-3">
                    <p className="text-xl font-extrabold tracking-tight leading-none" style={{ color: `hsl(var(--primary))` }}>{formatDirectPrice(f.price)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: `hsl(220 15% 70%)` }}>{hasReturn ? "round trip" : "one way"}</p>
                  </div>
                </div>

                <div className="px-4 pt-0.5 pb-1">
                  {outSegs.length > 0 && <LegVisual segs={outSegs} label={f._legLabel || "Outbound"} colorClass="primary" f={f} />}
                  {hasReturn && (
                    <>
                      <div className="h-[1px] mx-8" style={{ background: `hsl(220 25% 14%)` }} />
                      <LegVisual segs={retSegs} label="Return" colorClass="accent" f={f} />
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 mt-0.5" style={{ borderTop: `1px solid hsl(220 22% 26%)`, background: `hsl(220 25% 23%)` }}>
                  <div className="flex items-center gap-1.5">
                    <button className="flex items-center gap-1 text-[10px] font-semibold rounded-md px-2.5 py-1.5 transition-all hover:brightness-125" style={{ color: `hsl(220 15% 72%)`, background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 25% 24%)` }} onClick={(e) => {
                      e.stopPropagation();
                      const fId = f.tripjackPriceId || f.id;
                      if (!fId) { toast({ title: "Baggage info unavailable", variant: "destructive" }); return; }
                      const flightSource = f.source || "tripjack";
                      const searchBag = getBaggage(f);
                      if (flightSource === "tripjack" && (searchBag.cabin || searchBag.checkin)) {
                        setFlightInfoPopup((prev: any) => prev?.id === fId && prev?.tab === "baggage" ? null : { id: fId, tab: "baggage", loading: false, data: null, flightRef: f, _searchBaggage: searchBag });
                        return;
                      }
                      setFlightInfoPopup((prev: any) => prev?.id === fId && prev?.tab === "baggage" ? null : { id: fId, tab: "baggage", loading: true, data: null, flightRef: f });
                      supabase.functions.invoke("unified-flight-search", { body: maskBodyForWire({ action: "ancillaries", source: flightSource, priceId: fId }) })
                        .then(({ data: d }: any) => setFlightInfoPopup((prev: any) => prev?.id === fId ? { ...prev, loading: false, data: d } : prev))
                        .catch(() => setFlightInfoPopup((prev: any) => prev?.id === fId ? { ...prev, loading: false, error: true } : prev));
                    }}>
                      <Briefcase className="w-3 h-3" /> Baggage
                    </button>
                    {f.isRefundable && <span className="px-1.5 py-[1px] rounded text-[9px] font-medium" style={{ background: `hsl(152 60% 45% / 0.1)`, color: `hsl(152 60% 50%)` }}>Refundable</span>}
                  </div>

                  <Button size="sm" className={cn("h-8 text-xs rounded-lg px-5 font-bold transition-all", isSelected ? "bg-transparent hover:bg-primary/5" : "hover:opacity-90")} style={isSelected ? { border: `1.5px solid hsl(var(--primary) / 0.4)`, color: `hsl(var(--primary))` } : { background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))`, color: `white`, boxShadow: `0 2px 10px hsl(var(--primary) / 0.3)` }} onClick={(e) => {
                    e.stopPropagation();
                    if (isMultiLeg && f._legLabel) {
                      setUserSelectedFlightsByLeg(prev => {
                        const next = { ...prev };
                        if (isSelected) { delete next[f._legLabel]; } else { next[f._legLabel] = f; }
                        return next;
                      });
                      setUserSelectedFlight(null);
                    } else {
                      setUserSelectedFlight(isSelected ? null : f);
                      if (!isSelected) onOpenChange(false);
                    }
                  }}>
                    {isSelected ? <><Check className="w-3.5 h-3.5 mr-1" /> Selected</> : "Select Flight"}
                  </Button>
                </div>

                {/* Expandable Baggage Panel */}
                {flightInfoPopup && flightInfoPopup.id === (f.tripjackPriceId || f.id) && (
                  <div className="px-4 py-3 border-t" style={{ borderColor: `hsl(220 22% 26%)`, background: `hsl(222 28% 15%)` }}>
                    {flightInfoPopup.loading ? (
                      <div className="flex items-center gap-2 py-2">
                        <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                        <span className="text-[11px]" style={{ color: `hsl(220 15% 68%)` }}>Loading baggage info...</span>
                      </div>
                    ) : flightInfoPopup.error ? (
                      <p className="text-[11px] py-1" style={{ color: `hsl(0 60% 60%)` }}>Failed to load. Try again later.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: `hsl(220 15% 72%)` }}>
                          <Briefcase className="w-3 h-3" /> Included Baggage
                        </p>
                        {(() => {
                          const searchBag = (flightInfoPopup as any)?._searchBaggage || getBaggage(flightInfoPopup.flightRef || f);
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
                                  {cabin && <div className="flex items-center justify-between text-[11px] rounded-md px-2.5 py-2" style={{ background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}><span className="flex items-center gap-1.5" style={{ color: `hsl(220 15% 75%)` }}>🧳 Cabin Baggage</span><span className="font-bold" style={{ color: `hsl(var(--primary))` }}>{cabin}</span></div>}
                                  {checkin && <div className="flex items-center justify-between text-[11px] rounded-md px-2.5 py-2" style={{ background: `hsl(220 26% 24%)`, border: `1px solid hsl(220 22% 28%)` }}><span className="flex items-center gap-1.5" style={{ color: `hsl(220 15% 75%)` }}>🎒 Check-in Baggage</span><span className="font-bold" style={{ color: `hsl(var(--primary))` }}>{typeof checkin === 'string' ? checkin : JSON.stringify(checkin)}</span></div>}
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
                    <button className="mt-2 text-[10px] font-medium flex items-center gap-1 transition-colors" style={{ color: `hsl(220 15% 72%)` }} onClick={(e) => { e.stopPropagation(); setFlightInfoPopup(null); }}>
                      <X className="w-3 h-3" /> Close
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Done Button for multi-leg */}
        {isMultiLeg && (
          <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderTop: `1px solid hsl(220 25% 18%)`, background: `hsl(222 30% 11%)` }}>
            <p className="text-xs" style={{ color: `hsl(220 15% 65%)` }}>
              {Object.keys(userSelectedFlightsByLeg).length} of {[...new Set(allSearchedFlights.map((f: any) => f._legLabel).filter(Boolean))].length} legs changed
            </p>
            <Button size="sm" className="h-9 px-6 text-sm font-bold rounded-lg" style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))`, color: `white`, boxShadow: `0 2px 12px hsl(var(--primary) / 0.3)` }} onClick={() => { onOpenChange(false); setFlightInfoPopup(null); setFlightLegTab("all"); }}>
              <Check className="w-3.5 h-3.5 mr-1" /> Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AllFlightsPopup;
