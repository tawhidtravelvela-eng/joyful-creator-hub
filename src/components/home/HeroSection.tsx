import { useState, useRef, useEffect } from "react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useCurrency, CURRENCIES } from "@/contexts/CurrencyContext";
import { usePlatformModules } from "@/hooks/usePlatformModules";

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { Plane, Hotel, Search, CalendarDays, Users, MapPin, ArrowLeftRight, Minus, Plus, Globe, ChevronDown, PlusCircle, X, Check, Sparkles, Send, Flag, Camera, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion } from "framer-motion";
import AirportPicker, { type Airport } from "./AirportPicker";
import HotelLocationPicker, { type HotelLocation } from "./HotelLocationPicker";
import TourLocationPicker from "./TourLocationPicker";
import { COUNTRIES, detectCountry } from "@/utils/geolocation";

type SearchTab = "flights" | "hotels" | "tours" | "transfers" | "ai-planner";
type TripType = "one-way" | "round-trip" | "multi-city";

interface MultiCityLeg {
  from: Airport | null;
  to: Airport | null;
  date?: Date;
}

const tabs = [
  { id: "flights" as const, label: "Flights", icon: Plane },
  { id: "hotels" as const, label: "Hotels", icon: Hotel },
  { id: "tours" as const, label: "Tours", icon: Globe },
  // { id: "transfers" as const, label: "Transfers", icon: Car }, // Hidden until Amadeus credentials are configured
  { id: "ai-planner" as const, label: "AI Planner", icon: Sparkles },
];

const defaultRotatingWords = ["Perfect Flight", "Affordable Hotel", "Luxury Tour"];

