import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  Search,
  Sparkles,
  Star,
  ShieldCheck,
  Compass,
  Clock,
  ArrowUpRight,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockOverride } from "@/hooks/useBlockOverride";
import {
  TourForm,
  applyStudioPreview,
} from "@/components/home/blocks/HybridHero";
import heroHybrid from "@/assets/hero-hybrid.jpg";
import destBali from "@/assets/dest-bali.jpg";
import destDubai from "@/assets/dest-dubai.jpg";
import destSantorini from "@/assets/dest-santorini.jpg";
import destParis from "@/assets/dest-paris.jpg";
import destTokyo from "@/assets/dest-tokyo.jpg";
import destNewYork from "@/assets/dest-newyork.jpg";

/**
 * landing.tours — single-product Tours & Experiences landing block for the
 * Hybrid skin. Magazine-feel grid showcases curated experiences in the
 * same cinematic photo language as the homepage hero.
 */

const DEFAULT_EXPERIENCES = [
  { city: "Bali", title: "Sunrise at Mount Batur", image: destBali, duration: "Half-day", from: "from $42", rating: 4.9 },
  { city: "Dubai", title: "Desert dunes & Bedouin dinner", image: destDubai, duration: "6 hrs", from: "from $58", rating: 4.8 },
  { city: "Santorini", title: "Caldera sunset sail", image: destSantorini, duration: "5 hrs", from: "from $96", rating: 4.9 },
  { city: "Paris", title: "After-hours Louvre walk", image: destParis, duration: "2 hrs", from: "from $74", rating: 4.7 },
  { city: "Tokyo", title: "Tsukiji food trail", image: destTokyo, duration: "3 hrs", from: "from $88", rating: 4.8 },
  { city: "New York", title: "Skyline helicopter tour", image: destNewYork, duration: "30 min", from: "from $204", rating: 4.6 },
];

const HybridToursLanding = () => {
  const navigate = useNavigate();
  const ov = useBlockOverride();
  const c = ov?.content || {};

  const badge = (c.badge as string) || "Curated experiences";
  const headline =
    (c.headline as string) || "Stories you'll tell long after the tan fades.";
  const subtitle =
    (c.subtitle as string) ||
    "Sunrise hikes, after-hours museums, dinner with locals — small-group experiences led by people who actually live there.";
  const heroBg = (c.hero_image as string) || heroHybrid;
  const experiences =
    (c.experiences as Array<{
      city: string;
      title: string;
      image?: string;
      duration?: string;
      from?: string;
      rating?: number;
    }>) || DEFAULT_EXPERIENCES;

  const [query, setQuery] = useState("");
  const [locType, setLocType] = useState("");

  const handleSearch = (presetQuery?: string) => {
    const p = new URLSearchParams();
    const q = presetQuery || query;
    if (q) p.set("q", q);
    if (locType) p.set("locType", locType);
    applyStudioPreview(p);
    navigate(`/tours?${p.toString()}`);
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
              <Compass className="w-3 h-3" />
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
              <TourForm
                query={query}
                setQuery={setQuery}
                locType={locType}
                setLocType={setLocType}
              />
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground/80">
                  Free cancellation up to 24h on most experiences · Local guides only
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
                  Find experiences
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── Editorial experience grid (asymmetric) ──────────── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-end justify-between mb-8 border-b border-foreground/10 pb-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-2 block">
              Editor's picks
            </span>
            <h2
              className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              Experiences worth writing home about
            </h2>
          </div>
          <Sparkles className="w-5 h-5 text-muted-foreground hidden sm:block" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {experiences.slice(0, 6).map((e, i) => (
            <button
              key={`${e.city}-${i}`}
              onClick={() => handleSearch(e.city)}
              className={
                "group text-left rounded-3xl overflow-hidden border border-foreground/10 bg-card hover:shadow-[0_28px_60px_-20px_hsl(var(--primary)/0.35)] transition-all " +
                (i === 0 ? "lg:col-span-2 lg:row-span-2" : "")
              }
            >
              <div className={"relative overflow-hidden " + (i === 0 ? "aspect-[16/10] lg:aspect-[16/12]" : "aspect-[4/3]")}>
                <img
                  src={e.image}
                  alt={e.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 30%, hsl(222 60% 6% / 0.7) 100%)",
                  }}
                />
                {typeof e.rating === "number" && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/90 text-foreground backdrop-blur-sm text-[11px] font-semibold tabular-nums">
                    <Star className="w-3 h-3 fill-primary text-primary" />
                    {e.rating.toFixed(1)}
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] opacity-90 mb-1">
                    <MapPin className="w-3 h-3" />
                    {e.city}
                    <span className="opacity-50">·</span>
                    <Clock className="w-3 h-3" />
                    {e.duration || ""}
                  </div>
                  <p
                    className={
                      "font-semibold leading-tight " +
                      (i === 0 ? "text-3xl sm:text-4xl" : "text-xl")
                    }
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    {e.title}
                  </p>
                </div>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Per person</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  {e.from} <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Trust strip ──────────────────────────────────────── */}
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
              { icon: ShieldCheck, title: "Vetted operators", desc: "Every guide background-checked" },
              { icon: ThumbsUp, title: "Honest reviews", desc: "Only real travellers, no bots" },
              { icon: Clock, title: "24h cancellation", desc: "Most experiences refundable" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-4 px-2 sm:px-4">
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

export default HybridToursLanding;