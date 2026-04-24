import { useState, useEffect } from "react";
import { OffersSkeleton } from "./HomeSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { Percent, Hotel, Map, Plane, ArrowRight, Clock, Zap, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const iconMap: Record<number, React.ElementType> = {
  0: Zap,
  1: Hotel,
  2: Map,
  3: Plane,
};

const gradients = [
  "from-primary to-[hsl(213,80%,55%)]",
  "from-accent to-[hsl(30,90%,48%)]",
  "from-[hsl(152,60%,40%)] to-[hsl(160,50%,35%)]",
  "from-[hsl(280,60%,50%)] to-[hsl(300,50%,45%)]",
];

const OffersSection = () => {
  const [offers, setOffers] = useState<{ id: string; title: string; discount: string; description: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { tenant } = useTenant();

  useEffect(() => {
    let query = supabase
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .order("created_at");

    if (tenant) {
      query = query.or(`tenant_id.eq.${tenant.id},tenant_id.is.null`);
    } else {
      query = query.is("tenant_id", null);
    }

    query.then(({ data }) => {
      if (data && data.length > 0) {
        setOffers(data.map(o => ({
          id: o.id,
          title: o.title,
          discount: o.discount || "",
          description: o.description || "",
          color: o.color,
        })));
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <OffersSkeleton />;
  if (offers.length === 0) return null;

  return (
    <section className="py-12 sm:py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="flex items-end justify-between mb-8 sm:mb-12"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-accent text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-3">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Limited Time
            </span>
            <h2
              className="text-2xl sm:text-4xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Exclusive <span className="text-accent">Deals</span>
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1.5">Handpicked deals updated daily — grab them before they're gone.</p>
          </div>
        </motion.div>

        <div className="flex gap-4 overflow-x-auto pb-2 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 snap-x snap-mandatory scrollbar-hide">
          {offers.map((offer, i) => {
            const Icon = iconMap[i % Object.keys(iconMap).length] || Percent;
            const gradient = gradients[i % gradients.length];
            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to="/flights"
                  className="group relative rounded-2xl sm:rounded-3xl overflow-hidden bg-card border border-border/30 hover:border-primary/20 min-h-[190px] sm:min-h-[220px] min-w-[260px] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink flex flex-col transition-all duration-400 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5"
                >
                  {/* Top gradient bar */}
                  <div className={cn("h-1 w-full bg-gradient-to-r", gradient)} />
                  
                  <div className="p-5 sm:p-7 flex flex-col flex-1">
                    {/* Icon + Urgency */}
                    <div className="flex items-start justify-between mb-5">
                      <div className={cn("w-12 h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300", gradient)}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                        <Clock className="w-2.5 h-2.5" />
                        Limited
                      </div>
                    </div>

                    {/* Discount */}
                    <div className="mb-2">
                      <span className={cn("inline-block text-lg sm:text-xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent", gradient)}>
                        {offer.discount || offer.title}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-5 flex-1">
                      {offer.description}
                    </p>

                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary group-hover:text-accent transition-colors duration-300">
                      Claim Now <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default OffersSection;
