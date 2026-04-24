import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Plane,
  Hotel,
  MapPin,
  Car,
  FileCheck,
  Search,
  Users,
  ArrowLeftRight,
  Sparkles,
  Star,
  ShieldCheck,
  Globe2,
  Headphones,
  Tag,
  Award,
  Heart,
  Clock,
  Gift,
  Zap,
  CheckCircle,
  ThumbsUp,
  Smile,
  Plus,
  Trash2,
  Repeat2,
  ArrowRight,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import AirportPicker, { type Airport } from "@/components/home/AirportPicker";
import HotelLocationPicker, {
  type HotelLocation,
} from "@/components/home/HotelLocationPicker";
import TourLocationPicker from "@/components/home/TourLocationPicker";
import { useBlockOverride, useBlockVariant } from "@/hooks/useBlockOverride";
import { toast } from "sonner";
import heroImage from "@/assets/hero-hybrid.jpg";

/**
 * hero.search-mixed (Hybrid skin) — light photo hero with an integrated
 * horizontal search card. Now supports Round Trip / One Way / Multi-City
 * (2–5 legs) and full passenger breakdown (adults/children/infants),
 * matching the platform's full /flights search capability.
 */

type TabKey = "flights" | "hotels" | "tours" | "transfers" | "visa";
type TripType = "round-trip" | "one-way" | "multi-city";

interface MultiCityLeg {
  from: Airport | null;
  to: Airport | null;
  date: Date | undefined;
}

const TAB_META: Record<
  TabKey,
  { label: string; icon: typeof Plane; moduleKey: string }
> = {
  flights: { label: "Flights", icon: Plane, moduleKey: "flights" },
  hotels: { label: "Hotels", icon: Hotel, moduleKey: "hotels" },
  tours: { label: "Tours", icon: MapPin, moduleKey: "tours" },
  transfers: { label: "Transfers", icon: Car, moduleKey: "transfers" },
  visa: { label: "Visa", icon: FileCheck, moduleKey: "visa" },
};

const TAB_ORDER: TabKey[] = ["flights", "hotels", "tours", "transfers"];

const TRUST_ICONS: Record<string, typeof Plane> = {
  Headphones, Tag, ShieldCheck, Users, Award, Heart, Clock, Gift, Zap,
  CheckCircle, ThumbsUp, Smile, Sparkles, Star, Globe2, Plane, Hotel, MapPin,
};

export const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Reads `?studio_preview=1&tenant=…` from the current URL, used by every
 * Hybrid landing page so search results stay inside the tenant-branded
 * preview iframe instead of falling back to the platform site.
 */
export function getStudioPreviewParams():
  | { studio_preview: string; tenant: string }
  | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("studio_preview") === "1" && sp.get("tenant")) {
      return { studio_preview: "1", tenant: sp.get("tenant") as string };
    }
  } catch {
    /* noop */
  }
  return null;
}

export function applyStudioPreview(p: URLSearchParams) {
  const preview = getStudioPreviewParams();
  if (preview) {
    p.set("studio_preview", preview.studio_preview);
    p.set("tenant", preview.tenant);
  }
}

