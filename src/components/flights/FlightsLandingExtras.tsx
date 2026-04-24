import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plane, BadgeDollarSign, Sparkles, ArrowRight, Star, TrendingUp, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getOriginAirports, getFlightFallbacks } from "@/data/geoDestinationMap";

interface PopularDestination {
  city: string;
  country: string;
  iata: string;
  image: string;
  /** Lowest price displayed in user's currency (rounded) */
  priceDisplay: number;
  /** Origin IATA used for this price (for the search link) */
  fromCode: string;
  /** Composite popularity score for sorting */
  score: number;
  /** True when price came from cached real searches */
  isLive: boolean;
}

/** Curated catalogue of well-known destinations with high-quality imagery.
 *  Selection is dynamic — we only render the cards that have real or
 *  geo-appropriate prices from the user's origin. */
const DESTINATION_CATALOG: Array<{ city: string; country: string; iata: string; image: string }> = [
  { city: "Dubai", country: "UAE", iata: "DXB", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80" },
  { city: "Bangkok", country: "Thailand", iata: "BKK", image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&q=80" },
  { city: "Singapore", country: "Singapore", iata: "SIN", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80" },
  { city: "Kuala Lumpur", country: "Malaysia", iata: "KUL", image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&q=80" },
  { city: "Bali", country: "Indonesia", iata: "DPS", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80" },
  { city: "London", country: "United Kingdom", iata: "LHR", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80" },
  { city: "New York", country: "United States", iata: "JFK", image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80" },
  { city: "Paris", country: "France", iata: "CDG", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80" },
  { city: "Istanbul", country: "Turkey", iata: "IST", image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&q=80" },
  { city: "Tokyo", country: "Japan", iata: "NRT", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80" },
  { city: "Maldives", country: "Maldives", iata: "MLE", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80" },
  { city: "Kathmandu", country: "Nepal", iata: "KTM", image: "https://images.unsplash.com/photo-1558799401-1dcba79834c2?w=600&q=80" },
  { city: "Colombo", country: "Sri Lanka", iata: "CMB", image: "https://images.unsplash.com/photo-1586016413664-864c0dd76f53?w=600&q=80" },
  { city: "Phuket", country: "Thailand", iata: "HKT", image: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=600&q=80" },
  { city: "Seoul", country: "South Korea", iata: "ICN", image: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=600&q=80" },
];

/** Round display price to a clean figure */
const smartRound = (n: number): number => {
  if (n <= 0) return 0;
  if (n < 100) return Math.round(n / 5) * 5 || 5;
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
};

const FEATURES = [
  {
    Icon: Plane,
    title: "500+ Airlines",
    sub: "Global coverage",
    iconClass: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    Icon: BadgeDollarSign,
    title: "Best Price",
    sub: "Guaranteed savings",
    iconClass: "text-warning0",
    iconBg: "bg-warning/50/10",
  },
  {
    Icon: Sparkles,
    title: "Inspiring Results",
    sub: "Find unique destinations",
    iconClass: "text-accent",
    iconBg: "bg-accent/10",
  },
] as const;

/**
 * Hero band sits BEHIND the search card (no children — search card is rendered
 * above by the parent). Includes the world-map fade + headline + 3 feature cards.
 */
export const FlightsHeroBackdrop = ({ heroImage }: { heroImage: string }) => (
  <div aria-hidden className="absolute inset-x-0 top-0 h-[680px] sm:h-[780px] -z-0 overflow-hidden pointer-events-none">
    {/* Image */}
    <img
      src={heroImage}
      alt=""
      width={1920}
      height={1080}
      className="absolute inset-0 w-full h-full object-cover scale-105"
    />
    {/* Cool blue tint — desaturate warm sunset tones so the white card pops */}
    <div className="absolute inset-0 bg-[hsl(220,55%,16%)]/35 mix-blend-multiply" />
    <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,60%,14%)]/70 via-[hsl(220,55%,18%)]/45 to-background" />
    {/* Soft top vignette for headline readability */}
    <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[hsl(220,60%,12%)]/40 to-transparent" />
    {/* Subtle radial highlight behind headline */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_25%,_hsl(0_0%_100%/0.10),_transparent_70%)]" />
    {/* Long bottom fade into page bg for seamless transition under the card */}
    <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent via-background/70 to-background" />
  </div>
);

export const FlightsWhereToNext = () => (
  <section className="relative container mx-auto px-4 mt-10 sm:mt-14">
    <div className="text-center max-w-2xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        Where to next?
      </h2>
      <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        Enter your origin, dream destination, and travel dates to discover the best
        routes and deals on flights worldwide.
      </p>
    </div>

    <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
      {FEATURES.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-card/80 backdrop-blur-md border border-border/40 shadow-[0_4px_20px_-12px_hsl(var(--primary)/0.25)] hover:shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.35)] hover:-translate-y-0.5 transition-all"
        >
          <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center flex-shrink-0`}>
            <f.Icon className={`w-5 h-5 ${f.iconClass}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">{f.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.sub}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);

export const PopularFlightDestinations = () => {
  const { currency, convertPrice, convertFromSource, formatDirectPrice, liveRates } = useCurrency();
  const [routePrices, setRoutePrices] = useState<Record<string, { price: number; currency: string; fromCode: string; searchCount: number }>>({});
  const [userCountryCode, setUserCountryCode] = useState<string>("DEFAULT");
  const [originIata, setOriginIata] = useState<string>("");
  const [originCity, setOriginCity] = useState<string>("");

  // Detect origin & load real cached prices for that origin
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { detectCountryCode } = await import("@/utils/geolocation");
      const cc = await detectCountryCode();
      if (cancelled) return;
      setUserCountryCode(cc);

      const originCodes = getOriginAirports(cc);
      const primary = originCodes[0] || "";
      setOriginIata(primary);

      // Resolve origin city label (best-effort)
      if (primary) {
        const { data: ap } = await (supabase as any)
          .from("airports")
          .select("city")
          .eq("iata_code", primary)
          .limit(1)
          .maybeSingle();
        if (!cancelled && ap?.city) setOriginCity(ap.city);
      }

      const toCodes = DESTINATION_CATALOG.map((d) => d.iata);
      const { data } = await (supabase as any)
        .from("popular_routes")
        .select("from_code,to_code,lowest_price,currency,search_count")
        .gt("lowest_price", 0)
        .in("from_code", originCodes)
        .in("to_code", toCodes);

      if (!cancelled && data?.length) {
        // For each destination, pick the lowest-priced row from the user's origin set
        const map: Record<string, { price: number; currency: string; fromCode: string; searchCount: number }> = {};
        for (const row of data) {
          const existing = map[row.to_code];
          if (!existing || row.lowest_price < existing.price) {
            map[row.to_code] = {
              price: Number(row.lowest_price),
              currency: row.currency || "USD",
              fromCode: row.from_code,
              searchCount: Number(row.search_count) || 0,
            };
          }
        }
        setRoutePrices(map);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build dynamic destination list ranked by popularity (search_count + price-attractiveness)
  const destinations = useMemo<PopularDestination[]>(() => {
    const fallbacks = getFlightFallbacks(userCountryCode);

    const enriched = DESTINATION_CATALOG
      // Hide the user's own origin city
      .filter((d) => d.iata !== originIata)
      .map((d) => {
        const live = routePrices[d.iata];
        let priceDisplay = 0;
        let isLive = false;
        let score = 0;
        let fromCode = originIata;

        if (live) {
          priceDisplay = smartRound(convertFromSource(live.price, live.currency));
          isLive = true;
          score = live.searchCount + 1000; // live data ranks above fallback
          fromCode = live.fromCode;
        } else {
          const usd = fallbacks[d.iata] ?? 0;
          if (usd > 0) {
            priceDisplay = smartRound(convertPrice(usd));
            score = 500 - usd; // cheaper fallbacks rank slightly higher
          }
        }

        if (priceDisplay <= 0) return null;
        return { ...d, priceDisplay, isLive, score, fromCode };
      })
      .filter((x): x is PopularDestination => x !== null);

    // Sort: highest popularity first
    enriched.sort((a, b) => b.score - a.score);
    return enriched.slice(0, 8);
  }, [routePrices, userCountryCode, originIata, currency, liveRates, convertPrice, convertFromSource]);

  if (!destinations.length) return null;

  const subhead = originCity
    ? `Lowest fares from ${originCity} (${originIata}) — updated continuously`
    : "Real fares ranked by traveller demand";

  return (
    <section className="relative container mx-auto px-4 mt-12 sm:mt-16 mb-10">
      <div className="text-center mb-7 sm:mb-9 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wider mb-3">
          <TrendingUp className="w-3 h-3" />
          Trending now
        </div>
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          Popular Destinations
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{subhead}</p>
      </div>

      {/* Horizontal scroller on small screens, grid on large */}
      <div className="flex lg:grid lg:grid-cols-4 gap-3 sm:gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory scrollbar-hide">
        {destinations.map((d, i) => (
          <motion.div
            key={d.iata}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ delay: i * 0.05 }}
            className="snap-start flex-shrink-0 w-[68%] sm:w-[42%] md:w-[32%] lg:w-auto"
          >
            <Link
              to={`/flights?from=${encodeURIComponent(d.fromCode)}&to=${encodeURIComponent(d.iata)}`}
              className="group relative block rounded-2xl overflow-hidden h-[280px] sm:h-[300px] shadow-lg shadow-primary/[0.08] hover:shadow-xl hover:shadow-primary/[0.18] transition-all"
            >
              <img
                src={d.image}
                alt={`Flights to ${d.city}, ${d.country}`}
                width={400}
                height={500}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              {/* Bottom dark gradient for legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

              {/* Top: live/cached badge */}
              {d.isLive && (
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-success/50/95 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Live fare
                </div>
              )}

              {/* Bottom content */}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="flex items-center gap-1 text-[11px] text-white/75 font-medium mb-1">
                  <MapPin className="w-3 h-3" />
                  <span>{d.country}</span>
                  <span className="text-white/40">·</span>
                  <span className="font-mono text-white/60">{d.iata}</span>
                </div>
                <h3 className="text-white text-2xl font-extrabold leading-none tracking-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {d.city}
                </h3>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-white/60 uppercase tracking-wider">From</p>
                    <p className="text-white text-xl font-extrabold leading-tight">
                      {formatDirectPrice(d.priceDisplay)}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center group-hover:bg-white group-hover:text-foreground transition-all">
                    <ArrowRight className="w-4 h-4 text-white group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

