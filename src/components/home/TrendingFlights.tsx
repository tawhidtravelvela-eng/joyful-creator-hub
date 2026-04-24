import { useState, useEffect } from "react";
import { TrendingFlightsSkeleton } from "./HomeSkeleton";
import { Plane, ArrowRight, Clock, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AIRLINE_NAMES } from "@/data/airlines";
import { motion } from "framer-motion";
import { getAirportsForCountry, getCountryName, getDestCards } from "@/data/geoDestinationMap";
import { useSiteContent } from "@/hooks/useSiteContent";
import DOMPurify from "dompurify";

interface PopularRoute {
  from_code: string;
  to_code: string;
  from_city: string;
  to_city: string;
  lowest_price: number;
  currency: string;
  airline: string;
  duration: string;
  stops: number;
  search_count: number;
  ai_suggested?: boolean;
}

const FALLBACK_ROUTES: PopularRoute[] = [
  { from_code: "DAC", to_code: "DXB", from_city: "Dhaka", to_city: "Dubai", lowest_price: 340, currency: "USD", airline: "FZ", duration: "5h 30m", stops: 0, search_count: 100 },
  { from_code: "DAC", to_code: "BKK", from_city: "Dhaka", to_city: "Bangkok", lowest_price: 180, currency: "USD", airline: "TG", duration: "3h 15m", stops: 0, search_count: 90 },
  { from_code: "DAC", to_code: "SIN", from_city: "Dhaka", to_city: "Singapore", lowest_price: 250, currency: "USD", airline: "SQ", duration: "4h 10m", stops: 0, search_count: 85 },
  { from_code: "DAC", to_code: "KUL", from_city: "Dhaka", to_city: "Kuala Lumpur", lowest_price: 220, currency: "USD", airline: "MH", duration: "4h 00m", stops: 0, search_count: 80 },
  { from_code: "DAC", to_code: "CCU", from_city: "Dhaka", to_city: "Kolkata", lowest_price: 75, currency: "USD", airline: "BG", duration: "1h 05m", stops: 0, search_count: 95 },
  { from_code: "DAC", to_code: "DEL", from_city: "Dhaka", to_city: "Delhi", lowest_price: 130, currency: "USD", airline: "AI", duration: "2h 30m", stops: 0, search_count: 75 },
];

const getAirlineLogo = (code: string) =>
  `https://pics.avs.io/60/60/${code}.png`;

