import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Crown, TrendingDown, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AlternativeOption } from "./types";

const TYPE_META: Record<AlternativeOption["type"], { icon: React.ElementType; accent: string }> = {
  selected: { icon: Check, accent: "hsl(var(--primary))" },
  premium: { icon: Crown, accent: "hsl(270 60% 65%)" },
  value: { icon: Sparkles, accent: "hsl(var(--success))" },
  budget: { icon: TrendingDown, accent: "hsl(var(--warning))" },
  free_alt: { icon: MapPin, accent: "hsl(var(--p-text-muted))" },
};

interface Props {
  options: AlternativeOption[];
  open: boolean;
  onClose: () => void;
  onSelect: (optionId: string) => void;
  formatPrice: (n: number) => string;
}

const AlternativesDrawer: React.FC<Props> = ({ options, open, onClose, onSelect, formatPrice }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="pt-3 pb-1 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-1"
              style={{ color: "hsl(var(--p-text-muted))" }}>
              <Sparkles className="w-3 h-3" /> Alternative Options
            </p>
            {options.map((opt) => {
              const meta = TYPE_META[opt.type];
              const Icon = meta.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => onSelect(opt.id)}
                  className="w-full text-left rounded-xl p-3 transition-all group/opt"
                  style={{
                    background: opt.isSelected ? `${meta.accent}11` : "hsl(var(--p-card-alt))",
                    border: `1px solid ${opt.isSelected ? meta.accent + "44" : "hsl(var(--p-border) / 0.4)"}`,
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${meta.accent}18` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: meta.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold truncate" style={{ color: "hsl(var(--p-text))" }}>
                          {opt.name}
                        </span>
                        <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
                          style={{ color: meta.accent, background: `${meta.accent}15` }}>
                          {opt.label}
                        </span>
                      </div>
                      {opt.shortDiff && (
                        <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--p-text-muted))" }}>
                          {opt.shortDiff}
                        </p>
                      )}
                      {opt.whyChoose && (
                        <p className="text-[10px] mt-1 italic" style={{ color: "hsl(var(--p-text-subtle))" }}>
                          "{opt.whyChoose}"
                        </p>
                      )}
                      {opt.features && opt.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {opt.features.map((f, fi) => (
                            <span key={fi} className="text-[9px] rounded px-1.5 py-0.5"
                              style={{ background: "hsl(var(--p-surface))", color: "hsl(var(--p-text-muted))" }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {opt.price != null && (
                        <p className="text-[12px] font-bold" style={{ color: meta.accent }}>
                          {formatPrice(opt.price)}
                        </p>
                      )}
                      {opt.priceDelta != null && opt.priceDelta !== 0 && (
                        <p className="text-[9px] font-semibold"
                          style={{ color: opt.priceDelta > 0 ? "hsl(var(--warning))" : "hsl(var(--success))" }}>
                          {opt.priceDelta > 0 ? "+" : ""}{formatPrice(opt.priceDelta)}
                        </p>
                      )}
                      {opt.type === "free_alt" && (
                        <span className="text-[10px] font-bold" style={{ color: "hsl(var(--success))" }}>Free</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AlternativesDrawer;
