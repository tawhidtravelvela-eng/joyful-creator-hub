import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Plane, Hotel, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getBlogCTAStrings } from "./blogCTAStrings";

const AiConversionBlock = ({ language }: { language?: string | null }) => {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();
  const t = getBlogCTAStrings(language);

  const handleGenerate = () => {
    navigate(prompt.trim() ? `/trip-planner?prompt=${encodeURIComponent(prompt)}` : "/trip-planner");
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-3xl overflow-hidden"
      aria-label="AI trip planning"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,55%,14%)] via-[hsl(222,50%,10%)] to-[hsl(222,45%,8%)]" />
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: "radial-gradient(ellipse at 20% 50%, hsl(14 90% 58% / 0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, hsl(222 55% 45% / 0.12) 0%, transparent 50%)"
      }} />

      <div className="relative z-10 p-8 sm:p-12 lg:p-16">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/15 border border-accent/20">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] font-bold text-accent tracking-widest uppercase">{t.aiPowered}</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            {t.planTrip}<br className="hidden sm:block" />
            <span className="text-accent">Smarter</span>
          </h2>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            {t.planTripSub}
          </p>

          <div className="flex flex-wrap gap-2 justify-center">
            {t.promptChips.map(chip => (
              <button
                key={chip}
                onClick={() => setPrompt(chip)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-300 border",
                  prompt === chip
                    ? "bg-accent/20 border-accent/40 text-accent"
                    : "bg-white/[0.06] border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/15"
                )}
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            onSubmit={e => { e.preventDefault(); handleGenerate(); }}
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
          >
            <label htmlFor="ai-trip-input" className="sr-only">{t.describeTrip}</label>
            <Input
              id="ai-trip-input"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={t.describeTrip}
              className="h-12 rounded-xl bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:border-accent/50 focus:ring-accent/20 flex-1"
            />
            <Button type="submit" className="h-12 px-6 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold shadow-lg shadow-accent/30">
              {t.generatePlan} <Sparkles className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="grid grid-cols-3 gap-3 pt-4 max-w-md mx-auto">
            {[
              { icon: Plane, label: t.flights, sub: t.flightsSub, to: "/flights" },
              { icon: Hotel, label: t.hotels, sub: t.hotelsSub, to: "/hotels" },
              { icon: MapPin, label: t.itinerary, sub: t.itinerarySub, to: "/trip-planner" },
            ].map(item => (
              <Link
                key={item.label}
                to={item.to}
                className="bg-white/[0.06] border border-white/[0.08] rounded-xl p-3 text-center hover:bg-white/[0.1] transition-colors"
              >
                <item.icon className="w-5 h-5 text-accent mx-auto mb-1.5" />
                <p className="text-xs font-bold text-white">{item.label}</p>
                <p className="text-[10px] text-white/55">{item.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default AiConversionBlock;
