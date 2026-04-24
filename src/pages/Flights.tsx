import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Plane, Clock, ArrowRight, ArrowLeft, Filter, SlidersHorizontal, Loader2, Wifi, Search, CalendarDays, Users, ArrowLeftRight, ChevronDown, Minus, Plus, ChevronUp, X, ChevronLeft, ChevronRight, Check, PlusCircle, Luggage, Briefcase, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, CURRENCIES } from "@/contexts/CurrencyContext";
import { hydrateFlightsFromWire } from "@/lib/flightWireAdapter";
import AirportPicker, { type Airport, airports, findAirportByCode } from "@/components/home/AirportPicker";
import FlightDetailsPanel from "@/components/flights/FlightDetailsPanel";
import FareVerificationDialog, { type FareVerificationState, type PaxBreakdown } from "@/components/flights/FareVerificationDialog";
import FlightSearchLoader from "@/components/flights/FlightSearchLoader";
import HybridSearchLoader from "@/components/site/hybrid/HybridSearchLoader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTenant } from "@/hooks/useTenant";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";
import HybridFlightCard from "@/components/site/hybrid/cards/HybridFlightCard";
import HybridFlightHeroBar, { type HybridLeg } from "@/components/flights/results/HybridFlightHeroBar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  SmartInsightsRow,
  PillSortTabs,
  StickyRouteSummaryBar,
  VelaAIInsightsPanel,
  B2CHeroSearchBar,
  B2CFiltersSidebar,
  
  B2CFlightCard,
  B2CRightInsightsPanel,
  CompareTray,
} from "@/components/flights/results";
import { useFlightInsights } from "@/hooks/useFlightInsights";
import flightsHeroBg from "@/assets/flights-hero-bg.jpg";
import {
  FlightsHeroBackdrop,
  FlightsWhereToNext,
  PopularFlightDestinations,
} from "@/components/flights/FlightsLandingExtras";
import HybridFlightsLanding from "@/components/home/blocks/HybridFlightsLanding";
import {
  HybridFlightsFiltersSidebar,
  HybridResultsHeader,
  HybridInsightsRail,
} from "@/components/site/hybrid/results";


type TripType = "one-way" | "round-trip" | "multi-city";

interface MultiCityLeg {
  from: Airport | null;
  to: Airport | null;
  date?: Date;
}