const RotatingText = ({ words }: { words: string[] }) => {
  const rotatingWords = words.length ? words : defaultRotatingWords;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % rotatingWords.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Calculate max width by rendering all words invisibly
  const maxWord = rotatingWords.reduce((a, b) => (a.length > b.length ? a : b), "");

  return (
    <span className="inline-grid">
      {/* Invisible sizer to reserve max width */}
      <span className="invisible col-start-1 row-start-1">{maxWord}</span>
      <span
        className={`col-start-1 row-start-1 text-accent transition-all duration-400 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {rotatingWords[index]}
      </span>
    </span>
  );
};

import {
  smartHints, smartRound, geoDestinations, geoQuickPicks, geoPriceTeasers,
  cardPositions, cityEmojiMap, iataToCity, tagByIndex, currToUsd, geoOrigins,
  type GeoDestCard,
} from "./heroGeoData";




const FloatingDestinationCards = () => {
  const [cards, setCards] = useState(geoDestinations.DEFAULT);
  const navigate = useNavigate();
  const { currency, convertPrice, formatDirectPrice } = useCurrency();

  useEffect(() => {
    let cancelled = false;

    const loadCards = async () => {
      const country = await detectCountry();
      const geoCode = country?.code || "DEFAULT";
      const staticCards = geoDestinations[geoCode] || geoDestinations.DEFAULT;

      if (!cancelled) setCards(staticCards);

      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: routes } = await supabase
          .from("popular_routes")
          .select("from_code, from_city, to_code, to_city, lowest_price, currency, search_count")
          .order("search_count", { ascending: false })
          .limit(20);

        if (cancelled || !routes?.length) return;

        const origins = geoOrigins[geoCode] || [];
        const relevant = origins.length
          ? routes.filter(r => origins.includes(r.from_code))
          : routes;

        // Filter out same-city or domestic short-hop routes, prefer international/interesting destinations
        const filtered = (relevant.length >= 4 ? relevant : routes)
          .filter(r => r.from_code !== r.to_code && r.lowest_price && r.lowest_price > 0);

        const topRoutes = filtered.slice(0, 4);
        if (topRoutes.length < 4) return; // Not enough data, keep static

        const dynamicCards = topRoutes.map((r, i) => {
          // Resolve city name: prefer DB city name, fallback to IATA lookup
          const rawCity = r.to_city || "";
          const cityName = (rawCity.length > 3 ? rawCity : iataToCity[r.to_code]) || r.to_code;

          // Convert DB price to USD base for smartRound
          const priceCurrency = r.currency || "USD";
          const toUsdRate = currToUsd[priceCurrency] || 1;
          const basePriceUsd = Math.round(r.lowest_price * toUsdRate);

          return {
            emoji: cityEmojiMap[cityName] || "✈️",
            city: cityName,
            basePrice: basePriceUsd > 0 ? basePriceUsd : staticCards[i]?.basePrice || 400,
            tag: tagByIndex[i] || "Popular",
            route: `/flights?from=${r.from_code}&to=${r.to_code}&adults=1&class=Economy`,
          };
        });

        if (!cancelled) setCards(dynamicCards);
      } catch {
        // Silently fall back to static data
      }
    };

    loadCards();
    return () => { cancelled = true; };
  }, []);

  const formatPrice = (base: number) => {
    return formatDirectPrice(convertPrice(base));
  };

  return (
    <>
      {cards.map((card, i) => {
        const p = cardPositions[i];
        if (!p) return null;
        return (
          <motion.div
            key={`${card.city}-${i}`}
            onClick={() => navigate(card.route)}
            className={`hidden xl:flex absolute ${p.pos} items-center gap-3 px-4 py-3 rounded-2xl border z-20 cursor-pointer group ${p.depth === "back" ? "border-white/[0.05] bg-white/[0.02] opacity-60" : "border-white/[0.08] bg-white/[0.04]"}`}
            style={{ backdropFilter: p.depth === "back" ? "blur(20px)" : "blur(12px)" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, y: p.driftY, rotate: p.driftR }}
            whileHover={{ scale: 1.06, borderColor: "rgba(255,255,255,0.25)", boxShadow: "0 12px 40px -8px rgba(0,0,0,0.4), 0 0 20px -4px rgba(255,107,44,0.15)" }}
            transition={{
              opacity: { delay: p.delay, duration: 0.6 },
              scale: { delay: p.delay, duration: 0.6 },
              y: { delay: p.delay + 0.6, duration: 8, repeat: Infinity, ease: "easeInOut" },
              rotate: { delay: p.delay + 0.6, duration: 10, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <span className="text-lg group-hover:scale-110 transition-transform duration-200">{card.emoji}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white/90 group-hover:text-white transition-colors">{card.city}</p>
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">{card.tag}</span>
              </div>
              <p className="text-[10px] text-white/50 group-hover:text-white/70 transition-colors">
                from <span className="text-accent font-bold">{formatPrice(card.basePrice)}</span>
              </p>
            </div>
            <div className="w-5 h-5 rounded-full bg-white/[0.06] group-hover:bg-accent/20 flex items-center justify-center transition-colors duration-200">
              <Plane className="w-2.5 h-2.5 text-white/40 group-hover:text-accent transition-colors duration-200" />
            </div>
          </motion.div>
        );
      })}
    </>
  );
};

const HeroSection = () => {
  const { content } = useSiteContent();
  const { currency, convertPrice, formatDirectPrice } = useCurrency();
  const { isEnabled } = usePlatformModules();
  const aiEnabled = isEnabled("ai_trip_planner");
  const visibleTabs = aiEnabled ? tabs : tabs.filter((t) => t.id !== "ai-planner");
  const sym = CURRENCIES[currency].symbol;
  const heroCfg = content.hero;
  const heroHeading = heroCfg.heading || "Find & Book Your";
  const heroSubtitle = heroCfg.subtitle || "Search 500+ airlines for the best deals";
  const heroWords: string[] = heroCfg.rotating_words?.length ? heroCfg.rotating_words : defaultRotatingWords;
  const [activeTab, setActiveTab] = useState<SearchTab>("flights");
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [fromAirport, setFromAirport] = useState<Airport | null>(null);
  const [toAirport, setToAirport] = useState<Airport | null>(null);
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
  const [multiCityLegs, setMultiCityLegs] = useState<MultiCityLeg[]>([
    { from: null, to: null },
    { from: null, to: null },
  ]);
  const [regularFare, setRegularFare] = useState(true);
  const [directFlight, setDirectFlight] = useState(false);
  const [studentFare, setStudentFare] = useState(false);
  const [complexBookingOpen, setComplexBookingOpen] = useState(false);
  const navigate = useNavigate();

   // Hotel search state
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
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");

  // Geo-aware state
  const [quickPicks, setQuickPicks] = useState(geoQuickPicks.DEFAULT);
  const [priceTeasers, setPriceTeasers] = useState(geoPriceTeasers.DEFAULT);

  // Detect nationality & geo content from IP
  useEffect(() => {
    detectCountry().then(country => {
      if (country) {
        setHotelNationality(country.code);
        if (geoQuickPicks[country.code]) setQuickPicks(geoQuickPicks[country.code]);
        if (geoPriceTeasers[country.code]) setPriceTeasers(geoPriceTeasers[country.code]);
      }
    });
  }, []);

   // Tour search state
 const [tourDestination, setTourDestination] = useState("");
  const [tourLocationType, setTourLocationType] = useState("");
  const [tourKeyword, setTourKeyword] = useState("");
  const [multiCityDateOpen, setMultiCityDateOpen] = useState<number | null>(null);

  // Transfer search state
  const [transferPickup, setTransferPickup] = useState("");
  const [transferDropoff, setTransferDropoff] = useState("");
  const [transferDate, setTransferDate] = useState<Date>();
  const [transferTime, setTransferTime] = useState("10:00");
  const [transferPassengers, setTransferPassengers] = useState(1);
  const [transferType, setTransferType] = useState("PRIVATE");
  const [transferDateOpen, setTransferDateOpen] = useState(false);

  // AI Planner state
  const [aiQuery, setAiQuery] = useState("");

  // Enforce pax limits
  const maxAdultPlusChild = 9;
  const adultChildTotal = adults + children;

  const handleSetAdults = (v: number) => {
    if (v + children > maxAdultPlusChild) return;
    setAdults(v);
    // Infants can't exceed adults
    if (infants > v) setInfants(v);
  };
  const handleSetChildren = (v: number) => {
    if (adults + v > maxAdultPlusChild) return;
    setChildren(v);
  };
  const handleSetInfants = (v: number) => {
    if (v > adults) return;
    setInfants(v);
  };

  const updateMultiCityLeg = (index: number, field: keyof MultiCityLeg, value: any) => {
    setMultiCityLegs(prev => {
      const updated = prev.map((leg, i) => i === index ? { ...leg, [field]: value } : leg);
      // Auto-fill next leg's origin when destination changes
      if (field === 'to' && value && index < updated.length - 1) {
        updated[index + 1] = { ...updated[index + 1], from: value };
      }
      return updated;
    });
  };

  const addMultiCityLeg = () => {
    if (multiCityLegs.length < 5) {
      setMultiCityLegs(prev => [...prev, { from: null, to: null }]);
    }
  };

  const removeMultiCityLeg = (index: number) => {
    if (multiCityLegs.length > 2) {
      setMultiCityLegs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSearch = () => {
    // Validate pax limits
    if (adults + children > 9 || infants > adults) {
      setComplexBookingOpen(true);
      return;
    }
    if (activeTab === "flights") {
      const params = new URLSearchParams();
      if (tripType === "multi-city") {
        // Encode legs as comma-separated "FROM-TO-DATE" strings
        const legsStr = multiCityLegs
          .filter(l => l.from && l.to)
          .map(l => `${l.from!.code}_${l.to!.code}_${l.date ? formatLocalDate(l.date) : ""}`)
          .join(",");
        params.set("legs", legsStr);
        params.set("tripType", "multi-city");
      } else {
        if (fromAirport) params.set("from", fromAirport.code);
        if (toAirport) params.set("to", toAirport.code);
        if (departDate) params.set("date", formatLocalDate(departDate));
        if (tripType === "round-trip" && returnDate) {
          params.set("returnDate", formatLocalDate(returnDate));
        }
      }
      params.set("adults", String(adults));
      if (!studentFare && children > 0) params.set("children", String(children));
      if (!studentFare && infants > 0) params.set("infants", String(infants));
      params.set("class", flightClass);
      if (directFlight) params.set("direct", "true");
      if (studentFare) params.set("studentFare", "true");
      navigate(`/flights?${params.toString()}`);
    } else if (activeTab === "hotels") {
      const params = new URLSearchParams();
      if (hotelLocation) {
        const isHotel = hotelLocation.search_type === "hotel" || hotelLocation.type === "HOTEL";
        params.set("city", isHotel && hotelLocation.actual_city_name
          ? hotelLocation.actual_city_name
          : hotelLocation.city_name);
        params.set("locationId", String(hotelLocation.location_id));
        if (isHotel) {
          if (hotelLocation.hotel_ids?.length) params.set("hotelIds", hotelLocation.hotel_ids.join(","));
          if (hotelLocation.actual_city_name) params.set("actualCity", hotelLocation.actual_city_name);
          params.set("hotelName", hotelLocation.city_name);
        }
      }
      if (hotelCheckin) params.set("checkin", formatLocalDate(hotelCheckin));
      if (hotelCheckout) params.set("checkout", formatLocalDate(hotelCheckout));
      params.set("adults", String(hotelAdults));
      if (hotelChildren > 0) params.set("children", String(hotelChildren));
      params.set("rooms", String(hotelRooms));
      if (hotelNationality) params.set("nationality", hotelNationality);
      navigate(`/hotels?${params.toString()}`);
    } else if (activeTab === "tours") {
      const params = new URLSearchParams();
      if (tourDestination) params.set("q", tourDestination);
      if (tourLocationType) params.set("locType", tourLocationType);
      if (tourKeyword.trim()) params.set("keyword", tourKeyword.trim());
      navigate(`/tours?${params.toString()}`);
    } else if (activeTab === "transfers") {
      const params = new URLSearchParams();
      if (transferPickup) params.set("pickup", transferPickup);
      if (transferDropoff) params.set("dropoff", transferDropoff);
      if (transferDate) {
        const dateStr = formatLocalDate(transferDate);
        params.set("dateTime", `${dateStr}T${transferTime}:00`);
      }
      params.set("passengers", String(transferPassengers));
      params.set("type", transferType);
      navigate(`/transfers?${params.toString()}`);
    }
  };

  const travelerLabel = `${adults} Adult - ${children} Child`;

  useEffect(() => {
    setRegularFare(!studentFare);
    if (studentFare) {
      setChildren(0);
      setInfants(0);
    }
  }, [studentFare]);

  const sectionRef = useRef<HTMLElement>(null);

  return (
    <>
    <section ref={sectionRef} className="relative min-h-[580px] sm:min-h-[680px] lg:min-h-[800px] flex items-center overflow-hidden bg-foreground pb-16">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,55%,12%)] via-[hsl(222,40%,8%)] to-[hsl(240,30%,6%)]" />
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.6), transparent)" }}
          animate={{ x: ["-10%", "10%", "-10%"], y: ["-5%", "10%", "-5%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          initial={{ top: "-10%", left: "5%" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.5), transparent)" }}
          animate={{ x: ["5%", "-10%", "5%"], y: ["5%", "-8%", "5%"] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          initial={{ bottom: "0%", right: "5%" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-[80px]"
          style={{ background: "radial-gradient(circle, hsl(190 70% 50% / 0.4), transparent)" }}
          animate={{ x: ["-5%", "8%", "-5%"], y: ["8%", "-5%", "8%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          initial={{ top: "40%", left: "50%" }}
        />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.01]" style={{ backgroundImage: "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Floating destination cards — geo-aware */}
      <FloatingDestinationCards />
      {/* Floating particles */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="hidden lg:block absolute w-1 h-1 rounded-full bg-white/20 z-10"
          style={{ top: `${15 + i * 14}%`, left: `${8 + i * 16}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: 4 + i * 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
        />
      ))}

      <div className="container mx-auto px-4 relative z-10 py-6 sm:py-16 md:py-20">
        {/* Hero text */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }} className="text-center mb-8 sm:mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-sm mb-5 sm:mb-7"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] sm:text-xs font-semibold text-white/70 tracking-wide">✨ Smart Travel, Powered by AI</span>
          </motion.div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-serif text-white mb-3 sm:mb-5 leading-[1.08] tracking-tight">
            Travel{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-accent via-accent to-accent/70 bg-clip-text text-transparent">Smarter</span>
              <motion.span
                className="absolute inset-0 bg-accent/10 blur-2xl rounded-full -z-0"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
            . Book{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">Better</span>
              <motion.span
                className="absolute inset-0 bg-primary/10 blur-2xl rounded-full -z-0"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              />
            </span>
            .
          </h1>
          <p className="text-sm sm:text-lg text-white/50 max-w-xl mx-auto font-light tracking-wide">
            Flights, Hotels, Tours & More — seamlessly powered by Vela AI
          </p>
          <p className="text-[11px] sm:text-xs text-white/30 mt-2 font-medium tracking-wider">
            Search smarter. Save more. Travel better.
          </p>
          {/* AI line + CTA */}
          {aiEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5"
          >
            <span className="text-xs sm:text-sm text-white/40 font-medium">
              🤖 Plan, compare & book instantly with <span className="text-accent/90 font-semibold">Vela AI</span>
            </span>
            <Button
              size="sm"
              onClick={() => navigate("/trip-planner")}
              className="h-8 px-5 text-[11px] font-bold rounded-full bg-accent/40 text-white border-2 border-accent/70 hover:bg-accent/50 hover:border-accent hover:scale-[1.05] shadow-[0_0_10px_rgba(255,120,60,0.25)] hover:shadow-[0_0_18px_rgba(255,120,60,0.45)] transition-all duration-300 gap-1.5"
            >
              🤖 Try Vela AI
            </Button>
          </motion.div>
          )}
          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <span className="text-warning text-[11px]">⭐</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/50">
                <span className="text-white/70">4.9/5</span> from <span className="text-accent/80">12,000+</span> verified reviews
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <span className="text-[11px]">🌍</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/50">Trusted by <span className="text-accent/80">50,000+</span> travelers</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <span className="text-[11px]">🕒</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-white/50">24/7 support</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Search box */}
        <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }} className="max-w-5xl mx-auto">
          {/* Tabs */}
          <div className="flex justify-center relative z-10 mb-[-18px] sm:mb-[-22px]">
            <div className="inline-flex rounded-xl sm:rounded-2xl p-1 sm:p-1.5 gap-0.5 sm:gap-1 shadow-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12]" style={{ boxShadow: '0 8px 32px -4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-1 sm:gap-2 px-3.5 sm:px-9 py-2 sm:py-3 text-[11px] sm:text-sm font-semibold transition-all duration-300 rounded-lg sm:rounded-xl whitespace-nowrap",
                    activeTab === tab.id
                      ? "bg-accent text-accent-foreground shadow-[0_4px_20px_-2px_hsl(var(--accent)/0.5)]"
                      : "text-white/50 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  {activeTab === tab.id && (
                    <span className="absolute inset-0 rounded-lg sm:rounded-xl bg-accent/20 blur-md -z-10" />
                  )}
                  <tab.icon className={cn("w-3 h-3 sm:w-4 sm:h-4", activeTab === tab.id && "scale-110")} />
                  {tab.id === "ai-planner" ? (
                    <><span className="sm:hidden">AI</span><span className="hidden sm:inline">{tab.label}</span></>
                  ) : tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card body */}
          <div className="bg-card/95 backdrop-blur-2xl rounded-3xl shadow-[0_40px_120px_-20px_hsl(0_0%_0%/0.5),0_16px_40px_-8px_hsl(0_0%_0%/0.25)] pt-8 px-4 pb-4 sm:pt-10 sm:px-7 sm:pb-6 md:pt-10 md:px-8 md:pb-7 border border-white/10">
            {activeTab === "flights" && (
              <div>
                {/* Trip type */}
                <div className="flex items-center gap-4 sm:gap-6 mb-3 sm:mb-4 flex-wrap">
                  {(["one-way", "round-trip", "multi-city"] as TripType[]).map((type) => (
                    <button key={type} type="button" onClick={() => setTripType(type)} className="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0">
                      <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300", tripType === type ? "border-primary" : "border-muted-foreground/25 group-hover:border-muted-foreground/50")}>
                        {tripType === type && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className={cn("text-xs sm:text-sm font-medium transition-colors", tripType === type ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                        {type === "one-way" ? "One way" : type === "round-trip" ? "Round-trip" : "Multi-city"}
                      </span>
                    </button>
                  ))}
                </div>

                {tripType !== "multi-city" && (
                <div className="relative hidden sm:flex gap-3 mb-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Flying from</label>
                    <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-3 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200">
                      <AirportPicker label="" placeholder="Where from?" selected={fromAirport} onSelect={setFromAirport} excludeCode={toAirport?.code} />
                    </div>
                  </div>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10" style={{ marginTop: '12px' }}>
                    <button onClick={() => { const t = fromAirport; setFromAirport(toAirport); setToAirport(t); }} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-110 transition-all duration-200 border-[3px] border-card">
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Flying to</label>
                    <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-3 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200">
                      <AirportPicker label="" placeholder="Where to?" selected={toAirport} onSelect={setToAirport} excludeCode={fromAirport?.code} />
                    </div>
                  </div>
                </div>
                )}

                {tripType !== "multi-city" && (
                <div className="sm:hidden mb-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Flying from & to</label>
                  <div className="relative bg-muted/40 rounded-xl border border-border/70 overflow-hidden">
                    <div className="px-3 py-2"><AirportPicker label="" placeholder="Where from?" selected={fromAirport} onSelect={setFromAirport} excludeCode={toAirport?.code} /></div>
                    <div className="relative">
                      <div className="border-t border-dashed border-border" />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                        <button onClick={() => { const t = fromAirport; setFromAirport(toAirport); setToAirport(t); }} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                          <ArrowLeftRight className="w-3 h-3 rotate-90" />
                        </button>
                      </div>
                    </div>
                    <div className="px-3 py-2"><AirportPicker label="" placeholder="Where to?" selected={toAirport} onSelect={setToAirport} excludeCode={fromAirport?.code} /></div>
                  </div>
                </div>
                )}

                {tripType === "multi-city" && (
                  <div className="space-y-2 mb-3">
                    {multiCityLegs.map((leg, idx) => (
                      <div key={idx} className="relative">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Flight {idx + 1}</span>
                          {multiCityLegs.length > 2 && (<button onClick={() => removeMultiCityLeg(idx)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors"><X className="w-3.5 h-3.5" /></button>)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200"><AirportPicker label="" placeholder="From?" selected={leg.from} onSelect={(a) => updateMultiCityLeg(idx, 'from', a)} excludeCode={leg.to?.code} /></div>
                          <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200"><AirportPicker label="" placeholder="To?" selected={leg.to} onSelect={(a) => updateMultiCityLeg(idx, 'to', a)} excludeCode={leg.from?.code} /></div>
                          <Popover open={multiCityDateOpen === idx} onOpenChange={(open) => setMultiCityDateOpen(open ? idx : null)}>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                                <span className={cn("text-xs sm:text-sm font-semibold truncate", leg.date ? "text-foreground" : "text-muted-foreground")}>{leg.date ? format(leg.date, "dd/MM/yyyy") : "Date"}</span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={leg.date} onSelect={(d) => { updateMultiCityLeg(idx, 'date', d); setMultiCityDateOpen(null); }} disabled={(date) => { const today = new Date(); today.setHours(0,0,0,0); if (date < today) return true; if (idx > 0 && multiCityLegs[idx-1]?.date) { const prevDate = new Date(multiCityLegs[idx-1].date!); prevDate.setHours(0,0,0,0); if (date < prevDate) return true; } return false; }} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    ))}
                    {multiCityLegs.length < 5 && (<button onClick={addMultiCityLeg} className="flex items-center gap-1.5 text-primary text-xs font-bold hover:text-primary/80 transition-colors mt-1"><PlusCircle className="w-3.5 h-3.5" />Add another city</button>)}
                  </div>
                )}

                {tripType !== "multi-city" && (
                <div className={cn("grid grid-cols-1 gap-2 sm:gap-3", "sm:grid-cols-3")}>
                  {tripType === "round-trip" ? (
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Departure — Return</label>
                      <Popover open={flightDatesOpen} onOpenChange={(open) => { setFlightDatesOpen(open); if (open) { setDraftDepart(undefined); setDraftReturn(undefined); setFlightDateStep("depart"); } }}>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left h-[42px] sm:h-[44px]">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className={cn("text-xs sm:text-sm font-semibold truncate", departDate ? "text-foreground" : "text-muted-foreground")}>{departDate ? format(departDate, "dd MMM") : "Depart"}</span>
                              <span className="text-muted-foreground text-xs">→</span>
                              <span className={cn("text-xs sm:text-sm font-semibold truncate", returnDate ? "text-foreground" : "text-muted-foreground")}>{returnDate ? format(returnDate, "dd MMM") : "Return"}</span>
                              {departDate && returnDate && (<span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 ml-auto flex-shrink-0">{Math.round((returnDate.getTime() - departDate.getTime()) / 86400000)}D</span>)}
                            </div>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-3 pb-1.5 border-b border-border/60">
                            <div className="flex gap-2">
                              <button onClick={() => setFlightDateStep("depart")} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", flightDateStep === "depart" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>{draftDepart ? format(draftDepart, "dd MMM yyyy") : "Departure"}</button>
                              <button onClick={() => { if (draftDepart) setFlightDateStep("return"); }} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", flightDateStep === "return" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>{draftReturn ? format(draftReturn, "dd MMM yyyy") : "Return"}</button>
                            </div>
                          </div>
                          <Calendar mode="single" selected={flightDateStep === "depart" ? draftDepart : draftReturn} onSelect={(d) => { if (!d) return; if (flightDateStep === "depart") { setDraftDepart(d); if (draftReturn && draftReturn <= d) setDraftReturn(undefined); setFlightDateStep("return"); } else { setDepartDate(draftDepart!); setReturnDate(d); setFlightDatesOpen(false); } }} disabled={(date) => flightDateStep === "depart" ? date < new Date() : date < (draftDepart || new Date())} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Departing</label>
                      <Popover open={departPopoverOpen} onOpenChange={setDepartPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                            <span className={cn("text-xs sm:text-sm font-semibold truncate", departDate ? "text-foreground" : "text-muted-foreground")}>{departDate ? format(departDate, "dd/MM/yyyy") : "Select date"}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={departDate} onSelect={(d) => { setDepartDate(d); setDepartPopoverOpen(false); }} disabled={(date) => date < new Date()} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                      </Popover>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Traveler</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                          <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap truncate">{travelerLabel}</span>
                          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4" align="start">
                        <div className="space-y-4">
                          <CounterRow label="Adults" subtitle="Age 12+" value={adults} onChange={handleSetAdults} min={1} max={maxAdultPlusChild - children} />
                          <CounterRow label="Children" subtitle="Age 2–11" value={children} onChange={handleSetChildren} min={0} max={maxAdultPlusChild - adults} disabled={studentFare} />
                          <CounterRow label="Infants" subtitle="Under 2" value={infants} onChange={handleSetInfants} min={0} max={adults} disabled={studentFare} />
                          <p className={cn("text-[10px] text-muted-foreground text-center transition-opacity", adultChildTotal >= 7 ? "opacity-100" : "opacity-0")}>Max 9 passengers (adults + children)</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Class</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0"><Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" /></div>
                          <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{flightClass}</span>
                          <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-1.5" align="end">
                        {["Economy", "Premium Economy", "Business", "First Class"].map((cls) => (<button key={cls} onClick={() => setFlightClass(cls)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", flightClass === cls ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground")}>{cls}</button>))}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                )}

                {tripType === "multi-city" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Traveler</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                            <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap truncate">{travelerLabel}</span>
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
                      <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Class</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0"><Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" /></div>
                            <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{flightClass}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-1.5" align="end">
                          {["Economy", "Premium Economy", "Business", "First Class"].map((cls) => (<button key={cls} onClick={() => setFlightClass(cls)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", flightClass === cls ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground")}>{cls}</button>))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 sm:mt-5">
                  <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                    <div className="flex items-center gap-1 bg-muted/40 rounded-xl border border-border/60 p-1">
                      {([{ label: "Regular", active: regularFare, onClick: () => { setStudentFare(false); } }, { label: "Student", active: studentFare, onClick: () => { setStudentFare(true); } }] as const).map((opt) => (
                        <button key={opt.label} type="button" onClick={opt.onClick} className={cn("relative px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-300", opt.active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground")}>{opt.label}</button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setDirectFlight(!directFlight)} className="flex items-center gap-2 group">
                      <div className={cn("w-9 h-5 rounded-full transition-all duration-300 relative", directFlight ? "bg-primary shadow-sm shadow-primary/30" : "bg-muted-foreground/20")}>
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-card shadow-sm transition-all duration-300", directFlight ? "left-[18px]" : "left-0.5")} />
                      </div>
                      <span className={cn("text-[11px] sm:text-xs font-bold transition-colors", directFlight ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>Direct Only</span>
                    </button>
                  </div>
                  <div className="flex flex-col items-center sm:items-end gap-1.5">
                    <Button onClick={handleSearch} className="h-12 sm:h-13 px-8 sm:px-12 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-md shadow-accent/10 hover:shadow-[0_4px_16px_-4px_hsl(var(--accent)/0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 w-full sm:w-auto sm:relative fixed bottom-4 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-auto z-50 sm:z-auto">
                      <Search className="w-4 h-4 mr-2" />
                      {toAirport?.city ? `Find Flights to ${toAirport.city}` : "Search Best Flights"}
                    </Button>
                    <span className="hidden sm:inline text-[10px] font-medium text-muted-foreground/70">✈️ Compare 500+ airlines instantly</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hotels" && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Destination</label>
                    <HotelLocationPicker selected={hotelLocation} onSelect={setHotelLocation} placeholder="Where are you going?" />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Check-in — Check-out</label>
                    <Popover open={hotelDatesOpen} onOpenChange={(open) => { setHotelDatesOpen(open); if (open) { setDraftCheckin(undefined); setDraftCheckout(undefined); setHotelDateStep("checkin"); } }}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left h-[42px] sm:h-[44px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className={cn("text-xs sm:text-sm font-semibold truncate", hotelCheckin ? "text-foreground" : "text-muted-foreground")}>{hotelCheckin ? format(hotelCheckin, "dd MMM") : "Check-in"}</span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className={cn("text-xs sm:text-sm font-semibold truncate", hotelCheckout ? "text-foreground" : "text-muted-foreground")}>{hotelCheckout ? format(hotelCheckout, "dd MMM") : "Check-out"}</span>
                            {hotelCheckin && hotelCheckout && (<span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 ml-auto flex-shrink-0">{Math.round((hotelCheckout.getTime() - hotelCheckin.getTime()) / 86400000)}N</span>)}
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3 pb-1.5 border-b border-border/60">
                          <div className="flex gap-2">
                            <button onClick={() => setHotelDateStep("checkin")} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", hotelDateStep === "checkin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>{draftCheckin ? format(draftCheckin, "dd MMM yyyy") : "Check-in"}</button>
                            <button onClick={() => { if (draftCheckin) setHotelDateStep("checkout"); }} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", hotelDateStep === "checkout" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>{draftCheckout ? format(draftCheckout, "dd MMM yyyy") : "Check-out"}</button>
                          </div>
                        </div>
                        <Calendar mode="single" selected={hotelDateStep === "checkin" ? draftCheckin : draftCheckout} onSelect={(d) => { if (!d) return; if (hotelDateStep === "checkin") { setDraftCheckin(d); if (draftCheckout && draftCheckout <= d) setDraftCheckout(undefined); setHotelDateStep("checkout"); } else { setHotelCheckin(draftCheckin!); setHotelCheckout(d); setHotelDatesOpen(false); } }} disabled={(date) => hotelDateStep === "checkin" ? date < new Date() : date <= (draftCheckin || new Date())} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Guests & Rooms</label>
                    <Popover open={hotelGuestsOpen} onOpenChange={setHotelGuestsOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left h-[42px] sm:h-[44px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                          <span className="text-xs sm:text-sm font-semibold text-foreground">{hotelAdults + hotelChildren} Guest{hotelAdults + hotelChildren > 1 ? "s" : ""}, {hotelRooms} Room{hotelRooms > 1 ? "s" : ""}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4 pointer-events-auto" align="start">
                        <div className="space-y-3">
                          <CounterRow label="Adults" subtitle="18+" value={hotelAdults} onChange={(v) => setHotelAdults(v)} min={1} max={6} />
                          <CounterRow label="Children" subtitle="0-17" value={hotelChildren} onChange={(v) => setHotelChildren(v)} min={0} max={4} />
                          <CounterRow label="Rooms" value={hotelRooms} onChange={(v) => setHotelRooms(v)} min={1} max={4} />
                          <Button size="sm" className="w-full mt-2" onClick={() => setHotelGuestsOpen(false)}>Done</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Nationality</label>
                    <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left h-[42px] sm:h-[44px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                          <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{(() => { const c = COUNTRIES.find(c => c.code === hotelNationality); return c ? `${c.code} ${c.name}` : hotelNationality; })()}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input type="text" value={nationalitySearch} onChange={(e) => setNationalitySearch(e.target.value)} placeholder="Search country..." className="w-full bg-transparent pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border rounded-lg" autoFocus />
                          </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto py-1">
                          {COUNTRIES.filter(c => !nationalitySearch || c.name.toLowerCase().includes(nationalitySearch.toLowerCase()) || c.code.toLowerCase().includes(nationalitySearch.toLowerCase())).map((c) => (
                            <button key={c.code} type="button" onClick={() => { setHotelNationality(c.code); setNationalityOpen(false); setNationalitySearch(""); }} className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left", hotelNationality === c.code && "bg-primary/5 text-primary")}>
                              <span className="text-base leading-none">{c.flag}</span>
                              <span className="flex-1 truncate">{c.code} — {c.name}</span>
                              {hotelNationality === c.code && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
                    <div className="flex -space-x-1">
                      {["🏨", "⭐", "💰"].map((e, i) => (
                        <span key={i} className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[8px]">{e}</span>
                      ))}
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground/70">1M+ hotels · Best rates</span>
                  </div>
                  <Button onClick={handleSearch} className="h-11 sm:h-12 px-6 sm:px-10 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-xl shadow-accent/20 w-full sm:w-auto sm:relative fixed bottom-4 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-auto z-50 sm:z-auto">
                    <Search className="w-4 h-4 mr-2" />
                    {hotelLocation ? `Find Hotels in ${hotelLocation.city_name}` : "Find Best Hotels"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "tours" && (
              <div>
                {/* Single search input */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end mb-4">
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Destination, Attraction or Experience
                    </label>
                    <TourLocationPicker value={tourDestination} onSelect={(name, type) => { setTourDestination(name); setTourLocationType(type || ""); }} placeholder="Paris, Taj Mahal, Bali..." variant="button" />
                  </div>
                  <Button onClick={handleSearch} className="h-[42px] sm:h-[44px] px-8 sm:px-10 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-xl shadow-accent/20 shrink-0">
                    <Search className="w-4 h-4 mr-2" />
                    Explore
                  </Button>
                </div>

                {/* Quick category chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                  {[
                    { emoji: "🏖️", label: "Beaches", kw: "beach" },
                    { emoji: "🍜", label: "Food Tours", kw: "food tour" },
                    { emoji: "🏛️", label: "Museums", kw: "museum" },
                    { emoji: "🤿", label: "Water Sports", kw: "snorkeling diving" },
                    { emoji: "🥾", label: "Hiking", kw: "hiking trekking" },
                    { emoji: "📸", label: "Sightseeing", kw: "sightseeing" },
                  ].map((chip) => (
                    <button
                      key={chip.kw}
                      onClick={() => { setTourKeyword(chip.kw); }}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] sm:text-xs font-medium transition-all duration-200",
                        tourKeyword === chip.kw
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-border/40 bg-muted/30 text-muted-foreground hover:border-accent/30 hover:text-foreground"
                      )}
                    >
                      <span>{chip.emoji}</span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>

                {/* Capability hint */}
                <div className="flex items-center justify-center">
                  <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 rounded-full bg-muted/30 border border-border/40">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary/60" />
                      <span className="text-[10px] font-medium text-muted-foreground/70">Cities</span>
                    </div>
                    <span className="text-muted-foreground/30">·</span>
                    <div className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-primary/60" />
                      <span className="text-[10px] font-medium text-muted-foreground/70">Countries</span>
                    </div>
                    <span className="text-muted-foreground/30">·</span>
                    <div className="flex items-center gap-1">
                      <Camera className="w-3 h-3 text-primary/60" />
                      <span className="text-[10px] font-medium text-muted-foreground/70">Attractions</span>
                    </div>
                    <span className="text-muted-foreground/30">·</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]">🎯</span>
                      <span className="text-[10px] font-medium text-muted-foreground/70">Experiences</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "transfers" && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Pickup (Airport Code)</label>
                    <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                        <input type="text" value={transferPickup} onChange={(e) => setTransferPickup(e.target.value.toUpperCase())} placeholder="e.g. CDG, DXB" maxLength={4} className="w-full bg-transparent text-xs sm:text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Dropoff (Airport/City)</label>
                    <div className="bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0"><MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" /></div>
                        <input type="text" value={transferDropoff} onChange={(e) => setTransferDropoff(e.target.value)} placeholder="Airport code or city name" className="w-full bg-transparent text-xs sm:text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Pickup Date & Time</label>
                    <div className="flex gap-2">
                      <Popover open={transferDateOpen} onOpenChange={setTransferDateOpen}>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 flex-1 text-left h-[42px] sm:h-[44px]">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                            <span className={cn("text-xs sm:text-sm font-semibold truncate", transferDate ? "text-foreground" : "text-muted-foreground")}>{transferDate ? format(transferDate, "dd MMM yyyy") : "Select date"}</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={transferDate} onSelect={(d) => { setTransferDate(d); setTransferDateOpen(false); }} disabled={(date) => date < new Date()} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <div className="bg-muted/40 rounded-xl border border-border/70 px-2 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 flex items-center h-[42px] sm:h-[44px]">
                        <input type="time" value={transferTime} onChange={(e) => setTransferTime(e.target.value)} className="bg-transparent text-xs sm:text-sm font-semibold text-foreground outline-none w-20" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Passengers & Type</label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 flex-1 text-left h-[42px] sm:h-[44px]">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                            <span className="text-xs sm:text-sm font-semibold text-foreground">{transferPassengers}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-4" align="start">
                          <CounterRow label="Passengers" value={transferPassengers} onChange={setTransferPassengers} min={1} max={12} />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 h-[42px] sm:h-[44px]">
                            <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{transferType === "PRIVATE" ? "Private" : transferType === "SHARED" ? "Shared" : transferType}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1.5" align="end">
                          {[{ label: "Private", value: "PRIVATE" }, { label: "Shared", value: "SHARED" }, { label: "Taxi", value: "TAXI" }].map((opt) => (
                            <button key={opt.value} onClick={() => setTransferType(opt.value)} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", transferType === opt.value ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground")}>{opt.label}</button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
                    <span className="text-[10px]">🚗</span>
                    <span className="text-[10px] font-semibold text-muted-foreground/70">Private cars · Shared shuttles · Taxis</span>
                  </div>
                  <Button onClick={handleSearch} className="h-11 sm:h-12 px-6 sm:px-10 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-xl shadow-accent/20 w-full sm:w-auto sm:relative fixed bottom-4 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-auto z-50 sm:z-auto">
                    <Search className="w-4 h-4 mr-2" />
                    Find Transfers
                  </Button>
                </div>
              </div>
            )}

            {aiEnabled && activeTab === "ai-planner" && (
              <div>
                <p className="text-muted-foreground text-xs sm:text-sm mb-4 text-center">Describe your dream trip and our AI will plan flights, hotels & activities for you.</p>
                <div className="relative mb-5">
                  <textarea value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (aiQuery.trim()) navigate("/trip-planner", { state: { initialQuery: aiQuery.trim() } }); } }} placeholder="e.g. 5-day trip to Bali for 2 people, beach & culture..." className="w-full bg-muted/40 rounded-xl border border-border/70 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 focus:bg-muted/60 transition-all duration-200 min-h-[80px]" rows={3} />
                  <button onClick={() => { if (aiQuery.trim()) navigate("/trip-planner", { state: { initialQuery: aiQuery.trim() } }); }} disabled={!aiQuery.trim()} className="absolute right-3 bottom-3 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg shadow-accent/20 hover:scale-110 transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100"><Send className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-col items-center gap-1.5 mb-4">
                  <Button onClick={() => { if (aiQuery.trim()) navigate("/trip-planner", { state: { initialQuery: aiQuery.trim() } }); }} disabled={!aiQuery.trim()} className="h-12 sm:h-14 px-8 sm:px-14 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-sm shadow-xl shadow-accent/20 w-full sm:w-auto disabled:opacity-50">
                    <Sparkles className="w-4 h-4 mr-2" />🤖 Plan My Trip
                  </Button>
                  <span className="text-[10px] text-muted-foreground/60 font-medium">AI plans your perfect itinerary in seconds</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[{ label: "🏖️ Beach getaway", query: "Beach getaway for 2" }, { label: "🌍 Weekend in Europe", query: "Weekend trip to Europe, 3 days" }, { label: "💑 Luxury honeymoon", query: "Luxury honeymoon trip, 7 days" }, { label: "🎒 Adventure in Asia", query: "Adventure trip to Southeast Asia, 5 days" }].map((s) => (
                    <button key={s.query} onClick={() => { setAiQuery(s.query); navigate("/trip-planner", { state: { initialQuery: s.query } }); }} className="px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted transition-all duration-200">{s.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Picks — smart hints */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-5"
          >
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mr-1">Quick picks</span>
            {quickPicks.map((pick) => (
              <button
                key={pick.label}
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("from", pick.from);
                  params.set("to", pick.to);
                  params.set("adults", "1");
                  params.set("class", "Economy");
                  navigate(`/flights?${params.toString()}`);
                }}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border backdrop-blur-sm hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all duration-300 text-[10px] sm:text-[11px] font-medium ${pick.type === "cheap" ? "border-accent/40 bg-accent/15 text-accent font-semibold shadow-[0_0_16px_-4px_hsl(var(--accent)/0.4)]" : "border-white/10 bg-white/[0.05] text-white/60"}`}
              >
                <span>{pick.emoji}</span>
                <span>{pick.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Price teasers */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-4"
          >
            {priceTeasers.map((deal) => (
              <button
                key={deal.text}
                onClick={() => navigate(deal.href)}
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300 backdrop-blur-sm"
              >
                <span className="text-sm">{deal.emoji}</span>
                <span className="text-[11px] sm:text-xs text-white/50 group-hover:text-white/70 font-medium transition-colors">{deal.text}</span>
                <span className="text-[11px] sm:text-xs text-accent font-bold">from {formatDirectPrice(convertPrice(deal.basePrice))}{deal.suffix || ""}</span>
              </button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>

    <AlertDialog open={complexBookingOpen} onOpenChange={setComplexBookingOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complex Booking Scenario</AlertDialogTitle>
          <AlertDialogDescription>Your booking scenario is complex. Please contact our customer support for help.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogAction>Got it</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};


const CounterRow = ({ label, subtitle, value, onChange, min, max, disabled }: { label: string; subtitle?: string; value: number; onChange: (v: number) => void; min: number; max?: number; disabled?: boolean }) => (
  <div className={cn("flex items-center justify-between", disabled && "opacity-40 pointer-events-none")}>
    <div>
      <span className="text-sm font-bold text-foreground">{label}</span>
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

export default HeroSection;
