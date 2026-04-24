import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Plane, Hotel, MapPin, Calendar, Users, DollarSign, ArrowRight, Sun, Sunset, Moon, type LucideIcon, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { detectCountry } from "@/utils/geolocation";
import { COUNTRY_AIRPORTS } from "@/data/geoDestinationMap";

/* ── Typing placeholders ── */
const TYPED_EXAMPLES = [
  "Bali honeymoon 4 days budget $2000…",
  "Family trip to Singapore, 5 days…",
  "Weekend in Cox's Bazar under $500…",
  "Backpacking Thailand 2 weeks…",
];

/* ── Preview types ── */
type PreviewDay = { day: number; title: string; icon: LucideIcon; activities: string[] };

type CityInsight = {
  destination: string;
  country: string;
  introText: string;
  bestTime: string;
  budgetRanges: {
    budget?: { min: number; max: number; currency: string; note: string };
    mid_range?: { min: number; max: number; currency: string; note: string };
    luxury?: { min: number; max: number; currency: string; note: string };
  };
  popularAreas: string[];
  flightEstimate: number | null; // USD
  hotelEstimate: number | null;  // per night USD
  loading: boolean;
};

const EMPTY_INSIGHT: CityInsight = {
  destination: "", country: "", introText: "", bestTime: "",
  budgetRanges: {}, popularAreas: [],
  flightEstimate: null, hotelEstimate: null, loading: false,
};

/* ── City name resolution ── */
const CITY_ALIASES: Record<string, { city: string; country: string }> = {
  bali: { city: "Bali", country: "Indonesia" },
  phuket: { city: "Phuket", country: "Thailand" },
  singapore: { city: "Singapore", country: "Singapore" },
  maldives: { city: "Maldives", country: "Maldives" },
  nepal: { city: "Kathmandu", country: "Nepal" },
  kathmandu: { city: "Kathmandu", country: "Nepal" },
  dubai: { city: "Dubai", country: "UAE" },
  bangkok: { city: "Bangkok", country: "Thailand" },
  "cox's bazar": { city: "Cox's Bazar", country: "Bangladesh" },
  "coxs bazar": { city: "Cox's Bazar", country: "Bangladesh" },
  tokyo: { city: "Tokyo", country: "Japan" },
  paris: { city: "Paris", country: "France" },
  london: { city: "London", country: "UK" },
  istanbul: { city: "Istanbul", country: "Turkey" },
  rome: { city: "Rome", country: "Italy" },
  barcelona: { city: "Barcelona", country: "Spain" },
  "kuala lumpur": { city: "Kuala Lumpur", country: "Malaysia" },
  seoul: { city: "Seoul", country: "South Korea" },
};

const PREVIEW_FILLER_WORDS = new Set([
  "trip", "travel", "vacation", "holiday", "getaway", "days", "day",
  "nights", "night", "budget", "under", "for", "with", "family",
  "honeymoon", "adventure", "weekend", "to", "in", "at", "a", "the",
]);

const PREVIEW_DAY_TEMPLATES: Array<{
  title: (destination: string) => string;
  icon: LucideIcon;
  activities: (destination: string) => string[];
}> = [
  {
    title: () => "Arrival & check-in",
    icon: Sun,
    activities: (dest) => [`Arrive in ${dest}`, "Private transfer & hotel check-in", "Easy first-evening walk and dinner"],
  },
  {
    title: () => "Signature highlights",
    icon: Sun,
    activities: (dest) => [`Top sights and postcard spots in ${dest}`, "Local lunch in a popular neighborhood", "Flexible free time for shopping or beach"],
  },
  {
    title: () => "Culture & experiences",
    icon: Sunset,
    activities: () => ["Half-day guided local experience", "Food, café, or market stop", "Relaxed evening plan with sunset views"],
  },
  {
    title: () => "Wrap-up & departure",
    icon: Moon,
    activities: () => ["Slow morning and final photo stops", "Last-minute shopping or spa break", "Airport transfer and departure"],
  },
];

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

const toTitleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

const inferTravelers = (value: string) => {
  const n = value.toLowerCase();
  if (/(solo|myself|alone)/.test(n)) return 1;
  if (/(family|kids|children)/.test(n)) return 4;
  if (/(friends|group)/.test(n)) return 3;
  return 2;
};

