import { useState, useEffect } from "react";
import { Hotel, ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { detectCountry } from "@/utils/geolocation";

interface HotelCity {
  city: string;
  country: string;
  image: string;
  avgPrice: string;
  hotelCount: string;
}

// Geo-prioritized destination pools
const DESTINATIONS_BY_REGION: Record<string, HotelCity[]> = {
  BD: [
    { city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { city: "Singapore", country: "Singapore", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80", avgPrice: "$120", hotelCount: "1,500+" },
    { city: "Kuala Lumpur", country: "Malaysia", image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&q=80", avgPrice: "$55", hotelCount: "2,100+" },
    { city: "Kolkata", country: "India", image: "https://images.unsplash.com/photo-1558431382-27e303142255?w=600&q=80", avgPrice: "$30", hotelCount: "1,200+" },
  ],
  default: [
    { city: "Bangkok", country: "Thailand", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80", avgPrice: "$45", hotelCount: "2,400+" },
    { city: "Dubai", country: "UAE", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80", avgPrice: "$85", hotelCount: "1,800+" },
    { city: "Bali", country: "Indonesia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", avgPrice: "$35", hotelCount: "3,200+" },
    { city: "Singapore", country: "Singapore", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80", avgPrice: "$120", hotelCount: "1,500+" },
    { city: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80", avgPrice: "$150", hotelCount: "4,500+" },
    { city: "Tokyo", country: "Japan", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80", avgPrice: "$95", hotelCount: "3,800+" },
  ],
};

const HotelDestinations = () => {
  const [destinations, setDestinations] = useState<HotelCity[]>(DESTINATIONS_BY_REGION.default.slice(0, 6));
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    detectCountry().then((country) => {
      const pool = DESTINATIONS_BY_REGION[country?.code || ""] || DESTINATIONS_BY_REGION.default;
      setDestinations(pool.slice(0, 6));
    });
  }, []);

  return (
    <section className="py-12 sm:py-20 bg-muted/20 overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="flex items-end justify-between mb-8 sm:mb-12"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-3">
              <Hotel className="w-3 h-3" />
              Handpicked for You
            </span>
            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Top Hotel <span className="text-accent">Destinations</span>
            </h2>
          </div>
          <Link to="/hotels" className="hidden md:flex items-center gap-1 text-primary font-semibold text-sm hover:gap-2 transition-all">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
          {destinations.map((dest, i) => (
            <motion.div
              key={dest.city}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                to={`/hotels?city=${encodeURIComponent(dest.city)}`}
                className="group relative block rounded-2xl sm:rounded-3xl overflow-hidden h-[200px] sm:h-[260px]"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <img
                  src={dest.image}
                  alt={`Hotels in ${dest.city}`}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-700 ease-out",
                    hoveredIdx === i ? "scale-110 brightness-110" : "scale-100"
                  )}
                  loading="lazy"
                />

                <div className={cn(
                  "absolute inset-0 transition-all duration-500",
                  hoveredIdx === i
                    ? "bg-gradient-to-t from-[hsl(var(--foreground)/0.85)] via-[hsl(var(--foreground)/0.3)] to-transparent"
                    : "bg-gradient-to-t from-[hsl(var(--foreground)/0.7)] via-[hsl(var(--foreground)/0.05)] to-transparent"
                )} />

                {/* Hotel count pill */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
                  <div className="flex items-center gap-1.5 bg-card/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[9px] sm:text-[11px] font-bold text-foreground shadow-lg">
                    <Hotel className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent" />
                    {dest.hotelCount}
                  </div>
                </div>

                {/* Bottom content */}
                <div className="absolute bottom-0 inset-x-0 p-3 sm:p-5">
                  <div className="flex items-center gap-1 text-accent text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {dest.country}
                  </div>
                  <h3 className="text-lg sm:text-2xl font-extrabold text-primary-foreground leading-tight">
                    {dest.city}
                  </h3>
                  <div className="flex items-center justify-between mt-1 sm:mt-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-primary-foreground/50 text-[9px] sm:text-xs">from</span>
                      <span className="text-primary-foreground font-extrabold text-base sm:text-xl">{dest.avgPrice}</span>
                      <span className="text-primary-foreground/50 text-[9px] sm:text-xs">/night</span>
                    </div>
                    <div className={cn(
                      "hidden sm:flex items-center gap-1 text-accent text-xs font-bold transition-all duration-500",
                      hoveredIdx === i ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"
                    )}>
                      Explore Hotels <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Bottom accent line */}
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-primary transition-transform duration-500 origin-left",
                  hoveredIdx === i ? "scale-x-100" : "scale-x-0"
                )} />
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 text-center md:hidden">
          <Link to="/hotels" className="inline-flex items-center gap-1 text-primary font-semibold text-xs sm:text-sm">
            View All Destinations <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HotelDestinations;