const TrendingFlights = () => {
  const { content } = useSiteContent();
  const cfg = content.trending || {};
  const badge = cfg.badge || "Trending Now";
  const subtitleOverride = typeof cfg.subtitle === "string" ? cfg.subtitle : null;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [routes, setRoutes] = useState<PopularRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCountryName, setUserCountryName] = useState("Your Region");
  const [hasGeoRoutes, setHasGeoRoutes] = useState(false);
  const { convertFromSource, formatDirectPrice } = useCurrency();

  /** Convert a route price from its stored currency to the user's display currency */
  const formatRoutePrice = (route: PopularRoute) => {
    const storedCurrency = route.currency || "USD";
    const converted = convertFromSource(route.lowest_price, storedCurrency);
    // Guard against obviously wrong prices (< $10 equivalent for a flight)
    if (converted < 10) {
      return formatDirectPrice(route.lowest_price);
    }
    return formatDirectPrice(converted);
  };

  useEffect(() => {
    const dedupeDirectedRoutes = (items: PopularRoute[]) => {
      const seen = new Map<string, PopularRoute>();
      for (const route of items) {
        const key = `${route.from_code}-${route.to_code}`;
        const existing = seen.get(key);
        if (
          !existing ||
          (route.search_count ?? 0) > (existing.search_count ?? 0) ||
          ((route.search_count ?? 0) === (existing.search_count ?? 0) && route.lowest_price < existing.lowest_price)
        ) {
          seen.set(key, route);
        }
      }
      return Array.from(seen.values()).sort((a, b) => (b.search_count ?? 0) - (a.search_count ?? 0));
    };

    const fetchPopular = async () => {
      let countryCode = "";
      let countryName = "";

      try {
        const { detectCountry: geo } = await import("@/utils/geolocation");
        const country = await geo();
        countryCode = country.code;
        countryName = getCountryName(countryCode) || country.name || "";
        if (countryName) setUserCountryName(countryName);
      } catch { /* continue */ }

      const userAirportCodes = countryCode ? getAirportsForCountry(countryCode) : [];
      let finalRoutes: PopularRoute[] = [];

      if (userAirportCodes.length > 0) {
        const { data: localData, error: localError } = await supabase
          .from("popular_routes")
          .select("*")
          .in("from_code", userAirportCodes)
          .gt("lowest_price", 0)
          .order("search_count", { ascending: false })
          .limit(24);

        if (!localError && localData?.length) {
          finalRoutes = dedupeDirectedRoutes(localData as PopularRoute[]).slice(0, 8);
        }

        if (countryCode && finalRoutes.length < 8) {
          const originCode = userAirportCodes[0] || "DAC";
          const generatedRoutes: PopularRoute[] = getDestCards(countryCode).map((d, i) => ({
            from_code: originCode,
            to_code: d.route.match(/to=([A-Z]{3})/)?.[1] || "DXB",
            from_city: countryName || originCode,
            to_city: d.city,
            lowest_price: d.basePrice,
            currency: "USD",
            airline: "",
            duration: "",
            stops: 0,
            search_count: 40 - i,
            ai_suggested: true,
          }));

          finalRoutes = dedupeDirectedRoutes([...finalRoutes, ...generatedRoutes]).slice(0, 8);
        }

        setHasGeoRoutes(finalRoutes.length > 0);
      }

      if (finalRoutes.length === 0) {
        const { data: globalData, error: globalError } = await supabase
          .from("popular_routes")
          .select("*")
          .gt("lowest_price", 0)
          .order("search_count", { ascending: false })
          .limit(24);

        if (!globalError && globalData?.length) {
          finalRoutes = dedupeDirectedRoutes(globalData as PopularRoute[]).slice(0, 8);
        }

        if (finalRoutes.length === 0) {
          finalRoutes = FALLBACK_ROUTES;
        }

        setHasGeoRoutes(false);
      }

      setRoutes(finalRoutes);
      setLoading(false);
    };

    fetchPopular();
  }, []);



  if (loading) return <TrendingFlightsSkeleton />;
  if (routes.length === 0) return null;

  return (
    <section className="py-14 sm:py-24 relative overflow-hidden">
      {/* Premium background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-muted/20 to-background" />
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-accent/[0.02] blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
          className="flex items-end justify-between mb-10 sm:mb-12"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/8 text-accent text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] mb-3.5">
              <Flame className="w-3 h-3" />
              {badge}
            </span>
            {cfg.heading ? (
              <h2
                className="text-2xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(cfg.heading)) }}
              />
            ) : (
              <h2
                className="text-2xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Trending Routes{" "}
                {hasGeoRoutes ? (
                  <>from <span className="text-accent">{userCountryName}</span></>
                ) : (
                  <span className="text-accent">Worldwide</span>
                )}
              </h2>
            )}
            <p className="text-muted-foreground text-xs sm:text-sm mt-2 max-w-md">
              {subtitleOverride ?? (hasGeoRoutes
                ? "Popular routes loved by travelers in your area — updated in real time."
                : "Most searched flight routes by our travelers — updated in real time.")}
            </p>
          </div>
          <Link
            to="/flights"
            className="hidden md:flex items-center gap-1.5 text-accent font-semibold text-sm hover:gap-2.5 transition-all group"
          >
            See All <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>

        {/* Premium ticket cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {routes.slice(0, 8).map((route, i) => {
            const isHovered = hoveredIdx === i;
            const stopsLabel = route.stops === 0 ? "Non-stop" : `${route.stops} stop${route.stops > 1 ? "s" : ""}`;
            const airlineName = (route.airline && AIRLINE_NAMES[route.airline]) || route.airline || "Multiple Airlines";
            const airlineCode = route.airline || "";

            return (
              <motion.div
                key={`${route.from_code}-${route.to_code}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: i * 0.05, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              >
                <Link
                  to={`/flights?from=${route.from_code}&to=${route.to_code}&date=${new Date().toISOString().split("T")[0]}&adults=1&tripType=one-way`}
                  className="group block"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div
                    className={cn(
                      "rounded-2xl sm:rounded-3xl border bg-card overflow-hidden transition-all duration-400",
                      isHovered
                        ? "border-accent/25 shadow-[0_20px_60px_-12px_hsl(14_90%_58%/0.12),0_0_0_1px_hsl(14_90%_58%/0.05)] -translate-y-1.5"
                        : "border-border/30 shadow-[var(--card-shadow)]"
                    )}
                  >
                    {/* Route header */}
                    <div className="px-5 pt-5 pb-3.5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          {airlineCode && (
                            <div className="w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center overflow-hidden">
                              <img
                                src={getAirlineLogo(airlineCode)}
                                alt={airlineName}
                                className="w-6 h-6 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </div>
                          )}
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground/70 font-medium truncate max-w-[110px]">
                            {airlineName}
                          </span>
                        </div>
                        {i === 0 && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-accent/15 to-accent/5 text-accent px-2.5 py-1 rounded-full border border-accent/10">
                            🔥 Hot
                          </span>
                        )}
                      </div>

                      {/* City pair */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-lg sm:text-xl font-bold text-foreground leading-tight truncate">
                            {route.from_code}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
                            {route.from_city || route.from_code}
                          </p>
                        </div>

                        {/* Flight path visual — premium */}
                        <div className="flex flex-col items-center shrink-0 w-[76px]">
                          <div className="w-full flex items-center">
                            <div className="w-2 h-2 rounded-full border-[1.5px] border-primary/40 shrink-0" />
                            <div className="flex-1 border-t border-dashed border-muted-foreground/20 relative mx-1">
                              <Plane
                                className={cn(
                                  "w-3.5 h-3.5 text-accent absolute top-1/2 -translate-y-1/2 transition-all duration-500",
                                  isHovered ? "left-[70%] rotate-0" : "left-[30%] -rotate-12"
                                )}
                              />
                            </div>
                            <div className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                          </div>
                          <p className="text-[8px] text-muted-foreground/50 mt-1 font-medium">{stopsLabel}</p>
                        </div>

                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-lg sm:text-xl font-bold text-foreground leading-tight truncate">
                            {route.to_code}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
                            {route.to_city || route.to_code}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Ticket tear — premium */}
                    <div className="relative mx-0 my-1">
                      <div className="border-t border-dashed border-border/40" />
                      <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-background" />
                      <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-background" />
                    </div>

                    {/* Price footer */}
                    <div className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em] font-semibold mb-0.5">
                          {route.ai_suggested ? "Approx. from" : "Starting from"}
                        </p>
                        <p className="text-xl sm:text-2xl font-extrabold text-primary leading-tight tracking-tight">
                          {formatRoutePrice(route)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-400",
                          isHovered
                            ? "bg-accent text-white scale-110 shadow-lg shadow-accent/20"
                            : "bg-muted/40 text-muted-foreground/40"
                        )}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile CTA */}
        <div className="mt-8 text-center md:hidden">
          <Link
            to="/flights"
            className="inline-flex items-center gap-1.5 text-accent font-semibold text-sm"
          >
            See All Routes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default TrendingFlights;
