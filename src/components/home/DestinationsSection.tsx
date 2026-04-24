import { useState, useEffect } from "react";
import { Star, ArrowRight, MapPin, Plane, Hotel } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { destinations as fallbackDestinations } from "@/data/mockData";
import { getImage } from "@/utils/images";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { detectCountry } from "@/utils/geolocation";
import { useSiteContent } from "@/hooks/useSiteContent";
import DOMPurify from "dompurify";

interface Destination {
  id: string | number;
  name: string;
  country: string;
  image: string | null;
  price: number;
  rating: number;
  flights: number;
}

interface HotelCity {
  id: string;
  city: string;
  country: string;
  image: string;
  avgPrice: string;
  hotelCount: string;
}

// Geo-prioritized hotel destination pools — now from centralized map
import { getHotelDests } from "@/data/geoDestinationMap";

const HOTEL_DESTS_DEFAULT = getHotelDests("");

type TabType = "flights" | "stays";

const DestinationsSection = () => {
  const { content } = useSiteContent();
  const cfg = content.destinations || {};
  const [activeTab, setActiveTab] = useState<TabType>("flights");
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>(fallbackDestinations as any);
  const [hotelDests, setHotelDests] = useState<HotelCity[]>(HOTEL_DESTS_DEFAULT);
  const { tenant } = useTenant();

  // Tenant-specific destination images (set by AI generator on Custom Websites).
  // When present, this REPLACES the destination cards entirely so each tenant
  // shows brand-aligned cities + photos instead of the platform defaults.
  const tenantDestImages = Array.isArray((cfg as any).destination_images)
    ? ((cfg as any).destination_images as Array<{ name: string; country?: string; image: string; tagline?: string }>)
    : [];

  useEffect(() => {
    const fetchDestinations = async () => {
      // If the tenant supplied its own destination set, use it verbatim and
      // skip the platform DB fetch — this is what makes each tenant unique.
      if (tenantDestImages.length > 0) {
        setDestinations(tenantDestImages.map((d, i) => {
          const [city, country] = d.name.split(",").map((s) => s.trim());
          return {
            id: `tenant-${i}`,
            name: city || d.name,
            country: d.country || country || "",
            image: d.image,
            price: 0,
            rating: 4.8,
            flights: 0,
          };
        }));
        return;
      }

      let query = (supabase as any)
        .from("destinations")
        .select("id,name,country,image_url,price,rating,flights")
        .eq("is_active", true)
        .order("sort_order")
        .limit(6);

      if (tenant) {
        query = query.or(`tenant_id.eq.${tenant.id},tenant_id.is.null`);
      } else {
        query = query.is("tenant_id", null);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        setDestinations(data.map((d: any) => ({
          id: d.id,
          name: d.name,
          country: d.country,
          image: d.image_url,
          price: d.price,
          rating: d.rating,
          flights: d.flights,
        })));
      }
    };
    fetchDestinations();
  }, [tenant, tenantDestImages.length]);

  // Geo-aware hotel destinations
  useEffect(() => {
    detectCountry().then(country => {
      const pool = getHotelDests(country.code);
      setHotelDests(pool);
    });
  }, []);

  if (destinations.length === 0) return null;

  return (
    <section className="py-12 sm:py-24 bg-background overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-12"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-3">
              <MapPin className="w-3 h-3" />
              {cfg.badge || "Explore the World"}
            </span>
            {cfg.heading ? (
              <h2
                className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(cfg.heading)) }}
              />
            ) : (
              <h2
                className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Popular <span className="text-accent">Destinations</span>
              </h2>
            )}
            {cfg.subtitle && (
              <p className="text-muted-foreground text-xs sm:text-sm mt-2 max-w-md">{cfg.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Tab toggle */}
            <div className="flex items-center rounded-full bg-muted/60 p-1 border border-border/40">
              <button
                onClick={() => setActiveTab("flights")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300",
                  activeTab === "flights"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Plane className="w-3 h-3" /> Flights
              </button>
              <button
                onClick={() => setActiveTab("stays")}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300",
                  activeTab === "stays"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Hotel className="w-3 h-3" /> Stays
              </button>
            </div>
            <Link to={activeTab === "flights" ? "/tours" : "/hotels"} className="hidden md:flex items-center gap-1 text-primary font-semibold text-sm hover:gap-2 transition-all">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Flights grid */}
        {activeTab === "flights" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-3 sm:gap-4 auto-rows-[200px] sm:auto-rows-[240px] lg:auto-rows-[210px]">
            {destinations[0] && (
              <DestCard
                dest={destinations[0]}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                className="col-span-2 md:col-span-2 lg:col-span-7 row-span-2"
                featured
                index={0}
              />
            )}
            {destinations[1] && (
              <DestCard
                dest={destinations[1]}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                className="col-span-1 md:col-span-1 lg:col-span-5 row-span-2"
                index={1}
              />
            )}
            {destinations.slice(2, 5).map((dest, i) => (
              <DestCard
                key={dest.id}
                dest={dest}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                className="col-span-1 lg:col-span-4"
                index={i + 2}
              />
            ))}
          </div>
        )}

        {/* Stays grid — bento layout matching flights */}
        {activeTab === "stays" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-3 sm:gap-4 auto-rows-[200px] sm:auto-rows-[240px] lg:auto-rows-[210px]">
            {hotelDests[0] && (
              <HotelDestCard
                dest={hotelDests[0]}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                className="col-span-2 md:col-span-2 lg:col-span-7 row-span-2"
                index={0}
                featured
              />
            )}
            {hotelDests[1] && (
              <HotelDestCard
                dest={hotelDests[1]}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                className="col-span-1 md:col-span-1 lg:col-span-5 row-span-2"
                index={1}
              />
            )}
            {hotelDests.slice(2, 5).map((dest, i) => (
              <HotelDestCard
                key={dest.id}
                dest={dest}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                className="col-span-1 lg:col-span-4"
                index={i + 2}
              />
            ))}
          </div>
        )}

        {/* Mobile "View All" */}
        <div className="mt-6 sm:mt-8 text-center md:hidden">
          <Link to={activeTab === "flights" ? "/tours" : "/hotels"} className="inline-flex items-center gap-1 text-primary font-semibold text-xs sm:text-sm">
            View All Destinations <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

