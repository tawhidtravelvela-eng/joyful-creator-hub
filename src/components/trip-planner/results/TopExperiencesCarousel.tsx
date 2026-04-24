import React from "react";
import { motion } from "framer-motion";
import { Star, Sparkles } from "lucide-react";

interface TopExperiencesCarouselProps {
  highlights?: string[];
  delay?: number;
}

const TopExperiencesCarousel: React.FC<TopExperiencesCarouselProps> = ({ highlights, delay = 0.12 }) => {
  if (!highlights || highlights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <Star className="w-3.5 h-3.5" style={{ color: `hsl(var(--accent))` }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>
          Top Experiences
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {highlights.slice(0, 5).map((exp, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + i * 0.05, duration: 0.2 }}
            className="flex-shrink-0 rounded-xl px-3 py-2 flex items-center gap-2 min-w-0 max-w-[200px] cursor-default"
            style={{
              background: `linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--accent) / 0.04))`,
              border: `1px solid hsl(var(--primary) / 0.12)`,
            }}
          >
            <Sparkles className="w-3 h-3 shrink-0" style={{ color: `hsl(var(--primary))` }} />
            <span className="text-[11px] font-semibold truncate" style={{ color: `hsl(var(--p-text))` }}>
              {exp}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default React.memo(TopExperiencesCarousel);
