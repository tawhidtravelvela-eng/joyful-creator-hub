import type { TimelineItemData } from "./types";

export const RECOMMENDATION_BADGES: Record<NonNullable<TimelineItemData["recommendationBadge"]>, { label: string; color: string; bg: string }> = {
  recommended: { label: "Recommended", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.12)" },
  best_value: { label: "Best Value", color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.12)" },
  popular: { label: "Popular Choice", color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.12)" },
  premium: { label: "Premium Pick", color: "hsl(270 60% 65%)", bg: "hsl(270 60% 65% / 0.12)" },
  family: { label: "Family Pick", color: "hsl(var(--accent))", bg: "hsl(var(--accent) / 0.12)" },
  sunset: { label: "Sunset Pick", color: "hsl(25 90% 55%)", bg: "hsl(25 90% 55% / 0.12)" },
  easy_day: { label: "Easy Day", color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.12)" },
  fast_access: { label: "Fast Access", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.12)" },
};

export const TAG_COLORS: Record<string, string> = {
  skyline: "hsl(217 80% 60%)",
  nature: "hsl(142 55% 48%)",
  adventure: "hsl(25 90% 55%)",
  "family-friendly": "hsl(var(--accent))",
  culture: "hsl(270 55% 60%)",
  walking: "hsl(var(--success))",
  relaxed: "hsl(200 60% 55%)",
  premium: "hsl(270 60% 65%)",
  "best value": "hsl(var(--success))",
  popular: "hsl(var(--warning))",
  "sunset spot": "hsl(25 85% 50%)",
  indoor: "hsl(220 40% 55%)",
  "rain-safe": "hsl(200 55% 50%)",
};
