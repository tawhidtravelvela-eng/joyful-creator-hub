import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plane, Hotel, TrendingDown, ArrowRight, Tag, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { airports } from "@/data/airports";
import { AIRLINE_NAMES } from "@/data/airlines";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteContent } from "@/hooks/useSiteContent";
import DOMPurify from "dompurify";

interface Deal {
  type: "flight" | "hotel";
  destination: string;
  destinationCode?: string;
  originCode?: string;
  price: number;
  currency: string;
  airline?: string;
  airlineLogo?: string;
  link: string;
  image?: string;
}

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  BD: "Bangladesh", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates",
  IN: "India", SG: "Singapore", MY: "Malaysia", TH: "Thailand", JP: "Japan",
  KR: "South Korea", CN: "China", AU: "Australia", CA: "Canada", DE: "Germany",
  FR: "France", PK: "Pakistan", SA: "Saudi Arabia", QA: "Qatar", ID: "Indonesia",
};

// Destination images (Unsplash)
const DEST_IMAGES: Record<string, string> = {
  DXB: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=250&fit=crop",
  BKK: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=250&fit=crop",
  KUL: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=400&h=250&fit=crop",
  SIN: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&h=250&fit=crop",
  CCU: "https://images.unsplash.com/photo-1558431382-27e303142255?w=400&h=250&fit=crop",
  DEL: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&h=250&fit=crop",
  CAN: "https://images.unsplash.com/photo-1583475020831-178081e85e0b?w=400&h=250&fit=crop",
  DOH: "https://images.unsplash.com/photo-1549927681-0b673b8243ab?w=400&h=250&fit=crop",
  IST: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&h=250&fit=crop",
  LHR: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=250&fit=crop",
  JFK: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&h=250&fit=crop",
  MLE: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&h=250&fit=crop",
  CMB: "https://images.unsplash.com/photo-1580910365203-91ea9115a319?w=400&h=250&fit=crop",
  DAC: "https://images.unsplash.com/photo-1622214366189-db927fd72a00?w=400&h=250&fit=crop",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=400&h=250&fit=crop";

const getAirlineLogo = (code: string) => `https://pics.avs.io/60/60/${code}.png`;

const DealsSection = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();
  const { content } = useSiteContent();

  useEffect(() => {
    const fetchDeals = async () => {
      // Detect country
      let userCountry = "";
      try {
        const { detectCountry: geo } = await import("@/utils/geolocation");
        const country = await geo();
        userCountry = COUNTRY_CODE_TO_NAME[country.code] || country.name || "";
      } catch { /* continue */ }

      const userAirportCodes = userCountry
        ? airports.filter((a) => a.country.toLowerCase() === userCountry.toLowerCase()).map((a) => a.code)
        : [];

      // Fetch cheapest routes from popular_routes (already cached)
      const { data: routeData } = await supabase
        .from("popular_routes")
        .select("*")
        .gt("lowest_price", 0)
        .order("lowest_price", { ascending: true })
        .limit(50);

      const result: Deal[] = [];

      if (routeData && routeData.length > 0) {
        // Prioritize routes from user's country
        const geoRoutes = userAirportCodes.length > 0
          ? routeData.filter((r) => userAirportCodes.includes(r.from_code))
          : [];
        const otherRoutes = routeData.filter(
          (r) => !userAirportCodes.includes(r.from_code)
        );

        const sortedRoutes = [...geoRoutes, ...otherRoutes];

        // Deduplicate by destination
        const seenDest = new Set<string>();
        for (const r of sortedRoutes) {
          if (seenDest.has(r.to_code)) continue;
          seenDest.add(r.to_code);

          const destCity = r.to_city || airports.find((a) => a.code === r.to_code)?.city || r.to_code;

          result.push({
            type: "flight",
            destination: destCity,
            destinationCode: r.to_code,
            originCode: r.from_code,
            price: r.lowest_price || 0,
            currency: r.currency || "USD",
            airline: r.airline || undefined,
            airlineLogo: r.airline ? getAirlineLogo(r.airline) : undefined,
            link: `/flights?from=${r.from_code}&to=${r.to_code}&date=${new Date().toISOString().split("T")[0]}&adults=1&tripType=one-way`,
            image: DEST_IMAGES[r.to_code] || DEFAULT_IMAGE,
          });

          if (result.length >= 6) break;
        }
      }

      setDeals(result);
      setLoading(false);
    };

    fetchDeals();
  }, []);

  if (loading) {
    return (
      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[200px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (deals.length === 0) return null;

  return (
    <section className="py-12 sm:py-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background via-accent/[0.02] to-background" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between mb-8 sm:mb-10"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-3">
              <TrendingDown className="w-3 h-3" />
              {(content.deals as any)?.badge || "Price Drops"}
            </span>
            {(content.deals as any)?.heading ? (
              <h2
                className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String((content.deals as any).heading)) }}
              />
            ) : (
              <h2
                className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Best Deals <span className="text-accent">This Week</span>
              </h2>
            )}
            <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">
              {(content.deals as any)?.subtitle || "Handpicked deals updated daily — grab them before they're gone."}
            </p>
          </div>
          <Link
            to="/flights"
            className="hidden md:flex items-center gap-1.5 text-accent font-semibold text-sm hover:gap-2.5 transition-all group"
          >
            See All <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>

        {/* Deal cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal, i) => (
            <motion.div
              key={`${deal.destinationCode}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <Link
                to={deal.link}
                className="group block rounded-2xl overflow-hidden border border-border/50 bg-card hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image */}
                <div className="relative h-[140px] sm:h-[160px] overflow-hidden">
                  <img
                    src={deal.image}
                    alt={deal.destination}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                  {/* Price tag */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <div className="bg-accent text-accent-foreground text-sm sm:text-base font-extrabold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      from {formatPrice(deal.price, "travelvela")}
                    </div>
                  </div>

                  {/* Type badge */}
                  <div className="absolute top-3 left-3">
                    <div className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
                      {deal.type === "flight" ? <Plane className="w-3 h-3" /> : <Hotel className="w-3 h-3" />}
                      {deal.type === "flight" ? "Flight" : "Hotel"}
                    </div>
                  </div>

                  {/* Airline logo */}
                  {deal.airlineLogo && (
                    <div className="absolute top-3 right-3">
                      <img
                        src={deal.airlineLogo}
                        alt="airline"
                        className="w-7 h-7 rounded-md bg-white p-0.5 border border-white/20 shadow-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm sm:text-base font-bold text-foreground group-hover:text-accent transition-colors">
                      {deal.destination}
                    </p>
                    {deal.originCode && deal.destinationCode && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {deal.originCode} → {deal.destinationCode}
                        {deal.airline && AIRLINE_NAMES[deal.airline] && (
                          <span className="ml-1.5">• {AIRLINE_NAMES[deal.airline]}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
                    "bg-muted/50 text-muted-foreground/50 group-hover:bg-accent group-hover:text-accent-foreground group-hover:scale-110"
                  )}>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-6 text-center md:hidden">
          <Link
            to="/flights"
            className="inline-flex items-center gap-1.5 text-accent font-semibold text-sm"
          >
            See All Deals <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DealsSection;
