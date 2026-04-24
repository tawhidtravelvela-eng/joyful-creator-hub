import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Plane, Hotel, Globe, Search, CalendarDays, Users,
  ArrowLeftRight, Minus, Plus, ChevronDown, PlusCircle, X, Sparkles, Flag, Loader2, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";
import { AIRLINE_NAMES } from "@/data/airlines";
import AirportPicker, { type Airport } from "@/components/home/AirportPicker";
import HotelLocationPicker, { type HotelLocation } from "@/components/home/HotelLocationPicker";
import TourLocationPicker from "@/components/home/TourLocationPicker";
import { COUNTRIES, detectCountry } from "@/utils/geolocation";
import B2BFlightResultsView from "@/components/b2b/flights/B2BFlightResultsView";
import type { B2BFareRow, B2BSearchContext } from "@/components/b2b/flights/types";
import { flightToFareRow, type UnifiedFlight } from "@/components/b2b/flights/flightToFareRow";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useB2B } from "@/contexts/B2BContext";
import { toast } from "@/hooks/use-toast";
import { hydrateFlightsFromWire } from "@/lib/flightWireAdapter";

type SearchTab = "flights" | "hotels" | "tours";
type TripType = "one-way" | "round-trip" | "multi-city";

interface MultiCityLeg {
  from: Airport | null;
  to: Airport | null;
  date?: Date;
}

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const CounterRow = ({ label, subtitle, value, onChange, min = 0, max = 9, disabled = false }: {
  label: string; subtitle: string; value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean;
}) => (
  <div className={cn("flex items-center justify-between", disabled && "opacity-40 pointer-events-none")}>
    <div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors" disabled={value <= min}>
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-6 text-center text-sm font-bold">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors" disabled={value >= max}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  </div>
);

