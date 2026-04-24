import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plane,
  Search,
  ArrowLeftRight,
  Sparkles,
  Clock,
  ShieldCheck,
  Tag,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Airport } from "@/components/home/AirportPicker";
import { toast } from "sonner";
import { useBlockOverride } from "@/hooks/useBlockOverride";
import flightsHero from "@/assets/flights-hero-bg.jpg";
import {
  FlightForm,
  formatLocalDate,
  applyStudioPreview,
} from "@/components/home/blocks/HybridHero";

/**
 * landing.flights — cinematic, single-product Flights landing block for the
 * Hybrid skin. Mirrors the HybridHero visual language (full-bleed photo,
 * floating glass search card, primary-color CTA, editorial typography) but
 * focuses entirely on flight discovery.
 *
 * All copy + imagery is overridable per tenant via block content.
 */

const DEFAULT_ROUTES = [
  { from: "DXB", to: "LON", fromCity: "Dubai", toCity: "London", price: "from $480", duration: "7h 35m" },
  { from: "SIN", to: "TYO", fromCity: "Singapore", toCity: "Tokyo", price: "from $410", duration: "6h 50m" },
  { from: "BOM", to: "DXB", fromCity: "Mumbai", toCity: "Dubai", price: "from $190", duration: "3h 10m" },
  { from: "DEL", to: "BKK", fromCity: "Delhi", toCity: "Bangkok", price: "from $260", duration: "4h 20m" },
  { from: "DXB", to: "PAR", fromCity: "Dubai", toCity: "Paris", price: "from $520", duration: "7h 45m" },
  { from: "KUL", to: "ICN", fromCity: "Kuala Lumpur", toCity: "Seoul", price: "from $390", duration: "6h 30m" },
];

