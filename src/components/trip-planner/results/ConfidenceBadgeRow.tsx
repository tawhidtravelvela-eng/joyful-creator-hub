import React from "react";
import { motion } from "framer-motion";
import {
  Shield, Check, Sparkles, Zap, Heart, Route, Star,
  DollarSign, Award, Gem, Wallet,
} from "lucide-react";

interface BackendBadge {
  key: string;
  label: string;
  color: string; // "success" | "primary" | "warning" | "accent" etc.
}

interface ConfidenceBadgeRowProps {
  confidenceMessage?: string;
  conversionScore?: number;
  hasLivePrices?: boolean;
  tripStyle?: string;
  backendBadges?: BackendBadge[];
  confidenceLabel?: string;
  delay?: number;
}

const BADGE_ICONS: Record<string, React.ElementType> = {
  highly_optimized: Award,
  smooth_pace: Check,
  smart_routing: Route,
  best_value: DollarSign,
  family_friendly: Heart,
  luxury: Gem,
  budget_smart: Wallet,
  popular: Star,
  optimized_route: Route,
};

const ConfidenceBadgeRow: React.FC<ConfidenceBadgeRowProps> = ({
  confidenceMessage, conversionScore, hasLivePrices, tripStyle,
  backendBadges, confidenceLabel, delay = 0.1,
}) => {
  // Use backend badges if available, otherwise fall back to legacy logic
  const badges: { icon: React.ElementType; label: string; color: string }[] = [];

  if (backendBadges && backendBadges.length > 0) {
    for (const b of backendBadges) {
      badges.push({
        icon: BADGE_ICONS[b.key] || Sparkles,
        label: b.label,
        color: `var(--${b.color})`,
      });
    }
  } else {
    // Legacy fallback
    if ((conversionScore || 0) >= 50) badges.push({ icon: Check, label: "Validated Itinerary", color: "var(--success)" });
    if ((conversionScore || 0) >= 70) badges.push({ icon: Shield, label: "Conflict-Free", color: "var(--success)" });
    if (hasLivePrices) badges.push({ icon: Zap, label: "Live Price", color: "var(--primary)" });
    badges.push({ icon: Sparkles, label: "AI Optimized", color: "var(--primary)" });
    if (tripStyle && /family|infant|child/i.test(tripStyle)) badges.push({ icon: Heart, label: "Family-Friendly Pace", color: "var(--accent)" });
  }

  // Always add live price badge if not already present
  if (hasLivePrices && !badges.some(b => b.label === "Live Price")) {
    badges.push({ icon: Zap, label: "Live Price", color: "var(--primary)" });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="space-y-2"
    >
      {/* Score + Confidence label */}
      {(conversionScore != null || confidenceLabel) && (
        <div className="flex items-center gap-2 mb-1">
          {conversionScore != null && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                color: `hsl(var(--${conversionScore >= 75 ? "success" : conversionScore >= 50 ? "primary" : "warning"}))`,
                background: `hsl(var(--${conversionScore >= 75 ? "success" : conversionScore >= 50 ? "primary" : "warning"}) / 0.1)`,
              }}
            >
              Score: {conversionScore}/100
            </span>
          )}
          {confidenceLabel && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                color: `hsl(var(--${confidenceLabel === "High Confidence" ? "success" : "primary"}))`,
                background: `hsl(var(--${confidenceLabel === "High Confidence" ? "success" : "primary"}) / 0.08)`,
              }}
            >
              {confidenceLabel}
            </span>
          )}
        </div>
      )}

      {/* Badge chips */}
      <div className="flex flex-wrap gap-1.5">
        {badges.slice(0, 6).map((badge, i) => (
          <span
            key={i}
            className="text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 select-none"
            style={{
              color: `hsl(${badge.color})`,
              background: `hsl(${badge.color} / 0.08)`,
              border: `1px solid hsl(${badge.color} / 0.12)`,
            }}
          >
            <badge.icon className="w-2.5 h-2.5" />
            {badge.label}
          </span>
        ))}
      </div>

      {/* Confidence message */}
      {confidenceMessage && (
        <div
          className="rounded-xl px-3 py-2 flex items-center gap-2"
          style={{
            background: `hsl(var(--success) / 0.04)`,
            border: `1px solid hsl(var(--success) / 0.1)`,
          }}
        >
          <Shield className="w-3 h-3 shrink-0" style={{ color: `hsl(var(--success))` }} />
          <p className="text-[10px] font-medium" style={{ color: `hsl(var(--success))` }}>
            {confidenceMessage}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default React.memo(ConfidenceBadgeRow);
