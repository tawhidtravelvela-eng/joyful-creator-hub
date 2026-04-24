import { useState } from "react";
import { Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBlockOverride } from "@/hooks/useBlockOverride";

/**
 * newsletter.subscribe-strip — compact full-width blue subscribe strip.
 *
 * Used by the hybrid + b2c-general skins to match the consumer-agent
 * homepage reference. All text is editable per tenant via Studio overrides
 * and the strip uses the tenant's --primary token for its background.
 */
const SubscribeStrip = () => {
  const ov = useBlockOverride();
  const c = ov?.content || {};

  const heading = (c.heading as string) || "Get the best travel deals in your inbox";
  const subheading =
    (c.subheading as string) ||
    "Subscribe to our newsletter and never miss a deal!";
  const placeholder = (c.placeholder as string) || "Enter your email";
  const buttonText = (c.button_text as string) || "Subscribe";

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (c.enabled === false) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert({ email });
      if (error) {
        if (error.code === "23505") {
          toast.info("You're already subscribed! 🎉");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
      } else {
        toast.success("Welcome aboard! 🎉");
        setEmail("");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <section
      className="relative"
      style={{
        background:
          "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.92) 100%)",
      }}
    >
      <div className="container mx-auto px-4 py-5 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
        >
          {/* Copy */}
          <div className="lg:col-span-5 flex items-start gap-3 text-primary-foreground">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-foreground/15 border border-primary-foreground/20 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold leading-tight">
                {heading}
              </p>
              <p className="mt-0.5 text-xs sm:text-sm text-primary-foreground/80 leading-snug">
                {subheading}
              </p>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 flex flex-col sm:flex-row gap-2 sm:gap-3 w-full"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-11 sm:h-12 px-4 rounded-lg bg-background text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-primary-foreground/40 text-sm"
            />
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 sm:h-12 px-6 rounded-lg bg-foreground hover:bg-foreground/90 text-background font-semibold text-sm whitespace-nowrap"
            >
              {submitting ? "Subscribing..." : buttonText}
            </Button>
          </form>
        </motion.div>
      </div>
    </section>
  );
};

export default SubscribeStrip;