const inferDays = (value: string) => {
  const match = value.match(/(\d+)\s*(day|days|night|nights|week|weeks)/i);
  if (!match) return 4;
  const amount = Number(match[1]);
  if (/week/i.test(match[2])) return Math.min(amount * 7, 14);
  return Math.max(amount, 2);
};

const inferDestination = (value: string): { city: string; country: string } => {
  const normalized = value.toLowerCase().trim();

  // Check aliases first
  for (const [needle, resolved] of Object.entries(CITY_ALIASES)) {
    if (normalized.includes(needle)) return resolved;
  }

  // Extract from "to X" or "in X" patterns
  const matchedPlace = value.match(
    /\b(?:to|in|at)\s+([a-zA-Z][a-zA-Z\s'&-]+?)(?:,|$|\b(?:for|under|budget|with)\b)/i
  )?.[1];

  const stripped = (matchedPlace || value)
    .replace(/\$\s*[\d,]+/g, " ")
    .replace(/\d+\s*(?:day|days|night|nights|week|weeks)/gi, " ")
    .replace(/[^a-zA-Z\s'&-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !PREVIEW_FILLER_WORDS.has(word.toLowerCase()))
    .slice(0, 3)
    .join(" ");

  return { city: stripped ? toTitleCase(stripped) : "", country: "" };
};

const buildSchedule = (destination: string, days: number, popularAreas: string[]): PreviewDay[] => {
  const visibleDays = Math.min(Math.max(days, 2), PREVIEW_DAY_TEMPLATES.length);

  return Array.from({ length: visibleDays }, (_, index) => {
    const template = PREVIEW_DAY_TEMPLATES[index];
    // Enhance activities with real popular areas if available
    let activities = template.activities(destination);
    if (index === 1 && popularAreas.length > 0) {
      const area = popularAreas[0]?.split("—")[0]?.trim();
      if (area) activities = [`Explore ${area}`, ...activities.slice(1)];
    }
    return { day: index + 1, title: template.title(destination), icon: template.icon, activities };
  });
};

/* ── City insight cache (in-memory per session) ── */
const cityInsightCache = new Map<string, CityInsight>();

const CITY_TO_IATA: Record<string, string> = {
  bali: "DPS", bangkok: "BKK", singapore: "SIN", dubai: "DXB",
  "kuala lumpur": "KUL", tokyo: "NRT", paris: "CDG", london: "LHR",
  istanbul: "IST", rome: "FCO", barcelona: "BCN", seoul: "ICN",
  kathmandu: "KTM", maldives: "MLE", "cox's bazar": "CXB",
  phuket: "HKT", mumbai: "BOM", delhi: "DEL", sydney: "SYD",
  "new york": "JFK", cancun: "CUN", miami: "MIA", cairo: "CAI",
  "hong kong": "HKG", taipei: "TPE", hanoi: "HAN", "ho chi minh": "SGN",
  colombo: "CMB", dhaka: "DAC", chittagong: "CGP", langkawi: "LGK",
  penang: "PEN", jakarta: "CGK", manila: "MNL", doha: "DOH",
  riyadh: "RUH", jeddah: "JED", muscat: "MCT", amman: "AMM",
  nairobi: "NBO", "cape town": "CPT", lagos: "LOS",
};

// Cached user origin info
let _userOriginCodes: string[] | null = null;
let _userOriginCountry: string = "";

async function getUserOrigin(): Promise<{ codes: string[]; country: string }> {
  if (_userOriginCodes !== null) return { codes: _userOriginCodes, country: _userOriginCountry };
  try {
    const detected = await detectCountry();
    _userOriginCodes = COUNTRY_AIRPORTS[detected.code] || [];
    _userOriginCountry = detected.name;
  } catch {
    _userOriginCodes = [];
    _userOriginCountry = "";
  }
  return { codes: _userOriginCodes, country: _userOriginCountry };
}

async function fetchCityInsight(city: string, country: string): Promise<CityInsight> {
  const cacheKey = city.toLowerCase();
  if (cityInsightCache.has(cacheKey)) return cityInsightCache.get(cacheKey)!;

  const result: CityInsight = {
    ...EMPTY_INSIGHT,
    destination: country ? `${city}, ${country}` : city,
    country,
    loading: true,
  };

  const origin = await getUserOrigin();

  try {
    // 1. Check city_intros cache
    const { data: intro } = await supabase
      .from("city_intros")
      .select("*")
      .eq("city_name", city)
      .eq("language", "en")
      .maybeSingle();

    if (intro) {
      result.introText = intro.intro_text || "";
      result.bestTime = intro.best_time_to_visit || "";
      result.country = intro.country || country;
      result.destination = intro.country ? `${city}, ${intro.country}` : city;
      result.popularAreas = Array.isArray(intro.popular_areas) ? (intro.popular_areas as string[]) : [];
      if (intro.budget_ranges && typeof intro.budget_ranges === "object") {
        result.budgetRanges = intro.budget_ranges as CityInsight["budgetRanges"];
        // Extract price estimates stored inside budget_ranges (AI fallback)
        const br = intro.budget_ranges as Record<string, unknown>;
        if (br.avg_flight_price_usd) result.flightEstimate = Math.round(Number(br.avg_flight_price_usd));
        if (br.avg_hotel_per_night_usd) result.hotelEstimate = Math.round(Number(br.avg_hotel_per_night_usd));
      }
    }

    // 2. Check hotel_city_estimates for real hotel pricing (overrides AI)
    const { data: hotelEst } = await supabase
      .from("hotel_city_estimates")
      .select("avg_per_night_usd, min_per_night_usd")
      .eq("city", city)
      .maybeSingle();

    if (hotelEst && hotelEst.avg_per_night_usd > 0) {
      result.hotelEstimate = Math.round(hotelEst.avg_per_night_usd);
    } else if (!result.hotelEstimate && result.budgetRanges?.mid_range) {
      result.hotelEstimate = Math.round((result.budgetRanges.mid_range.min + result.budgetRanges.mid_range.max) / 2);
    }

    // 3. Check flight_price_cache — origin-aware first, then any origin
    const cityLower = city.toLowerCase();
    const destCode = CITY_TO_IATA[cityLower];
    if (destCode) {
      let foundFlight = false;

      // Try origin-specific flights first (most relevant to user)
      if (origin.codes.length > 0) {
        const { data: originFlights } = await supabase
          .from("flight_price_cache")
          .select("lowest_price, currency")
          .in("from_code", origin.codes)
          .eq("to_code", destCode)
          .gt("lowest_price", 0)
          .gte("travel_date", new Date().toISOString().split("T")[0])
          .order("lowest_price", { ascending: true })
          .limit(1);

        if (originFlights?.length && originFlights[0].lowest_price > 0) {
          result.flightEstimate = Math.round(originFlights[0].lowest_price);
          foundFlight = true;
        }
      }

      // Fallback: any origin
      if (!foundFlight) {
        const { data: flightPrices } = await supabase
          .from("flight_price_cache")
          .select("lowest_price, currency")
          .eq("to_code", destCode)
          .gt("lowest_price", 0)
          .gte("travel_date", new Date().toISOString().split("T")[0])
          .order("lowest_price", { ascending: true })
          .limit(1);

        if (flightPrices?.length) {
          result.flightEstimate = Math.round(flightPrices[0].lowest_price);
        }
      }
    }

    // 4. If no city intro cached OR missing prices, call edge function
    // Edge function checks DB prices first, then AI only for what's missing
    const needsPriceBackfill = !result.flightEstimate || !result.hotelEstimate;
    if (!intro || needsPriceBackfill) {
      try {
        const { data: aiData } = await supabase.functions.invoke("generate-city-intro", {
          body: {
            city,
            country: country || undefined,
            origin_codes: origin.codes,
            origin_country: origin.country,
          },
        });

        if (aiData?.success && aiData.intro) {
          const ai = aiData.intro;
          if (!intro) {
            // Only update intro fields if we didn't have a cached intro
            result.introText = ai.intro_text || "";
            result.bestTime = ai.best_time_to_visit || "";
            result.country = ai.country || country;
            result.destination = ai.country ? `${city}, ${ai.country}` : city;
            result.popularAreas = Array.isArray(ai.popular_areas) ? ai.popular_areas : [];
            if (ai.budget_ranges && typeof ai.budget_ranges === "object") {
              result.budgetRanges = ai.budget_ranges;
            }
          }
          // Use AI/DB-backfilled prices when we still don't have them
          if (!result.flightEstimate) {
            const aiFlightPrice = ai.budget_ranges?.avg_flight_price_usd ?? (ai as any).avg_flight_price_usd;
            if (aiFlightPrice) result.flightEstimate = Math.round(Number(aiFlightPrice));
          }
          if (!result.hotelEstimate) {
            const aiHotelPrice = ai.budget_ranges?.avg_hotel_per_night_usd ?? (ai as any).avg_hotel_per_night_usd;
            if (aiHotelPrice) result.hotelEstimate = Math.round(Number(aiHotelPrice));
          }
          // Last resort: derive from budget tiers
          if (!result.hotelEstimate && result.budgetRanges?.mid_range) {
            result.hotelEstimate = Math.round(
              (result.budgetRanges.mid_range.min + result.budgetRanges.mid_range.max) / 2
            );
          }
        }
      } catch (e) {
        console.warn("City intro fetch failed:", e);
      }
    }

    result.loading = false;
    cityInsightCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error("fetchCityInsight error:", err);
    result.loading = false;
    return result;
  }
}

/* ── Component ── */
const AiTripPlanner = () => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [typedIndex, setTypedIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [previewPhase, setPreviewPhase] = useState(0);
  const [cityInsight, setCityInsight] = useState<CityInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { formatDirectPrice, convertFromSource } = useCurrency();

  // Typewriter + phased preview
  useEffect(() => {
    if (query || isFocused) {
      setIsTyping(false);
      if (!query) setPreviewPhase(0);
      return;
    }
    setIsTyping(true);
    setPreviewPhase(0);
    setCityInsight(null);
    const target = TYPED_EXAMPLES[typedIndex];
    let charIdx = 0;
    setDisplayText("");

    const typeInterval = setInterval(() => {
      if (charIdx <= target.length) {
        setDisplayText(target.slice(0, charIdx));
        charIdx++;
      } else {
        clearInterval(typeInterval);
        // Auto-fetch insight for the typed example destination
        const { city, country } = inferDestination(target);
        if (city) {
          setPreviewPhase(1);
          setInsightLoading(true);
          fetchCityInsight(city, country).then((insight) => {
            setCityInsight(insight);
            setInsightLoading(false);
            setPreviewPhase(2);
            setTimeout(() => setPreviewPhase(3), 800);
          });
        }
        setTimeout(() => {
          setPreviewPhase(0);
          setCityInsight(null);
          setTimeout(() => setTypedIndex((prev) => (prev + 1) % TYPED_EXAMPLES.length), 600);
        }, 5500);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [typedIndex, query, isFocused]);

  // Debounced fetch when user types a destination
  useEffect(() => {
    if (!query.trim()) {
      if (!isTyping) setCityInsight(null);
      return;
    }

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      const { city, country } = inferDestination(query);
      if (city && city.length >= 3) {
        setInsightLoading(true);
        setPreviewPhase(1);
        fetchCityInsight(city, country).then((insight) => {
          setCityInsight(insight);
          setInsightLoading(false);
          setPreviewPhase(2);
          setTimeout(() => setPreviewPhase(3), 600);
        });
      }
    }, 600);

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [query, isTyping]);

  const handleSubmit = useCallback((q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    navigate(`/trip-planner`, { state: { initialQuery: searchQuery.trim() } });
  }, [query, navigate]);

  const quickPrompts = [
    { emoji: "🏖️", text: "Beach getaway under $500" },
    { emoji: "🏔️", text: "Adventure trip to Nepal" },
    { emoji: "💑", text: "Honeymoon in Maldives" },
    { emoji: "👨‍👩‍👧‍👦", text: "Family trip to Singapore" },
  ];

  const trimmedQuery = query.trim();
  const effectivePreviewPhase = trimmedQuery && previewPhase >= 1 ? previewPhase : (!trimmedQuery ? previewPhase : 0);

  // Build preview from real data
  const currentDest = useMemo(() => {
    if (cityInsight?.destination) return cityInsight.destination;
    if (trimmedQuery) {
      const { city, country } = inferDestination(trimmedQuery);
      return country ? `${city}, ${country}` : city;
    }
    return "Your destination";
  }, [cityInsight, trimmedQuery]);

  const currentDays = useMemo(() => {
    if (trimmedQuery) return inferDays(trimmedQuery);
    const current = TYPED_EXAMPLES[typedIndex];
    return inferDays(current);
  }, [trimmedQuery, typedIndex]);

  const currentTravelers = useMemo(() => {
    if (trimmedQuery) return inferTravelers(trimmedQuery);
    return 2;
  }, [trimmedQuery]);

  const schedule = useMemo(() => {
    const destName = cityInsight?.destination?.split(",")[0] || currentDest.split(",")[0] || "Your destination";
    return buildSchedule(destName, currentDays, cityInsight?.popularAreas || []);
  }, [cityInsight, currentDest, currentDays]);

  // Format prices using currency context
  const formatPrice = useCallback((usd: number) => {
    const converted = convertFromSource(usd, "USD");
    return formatDirectPrice(converted > 0 ? converted : usd);
  }, [convertFromSource, formatDirectPrice]);

  const estimatedTotal = useMemo(() => {
    if (!cityInsight) return null;
    const flight = cityInsight.flightEstimate;
    const hotel = cityInsight.hotelEstimate;
    if (!flight && !hotel) return null;
    const flightCost = (flight || 0) * currentTravelers;
    const hotelCost = (hotel || 0) * Math.max(currentDays - 1, 1);
    const activitiesCost = currentDays * 40 * currentTravelers; // rough estimate
    return flightCost + hotelCost + activitiesCost;
  }, [cityInsight, currentDays, currentTravelers]);

  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.02] to-background" />
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] rounded-full bg-accent/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-[0.15em] mb-4">
            <Sparkles className="w-3 h-3" />
            AI Trip Planner
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.1] font-bold text-foreground mb-2">
            Describe your dream trip.{" "}
            <span className="text-accent">See it come alive.</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Type a trip idea — watch flights, hotels & a full itinerary build in real time.
          </p>
        </motion.div>

        {/* Split layout */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-8 items-start">
          {/* LEFT — Chat input side */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Chat bubble context */}
            <div className="mb-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-accent" />
              </div>
              <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-muted-foreground">
                Tell me where you want to go, how many days, and your budget — I'll plan everything instantly ✨
              </div>
            </div>

            {/* Main input area */}
            <motion.div
              animate={
                isFocused
                  ? { boxShadow: "0 0 0 3px hsl(14 90% 58% / 0.12), 0 20px 60px -15px hsl(222 30% 12% / 0.1)" }
                  : { boxShadow: "0 4px 24px -8px hsl(222 30% 12% / 0.06)" }
              }
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div
                className={cn(
                  "flex items-center bg-card border-2 rounded-2xl overflow-hidden transition-colors duration-300",
                  isFocused ? "border-accent/40" : "border-border/50"
                )}
              >
                <div className="pl-4 pr-2 shrink-0">
                  <Sparkles
                    className={cn(
                      "w-5 h-5 transition-all duration-300",
                      isFocused ? "text-accent scale-110" : "text-muted-foreground/50"
                    )}
                  />
                </div>
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder=""
                    className="w-full bg-transparent py-4 sm:py-5 px-2 text-sm sm:text-base text-foreground outline-none"
                  />
                  {!query && !isFocused && (
                    <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                      <span className="text-muted-foreground/50 text-sm sm:text-base">
                        {displayText}
                        {isTyping && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity }}
                            className="inline-block w-[2px] h-4 bg-accent/60 ml-0.5 align-middle"
                          />
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSubmit()}
                  className={cn(
                    "m-2 h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                    query.trim()
                      ? "bg-accent text-accent-foreground shadow-md hover:shadow-lg hover:scale-105"
                      : "bg-muted/60 text-muted-foreground/40"
                  )}
                >
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </motion.div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 mt-4">
              {quickPrompts.map((p, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  onClick={() => {
                    setQuery(p.text);
                    handleSubmit(p.text);
                  }}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm hover:border-accent/30 hover:bg-accent/5 transition-all duration-300 text-xs"
                >
                  <span>{p.emoji}</span>
                  <span className="text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                    {p.text}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Smart backend note */}
            <div className="mt-6 flex items-start gap-2 text-[11px] text-muted-foreground/60">
              <div className="w-4 h-4 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
              </div>
              <span>
                Instant trip previews available right away — live prices and availability confirmed when you're ready to book.
              </span>
            </div>
          </motion.div>

          {/* RIGHT — Live itinerary preview card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-[var(--shadow-elevated)] flex flex-col" style={{ minHeight: 420 }}>
              {/* Preview header */}
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-accent" />
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={effectivePreviewPhase >= 1 ? currentDest : "idle"}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="font-semibold text-foreground text-sm"
                    >
                      {effectivePreviewPhase >= 1 ? currentDest : "Your destination"}
                    </motion.span>
                  </AnimatePresence>
                  {insightLoading && <Loader2 className="w-3 h-3 text-accent animate-spin" />}
                </div>
                <AnimatePresence>
                  {effectivePreviewPhase >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-3 text-xs text-muted-foreground"
                    >
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{currentDays} days</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{currentTravelers}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Day schedule */}
              <div className="px-5 py-4 space-y-3 flex-1">
                <AnimatePresence>
                  {effectivePreviewPhase >= 2 &&
                    schedule.map((day, i) => (
                      <motion.div
                        key={day.day}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="flex gap-3"
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-[10px] font-bold">
                            D{day.day}
                          </div>
                          {i < schedule.length - 1 && (
                            <div className="w-px flex-1 bg-border/60 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <day.icon className="w-3 h-3 text-accent/70" />
                            {day.title}
                          </p>
                          <div className="mt-1 space-y-0.5">
                            {day.activities.map((act, ai) => (
                              <p key={ai} className="text-[11px] text-muted-foreground leading-relaxed">
                                • {act}
                              </p>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>

                {/* Idle state placeholder */}
                {effectivePreviewPhase < 2 && !insightLoading && (
                  <div className="flex flex-col items-center justify-center h-[240px] text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                      <MapPin className="w-5 h-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground/40 font-medium">
                      Your itinerary will appear here
                    </p>
                    <p className="text-[11px] text-muted-foreground/30 mt-1">
                      Type a trip idea to see a live preview
                    </p>
                  </div>
                )}

                {/* Loading state */}
                {effectivePreviewPhase < 2 && insightLoading && (
                  <div className="flex flex-col items-center justify-center h-[240px] text-center">
                    <Loader2 className="w-6 h-6 text-accent animate-spin mb-3" />
                    <p className="text-sm text-muted-foreground/60 font-medium">
                      Fetching destination insights…
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom: flight + hotel + total — only show when real data available */}
              {/* Bottom: flight + hotel + total — always rendered to prevent layout shift */}
              <div
                className={cn(
                  "border-t border-border/40 px-5 py-3 bg-muted/20 transition-opacity duration-400 mt-auto",
                  effectivePreviewPhase >= 3 ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              >
                {(cityInsight?.flightEstimate || cityInsight?.hotelEstimate) && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center">
                        <Plane className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Flight</p>
                        <p className="text-xs font-semibold text-foreground">
                          {cityInsight?.flightEstimate ? `~${formatPrice(cityInsight.flightEstimate)}` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-accent/5 flex items-center justify-center">
                        <Hotel className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Hotel</p>
                        <p className="text-xs font-semibold text-foreground">
                          {cityInsight?.hotelEstimate ? `~${formatPrice(cityInsight.hotelEstimate)}/night` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                        <DollarSign className="w-3.5 h-3.5 text-success" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Est. Total</p>
                        <p className="text-xs font-bold text-foreground">
                          {estimatedTotal ? `~${formatPrice(estimatedTotal)}` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => handleSubmit(trimmedQuery || TYPED_EXAMPLES[typedIndex])}
                  className="w-full mt-3 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors"
                >
                  Plan This Trip
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AiTripPlanner;