interface DestCardProps {
  dest: Destination;
  hoveredId: string | number | null;
  setHoveredId: (id: string | number | null) => void;
  className?: string;
  featured?: boolean;
  index: number;
}

const DestCard = ({ dest, hoveredId, setHoveredId, className, featured, index }: DestCardProps) => {
  const isHovered = hoveredId === dest.id;
  const imgSrc = dest.image?.startsWith("http") ? dest.image : getImage(dest.image || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ delay: index * 0.08 }}
      className={cn("h-full", className)}
    >
      <Link
        to="/tours"
        className="group relative block rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer h-full"
        onMouseEnter={() => setHoveredId(dest.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <img
          src={imgSrc}
          alt={dest.name}
          width={640}
          height={400}
          className={cn(
            "w-full h-full object-cover transition-all duration-[800ms] ease-out",
            isHovered ? "scale-110 brightness-110" : "scale-100 brightness-100"
          )}
          loading="lazy"
        />

        <div className={cn(
          "absolute inset-0 transition-all duration-500",
          isHovered
            ? "bg-gradient-to-t from-[hsl(222,45%,8%/0.85)] via-[hsl(222,45%,10%/0.35)] to-[hsl(222,45%,10%/0.1)]"
            : "bg-gradient-to-t from-[hsl(222,45%,8%/0.75)] via-[hsl(222,45%,10%/0.08)] to-transparent"
        )} />

        {/* Top pills */}
        <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-4 sm:right-4 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-card/95 backdrop-blur-sm rounded-full px-2.5 py-1 text-[9px] sm:text-[11px] font-bold text-foreground shadow-lg">
            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-accent text-accent" />
            {dest.rating}
          </div>
          {featured && (
            <div className="hidden sm:flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-[10px] font-bold shadow-lg uppercase tracking-wider">
              <Plane className="w-3 h-3" />
              {dest.flights} flights
            </div>
          )}
        </div>

        {/* Bottom content */}
        <div className={cn("absolute bottom-0 inset-x-0", featured ? "p-4 sm:p-6 lg:p-8" : "p-3 sm:p-5")}>
          <span className={cn(
            "inline-block text-accent font-bold uppercase tracking-widest mb-1",
            featured ? "text-[9px] sm:text-[11px]" : "text-[8px] sm:text-[10px]"
          )}>
            {dest.country}
          </span>

          <h3 className={cn(
            "font-extrabold text-primary-foreground leading-tight",
            featured ? "text-xl sm:text-3xl lg:text-4xl" : "text-sm sm:text-lg lg:text-xl"
          )}>
            {dest.name}
          </h3>

          <div className={cn(
            "flex items-center gap-3",
            featured ? "mt-2 sm:mt-3" : "mt-1"
          )}>
            <div className="flex items-baseline gap-1">
              <span className="text-primary-foreground/50 text-[9px] sm:text-xs">from</span>
              <span className={cn("text-primary-foreground font-extrabold", featured ? "text-xl sm:text-3xl" : "text-sm sm:text-lg")}>${dest.price}</span>
            </div>

            <div className={cn(
              "hidden sm:flex items-center gap-1 text-accent text-xs font-bold transition-all duration-500",
              isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"
            )}>
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-primary transition-transform duration-500 origin-left",
          isHovered ? "scale-x-100" : "scale-x-0"
        )} />
      </Link>
    </motion.div>
  );
};

