import { motion } from "framer-motion";
import { Plane, Building2, Compass, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * HybridSearchLoader — editorial loader used across the Hybrid skin
 * for Flights, Hotels and Tours search overlays.
 *
 * Visual language matches the Hybrid header: primary→accent gradient
 * hairlines, glassmorphism, ambient glow, uppercase tracking.
 * All colors are routed through semantic tokens (no hardcoded hex).
 */

export type HybridLoaderVariant = "flights" | "hotels" | "tours";

interface Props {
  variant: HybridLoaderVariant;
  title?: string;
  subtitle?: string;
  steps?: string[];
  inline?: boolean;
}

const PRESETS: Record<
  HybridLoaderVariant,
  { icon: LucideIcon; title: string; subtitle: string; steps: string[]; eyebrow: string }
> = {
  flights: {
    icon: Plane,
    eyebrow: "Curating Flights",
    title: "Searching the skies",
    subtitle: "Comparing carriers and live fares for your journey.",
    steps: [
      "Polling carriers worldwide",
      "Comparing fare classes",
      "Checking seat availability",
      "Ranking the best value",
      "Almost ready",
    ],
  },
  hotels: {
    icon: Building2,
    eyebrow: "Curating Stays",
    title: "Finding your perfect stay",
    subtitle: "Sourcing live rates from preferred properties.",
    steps: [
      "Searching properties",
      "Checking room availability",
      "Pulling live rates",
      "Comparing amenities",
      "Curating top picks",
    ],
  },
  tours: {
    icon: Compass,
    eyebrow: "Curating Experiences",
    title: "Discovering experiences",
    subtitle: "Hand-picking tours and activities for you.",
    steps: [
      "Scanning local experiences",
      "Matching destinations",
      "Filtering top-rated tours",
      "Comparing prices",
      "Curating the best picks",
    ],
  },
};

export default function HybridSearchLoader({
  variant,
  title,
  subtitle,
  steps,
  inline = false,
}: Props) {
  const preset = PRESETS[variant];
  const Icon = preset.icon;
  const stepList = steps && steps.length ? steps : preset.steps;
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((i) => (i < stepList.length - 1 ? i + 1 : i));
    }, 2200);
    return () => clearInterval(timer);
  }, [stepList.length]);

  return (
    <div
      className={
        inline
          ? "flex items-center justify-center py-20"
          : "fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md"
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-[min(440px,92vw)] overflow-hidden rounded-[28px] border border-border/60 bg-card/95 backdrop-blur-xl shadow-[0_30px_80px_-30px_hsl(var(--primary)/0.35)]"
      >
        {/* Top hairline — primary→accent gradient, matches HybridHeader */}
        <div
          aria-hidden
          className="h-[2px] w-full"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 50%, hsl(var(--primary)) 100%)",
          }}
        />

        {/* Ambient glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.22), transparent)" }}
        />

        {/* Faint grid overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative px-7 pt-8 pb-7">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="h-px w-6 bg-primary/60" />
            <span className="text-[10px] tracking-[0.22em] uppercase font-semibold text-muted-foreground">
              {preset.eyebrow}
            </span>
            <span className="h-px w-6 bg-accent/60" />
          </div>

          {/* Animated emblem */}
          <div className="relative mx-auto mb-6 h-24 w-24">
            {/* Outer dual-ring */}
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              style={{
                background:
                  "conic-gradient(from 0deg, hsl(var(--primary) / 0.45), transparent 35%, hsl(var(--accent) / 0.45), transparent 70%, hsl(var(--primary) / 0.45))",
                WebkitMask:
                  "radial-gradient(circle, transparent 56%, hsl(0 0% 0%) 57%)",
                mask: "radial-gradient(circle, transparent 56%, hsl(0 0% 0%) 57%)",
              }}
            />
            {/* Inner spinner */}
            <motion.div
              className="absolute inset-3 rounded-full border-[2px] border-primary/30 border-t-primary"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            />
            {/* Center plate */}
            <div className="absolute inset-5 rounded-full bg-card border border-border/60 flex items-center justify-center shadow-[inset_0_0_24px_hsl(var(--primary)/0.12)]">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Icon className="w-7 h-7 text-primary" />
              </motion.div>
            </div>
            {/* Orbit dot */}
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
              <div className="absolute left-1/2 -top-1 -translate-x-1/2 h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.7)]" />
            </motion.div>
          </div>

          <h3 className="text-center font-serif text-[22px] leading-tight font-semibold text-foreground">
            {title || preset.title}
          </h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {subtitle || preset.subtitle}
          </p>

          {/* Progress rail */}
          <div className="mt-6 h-[3px] w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
              }}
              initial={{ width: "8%" }}
              animate={{ width: `${((stepIndex + 1) / stepList.length) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>

          {/* Steps */}
          <ul className="mt-5 space-y-2.5">
            {stepList.map((step, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: i <= stepIndex ? 1 : 0.35, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <span
                    className={cn(
                      "relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
                      done
                        ? "border-primary/40 bg-primary/15"
                        : active
                        ? "border-accent/60 bg-accent/10"
                        : "border-border bg-muted",
                    )}
                  >
                    {done ? (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3 w-3 text-primary"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2.5 6.2 5 8.5l4.5-5" />
                      </svg>
                    ) : active ? (
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full bg-accent"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] tracking-wide transition-colors",
                      done
                        ? "text-foreground/80"
                        : active
                        ? "text-foreground font-medium"
                        : "text-muted-foreground/70",
                    )}
                  >
                    {step}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* Bottom hairline */}
        <div
          aria-hidden
          className="h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--border)) 50%, transparent)",
          }}
        />
      </motion.div>
    </div>
  );
}
