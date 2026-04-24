import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, MapPin, Users, Clock, Zap, Plane, Check, Sparkles,
} from "lucide-react";

interface TripDetailsFormCardProps {
  missingFields: string[];
  destination?: string;
  onSubmit: (message: string) => void;
}

const FIELD_CONFIG: Record<string, { icon: typeof Calendar; label: string; placeholder: string }> = {
  "Travel dates": { icon: Calendar, label: "Travel Dates", placeholder: "e.g. Apr 22 – May 5" },
  "Travel dates (start only)": { icon: Calendar, label: "Departure Date", placeholder: "e.g. Apr 22" },
  "Departure city": { icon: Plane, label: "Departure City", placeholder: "e.g. Dubai, London" },
  "Trip duration": { icon: Clock, label: "Trip Duration", placeholder: "e.g. 7 days, 2 weeks" },
  "Number of travelers": { icon: Users, label: "Travelers", placeholder: "e.g. 2 adults, 1 child" },
};

export default function TripDetailsFormCard({ missingFields, destination, onSubmit }: TripDetailsFormCardProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = () => {
    const parts = Object.entries(values)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => {
        if (k === "Travel dates") return `Travel dates: ${v}`;
        if (k === "Departure city") return `Departing from ${v}`;
        if (k === "Trip duration") return `Duration: ${v}`;
        if (k === "Number of travelers") return `Travelers: ${v}`;
        return `${k}: ${v}`;
      });
    if (parts.length > 0) {
      onSubmit(parts.join(". ") + ". Get exact prices for this trip");
    }
  };

  const filledCount = Object.values(values).filter(v => v.trim()).length;
  const total = missingFields.length;
  const allFilled = filledCount === total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl overflow-hidden max-w-md relative"
      style={{
        background: `linear-gradient(170deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--p-card)) 40%, hsl(var(--p-card)) 100%)`,
        boxShadow: `
          0 0 0 1px hsl(var(--primary) / 0.12),
          0 8px 32px -8px hsl(var(--p-shadow)),
          0 0 60px -20px hsl(var(--primary) / 0.08)
        `,
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: `hsl(var(--primary) / 0.06)` }}
      />

      {/* Header */}
      <div className="relative px-5 pt-5 pb-1">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))`,
              boxShadow: `0 0 20px hsl(var(--primary) / 0.1)`,
            }}
            animate={{ rotate: [0, -3, 3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <MapPin className="w-[18px] h-[18px] text-primary" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-[15px] font-bold tracking-tight leading-tight"
              style={{ color: `hsl(var(--p-text))` }}
            >
              Complete Trip Details
            </h3>
            <p className="text-[11px] mt-0.5 font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>
              {destination ? `For your ${destination} trip` : "Fill in to get exact prices"}
            </p>
          </div>
        </div>
      </div>

      {/* Segmented progress */}
      <div className="px-5 pt-3 pb-1">
        <div className="flex gap-1.5">
          {missingFields.map((_, i) => (
            <motion.div
              key={i}
              className="h-[3px] flex-1 rounded-full overflow-hidden"
              style={{ background: `hsl(var(--p-border) / 0.5)` }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: i < filledCount
                    ? `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))`
                    : 'transparent',
                }}
                initial={{ width: 0 }}
                animate={{ width: i < filledCount ? "100%" : "0%" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
              />
            </motion.div>
          ))}
        </div>
        <p className="text-[10px] mt-1.5 font-medium tracking-wide uppercase" style={{ color: `hsl(var(--p-text-muted))` }}>
          {filledCount} of {total} completed
        </p>
      </div>

      {/* Form Fields */}
      <div className="px-5 pt-2 pb-2 space-y-3">
        {missingFields.map((field, idx) => {
          // Always show "Departure Date" instead of date range — duration handles trip length
          const configKey = field === "Travel dates" ? "Travel dates (start only)" : field;
          const config = FIELD_CONFIG[configKey] || FIELD_CONFIG[field] || {
            icon: MapPin,
            label: field,
            placeholder: `Enter ${field.toLowerCase()}`,
          };
          const Icon = config.icon;
          const isFilled = !!(values[field]?.trim());
          const isFocused = focusedField === field;

          return (
            <motion.div
              key={field}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <label
                className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5 transition-colors duration-200"
                style={{ color: isFocused ? `hsl(var(--primary))` : `hsl(var(--p-text-muted))` }}
              >
                <Icon className="w-3 h-3" />
                {config.label}
                <AnimatePresence>
                  {isFilled && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </label>
              <motion.div
                className="relative rounded-xl overflow-hidden transition-all duration-300"
                animate={{
                  boxShadow: isFocused
                    ? `0 0 0 1.5px hsl(var(--primary) / 0.5), 0 4px 16px -4px hsl(var(--primary) / 0.15)`
                    : isFilled
                      ? `0 0 0 1px hsl(var(--primary) / 0.25)`
                      : `0 0 0 1px hsl(var(--p-border) / 0.4)`,
                }}
              >
                <input
                  type="text"
                  placeholder={config.placeholder}
                  value={values[field] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                  onFocus={() => setFocusedField(field)}
                  onBlur={() => setFocusedField(null)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  className="w-full h-11 px-3.5 text-[13px] font-medium outline-none transition-all duration-200 placeholder:font-normal"
                  style={{
                    background: isFocused
                      ? `hsl(var(--primary) / 0.04)`
                      : `hsl(var(--p-surface) / 0.4)`,
                    color: `hsl(var(--p-text))`,
                  }}
                />
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Submit */}
      <div className="px-5 pb-5 pt-2">
        <motion.button
          onClick={handleSubmit}
          disabled={filledCount === 0}
          whileHover={filledCount > 0 ? { scale: 1.015, y: -1 } : {}}
          whileTap={filledCount > 0 ? { scale: 0.985 } : {}}
          className="w-full h-12 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all duration-300 disabled:cursor-not-allowed relative overflow-hidden"
          style={{
            background: allFilled
              ? `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))`
              : filledCount > 0
                ? `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))`
                : `hsl(var(--primary) / 0.15)`,
            color: filledCount > 0
              ? `hsl(var(--primary-foreground))`
              : `hsl(var(--primary) / 0.5)`,
            boxShadow: filledCount > 0
              ? `0 4px 20px -4px hsl(var(--primary) / 0.35), 0 0 40px -12px hsl(var(--primary) / 0.2)`
              : 'none',
          }}
        >
          {/* Shimmer on all-filled */}
          {allFilled && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.15), transparent)`,
              }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          )}
          {allFilled ? (
            <Sparkles className="w-4 h-4" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          <span className="relative z-10">
            {allFilled
              ? "Get Exact Prices"
              : `Fill ${total - filledCount} more to unlock prices`}
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}