const HybridHero = () => {
  const navigate = useNavigate();
  const ov = useBlockOverride();
  const variant = useBlockVariant();
  const c = ov?.content || {};
  const enabledModules = ov?.enabledModules || {
    flights: true,
    hotels: true,
    tours: true,
    transfers: true,
  };

  const badge = (c.badge as string) || "Your Journey, Our Passion";
  const headline = (c.headline as string) || "Travel Smarter, Experience More";
  const subtitle =
    (c.subtitle as string) ||
    "Flights, hotels, tours and more — all in one place.";
  const heroBg = (c.hero_image as string) || heroImage;

  const defaultTrustItems = [
    { icon: "Headphones", title: "24/7 Support", desc: "We're here for you anytime, anywhere" },
    { icon: "Tag", title: "Best Price Guarantee", desc: "Find a lower price? We'll match it" },
    { icon: "ShieldCheck", title: "Secure Booking", desc: "Your data and payments are always protected" },
    { icon: "Users", title: "Trusted Worldwide", desc: "Travelers across the globe choose us" },
  ];
  const trustItems = Array.isArray(c.trust_items) && (c.trust_items as any[]).length > 0
    ? (c.trust_items as Array<{ icon?: string; title?: string; desc?: string }>)
    : defaultTrustItems;
  const showTrustStrip = c.show_trust_strip !== false;

  const availableTabs = useMemo(
    () =>
      TAB_ORDER.filter((t) => enabledModules[TAB_META[t].moduleKey] !== false),
    [enabledModules],
  );

  const [activeTab, setActiveTab] = useState<TabKey>(
    availableTabs[0] || "flights",
  );

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || "flights");
    }
  }, [availableTabs, activeTab]);

  // ─── Flight state ───
  const [tripType, setTripType] = useState<TripType>("one-way");
  const [fromAirport, setFromAirport] = useState<Airport | null>(null);
  const [toAirport, setToAirport] = useState<Airport | null>(null);
  const [departDate, setDepartDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [flightClass, setFlightClass] = useState("Economy");
  const [direct, setDirect] = useState(false);
  const [departOpen, setDepartOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [paxOpen, setPaxOpen] = useState(false);

  // Multi-city legs (min 2, max 5)
  const [multiLegs, setMultiLegs] = useState<MultiCityLeg[]>([
    { from: null, to: null, date: undefined },
    { from: null, to: null, date: undefined },
  ]);

  const updateLeg = (i: number, patch: Partial<MultiCityLeg>) => {
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

  // ─── Hotel state ───
  const [hotelLocation, setHotelLocation] = useState<HotelLocation | null>(null);
  const [hotelCheckin, setHotelCheckin] = useState<Date>();
  const [hotelCheckout, setHotelCheckout] = useState<Date>();
  const [hotelGuests, setHotelGuests] = useState(2);
  const [hotelRooms, setHotelRooms] = useState(1);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // ─── Tour state ───
  const [tourQuery, setTourQuery] = useState("");
  const [tourLocType, setTourLocType] = useState("");

  // ─── Transfer state ───
  const [transferPickup, setTransferPickup] = useState("");
  const [transferDropoff, setTransferDropoff] = useState("");
  const [transferDate, setTransferDate] = useState<Date>();
  const [transferDateOpen, setTransferDateOpen] = useState(false);

  // ─── Visa state ───
  const [visaCountry, setVisaCountry] = useState("");

  const swap = () => {
    const a = fromAirport;
    setFromAirport(toAirport);
    setToAirport(a);
  };

  const totalTravelers = adults + children + infants;

  const handleSearch = () => {
    const previewSearch = getStudioPreviewParams();
    const applyPreview = (p: URLSearchParams) => applyStudioPreview(p);

    if (activeTab === "flights") {
      const p = new URLSearchParams();
      p.set("adults", String(adults));
      if (children > 0) p.set("children", String(children));
      if (infants > 0) p.set("infants", String(infants));
      p.set("class", flightClass);
      if (direct) p.set("direct", "true");

      if (tripType === "multi-city") {
        // Encode legs as FROM_TO_YYYY-MM-DD,...  (Flights.tsx parser format)
        const legs = multiLegs
          .filter((l) => l.from && l.to && l.date)
          .map(
            (l) =>
              `${l.from!.code}_${l.to!.code}_${formatLocalDate(l.date as Date)}`,
          );
        if (legs.length < 2) {
          toast.error("Please complete at least 2 flight legs (from, to, date).");
          return;
        }
        p.set("legs", legs.join(","));
        applyPreview(p);
        navigate(`/flights?${p.toString()}`);
        return;
      }

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
      if (fromAirport) p.set("from", fromAirport.code);
      if (toAirport) p.set("to", toAirport.code);
      if (departDate) p.set("date", formatLocalDate(departDate));
      if (tripType === "round-trip" && returnDate)
        p.set("returnDate", formatLocalDate(returnDate));
      applyPreview(p);
      navigate(`/flights?${p.toString()}`);
    } else if (activeTab === "hotels") {
      const p = new URLSearchParams();
      if (hotelLocation) {
        const isHotel = hotelLocation.search_type === "hotel" || hotelLocation.type === "HOTEL";
        // For hotel selections, search by the actual city name + carry hotel_ids
        // so the hotel-specific search path is used. Otherwise the supplier
        // gets a hotel name as cityName and returns 0 results.
        p.set("city", isHotel && hotelLocation.actual_city_name
          ? hotelLocation.actual_city_name
          : hotelLocation.city_name);
        p.set("locationId", String(hotelLocation.location_id));
        if (isHotel) {
          if (hotelLocation.hotel_ids?.length) p.set("hotelIds", hotelLocation.hotel_ids.join(","));
          if (hotelLocation.actual_city_name) p.set("actualCity", hotelLocation.actual_city_name);
          // Preserve the picked hotel name for breadcrumbs/UI
          p.set("hotelName", hotelLocation.city_name);
        }
      }
      if (hotelCheckin) p.set("checkin", formatLocalDate(hotelCheckin));
      if (hotelCheckout) p.set("checkout", formatLocalDate(hotelCheckout));
      p.set("adults", String(hotelGuests));
      p.set("rooms", String(hotelRooms));
      applyPreview(p);
      navigate(`/hotels?${p.toString()}`);
    } else if (activeTab === "tours") {
      const p = new URLSearchParams();
      if (tourQuery) p.set("q", tourQuery);
      if (tourLocType) p.set("locType", tourLocType);
      applyPreview(p);
      navigate(`/tours?${p.toString()}`);
    } else if (activeTab === "transfers") {
      const p = new URLSearchParams();
      if (transferPickup) p.set("pickup", transferPickup);
      if (transferDropoff) p.set("dropoff", transferDropoff);
      if (transferDate) p.set("date", formatLocalDate(transferDate));
      applyPreview(p);
      navigate(`/transfers?${p.toString()}`);
    } else if (activeTab === "visa") {
      const base = visaCountry ? `/visa/${visaCountry.toLowerCase()}` : "/visa";
      const suffix = previewSearch
        ? `?studio_preview=1&tenant=${previewSearch.tenant}`
        : "";
      navigate(`${base}${suffix}`);
    }
  };

  return (
    <section className="relative overflow-hidden bg-background">
      {variant === "editorial-split" ? (
        // ─── Variant: Editorial Split ─────────────────────────────────
        // Calmer agency-style intro: narrative copy on the left, the same
        // (untouched) search card stacks below. Used by skins that want a
        // less cinematic, more trustworthy first impression.
        <div className="relative pt-24 sm:pt-28 lg:pt-32 pb-10 bg-gradient-to-b from-secondary/40 via-background to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                className="lg:col-span-7"
              >
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tracking-[0.14em] uppercase">
                  <Sparkles className="w-3 h-3" />
                  {badge}
                </span>
                <h1
                  className="mt-5 text-foreground leading-[1.05] tracking-[-0.02em] font-semibold"
                  style={{
                    fontFamily: "var(--font-heading, inherit)",
                    fontSize: "clamp(2.25rem, 5vw, 4rem)",
                  }}
                >
                  {headline}
                </h1>
                <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
                  {subtitle}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="lg:col-span-5 hidden lg:block"
              >
                <div
                  className="aspect-[4/5] rounded-3xl bg-cover bg-center shadow-[0_30px_80px_-30px_hsl(222_60%_6%/0.35)]"
                  style={{ backgroundImage: `url(${heroBg})` }}
                />
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
      // ─── Variant: Cinematic (default) ─────────────────────────────
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
              <Sparkles className="w-3 h-3" />
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
      )}

      {/* Floating glass search card */}
      <div
        className={cn(
          "relative z-20 pb-8",
          variant === "editorial-split" ? "mt-2" : "-mt-16 sm:-mt-20",
        )}
      >
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-[28px] border border-white/30 overflow-hidden backdrop-blur-2xl"
            style={{
              background:
                "linear-gradient(180deg, hsl(0 0% 100% / 0.94) 0%, hsl(0 0% 100% / 0.88) 100%)",
              boxShadow:
                "0 40px 120px -30px hsl(222 60% 6% / 0.45), 0 16px 40px -16px hsl(222 60% 6% / 0.25), inset 0 1px 0 hsl(0 0% 100% / 0.7)",
            }}
          >
            {/* Tab strip */}
            <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-7 pt-5 border-b border-foreground/10 overflow-x-auto scrollbar-hide">
              {availableTabs.map((tab) => {
                const Icon = TAB_META[tab].icon;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative flex items-center gap-2 px-3.5 sm:px-5 pb-4 pt-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground/80",
                      )}
                    />
                    {TAB_META[tab].label}
                    {isActive && (
                      <motion.span
                        layoutId="hybrid-hero-tab-underline"
                        className="absolute left-2 right-2 -bottom-px h-[3px] bg-primary rounded-full shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5 sm:p-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "flights" && (
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
                  )}
                  {activeTab === "hotels" && (
                    <HotelForm
                      location={hotelLocation}
                      setLocation={setHotelLocation}
                      checkin={hotelCheckin}
                      setCheckin={setHotelCheckin}
                      checkout={hotelCheckout}
                      setCheckout={setHotelCheckout}
                      guests={hotelGuests}
                      setGuests={setHotelGuests}
                      rooms={hotelRooms}
                      setRooms={setHotelRooms}
                      checkinOpen={checkinOpen}
                      setCheckinOpen={setCheckinOpen}
                      checkoutOpen={checkoutOpen}
                      setCheckoutOpen={setCheckoutOpen}
                    />
                  )}
                  {activeTab === "tours" && (
                    <TourForm
                      query={tourQuery}
                      setQuery={setTourQuery}
                      locType={tourLocType}
                      setLocType={setTourLocType}
                    />
                  )}
                  {activeTab === "transfers" && (
                    <TransferForm
                      pickup={transferPickup}
                      setPickup={setTransferPickup}
                      dropoff={transferDropoff}
                      setDropoff={setTransferDropoff}
                      date={transferDate}
                      setDate={setTransferDate}
                      dateOpen={transferDateOpen}
                      setDateOpen={setTransferDateOpen}
                    />
                  )}
                  {activeTab === "visa" && (
                    <VisaForm country={visaCountry} setCountry={setVisaCountry} />
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-muted-foreground/80">
                  Free cancellation on most bookings · No hidden fees
                </p>
                <Button
                  onClick={handleSearch}
                  className="h-13 px-8 sm:px-10 py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base tracking-wide group"
                  style={{
                    boxShadow:
                      "0 14px 32px -10px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.25)",
                  }}
                >
                  <Search className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                  Search {TAB_META[activeTab].label}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {showTrustStrip && trustItems.length > 0 && (
      <div className="relative z-20 pb-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustItems.map((item, i) => {
              const Icon = TRUST_ICONS[item.icon || "ShieldCheck"] || ShieldCheck;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border/40"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      )}
    </section>
  );
};

// ───────────────────────── helpers ─────────────────────────

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-2xl border border-border/60 bg-background/70 hover:border-primary/40 focus-within:border-primary/60 focus-within:bg-background transition-all px-4 py-2.5",
        className,
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80 mb-1 group-focus-within:text-primary transition-colors">
        {label}
      </p>
      {children}
    </div>
  );
}

function TripTypeChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Plane;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_hsl(var(--primary)/0.6)]"
          : "text-muted-foreground hover:text-foreground border border-border/50 hover:border-primary/40 bg-background/60",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function PaxRow({
  label,
  sublabel,
  value,
  onChange,
  min = 0,
  max = 9,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sublabel && <div className="text-[11px] text-muted-foreground">{sublabel}</div>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-8 h-8 rounded-full border border-border hover:border-primary hover:text-primary transition-colors grid place-items-center disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-6 text-center font-semibold text-sm">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-8 h-8 rounded-full border border-border hover:border-primary hover:text-primary transition-colors grid place-items-center disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function FlightForm(props: any) {
  const {
    tripType,
    setTripType,
    fromAirport,
    setFromAirport,
    toAirport,
    setToAirport,
    departDate,
    setDepartDate,
    returnDate,
    setReturnDate,
    adults,
    setAdults,
    children,
    setChildren,
    infants,
    setInfants,
    flightClass,
    setFlightClass,
    direct,
    setDirect,
    departOpen,
    setDepartOpen,
    returnOpen,
    setReturnOpen,
    paxOpen,
    setPaxOpen,
    onSwap,
    multiLegs,
    updateLeg,
    addLeg,
    removeLeg,
    totalTravelers,
  } = props;

  const isMulti = tripType === "multi-city";

  return (
    <div className="space-y-4">
      {/* Trip type chips + direct-only toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <TripTypeChip
          active={tripType === "one-way"}
          onClick={() => setTripType("one-way")}
          icon={ArrowRight}
          label="One Way"
        />
        <TripTypeChip
          active={tripType === "round-trip"}
          onClick={() => setTripType("round-trip")}
          icon={Repeat2}
          label="Round Trip"
        />
        <TripTypeChip
          active={tripType === "multi-city"}
          onClick={() => setTripType("multi-city")}
          icon={MapPin}
          label="Multi-City"
        />

        <label className="ml-auto flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none px-3 py-1.5 rounded-full border border-border/50 bg-background/60 hover:border-primary/40 transition-colors">
          <input
            type="checkbox"
            checked={direct}
            onChange={(e) => setDirect(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          Direct flights only
        </label>
      </div>

      {/* MULTI-CITY layout */}
      {isMulti ? (
        <div className="space-y-2.5">
          {multiLegs.map((leg: MultiCityLeg, i: number) => {
            const minDate =
              i > 0 && multiLegs[i - 1].date
                ? (multiLegs[i - 1].date as Date)
                : new Date(new Date().setHours(0, 0, 0, 0));
            return (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-stretch">
                <div className="md:col-span-1 hidden md:flex items-center justify-center">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center">
                    {i + 1}
                  </span>
                </div>
                <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <AirportPicker
                    label="From"
                    placeholder="Origin"
                    selected={leg.from}
                    onSelect={(a) => updateLeg(i, { from: a })}
                    excludeCode={leg.to?.code}
                  />
                  <AirportPicker
                    label="To"
                    placeholder="Destination"
                    selected={leg.to}
                    onSelect={(a) => updateLeg(i, { to: a })}
                    excludeCode={leg.from?.code}
                  />
                </div>
                <div className="md:col-span-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-left w-full h-full">
                        <Field label={`Depart ${i + 1}`} className="h-full">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {leg.date ? format(leg.date, "d MMM yyyy") : "Select date"}
                          </p>
                        </Field>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-auto" align="start">
                      <Calendar
                        mode="single"
                        selected={leg.date}
                        onSelect={(d) => updateLeg(i, { date: d })}
                        disabled={(d) => d < minDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-4 flex items-stretch gap-2">
                  {i === multiLegs.length - 1 && multiLegs.length < 5 && (
                    <button
                      type="button"
                      onClick={addLeg}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border border-dashed border-primary/40 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add city
                    </button>
                  )}
                  {multiLegs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeLeg(i)}
                      className="px-3 rounded-2xl border border-border/60 text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors grid place-items-center"
                      aria-label="Remove leg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Travelers row for multi-city */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-1 hidden md:block" />
            <div className="md:col-span-11">
              <Popover open={paxOpen} onOpenChange={setPaxOpen}>
                <PopoverTrigger asChild>
                  <button className="text-left w-full">
                    <Field label="Travelers & Class">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {totalTravelers} Traveler{totalTravelers > 1 ? "s" : ""}, {flightClass}
                      </p>
                    </Field>
                  </button>
                </PopoverTrigger>
                <TravelersPopover
                  adults={adults} setAdults={setAdults}
                  children={children} setChildren={setChildren}
                  infants={infants} setInfants={setInfants}
                  flightClass={flightClass} setFlightClass={setFlightClass}
                />
              </Popover>
            </div>
          </div>
        </div>
      ) : (
        // ROUND-TRIP / ONE-WAY layout
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-stretch">
          <div className="md:col-span-5 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-6">
              <div className="rounded-2xl border border-border/60 bg-background/70 hover:border-primary/40 focus-within:border-primary/60 focus-within:bg-background transition-all px-4 py-2.5 min-h-[68px] flex items-center">
                <AirportPicker
                  label="From"
                  placeholder="Origin city"
                  selected={fromAirport}
                  onSelect={setFromAirport}
                  excludeCode={toAirport?.code}
                />
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 hover:border-primary/40 focus-within:border-primary/60 focus-within:bg-background transition-all px-4 py-2.5 min-h-[68px] flex items-center">
                <AirportPicker
                  label="To"
                  placeholder="Destination"
                  selected={toAirport}
                  onSelect={setToAirport}
                  excludeCode={fromAirport?.code}
                />
              </div>
            </div>
            {/* Swap button — sits in the gutter between the two pickers */}
            <button
              onClick={onSwap}
              type="button"
              className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-background border border-border shadow-[0_6px_16px_-6px_hsl(var(--foreground)/0.25)] items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary hover:rotate-180 transition-all duration-300"
              aria-label="Swap origin and destination"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            className={cn(
              "md:col-span-4 grid gap-2",
              tripType === "round-trip" ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <Popover open={departOpen} onOpenChange={setDepartOpen}>
              <PopoverTrigger asChild>
                <button className="text-left">
                  <Field label="Depart">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {departDate ? format(departDate, "d MMM yyyy") : "Select date"}
                    </p>
                  </Field>
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto" align="start">
                <Calendar
                  mode="single"
                  selected={departDate}
                  onSelect={(d) => {
                    setDepartDate(d);
                    setDepartOpen(false);
                  }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>

            {tripType === "round-trip" && (
              <Popover open={returnOpen} onOpenChange={setReturnOpen}>
                <PopoverTrigger asChild>
                  <button className="text-left">
                    <Field label="Return">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {returnDate ? format(returnDate, "d MMM yyyy") : "Select date"}
                      </p>
                    </Field>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={returnDate}
                    onSelect={(d) => {
                      setReturnDate(d);
                      setReturnOpen(false);
                    }}
                    disabled={(d) =>
                      d < (departDate || new Date(new Date().setHours(0, 0, 0, 0)))
                    }
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="md:col-span-3">
            <Popover open={paxOpen} onOpenChange={setPaxOpen}>
              <PopoverTrigger asChild>
                <button className="text-left w-full h-full">
                  <Field label="Travelers & Class" className="h-full">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {totalTravelers} Traveler{totalTravelers > 1 ? "s" : ""}, {flightClass}
                    </p>
                  </Field>
                </button>
              </PopoverTrigger>
              <TravelersPopover
                adults={adults} setAdults={setAdults}
                children={children} setChildren={setChildren}
                infants={infants} setInfants={setInfants}
                flightClass={flightClass} setFlightClass={setFlightClass}
              />
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}

function TravelersPopover({
  adults, setAdults, children, setChildren, infants, setInfants, flightClass, setFlightClass,
}: {
  adults: number; setAdults: (v: number) => void;
  children: number; setChildren: (v: number) => void;
  infants: number; setInfants: (v: number) => void;
  flightClass: string; setFlightClass: (v: string) => void;
}) {
  return (
    <PopoverContent className="w-80 p-4 space-y-4" align="end">
      <PaxRow label="Adults" sublabel="12+ years" value={adults} onChange={setAdults} min={1} />
      <PaxRow label="Children" sublabel="2–11 years" value={children} onChange={setChildren} />
      <PaxRow label="Infants" sublabel="under 2 years" value={infants} onChange={setInfants} max={Math.max(0, adults)} />
      <div className="pt-1 space-y-1.5 border-t border-border/60">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3">
          Cabin Class
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {["Economy", "Premium", "Business", "First"].map((cls) => (
            <button
              key={cls}
              onClick={() => setFlightClass(cls)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-semibold border transition-colors",
                flightClass === cls
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border hover:border-primary/40",
              )}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>
    </PopoverContent>
  );
}

export function HotelForm(props: any) {
  const {
    location, setLocation, checkin, setCheckin, checkout, setCheckout,
    guests, setGuests, rooms, setRooms,
    checkinOpen, setCheckinOpen, checkoutOpen, setCheckoutOpen,
  } = props;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
      <div className="md:col-span-5">
        <HotelLocationPicker
          selected={location}
          onSelect={setLocation}
          placeholder="Where are you going?"
        />
      </div>
      <div className="md:col-span-4 grid grid-cols-2 gap-2">
        <Popover open={checkinOpen} onOpenChange={setCheckinOpen}>
          <PopoverTrigger asChild>
            <button className="text-left">
              <Field label="Check-in">
                <p className="text-sm font-semibold text-foreground truncate">
                  {checkin ? format(checkin, "d MMM") : "Select"}
                </p>
              </Field>
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto" align="start">
            <Calendar
              mode="single"
              selected={checkin}
              onSelect={(d) => { setCheckin(d); setCheckinOpen(false); }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>
        <Popover open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <PopoverTrigger asChild>
            <button className="text-left">
              <Field label="Check-out">
                <p className="text-sm font-semibold text-foreground truncate">
                  {checkout ? format(checkout, "d MMM") : "Select"}
                </p>
              </Field>
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto" align="start">
            <Calendar
              mode="single"
              selected={checkout}
              onSelect={(d) => { setCheckout(d); setCheckoutOpen(false); }}
              disabled={(d) => d < (checkin || new Date(new Date().setHours(0, 0, 0, 0)))}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="md:col-span-3">
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-left w-full h-full">
              <Field label="Guests & Rooms" className="h-full">
                <p className="text-sm font-semibold text-foreground truncate">
                  {guests} Guest{guests > 1 ? "s" : ""}, {rooms} Room{rooms > 1 ? "s" : ""}
                </p>
              </Field>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4 space-y-4" align="end">
            <PaxRow label="Guests" value={guests} onChange={setGuests} min={1} max={20} />
            <PaxRow label="Rooms" value={rooms} onChange={setRooms} min={1} max={9} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function TourForm({
  query, setQuery, locType, setLocType,
}: {
  query: string; setQuery: (v: string) => void;
  locType: string; setLocType: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      <TourLocationPicker
        value={query}
        onSelect={(name, type) => { setQuery(name); setLocType(type || ""); }}
        placeholder="e.g. Bali day tour"
        variant="inline"
      />
      <Field label="Travel Date (optional)">
        <p className="text-sm font-semibold text-foreground/60">
          Any date — flexible
        </p>
      </Field>
    </div>
  );
}

function TransferForm(props: any) {
  const { pickup, setPickup, dropoff, setDropoff, date, setDate, dateOpen, setDateOpen } = props;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <Field label="Pickup Location">
        <input
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
          placeholder="Airport or address"
          className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </Field>
      <Field label="Drop-off">
        <input
          value={dropoff}
          onChange={(e) => setDropoff(e.target.value)}
          placeholder="Hotel or address"
          className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </Field>
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button className="text-left">
            <Field label="Pickup Date">
              <p className="text-sm font-semibold text-foreground truncate">
                {date ? format(date, "d MMM yyyy") : "Select date"}
              </p>
            </Field>
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => { setDate(d); setDateOpen(false); }}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function VisaForm({
  country, setCountry,
}: {
  country: string; setCountry: (v: string) => void;
}) {
  const popular = ["UAE", "Thailand", "Singapore", "Malaysia", "Turkey", "Schengen"];
  return (
    <div className="space-y-3">
      <Field label="Destination Country">
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Where do you need a visa for?"
          className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {popular.map((p) => (
          <button
            key={p}
            onClick={() => setCountry(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              country === p
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export default HybridHero;