// Flight times from providers are ALWAYS in the airport's local timezone
// (Travelport includes offset like "+08:00", Tripjack omits TZ entirely).
// Either way we must display the wall-clock time as-is — never let the browser
// convert it to the user's local timezone.
function formatFlightTime(timeStr: string): string {
  if (!timeStr) return "--:--";
  if (timeStr.includes("T")) {
    const m = timeStr.match(/T(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  return timeStr;
}

// Format date from ISO string for display under time (airport-local).
function formatFlightDate(timeStr: string): string | null {
  if (!timeStr || !timeStr.includes("T")) return null;
  const m = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (!m) return null;
  try {
    // Build a date in UTC from the wall-clock parts so format() never shifts it.
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return format(d, "dd MMM");
  } catch { return null; }
}


import { AIRLINE_NAMES, getAirlineName } from "@/data/airlines";

function getOperatingCarrierText(flight: { airline: string; segments?: FlightSegment[] }): string | null {
  if (!flight.segments?.length) return null;
  // Collect unique operating carriers that differ from the marketing airline
  const ops = new Set<string>();
  for (const seg of flight.segments) {
    // Check explicit operatingCarrier field
    const op = seg.operatingCarrier;
    if (op && op !== flight.airline && op !== seg.carrier) {
      ops.add(op);
    }
    // Also detect when segment carrier differs from the flight's main airline (multi-carrier itinerary)
    if (seg.carrier && seg.carrier !== flight.airline) {
      ops.add(seg.carrier);
    }
  }
  if (ops.size === 0) return null;
  return "Operated by " + Array.from(ops).map(c => getAirlineName(c)).join(", ");
}

interface LayoverInfo {
  city: string;
  duration: string;
}

function getLayovers(segments?: FlightSegment[]): LayoverInfo[] {
  if (!segments || segments.length <= 1) return [];
  const layovers: LayoverInfo[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i] as any;
    const arrTime = seg.arrival;
    const depTime = (segments[i + 1] as any).departure;
    // Use IATA code for compact layover display (e.g. "via CMB")
    const rawCode = seg.destination || seg.to || "";
    const city = rawCode || "???";
    let duration = "";
    if (arrTime && depTime) {
      const arr = arrTime.includes("T") ? new Date(arrTime).getTime() : null;
      const dep = depTime.includes("T") ? new Date(depTime).getTime() : null;
      if (arr && dep && dep > arr) {
        const mins = Math.round((dep - arr) / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
    }
    layovers.push({ city, duration });
  }
  return layovers;
}

function findAirport(code: string): Airport | null {
  return airports.find((a) => a.code === code) || null;
}

async function findAirportAsync(code: string): Promise<Airport | null> {
  const staticMatch = airports.find((a) => a.code === code);
  if (staticMatch) return staticMatch;
  return findAirportByCode(code);
}

interface FlightSegment {
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  carrier?: string;
  flightNumber?: string;
  operatingCarrier?: string;
  operatingFlightNumber?: string;
  bookingCode?: string;
  group?: string;
}

interface ReturnLegInfo {
  departure: string;
  arrival: string;
  from_city: string;
  to_city: string;
  duration: string;
  stops: number;
  segments: FlightSegment[];
  airline?: string;
  flightNumber?: string;
}

function getReturnLegInfo(flight: Flight): ReturnLegInfo | null {
  // Strategy 0: Use pre-computed return_leg from API (unified-flight-search enrichment)
  const apiReturn = (flight as any).return_leg;
  if (apiReturn) {
    return {
      departure: apiReturn.departure,
      arrival: apiReturn.arrival,
      from_city: apiReturn.from || "",
      to_city: apiReturn.to || "",
      duration: (() => {
        const dep = new Date(apiReturn.departure).getTime();
        const arr = new Date(apiReturn.arrival).getTime();
        const mins = Math.max(0, Math.round((arr - dep) / 60000));
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
      })(),
      stops: apiReturn.stops ?? Math.max(0, (apiReturn.segments?.length || 1) - 1),
      segments: apiReturn.segments || [],
      airline: apiReturn.airline,
      flightNumber: apiReturn.flightNumber,
    };
  }

  if (!flight.segments || flight.segments.length === 0) return null;

  // Strategy 1: Split by group field (Travelport uses group "0" for outbound, "1" for return)
  const hasGroups = flight.segments.some(s => s.group != null);
  if (hasGroups) {
    const returnSegs = flight.segments.filter(s => String(s.group) === "1");
    if (returnSegs.length === 0) return null;
    return buildReturnInfo(returnSegs);
  }

  // Strategy 2: Detect direction reversal
  const toCity = flight.to_city;
  let splitIdx = -1;
  for (let i = 0; i < flight.segments.length - 1; i++) {
    const seg = flight.segments[i] as any;
    const nextSeg = flight.segments[i + 1] as any;
    if ((seg.destination === toCity || seg.to === toCity) && 
        (nextSeg.origin === toCity || nextSeg.from === toCity)) {
      splitIdx = i + 1;
      break;
    }
  }
  if (splitIdx > 0) {
    const returnSegs = flight.segments.slice(splitIdx);
    return buildReturnInfo(returnSegs);
  }

  return null;
}

function buildReturnInfo(segments: FlightSegment[]): ReturnLegInfo {
  const first = segments[0];
  const last = segments[segments.length - 1];
  const depTime = new Date(first.departure).getTime();
  const arrTime = new Date(last.arrival).getTime();
  const totalMinutes = Math.max(0, Math.round((arrTime - depTime) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    departure: first.departure,
    arrival: last.arrival,
    from_city: (first as any).origin || (first as any).from || "",
    to_city: (last as any).destination || (last as any).to || "",
    duration: `${hours}h ${minutes}m`,
    stops: Math.max(0, segments.length - 1),
    segments,
  };
}

function getOutboundSegments(flight: Flight): FlightSegment[] {
  if (!flight.segments || flight.segments.length === 0) return [];
  const hasGroups = flight.segments.some(s => s.group != null);
  if (hasGroups) {
    const outbound = flight.segments.filter(s => String(s.group) === "0");
    return outbound.length > 0 ? outbound : flight.segments;
  }
  // No groups — detect split point
  const toCity = flight.to_city;
  for (let i = 0; i < flight.segments.length - 1; i++) {
    const seg = flight.segments[i] as any;
    const nextSeg = flight.segments[i + 1] as any;
    if ((seg.destination === toCity || seg.to === toCity) &&
        (nextSeg.origin === toCity || nextSeg.from === toCity)) {
      return flight.segments.slice(0, i + 1);
    }
  }
  return flight.segments;
}

function getOutboundArrival(flight: Flight): string {
  const outSegs = getOutboundSegments(flight);
  if (outSegs.length > 0) {
    const lastOut = outSegs[outSegs.length - 1] as any;
    return lastOut.arrival || lastOut.arrival_time || flight.arrival;
  }
  return flight.arrival;
}

function getOutboundStops(flight: Flight): number {
  const outSegs = getOutboundSegments(flight);
  if (outSegs.length > 0) return Math.max(0, outSegs.length - 1);
  return flight.segments ? Math.max(0, flight.segments.length - 1) : flight.stops;
}

interface MultiCityLegInfo {
  legIndex: number;
  from_city: string;
  to_city: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  segments: FlightSegment[];
}

function getMultiCityLegs(flight: Flight): MultiCityLegInfo[] {
  if (!flight.segments || flight.segments.length === 0) return [];
  // Group segments by their group index
  const groupMap = new Map<number, FlightSegment[]>();
  for (const seg of flight.segments) {
    const g = typeof seg.group === 'number' ? seg.group : (seg.group != null ? Number(seg.group) : 0);
    if (!groupMap.has(g)) groupMap.set(g, []);
    groupMap.get(g)!.push(seg);
  }
  // Even single-group flights might be multi-city if URL says so — but only split if we have multiple groups
  if (groupMap.size <= 1) return [];

  const legs: MultiCityLegInfo[] = [];
  const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => a[0] - b[0]);

  for (const [gIdx, segs] of sortedGroups) {
    const first = segs[0] as any;
    const last = segs[segs.length - 1] as any;
    // Calculate duration
    let duration = "";
    if (first.departure && last.arrival && first.departure.includes("T") && last.arrival.includes("T")) {
      const mins = Math.round((new Date(last.arrival).getTime() - new Date(first.departure).getTime()) / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (mins > 0) duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    // Fallback: sum segment durations
    if (!duration) {
      const totalMins = segs.reduce((sum, s: any) => {
        const segDur = s.durationMinutes || (s.duration ? parseInt(s.duration) : 0);
        return sum + (isNaN(segDur) ? 0 : segDur);
      }, 0);
      if (totalMins > 0) {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
    }
    legs.push({
      legIndex: gIdx,
      from_city: first.origin || first.from || "",
      to_city: last.destination || last.to || "",
      departure: first.departure || "",
      arrival: last.arrival || "",
      duration,
      stops: Math.max(0, segs.length - 1),
      segments: segs,
    });
  }
  return legs;
}

function getClassDisplay(flight: { class: string; segments?: FlightSegment[]; classOfBooking?: string }): string {
  const bookingCode = flight.segments?.[0]?.bookingCode || flight.classOfBooking;
  return bookingCode ? `${flight.class} (${bookingCode})` : flight.class;
}

interface Flight {
  id: string;
  airline: string;
  from_city: string;
  to_city: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  stops: number;
  class: string;
  source?: "database" | "travelport" | "amadeus" | "travelvela" | "tripjack";
  flightNumber?: string;
  currency?: string;
  isRefundable?: boolean;
  changePenalties?: any;
  cancelPenalties?: any;
  segments?: FlightSegment[];
  baggageAllowance?: { cabin?: string; checkin?: string } | null;
  basePrice?: number;
  taxes?: number;
  paxPricing?: Record<string, { base: number; taxes: number; total: number }> | null;
}

const Flights = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenant } = useTenant();
  const { isHybrid } = useIsHybridSkin();
  const FlightCardComp = isHybrid ? HybridFlightCard : B2CFlightCard;
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState<"price" | "duration" | "best" | "earliest" | "ai">("best");
  const [maxPrice, setMaxPrice] = useState(2000);
  const [searchSource, setSearchSource] = useState<"database" | "travelport" | "both">("database");
  const { currency: displayCurrency } = useCurrency();
  const fmtPrice = (v: number) => `${CURRENCIES[displayCurrency].symbol}${Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const isMobile = useIsMobile();
  const [searchExpanded, setSearchExpanded] = useState(true);
  // Esc key closes the inline modify-search panel after results have loaded
  useEffect(() => {
    if (!searchExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchExpanded]);
  const [filterOpen, setFilterOpen] = useState(false);
  
  // Stop filter: null = all, 0 = nonstop, 1 = 1 stop, 2 = 2+
  const [stopFilter, setStopFilter] = useState<number | null>(null);
  // Airline filter: set of selected airline codes (empty = all)
  const [selectedAirlines, setSelectedAirlines] = useState<Set<string>>(new Set());
  // Departure / arrival time window (hours 0-24)
  const [departureTime, setDepartureTime] = useState<[number, number]>([0, 24]);
  const [arrivalTime, setArrivalTime] = useState<[number, number]>([0, 24]);
  // Price range (min, max) in display currency — initialised lazily after results
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [refundableOnly, setRefundableOnly] = useState(false);
  // Compare tray state
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }, []);
  // Modify search state
  const [modTripType, setModTripType] = useState<TripType>(searchParams.get("legs") ? "multi-city" : searchParams.get("returnDate") ? "round-trip" : "one-way");
  const [modFrom, setModFrom] = useState<Airport | null>(null);
  const [modTo, setModTo] = useState<Airport | null>(null);
  const [modDate, setModDate] = useState<Date | undefined>(undefined);
  const [modReturnDate, setModReturnDate] = useState<Date | undefined>(undefined);
  const [modDatePopoverOpen, setModDatePopoverOpen] = useState(false);
  const [modFlightDatesOpen, setModFlightDatesOpen] = useState(false);
  const [modFlightDateStep, setModFlightDateStep] = useState<"depart" | "return">("depart");
  const [modDraftDepart, setModDraftDepart] = useState<Date>();
  const [modDraftReturn, setModDraftReturn] = useState<Date>();
  const [modAdults, setModAdults] = useState(1);
  const [modChildren, setModChildren] = useState(0);
  const [modInfants, setModInfants] = useState(0);
  const [modClass, setModClass] = useState("Economy");
  const [modRegularFare, setModRegularFare] = useState(searchParams.get("studentFare") !== "true");
  const [modStudentFare, setModStudentFare] = useState(searchParams.get("studentFare") === "true");
  const [modDirectFlight, setModDirectFlight] = useState(searchParams.get("direct") === "true");
  const [modMultiCityLegs, setModMultiCityLegs] = useState<MultiCityLeg[]>([
    { from: null, to: null },
    { from: null, to: null },
  ]);

  const [complexBookingOpen, setComplexBookingOpen] = useState(false);
  const [fareVerification, setFareVerification] = useState<FareVerificationState>(null);

  const maxAdultPlusChild = 9;
  const modAdultChildTotal = modAdults + modChildren;

  const handleSetModAdults = (v: number) => {
    if (v + modChildren > maxAdultPlusChild) return;
    setModAdults(v);
    if (modInfants > v) setModInfants(v);
  };
  const handleSetModChildren = (v: number) => {
    if (modAdults + v > maxAdultPlusChild) return;
    setModChildren(v);
  };
  const handleSetModInfants = (v: number) => {
    if (v > modAdults) return;
    setModInfants(v);
  };

  const updateModMultiCityLeg = (index: number, field: keyof MultiCityLeg, value: any) => {
    setModMultiCityLegs(prev => {
      const updated = prev.map((leg, i) => i === index ? { ...leg, [field]: value } : leg);
      // Auto-fill next leg's origin when destination changes
      if (field === 'to' && value && index < updated.length - 1) {
        updated[index + 1] = { ...updated[index + 1], from: value };
      }
      return updated;
    });
  };
  const addModMultiCityLeg = () => {
    if (modMultiCityLegs.length < 5) {
      setModMultiCityLegs(prev => {
        const lastLeg = prev[prev.length - 1];
        return [...prev, { from: lastLeg?.to || null, to: null }];
      });
    }
  };
  const removeModMultiCityLeg = (index: number) => {
    if (modMultiCityLegs.length > 2) setModMultiCityLegs(prev => prev.filter((_, i) => i !== index));
  };

  // Sync modify search fields from URL params
  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const date = searchParams.get("date");
    const returnDate = searchParams.get("returnDate");
    const adults = searchParams.get("adults");
    const children = searchParams.get("children");
    const infants = searchParams.get("infants");
    const cabinClass = searchParams.get("class");
    const legsParam = searchParams.get("legs");

    const loadAirports = async () => {
      if (legsParam) {
        // Parse multi-city legs from URL
        const parsedLegs: MultiCityLeg[] = await Promise.all(
          legsParam.split(",").map(async (legStr) => {
            const [fromCode, toCode, dateStr] = legStr.split("_");
            const fromAirport = fromCode ? await findAirportAsync(fromCode) : null;
            const toAirport = toCode ? await findAirportAsync(toCode) : null;
            return {
              from: fromAirport,
              to: toAirport,
              date: dateStr ? new Date(dateStr + "T00:00:00") : undefined,
            };
          })
        );
        if (parsedLegs.length >= 2) setModMultiCityLegs(parsedLegs);
        setModTripType("multi-city");
      } else {
        if (from) {
          const airport = await findAirportAsync(from);
          if (airport) setModFrom(airport);
        }
        if (to) {
          const airport = await findAirportAsync(to);
          if (airport) setModTo(airport);
        }
      }
    };
    loadAirports();

    if (date) setModDate(new Date(date + "T00:00:00"));
    if (returnDate) setModReturnDate(new Date(returnDate + "T00:00:00"));
    if (adults) setModAdults(parseInt(adults));
    setModChildren(parseInt(children || "0"));
    setModInfants(parseInt(infants || "0"));
    if (cabinClass) setModClass(cabinClass);
  }, []); // Only on mount

  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const date = searchParams.get("date");
    const returnDate = searchParams.get("returnDate");
    const adults = searchParams.get("adults");
    const cabinClass = searchParams.get("class");
    const legsParam = searchParams.get("legs");
    const isMultiCity = !!legsParam;

    // Parse multi-city legs from URL
    const parsedLegs = legsParam
      ? legsParam.split(",").map(l => {
          const [f, t, d] = l.split("_");
          return { from: f, to: t, date: d };
        })
      : [];

    const hasStandardSearch = from && to && date;
    const hasMultiCitySearch = isMultiCity && parsedLegs.length >= 2 && parsedLegs.every(l => l.from && l.to);

    const fetchFlights = async () => {
      setLoading(true);

      const searchBody: any = {
        mode: "search",
        from: isMultiCity ? parsedLegs[0].from : from,
        to: isMultiCity ? parsedLegs[parsedLegs.length - 1].to : to,
        departDate: isMultiCity ? parsedLegs[0].date : date,
        returnDate: isMultiCity ? null : returnDate,
        adults: parseInt(adults || "1"),
        children: searchParams.get("studentFare") === "true" ? 0 : parseInt(searchParams.get("children") || "0"),
        infants: searchParams.get("studentFare") === "true" ? 0 : parseInt(searchParams.get("infants") || "0"),
        cabinClass: cabinClass || "Economy",
        directFlight: searchParams.get("direct") === "true",
        studentFare: searchParams.get("studentFare") === "true",
        currency: displayCurrency,
      };

      if (isMultiCity) {
        searchBody.legs = parsedLegs.map(l => ({ from: l.from, to: l.to, date: l.date }));
      }
      if (tenant?.id) {
        searchBody.tenant_id = tenant.id;
      }

      try {
        const invokePromise = supabase.functions.invoke("unified-flight-search", { body: searchBody });
        const timeoutMs = isMultiCity ? 35000 : 20000;
        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error("Search timeout") }), timeoutMs)
        );

        const { data, error } = await Promise.race([
          invokePromise,
          timeoutPromise,
        ]) as { data: any; error: any };

        console.log("[FlightSearch] unified:", { success: data?.success, count: data?.count, error: error?.message });

        if (!error && data?.success && data?.flights) {
          setFlights(hydrateFlightsFromWire(data.flights));

          if (data.providers?.api) {
            setSearchSource("both");
          }

          // Fire-and-forget: backfill ±30-day price grid for calendar / cheaper-dates
          // Only on standard one-way / round-trip; skip multi-city.
          if (!isMultiCity && from && to && date) {
            const departIso = typeof date === "string" ? date : formatLocalDate(date as any);
            supabase.functions
              .invoke("flight-price-grid", {
                body: {
                  from,
                  to,
                  departDate: departIso,
                  // Aggressive 12-month prefill: Sky Scrapper's getPriceCalendar
                  // returns ~12 months in a single call. We pass windowDays=200
                  // (max accepted) so the full upstream return is persisted, not
                  // truncated to a narrow window. Cheap because it's one HTTP call.
                  windowDays: 200,
                  cabinClass: searchParams.get("class") || "Economy",
                },
              })
              .then((res) => {
                if (res?.data?.success) {
                  console.log("[price-grid]", res.data);
                  // Notify the right insights panel to re-fetch from cache
                  window.dispatchEvent(new CustomEvent("flight-price-grid:updated", {
                    detail: { from, to, departDate: departIso },
                  }));
                }
              })
              .catch(() => {});
          }

          // Update date strip price for current date
          if (data.flights.length > 0 && date) {
            const lowest = data.flights[0]; // Already sorted by price from backend
            const paxP = lowest.paxPricing;
            const hasApi = lowest.basePrice !== undefined && lowest.taxes !== undefined;
            const aB = Math.round(hasApi ? lowest.basePrice : Number(lowest.price));
            const aT = Math.round(hasApi ? lowest.taxes : 0);
            const adultP = aB + aT;
            const adultsCnt = parseInt(adults || "1");
            const childCnt = parseInt(searchParams.get("children") || "0");
            const infantCnt = parseInt(searchParams.get("infants") || "0");
            const cB = paxP?.CHD ? Math.round(paxP.CHD.base) : (hasApi ? Math.round(aB * 0.75) : null);
            const cT = paxP?.CHD ? Math.round(paxP.CHD.taxes) : (hasApi ? Math.round(aT * 0.75) : null);
            const childP = cB != null && cT != null ? cB + cT : Math.round(adultP * 0.75);
            const iB = paxP?.INF ? Math.round(paxP.INF.base) : (hasApi ? Math.round(aB * 0.10) : null);
            const iT = paxP?.INF ? Math.round(paxP.INF.taxes) : (hasApi ? Math.round(aT * 0.10) : null);
            const infantP = iB != null && iT != null ? iB + iT : Math.round(adultP * 0.10);
            const totalPrice = adultP * adultsCnt + childP * childCnt + infantP * infantCnt;
            void totalPrice; // datePrices removed (date strip feature deprecated)
          }
        } else {
          setFlights([]);
        }
      } catch (e) {
        console.error("[FlightSearch] unified error:", e);
        setFlights([]);
      }

      setLoading(false);

      // Auto-collapse search after results load (dark navy summary bar replaces it)
      setSearchExpanded(false);
    };

    if (hasStandardSearch || hasMultiCitySearch) {
      setHasSearched(true);
      fetchFlights();
    } else {
      setLoading(false);
    }
  }, [searchParams, displayCurrency]);

  useEffect(() => {
    const isStudent = searchParams.get("studentFare") === "true";
    setModStudentFare(isStudent);
    setModRegularFare(!isStudent);
    setModDirectFlight(searchParams.get("direct") === "true");
  }, [searchParams]);

  // Reset children/infants when student fare is toggled on
  useEffect(() => {
    if (modStudentFare) {
      setModChildren(0);
      setModInfants(0);
    }
  }, [modStudentFare]);

  const handleModifySearch = () => {
    if (modAdults + modChildren > 9 || modInfants > modAdults) {
      setComplexBookingOpen(true);
      return;
    }
    const params = new URLSearchParams();
    if (modTripType === "multi-city") {
      const legsStr = modMultiCityLegs
        .filter(l => l.from && l.to)
        .map(l => `${l.from!.code}_${l.to!.code}_${l.date ? formatLocalDate(l.date) : ""}`)
        .join(",");
      params.set("legs", legsStr);
      params.set("tripType", "multi-city");
    } else {
      if (modFrom) params.set("from", modFrom.code);
      if (modTo) params.set("to", modTo.code);
      if (modDate) params.set("date", formatLocalDate(modDate));
      if (modTripType === "round-trip" && modReturnDate) params.set("returnDate", formatLocalDate(modReturnDate));
    }
    params.set("adults", String(modAdults));
    if (!modStudentFare && modChildren > 0) params.set("children", String(modChildren));
    if (!modStudentFare && modInfants > 0) params.set("infants", String(modInfants));
    params.set("class", modClass);
    if (modDirectFlight) params.set("direct", "true");
    if (modStudentFare) params.set("studentFare", "true");
    params.set("_t", String(Date.now()));
    navigate(`/flights?${params.toString()}`);
  };

  // Convert flight price to display currency for filtering
  const getDisplayPrice = useCallback((flight: Flight) => {
    return Math.round(flight.price);
  }, []);

  const { priceSliderMin, priceSliderMax } = (() => {
    const prices = flights
      .map((f) => getDisplayPrice(f))
      .filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length === 0) return { priceSliderMin: 0, priceSliderMax: 2000 };
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    // Floor min to nearest 50, ceil max to nearest 100 for clean ticks
    const min = Math.max(0, Math.floor(rawMin / 50) * 50);
    const max = Math.max(min + 100, Math.ceil(rawMax / 100) * 100);
    return { priceSliderMin: min, priceSliderMax: max };
  })();

  // Reset filters when flights change
  useEffect(() => {
    setStopFilter(null);
    setSelectedAirlines(new Set());
    const prices = flights
      .map((f) => getDisplayPrice(f))
      .filter((p) => Number.isFinite(p) && p > 0);
    const rawMin = prices.length ? Math.min(...prices) : 0;
    const rawMax = prices.length ? Math.max(...prices) : 2000;
    const newMin = Math.max(0, Math.floor(rawMin / 50) * 50);
    const newMax = Math.max(newMin + 100, Math.ceil(rawMax / 100) * 100);
    setMaxPrice(newMax);
    setPriceRange([newMin, newMax]);
  }, [flights, getDisplayPrice]);

  // Compute airline options with lowest fares + counts (in display currency)
  const airlineOptions = (() => {
    const map = new Map<string, { rawPrice: number; displayPrice: number; source?: string; count: number }>();
    for (const f of flights) {
      const dp = getDisplayPrice(f);
      const existing = map.get(f.airline);
      if (!existing) {
        map.set(f.airline, { rawPrice: f.price, displayPrice: dp, source: f.source, count: 1 });
      } else {
        existing.count += 1;
        if (dp < existing.displayPrice) {
          existing.displayPrice = dp;
          existing.rawPrice = f.price;
          existing.source = f.source;
        }
      }
    }
    return Array.from(map.entries())
      .map(([code, info]) => ({ code, name: getAirlineName(code), lowestPrice: info.displayPrice, source: info.source, count: info.count }))
      .sort((a, b) => a.lowestPrice - b.lowestPrice);
  })();

  // Compute stop options with counts
  const stopOptions = (() => {
    const counts = { 0: 0, 1: 0, 2: 0 };
    for (const f of flights) {
      const stops = getOutboundStops(f);
      if (stops === 0) counts[0]++;
      else if (stops === 1) counts[1]++;
      else counts[2]++;
    }
    return counts;
  })();

  const toggleAirline = (code: string) => {
    setSelectedAirlines(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const aiPickId = (typeof window !== "undefined" ? (window as any).__velaAiPickId : null) as string | null;
  const _parseDur = (dur: string): number => {
    const hMatch = dur?.match?.(/(\d+)\s*h/i);
    const mMatch = dur?.match?.(/(\d+)\s*m/i);
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
  };
  const _preFiltered = flights
    .filter((f) => getDisplayPrice(f) <= maxPrice)
    .filter((f) => {
      if (stopFilter === null) return true;
      const stops = getOutboundStops(f);
      if (stopFilter === 2) return stops >= 2;
      return stops === stopFilter;
    })
    .filter((f) => selectedAirlines.size === 0 || selectedAirlines.has(f.airline))
    .filter((f) => {
      if (!priceRange) return true;
      const dp = getDisplayPrice(f);
      return dp >= priceRange[0] && dp <= priceRange[1];
    })
    .filter((f) => {
      if (departureTime[0] === 0 && departureTime[1] === 24) return true;
      const t = new Date(f.departure);
      if (isNaN(t.getTime())) return true;
      const h = t.getHours();
      return h >= departureTime[0] && h <= departureTime[1];
    })
    .filter((f) => {
      if (arrivalTime[0] === 0 && arrivalTime[1] === 24) return true;
      const t = new Date(f.arrival);
      if (isNaN(t.getTime())) return true;
      const h = t.getHours();
      return h >= arrivalTime[0] && h <= arrivalTime[1];
    })
    .filter((f) => {
      if (!refundableOnly) return true;
      return Boolean((f as any).refundable);
    });

  // AI Pick is stable: one pick per search. Only show when the AI's actual pick
  // survives current filters. Never substitute with a heuristic fallback, and
  // keep it visible across all sort orders so users can trust the recommendation.
  const effectivePickId =
    aiPickId && _preFiltered.some((f) => f.id === aiPickId) ? aiPickId : null;
  const aiPickFilteredOut = Boolean(aiPickId) && !effectivePickId;

  const filtered = [..._preFiltered].sort((a, b) => {
    // AI Pick always floats to the top (matches reference design)
    if (effectivePickId) {
      if (a.id === effectivePickId && b.id !== effectivePickId) return -1;
      if (b.id === effectivePickId && a.id !== effectivePickId) return 1;
    }
    if (sortBy === "duration") return _parseDur(a.duration) - _parseDur(b.duration);
    if (sortBy === "best") {
      const sa = getDisplayPrice(a) * 0.6 + _parseDur(a.duration) * 10;
      const sb = getDisplayPrice(b) * 0.6 + _parseDur(b.duration) * 10;
      return sa - sb;
    }
    if (sortBy === "earliest") {
      const ta = new Date(a.departure).getTime() || 0;
      const tb = new Date(b.departure).getTime() || 0;
      return ta - tb;
    }
    return getDisplayPrice(a) - getDisplayPrice(b);
  });

  // AI Insights
  const insightStats = useMemo(() => {
    if (!filtered.length) return { min: 0, avg: 0 };
    const prices = filtered.map(getDisplayPrice);
    return {
      min: Math.min(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
  }, [filtered, getDisplayPrice]);

  // Build a stable shortlist for the AI so it can ground its recommendation
  // in real airline names + prices. Without this the model hallucinates carriers.
  const aiShortlist = useMemo(() => {
    return filtered.slice(0, 10).map((f) => ({
      id: f.id,
      airline: (f as any).airlineName || f.airline || "",
      price: getDisplayPrice(f),
      duration_min: _parseDur(f.duration),
      stops: getOutboundStops(f),
      cabin_baggage: (f as any).baggageCabin || (f as any).cabin_baggage,
      checkin_baggage: (f as any).baggageCheckin || (f as any).checkin_baggage,
      refundable: Boolean((f as any).refundable),
      layover_codes: ((f as any).segments || [])
        .slice(1)
        .map((s: any) => s?.from || s?.origin)
        .filter(Boolean),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((f) => `${f.id}:${Math.round(getDisplayPrice(f))}`).join("|")]);

  const { insight: aiInsight, loading: insightLoading } = useFlightInsights({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    departDate: searchParams.get("date"),
    returnDate: searchParams.get("returnDate"),
    cabinClass: searchParams.get("class") || "Economy",
    currency: displayCurrency,
    resultsCount: filtered.length,
    currentMinPrice: insightStats.min,
    currentAvgPrice: insightStats.avg,
    shortlist: aiShortlist,
    enabled: hasSearched && filtered.length > 0,
  });

  // Expose AI pick id to the sort comparator (window-bridged to avoid re-render loops)
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__velaAiPickId = aiInsight?.ai_pick_id || null;
    }
  }, [aiInsight?.ai_pick_id]);

  // Group flights with same airline + price + class + stops into expandable cards
  interface FlightGroup {
    key: string;
    primary: Flight;
    alternatives: Flight[];
  }

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedAlternatives, setExpandedAlternatives] = useState<Set<string>>(new Set());

  const parseDurationToMinutes = (dur: string): number => {
    const hMatch = dur.match(/(\d+)\s*h/i);
    const mMatch = dur.match(/(\d+)\s*m/i);
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
  };

  const groupedFlights = useMemo((): FlightGroup[] => {
    const groups = new Map<string, Flight[]>();
    for (const f of filtered) {
      const actualStops = getOutboundStops(f);
      const groupKey = `${f.airline}-${Math.round(f.price)}-${f.class}-${actualStops}-${f.source || ""}`;
      const existing = groups.get(groupKey);
      if (existing) existing.push(f);
      else groups.set(groupKey, [f]);
    }
    return Array.from(groups.entries()).map(([key, flights]) => {
      // Sort by shortest duration first so primary card shows the quickest option
      const sorted = [...flights].sort((a, b) => parseDurationToMinutes(a.duration) - parseDurationToMinutes(b.duration));
      return {
        key,
        primary: sorted[0],
        alternatives: sorted.slice(1),
      };
    });
  }, [filtered]);

  // Reset expanded groups when search changes
  useEffect(() => { setExpandedGroups(new Set()); setExpandedAlternatives(new Set()); }, [flights]);

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAlternativesExpand = (key: string) => {
    setExpandedAlternatives(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const hasSearchParams = searchParams.get("from") || searchParams.get("to") || searchParams.get("legs");

  // Date navigation helpers
  const navigateToDate = (offset: number) => {
    const currentDate = searchParams.get("date");
    if (!currentDate) return;
    const d = new Date(currentDate + "T00:00:00");
    d.setDate(d.getDate() + offset);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", formatLocalDate(d));
    navigate(`/flights?${params.toString()}`);
  };

  const currentDateStr = searchParams.get("date");
  const currentDateObj = currentDateStr ? new Date(currentDateStr + "T00:00:00") : null;
  const canGoPrev = currentDateObj ? currentDateObj > new Date() : false;

  // Date strip + adjacent-date price fetching removed (excessive API calls)
  const adultsCnt = parseInt(searchParams.get("adults") || "1");
  const childCnt = parseInt(searchParams.get("children") || "0");
  const infantCnt = parseInt(searchParams.get("infants") || "0");

  return (
    <>
    <Layout>
      {/* Light page background — matches B2C reference (no dark hero) */}
      <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50/50 dark:from-background dark:via-background dark:to-background min-h-screen relative">
      {/* Hybrid skin: replace the entire legacy initial-state landing
          (backdrop + hero header + standalone search card + landing
          extras) with the dedicated HybridFlightsLanding block so the
          /flights landing visually matches the Hybrid homepage hero. */}
      {isHybrid && !hasSearched && <HybridFlightsLanding />}

      {/* Cinematic hero backdrop — only on initial (no-search) state, non-Hybrid */}
      {!hasSearched && !isHybrid && <FlightsHeroBackdrop heroImage={flightsHeroBg} />}

      {/* Initial-state hero header above the search card (non-Hybrid only) */}
      {!hasSearched && !isHybrid && (
        <div className="relative container mx-auto px-4 pt-10 sm:pt-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-[11px] font-semibold text-white tracking-wider uppercase mb-3">
            <Plane className="w-3 h-3" /> Find Flights
          </div>
          <h1
            className="text-3xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Your next journey starts here
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/85 max-w-xl mx-auto">
            Compare fares across hundreds of airlines and book with confidence.
          </p>
        </div>
      )}

      {/* Wrap hero bar + modify-search form so we can swap visual order after search */}
      <div className={cn("relative", hasSearched && "flex flex-col")}>

      {/* Search Card — initial state OR inline-expanded under hero bar after search */}
      {((!hasSearched && !isHybrid) || searchExpanded) && (
      <div className={cn(
        "container mx-auto px-4 relative z-10 mb-6",
        !hasSearched ? "mt-6 sm:mt-8 max-w-5xl" : "mt-0 order-2"
      )} id={hasSearched ? "modify-search-inline" : undefined}>
        <div className={cn(
          "overflow-hidden relative",
          !hasSearched
            ? "rounded-[2rem] sm:rounded-[2.5rem] border border-border/40 bg-card/95 backdrop-blur-xl shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.25),0_8px_24px_-12px_hsl(var(--primary)/0.15)] ring-1 ring-primary/10"
            : "rounded-2xl bg-card border border-border/40 shadow-lg shadow-primary/[0.06] ring-1 ring-primary/5"
        )}>
          {!hasSearched && (
            <>
              {/* brand accent bar */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-[hsl(var(--primary))]" />
              {/* corner glow */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[hsl(var(--primary)/0.08)] blur-3xl pointer-events-none" />
            </>
          )}
          {/* Mobile collapsed summary bar */}
          {isMobile && !searchExpanded && (
            <button
              onClick={() => setSearchExpanded(true)}
              className="w-full flex items-center justify-between p-4 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Plane className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {modTripType === "multi-city"
                      ? modMultiCityLegs.filter(l => l.from).map(l => l.from?.city).join(" → ") || "Multi-city"
                      : `${modFrom?.city || "—"} → ${modTo?.city || "—"}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {modTripType === "multi-city"
                      ? `${modMultiCityLegs.length} flights`
                      : `${modDate ? format(modDate, "MMM dd") : "—"}${modReturnDate ? ` — ${format(modReturnDate, "MMM dd")}` : ""}`} · {modAdults + modChildren + modInfants} traveler{(modAdults + modChildren + modInfants) > 1 ? "s" : ""} · {modClass}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-primary flex items-center gap-1 flex-shrink-0">
                Modify <ChevronDown className="w-3 h-3" />
              </span>
            </button>
          )}

          {/* Full search form */}
          <AnimatePresence initial={false}>
            {(searchExpanded || !isMobile) && (
              <motion.div
                initial={isMobile ? { height: 0, opacity: 0 } : false}
                animate={{ height: "auto", opacity: 1 }}
                exit={isMobile ? { height: 0, opacity: 0 } : undefined}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className={cn("p-3 sm:p-4 md:p-6", !hasSearched && "md:p-8 lg:p-10")}>
                  {/* Inline modify-mode header (desktop): label + close X */}
                  {hasSearched && !isMobile && (
                    <div className="flex justify-between items-center mb-4 -mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Modify your search</span>
                        <span className="text-[11px] text-muted-foreground hidden md:inline">Press Esc to close</span>
                      </div>
                      <button
                        onClick={() => setSearchExpanded(false)}
                        aria-label="Close modify search"
                        className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                  {/* Mobile close button */}
                  {isMobile && (
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-semibold text-foreground">Modify Search</span>
                      <button onClick={() => setSearchExpanded(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  )}
            {/* Trip type row */}
            <div className={cn(
              "flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 flex-wrap",
              !hasSearched && "sm:mb-7"
            )}>
              {!hasSearched ? (
                <div className="flex items-center gap-6 sm:gap-8">
                  {(["one-way", "round-trip", "multi-city"] as TripType[]).map((type) => {
                    const active = modTripType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => { setModTripType(type); if (type === "one-way") setModReturnDate(undefined); }}
                        className="flex items-center gap-2.5 group"
                      >
                        <span className={cn(
                          "relative h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                          active
                            ? "border-primary bg-white shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
                            : "border-slate-300 group-hover:border-slate-400"
                        )}>
                          {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                        </span>
                        <span className={cn(
                          "text-sm sm:text-base font-semibold transition-colors",
                          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {type === "one-way" ? "One Way" : type === "round-trip" ? "Round Trip" : "Multi-city"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                (["one-way", "round-trip", "multi-city"] as TripType[]).map((type) => (
                  <button key={type} type="button" onClick={() => { setModTripType(type); if (type === "one-way") setModReturnDate(undefined); }} className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group bg-transparent border-none p-0">
                    <div className={cn(
                      "w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                      modTripType === type ? "border-primary bg-primary/5 scale-110" : "border-muted-foreground/30 group-hover:border-muted-foreground"
                    )}>
                      {modTripType === type && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary" />}
                    </div>
                    <span className={cn(
                      "text-[11px] sm:text-sm font-semibold transition-colors",
                      modTripType === type ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}>
                      {type === "one-way" ? "One Way" : type === "round-trip" ? "Round Trip" : "Multi-city"}
                    </span>
                  </button>
                ))
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-all ml-auto",
                    !hasSearched
                      ? "px-4 py-2 rounded-full bg-muted border border-border/60 text-foreground hover:bg-muted/70"
                      : "px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground border border-border/50 bg-muted/30"
                  )}>
                    {modClass}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="end">
                  {["Economy", "Premium Economy", "Business", "First Class"].map((cls) => (
                    <button
                      key={cls}
                      onClick={() => setModClass(cls)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        modClass === cls ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"
                      )}
                    >
                      {cls}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {/* One-way / Round-trip fields */}
            {modTripType !== "multi-city" && (
              <>
                <div className={cn("relative hidden sm:flex gap-3 mb-3", !hasSearched && "gap-4 mb-5")}>
                  <div className="flex-1">
                    <label className={cn(
                      "text-[11px] font-bold uppercase tracking-wider mb-1.5 block",
                      !hasSearched ? "text-muted-foreground/80 ml-4 text-[10px] tracking-[0.18em]" : "text-muted-foreground"
                    )}>Flying from</label>
                    <div className={cn(
                      "transition-all",
                      !hasSearched
                        ? "bg-muted/40 rounded-2xl border border-border/60 px-5 py-4 hover:bg-card hover:border-primary/40 hover:shadow-sm focus-within:bg-card focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                        : "bg-card rounded-xl border border-border px-3 py-3 hover:border-primary/40 hover:shadow-sm"
                    )}>
                      <AirportPicker label="" placeholder="Where from?" selected={modFrom} onSelect={setModFrom} excludeCode={modTo?.code} />
                    </div>
                  </div>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10" style={{ marginTop: '12px' }}>
                    <button
                      onClick={() => { const t = modFrom; setModFrom(modTo); setModTo(t); }}
                      className={cn(
                        "rounded-full flex items-center justify-center transition-all duration-300",
                        !hasSearched
                          ? "w-11 h-11 bg-white text-primary shadow-[0_8px_24px_-6px_hsl(220_60%_20%/0.25)] border border-white/80 hover:scale-110 hover:shadow-[0_12px_28px_-6px_hsl(var(--primary)/0.4)] hover:rotate-180 active:scale-95"
                          : "w-9 h-9 bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-110 border-[3px] border-[hsl(40,30%,96%)]"
                      )}
                    >
                      <ArrowLeftRight className={cn(!hasSearched ? "w-4 h-4" : "w-3.5 h-3.5")} />
                    </button>
                  </div>
                  <div className="flex-1">
                    <label className={cn(
                      "text-[11px] font-bold uppercase tracking-wider mb-1.5 block",
                      !hasSearched ? "text-muted-foreground/80 ml-4 text-[10px] tracking-[0.18em]" : "text-muted-foreground"
                    )}>Flying to</label>
                    <div className={cn(
                      "transition-all",
                      !hasSearched
                        ? "bg-muted/40 rounded-2xl border border-border/60 px-5 py-4 hover:bg-card hover:border-primary/40 hover:shadow-sm focus-within:bg-card focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                        : "bg-card rounded-xl border border-border px-3 py-3 hover:border-primary/40 hover:shadow-sm"
                    )}>
                      <AirportPicker label="" placeholder="Where to?" selected={modTo} onSelect={setModTo} excludeCode={modFrom?.code} />
                    </div>
                  </div>
                </div>

                <div className="sm:hidden mb-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Flying from & to</label>
                  <div className="relative bg-card rounded-xl border border-border overflow-hidden">
                    <div className="px-3 py-2">
                      <AirportPicker label="" placeholder="Where from?" selected={modFrom} onSelect={setModFrom} excludeCode={modTo?.code} />
                    </div>
                    <div className="relative">
                      <div className="border-t border-dashed border-border" />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                        <button
                          onClick={() => { const t = modFrom; setModFrom(modTo); setModTo(t); }}
                          className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                        >
                          <ArrowLeftRight className="w-3 h-3 rotate-90" />
                        </button>
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <AirportPicker label="" placeholder="Where to?" selected={modTo} onSelect={setModTo} excludeCode={modFrom?.code} />
                    </div>
                  </div>
                </div>

                <div className={cn("grid grid-cols-2 gap-2 sm:gap-3", "sm:grid-cols-3")}>
                  {modTripType === "round-trip" ? (
                    <div>
                      <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 block", !hasSearched ? "text-muted-foreground/80 ml-4 text-[10px] tracking-[0.18em]" : "text-muted-foreground")}>Departure Date — Return Date</label>
                      <Popover open={modFlightDatesOpen} onOpenChange={(open) => {
                        setModFlightDatesOpen(open);
                        if (open) {
                          setModDraftDepart(undefined);
                          setModDraftReturn(undefined);
                          setModFlightDateStep("depart");
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <button className={cn("flex items-center gap-2 transition-all w-full text-left", !hasSearched ? "bg-muted/40 rounded-2xl border border-border/60 px-5 py-4 hover:bg-card hover:border-primary/40 hover:shadow-sm h-[64px]" : "bg-card rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 hover:shadow-sm h-[42px] sm:h-[44px]")}>
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className={cn("text-xs sm:text-sm font-semibold truncate", modDate ? "text-foreground" : "text-muted-foreground")}>
                                {modDate ? format(modDate, "dd MMM") : "Depart"}
                              </span>
                              <span className="text-muted-foreground text-xs">→</span>
                              <span className={cn("text-xs sm:text-sm font-semibold truncate", modReturnDate ? "text-foreground" : "text-muted-foreground")}>
                                {modReturnDate ? format(modReturnDate, "dd MMM") : "Return"}
                              </span>
                              {modDate && modReturnDate && (
                                <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 ml-auto flex-shrink-0">
                                  {Math.round((modReturnDate.getTime() - modDate.getTime()) / 86400000)}D
                                </span>
                              )}
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-3 pb-1.5 border-b border-border/60">
                            <div className="flex gap-2">
                              <button onClick={() => setModFlightDateStep("depart")} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", modFlightDateStep === "depart" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>
                                {modDraftDepart ? format(modDraftDepart, "dd MMM yyyy") : "Departure"}
                              </button>
                              <button onClick={() => { if (modDraftDepart) setModFlightDateStep("return"); }} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", modFlightDateStep === "return" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>
                                {modDraftReturn ? format(modDraftReturn, "dd MMM yyyy") : "Return"}
                              </button>
                            </div>
                          </div>
                          <Calendar mode="single" selected={modFlightDateStep === "depart" ? modDraftDepart : modDraftReturn} onSelect={(d) => {
                            if (!d) return;
                            if (modFlightDateStep === "depart") {
                              setModDraftDepart(d);
                              if (modDraftReturn && modDraftReturn <= d) { setModDraftReturn(undefined); }
                              setModFlightDateStep("return");
                            } else {
                              setModDate(modDraftDepart!);
                              setModReturnDate(d);
                              setModFlightDatesOpen(false);
                            }
                          }} disabled={(date) => modFlightDateStep === "depart" ? date < new Date() : date < (modDraftDepart || new Date())} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <div>
                      <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 block", !hasSearched ? "text-muted-foreground/80 ml-4 text-[10px] tracking-[0.18em]" : "text-muted-foreground")}>Departure Date</label>
                      <Popover open={modDatePopoverOpen} onOpenChange={setModDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <button className={cn("flex items-center gap-2 transition-all w-full text-left", !hasSearched ? "bg-muted/40 rounded-2xl border border-border/60 px-5 py-4 hover:bg-card hover:border-primary/40 hover:shadow-sm h-[64px]" : "bg-card rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 hover:shadow-sm")}>
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                            </div>
                            <span className={cn("font-semibold truncate", !hasSearched ? "text-base" : "text-xs sm:text-sm", modDate ? "text-foreground" : "text-muted-foreground")}>
                              {modDate ? format(modDate, "dd MMM yyyy") : "Select date"}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={modDate} onSelect={(d) => { setModDate(d ?? undefined); setModDatePopoverOpen(false); }} disabled={(date) => date < new Date()} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <div>
                    <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 block", !hasSearched ? "text-muted-foreground/80 ml-4 text-[10px] tracking-[0.18em]" : "text-muted-foreground")}>Travelers</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn("flex items-center gap-2 transition-all w-full text-left", !hasSearched ? "bg-muted/40 rounded-2xl border border-border/60 px-5 py-4 hover:bg-card hover:border-primary/40 hover:shadow-sm h-[64px]" : "bg-card rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 hover:shadow-sm")}>
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          </div>
                          <span className={cn("font-semibold text-foreground whitespace-nowrap truncate", !hasSearched ? "text-base" : "text-xs sm:text-sm")}>
                            {modAdults + modChildren + modInfants} Traveler{(modAdults + modChildren + modInfants) > 1 ? "s" : ""}
                          </span>
                          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4" align="start">
                        <div className="space-y-4">
                          <TravelerCounter label="Adults" subtitle="Age 12+" value={modAdults} onChange={handleSetModAdults} min={1} max={maxAdultPlusChild - modChildren} />
                          <TravelerCounter label="Children" subtitle="Age 2–11" value={modChildren} onChange={handleSetModChildren} min={0} max={maxAdultPlusChild - modAdults} disabled={modStudentFare} />
                          <TravelerCounter label="Infants" subtitle="Under 2" value={modInfants} onChange={handleSetModInfants} min={0} max={modAdults} disabled={modStudentFare} />
                          <p className={cn("text-[10px] text-muted-foreground text-center transition-opacity", modAdultChildTotal >= 7 ? "opacity-100" : "opacity-0")}>Max 9 passengers (adults + children)</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <Button
                      onClick={() => { handleModifySearch(); if (isMobile) setSearchExpanded(false); }}
                      className={cn(
                        "w-full rounded-full font-bold transition-all",
                        !hasSearched
                          ? "h-[64px] text-base bg-gradient-to-br from-accent via-accent to-accent/90 hover:from-accent hover:via-accent/95 hover:to-accent text-accent-foreground shadow-[0_12px_32px_-8px_hsl(var(--accent)/0.55)] hover:shadow-[0_18px_40px_-8px_hsl(var(--accent)/0.7)] hover:-translate-y-0.5 active:translate-y-0"
                          : "h-10 sm:h-12 text-sm sm:text-base bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-xl"
                      )}
                    >
                      {!hasSearched ? "Search Flights" : "Search Now"}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Multi-city fields */}
            {modTripType === "multi-city" && (
              <>
                <div className="space-y-2 mb-3">
                  {modMultiCityLegs.map((leg, idx) => (
                    <div key={idx}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Flight {idx + 1}</span>
                        {modMultiCityLegs.length > 2 && (
                          <button onClick={() => removeModMultiCityLeg(idx)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="bg-card rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 transition-all">
                          <AirportPicker label="" placeholder="From?" selected={leg.from} onSelect={(a) => updateModMultiCityLeg(idx, 'from', a)} excludeCode={leg.to?.code} />
                        </div>
                        <div className="bg-card rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 transition-all">
                          <AirportPicker label="" placeholder="To?" selected={leg.to} onSelect={(a) => updateModMultiCityLeg(idx, 'to', a)} excludeCode={leg.from?.code} />
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                              </div>
                              <span className={cn("text-xs sm:text-sm font-semibold truncate", leg.date ? "text-foreground" : "text-muted-foreground")}>
                                {leg.date ? format(leg.date, "dd/MM/yyyy") : "Date"}
                              </span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={leg.date} onSelect={(d) => updateModMultiCityLeg(idx, 'date', d)} disabled={(date) => {
                              const today = new Date(); today.setHours(0,0,0,0);
                              if (date < today) return true;
                              if (idx > 0 && modMultiCityLegs[idx - 1]?.date) {
                                const prevDate = new Date(modMultiCityLegs[idx - 1].date!); prevDate.setHours(0,0,0,0);
                                if (date < prevDate) return true;
                              }
                              return false;
                            }} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}
                  {modMultiCityLegs.length < 5 && (
                    <button onClick={addModMultiCityLeg} className="flex items-center gap-1.5 text-primary text-xs font-bold hover:text-primary/80 transition-colors mt-1">
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add another city
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Traveler</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 hover:shadow-sm transition-all w-full text-left">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap truncate">
                            {modAdults + modChildren + modInfants} Traveler{(modAdults + modChildren + modInfants) > 1 ? "s" : ""}
                          </span>
                          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4" align="start">
                        <div className="space-y-4">
                          <TravelerCounter label="Adults" subtitle="Age 12+" value={modAdults} onChange={handleSetModAdults} min={1} max={maxAdultPlusChild - modChildren} />
                          <TravelerCounter label="Children" subtitle="Age 2–11" value={modChildren} onChange={handleSetModChildren} min={0} max={maxAdultPlusChild - modAdults} disabled={modStudentFare} />
                          <TravelerCounter label="Infants" subtitle="Under 2" value={modInfants} onChange={handleSetModInfants} min={0} max={modAdults} disabled={modStudentFare} />
                          <p className={cn("text-[10px] text-muted-foreground text-center transition-opacity", modAdultChildTotal >= 7 ? "opacity-100" : "opacity-0")}>Max 9 passengers (adults + children)</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <Button
                      onClick={() => { handleModifySearch(); if (isMobile) setSearchExpanded(false); }}
                      className="h-10 sm:h-12 w-full rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all"
                    >
                      Search Now
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Fare options — switch-style toggles */}
            <div className="flex flex-wrap items-center gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/40">
              <div className="flex items-center gap-1 bg-muted/40 rounded-xl border border-border/60 p-1">
                {([
                  { label: "Regular", active: modRegularFare, onClick: () => { setModRegularFare(true); setModStudentFare(false); } },
                  { label: "Student", active: modStudentFare, onClick: () => { setModStudentFare(true); setModRegularFare(false); } },
                ] as const).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={opt.onClick}
                    className={cn(
                      "relative px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-300",
                      opt.active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setModDirectFlight(!modDirectFlight)}
                className="flex items-center gap-2 group"
              >
                <div className={cn(
                  "w-9 h-5 rounded-full transition-all duration-300 relative",
                  modDirectFlight ? "bg-primary shadow-sm shadow-primary/30" : "bg-muted-foreground/20"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-card shadow-sm transition-all duration-300",
                    modDirectFlight ? "left-[18px]" : "left-0.5"
                  )} />
                </div>
                <span className={cn(
                  "text-[11px] sm:text-xs font-bold transition-colors",
                  modDirectFlight ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  Direct Only
                </span>
              </button>
            </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}

      {/* Initial-state landing extras: "Where to next?" features + Popular Destinations */}
      {!hasSearched && !isHybrid && (
        <>
          <FlightsWhereToNext />
          <PopularFlightDestinations />
        </>
      )}


      {hasSearched && !loading && (searchParams.get("from") && searchParams.get("to") || searchParams.get("legs")) && (() => {
        const legsParam = searchParams.get("legs");
        const isMulti = !!legsParam;
        const hybridLegs: HybridLeg[] = isMulti
          ? legsParam!.split(",").map(l => {
              const [from, to, date] = l.split("_");
              return {
                from,
                fromCity: findAirport(from)?.city || "",
                to,
                toCity: findAirport(to)?.city || "",
                date,
              };
            })
          : [];
        const tripType: TripType = isMulti ? "multi-city" : (searchParams.get("returnDate") ? "round-trip" : "one-way");
        const travelers = (parseInt(searchParams.get("adults") || "1") || 1)
          + (parseInt(searchParams.get("children") || "0") || 0)
          + (parseInt(searchParams.get("infants") || "0") || 0);
        const cabin = searchParams.get("class") || "Economy";
        const onModify = () => {
          const next = !searchExpanded;
          setSearchExpanded(next);
          if (next) {
            setTimeout(() => {
              document.getElementById("modify-search-inline")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 50);
          }
        };
        return (
          <div className="container mx-auto px-4 mb-4 order-1">
            <HybridFlightHeroBar
              tripType={tripType}
              origin={searchParams.get("from") || ""}
              originCity={findAirport(searchParams.get("from") || "")?.city || ""}
              destination={searchParams.get("to") || ""}
              destinationCity={findAirport(searchParams.get("to") || "")?.city || ""}
              departDate={searchParams.get("date") || ""}
              returnDate={searchParams.get("returnDate") || undefined}
              legs={isMulti ? hybridLegs : undefined}
              travelers={travelers}
              cabin={cabin}
              modifyOpen={searchExpanded}
              onModify={onModify}
            />
          </div>
        );
      })()}

      </div>
      {/* /flex column wrapper */}

      <div className="container mx-auto px-4 py-6 lg:py-10">
        {loading ? (
          isHybrid ? <HybridSearchLoader variant="flights" /> : <FlightSearchLoader />
        ) : (
        <div className="flex flex-col lg:flex-row gap-4 xl:gap-6">
          {/* LEFT — B2C filters sidebar */}
          {hasSearched && (
            <aside className="hidden lg:block lg:w-[240px] xl:w-[260px] flex-shrink-0">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hover pr-1">
                {(() => {
                  const FiltersComp = isHybrid ? HybridFlightsFiltersSidebar : B2CFiltersSidebar;
                  return (
                    <FiltersComp
                  currencySymbol={CURRENCIES[displayCurrency].symbol}
                  activeChips={[
                    ...(stopFilter !== null ? [{ id: "stop", label: stopFilter === 0 ? "Non-stop" : stopFilter === 1 ? "1 Stop" : "2+ Stops", onRemove: () => setStopFilter(null) }] : []),
                    ...Array.from(selectedAirlines).map(code => ({ id: `air-${code}`, label: getAirlineName(code), onRemove: () => toggleAirline(code) })),
                    ...(refundableOnly ? [{ id: "ref", label: "Refundable", onRemove: () => setRefundableOnly(false) }] : []),
                    ...((departureTime[0] !== 0 || departureTime[1] !== 24) ? [{ id: "dep", label: `${String(departureTime[0]).padStart(2,"0")}:00–${String(departureTime[1]).padStart(2,"0")}:00`, onRemove: () => setDepartureTime([0, 24]) }] : []),
                  ]}
                  priceMin={priceSliderMin}
                  priceMax={priceSliderMax}
                  priceValue={priceRange ?? [priceSliderMin, priceSliderMax]}
                  onPriceChange={(v) => { setPriceRange(v); setMaxPrice(v[1]); }}
                  stopFilter={stopFilter}
                  onStopChange={setStopFilter}
                  stopCounts={stopOptions}
                  airlines={airlineOptions}
                  selectedAirlines={selectedAirlines}
                  onToggleAirline={toggleAirline}
                  departureTime={departureTime}
                  onDepartureTimeChange={setDepartureTime}
                  arrivalTime={arrivalTime}
                  onArrivalTimeChange={setArrivalTime}
                  refundableOnly={refundableOnly}
                  onRefundableChange={setRefundableOnly}
                  onResetAll={() => {
                    setStopFilter(null); setSelectedAirlines(new Set());
                    setMaxPrice(priceSliderMax); setPriceRange([priceSliderMin, priceSliderMax]);
                    setDepartureTime([0, 24]); setArrivalTime([0, 24]); setRefundableOnly(false);
                  }}
                />
                  );
                })()}
              </div>
            </aside>
          )}

          {/* Mobile filter trigger */}
          {hasSearched && (
            <div className="lg:hidden mb-3">
              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-full border-border/60 h-9 text-xs font-semibold">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                    {(stopFilter !== null || selectedAirlines.size > 0 || refundableOnly) && (
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center ml-0.5">
                        {(stopFilter !== null ? 1 : 0) + selectedAirlines.size + (refundableOnly ? 1 : 0)}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                  <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                  <div className="py-4">
                    {(() => {
                      const FiltersComp = isHybrid ? HybridFlightsFiltersSidebar : B2CFiltersSidebar;
                      return (
                        <FiltersComp
                      currencySymbol={CURRENCIES[displayCurrency].symbol}
                      activeChips={[]}
                      priceMin={priceSliderMin} priceMax={priceSliderMax}
                      priceValue={priceRange ?? [priceSliderMin, priceSliderMax]}
                      onPriceChange={(v) => { setPriceRange(v); setMaxPrice(v[1]); }}
                      stopFilter={stopFilter} onStopChange={setStopFilter} stopCounts={stopOptions}
                      airlines={airlineOptions} selectedAirlines={selectedAirlines} onToggleAirline={toggleAirline}
                      departureTime={departureTime} onDepartureTimeChange={setDepartureTime}
                      arrivalTime={arrivalTime} onArrivalTimeChange={setArrivalTime}
                      refundableOnly={refundableOnly} onRefundableChange={setRefundableOnly}
                      onResetAll={() => {
                        setStopFilter(null); setSelectedAirlines(new Set());
                        setMaxPrice(priceSliderMax); setPriceRange([priceSliderMin, priceSliderMax]);
                        setDepartureTime([0, 24]); setArrivalTime([0, 24]); setRefundableOnly(false);
                      }}
                    />
                      );
                    })()}
                    <Button onClick={() => setFilterOpen(false)} className="w-full mt-4 rounded-full font-bold">
                      Show {filtered.length} results
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-4 wl-results" data-wl-surface="results">
            {/* Unified results header + sort — single premium card */}
            {filtered.length > 0 && (() => {
              const cheapest = [...filtered].sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b))[0];
              const fastest = [...filtered].sort((a, b) => parseDurationToMinutes(a.duration) - parseDurationToMinutes(b.duration))[0];
              const bestScore = (f: Flight) => getDisplayPrice(f) * 0.6 + parseDurationToMinutes(f.duration) * 10;
              const best = [...filtered].sort((a, b) => bestScore(a) - bestScore(b))[0];
              const earliest = [...filtered].sort((a, b) => {
                const ta = new Date(a.departure).getTime();
                const tb = new Date(b.departure).getTime();
                return ta - tb;
              })[0];
              const earliestTimeLabel = earliest?.departure ? formatFlightTime(earliest.departure) : undefined;
              const tabs: { key: "best" | "price" | "duration" | "earliest"; label: string; price?: number; duration?: string; earliestTime?: string }[] = [
                { key: "best", label: "Best", price: getDisplayPrice(best), duration: best?.duration },
                { key: "price", label: "Cheapest", price: getDisplayPrice(cheapest), duration: cheapest?.duration },
                { key: "duration", label: "Fastest", price: getDisplayPrice(fastest), duration: fastest?.duration },
                { key: "earliest", label: "Earliest", earliestTime: earliestTimeLabel },
              ];

              return (
                isHybrid ? (
                  <HybridResultsHeader
                    eyebrow="Curated for you"
                    headline={`${filtered.length.toLocaleString()} flight${filtered.length === 1 ? "" : "s"} ready to book`}
                    meta={`From ${airlineOptions.length} airline${airlineOptions.length === 1 ? "" : "s"} · Live pricing`}
                    tabs={tabs.map((t: any) => ({
                      key: t.key,
                      label: t.label,
                      hint: t.price
                        ? `${CURRENCIES[displayCurrency].symbol}${Math.round(t.price).toLocaleString()}`
                        : t.earliestTime || t.duration,
                    }))}
                    active={sortBy as any}
                    onChange={(m) => setSortBy(m as any)}
                  />
                ) : (
                <div className="bg-card border border-border/60 rounded-2xl px-4 py-3.5 shadow-sm">
                  {/* Headline row */}
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-[15px] font-bold text-foreground tracking-tight">
                        {filtered.length.toLocaleString()} flight{filtered.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        from {airlineOptions.length} airline{airlineOptions.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:inline">
                      Sort by
                    </span>
                  </div>

                  {/* Sort pills */}
                  <PillSortTabs
                    tabs={tabs as any}
                    active={sortBy as any}
                    onChange={(m) => setSortBy(m as any)}
                    hasAiPick={false}
                    currencySymbol={CURRENCIES[displayCurrency].symbol}
                  />
                </div>
                )
              );
            })()}

            {/* Active filter chips are rendered inside B2CFiltersSidebar — no duplicate here */}
            {/* Initial empty-state is now handled by FlightsWhereToNext above the results region */}
            {groupedFlights.length === 0 && !loading && hasSearched && (
              <div className="text-center py-16">
                <Plane className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">No flights found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search criteria or dates</p>
              </div>
            )}
            {groupedFlights.map((group, gi) => {
              const flight = group.primary;
              const i = gi;
              const hasReturn = !!searchParams.get("returnDate");
              const adults = parseInt(searchParams.get("adults") || "1");
              const childCount = parseInt(searchParams.get("children") || "0");
              const infantCount = parseInt(searchParams.get("infants") || "0");
              const paxP = flight.paxPricing;
              const hasApiPricing = flight.basePrice !== undefined && flight.taxes !== undefined;
              // Use flight.price as the canonical per-adult total (already rounded correctly by backend)
              const perAdultTotal = Math.round(Number(flight.price));
              const perAdultBase = Math.round(hasApiPricing ? (flight.basePrice ?? 0) : perAdultTotal);
              const perAdultTax = Math.round(hasApiPricing ? (flight.taxes ?? 0) : 0);
              const childPrice = paxP?.CHD ? Math.round(paxP.CHD.total) : Math.round(perAdultTotal * 0.75);
              const infantPrice = paxP?.INF ? Math.round(paxP.INF.total) : Math.round(perAdultTotal * 0.10);
              const totalPax = adults + childCount + infantCount;
               const src = flight.source === "database" ? "local_inventory" : flight.source;
               // Prices are already converted by backend — use flight.price as canonical total
               const displayAdultTotal = perAdultTotal * adults;
               const displayChildTotal = childPrice * childCount;
               const displayInfantTotal = infantPrice * infantCount;
               const displayTotal = displayAdultTotal + displayChildTotal + displayInfantTotal;

              const multiCityLegs = getMultiCityLegs(flight);
              const isMultiCitySearch = !!searchParams.get("legs");
              const isMultiCityResult = multiCityLegs.length > 2 || (multiCityLegs.length === 2 && isMultiCitySearch) || (multiCityLegs.length === 2 && !hasReturn);

              const outboundSegs = getOutboundSegments(flight);
              const layovers = getLayovers(outboundSegs.length > 0 ? outboundSegs : flight.segments);
              const actualStops = getOutboundStops(flight);
              const outboundArrival = getOutboundArrival(flight);
              const returnLeg = !isMultiCityResult && hasReturn ? getReturnLegInfo(flight) : null;
              const returnLayovers = returnLeg ? getLayovers(returnLeg.segments) : [];

              const stopDots = [];
              for (let s = 0; s < actualStops; s++) {
                stopDots.push(
                  <div key={s} className="w-2 h-2 rounded-full bg-accent border-2 border-background absolute" style={{ left: `${((s + 1) / (actualStops + 1)) * 100}%`, transform: 'translateX(-50%)' }} />
                );
              }

              const returnStopDots = [];
              if (returnLeg) {
                for (let s = 0; s < returnLeg.stops; s++) {
                  returnStopDots.push(
                    <div key={s} className="w-2 h-2 rounded-full bg-accent border-2 border-background absolute" style={{ left: `${((s + 1) / (returnLeg.stops + 1)) * 100}%`, transform: 'translateX(-50%)' }} />
                  );
                }
              }

              const navigateToDetail = async () => {
                const a = searchParams.get("adults") || "1";
                const c = searchParams.get("children") || "0";
                const inf = searchParams.get("infants") || "0";
                const bookUrl = `/flights/${flight.id}/book?adults=${a}&children=${c}&infants=${inf}`;
                // Save search date so booking page can reconstruct "Back to Search" URL
                const searchDate = searchParams.get("date");
                if (searchDate) sessionStorage.setItem("lastSearchDate", searchDate);

                const clearCacheAndRefresh = () => {
                  setFlights(prev => prev.filter(f => f.id !== flight.id));
                  try {
                    const cacheKey = `flight_results_${searchParams.get("from")}_${searchParams.get("to")}_${searchParams.get("date")}_${searchParams.get("returnDate")}_${searchParams.get("adults")}_${searchParams.get("class")}`;
                    sessionStorage.removeItem(cacheKey);
                  } catch {}
                };

                const handlePriceChange = (
                  verifiedFlight: any,
                  oldDisplayPrice: number,
                  newDisplayPrice: number,
                  markedUpDiff: number,
                  paxBreakdown?: PaxBreakdown[]
                ) => {
                  const isIncrease = markedUpDiff > 0;
                  setFareVerification({
                    status: "price_changed",
                    type: isIncrease ? "increased" : "decreased",
                    oldPrice: fmtPrice(oldDisplayPrice),
                    newPrice: fmtPrice(newDisplayPrice),
                    diff: fmtPrice(Math.abs(markedUpDiff)),
                    paxBreakdown,
                    onProceed: () => {
                      setFareVerification(null);
                      navigate(bookUrl, { state: { flight: verifiedFlight } });
                    },
                    onSearchAgain: () => {
                      setFareVerification(null);
                      navigate(`/flights?${searchParams.toString()}`, { replace: true });
                      window.location.reload();
                    },
                  });
                  setFlights(prev => prev.map(f => f.id === flight.id ? { ...f, price: newDisplayPrice } : f));
                };

                // Helper to build per-pax breakdown for the verification dialog
                const buildPaxBreakdown = (paxPricing: any, convRatio: number, markupPct: number): PaxBreakdown[] => {
                  const breakdown: PaxBreakdown[] = [];
                  const numAdults = parseInt(a) || 0;
                  const numChildren = parseInt(c) || 0;
                  const numInfants = parseInt(inf) || 0;

                  const applyMarkupAndConvert = (raw: number) => {
                    const marked = markupPct > 0 ? raw * (1 + markupPct / 100) : raw;
                    return Math.round(marked * convRatio);
                  };

                  if (numAdults > 0 && paxPricing?.ADT) {
                    const unit = applyMarkupAndConvert(paxPricing.ADT.total);
                    breakdown.push({ label: "Adult", count: numAdults, unitPrice: fmtPrice(unit), subtotal: fmtPrice(unit * numAdults) });
                  }
                  if (numChildren > 0 && paxPricing?.CHD) {
                    const unit = applyMarkupAndConvert(paxPricing.CHD.total);
                    breakdown.push({ label: "Child", count: numChildren, unitPrice: fmtPrice(unit), subtotal: fmtPrice(unit * numChildren) });
                  }
                  if (numInfants > 0 && paxPricing?.INF) {
                    const unit = applyMarkupAndConvert(paxPricing.INF.total);
                    breakdown.push({ label: "Infant", count: numInfants, unitPrice: fmtPrice(unit), subtotal: fmtPrice(unit * numInfants) });
                  }
                  return breakdown;
                };

                const showVerified = (verifiedFlight: any) => {
                  setFareVerification({
                    status: "verified",
                    onProceed: () => {
                      setFareVerification(null);
                      navigate(bookUrl, { state: { flight: verifiedFlight } });
                    },
                  });
                };

                // For Travelport flights, verify fare is still available
                if (flight.source === "travelport" && flight.segments?.length) {
                  setFareVerification({ status: "verifying" });
                  try {
                    const { data, error } = await supabase.functions.invoke("unified-flight-search", {
                      body: {
                        action: "price",
                        source: "travelport",
                        segments: flight.segments,
                        adults: parseInt(a),
                        children: parseInt(c),
                        infants: parseInt(inf),
                        cabinClass: flight.class || "Economy",
                        studentFare: searchParams.get("studentFare") === "true",
                      },
                    });

                    if (error || !data?.success) {
                      clearCacheAndRefresh();
                      setFareVerification({
                        status: "unavailable",
                        message: "This fare is no longer available. The airline may have sold out or updated pricing.",
                        onSearchAgain: () => {
                          navigate(`/flights?${searchParams.toString()}`, { replace: true });
                          window.location.reload();
                        },
                      });
                      return;
                    }

                    // Build verified flight with updated pricing
                    const verifiedFlight = { ...flight, fareVerified: true };
                    if (data.baggageAllowance) verifiedFlight.baggageAllowance = data.baggageAllowance;
                    if (data.basePrice != null) verifiedFlight.basePrice = data.basePrice;
                    if (data.taxes != null) verifiedFlight.taxes = data.taxes;
                    if (data.isRefundable !== undefined) verifiedFlight.isRefundable = data.isRefundable;
                    if (data.changePenalty) verifiedFlight.changePenalties = [{ applies: "Anytime", amount: `${data.changePenalty.currency}${data.changePenalty.amount}` }];
                    if (data.cancelPenalty) verifiedFlight.cancelPenalties = [{ applies: "Anytime", amount: `${data.cancelPenalty.currency}${data.cancelPenalty.amount}` }];
                    if (data.paxPricing) verifiedFlight.paxPricing = data.paxPricing;

                    // Compare raw API prices (before markup) to detect real fare changes
                    const originalRawPrice = (flight as any).rawApiPrice ?? data.totalPrice;
                    const verifiedRawPrice = data.totalPrice;
                    const priceDiff = verifiedRawPrice - originalRawPrice;

                    // Re-apply the same markup that was used during search
                    const markupPct = (flight as any).appliedMarkupPct || 0;
                    // Compute conversion ratio: display price / raw API price
                    const conversionRatio = originalRawPrice > 0 ? flight.price / originalRawPrice : 1;

                    const verifiedMarkedUpRaw = markupPct > 0
                      ? verifiedRawPrice * (1 + markupPct / 100)
                      : verifiedRawPrice;
                    const verifiedDisplayPrice = Math.round(verifiedMarkedUpRaw * conversionRatio);
                    const markedUpDiff = Math.round(priceDiff * (1 + markupPct / 100) * conversionRatio);

                    verifiedFlight.price = verifiedDisplayPrice;
                    (verifiedFlight as any).rawApiPrice = verifiedRawPrice;
                    (verifiedFlight as any).appliedMarkupPct = markupPct;

                    const paxBreakdown = buildPaxBreakdown(data.paxPricing, conversionRatio, markupPct);

                    if (Math.abs(priceDiff) > 1) {
                      handlePriceChange(verifiedFlight, flight.price, verifiedDisplayPrice, markedUpDiff, paxBreakdown);
                    } else {
                      showVerified(verifiedFlight);
                    }
                    return;
                  } catch (err) {
                    setFareVerification(null);
                    console.warn("[FareVerify] verification call failed, proceeding anyway:", err);
                  }
                }

                // For Tripjack flights, verify fare via review API
                if (flight.source === "tripjack" && (flight as any).tripjackPriceId) {
                  setFareVerification({ status: "verifying" });
                  try {
                    const { data, error } = await supabase.functions.invoke("unified-flight-search", {
                      body: {
                        action: "price",
                        source: "tripjack",
                        priceIds: [(flight as any).tripjackPriceId],
                        targetCurrency: displayCurrency,
                      },
                    });

                    if (error || !data?.success) {
                      clearCacheAndRefresh();
                      setFareVerification({
                        status: "unavailable",
                        message: data?.error || "This fare is no longer available. The airline may have sold out or updated pricing.",
                        onSearchAgain: () => {
                          navigate(`/flights?${searchParams.toString()}`, { replace: true });
                          window.location.reload();
                        },
                      });
                      return;
                    }

                    // Build verified flight with updated data from review
                    const verifiedFlight = { ...flight, fareVerified: true };
                    if (data.bookingId) (verifiedFlight as any).tripjackBookingId = data.bookingId;
                    if (data.baggageAllowance) verifiedFlight.baggageAllowance = data.baggageAllowance;
                    if (data.isRefundable !== undefined) verifiedFlight.isRefundable = data.isRefundable;
                    if (data.conditions) (verifiedFlight as any).tripjackConditions = data.conditions;
                    if (data.totalPriceInfo) (verifiedFlight as any).tripjackTotalPriceInfo = data.totalPriceInfo;
                    if (data.ssrData) (verifiedFlight as any).tripjackSsrData = data.ssrData;

                    // Handle fare alerts (price changes)
                    // Tripjack review returns raw INR prices — convert to display currency
                    // using the ratio from the original search conversion
                    if (data.fareAlert) {
                      const oldFare = data.fareAlert.oldFare || 0;
                      const newFare = data.fareAlert.newFare || 0;
                      const priceDiff = newFare - oldFare;

                      const markupPct = (flight as any).appliedMarkupPct || 0;
                      // Compute conversion ratio: display price / raw API price
                      const originalApiPrice = (flight as any).rawApiPrice || (flight as any).originalPrice || oldFare;
                      const conversionRatio = originalApiPrice > 0 ? flight.price / originalApiPrice : 1;

                      const newMarkedUpRaw = markupPct > 0
                        ? newFare * (1 + markupPct / 100)
                        : newFare;
                      // Convert the new INR price to display currency using same ratio
                      const verifiedDisplayPrice = Math.round(newMarkedUpRaw * conversionRatio);
                      const markedUpDiff = Math.round(priceDiff * (1 + markupPct / 100) * conversionRatio);

                      verifiedFlight.price = verifiedDisplayPrice;
                      (verifiedFlight as any).rawApiPrice = newFare;

                      if (Math.abs(priceDiff) > 1) {
                        const tjPaxBreakdown = buildPaxBreakdown(data.paxPricing, conversionRatio, markupPct);
                        handlePriceChange(verifiedFlight, flight.price, verifiedDisplayPrice, markedUpDiff, tjPaxBreakdown);
                        return;
                      }
                    }

                    showVerified(verifiedFlight);
                    return;
                  } catch (err) {
                    setFareVerification(null);
                    console.warn("[TripjackFareVerify] verification call failed, proceeding anyway:", err);
                  }
                }

                // For Amadeus flights, verify fare via price API
                if (flight.source === "amadeus" && (flight as any).amadeusRawOffer) {
                  setFareVerification({ status: "verifying" });
                  try {
                    const { data, error } = await supabase.functions.invoke("unified-flight-search", {
                      body: {
                        action: "price",
                        source: "amadeus",
                        rawOffer: (flight as any).amadeusRawOffer,
                      },
                    });

                    if (error || !data?.success) {
                      clearCacheAndRefresh();
                      setFareVerification({
                        status: "unavailable",
                        message: data?.error || "This fare is no longer available. The airline may have sold out or updated pricing.",
                        onSearchAgain: () => {
                          navigate(`/flights?${searchParams.toString()}`, { replace: true });
                          window.location.reload();
                        },
                      });
                      return;
                    }

                    // Build verified flight with updated pricing
                    const verifiedFlight = { ...flight, fareVerified: true };
                    if (data.baggageAllowance) verifiedFlight.baggageAllowance = data.baggageAllowance;
                    if (data.basePrice != null) verifiedFlight.basePrice = data.basePrice;
                    if (data.taxes != null) verifiedFlight.taxes = data.taxes;
                    if (data.isRefundable !== undefined) verifiedFlight.isRefundable = data.isRefundable;
                    if (data.paxPricing) verifiedFlight.paxPricing = data.paxPricing;
                    // Store verified raw offer for booking
                    if (data.verifiedRawOffer) (verifiedFlight as any).amadeusRawOffer = data.verifiedRawOffer;

                    const originalRawPrice = (flight as any).rawApiPrice ?? data.oldPrice;
                    const verifiedRawPrice = data.totalPrice;
                    const priceDiff = verifiedRawPrice - originalRawPrice;

                    const markupPct = (flight as any).appliedMarkupPct || 0;
                    const conversionRatio = originalRawPrice > 0 ? flight.price / originalRawPrice : 1;

                    const verifiedMarkedUpRaw = markupPct > 0
                      ? verifiedRawPrice * (1 + markupPct / 100)
                      : verifiedRawPrice;
                    const verifiedDisplayPrice = Math.round(verifiedMarkedUpRaw * conversionRatio);
                    const markedUpDiff = Math.round(priceDiff * (1 + markupPct / 100) * conversionRatio);

                    verifiedFlight.price = verifiedDisplayPrice;
                    (verifiedFlight as any).rawApiPrice = verifiedRawPrice;
                    (verifiedFlight as any).appliedMarkupPct = markupPct;

                    const amPaxBreakdown = buildPaxBreakdown(data.paxPricing, conversionRatio, markupPct);

                    if (Math.abs(priceDiff) > 0.01) {
                      handlePriceChange(verifiedFlight, flight.price, verifiedDisplayPrice, markedUpDiff, amPaxBreakdown);
                    } else {
                      showVerified(verifiedFlight);
                    }
                    return;
                  } catch (err) {
                    setFareVerification(null);
                    console.warn("[AmadeusFareVerify] verification call failed, proceeding anyway:", err);
                  }
                }

                // Non-API flights (database, travelvela) go directly to booking
                navigate(bookUrl, { state: { flight } });
              };

              // Compute "cheapest"/"fastest" badges
              const cheapestId = filtered.length
                ? [...filtered].sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b))[0]?.id
                : undefined;
              const fastestId = filtered.length
                ? [...filtered].sort((a, b) => parseDurationToMinutes(a.duration) - parseDurationToMinutes(b.duration))[0]?.id
                : undefined;

              // AI Pick: prefer API insight; fallback to "best balance" of price+duration
              // (top result when sorted by Best score) so the design always shows a recommendation.
              const fallbackAiPickId = filtered.length
                ? [...filtered].sort((a, b) => {
                    const sa = getDisplayPrice(a) * 0.6 + parseDurationToMinutes(a.duration) * 10;
                    const sb = getDisplayPrice(b) * 0.6 + parseDurationToMinutes(b.duration) * 10;
                    return sa - sb;
                  })[0]?.id
                : undefined;
              // Badge persists across all sort modes; pinning to top happens only on "best"
              const apiPickValid = aiInsight?.ai_pick_id && filtered.some((f) => f.id === aiInsight.ai_pick_id) ? aiInsight.ai_pick_id : null;
              const effectiveAiPickId = apiPickValid || fallbackAiPickId;
              const isAiPick = !!(effectiveAiPickId && flight.id === effectiveAiPickId);

              // Savings vs the MEDIAN visible fare — using max produces absurd numbers
              // when an expensive outlier (e.g., business class) is in the same list.
              // Show only when the save is meaningful (≥8%) and ≤ 60% (sanity cap).
              const visiblePrices = filtered.length
                ? filtered.map((f) => getDisplayPrice(f)).sort((a, b) => a - b)
                : [];
              const medianVisible = visiblePrices.length
                ? visiblePrices[Math.floor(visiblePrices.length / 2)]
                : 0;
              const saveAmount = medianVisible > 0 && displayTotal < medianVisible
                ? Math.round(medianVisible - displayTotal)
                : 0;
              const savePct = medianVisible > 0 ? saveAmount / medianVisible : 0;
              // Compact format: 12,500 → "12.5K", 638,038 → "638K"
              const compactSave = (n: number) => {
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
                if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
                return n.toLocaleString();
              };
              const savings = savePct >= 0.08 && savePct <= 0.6
                ? `${CURRENCIES[displayCurrency].symbol}${compactSave(saveAmount)} · ${Math.round(savePct * 100)}%`
                : undefined;

              const layoverSummary = layovers.length
                ? layovers.map(l => `${l.duration ? l.duration + " " : ""}${l.city}`).filter(Boolean).join(" · ")
                : undefined;

              const flightNumber = (flight as any).flightNumber
                || (flight.segments?.[0] ? `${flight.segments[0].carrier || flight.airline}${flight.segments[0].flightNumber || ""}` : undefined);
              const aircraft = (flight.segments?.[0] as any)?.aircraft || (flight as any).aircraft;

              // Only show rationale when the AI actually returned one — no fabricated fallback text.
              const rawRationale = isAiPick
                ? ((aiInsight as any)?.ai_pick_reason || (aiInsight as any)?.ai_pick_rationale)
                : undefined;
              const aiRationale = typeof rawRationale === "string" && rawRationale.trim().length > 10
                ? rawRationale.trim()
                : undefined;

              return (
                <motion.div
                  key={group.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03 }}
                >
                  <FlightCardComp
                    airlineCode={flight.airline}
                    airlineName={getAirlineName(flight.airline)}
                    flightNumber={flightNumber}
                    aircraft={aircraft}
                    origin={searchParams.get("from") || flight.from_city || ""}
                    destination={searchParams.get("to") || flight.to_city || ""}
                    departureTime={formatFlightTime(flight.departure)}
                    arrivalTime={formatFlightTime(outboundArrival)}
                    duration={flight.duration}
                    stops={actualStops}
                    layoverSummary={layoverSummary}
                    baggageCheckin={flight.baggageAllowance?.checkin}
                    baggageCabin={flight.baggageAllowance?.cabin}
                    refundable={Boolean((flight as any).isRefundable ?? (flight as any).refundable)}
                    fareType={getClassDisplay(flight)}
                    price={`${CURRENCIES[displayCurrency].symbol}${displayTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    perTravelerLabel={totalPax > 1 ? `for ${totalPax} travelers` : "per traveler"}
                    savings={savings}
                    isAiPick={isAiPick}
                    isCheapest={!isAiPick && flight.id === cheapestId}
                    isFastest={!isAiPick && flight.id === fastestId}
                    aiRationale={aiRationale}
                    /* bookedTodayCount removed — synthetic urgency, not real data */
                    seatsLeft={
                      // Real per-flight seats from supplier (Amadeus = `seats`, others may use `seatsRemaining`).
                      // Only pass through when it's a small bookable count — never fabricate.
                      (() => {
                        const raw = (flight as any).seatsRemaining ?? (flight as any).seats;
                        const n = Number(raw);
                        return Number.isFinite(n) && n > 0 && n <= 9 ? n : undefined;
                      })()
                    }
                    inCompare={compareIds.has(flight.id)}
                    onCompareToggle={() => toggleCompare(flight.id)}
                    onSelect={navigateToDetail}
                    onViewDetails={() => toggleGroupExpand(group.key)}
                  />

                  {/* Expandable Flight Details — premium inline panel that visually extends the card */}
                  <AnimatePresence initial={false}>
                    {expandedGroups.has(group.key) && (
                      <motion.div
                        key="details"
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div
                          className={cn(
                            "-mt-2 rounded-b-2xl border border-t-0 bg-card overflow-hidden relative",
                            isAiPick ? "border-primary/40" : "border-border/50",
                            "shadow-[0_12px_32px_-18px_hsl(var(--primary)/0.35)]"
                          )}
                        >
                          {/* Decorative top fade so it visually flows from the card */}
                          <div className="absolute inset-x-6 -top-px h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                          <FlightDetailsPanel
                            flight={flight}
                            airlineName={getAirlineName(flight.airline)}
                            hasReturn={hasReturn}
                            adults={adults}
                            children={childCount}
                            infants={infantCount}
                            studentFare={searchParams.get("studentFare") === "true"}
                            defaultOpen
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Alternative timings — separate toggle, renders the alt flight cards */}
                  {group.alternatives.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleAlternativesExpand(group.key)}
                        className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold text-primary/80 hover:text-primary hover:bg-primary/[0.04] transition-colors"
                      >
                        <Clock className="w-3 h-3" />
                        {expandedAlternatives.has(group.key)
                          ? "Hide alternative timings"
                          : `+${group.alternatives.length} more timing${group.alternatives.length > 1 ? "s" : ""}`}
                        <ChevronDown className={cn("w-3 h-3 transition-transform", expandedAlternatives.has(group.key) && "rotate-180")} />
                      </button>

                      {expandedAlternatives.has(group.key) && (
                        <div className="mt-2 space-y-2 pl-3 border-l-2 border-primary/20">
                          {group.alternatives.map((alt) => {
                            const altDisplayTotal = getDisplayPrice(alt) * totalPax;
                            const altOutboundArrival = alt.arrival;
                            const altActualStops = alt.stops;
                            const altLayovers = (alt.segments && alt.segments.length > 1)
                              ? alt.segments.slice(0, -1).map((s, idx) => ({
                                  city: s.destination || "",
                                  duration: (alt.segments?.[idx + 1] as any)?.layoverDuration || "",
                                }))
                              : [];
                            const altLayoverSummary = altLayovers.length
                              ? altLayovers.map(l => `${l.duration ? l.duration + " " : ""}${l.city}`).filter(Boolean).join(" · ")
                              : undefined;
                            const altFlightNumber = (alt as any).flightNumber
                              || (alt.segments?.[0] ? `${alt.segments[0].carrier || alt.airline}${alt.segments[0].flightNumber || ""}` : undefined);
                            const altAircraft = (alt.segments?.[0] as any)?.aircraft || (alt as any).aircraft;
                            return (
                              <FlightCardComp
                                key={alt.id}
                                airlineCode={alt.airline}
                                airlineName={getAirlineName(alt.airline)}
                                flightNumber={altFlightNumber}
                                aircraft={altAircraft}
                                origin={searchParams.get("from") || alt.from_city || ""}
                                destination={searchParams.get("to") || alt.to_city || ""}
                                departureTime={formatFlightTime(alt.departure)}
                                arrivalTime={formatFlightTime(altOutboundArrival)}
                                duration={alt.duration}
                                stops={altActualStops}
                                layoverSummary={altLayoverSummary}
                                baggageCheckin={alt.baggageAllowance?.checkin}
                                baggageCabin={alt.baggageAllowance?.cabin}
                                refundable={Boolean((alt as any).isRefundable ?? (alt as any).refundable)}
                                fareType={getClassDisplay(alt)}
                                price={`${CURRENCIES[displayCurrency].symbol}${altDisplayTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                perTravelerLabel={totalPax > 1 ? `for ${totalPax} travelers` : "per traveler"}
                                inCompare={compareIds.has(alt.id)}
                                onCompareToggle={() => toggleCompare(alt.id)}
                                onSelect={() => {
                                  const params = new URLSearchParams(searchParams);
                                  params.set("flightId", alt.id);
                                  navigate(`/flights/detail?${params.toString()}`, { state: { flight: alt } });
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* B2C right insights panel — visible at lg+ with narrow width; on smaller screens a floating button opens it as a Sheet */}
          {hasSearched && filtered.length > 0 && (() => {
            const insightsPanel = isHybrid ? (
              <HybridInsightsRail
                variant="flights"
                currencySymbol={CURRENCIES[displayCurrency].symbol}
                cheapestPrice={insightStats.min || 0}
                origin={searchParams.get("from") || ""}
                destination={searchParams.get("to") || ""}
                highlightTitle={(aiInsight as any)?.summary ? "Smart tip" : undefined}
                highlightBody={(aiInsight as any)?.summary || (aiInsight as any)?.tip || undefined}
              />
            ) : (
              <B2CRightInsightsPanel
                currencySymbol={CURRENCIES[displayCurrency].symbol}
                currencyCode={displayCurrency}
                cheapestPrice={insightStats.min || 0}
                origin={searchParams.get("from") || ""}
                destination={searchParams.get("to") || ""}
                departDate={searchParams.get("date")}
                insight={aiInsight}
                smartTip={(aiInsight as any)?.summary || (aiInsight as any)?.tip || undefined}
                airlineHighlight={aiInsight?.ai_pick_id ? getAirlineName(filtered.find(f => f.id === aiInsight.ai_pick_id)?.airline || "") : undefined}
                onPickDate={(d) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("date", d);
                  next.set("_t", String(Date.now()));
                  navigate(`/flights?${next.toString()}`);
                }}
              />
            );
            return (
              <>
                {/* Desktop ≥1024px: inline sidebar (narrow at lg, wider at xl/2xl) */}
                <aside className="hidden lg:block lg:w-[260px] xl:w-[300px] 2xl:w-[320px] flex-shrink-0">
                  <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-hover pr-1">
                    {insightsPanel}
                  </div>
                </aside>

                {/* <1024px: floating trigger opens Sheet from the right */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      aria-label="Open price insights"
                      className="lg:hidden fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-xl border border-primary/20 backdrop-blur-md text-xs font-semibold hover:scale-105 active:scale-95 transition-transform"
                    >
                      <Sparkles className="w-4 h-4" />
                      Insights
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 overflow-y-auto">
                    <SheetHeader className="px-4 pt-4 pb-2 border-b">
                      <SheetTitle className="text-sm font-semibold">Price Insights</SheetTitle>
                    </SheetHeader>
                    <div className="p-3">
                      {insightsPanel}
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            );
          })()}
        </div>
        )}
      </div>
      </div>

      {/* Sticky compare tray — appears when user selects 1+ flights */}
      {hasSearched && compareIds.size > 0 && (
        <CompareTray
          items={Array.from(compareIds).map(id => {
            const f = filtered.find(x => x.id === id);
            return f ? {
              id,
              airline: getAirlineName(f.airline),
              price: getDisplayPrice(f),
            } : { id, airline: "", price: 0 };
          })}
          currencySymbol={CURRENCIES[displayCurrency].symbol}
          onRemove={(id) => toggleCompare(id)}
          onClear={() => setCompareIds(new Set())}
          onCompare={() => {
            const ids = Array.from(compareIds).join(",");
            navigate(`/flights/compare?ids=${ids}`);
          }}
        />
      )}
    </Layout>

    <AlertDialog open={complexBookingOpen} onOpenChange={setComplexBookingOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complex Booking Scenario</AlertDialogTitle>
          <AlertDialogDescription>
            Your booking scenario is complex. Please contact our customer support for help.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <FareVerificationDialog
      state={fareVerification}
      onClose={() => setFareVerification(null)}
    />
    </>
  );
};

const TravelerCounter = ({ label, subtitle, value, onChange, min, max, disabled }: { label: string; subtitle?: string; value: number; onChange: (v: number) => void; min: number; max?: number; disabled?: boolean }) => (
  <div className={cn("flex items-center justify-between", disabled && "opacity-40 pointer-events-none")}>
    <div>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {subtitle && <span className="text-[11px] text-muted-foreground block">{subtitle}</span>}
    </div>
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cn(
          "w-7 h-7 rounded-full border flex items-center justify-center transition-all",
          value <= min || disabled ? "border-muted text-muted cursor-not-allowed" : "border-primary/40 text-primary hover:bg-primary/10"
        )}
        disabled={value <= min || disabled}
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className="text-sm font-bold w-4 text-center">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className={cn("w-7 h-7 rounded-full border flex items-center justify-center transition-all", (disabled || (max !== undefined && value >= max)) ? "border-muted text-muted cursor-not-allowed" : "border-primary/40 text-primary hover:bg-primary/10")}
        disabled={disabled || (max !== undefined && value >= max)}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  </div>
);

export default Flights;