const B2BSearchSection = () => {
  
  const [activeTab, setActiveTab] = useState<SearchTab>("flights");

  // Flight state
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [fromAirport, setFromAirport] = useState<Airport | null>(null);
  const [toAirport, setToAirport] = useState<Airport | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [flightClass, setFlightClass] = useState("Economy");
  const [departDate, setDepartDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [departPopoverOpen, setDepartPopoverOpen] = useState(false);
  const [returnPopoverOpen, setReturnPopoverOpen] = useState(false);
  const [flightDatesOpen, setFlightDatesOpen] = useState(false);
  const [flightDateStep, setFlightDateStep] = useState<"depart" | "return">("depart");
  const [draftDepart, setDraftDepart] = useState<Date>();
  const [draftReturn, setDraftReturn] = useState<Date>();
  const [studentFare, setStudentFare] = useState(false);
  const [directFlight, setDirectFlight] = useState(false);
  const [preferredAirlines, setPreferredAirlines] = useState<string[]>([]);
  const [airlinesPopoverOpen, setAirlinesPopoverOpen] = useState(false);
  const [multiCityDateOpen, setMultiCityDateOpen] = useState<number | null>(null);
  const [multiCityLegs, setMultiCityLegs] = useState<MultiCityLeg[]>([
    { from: null, to: null },
    { from: null, to: null },
  ]);

  // Hotel state
  const [hotelLocation, setHotelLocation] = useState<HotelLocation | null>(null);
  const [hotelCheckin, setHotelCheckin] = useState<Date>();
  const [hotelCheckout, setHotelCheckout] = useState<Date>();
  const [hotelDatesOpen, setHotelDatesOpen] = useState(false);
  const [hotelDateStep, setHotelDateStep] = useState<"checkin" | "checkout">("checkin");
  const [draftCheckin, setDraftCheckin] = useState<Date>();
  const [draftCheckout, setDraftCheckout] = useState<Date>();
  const [hotelAdults, setHotelAdults] = useState(2);
  const [hotelChildren, setHotelChildren] = useState(0);
  const [hotelRooms, setHotelRooms] = useState(1);
  const [hotelGuestsOpen, setHotelGuestsOpen] = useState(false);
  const [hotelNationality, setHotelNationality] = useState("BD");

  useEffect(() => {
    detectCountry().then(country => {
      if (country) setHotelNationality(country.code);
    });
  }, []);

  // Tour state
  const [tourDestination, setTourDestination] = useState("");
  const [tourKeyword, setTourKeyword] = useState("");

  // Inline result state
  const [isSearching, setIsSearching] = useState(false);
  const [resultsCtx, setResultsCtx] = useState<B2BSearchContext | null>(null);
  const [resultsRows, setResultsRows] = useState<B2BFareRow[]>([]);
  const { tenant } = useTenant();
  const { profile } = useB2B();
  const billingCurrency = profile?.billing_currency || "USD";
  const maxAdultPlusChild = 9;
  const handleSetAdults = (v: number) => { if (v + children > maxAdultPlusChild) return; setAdults(v); if (infants > v) setInfants(v); };
  const handleSetChildren = (v: number) => { if (adults + v > maxAdultPlusChild) return; setChildren(v); };
  const handleSetInfants = (v: number) => { if (v > adults) return; setInfants(v); };


  useEffect(() => {
    if (studentFare) { setChildren(0); setInfants(0); }
  }, [studentFare]);

  const updateMultiCityLeg = (index: number, field: keyof MultiCityLeg, value: any) => {
    setMultiCityLegs(prev => {
      const updated = prev.map((leg, i) => i === index ? { ...leg, [field]: value } : leg);
      if (field === 'to' && value && index < updated.length - 1) {
        updated[index + 1] = { ...updated[index + 1], from: value };
      }
      return updated;
    });
  };

  const handleSearch = async () => {
    if (activeTab === "flights") {
      // Build inline B2B context from form state and show results inline
      const cabinLabel = flightClass;
      const isMulti = tripType === "multi-city";
      const firstLeg = isMulti ? multiCityLegs[0] : null;
      const lastLeg = isMulti ? multiCityLegs[multiCityLegs.length - 1] : null;

      const fromCode = isMulti ? (firstLeg?.from?.code || "") : (fromAirport?.code || "");
      const toCode = isMulti ? (lastLeg?.to?.code || "") : (toAirport?.code || "");
      const departIso = isMulti
        ? (firstLeg?.date ? formatLocalDate(firstLeg.date) : formatLocalDate(new Date()))
        : (departDate ? formatLocalDate(departDate) : formatLocalDate(new Date()));
      const returnIso = tripType === "round-trip" && returnDate ? formatLocalDate(returnDate) : undefined;

      if (!fromCode || !toCode) {
        toast({ title: "Missing route", description: "Please select origin and destination airports.", variant: "destructive" });
        return;
      }

      const ctx: B2BSearchContext = {
        origin: fromCode,
        originCity: isMulti ? (firstLeg?.from?.city || "") : (fromAirport?.city || ""),
        destination: toCode,
        destinationCity: isMulti ? (lastLeg?.to?.city || "") : (toAirport?.city || ""),
        departDate: departIso,
        returnDate: returnIso,
        adults,
        children: studentFare ? 0 : children,
        infants: studentFare ? 0 : infants,
        cabin: cabinLabel,
        tripType: tripType === "one-way" ? "OW" : tripType === "round-trip" ? "RT" : "MC",
        fareType: "All",
        account: "",
      };

      setIsSearching(true);
      setResultsCtx(null);
      setResultsRows([]);

      try {
        const searchBody: any = {
          mode: "search",
          from: fromCode,
          to: toCode,
          departDate: departIso,
          returnDate: returnIso ?? null,
          adults,
          children: studentFare ? 0 : children,
          infants: studentFare ? 0 : infants,
          cabinClass: cabinLabel || "Economy",
          directFlight,
          studentFare,
          currency: billingCurrency,
          preferredAirlines: preferredAirlines.length ? preferredAirlines : undefined,
        };
        if (isMulti) {
          searchBody.legs = multiCityLegs
            .filter(l => l.from && l.to)
            .map(l => ({ from: l.from!.code, to: l.to!.code, date: l.date ? formatLocalDate(l.date) : "" }));
        }
        if (tenant?.id) searchBody.tenant_id = tenant.id;

        const { data, error } = await supabase.functions.invoke("unified-flight-search", { body: searchBody });

        if (error) throw error;
        const flights: UnifiedFlight[] = (data?.success && Array.isArray(data?.flights))
          ? (hydrateFlightsFromWire(data.flights) as UnifiedFlight[])
          : [];
        setResultsRows(flights.map(flightToFareRow));
        setResultsCtx(ctx);
        if (flights.length === 0) {
          toast({ title: "No flights found", description: "Try different dates or routes." });
        }

        // Fire-and-forget: backfill ±30-day price grid so RightInsightsPanel
        // (price trend + cheaper dates) has real data on this/future searches.
        if (flights.length > 0 && !isMulti) {
          supabase.functions.invoke("flight-price-grid", {
            body: {
              from: fromCode,
              to: toCode,
              departDate: departIso,
              cabinClass: cabinLabel || "Economy",
              currency: billingCurrency,
              // 12-month bootstrap on every search (Sky Scrapper returns ~12mo
              // in a single call). Persisted into flight_price_cache for the
              // calendar popover + price-trend graph.
              windowDays: 200,
            },
          }).catch(() => { /* silent */ });
        }
      } catch (e: any) {
        console.error("[B2BSearch] flight search error:", e);
        toast({ title: "Search failed", description: e?.message || "Could not fetch flights.", variant: "destructive" });
        setResultsCtx(ctx);
        setResultsRows([]);
      } finally {
        setIsSearching(false);
      }
      return;
    }
    if (activeTab === "hotels") {
      const params = new URLSearchParams();
      if (hotelLocation) {
        params.set("city", hotelLocation.city_name);
        params.set("locationId", String(hotelLocation.location_id));
      }
      if (hotelCheckin) params.set("checkin", formatLocalDate(hotelCheckin));
      if (hotelCheckout) params.set("checkout", formatLocalDate(hotelCheckout));
      params.set("adults", String(hotelAdults));
      if (hotelChildren > 0) params.set("children", String(hotelChildren));
      params.set("rooms", String(hotelRooms));
      if (hotelNationality) params.set("nationality", hotelNationality);
      params.set("b2b", "1");
      window.open(`/hotels?${params.toString()}`, "_blank");
    } else if (activeTab === "tours") {
      const params = new URLSearchParams();
      if (tourDestination) params.set("q", tourDestination);
      if (tourKeyword.trim()) params.set("keyword", tourKeyword.trim());
      params.set("b2b", "1");
      window.open(`/tours?${params.toString()}`, "_blank");
    }
  };

  const travelerLabel = `${adults} Adult${adults > 1 ? "s" : ""} · ${children} Child · ${infants} Infant`;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">Search & Book</h2>
          <p className="text-sm text-muted-foreground">Search flights, hotels, and tours for your clients</p>
        </div>
        {(isSearching || resultsCtx) && activeTab === "flights" && (
          <Button variant="outline" size="sm" onClick={() => { setResultsCtx(null); setResultsRows([]); setIsSearching(false); }} className="h-9 gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> New Search
          </Button>
        )}
      </div>

      {/* Inline flight loader */}
      <AnimatePresence>
        {isSearching && (
          <motion.div key="b2b-flight-loader" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-card rounded-2xl border border-border/50 shadow-sm p-12 flex flex-col items-center justify-center gap-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <Loader2 className="w-20 h-20 absolute text-primary/30 animate-spin" />
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary -rotate-12" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-foreground">Searching flights…</p>
              <p className="text-xs text-muted-foreground mt-0.5">Fetching live B2B fares from connected sources</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline flight results */}
      {!isSearching && resultsCtx && (
        <motion.div key="b2b-flight-results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <B2BFlightResultsView ctx={resultsCtx} rows={resultsRows} onModify={() => { setResultsCtx(null); setResultsRows([]); setIsSearching(false); }} />
        </motion.div>
      )}

      {(isSearching || resultsCtx) ? null : (<>


      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([
          { id: "flights" as const, label: "Flights", icon: Plane },
          { id: "hotels" as const, label: "Hotels", icon: Hotel },
          { id: "tours" as const, label: "Tours", icon: Globe },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Form Card */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 sm:p-7">
        {/* === FLIGHTS === */}
        {activeTab === "flights" && (
          <div>
            {/* Trip type */}
            <div className="flex items-center gap-5 mb-5 flex-wrap">
              {(["one-way", "round-trip", "multi-city"] as TripType[]).map((type) => (
                <button key={type} onClick={() => setTripType(type)} className="flex items-center gap-2 group bg-transparent border-none p-0">
                  <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all", tripType === type ? "border-primary" : "border-muted-foreground/25 group-hover:border-muted-foreground/50")}>
                    {tripType === type && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className={cn("text-sm font-medium transition-colors", tripType === type ? "text-foreground" : "text-muted-foreground")}>{type === "one-way" ? "One way" : type === "round-trip" ? "Round-trip" : "Multi-city"}</span>
                </button>
              ))}
            </div>

            {/* From / To (non-multi) */}
            {tripType !== "multi-city" && (
              <div className="relative flex flex-col sm:flex-row gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Flying from</label>
                  <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-3 hover:border-primary/40 transition-all">
                    <AirportPicker label="" placeholder="Where from?" selected={fromAirport} onSelect={setFromAirport} excludeCode={toAirport?.code} />
                  </div>
                </div>
                <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10" style={{ marginTop: '12px' }}>
                  <button onClick={() => { const t = fromAirport; setFromAirport(toAirport); setToAirport(t); }} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 hover:scale-110 transition-all border-[3px] border-card">
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Flying to</label>
                  <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-3 hover:border-primary/40 transition-all">
                    <AirportPicker label="" placeholder="Where to?" selected={toAirport} onSelect={setToAirport} excludeCode={fromAirport?.code} />
                  </div>
                </div>
              </div>
            )}

            {/* Multi-city legs */}
            {tripType === "multi-city" && (
              <div className="space-y-2 mb-3">
                {multiCityLegs.map((leg, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Flight {idx + 1}</span>
                      {multiCityLegs.length > 2 && <button onClick={() => setMultiCityLegs(prev => prev.filter((_, i) => i !== idx))} className="ml-auto text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all">
                        <AirportPicker label="" placeholder="From?" selected={leg.from} onSelect={(a) => updateMultiCityLeg(idx, 'from', a)} excludeCode={leg.to?.code} />
                      </div>
                      <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all">
                        <AirportPicker label="" placeholder="To?" selected={leg.to} onSelect={(a) => updateMultiCityLeg(idx, 'to', a)} excludeCode={leg.from?.code} />
                      </div>
                      <Popover open={multiCityDateOpen === idx} onOpenChange={(open) => setMultiCityDateOpen(open ? idx : null)}>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                            <CalendarDays className="w-4 h-4 text-primary" />
                            <span className={cn("text-sm font-semibold", leg.date ? "text-foreground" : "text-muted-foreground")}>{leg.date ? format(leg.date, "dd/MM/yyyy") : "Date"}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={leg.date} onSelect={(d) => { updateMultiCityLeg(idx, 'date', d); setMultiCityDateOpen(null); }} disabled={(date) => { const today = new Date(); today.setHours(0,0,0,0); if (date < today) return true; if (idx > 0 && multiCityLegs[idx-1]?.date) { const prevDate = new Date(multiCityLegs[idx-1].date!); prevDate.setHours(0,0,0,0); if (date < prevDate) return true; } return false; }} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                ))}
                {multiCityLegs.length < 5 && (
                  <button onClick={() => setMultiCityLegs(prev => [...prev, { from: null, to: null }])} className="flex items-center gap-1.5 text-primary text-xs font-bold hover:text-primary/80 transition-colors mt-1">
                    <PlusCircle className="w-3.5 h-3.5" /> Add another city
                  </button>
                )}
              </div>
            )}

            {/* Date / Traveler / Class */}
            {tripType !== "multi-city" && (
              <div className={cn("grid grid-cols-1 gap-3", "sm:grid-cols-3")}>
                {tripType === "round-trip" ? (
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Departure Date — Return Date</label>
                    <Popover open={flightDatesOpen} onOpenChange={(open) => {
                      setFlightDatesOpen(open);
                      if (open) {
                        setDraftDepart(undefined);
                        setDraftReturn(undefined);
                        setFlightDateStep("depart");
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left h-[42px] sm:h-[44px]">
                          <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className={cn("text-sm font-semibold truncate", departDate ? "text-foreground" : "text-muted-foreground")}>
                              {departDate ? format(departDate, "dd MMM") : "Depart"}
                            </span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className={cn("text-sm font-semibold truncate", returnDate ? "text-foreground" : "text-muted-foreground")}>
                              {returnDate ? format(returnDate, "dd MMM") : "Return"}
                            </span>
                            {departDate && returnDate && (
                              <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 ml-auto flex-shrink-0">
                                {Math.round((returnDate.getTime() - departDate.getTime()) / 86400000)}D
                              </span>
                            )}
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3 pb-1.5 border-b border-border/60">
                          <div className="flex gap-2">
                            <button onClick={() => setFlightDateStep("depart")} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", flightDateStep === "depart" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>
                              {draftDepart ? format(draftDepart, "dd MMM yyyy") : "Departure"}
                            </button>
                            <button onClick={() => { if (draftDepart) setFlightDateStep("return"); }} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", flightDateStep === "return" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>
                              {draftReturn ? format(draftReturn, "dd MMM yyyy") : "Return"}
                            </button>
                          </div>
                        </div>
                        <Calendar mode="single" selected={flightDateStep === "depart" ? draftDepart : draftReturn} onSelect={(d) => {
                          if (!d) return;
                          if (flightDateStep === "depart") {
                            setDraftDepart(d);
                            if (draftReturn && draftReturn <= d) { setDraftReturn(undefined); }
                            setFlightDateStep("return");
                          } else {
                            setDepartDate(draftDepart!);
                            setReturnDate(d);
                            setFlightDatesOpen(false);
                          }
                        }} disabled={(date) => flightDateStep === "depart" ? date < new Date() : date < (draftDepart || new Date())} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Departing</label>
                    <Popover open={departPopoverOpen} onOpenChange={setDepartPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                          <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className={cn("text-sm font-semibold", departDate ? "text-foreground" : "text-muted-foreground")}>{departDate ? format(departDate, "dd MMM yyyy") : "Select date"}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={departDate} onSelect={(d) => { setDepartDate(d); setDepartPopoverOpen(false); }} disabled={(date) => date < new Date()} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Passengers</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                        <Users className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">{travelerLabel}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4" align="start">
                      <div className="space-y-4">
                        <CounterRow label="Adults" subtitle="Age 12+" value={adults} onChange={handleSetAdults} min={1} max={maxAdultPlusChild - children} />
                        <CounterRow label="Children" subtitle="Age 2–11" value={children} onChange={handleSetChildren} min={0} max={maxAdultPlusChild - adults} disabled={studentFare} />
                        <CounterRow label="Infants" subtitle="Under 2" value={infants} onChange={handleSetInfants} min={0} max={adults} disabled={studentFare} />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Class</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                        <Plane className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">{flightClass}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1.5" align="end">
                      {["Economy", "Premium Economy", "Business", "First Class"].map((cls) => (
                        <button key={cls} onClick={() => setFlightClass(cls)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", flightClass === cls ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground")}>{cls}</button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Multi-city traveler/class */}
            {tripType === "multi-city" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Passengers</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                        <Users className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">{travelerLabel}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4" align="start">
                      <div className="space-y-4">
                        <CounterRow label="Adults" subtitle="Age 12+" value={adults} onChange={handleSetAdults} min={1} max={maxAdultPlusChild - children} />
                        <CounterRow label="Children" subtitle="Age 2–11" value={children} onChange={handleSetChildren} min={0} max={maxAdultPlusChild - adults} disabled={studentFare} />
                        <CounterRow label="Infants" subtitle="Under 2" value={infants} onChange={handleSetInfants} min={0} max={adults} disabled={studentFare} />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Class</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                        <Plane className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-sm font-semibold text-foreground truncate">{flightClass}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-44 p-1.5" align="end">
                      {["Economy", "Premium Economy", "Business", "First Class"].map((cls) => (
                        <button key={cls} onClick={() => setFlightClass(cls)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", flightClass === cls ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground")}>{cls}</button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Fare options + Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-muted/40 rounded-xl border border-border/60 p-1">
                  {[{ label: "Regular", active: !studentFare, onClick: () => setStudentFare(false) }, { label: "Student", active: studentFare, onClick: () => setStudentFare(true) }].map((opt) => (
                    <button key={opt.label} onClick={opt.onClick} className={cn("px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all", opt.active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground")}>{opt.label}</button>
                  ))}
                </div>
                <button onClick={() => setDirectFlight(!directFlight)} className="flex items-center gap-2 group">
                  <div className={cn("w-9 h-5 rounded-full transition-all relative", directFlight ? "bg-primary shadow-sm shadow-primary/30" : "bg-muted-foreground/20")}>
                    <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-card shadow-sm transition-all", directFlight ? "left-[18px]" : "left-0.5")} />
                  </div>
                  <span className={cn("text-xs font-bold transition-colors", directFlight ? "text-primary" : "text-muted-foreground")}>Direct Only</span>
                </button>

                {/* Preferred airlines multi-select */}
                <Popover open={airlinesPopoverOpen} onOpenChange={setAirlinesPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all",
                        preferredAirlines.length > 0
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground"
                      )}
                    >
                      <Plane className="w-3.5 h-3.5" />
                      {preferredAirlines.length > 0
                        ? `${preferredAirlines.length} Preferred Airline${preferredAirlines.length > 1 ? "s" : ""}`
                        : "Preferred Airlines"}
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search airlines…" className="h-9" />
                      <CommandList className="max-h-72">
                        <CommandEmpty>No airline found.</CommandEmpty>
                        <CommandGroup>
                          {Object.entries(AIRLINE_NAMES)
                            .sort(([, a], [, b]) => a.localeCompare(b))
                            .map(([code, name]) => {
                              const selected = preferredAirlines.includes(code);
                              return (
                                <CommandItem
                                  key={code}
                                  value={`${name} ${code}`}
                                  onSelect={() =>
                                    setPreferredAirlines((prev) =>
                                      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
                                    )
                                  }
                                  className="cursor-pointer"
                                >
                                  <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selected ? "bg-primary text-primary-foreground" : "opacity-50")}>
                                    {selected && <Check className="h-3 w-3" />}
                                  </div>
                                  <span className="font-mono text-[11px] text-muted-foreground w-9">{code}</span>
                                  <span className="text-sm">{name}</span>
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      </CommandList>
                      {preferredAirlines.length > 0 && (
                        <div className="border-t p-2 flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">{preferredAirlines.length} selected</span>
                          <button onClick={() => setPreferredAirlines([])} className="text-[11px] font-bold text-primary hover:underline">Clear all</button>
                        </div>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleSearch} className="h-12 px-10 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-lg shadow-accent/20 w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2" /> Search Flights
              </Button>
            </div>
          </div>
        )}

        {/* === HOTELS === */}
        {activeTab === "hotels" && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Destination</label>
                <HotelLocationPicker selected={hotelLocation} onSelect={setHotelLocation} placeholder="Where are you going?" />
              </div>
              {/* Check-in / Check-out Combined */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Check-in Date — Check-out Date</label>
                <Popover open={hotelDatesOpen} onOpenChange={(open) => {
                  setHotelDatesOpen(open);
                  if (open) {
                    setDraftCheckin(undefined);
                    setDraftCheckout(undefined);
                    setHotelDateStep("checkin");
                  }
                }}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left h-[42px] sm:h-[44px]">
                      <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={cn("text-sm font-semibold truncate", hotelCheckin ? "text-foreground" : "text-muted-foreground")}>
                          {hotelCheckin ? format(hotelCheckin, "dd MMM") : "Check-in"}
                        </span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className={cn("text-sm font-semibold truncate", hotelCheckout ? "text-foreground" : "text-muted-foreground")}>
                          {hotelCheckout ? format(hotelCheckout, "dd MMM") : "Check-out"}
                        </span>
                        {hotelCheckin && hotelCheckout && (
                          <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 ml-auto flex-shrink-0">
                            {Math.round((hotelCheckout.getTime() - hotelCheckin.getTime()) / 86400000)}N
                          </span>
                        )}
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3 pb-1.5 border-b border-border/60">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setHotelDateStep("checkin")}
                          className={cn(
                            "flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                            hotelDateStep === "checkin"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted/60"
                          )}
                        >
                          {draftCheckin ? format(draftCheckin, "dd MMM yyyy") : "Check-in"}
                        </button>
                        <button
                          onClick={() => { if (draftCheckin) setHotelDateStep("checkout"); }}
                          className={cn(
                            "flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all",
                            hotelDateStep === "checkout"
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-muted/60"
                          )}
                        >
                          {draftCheckout ? format(draftCheckout, "dd MMM yyyy") : "Check-out"}
                        </button>
                      </div>
                    </div>
                    <Calendar
                      mode="single"
                      selected={hotelDateStep === "checkin" ? draftCheckin : draftCheckout}
                      onSelect={(d) => {
                        if (!d) return;
                        if (hotelDateStep === "checkin") {
                          setDraftCheckin(d);
                          if (draftCheckout && draftCheckout <= d) { setDraftCheckout(undefined); }
                          setHotelDateStep("checkout");
                        } else {
                          setHotelCheckin(draftCheckin!);
                          setHotelCheckout(d);
                          setHotelDatesOpen(false);
                        }
                      }}
                      disabled={(date) =>
                        hotelDateStep === "checkin"
                          ? date < new Date()
                          : date <= (draftCheckin || new Date())
                      }
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Guests & Rooms</label>
                <Popover open={hotelGuestsOpen} onOpenChange={setHotelGuestsOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 transition-all w-full text-left">
                      <Users className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-semibold text-foreground truncate">{hotelAdults + hotelChildren} Guests · {hotelRooms} Room</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4" align="start">
                    <div className="space-y-4">
                      <CounterRow label="Adults" subtitle="Age 12+" value={hotelAdults} onChange={setHotelAdults} min={1} max={9} />
                      <CounterRow label="Children" subtitle="Age 2–11" value={hotelChildren} onChange={setHotelChildren} min={0} max={6} />
                      <CounterRow label="Rooms" subtitle="" value={hotelRooms} onChange={setHotelRooms} min={1} max={9} />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {/* Nationality */}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Nationality</label>
                <div className="relative">
                  <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  <select
                    value={hotelNationality}
                    onChange={(e) => setHotelNationality(e.target.value)}
                    className="w-full bg-muted/40 rounded-xl border border-border/70 pl-10 pr-3 py-2.5 hover:border-primary/40 transition-all text-sm font-semibold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSearch} className="h-12 px-10 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-lg shadow-accent/20 w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2" /> Search Hotels
              </Button>
            </div>
          </div>
        )}

        {/* === TOURS === */}
        {activeTab === "tours" && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end mb-5">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Destination, Attraction or Experience</label>
                <TourLocationPicker value={tourDestination} onSelect={setTourDestination} />
              </div>
              <Button onClick={handleSearch} className="h-[44px] px-10 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-lg shadow-accent/20 w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2" /> Search Tours
              </Button>
            </div>
          </div>
        )}
      </div>
      </>)}
    </motion.div>
  );
};

export default B2BSearchSection;
