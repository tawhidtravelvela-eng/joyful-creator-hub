import React from "react";
import { Plane, Clock, CalendarIcon, Lightbulb, Briefcase } from "lucide-react";
import { Calendar as CalendarLucide } from "lucide-react";
import { cn } from "@/lib/utils";
import AirlineLogo from "./AirlineLogo";
import {
  getAirlineInfo, formatAirlineDisplay, formatFlightTime, formatFlightDate, resolveCity,
} from "./tripPricingUtils";

interface FlightLegRowProps {
  label: string;
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  date?: string;
  duration: string;
  stops: number;
  cabinClass?: string;
  className?: string;
}

const FlightLegRow: React.FC<FlightLegRowProps> = ({
  label, airline, flightNo, from: rawFrom, to: rawTo, departure, arrival, date, duration, stops, cabinClass, className = "",
}) => {
  const from = resolveCity(rawFrom);
  const to = resolveCity(rawTo);
  const ai = getAirlineInfo(airline || flightNo || "");
  const safeStops = typeof stops === "number" && !isNaN(stops) ? stops : 0;
  const stopsLabel = safeStops === 0 ? "Non-stop" : `${safeStops} stop${safeStops > 1 ? "s" : ""}`;
  const depTime = formatFlightTime(departure);
  const arrTime = formatFlightTime(arrival);
  const displayDate = formatFlightDate(departure, date);

  const isTBD = depTime === "TBD" || arrTime === "TBD";
  const cleanAirline = airline?.replace(/^Estimated\s*\(?/i, "").replace(/\)?\s*$/, "").replace(/\.{2,}$/, "") || "";
  const hasRealAirline = cleanAirline && cleanAirline !== "TBD" && cleanAirline.length > 1;

  const isDepart = label === "Depart";
  const accentColor = isDepart ? `hsl(var(--primary))` : `hsl(var(--accent))`;
  const accentBg = isDepart ? `hsl(var(--primary) / 0.1)` : `hsl(var(--accent) / 0.1)`;
  const accentBorder = isDepart ? `hsl(var(--primary) / 0.2)` : `hsl(var(--accent) / 0.2)`;

  if (isTBD) {
    return (
      <div className={cn("py-3", className)}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
            style={{ color: accentColor, backgroundColor: accentBg, border: `1px solid ${accentBorder}` }}>
            {label}
          </span>
          {displayDate && (
            <span className="text-[11px] flex items-center gap-1" style={{ color: `hsl(var(--p-text-muted))` }}>
              <CalendarLucide className="w-3 h-3" /> {displayDate}
            </span>
          )}
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: `hsl(var(--p-surface))`, border: `1px solid ${accentBorder}` }}>
          <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-left flex-shrink-0">
                <p className="text-2xl font-black tracking-tight leading-none" style={{ color: `hsl(var(--p-text))` }}>{from}</p>
                <p className="text-[10px] mt-1 font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>Origin</p>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1.5 px-3 min-w-[120px]">
                {duration && (
                  <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: `hsl(var(--p-text-subtle))` }}>
                    <Clock className="w-3 h-3" /> {duration}
                  </div>
                )}
                <div className="w-full flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style={{ borderColor: accentColor, boxShadow: `0 0 6px ${accentColor}40` }} />
                  <div className="h-[2px] flex-1 rounded-full relative overflow-hidden" style={{ background: `linear-gradient(90deg, ${accentColor}80, ${accentColor}25, ${accentColor}80)` }}>
                    <Plane className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" style={{ color: accentColor, filter: `drop-shadow(0 0 4px ${accentColor}80)` }} />
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}40` }} />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{
                  color: safeStops === 0 ? `hsl(160 60% 50%)` : `hsl(var(--p-text-muted))`,
                  backgroundColor: safeStops === 0 ? `hsl(160 60% 50% / 0.1)` : `hsl(var(--p-surface))`,
                  border: `1px solid ${safeStops === 0 ? `hsl(160 60% 50% / 0.2)` : `hsl(var(--p-border))`}`
                }}>{stopsLabel}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-black tracking-tight leading-none" style={{ color: `hsl(var(--p-text))` }}>{to}</p>
                <p className="text-[10px] mt-1 font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>Destination</p>
              </div>
            </div>
          </div>

          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            {hasRealAirline && (
              <span className="text-[11px] font-semibold flex items-center gap-1.5 rounded-lg px-2.5 py-1" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--p-card))`, border: `1px solid hsl(var(--p-border))` }}>
                <AirlineLogo code={ai.code} name={ai.name} size={16} /> {formatAirlineDisplay(ai)}
              </span>
            )}
            {cabinClass && (
              <span className="text-[11px] font-semibold flex items-center gap-1 rounded-lg px-2.5 py-1" style={{ color: accentColor, backgroundColor: accentBg, border: `1px solid ${accentBorder}` }}>
                <Briefcase className="w-3 h-3" /> {cabinClass}
              </span>
            )}
          </div>

          <div className="px-5 py-2.5 border-t" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--primary) / 0.03)` }}>
            <p className="text-[11px] flex items-center gap-1.5" style={{ color: `hsl(var(--p-text-subtle))` }}>
              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(var(--primary) / 0.6)` }} />
              Estimated route · Exact timings confirmed at booking
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-3", className)}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
          style={{ color: accentColor, backgroundColor: accentBg, border: `1px solid ${accentBorder}` }}>
          {label}
        </span>
        {displayDate && (
          <span className="text-[11px] flex items-center gap-1" style={{ color: `hsl(var(--p-text-muted))` }}>
            <CalendarLucide className="w-3 h-3" /> {displayDate}
          </span>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0 w-14">
          <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: `hsl(var(--p-surface))`, border: `1px solid hsl(var(--p-border))` }}>
            <AirlineLogo code={ai.code} name={ai.name} size={28} />
          </div>
          <p className="text-[10px] font-semibold leading-tight text-center line-clamp-2 max-w-[56px]" style={{ color: `hsl(var(--p-text))` }}>
            {hasRealAirline ? (ai.name && ai.name !== ai.code ? ai.name : cleanAirline) : "Airline"}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-left">
              <p className="text-lg font-extrabold leading-none" style={{ color: `hsl(var(--p-text))` }}>{depTime}</p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>{from}</p>
            </div>

            <div className="flex-1 flex flex-col items-center px-1 gap-0.5">
              {duration && (
                <p className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
                  <Clock className="w-3 h-3" /> {duration}
                </p>
              )}
              <div className="w-full flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full border-[1.5px] flex-shrink-0" style={{ borderColor: accentColor }} />
                <div className="h-px flex-1 border-t border-dashed relative" style={{ borderColor: `hsl(var(--p-border-strong))` }}>
                  <Plane className="w-3 h-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" style={{ color: accentColor }} />
                </div>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                color: safeStops === 0 ? `hsl(160 60% 50%)` : `hsl(var(--p-text-muted))`,
                backgroundColor: safeStops === 0 ? `hsl(160 60% 50% / 0.1)` : `hsl(var(--p-surface))`,
              }}>{stopsLabel}</span>
            </div>

            <div className="text-right">
              <p className="text-lg font-extrabold leading-none" style={{ color: `hsl(var(--p-text))` }}>{arrTime}</p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>{to}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {cabinClass && (
              <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5 flex items-center gap-0.5" style={{ color: accentColor, backgroundColor: accentBg }}>
                💺 {cabinClass}
              </span>
            )}
            {flightNo && (
              <span className="text-[10px] font-mono rounded-full px-2.5 py-0.5" style={{ color: `hsl(var(--p-text-muted))`, backgroundColor: `hsl(var(--p-surface))` }}>
                {flightNo.replace(/\s*\((?:Assumed|Estimated|Typical|TBD)\)/gi, "").trim()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlightLegRow;
