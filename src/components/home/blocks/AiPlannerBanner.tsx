import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Hotel, MapPin, Car, ArrowRight } from "lucide-react";
import { useBlockOverride } from "@/hooks/useBlockOverride";
import { usePlatformModules } from "@/hooks/usePlatformModules";
import mascotImg from "@/assets/ai-planner-mascot.png";

/**
 * promo.ai-planner — AI Trip Planner banner + 3 quick-action cards.
 *
 * Fully editable per tenant via block content overrides. Each text segment,
 * link, image, and the 3 action cards can be overridden. Color follows the
 * tenant's --primary token automatically.
 */

const ICONS: Record<string, typeof Hotel> = {
  Hotel,
  MapPin,
  Car,
  Sparkles,
};

const AiPlannerBanner = () => {
  const ov = useBlockOverride();
  const c = ov?.content || {};
  const modules = ov?.enabledModules || {};
  const { isEnabled } = usePlatformModules();

  // Hide entirely when AI Trip Planner is disabled platform-wide OR by tenant.
  if (!isEnabled("ai_trip_planner")) return null;
  if (modules.ai_trip_planner === false) return null;

  // Editable copy
  const badge = (c.badge as string) || "NEW";
  const heading = (c.heading as string) || "AI Trip Planner";
  const subheading =
    (c.subheading as string) ||
    "Not sure where to go? Let our AI plan the perfect trip for you.";
  const ctaLabel = (c.cta_label as string) || "Plan with AI";
  const ctaHref = (c.cta_href as string) || "/ai-trip";
  const mascot = (c.mascot_image as string) || mascotImg;

  const defaultActions = [
    {
      icon: "Hotel",
      title: "Find Stays",
      desc: "Great hotels for your destination",
      cta: "Explore Hotels",
      href: "/hotels",
      module: "hotels",
    },
    {
      icon: "MapPin",
      title: "Explore Activities",
      desc: "Top things to do at your destination",
      cta: "Explore Tours",
      href: "/tours",
      module: "tours",
    },
    {
      icon: "Car",
      title: "Airport Transfers",
      desc: "Hassle-free pickup and drop-off",
      cta: "Book Transfers",
      href: "/transfers",
      module: "transfers",
    },
  ];
  const actions =
    Array.isArray(c.actions) && (c.actions as any[]).length > 0
      ? (c.actions as Array<{
          icon?: string;
          title?: string;
          desc?: string;
          cta?: string;
          href?: string;
          module?: string;
        }>)
      : defaultActions;

  // Filter out actions for modules the tenant has disabled.
  const visibleActions = actions.filter(
    (a) => !a.module || modules[a.module] !== false,
  );

  if (c.enabled === false) return null;

  return (
    <section className="py-8 sm:py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* ── AI Planner banner ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="lg:col-span-5 relative overflow-hidden rounded-2xl border border-primary/15 p-5 sm:p-6 flex items-center gap-4"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--primary) / 0.03) 100%)",
            }}
          >
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5" />
                {badge}
              </span>
              <h3 className="mt-2 text-lg sm:text-xl font-bold text-foreground leading-tight">
                {heading}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-snug max-w-[260px]">
                {subheading}
              </p>
              <Link
                to={ctaHref}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {ctaLabel}
              </Link>
            </div>
            <img
              src={mascot}
              alt=""
              loading="lazy"
              className="w-24 sm:w-28 h-24 sm:h-28 object-contain shrink-0"
            />
          </motion.div>

          {/* ── 3 action cards ──────────────────────────────────── */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {visibleActions.slice(0, 3).map((a, i) => {
              const Icon = ICONS[a.icon || ""] || Hotel;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.1 + i * 0.07,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                  className="rounded-2xl border border-foreground/10 bg-card p-4 sm:p-5 flex flex-col"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-foreground leading-tight">
                    {a.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    {a.desc}
                  </p>
                  <Link
                    to={a.href || "#"}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:gap-1.5 transition-all"
                  >
                    {a.cta || "Learn more"}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AiPlannerBanner;
