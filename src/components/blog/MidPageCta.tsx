import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Plane, Hotel, MapPin, Star } from "lucide-react";
import { motion } from "framer-motion";
import { getBlogCTAStrings } from "./blogCTAStrings";

const MidPageCta = ({ language }: { language?: string | null }) => {
  const navigate = useNavigate();
  const t = getBlogCTAStrings(language);
  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-3xl bg-gradient-to-br from-accent/5 via-card to-primary/5 border border-accent/10 overflow-hidden"
      style={{ boxShadow: "0 25px 60px -20px hsl(var(--accent) / 0.08)" }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        <div className="p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest mb-5 w-fit">
            <Star className="w-3 h-3" /> {t.smartTravel}
          </span>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight mb-4"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            {t.turnGuide}<br />
            <span className="text-accent">Your Trip</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-[15px] leading-relaxed mb-6 max-w-md">
            {t.turnGuideSub}
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            <Link to="/flights" className="text-xs font-semibold text-primary hover:text-accent transition-colors flex items-center gap-1">
              <Plane className="w-3 h-3" /> {t.searchFlights}
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/hotels" className="text-xs font-semibold text-primary hover:text-accent transition-colors flex items-center gap-1">
              <Hotel className="w-3 h-3" /> {t.browseHotels}
            </Link>
            <span className="text-muted-foreground/30">·</span>
            <Link to="/tours" className="text-xs font-semibold text-primary hover:text-accent transition-colors flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {t.exploreTours}
            </Link>
          </div>
          <Button
            onClick={() => navigate("/trip-planner")}
            className="w-fit h-12 px-8 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-sm shadow-lg shadow-accent/20"
          >
            {t.startPlanning} <Sparkles className="w-4 h-4 ml-1" />
          </Button>
        </div>
        <div className="hidden lg:flex items-center justify-center p-8 bg-gradient-to-br from-[hsl(222,55%,14%)] to-[hsl(222,45%,8%)] relative overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: "radial-gradient(ellipse at 50% 50%, hsl(14 90% 58% / 0.1) 0%, transparent 70%)"
          }} />
          <div className="relative z-10 w-full max-w-sm space-y-3">
            {[
              { icon: Plane, title: "DAC → BKK", sub: "Non-stop · 3h 45m", label: t.searchFlights },
              { icon: Hotel, title: "Riverside Resort Bangkok", sub: "4.8 ★ · Pool · Spa", label: t.browseHotels },
              { icon: MapPin, title: "Day 1: Grand Palace Tour", sub: "Temples · River cruise · Street food", label: "" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="bg-white/[0.07] border border-white/[0.08] rounded-xl p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{item.title}</p>
                  <p className="text-[11px] text-white/50">{item.sub}</p>
                </div>
                {item.label && <span className="text-xs font-bold text-accent flex-shrink-0">{item.label}</span>}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default MidPageCta;
