import { useState } from "react";
import { Mail, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSiteContent } from "@/hooks/useSiteContent";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { content } = useSiteContent();
  const cfg = content.newsletter;

  const heading = cfg.heading || "Never Miss a Deal";
  const subtitle = cfg.subtitle || "Join 50,000+ travelers getting weekly flight deals, travel tips, and exclusive offers delivered to their inbox.";
  const buttonText = cfg.button_text || "Subscribe";
  const placeholder = cfg.placeholder || "Enter your email";

  if (cfg.enabled === false) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("newsletter_subscribers").insert({ email });
      if (error) {
        if (error.code === "23505") {
          toast.info("You're already subscribed! 🎉");
          setSubscribed(true);
        } else {
          toast.error("Something went wrong. Please try again.");
        }
      } else {
        setSubscribed(true);
        toast.success(cfg.success_message || "Welcome aboard! 🎉");
      }
      setEmail("");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <section className="pt-20 sm:pt-28 pb-12 sm:pb-16 relative overflow-hidden bg-foreground">
      {/* Accent glow behind the form area */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[600px] h-[400px] bg-accent/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-primary/[0.04] rounded-full blur-[100px] pointer-events-none" />

      {/* Decorative rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/[0.025] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/[0.015] pointer-events-none" />

      {/* Grain texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/[0.1] border border-accent/[0.15] text-accent text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] mb-6">
              <Sparkles className="w-3 h-3" />
              Exclusive Deals
            </span>
            <h2
              className="text-2xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] font-bold text-white mb-5 tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              {heading}
            </h2>
            <p className="text-white/45 text-sm sm:text-base mb-10 sm:mb-12 max-w-lg mx-auto leading-relaxed">
              {subtitle}
            </p>
          </motion.div>

          {subscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-3 text-accent font-semibold"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-lg">You're subscribed! Check your inbox.</span>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: 0.15 }}
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
            >
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-11 pr-4 py-4 sm:py-[1.125rem] rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-accent/40 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_hsl(14_90%_58%/0.08)] transition-all duration-300 text-sm font-medium"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="h-[52px] sm:h-auto rounded-2xl font-bold px-7 text-sm bg-gradient-to-r from-accent to-accent/85 hover:from-accent/95 hover:to-accent/80 text-white shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/35 hover:scale-[1.02] transition-all duration-300 gap-2"
              >
                {submitting ? (
                  <span className="animate-pulse">Subscribing...</span>
                ) : (
                  <>
                    {buttonText}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </motion.form>
          )}

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-4 sm:gap-6 mt-7"
          >
            {["Free forever", "No spam", "Unsubscribe anytime"].map((t, i) => (
              <span key={i} className="text-white/20 text-[10px] sm:text-[11px] font-medium flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-accent/30" />
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
