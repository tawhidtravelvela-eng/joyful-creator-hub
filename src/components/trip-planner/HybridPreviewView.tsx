import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plane, Hotel, MapPin, DollarSign, Calendar,
  Star, Shield, Clock, Info, Zap, TrendingUp, Crown,
  Compass, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ──
export interface PreviewPackage {
  package_type: "best_value" | "premium" | "budget";
  title: string;
  nights: number;
  hotel_or_resort: string;
  room_type?: string;
  meal_plan?: string;
  flight_summary: string;
  transfer_summary?: string;
  experience_summary: string;
  estimated_total_price_range: string;
  price_status: "estimated" | "recent_cache" | "partially_live" | "flexible_dates_estimate";
  confidence_score: number;
}

export interface Assumption {
  key: string;
  value: string;
  source: "user" | "inferred" | "default" | "geo";
  confidence: number;
  booking_safe: boolean;
}

export interface HybridPreviewData {
  mode: "hybrid_preview";
  destination_summary: string;
  trip_type: string;
  traveler_type: string;
  trip_frames: { label: string; duration: string; pacing: string; ideal_for: string; rough_budget_range: string; sample_flow: string[] }[];
  preview_packages: PreviewPackage[];
  assumptions: Assumption[];
  missing_for_exact_pricing: string[];
  experience_clusters?: { name: string; priority: "essential" | "recommended" | "optional"; typical_duration: string }[];
  ai_summary: string;
  destination: string;
}

interface HybridPreviewViewProps {
  data: HybridPreviewData;
  onGetExactPrice: () => void;
  onSendMessage: (text: string) => void;
  onCustomize: (field: string) => void;
}

const packageStyles: Record<string, { icon: typeof Star; gradient: string; accent: string; badge: string; badgeText: string }> = {
  budget: {
    icon: DollarSign,
    gradient: "from-emerald-500/8 to-emerald-500/3",
    accent: "text-emerald-400",
    badge: "bg-emerald-500/15 border-emerald-500/25",
    badgeText: "text-emerald-400",
  },
  best_value: {
    icon: TrendingUp,
    gradient: "from-primary/8 to-primary/3",
    accent: "text-primary",
    badge: "bg-primary/15 border-primary/25",
    badgeText: "text-primary",
  },
  premium: {
    icon: Crown,
    gradient: "from-amber-500/8 to-amber-500/3",
    accent: "text-amber-400",
    badge: "bg-amber-500/15 border-amber-500/25",
    badgeText: "text-amber-400",
  },
};

const priceStatusConfig: Record<string, { label: string; icon: typeof Shield }> = {
  estimated: { label: "Estimated", icon: Info },
  recent_cache: { label: "Recent cache", icon: Shield },
  partially_live: { label: "Partial live", icon: Zap },
  flexible_dates_estimate: { label: "Flex estimate", icon: Calendar },
};

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `hsl(var(--p-border) / 0.4)` }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `hsl(var(--primary))` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
      </div>
      <span className="text-[9px] font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>{pct}%</span>
    </div>
  );
}

// Price ranges come directly from AI in user's currency — no conversion needed

