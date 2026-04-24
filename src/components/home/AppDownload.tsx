import { motion } from "framer-motion";
import { Smartphone, Star, Download, CheckCircle2, Sparkles, Bell, MapPin, Ticket } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useSiteBranding } from "@/hooks/useSiteBranding";

const defaultPerks = [
  { icon: Ticket, text: "Exclusive app-only deals & flash sales" },
  { icon: Bell, text: "Real-time flight tracking & gate alerts" },
  { icon: MapPin, text: "Offline access to all your bookings" },
  { icon: Sparkles, text: "Instant price drop notifications" },
];

const AppDownload = () => {
  const { content } = useSiteContent();
  const { branding } = useSiteBranding();
  const cfg = content.app_download;

  if (cfg.enabled === false) return null;

  const appName = cfg.app_name || branding.site_name || "TravelVela";
  const tagline = cfg.tagline || "Your travel companion";
  const heading = cfg.heading || "Travel Smarter";
  const headingAccent = cfg.heading_accent || "With Our App";
  const description = cfg.description || "Get exclusive app-only deals, manage bookings on the go, and receive real-time alerts — all from your pocket.";
  const perks = cfg.perks?.length ? cfg.perks : defaultPerks.map(p => p.text);
  const appStoreUrl = cfg.app_store_url || "#";
  const playStoreUrl = cfg.play_store_url || "#";
  const rating = cfg.rating || "4.9";
  const reviewCount = cfg.review_count || "50K+";

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      {/* Premium dark background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,55%,16%)] via-[hsl(222,50%,12%)] to-[hsl(222,48%,8%)]" />
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(ellipse at 15% 35%, hsl(14 90% 58% / 0.05) 0%, transparent 50%), radial-gradient(ellipse at 85% 65%, hsl(222 55% 50% / 0.06) 0%, transparent 50%)"
      }} />
      {/* Grain */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">
          {/* Phone mockup — premium glass */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.7, type: "spring" }}
            className="relative flex-shrink-0"
          >
            {/* Ambient glow behind phone */}
            <div className="absolute inset-0 bg-accent/[0.06] rounded-[3rem] blur-3xl scale-110" />

            <div
              className="relative w-56 h-[400px] sm:w-64 sm:h-[460px] rounded-[2.5rem] border border-white/[0.08] flex flex-col items-center justify-center p-6 overflow-hidden"
              style={{
                background: "linear-gradient(160deg, hsl(0 0% 100% / 0.07), hsl(0 0% 100% / 0.02))",
                backdropFilter: "blur(16px)",
                boxShadow: "0 30px 80px -20px hsl(222 50% 4% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.05)"
              }}
            >
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-[hsl(222,50%,10%)] rounded-b-xl" />
              
              {/* App icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 shadow-xl shadow-primary/20">
                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <p className="text-white font-bold text-lg sm:text-xl text-center">{appName}</p>
              <p className="text-white/35 text-[11px] text-center mt-1 font-medium">{tagline}</p>
              <div className="flex items-center gap-1 mt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-accent text-accent" />
                ))}
                <span className="text-white/45 text-xs ml-1.5 font-bold">{rating}</span>
              </div>
              <p className="text-white/25 text-[10px] mt-1.5">{reviewCount} Reviews</p>
            </div>

            {/* Floating notification — price drop */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-4 sm:-right-10 top-14 bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-3.5 py-3 max-w-[155px] shadow-xl"
            >
              <p className="text-white text-[10px] font-bold">🔥 Price Drop!</p>
              <p className="text-white/40 text-[9px] mt-0.5">Flight deals just updated</p>
            </motion.div>

            {/* Floating notification — booked */}
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              className="absolute -left-6 sm:-left-12 bottom-20 bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-3.5 py-3 max-w-[145px] shadow-xl"
            >
              <p className="text-accent text-[10px] font-bold">✅ Booked!</p>
              <p className="text-white/40 text-[9px] mt-0.5">Bangkok — 5 days</p>
            </motion.div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-center lg:text-left"
          >
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.06] text-accent text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] mb-6">
              <Download className="w-3 h-3" />
              Mobile App
            </span>
            <h2
              className="text-2xl sm:text-4xl lg:text-[3.25rem] lg:leading-[1.08] font-bold text-white mb-5 tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              {heading}<br />
              <span className="text-accent">{headingAccent}</span>
            </h2>
            <p className="text-white/40 text-sm sm:text-base max-w-md mb-10 mx-auto lg:mx-0 leading-relaxed">
              {description}
            </p>

            <ul className="space-y-4 mb-12 text-left inline-block">
              {perks.map((p: string, i: number) => {
                const PerkIcon = defaultPerks[i]?.icon || CheckCircle2;
                return (
                  <li key={i} className="flex items-center gap-3.5 text-sm text-white/75 font-medium">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/10 flex items-center justify-center flex-shrink-0">
                      <PerkIcon className="w-4 h-4 text-accent" />
                    </div>
                    {p}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <a
                href={appStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-2xl px-6 py-4 transition-all duration-300 hover:scale-[1.02] hover:border-white/[0.12] group"
              >
                <Download className="w-6 h-6 text-white/70 group-hover:text-accent transition-colors" />
                <div className="text-left">
                  <p className="text-[9px] text-white/30 leading-none uppercase tracking-[0.15em] font-semibold">Download on</p>
                  <p className="text-base font-bold text-white leading-tight">App Store</p>
                </div>
              </a>
              <a
                href={playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-2xl px-6 py-4 transition-all duration-300 hover:scale-[1.02] hover:border-white/[0.12] group"
              >
                <Download className="w-6 h-6 text-white/70 group-hover:text-accent transition-colors" />
                <div className="text-left">
                  <p className="text-[9px] text-white/30 leading-none uppercase tracking-[0.15em] font-semibold">Get it on</p>
                  <p className="text-base font-bold text-white leading-tight">Google Play</p>
                </div>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AppDownload;
