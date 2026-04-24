import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BlogNewsletterCta = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({ email: email.trim() });
    setLoading(false);
    if (error) {
      if (error.code === "23505") {
        toast.info("You're already subscribed!");
        setSubmitted(true);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } else {
      setSubmitted(true);
      toast.success("Welcome aboard! 🎉");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-2xl sm:rounded-3xl overflow-hidden"
    >
      {/* Dark navy background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,55%,14%)] via-[hsl(222,50%,10%)] to-[hsl(222,45%,7%)]" />
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: "radial-gradient(ellipse at 30% 50%, hsl(14 90% 58% / 0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, hsl(210 80% 50% / 0.08) 0%, transparent 50%)"
      }} />

      <div className="relative z-10 p-7 sm:p-10 lg:p-14 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/20 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-6 h-6 text-accent" />
          </div>
          <h3
            className="text-xl sm:text-2xl font-bold text-white mb-2"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Get Travel Deals Weekly
          </h3>
          <p className="text-sm text-white/55 mb-6 leading-relaxed">
            Exclusive flight deals, destination guides, and AI trip plans — delivered every Friday.
          </p>
          {submitted ? (
            <div className="flex items-center justify-center gap-2 text-accent font-bold text-sm py-3">
              <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              You're subscribed!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <Input
                id="newsletter-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="h-12 rounded-xl flex-1 bg-white/[0.08] border-white/[0.1] text-white placeholder:text-white/25 focus:border-accent/50 focus:ring-accent/20"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-12 px-6 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-sm shadow-lg shadow-accent/25"
              >
                {loading ? "Subscribing..." : "Subscribe"}
              </Button>
            </form>
          )}
          <p className="text-[10px] text-white/35 mt-4 flex items-center justify-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </motion.section>
  );
};

export default BlogNewsletterCta;
