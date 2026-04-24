import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Globe2, Building2, ArrowRight } from "lucide-react";
import { useBlockOverride } from "@/hooks/useBlockOverride";
import b2bImg from "@/assets/grow-b2b.png";
import wlImg from "@/assets/grow-whitelabel.png";
import corpImg from "@/assets/grow-corporate.png";

/**
 * promo.grow-business — "Grow Your Travel Business" 3-card promo.
 *
 * Used on hybrid skin homepages to surface partner / agent flows. Every
 * text segment, image, link, and icon is editable per tenant via block
 * content overrides. Tenant primary color is applied automatically.
 */

const ICONS: Record<string, typeof Briefcase> = {
  Briefcase,
  Globe2,
  Building2,
};

const GrowYourBusiness = () => {
  const ov = useBlockOverride();
  const c = ov?.content || {};
  const modules = ov?.enabledModules || {};

  const heading = (c.heading as string) || "Grow Your Travel Business";
  const subheading =
    (c.subheading as string) ||
    "Powerful tools and solutions for travel professionals and businesses.";

  const defaultCards = [
    {
      icon: "Briefcase",
      title: "B2B Portal",
      desc: "Access exclusive rates and global inventory.",
      cta: "Explore B2B Portal",
      href: "/partners",
      image: b2bImg,
      module: "b2b",
    },
    {
      icon: "Globe2",
      title: "White-label Solution",
      desc: "Get your own branded travel booking website.",
      cta: "Explore White-label",
      href: "/partners",
      image: wlImg,
      module: "whitelabel",
    },
    {
      icon: "Building2",
      title: "Corporate Travel",
      desc: "Manage your company travel smartly.",
      cta: "Explore Corporate",
      href: "/partners",
      image: corpImg,
      module: "corporate",
    },
  ];
  const cards =
    Array.isArray(c.cards) && (c.cards as any[]).length > 0
      ? (c.cards as Array<{
          icon?: string;
          title?: string;
          desc?: string;
          cta?: string;
          href?: string;
          image?: string;
          module?: string;
        }>)
      : defaultCards;

  // Hide cards whose underlying module/program the tenant has switched off.
  const visibleCards = cards.filter(
    (card) => !card.module || modules[card.module] !== false,
  );

  if (c.enabled === false) return null;

  return (
    <section className="py-10 sm:py-14">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="mb-6 sm:mb-8"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {heading}
          </h2>
          <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">
            {subheading}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {visibleCards.slice(0, 3).map((card, i) => {
            const Icon = ICONS[card.icon || ""] || Briefcase;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.5,
                  delay: 0.1 + i * 0.08,
                  ease: [0.23, 1, 0.32, 1],
                }}
                className="group relative overflow-hidden rounded-2xl border border-foreground/10 bg-card p-5 sm:p-6 flex items-center gap-4 hover:border-primary/30 hover:shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.3)] transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-base font-bold text-foreground leading-tight">
                    {card.title}
                  </p>
                  <p className="mt-1 text-xs sm:text-[13px] text-muted-foreground leading-snug max-w-[200px]">
                    {card.desc}
                  </p>
                  <Link
                    to={card.href || "#"}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:gap-1.5 transition-all"
                  >
                    {card.cta || "Learn more"}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {card.image && (
                  <img
                    src={card.image}
                    alt=""
                    loading="lazy"
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain shrink-0 group-hover:scale-105 transition-transform"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GrowYourBusiness;
