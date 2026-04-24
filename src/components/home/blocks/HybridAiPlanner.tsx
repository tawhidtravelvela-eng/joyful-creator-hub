import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Hotel, MapPin, Car, ArrowUpRight, Wand2 } from "lucide-react";
import { useBlockOverride } from "@/hooks/useBlockOverride";
import { usePlatformModules } from "@/hooks/usePlatformModules";

/**
 * promo.ai-planner-hybrid — editorial AI Trip Planner block for the Hybrid skin.
 *
 * Visual language matches the rest of the Hybrid landing pages:
 *  - full-bleed primary/accent gradient hero
 *  - dotted grid overlay
 *  - large editorial heading + glass action cards
 *
 * Fully overridable per tenant via block content.
 */

const ICONS: Record<string, typeof Hotel> = { Hotel, MapPin, Car, Sparkles, Wand2 };

const HybridAiPlanner = () => {
  const ov = useBlockOverride();
  const c = ov?.content || {};
  const modules = ov?.enabledModules || {};
  const { isEnabled } = usePlatformModules();

  // Hide entirely when AI Trip Planner is disabled platform-wide OR by tenant.
  if (!isEnabled("ai_trip_planner")) return null;
  if (modules.ai_trip_planner === false) return null;

  const badge = (c.badge as string) || "Vela AI";
  const heading =
    (c.heading as string) || "Tell us the vibe. We'll plan the trip.";
  const subheading =
    (c.subheading as string) ||
    "Describe your dream getaway in a sentence and our AI builds a day-by-day itinerary with flights, stays, and activities — ready to book.";
  const ctaLabel = (c.cta_label as string) || "Plan my trip with AI";
  const ctaHref = (c.cta_href as string) || "/ai-trip";

  const defaultActions = [
    {
      icon: "Wand2",
      title: "Smart itineraries",
      desc: "Day-by-day plans tuned to your pace, budget and travel style.",
      module: undefined as string | undefined,
    },
    {
      icon: "Hotel",
      title: "Stays that fit",
      desc: "Hotels matched to your neighbourhood and amenity preferences.",
      module: "hotels" as string | undefined,
    },
    {
      icon: "MapPin",
      title: "Real things to do",
      desc: "Tours, tickets, and hidden gems — bookable in one click.",
      module: "tours" as string | undefined,
    },
  ];
  const actions =
    Array.isArray(c.actions) && (c.actions as any[]).length > 0
      ? (c.actions as Array<{ icon?: string; title?: string; desc?: string; module?: string }>)
      : defaultActions;
  const visibleActions = actions.filter(
    (a) => !a.module || modules[a.module] !== false,
  );

  if (c.enabled === false) return null;

  return (
    <section className="relative py-20 md:py-24 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-background to-accent/12" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "hsl(var(--primary) / 0.25)" }}
      />

      <div className="relative container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs font-medium uppercase tracking-wider mb-5">
            <Sparkles className="w-3.5 h-3.5" /> {badge}
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {heading}
          </h2>
          <p className="text-lg text-muted-foreground">{subheading}</p>
          <Link
            to={ctaHref}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 text-sm font-semibold hover:bg-primary/90 transition shadow-[0_12px_32px_-12px_hsl(var(--primary)/0.6)]"
          >
            <Sparkles className="w-4 h-4" /> {ctaLabel}
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {visibleActions.slice(0, 3).map((a, i) => {
            const Icon = ICONS[a.icon || ""] || Sparkles;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: 0.1 + i * 0.07 }}
                className="rounded-2xl border border-border bg-card/80 backdrop-blur p-7 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3
                  className="text-lg font-semibold text-foreground mb-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {a.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {a.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HybridAiPlanner;