import { useState, useEffect } from "react";
import { ArrowRight, Plane, Clock, MapPin, Sparkles, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AIRLINE_NAMES } from "@/data/airlines";
import { airports } from "@/data/airports";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { detectCountry } from "@/utils/geolocation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteContent } from "@/hooks/useSiteContent";
import DOMPurify from "dompurify";

interface Route {
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
}

const DEST_IMAGES: Record<string, string> = {
  DXB: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=250&fit=crop",
  BKK: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=250&fit=crop",
  KUL: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=400&h=250&fit=crop",
  SIN: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&h=250&fit=crop",
  CCU: "https://images.unsplash.com/photo-1558431382-27e303142255?w=400&h=250&fit=crop",
  DEL: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&h=250&fit=crop",
  DOH: "https://images.unsplash.com/photo-1549927681-0b673b8243ab?w=400&h=250&fit=crop",
  IST: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&h=250&fit=crop",
  LHR: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=250&fit=crop",
  JFK: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&h=250&fit=crop",
  MLE: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&h=250&fit=crop",
  CMB: "https://images.unsplash.com/photo-1580910365203-91ea9115a319?w=400&h=250&fit=crop",
  DAC: "https://images.unsplash.com/photo-1622214366189-db927fd72a00?w=400&h=250&fit=crop",
  NRT: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=250&fit=crop",
  CDG: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=250&fit=crop",
  DPS: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=250&fit=crop",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=400&h=250&fit=crop";
const getAirlineLogo = (code: string) => `https://pics.avs.io/60/60/${code}.png`;

const RecommendationsSection = () => {
  const [deals, setDeals] = useState<Route[]>([]);
  const [originCity, setOriginCity] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { convertFromSource, formatDirectPrice } = useCurrency();
  const { content } = useSiteContent();
  const rCfg = (content.recommendations || {}) as Record<string, any>;

  useEffect(() => {
    const load = async () => {
      // Detect user country → find local airports
      const country = await detectCountry();
      const countryName = country?.code === "US" ? "United States" : country?.code === "GB" ? "United Kingdom" : country?.code === "AE" ? "United Arab Emirates" : country?.name || "";
      const localCodes = countryName
        ? airports.filter(a => a.country.toLowerCase() === countryName.toLowerCase()).map(a => a.code)
        : [];

      // Find the primary city name for the header
      if (localCodes.length > 0) {
        const primaryAirport = airports.find(a => a.code === localCodes[0]);
        setOriginCity(primaryAirport?.city || countryName);
      }

      // Fetch popular routes
      const { data } = await supabase
        .from("popular_routes")
        .select("*")
        .gt("lowest_price", 0)
        .order("lowest_price", { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        // Prioritize routes from user's country
        const geoRoutes = localCodes.length > 0
          ? (data as Route[]).filter(r => localCodes.includes(r.from_code))
          : [];
        const otherRoutes = (data as Route[]).filter(
          r => !localCodes.includes(r.from_code)
        );
        const sorted = [...geoRoutes, ...otherRoutes];

        // Deduplicate by destination
        const seen = new Set<string>();
        const unique: Route[] = [];
        for (const r of sorted) {
          if (seen.has(r.to_code)) continue;
          seen.add(r.to_code);
          unique.push(r);
          if (unique.length >= 6) break;
        }
        setDeals(unique);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-72 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[220px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (deals.length === 0) return null;

  const headerCity = originCity || "Your City";

  return (
    <section className="py-12 sm:py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background via-primary/[0.02] to-background" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="flex items-end justify-between mb-8 sm:mb-10"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-3">
              <Sparkles className="w-3 h-3" />
              {rCfg.badge || "Updated Today"}
            </span>
            {rCfg.heading ? (
              <h2
                className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(rCfg.heading)) }}
              />
            ) : (
              <h2
                className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Best Deals from <span className="text-primary">{headerCity}</span>
              </h2>
            )}
            <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">
              {rCfg.subtitle || "Lowest prices found today from your nearest airports"}
            </p>
          </div>
          <Link to="/flights" className="hidden md:flex items-center gap-1.5 text-primary font-semibold text-sm hover:gap-2.5 transition-all group">
            See All <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((route, i) => {
            const destCity = route.to_city || airports.find(a => a.code === route.to_code)?.city || route.to_code;
            const airlineName = (route.airline && AIRLINE_NAMES[route.airline]) || route.airline || "";
            const stopsLabel = route.stops === 0 ? "Non-stop" : `${route.stops} stop${route.stops > 1 ? "s" : ""}`;
            const image = DEST_IMAGES[route.to_code] || DEFAULT_IMAGE;

            // Convert price from stored currency to display currency
            const converted = convertFromSource(route.lowest_price, route.currency || "USD");

            return (
              <motion.div
                key={`${route.from_code}-${route.to_code}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <Link
                  to={`/flights?from=${route.from_code}&to=${route.to_code}&date=${new Date().toISOString().split("T")[0]}&adults=1&tripType=one-way`}
                  className="group block rounded-2xl overflow-hidden border border-border/50 bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Image */}
                  <div className="relative h-[140px] sm:h-[160px] overflow-hidden">
                    <img
                      src={image}
                      alt={destCity}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                    {/* Price tag */}
                    <div className="absolute bottom-3 left-3">
                      <div className="bg-primary text-primary-foreground text-sm sm:text-base font-extrabold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        from {formatDirectPrice(converted)}
                      </div>
                    </div>

                    {/* Route badge */}
                    <div className="absolute top-3 left-3">
                      <div className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
                        <Plane className="w-3 h-3" />
                        {route.from_code} → {route.to_code}
                      </div>
                    </div>

                    {/* Airline logo */}
                    {route.airline && (
                      <div className="absolute top-3 right-3">
                        <img
                          src={getAirlineLogo(route.airline)}
                          alt={airlineName}
                          className="w-7 h-7 rounded-md bg-white p-0.5 border border-white/20 shadow-sm"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-4 py-3">
                    <p className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      {destCity}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                      {airlineName && <span>{airlineName}</span>}
                      {route.duration && (
                        <>
                          {airlineName && <span>•</span>}
                          <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{route.duration}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{stopsLabel}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 text-center md:hidden">
          <Link to="/flights" className="inline-flex items-center gap-1.5 text-primary font-semibold text-sm">
            See All Deals <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default RecommendationsSection;
