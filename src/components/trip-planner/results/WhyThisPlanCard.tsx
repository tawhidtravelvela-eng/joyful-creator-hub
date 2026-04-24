import React from "react";
import { motion } from "framer-motion";
import { Check, Brain } from "lucide-react";

interface WhyThisPlanCardProps {
  reasons?: string;
  tripStyle?: string;
  delay?: number;
}

const WhyThisPlanCard: React.FC<WhyThisPlanCardProps> = ({ reasons, tripStyle, delay = 0.05 }) => {
  if (!reasons) return null;

  const lines = reasons
    .split(/[•\n]/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(145deg, hsl(var(--success) / 0.05) 0%, hsl(var(--p-card)) 100%)`,
        border: `1px solid hsl(var(--success) / 0.15)`,
        boxShadow: `0 4px 20px hsl(var(--p-shadow))`,
      }}
    >
      <div className="px-4 py-3 border-b flex items-center gap-2.5" style={{ borderColor: `hsl(var(--success) / 0.1)` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `hsl(var(--success) / 0.12)` }}>
          <Brain className="w-3.5 h-3.5" style={{ color: `hsl(var(--success))` }} />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: `hsl(var(--p-text))` }}>Why this plan works</h3>
          {tripStyle && (
            <p className="text-[10px] font-medium" style={{ color: `hsl(var(--success))` }}>{tripStyle}</p>
          )}
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: `hsl(var(--success) / 0.1)` }}>
              <Check className="w-2.5 h-2.5" style={{ color: `hsl(var(--success))` }} />
            </div>
            <p className="text-xs leading-relaxed" style={{ color: `hsl(var(--p-text))` }}>{line}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default React.memo(WhyThisPlanCard);