export default function HybridPreviewView({ data, onGetExactPrice, onSendMessage, onCustomize }: HybridPreviewViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-5 pb-6"
    >
      {/* ── Hero Summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="rounded-3xl overflow-hidden relative"
        style={{
          background: `linear-gradient(160deg, hsl(var(--primary) / 0.1) 0%, hsl(var(--p-card)) 50%)`,
          boxShadow: `0 0 0 1px hsl(var(--primary) / 0.12), 0 8px 32px -8px hsl(var(--p-shadow))`,
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl pointer-events-none"
          style={{ background: `hsl(var(--primary) / 0.08)` }}
        />
        <div className="relative px-5 py-5">
          <div className="flex items-start gap-3.5">
            <motion.div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))`,
                boxShadow: `0 0 20px hsl(var(--primary) / 0.1)`,
              }}
              animate={{ rotate: [0, -2, 2, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-5 h-5 text-primary" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <h3
                className="text-[15px] font-bold tracking-tight leading-snug"
                style={{ color: `hsl(var(--p-text))` }}
              >
                {data.destination_summary || `Trip to ${data.destination}`}
              </h3>
              <p
                className="text-[12px] mt-1.5 leading-relaxed"
                style={{ color: `hsl(var(--p-text-muted))` }}
              >
                {data.ai_summary}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Preview Packages ── */}
      {data.preview_packages.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `hsl(var(--primary) / 0.1)` }}>
              <Compass className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: `hsl(var(--p-text-muted))` }}>
              Estimated Packages
            </span>
          </div>
          <div className="space-y-3">
            {data.preview_packages.map((pkg, i) => {
              const style = packageStyles[pkg.package_type] || packageStyles.best_value;
              const Icon = style.icon;
              const status = priceStatusConfig[pkg.price_status] || priceStatusConfig.estimated;
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, type: "spring", stiffness: 300, damping: 25 }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: `hsl(var(--p-card))`,
                    boxShadow: `0 0 0 1px hsl(var(--p-border) / 0.5), 0 4px 20px -6px hsl(var(--p-shadow))`,
                  }}
                >
                  {/* Package header */}
                  <div className={`bg-gradient-to-r ${style.gradient} px-4 py-3`}>
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl border ${style.badge} flex items-center justify-center shrink-0`}
                      >
                        <Icon className={`w-4 h-4 ${style.accent}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold truncate" style={{ color: `hsl(var(--p-text))` }}>
                          {pkg.title}
                        </p>
                        <p className="text-[10px] font-medium mt-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
                          {pkg.nights} nights · {pkg.package_type.replace("_", " ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold whitespace-nowrap" style={{ color: `hsl(var(--p-text))` }}>
                          {(() => {
                            // Extract just the price range, strip verbose descriptions
                            const raw = pkg.estimated_total_price_range || "";
                            const match = raw.match(/^[^(]*/);
                            return (match ? match[0].trim() : raw) || raw;
                          })()}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <StatusIcon className="w-2.5 h-2.5" style={{ color: `hsl(var(--p-text-subtle))` }} />
                          <span className="text-[9px] font-medium" style={{ color: `hsl(var(--p-text-subtle))` }}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Package details */}
                  <div className="px-4 py-2.5 space-y-1.5">
                    {[
                      { icon: Hotel, text: `${pkg.hotel_or_resort}${pkg.meal_plan ? ` · ${pkg.meal_plan}` : ""}` },
                      { icon: Plane, text: pkg.flight_summary },
                      ...(pkg.transfer_summary ? [{ icon: MapPin, text: pkg.transfer_summary }] : []),
                      ...(pkg.experience_summary ? [{ icon: Star, text: pkg.experience_summary }] : []),
                    ].map((item, j) => (
                      <div key={j} className="flex items-center gap-2 text-[11px]" style={{ color: `hsl(var(--p-text-muted))` }}>
                        <item.icon className="w-3 h-3 shrink-0" style={{ color: `hsl(var(--p-text-subtle))` }} />
                        <span className="truncate">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Confidence bar */}
                  <div className="px-4 pb-3 pt-1">
                    <ConfidenceBar score={pkg.confidence_score} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Experience Clusters ── */}
      {data.experience_clusters && data.experience_clusters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `hsl(var(--primary) / 0.1)` }}>
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: `hsl(var(--p-text-muted))` }}>
              Top Experiences
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.experience_clusters.map((cluster, i) => {
              const priorityStyles = {
                essential: { bg: "hsl(var(--primary) / 0.1)", border: "hsl(var(--primary) / 0.25)", color: "hsl(var(--primary))" },
                recommended: { bg: "hsl(var(--accent) / 0.1)", border: "hsl(var(--accent) / 0.25)", color: "hsl(var(--p-text))" },
                optional: { bg: "hsl(var(--p-surface) / 0.5)", border: "hsl(var(--p-border) / 0.4)", color: "hsl(var(--p-text-muted))" },
              }[cluster.priority];

              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + i * 0.04 }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-medium"
                  style={{
                    background: priorityStyles.bg,
                    border: `1px solid ${priorityStyles.border}`,
                    color: priorityStyles.color,
                  }}
                >
                  {cluster.name}
                  {cluster.typical_duration && (
                    <span className="opacity-50 ml-1 text-[9px]">· {cluster.typical_duration}</span>
                  )}
                </motion.span>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Assumptions ── */}
      {data.assumptions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl px-4 py-3"
          style={{
            background: `hsl(var(--p-surface) / 0.3)`,
            border: `1px solid hsl(var(--p-border) / 0.3)`,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: `hsl(var(--p-text-subtle))` }}>
            <Info className="w-3 h-3" />
            Preview assumptions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.assumptions.map((a, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded-lg text-[10px] font-medium"
                style={{
                  background: a.source === "user" ? `hsl(var(--primary) / 0.1)` : `hsl(var(--p-surface) / 0.6)`,
                  color: a.source === "user" ? `hsl(var(--primary))` : `hsl(var(--p-text-muted))`,
                  border: `1px solid ${a.source === "user" ? `hsl(var(--primary) / 0.2)` : `hsl(var(--p-border) / 0.3)`}`,
                }}
              >
                {a.key}: {a.value}
                {a.source !== "user" && (
                  <span className="opacity-40 ml-0.5">({a.source})</span>
                )}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Quick Style CTAs ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex gap-2"
      >
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 rounded-xl text-[11px] font-semibold gap-1.5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          onClick={() => onSendMessage("Show me a luxury version")}
        >
          <Crown className="w-3.5 h-3.5" />
          Luxury
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-9 rounded-xl text-[11px] font-semibold gap-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
          onClick={() => onSendMessage("Show me a budget version")}
        >
          <DollarSign className="w-3.5 h-3.5" />
          Budget
        </Button>
      </motion.div>
    </motion.div>
  );
}
