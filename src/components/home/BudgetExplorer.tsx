import { useState, useEffect, useMemo } from "react";
import { Wallet, Sparkles, Plane, Hotel, MapPin, ArrowRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { getFlightFallbacks, getOriginAirports } from "@/data/geoDestinationMap";
import { useSiteContent } from "@/hooks/useSiteContent";
import DOMPurify from "dompurify";

interface BudgetDest {
  city: string;
  country: string;
  iata: string;
  image: string;
  flightFrom: number;
  hotelPerNight: number;
  days: number;
  highlights: string[];
  totalEstimate: number;
}

interface DestTemplate {
  city: string;
  country: string;
  iata: string;
  image: string;
  fallbackFlightUSD: number;
  fallbackHotelUSD: number;
  days: number;
  highlights: string[];
}

const DESTINATIONS: DestTemplate[] = [
  { city: "Bangkok", country: "Thailand", iata: "BKK", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=500&q=80", fallbackFlightUSD: 160, fallbackHotelUSD: 25, days: 5, highlights: ["Street food", "Temples", "Night markets"] },
  { city: "Kolkata", country: "India", iata: "CCU", image: "https://images.unsplash.com/photo-1558431382-27e303142255?w=500&q=80", fallbackFlightUSD: 65, fallbackHotelUSD: 18, days: 4, highlights: ["Victoria Memorial", "Street food", "Culture"] },
  { city: "Kathmandu", country: "Nepal", iata: "KTM", image: "https://images.unsplash.com/photo-1558799401-1dcba79834c2?w=500&q=80", fallbackFlightUSD: 100, fallbackHotelUSD: 15, days: 5, highlights: ["Trekking", "Temples", "Mountains"] },
  { city: "Kuala Lumpur", country: "Malaysia", iata: "KUL", image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=500&q=80", fallbackFlightUSD: 140, fallbackHotelUSD: 30, days: 4, highlights: ["Petronas Towers", "Food", "Shopping"] },
  { city: "Bali", country: "Indonesia", iata: "DPS", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=80", fallbackFlightUSD: 190, fallbackHotelUSD: 22, days: 5, highlights: ["Beaches", "Temples", "Rice terraces"] },
  { city: "Dubai", country: "UAE", iata: "DXB", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&q=80", fallbackFlightUSD: 250, fallbackHotelUSD: 55, days: 4, highlights: ["Burj Khalifa", "Desert safari", "Shopping"] },
  { city: "Singapore", country: "Singapore", iata: "SIN", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=500&q=80", fallbackFlightUSD: 220, fallbackHotelUSD: 75, days: 3, highlights: ["Marina Bay", "Gardens", "Food courts"] },
  { city: "Colombo", country: "Sri Lanka", iata: "CMB", image: "https://images.unsplash.com/photo-1586016413664-864c0dd76f53?w=500&q=80", fallbackFlightUSD: 90, fallbackHotelUSD: 20, days: 5, highlights: ["Beaches", "Tea country", "Wildlife"] },
  { city: "Guangzhou", country: "China", iata: "CAN", image: "https://images.unsplash.com/photo-1583394293214-28eebd0fede8?w=500&q=80", fallbackFlightUSD: 180, fallbackHotelUSD: 35, days: 4, highlights: ["Canton Tower", "Dim sum", "Markets"] },
  { city: "Phuket", country: "Thailand", iata: "HKT", image: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=500&q=80", fallbackFlightUSD: 175, fallbackHotelUSD: 28, days: 5, highlights: ["Beaches", "Island hopping", "Nightlife"] },
  { city: "Istanbul", country: "Turkey", iata: "IST", image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=500&q=80", fallbackFlightUSD: 300, fallbackHotelUSD: 40, days: 5, highlights: ["Hagia Sophia", "Grand Bazaar", "Bosphorus"] },
  { city: "Tokyo", country: "Japan", iata: "NRT", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=500&q=80", fallbackFlightUSD: 350, fallbackHotelUSD: 80, days: 5, highlights: ["Shibuya", "Sushi", "Mt. Fuji"] },
  { city: "Hanoi", country: "Vietnam", iata: "HAN", image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=500&q=80", fallbackFlightUSD: 130, fallbackHotelUSD: 18, days: 5, highlights: ["Old Quarter", "Pho", "Ha Long Bay"] },
  { city: "Maldives", country: "Maldives", iata: "MLE", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=500&q=80", fallbackFlightUSD: 280, fallbackHotelUSD: 120, days: 4, highlights: ["Overwater villas", "Snorkeling", "Sunsets"] },
];





/** Round to a clean figure based on magnitude */
const smartRound = (n: number): number => {
  if (n <= 0) return 0;
  if (n < 50) return Math.round(n / 5) * 5 || 5;
  if (n < 500) return Math.round(n / 10) * 10;
  if (n < 5000) return Math.round(n / 100) * 100;
  if (n < 20000) return Math.round(n / 500) * 500;
  if (n < 100000) return Math.round(n / 1000) * 1000;
  return Math.round(n / 5000) * 5000;
};

/** Round budget labels to clean display values */
const smartBudgetLabel = (n: number): number => {
  if (n < 500) return Math.ceil(n / 50) * 50;
  if (n < 5000) return Math.ceil(n / 100) * 100;
  if (n < 20000) return Math.ceil(n / 500) * 500;
  if (n < 100000) return Math.ceil(n / 1000) * 1000;
  return Math.ceil(n / 5000) * 5000;
};

interface BudgetTier {
  budgetDisplay: number; // display-currency ceiling for this tier
  budgetUSD: number;     // USD equivalent for trip-planner link
  destinations: BudgetDest[];
}

const TIER_COUNT = 4;
const ITEMS_PER_TIER = 3;

const BudgetExplorer = () => {
  const { currency, convertPrice, convertFromSource, formatDirectPrice, liveRates } = useCurrency();
  const { content } = useSiteContent();
  const beCfg = (content.budget_explorer || {}) as Record<string, any>;
  const [activeTier, setActiveTier] = useState(1); // 0-indexed, default 2nd tier
  const [isAnimating, setIsAnimating] = useState(false);
  const [cachedPrices, setCachedPrices] = useState<Record<string, { price: number; currency: string }>>({});
  const [cachedHotelPrices, setCachedHotelPrices] = useState<Record<string, { avg: number; min: number }>>({});
  const [userCountryCode, setUserCountryCode] = useState<string>("DEFAULT");

  useEffect(() => {
    const loadPrices = async () => {
      const { detectCountryCode } = await import("@/utils/geolocation");
      const cc = await detectCountryCode();
      setUserCountryCode(cc);

      const originCodes = getOriginAirports(cc);

      const [flightRes, hotelRes] = await Promise.all([
        supabase
          .from("popular_routes")
          .select("from_code, to_code, lowest_price, currency")
          .gt("lowest_price", 0)
          .in("from_code", originCodes),
        supabase
          .from("hotel_city_estimates")
          .select("city, avg_per_night_usd, min_per_night_usd"),
      ]);

      if (flightRes.data) {
        const map: Record<string, { price: number; currency: string }> = {};
        for (const row of flightRes.data) {
          const existing = map[row.to_code];
          if (!existing || row.lowest_price < existing.price) {
            map[row.to_code] = { price: row.lowest_price, currency: row.currency || "BDT" };
          }
        }
        setCachedPrices(map);
      }

      if (hotelRes.data) {
        const hMap: Record<string, { avg: number; min: number }> = {};
        for (const row of hotelRes.data) {
          hMap[row.city] = { avg: row.avg_per_night_usd, min: row.min_per_night_usd };
        }
        setCachedHotelPrices(hMap);
      }
    };
    loadPrices();
  }, []);

  /** Convert from any source currency to display currency using centralized helper */
  const crossConvert = (amount: number, fromCurrency: string): number => {
    return convertFromSource(amount, fromCurrency);
  };

  /** Build ALL destination cards sorted by price */
  const sortedDests = useMemo((): BudgetDest[] => {
    const geoFallbacks = getFlightFallbacks(userCountryCode);

    const dests = DESTINATIONS.map((d) => {
      const cached = cachedPrices[d.iata];
      let oneWayDisplay: number;

      if (cached) {
        oneWayDisplay = smartRound(crossConvert(cached.price, cached.currency));
      } else {
        const fallbackUSD = geoFallbacks[d.iata] ?? d.fallbackFlightUSD;
        if (fallbackUSD <= 0) return null;
        oneWayDisplay = smartRound(convertPrice(fallbackUSD));
      }

      const hotelEst = cachedHotelPrices[d.city];
      const hotelUSD = hotelEst ? hotelEst.avg : d.fallbackHotelUSD;

      const flightDisplay = smartRound(oneWayDisplay * 2);
      const hotelDisplay = smartRound(convertPrice(hotelUSD));
      const total = smartRound(flightDisplay + hotelDisplay * d.days);

      return {
        city: d.city,
        country: d.country,
        iata: d.iata,
        image: d.image,
        flightFrom: flightDisplay,
        hotelPerNight: hotelDisplay,
        days: d.days,
        highlights: d.highlights,
        totalEstimate: total,
      };
    }).filter(Boolean) as BudgetDest[];

    return dests.sort((a, b) => a.totalEstimate - b.totalEstimate);
  }, [cachedPrices, cachedHotelPrices, convertPrice, liveRates, userCountryCode, currency]);

  /** Split into exclusive tiers — each tier shows UNIQUE destinations not in cheaper tiers */
  const tiers = useMemo((): BudgetTier[] => {
    if (!sortedDests.length) return [];

    // Ensure each tier gets exactly ITEMS_PER_TIER destinations
    // Only create as many tiers as we can fill completely
    const maxTiers = Math.min(TIER_COUNT, Math.floor(sortedDests.length / ITEMS_PER_TIER));
    const result: BudgetTier[] = [];

    for (let t = 0; t < maxTiers; t++) {
      const start = t * ITEMS_PER_TIER;
      const end = start + ITEMS_PER_TIER;
      const tierDests = sortedDests.slice(start, end);

      if (tierDests.length < ITEMS_PER_TIER) break;

      // Budget ceiling = highest total in this tier, rounded up nicely
      const maxTotal = tierDests[tierDests.length - 1].totalEstimate;
      const budgetDisplay = smartBudgetLabel(Math.ceil(maxTotal * 1.05)); // 5% buffer

      // Estimate USD equivalent for trip-planner links
      const displayRate = liveRates[currency] || 1;
      const budgetUSD = Math.round(budgetDisplay / displayRate);

      result.push({ budgetDisplay, budgetUSD, destinations: tierDests });
    }

    return result;
  }, [sortedDests, liveRates, currency]);

  // Clamp activeTier to valid range
  const safeActiveTier = Math.min(activeTier, tiers.length - 1);

  const currentTier = tiers[safeActiveTier];
  const currentDests = currentTier?.destinations || [];

  // Animate on tier change
  const [displayResults, setDisplayResults] = useState<BudgetDest[]>([]);
  useEffect(() => {
    setIsAnimating(true);
    const t = setTimeout(() => {
      setDisplayResults(currentDests);
      setIsAnimating(false);
    }, 350);
    return () => clearTimeout(t);
  }, [safeActiveTier, currentDests]);

  const headerBudget = currentTier
    ? formatDirectPrice(currentTier.budgetDisplay)
    : formatDirectPrice(0);

  if (!tiers.length) return null;

  return (
    <section className="py-14 sm:py-24 bg-gradient-to-b from-background to-muted/40 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="text-center mb-8 sm:mb-12 max-w-2xl mx-auto"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles className="w-3 h-3" />
            {beCfg.badge || "AI-Powered Discovery"}
          </span>
          {beCfg.heading ? (
            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(beCfg.heading)) }}
            />
          ) : (
            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Where can you go with{" "}
              <span className="text-gradient">{headerBudget}</span>?
            </h2>
          )}
          <p className="text-muted-foreground text-sm sm:text-base mt-2">
            {beCfg.subtitle || "Pick your budget and we'll find the best destinations — flights + hotels included."}
          </p>
        </motion.div>

        {/* Dynamic budget tier picker */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-12"
        >
          {tiers.map((tier, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTier(idx)}
              className={cn(
                "px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 border",
                safeActiveTier === idx
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-105"
                  : "bg-card text-foreground border-border/50 hover:border-primary/30 hover:bg-primary/5"
              )}
            >
              <Wallet className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              {formatDirectPrice(tier.budgetDisplay)}
            </button>
          ))}
        </motion.div>

        {/* Results grid */}
        <AnimatePresence mode="wait">
          {!isAnimating && displayResults.length > 0 && (
            <motion.div
              key={safeActiveTier}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            >
              {displayResults.map((dest, i) => (
                <motion.div
                  key={dest.city}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    to={`/trip-planner?destination=${encodeURIComponent(dest.city)}&budget=${currentTier?.budgetUSD || 500}`}
                    className="group block bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/20 hover:-translate-y-1 transition-all duration-300"
                    style={{ boxShadow: "var(--card-shadow)" }}
                  >
                    {/* Image */}
                    <div className="relative h-36 sm:h-44 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                      <img
                        src={dest.image}
                        alt={dest.city}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />

                      {/* Total badge */}
                      <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-extrabold text-foreground shadow-lg">
                        ~{formatDirectPrice(dest.totalEstimate)}
                      </div>

                      {/* City name */}
                      <div className="absolute bottom-3 left-3">
                        <div className="flex items-center gap-1 text-primary-foreground/70 text-[9px] font-bold uppercase tracking-widest">
                          <MapPin className="w-2.5 h-2.5" />
                          {dest.country}
                        </div>
                        <h3 className="text-lg sm:text-xl font-extrabold text-primary-foreground leading-tight">
                          {dest.city}
                        </h3>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Plane className="w-3 h-3 text-primary" />
                          Return: {formatDirectPrice(dest.flightFrom)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hotel className="w-3 h-3 text-accent" />
                          {formatDirectPrice(dest.hotelPerNight)}/night
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground mb-3">
                        {dest.days} nights · All-in estimate
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {dest.highlights.map((h) => (
                          <span
                            key={h}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {h}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary group-hover:underline">
                          Plan this trip
                        </span>
                        <ChevronRight className="w-4 h-4 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {!isAnimating && displayResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Wallet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No destinations available for this tier
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          className="text-center mt-8 sm:mt-10"
        >
          <Link
            to="/trip-planner"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4" />
            Plan a Custom Trip with AI
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default BudgetExplorer;
