import { motion, useInView } from "framer-motion";
import { Users, Plane, MapPin, Award, ShieldCheck, Headphones } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useSiteContent } from "@/hooks/useSiteContent";

const iconMap: Record<string, any> = { Users, Plane, MapPin, Award, ShieldCheck, Headphones };

const defaultStats = [
  { icon: "Users", value: 2000000, suffix: "+", label: "Happy Travelers" },
  { icon: "Plane", value: 15000, suffix: "+", label: "Flights Daily" },
  { icon: "MapPin", value: 500, suffix: "+", label: "Destinations" },
  { icon: "ShieldCheck", value: 100, suffix: "%", label: "Secure Booking" },
  { icon: "Headphones", value: 24, suffix: "/7", label: "Expert Support" },
];

function AnimatedNumber({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [current, setCurrent] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      if (target >= 1000000) setCurrent(Math.round(eased * (target / 1000000)) + "M");
      else if (target >= 1000) setCurrent(Math.round(eased * (target / 1000)) + "K");
      else setCurrent(String(Math.round(eased * target)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView, target]);

  return <span ref={ref}>{isInView ? current + suffix : "0"}</span>;
}

const StatsBar = () => {
  const { content } = useSiteContent();
  const statsData = content.stats;
  const stats = statsData.items?.length ? statsData.items : defaultStats;

  return (
    <section className="relative -mt-8 sm:-mt-10 z-20 pb-6 sm:pb-10">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="relative bg-card border border-border/40 rounded-2xl px-4 sm:px-8 py-4 sm:py-5"
          style={{ boxShadow: "0 12px 40px -16px hsl(222 30% 8% / 0.12)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-y-4 gap-x-2 divide-x divide-border/40">
            {stats.map((s: any, i: number) => {
              const Icon = iconMap[s.icon] || Award;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="flex items-center gap-3 px-3 sm:px-5 flex-1 min-w-[140px] justify-center sm:justify-start"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                      <AnimatedNumber target={Number(s.value)} suffix={s.suffix} />
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                      {s.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default StatsBar;