interface HotelDestCardProps {
  dest: HotelCity;
  hoveredId: string | number | null;
  setHoveredId: (id: string | number | null) => void;
  className?: string;
  featured?: boolean;
  index: number;
}

const HotelDestCard = ({ dest, hoveredId, setHoveredId, className, featured, index }: HotelDestCardProps) => {
  const isHovered = hoveredId === dest.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ delay: index * 0.08 }}
      className={cn("h-full", className)}
    >
      <Link
        to={`/hotels?city=${encodeURIComponent(dest.city)}`}
        className="group relative block rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer h-full"
        onMouseEnter={() => setHoveredId(dest.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <img
          src={dest.image}
          alt={`Hotels in ${dest.city}`}
          className={cn(
            "w-full h-full object-cover transition-all duration-[800ms] ease-out",
            isHovered ? "scale-110 brightness-110" : "scale-100 brightness-100"
          )}
          loading="lazy"
        />

        <div className={cn(
          "absolute inset-0 transition-all duration-500",
          isHovered
            ? "bg-gradient-to-t from-[hsl(222,45%,8%/0.85)] via-[hsl(222,45%,10%/0.35)] to-[hsl(222,45%,10%/0.1)]"
            : "bg-gradient-to-t from-[hsl(222,45%,8%/0.75)] via-[hsl(222,45%,10%/0.08)] to-transparent"
        )} />

        {/* Top pills */}
        <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-4 sm:right-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-card/95 backdrop-blur-sm rounded-full px-2.5 py-1 text-[9px] sm:text-[11px] font-bold text-foreground shadow-lg">
            <Hotel className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent" />
            {dest.hotelCount}
          </div>
          {featured && (
            <div className="hidden sm:flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-3 py-1 text-[10px] font-bold shadow-lg uppercase tracking-wider">
              <Hotel className="w-3 h-3" />
              Top Pick
            </div>
          )}
        </div>

        {/* Bottom content */}
        <div className={cn("absolute bottom-0 inset-x-0", featured ? "p-4 sm:p-6 lg:p-8" : "p-3 sm:p-5")}>
          <span className={cn(
            "inline-block text-accent font-bold uppercase tracking-widest mb-1",
            featured ? "text-[9px] sm:text-[11px]" : "text-[8px] sm:text-[10px]"
          )}>
            {dest.country}
          </span>

          <h3 className={cn(
            "font-extrabold text-primary-foreground leading-tight",
            featured ? "text-xl sm:text-3xl lg:text-4xl" : "text-sm sm:text-lg lg:text-xl"
          )}>
            {dest.city}
          </h3>

          <div className={cn(
            "flex items-center gap-3",
            featured ? "mt-2 sm:mt-3" : "mt-1"
          )}>
            <div className="flex items-baseline gap-1">
              <span className="text-primary-foreground/50 text-[9px] sm:text-xs">from</span>
              <span className={cn("text-primary-foreground font-extrabold", featured ? "text-xl sm:text-3xl" : "text-sm sm:text-lg")}>{dest.avgPrice}</span>
              <span className="text-primary-foreground/50 text-[9px] sm:text-xs">/night</span>
            </div>

            <div className={cn(
              "hidden sm:flex items-center gap-1 text-accent text-xs font-bold transition-all duration-500",
              isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3"
            )}>
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-primary transition-transform duration-500 origin-left",
          isHovered ? "scale-x-100" : "scale-x-0"
        )} />
      </Link>
    </motion.div>
  );
};

export default DestinationsSection;
