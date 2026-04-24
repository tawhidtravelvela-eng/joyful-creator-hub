import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSiteContent } from "@/hooks/useSiteContent";
import DOMPurify from "dompurify";

interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  text: string;
  avatar: string | null;
  rating: number;
}

const fallbackTestimonials: Testimonial[] = [
  { id: "1", name: "Sarah Johnson", role: "Frequent Traveler", text: "Amazing service! Found the best deals on flights and the booking process was seamless. The AI planner saved me hours of research.", avatar: null, rating: 5 },
  { id: "2", name: "Michael Chen", role: "Business Traveler", text: "Best travel platform I've used. The price comparison feature saved me hundreds on my business trips. Truly exceptional.", avatar: null, rating: 5 },
  { id: "3", name: "Emma Williams", role: "Adventure Seeker", text: "From budget flights to luxury hotels, they have everything. Their customer support is exceptional and always available!", avatar: null, rating: 5 },
];

const TestimonialsSection = () => {
  const [active, setActive] = useState(0);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(fallbackTestimonials);
  const [direction, setDirection] = useState(0);
  const { tenant } = useTenant();
  const { content } = useSiteContent();
  const tCfg = (content.testimonials || {}) as Record<string, any>;

  useEffect(() => {
    let query = supabase
      .from("testimonials")
      .select("id,name,role,text,avatar,rating")
      .eq("is_active", true)
      .order("created_at");

    if (tenant) {
      query = query.or(`tenant_id.eq.${tenant.id},tenant_id.is.null`);
    } else {
      query = query.is("tenant_id", null);
    }

    query.then(({ data }) => {
      if (data && data.length > 0) setTestimonials(data);
    });
  }, [tenant]);

  // Auto-advance on desktop
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setActive((p) => (p === testimonials.length - 1 ? 0 : p + 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const navigate = useCallback((dir: number) => {
    setDirection(dir);
    setActive((p) => {
      if (dir > 0) return p === testimonials.length - 1 ? 0 : p + 1;
      return p === 0 ? testimonials.length - 1 : p - 1;
    });
  }, [testimonials.length]);

  const t = testimonials[active];
  if (!t) return null;

  const getInitials = (item: Testimonial) =>
    item.avatar || item.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <section className="py-16 sm:py-28 bg-background relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-4">
            <Star className="w-3 h-3 fill-accent" />
            {tCfg.badge || "Testimonials"}
          </span>
          {tCfg.heading ? (
            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(tCfg.heading)) }}
            />
          ) : (
            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Loved by Travelers<br className="hidden sm:block" /> Worldwide
            </h2>
          )}
          {tCfg.subtitle && (
            <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-xl mx-auto">{tCfg.subtitle}</p>
          )}
        </motion.div>

        {/* Featured testimonial - large center card */}
        <div className="max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="relative min-h-[220px] sm:min-h-[240px]">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={active}
                custom={direction}
                initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="bg-card rounded-3xl border border-border/30 p-8 sm:p-10 lg:p-12 relative"
                style={{ boxShadow: "0 20px 60px -15px hsl(222 30% 12% / 0.08)" }}
              >
                {/* Large quote mark */}
                <Quote className="w-10 h-10 sm:w-12 sm:h-12 text-primary/8 absolute top-6 right-6 sm:top-8 sm:right-8" />

                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 sm:w-5 sm:h-5 fill-accent text-accent" />
                  ))}
                </div>

                {/* Quote text */}
                <p
                  className="text-base sm:text-lg lg:text-xl text-foreground/90 leading-relaxed mb-8 font-medium"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  "{t.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center text-primary font-bold text-sm border-2 border-primary/10">
                    {getInitials(t)}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm sm:text-base">{t.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-6 mt-6 sm:mt-8">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > active ? 1 : -1); setActive(i); }}
                  className={cn(
                    "h-2 rounded-full transition-all duration-400",
                    i === active ? "w-8 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => navigate(1)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Desktop: mini cards preview of all testimonials */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {testimonials.slice(0, 3).map((item, i) => (
            <motion.button
              key={item.id}
              onClick={() => { setDirection(i > active ? 1 : -1); setActive(i); }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "text-left bg-card rounded-2xl p-5 border transition-all duration-300",
                i === active
                  ? "border-primary/30 shadow-lg shadow-primary/5 ring-1 ring-primary/10"
                  : "border-border/30 hover:border-border/60 hover:shadow-md"
              )}
            >
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: item.rating }).map((_, j) => (
                  <Star key={j} className="w-3 h-3 fill-accent text-accent" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">"{item.text}"</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                  {getInitials(item)}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-xs">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.role}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
