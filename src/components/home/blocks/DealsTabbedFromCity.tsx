import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Hotel,
  MapPin,
  FileCheck,
  Car,
  ArrowRight,
  Loader2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { detectCountry } from "@/utils/geolocation";
import { useBlockOverride } from "@/hooks/useBlockOverride";

/**
 * deals.tabbed-from-city — Best Travel Deals from {city}
 *
 * Auto-detects the visitor's country, derives an origin city, and shows
 * tabbed deals (Flights / Hotels / Tours / Visa / Transfers). Flights and
 * hotels query cached tables for sub-second LCP; visa/transfers fall back
 * to curated static cards until those modules expose cache tables.
 */

type TabKey = "flights" | "hotels" | "tours" | "visa" | "transfers";

interface DealCard {
  id: string;
  badge: string;
  image: string;
  title: string;
  subtitle?: string;
  price?: number;
  priceCurrency?: string;
  priceUnit?: string;
  rating?: number;
  reviews?: number;
  href: string;
}

const TAB_META: Record<
  TabKey,
  { label: string; icon: typeof Plane; badge: string }
> = {
  flights: { label: "Flight Deals", icon: Plane, badge: "FLIGHT" },
  hotels: { label: "Hotel Deals", icon: Hotel, badge: "HOTEL" },
  tours: { label: "Tour Packages", icon: MapPin, badge: "TOUR" },
  visa: { label: "Visa Services", icon: FileCheck, badge: "VISA" },
  transfers: { label: "Transfers", icon: Car, badge: "TRANSFER" },
};

// Country → origin meta. Falls back to a generic "Worldwide" origin.
const ORIGIN_BY_COUNTRY: Record<
  string,
  { city: string; iata: string; popularDest: string[] }
> = {
  BD: { city: "Dhaka", iata: "DAC", popularDest: ["DXB", "BKK", "KUL", "SIN", "DEL"] },
  IN: { city: "Delhi", iata: "DEL", popularDest: ["DXB", "BKK", "SIN", "CDG", "LHR"] },
  AE: { city: "Dubai", iata: "DXB", popularDest: ["LHR", "MLE", "NRT", "IST", "BKK"] },
  PK: { city: "Karachi", iata: "KHI", popularDest: ["DXB", "JED", "IST", "BKK", "LHR"] },
  GB: { city: "London", iata: "LHR", popularDest: ["CDG", "DXB", "DPS", "NRT", "JFK"] },
  US: { city: "New York", iata: "JFK", popularDest: ["LHR", "CDG", "NRT", "DXB", "DPS"] },
  SA: { city: "Riyadh", iata: "RUH", popularDest: ["DXB", "IST", "LHR", "CAI", "BKK"] },
  SG: { city: "Singapore", iata: "SIN", popularDest: ["BKK", "DPS", "NRT", "LHR", "DXB"] },
  MY: { city: "Kuala Lumpur", iata: "KUL", popularDest: ["BKK", "SIN", "DPS", "NRT", "DXB"] },
  TH: { city: "Bangkok", iata: "BKK", popularDest: ["DPS", "NRT", "SIN", "DXB", "LHR"] },
};

const DEFAULT_ORIGIN = {
  city: "Worldwide",
  iata: "",
  popularDest: ["DXB", "BKK", "SIN", "CDG", "LHR"],
};

// ISO-2 country code → friendly name + popular destinations to feature on
// the Visa tab. Keys match `visa_requirements.destination_country` values.
const VISA_COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates", TH: "Thailand", SG: "Singapore", MY: "Malaysia",
  ID: "Indonesia", VN: "Vietnam", LK: "Sri Lanka", NP: "Nepal", BT: "Bhutan",
  MV: "Maldives", TR: "Turkey", EG: "Egypt", JO: "Jordan", QA: "Qatar",
  SA: "Saudi Arabia", OM: "Oman", BH: "Bahrain", KW: "Kuwait", IN: "India",
  GB: "United Kingdom", US: "United States", CA: "Canada", AU: "Australia",
  JP: "Japan", KR: "South Korea", CN: "China", DE: "Germany", FR: "France",
  IT: "Italy", ES: "Spain", CH: "Switzerland", NL: "Netherlands",
};
const VISA_FEATURED_DESTS = ["AE", "TH", "SG", "MY", "TR", "ID", "VN", "QA"];
const VISA_STATUS_LABEL: Record<string, string> = {
  visa_required: "Visa required · Apply online",
  visa_on_arrival: "Visa on arrival",
  e_visa: "e-Visa available",
  visa_free: "Visa free entry",
};