const HybridFlightsLanding = () => {
  const navigate = useNavigate();
  const ov = useBlockOverride();
  const c = ov?.content || {};

  const badge = (c.badge as string) || "Take flight";
  const headline = (c.headline as string) || "Find your next sky-bound chapter.";
  const subtitle =
    (c.subtitle as string) ||
    "Search every major airline in one place. Transparent pricing, free cancellation on most fares, and a price-match promise on the rest.";
  const heroBg = (c.hero_image as string) || flightsHero;
  const popularRoutes =
    (c.popular_routes as Array<{
      from: string;
      to: string;
      fromCity?: string;
      toCity?: string;
      price?: string;
      duration?: string;
    }>) || DEFAULT_ROUTES;

  // ── Search state ──
  const [tripType, setTripType] = useState<"round-trip" | "one-way" | "multi-city">(
    "round-trip",
  );
  const [fromAirport, setFromAirport] = useState<Airport | null>(null);
  const [toAirport, setToAirport] = useState<Airport | null>(null);
  const [departDate, setDepartDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [departOpen, setDepartOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [flightClass, setFlightClass] = useState("Economy");
  const [direct, setDirect] = useState(false);
  const [paxOpen, setPaxOpen] = useState(false);
  const [multiLegs, setMultiLegs] = useState<
    { from: Airport | null; to: Airport | null; date: Date | undefined }[]
  >([
    { from: null, to: null, date: undefined },
    { from: null, to: null, date: undefined },
  ]);

  const totalTravelers = adults + children + infants;

  const updateLeg = (i: number, patch: Partial<{ from: Airport | null; to: Airport | null; date: Date | undefined }>) => {
    setMultiLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLeg = () => {
    if (multiLegs.length < 5) {
      setMultiLegs((prev) => {
        const last = prev[prev.length - 1];
        return [...prev, { from: last.to, to: null, date: undefined }];
      });
    }
  };
  const removeLeg = (i: number) => {
    if (multiLegs.length > 2) setMultiLegs((prev) => prev.filter((_, idx) => idx !== i));
  };

  const swap = () => {
    const a = fromAirport;
    setFromAirport(toAirport);
    setToAirport(a);
  };

  const handleSearch = (presetFrom?: string, presetTo?: string) => {
    const p = new URLSearchParams();
    p.set("adults", String(adults));
    if (children > 0) p.set("children", String(children));
    if (infants > 0) p.set("infants", String(infants));
    p.set("class", flightClass);
    if (direct) p.set("direct", "true");

    if (!presetFrom && !presetTo && tripType === "multi-city") {
      const legs = multiLegs
        .filter((l) => l.from && l.to && l.date)
        .map((l) => `${l.from!.code}_${l.to!.code}_${formatLocalDate(l.date as Date)}`);
      if (legs.length < 2) {
        toast.error("Please complete at least 2 flight legs (from, to, date).");
        return;
      }
      p.set("legs", legs.join(","));
      applyStudioPreview(p);
      navigate(`/flights?${p.toString()}`);
      return;
    }

    const fromCode = presetFrom || fromAirport?.code || "";
    const toCode = presetTo || toAirport?.code || "";
    if (!presetFrom && !presetTo) {
      if (!fromAirport || !toAirport) {
        toast.error("Please select both origin and destination airports.");
        return;
      }
      if (!departDate) {
        toast.error("Please select a departure date.");
        return;
      }
      if (tripType === "round-trip" && !returnDate) {
        toast.error("Please select a return date.");
        return;
      }
    }
    if (fromCode) p.set("from", fromCode);
    if (toCode) p.set("to", toCode);
    if (departDate) p.set("date", formatLocalDate(departDate));
    if (tripType === "round-trip" && returnDate)
      p.set("returnDate", formatLocalDate(returnDate));
    applyStudioPreview(p);
    navigate(`/flights?${p.toString()}`);
  };

  return (
    <section className="relative overflow-hidden bg-background">
      {/* ─── Cinematic hero ─────────────────────────────────────── */}
      <div className="relative min-h-[440px] sm:min-h-[500px] lg:min-h-[560px] flex items-center pt-20 sm:pt-24 lg:pt-28 pb-24">
        <motion.img
          src={heroBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          width={1920}
          height={1080}
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 12, ease: "linear" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(222 60% 6% / 0.15) 0%, hsl(222 60% 6% / 0) 30%, hsl(222 60% 6% / 0) 55%, hsl(222 60% 6% / 0.55) 88%, hsl(222 60% 6% / 0.85) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 70%, hsl(222 60% 6% / 0.45) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 self-end">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white text-[11px] font-semibold tracking-[0.14em] uppercase shadow-[0_8px_24px_-8px_hsl(0_0%_0%/0.4)]">
              <Plane className="w-3 h-3" />
              {badge}
            </span>
            <h1
              className="mt-6 text-white leading-[0.98] tracking-[-0.02em] font-semibold drop-shadow-[0_2px_24px_hsl(222_60%_6%/0.5)]"
              style={{
                fontFamily: "var(--font-heading, inherit)",
                fontSize: "clamp(2.5rem, 6.5vw, 5.5rem)",
              }}
            >
              {headline}
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/90 max-w-xl leading-relaxed font-light">
              {subtitle}
            </p>
          </motion.div>
        </div>
      </div>

      {/* ─── Floating glass search card ──────────────────────── */}
      <div className="relative -mt-16 sm:-mt-20 z-20 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-[28px] border border-white/30 overflow-hidden backdrop-blur-2xl"
            style={{
              background:
                "linear-gradient(180deg, hsl(0 0% 100% / 0.92) 0%, hsl(0 0% 100% / 0.86) 100%)",
              boxShadow:
                "0 40px 120px -30px hsl(222 60% 6% / 0.45), 0 16px 40px -16px hsl(222 60% 6% / 0.25), inset 0 1px 0 hsl(0 0% 100% / 0.7)",
            }}
          >
            <div className="p-5 sm:p-7 space-y-4">
              <FlightForm
                tripType={tripType}
                setTripType={setTripType}
                fromAirport={fromAirport}
                setFromAirport={setFromAirport}
                toAirport={toAirport}
                setToAirport={setToAirport}
                departDate={departDate}
                setDepartDate={setDepartDate}
                returnDate={returnDate}
                setReturnDate={setReturnDate}
                adults={adults}
                setAdults={setAdults}
                children={children}
                setChildren={setChildren}
                infants={infants}
                setInfants={setInfants}
                flightClass={flightClass}
                setFlightClass={setFlightClass}
                direct={direct}
                setDirect={setDirect}
                departOpen={departOpen}
                setDepartOpen={setDepartOpen}
                returnOpen={returnOpen}
                setReturnOpen={setReturnOpen}
                paxOpen={paxOpen}
                setPaxOpen={setPaxOpen}
                onSwap={swap}
                multiLegs={multiLegs}
                updateLeg={updateLeg}
                addLeg={addLeg}
                removeLeg={removeLeg}
                totalTravelers={totalTravelers}
              />

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground/80">
                  Free cancellation on most fares · Lowest-price guarantee
                </p>
                <Button
                  onClick={() => handleSearch()}
                  className="h-13 px-8 sm:px-10 py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base tracking-wide group"
                  style={{
                    boxShadow:
                      "0 14px 32px -10px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.25)",
                  }}
                >
                  <Search className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                  Search Flights
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Popular routes — editorial grid ────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-end justify-between mb-8 border-b border-foreground/10 pb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2 block">
              Trending corridors
            </span>
            <h2
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              Popular routes booked this week
            </h2>
          </div>
          <Sparkles className="w-5 h-5 text-muted-foreground hidden sm:block" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularRoutes.slice(0, 6).map((r, i) => (
            <button
              key={`${r.from}-${r.to}-${i}`}
              onClick={() => handleSearch(r.from, r.to)}
              className="group text-left rounded-2xl border border-foreground/10 bg-card hover:border-primary/40 hover:shadow-[0_20px_40px_-20px_hsl(var(--primary)/0.25)] transition-all p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold tracking-tight text-muted-foreground">
                  <span>{r.from}</span>
                  <ArrowLeftRight className="w-3 h-3 opacity-50" />
                  <span>{r.to}</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <p
                className="text-lg font-semibold text-foreground leading-tight"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {r.fromCity || r.from} → {r.toCity || r.to}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> {r.duration || "—"}
                </span>
                <span className="font-semibold text-primary">{r.price || ""}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Trust strip (mirrors HybridHero) ────────────────── */}
      <div className="container mx-auto px-4 pb-16">
        <div
          className="rounded-2xl border border-foreground/10 bg-background/80 backdrop-blur-md px-4 sm:px-6 py-5"
          style={{
            boxShadow:
              "0 12px 40px -16px hsl(222 30% 8% / 0.12), inset 0 1px 0 hsl(0 0% 100% / 0.6)",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 sm:divide-x divide-foreground/10">
            {[
              { icon: ShieldCheck, title: "Secure booking", desc: "Bank-grade encryption on every payment" },
              { icon: Tag, title: "Best-price promise", desc: "Find a lower fare? We'll match it" },
              { icon: Clock, title: "24/7 support", desc: "Real humans, anytime, anywhere" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-4 px-2 sm:px-4 py-2 sm:py-0">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground leading-tight">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HybridFlightsLanding;