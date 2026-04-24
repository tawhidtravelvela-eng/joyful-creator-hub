import { motion } from "framer-motion";
import { Bot, Zap, Target, Globe, ShieldCheck, Headphones, Sparkles, CreditCard } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

const iconMap: Record<string, any> = {
  Bot, Zap, Target, Globe, ShieldCheck, Headphones, Sparkles, CreditCard,
  Wallet: CreditCard, Clock: Zap,
};

const defaultFeatures = [
  {
    icon: "Bot",
    title: "AI-Powered Planning",
    desc: "Our AI builds personalized itineraries in seconds — flights, hotels, and activities optimized for your budget and preferences.",
    accent: "from-primary to-[hsl(213,80%,55%)]",
    stat: "10x faster",
  },
  {
    icon: "Zap",
    title: "Instant Booking",
    desc: "Real-time fare locking and instant e-ticket confirmation across 500+ airlines. No waiting, no callbacks.",
    accent: "from-accent to-[hsl(30,90%,48%)]",
    stat: "< 30s",
  },
  {
    icon: "Target",
    title: "Best Price Matching",
    desc: "We compare fares across multiple global distribution systems simultaneously to guarantee you the lowest price every time.",
    accent: "from-[hsl(152,70%,42%)] to-[hsl(160,60%,35%)]",
    stat: "4 GDS",
  },
  {
    icon: "Globe",
    title: "Global Inventory",
    desc: "Access 100K+ hotels, 900+ airlines, and curated tours across 190+ countries — all in one platform.",
    accent: "from-[hsl(280,70%,50%)] to-[hsl(300,60%,55%)]",
    stat: "190+",
  },
  {
    icon: "ShieldCheck",
    title: "Secure & Trusted",
    desc: "Bank-grade encryption, PCI-compliant payments, and transparent pricing with zero hidden fees.",
    accent: "from-[hsl(180,60%,40%)] to-[hsl(200,70%,50%)]",
    stat: "100%",
  },
  {
    icon: "Headphones",
    title: "24/7 Human Support",
    desc: "Real people, not bots — available around the clock via chat, email, and phone across every time zone.",
    accent: "from-primary to-accent",
    stat: "Always on",
  },
];

const defaultAccents = defaultFeatures.map((f) => f.accent);

const WhyChooseUs = () => {
  const { content } = useSiteContent();
  const { branding } = useSiteBranding();
  const cfg = content.features;
  const features = cfg.items?.length ? cfg.items : defaultFeatures;
  const brandName = branding.site_name || "Our travel platform";
  const heading = cfg.heading || `Why <span class="text-gradient">${brandName}</span>?`;
  const subtitle = cfg.subtitle || "The smartest way to plan, book, and travel — powered by AI and backed by humans.";
  const badge = cfg.badge || `Why ${brandName}`;

  if (cfg.enabled === false) return null;

  return (
    <section className="py-20 sm:py-32 relative overflow-hidden">
      {/* Premium background treatment */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-muted/30" />
      <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-primary/[0.03] rounded-full blur-[150px] pointer-events-none -translate-y-1/3 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/[0.025] rounded-full blur-[120px] pointer-events-none translate-y-1/3 -translate-x-1/4" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/[0.01] rounded-full blur-[100px] pointer-events-none" />
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.008]" style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 sm:mb-20 max-w-2xl mx-auto"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] mb-5">
            <Sparkles className="w-3 h-3" />
            {badge}
          </span>
          <h2
            className="text-2xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] font-bold text-foreground tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(heading) }}
          />
          <p className="text-muted-foreground text-sm sm:text-base mt-4 leading-relaxed max-w-xl mx-auto">{subtitle}</p>
        </motion.div>

        {/* Premium bento grid — 2 large + 4 small */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 max-w-6xl mx-auto">
          {features.map((f: any, i: number) => {
            const Icon = iconMap[f.icon] || ShieldCheck;
            const accent = f.accent || defaultAccents[i % defaultAccents.length];
            const stat = f.stat || defaultFeatures[i]?.stat;
            const isHero = i === 0;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: i * 0.06, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className={cn(
                  "group relative bg-card border border-border/40 rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-500",
                  "shadow-[0_4px_24px_-8px_hsl(222_30%_8%/0.06)]",
                  "hover:border-primary/20 hover:shadow-[0_28px_70px_-12px_hsl(222_30%_8%/0.14),0_0_0_1px_hsl(222_30%_8%/0.03)]",
                  "hover:-translate-y-1.5",
                  isHero ? "sm:col-span-2 lg:col-span-1 p-7 sm:p-9" : "p-6 sm:p-8"
                )}
              >
                {/* Top gradient line */}
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  accent
                )} />

                {/* Hover glow */}
                <div className={cn(
                  "absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br opacity-0 group-hover:opacity-[0.05] transition-opacity duration-600 blur-3xl",
                  accent
                )} />

                {/* Icon + stat row */}
                <div className="flex items-start justify-between mb-6 sm:mb-7 relative z-10">
                  <div className={cn(
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br flex items-center justify-center",
                    "group-hover:scale-105 group-hover:shadow-xl transition-all duration-400",
                    accent
                  )}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  {stat && (
                    <span className={cn(
                      "text-[10px] sm:text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r bg-clip-text text-transparent",
                      "px-3 py-1.5 rounded-full border border-border/30 bg-muted/30",
                      accent
                    )}>
                      {stat}
                    </span>
                  )}
                </div>

                <h3
                  className="text-base sm:text-lg font-bold text-foreground mb-2.5 relative z-10"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  {f.title}
                </h3>
                <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed relative z-10">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