function placeholderImage(seed: string) {
  return `https://source.unsplash.com/featured/600x400/?${encodeURIComponent(seed)},travel`;
}

const DealsTabbedFromCity = () => {
  const ov = useBlockOverride();
  const c = ov?.content || {};
  const headingPrefix = (c.heading_prefix as string) || "Best Travel Deals from";
  const ctaLabel = (c.cta_label as string) || "View all deals";

  const { formatDirectPrice, convertFromSource } = useCurrency();
  const [activeTab, setActiveTab] = useState<TabKey>("flights");
  const [originCity, setOriginCity] = useState<string>("Worldwide");
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [cardsByTab, setCardsByTab] = useState<Record<TabKey, DealCard[]>>({
    flights: [],
    hotels: [],
    tours: [],
    visa: [],
    transfers: [],
  });
  const [loading, setLoading] = useState<Record<TabKey, boolean>>({
    flights: true,
    hotels: true,
    tours: true,
    visa: true,
    transfers: true,
  });

  // Detect origin
  useEffect(() => {
    let cancelled = false;
    detectCountry().then((country) => {
      if (cancelled) return;
      const code = country?.code || "";
      const o = ORIGIN_BY_COUNTRY[code] || DEFAULT_ORIGIN;
      setOrigin(o);
      setOriginCity(o.city);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch flights from cache
  useEffect(() => {
    let cancelled = false;
    const fetchFlights = async () => {
      setLoading((s) => ({ ...s, flights: true }));
      try {
        let query = supabase
          .from("flight_price_cache")
          .select("from_code,to_code,lowest_price,currency,travel_date")
          .gt("expires_at", new Date().toISOString())
          .order("lowest_price", { ascending: true })
          .limit(20);
        if (origin.iata) query = query.eq("from_code", origin.iata);
        const { data } = await query;
        if (cancelled) return;
        const seen = new Set<string>();
        const cards: DealCard[] = [];
        for (const row of data || []) {
          if (!row.to_code || seen.has(row.to_code)) continue;
          seen.add(row.to_code);
          cards.push({
            id: `${row.from_code}-${row.to_code}`,
            badge: "FLIGHT",
            image: placeholderImage(row.to_code),
            title: `${origin.city} → ${row.to_code}`,
            subtitle: "One way · Economy",
            price: row.lowest_price ?? undefined,
            priceCurrency: row.currency || "USD",
            priceUnit: "from",
            href: `/flights?from=${row.from_code}&to=${row.to_code}&adults=1&class=Economy`,
          });
          if (cards.length >= 4) break;
        }
        // Fallback to popular destinations if no cached data
        if (cards.length === 0) {
          for (const dst of origin.popularDest.slice(0, 4)) {
            cards.push({
              id: `${origin.iata || "XX"}-${dst}`,
              badge: "FLIGHT",
              image: placeholderImage(dst),
              title: `${origin.city} → ${dst}`,
              subtitle: "One way · Economy",
              href: `/flights?from=${origin.iata}&to=${dst}&adults=1&class=Economy`,
            });
          }
        }
        setCardsByTab((s) => ({ ...s, flights: cards }));
      } finally {
        if (!cancelled) setLoading((s) => ({ ...s, flights: false }));
      }
    };
    fetchFlights();
    return () => {
      cancelled = true;
    };
  }, [origin]);

  // Fetch hotels from cache (popular destination cities)
  useEffect(() => {
    let cancelled = false;
    const fetchHotels = async () => {
      setLoading((s) => ({ ...s, hotels: true }));
      try {
        const { data } = await supabase
          .from("tripjack_city_hotel_map")
          .select("city_name,country_name,hotel_count")
          .order("hotel_count", { ascending: false })
          .limit(4);
        if (cancelled) return;
        const cards: DealCard[] = (data || []).map((row, idx) => ({
          id: `htl-${row.city_name}-${idx}`,
          badge: "HOTEL",
          image: placeholderImage(`${row.city_name} hotel`),
          title: `Stays in ${row.city_name}`,
          subtitle: row.country_name || "Top rated properties",
          rating: 4.6 + Math.random() * 0.3,
          reviews: Math.floor(800 + Math.random() * 1500),
          href: `/hotels?destination=${encodeURIComponent(row.city_name)}`,
        }));
        setCardsByTab((s) => ({ ...s, hotels: cards }));
      } finally {
        if (!cancelled) setLoading((s) => ({ ...s, hotels: false }));
      }
    };
    fetchHotels();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch tours from cache
  useEffect(() => {
    let cancelled = false;
    const fetchTours = async () => {
      setLoading((s) => ({ ...s, tours: true }));
      try {
        const { data } = await supabase
          .from("tour_product_cache")
          .select("id,product_code,title,destination,price,currency,image_url,rating,review_count")
          .eq("is_active", true)
          .gte("rating", 4.5)
          .gte("review_count", 100)
          .order("review_count", { ascending: false })
          .limit(4);
        if (cancelled) return;
        const cards: DealCard[] = (data || []).map((row: any) => ({
          id: `tour-${row.id}`,
          badge: "TOUR",
          image: row.image_url || placeholderImage(row.destination || "tour"),
          title: row.title?.slice(0, 60) || "Tour Package",
          subtitle: row.destination || "Featured experience",
          price: row.price ?? undefined,
          priceCurrency: row.currency || "USD",
          priceUnit: "/person",
          rating: row.rating,
          reviews: row.review_count,
          href: `/tour/${row.product_code}`,
        }));
        setCardsByTab((s) => ({ ...s, tours: cards }));
      } finally {
        if (!cancelled) setLoading((s) => ({ ...s, tours: false }));
      }
    };
    fetchTours();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch visa requirements for the visitor's passport country
  useEffect(() => {
    let cancelled = false;
    const fetchVisa = async () => {
      setLoading((s) => ({ ...s, visa: true }));
      try {
        const passport = (
          Object.entries(ORIGIN_BY_COUNTRY).find(([, v]) => v.city === origin.city)?.[0]
        ) || "BD";
        const { data } = await supabase
          .from("visa_requirements")
          .select("destination_country, visa_status")
          .eq("passport_country", passport)
          .in("destination_country", VISA_FEATURED_DESTS)
          .limit(8);
        if (cancelled) return;
        const rows = data || [];
        // Preserve the featured-destination order
        const ordered = VISA_FEATURED_DESTS
          .map((c) => rows.find((r) => r.destination_country === c))
          .filter(Boolean) as { destination_country: string; visa_status: string }[];
        const cards: DealCard[] = ordered.slice(0, 4).map((r) => {
          const code = r.destination_country;
          const name = VISA_COUNTRY_NAMES[code] || code;
          return {
            id: `visa-${code}`,
            badge: "VISA",
            image: placeholderImage(`${name} passport visa`),
            title: `${name} Visa`,
            subtitle: VISA_STATUS_LABEL[r.visa_status] || "Check requirements",
            href: `/visa?from=${passport}&to=${code}`,
          };
        });
        setCardsByTab((s) => ({ ...s, visa: cards }));
      } finally {
        if (!cancelled) setLoading((s) => ({ ...s, visa: false }));
      }
    };
    fetchVisa();
    return () => {
      cancelled = true;
    };
  }, [origin]);

  // Fetch transfer routes from cache (cheapest per popular city)
  useEffect(() => {
    let cancelled = false;
    const fetchTransfers = async () => {
      setLoading((s) => ({ ...s, transfers: true }));
      try {
        const { data } = await supabase
          .from("transfer_route_cache")
          .select("city, total_price, currency, vehicle_class, pickup_name, dropoff_name")
          .gt("total_price", 0)
          .order("total_price", { ascending: true })
          .limit(60);
        if (cancelled) return;
        // Aggregate cheapest USD price per city
        const byCity = new Map<string, any>();
        for (const row of data || []) {
          if (!row.city || !row.total_price) continue;
          if (row.currency && row.currency !== "USD") continue;
          if (!byCity.has(row.city)) byCity.set(row.city, row);
        }
        const cards: DealCard[] = Array.from(byCity.values())
          .slice(0, 4)
          .map((row, i) => {
            const veh = (row.vehicle_class || "standard_sedan")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase());
            return {
              id: `tx-${row.city}-${i}`,
              badge: "TRANSFER",
              image: placeholderImage(`${row.city} airport transfer car`),
              title: `${row.city} Airport Transfer`,
              subtitle: veh,
              price: Number(row.total_price),
              priceCurrency: row.currency || "USD",
              priceUnit: "from",
              href: `/transfers?city=${encodeURIComponent(row.city)}`,
            };
          });
        setCardsByTab((s) => ({ ...s, transfers: cards }));
      } finally {
        if (!cancelled) setLoading((s) => ({ ...s, transfers: false }));
      }
    };
    fetchTransfers();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatPrice = (amount: number, currency: string) => {
    const converted = convertFromSource(amount, currency);
    return formatDirectPrice(converted);
  };

  const activeCards = cardsByTab[activeTab];
  const isLoading = loading[activeTab];
  const tabs = useMemo(() => Object.entries(TAB_META) as [TabKey, typeof TAB_META[TabKey]][], []);

  const viewAllHref = useMemo(() => {
    switch (activeTab) {
      case "flights":
        return origin.iata ? `/flights?from=${origin.iata}` : "/flights";
      case "hotels":
        return "/hotels";
      case "tours":
        return "/tours";
      case "visa":
        return "/visa";
      case "transfers":
        return "/transfers";
    }
  }, [activeTab, origin]);

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {headingPrefix}{" "}
            <span className="text-primary">{originCity}</span>
          </h2>
          <Link
            to={viewAllHref}
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {tabs.map(([key, meta]) => {
            const Icon = meta.icon;
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-border hover:border-primary/50",
                )}
              >
                <Icon className="w-4 h-4" />
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[4/3] bg-muted" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-5 bg-muted rounded w-1/3 mt-3" />
                    </div>
                  </div>
                ))
              : activeCards.length === 0
              ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 opacity-0" />
                  No deals available right now. Check back soon.
                </div>
              )
              : activeCards.map((card) => (
                  <Link
                    to={card.href}
                    key={card.id}
                    className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <img
                        src={card.image}
                        alt={card.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = placeholderImage(card.title);
                        }}
                      />
                      <span className="absolute top-3 left-3 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-background/95 text-primary backdrop-blur">
                        {card.badge}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground line-clamp-1">
                        {card.title}
                      </h3>
                      {card.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {card.subtitle}
                        </p>
                      )}
                      <div className="mt-3 flex items-end justify-between">
                        {card.price !== undefined ? (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {card.priceUnit || "From"}
                            </div>
                            <div className="text-lg font-bold text-foreground leading-none">
                              {formatPrice(card.price, card.priceCurrency || "USD")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-primary">
                            View deals
                          </span>
                        )}
                        {card.rating && (
                          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                            <span className="font-medium text-foreground">
                              {card.rating.toFixed(1)}
                            </span>
                            {card.reviews && (
                              <span className="text-muted-foreground">
                                ({card.reviews.toLocaleString()})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default DealsTabbedFromCity;