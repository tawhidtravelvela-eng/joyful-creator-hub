import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane, Car, Hotel, Camera, Utensils, MapPin, Clock, Coffee,
  ChevronDown, ChevronRight, Check, X, Shield, ArrowRightLeft,
  Sun, Users, Eye, RefreshCw, Sparkles, Zap, Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildTourUrl } from "@/utils/tourSlug";
import AlternativesDrawer from "./AlternativesDrawer";
import { RECOMMENDATION_BADGES, TAG_COLORS } from "./badgeConfig";
import type { TimelineItemData } from "./types";

const TYPE_ICON: Record<string, React.ElementType> = {
  flight: Plane, transfer: Car, hotel: Hotel, activity: Camera,
  meal: Utensils, free: MapPin, buffer: Coffee,
};

const TYPE_ACCENT: Record<string, string> = {
  flight: "hsl(var(--primary))",
  transfer: "hsl(var(--warning))",
  hotel: "hsl(var(--accent))",
  activity: "hsl(var(--primary))",
  meal: "hsl(25 80% 55%)",
  free: "hsl(var(--success))",
  buffer: "hsl(var(--p-text-faint))",
};

// AI match quality labels
function getAiMatchLabel(score: number): { label: string; color: string } | null {
  if (score >= 90) return { label: "Perfect Match", color: "hsl(var(--success))" };
  if (score >= 75) return { label: "Great Match", color: "hsl(var(--primary))" };
  if (score >= 55) return { label: "Good Fit", color: "hsl(var(--warning))" };
  return null; // Below 55 — don't show
}

// Format duration for display
function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

interface Props {
  item: TimelineItemData;
  isLast?: boolean;
  formatPrice: (n: number) => string;
  onReplace?: (itemId: string) => void;
  onAlternativeSelect?: (itemId: string, optionId: string) => void;
}

const TimelineItem: React.FC<Props> = ({ item, isLast, formatPrice, onReplace, onAlternativeSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const Icon = TYPE_ICON[item.type] || Camera;
  const accent = TYPE_ACCENT[item.type] || "hsl(var(--p-text-muted))";
  const isActivity = item.type === "activity";
  const isBookable = item.isBookable && item.price != null && item.price > 0;
  const isFree = item.source === "free" || (item.type === "free");
  const hasAlternatives = item.options && item.options.length > 0;
  const badge = item.recommendationBadge ? RECOMMENDATION_BADGES[item.recommendationBadge] : null;
  const aiMatch = item.aiMatchScore ? getAiMatchLabel(item.aiMatchScore) : null;

  // Travel time indicator
  const travelNote = item.travelMinutesFromPrevious && item.travelMinutesFromPrevious > 0
    ? `${item.travelMinutesFromPrevious} min travel`
    : null;

  return (
    <div className="relative">
      {/* Travel time from previous */}
      {travelNote && (
        <div className="flex items-center gap-2 pl-[22px] py-1">
          <div className="w-px h-3 shrink-0" style={{ background: "hsl(var(--p-border))" }} />
          <span className="text-[9px] font-medium flex items-center gap-1"
            style={{ color: "hsl(var(--p-text-faint))" }}>
            <Car className="w-2.5 h-2.5" /> {travelNote}
          </span>
        </div>
      )}

      {/* Main timeline row */}
      <div className="flex gap-3">
        {/* Timeline dot + line */}
        <div className="flex flex-col items-center shrink-0 w-[12px]">
          <div className="w-[10px] h-[10px] rounded-full border-2 shrink-0 mt-1.5"
            style={{
              borderColor: accent,
              background: isBookable ? accent : "transparent",
            }}
          />
          {!isLast && (
            <div className="flex-1 w-px min-h-[20px]"
              style={{ background: `linear-gradient(to bottom, ${accent}55, hsl(var(--p-border) / 0.3))` }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-4">
          {/* Clickable header */}
          <button
            onClick={() => isActivity && setExpanded(!expanded)}
            className={`w-full text-left rounded-xl transition-all ${isActivity ? "cursor-pointer active:scale-[0.99]" : ""}`}
            style={{
              background: expanded ? "hsl(var(--p-card))" : "transparent",
              padding: expanded ? "12px" : "0",
            }}
            disabled={!isActivity}
          >
            {/* Time + Title row */}
            <div className="flex items-start gap-2">
              {/* Time */}
              {item.startTime && (
                <span className="text-[11px] font-mono font-bold shrink-0 w-[44px] pt-0.5"
                  style={{ color: accent }}>
                  {item.startTime}
                </span>
              )}

              {/* Icon */}
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${accent}15` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
              </div>

              {/* Title block */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Title — linked if bookable */}
                  {item.productCode ? (
                    <a
                      href={buildTourUrl({
                        title: item.productName || item.title,
                        destination: item.city || "",
                        productCode: item.productCode,
                        velaId: item.velaId,
                        slug: item.slug,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-bold leading-snug hover:underline transition-colors"
                      style={{ color: accent }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.productName || item.title}
                    </a>
                  ) : (
                    <span className="text-[12px] font-bold leading-snug"
                      style={{ color: item.type === "buffer" ? "hsl(var(--p-text-faint))" : "hsl(var(--p-text))" }}>
                      {item.title}
                    </span>
                  )}
                </div>

                {/* Selected option variant (e.g., "Express Pass") */}
                {item.optionTitle && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold rounded-full px-2 py-0.5 mt-0.5"
                    style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                    <Sparkles className="w-2.5 h-2.5" />
                    {item.optionTitle}
                  </span>
                )}

                {item.type === "flight" && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {item.airline && (
                      <span className="text-[10px] font-semibold rounded-md px-1.5 py-0.5"
                        style={{ background: `${accent}12`, color: accent }}>
                        {item.airline}
                      </span>
                    )}
                    {item.flightNumber && (
                      <span className="text-[10px] font-mono" style={{ color: "hsl(var(--p-text-muted))" }}>
                        {item.flightNumber}
                      </span>
                    )}
                    {item.durationMinutes && (
                      <span className="text-[10px]" style={{ color: "hsl(var(--p-text-faint))" }}>
                        · {formatDuration(item.durationMinutes)}
                      </span>
                    )}
                  </div>
                )}

                {item.type === "transfer" && item.vehicleType && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold rounded-md px-1.5 py-0.5"
                      style={{ background: "hsl(var(--warning) / 0.1)", color: "hsl(var(--warning))" }}>
                      {item.vehicleType}
                    </span>
                    {item.durationMinutes && (
                      <span className="text-[10px]" style={{ color: "hsl(var(--p-text-faint))" }}>
                        ~{item.durationMinutes} min
                      </span>
                    )}
                  </div>
                )}

                {item.type === "hotel" && item.subtitle && (
                  <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--p-text-muted))" }}>
                    {item.subtitle}
                  </p>
                )}

                {item.type === "buffer" && item.subtitle && (
                  <p className="text-[10px] italic" style={{ color: "hsl(var(--p-text-faint))" }}>
                    {item.subtitle}
                  </p>
                )}

                {/* Reasoning line */}
                {item.reasoning && (
                  <p className="text-[10px] mt-1 leading-relaxed"
                    style={{ color: "hsl(var(--p-text-subtle))" }}>
                    💡 {item.reasoning}
                  </p>
                )}

                {/* ── Info chips row: Duration + Zone + AI Score + Free badge + Best time ── */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {/* Duration chip */}
                  {isActivity && item.durationMinutes && item.durationMinutes > 0 && (
                    <span className="text-[9px] font-semibold flex items-center gap-0.5 rounded-full px-2 py-0.5"
                      style={{
                        color: "hsl(var(--primary))",
                        background: "hsl(var(--primary) / 0.08)",
                      }}>
                      <Clock className="w-2.5 h-2.5" />
                      {formatDuration(item.durationMinutes)}
                    </span>
                  )}

                  {/* Zone / Area chip */}
                  {isActivity && item.locationArea && (
                    <span className="text-[9px] font-semibold flex items-center gap-0.5 rounded-full px-2 py-0.5"
                      style={{
                        color: "hsl(var(--accent-foreground))",
                        background: "hsl(var(--accent) / 0.12)",
                      }}>
                      <Navigation className="w-2.5 h-2.5" />
                      {item.locationArea}
                    </span>
                  )}

                  {/* AI Match Score chip */}
                  {isActivity && aiMatch && (
                    <span className="text-[9px] font-semibold flex items-center gap-0.5 rounded-full px-2 py-0.5"
                      style={{
                        color: aiMatch.color,
                        background: `${aiMatch.color}14`,
                      }}>
                      <Zap className="w-2.5 h-2.5" />
                      {aiMatch.label}
                    </span>
                  )}

                  {/* Recommendation badge */}
                  {badge && !aiMatch && (
                    <span className="text-[9px] font-bold rounded-full px-2 py-0.5"
                      style={{ color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  )}

                  {/* Free badge */}
                  {isFree && (
                    <span className="text-[9px] font-bold rounded-full px-2 py-0.5"
                      style={{ color: "hsl(var(--success))", background: "hsl(var(--success) / 0.12)" }}>
                      Free
                    </span>
                  )}

                  {/* Best time note */}
                  {item.bestTimeNote && (
                    <span className="text-[9px] font-medium flex items-center gap-0.5"
                      style={{ color: "hsl(25 80% 55%)" }}>
                      <Sun className="w-2.5 h-2.5" /> {item.bestTimeNote}
                    </span>
                  )}
                </div>

                {/* Top inclusions preview (compact — show 2-3 inline) */}
                {isActivity && item.includes && item.includes.length > 0 && !expanded && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {item.includes.slice(0, 3).map((inc, ii) => (
                      <span key={ii} className="text-[8px] font-medium flex items-center gap-0.5"
                        style={{ color: "hsl(var(--success) / 0.8)" }}>
                        <Check className="w-2 h-2" />{inc}
                      </span>
                    ))}
                    {item.includes.length > 3 && (
                      <span className="text-[8px]" style={{ color: "hsl(var(--p-text-faint))" }}>
                        +{item.includes.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Places covered preview (collapsed) */}
                {isActivity && item.placesCovered && item.placesCovered.length > 0 && !expanded && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {item.placesCovered.slice(0, 3).map((place, pi) => (
                      <span key={pi} className="text-[8px] font-medium flex items-center gap-0.5"
                        style={{ color: "hsl(var(--primary) / 0.8)" }}>
                        <MapPin className="w-2 h-2" />{place}
                      </span>
                    ))}
                    {item.placesCovered.length > 3 && (
                      <span className="text-[8px]" style={{ color: "hsl(var(--p-text-faint))" }}>
                        +{item.placesCovered.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.tags.slice(0, 4).map((tag, ti) => (
                      <span key={ti} className="text-[8px] font-semibold rounded px-1.5 py-0.5"
                        style={{
                          color: TAG_COLORS[tag.toLowerCase()] || "hsl(var(--p-text-muted))",
                          background: (TAG_COLORS[tag.toLowerCase()] || "hsl(var(--p-text-muted))") + "14",
                        }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price + Expand */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                {isBookable && (
                  <div className="text-right">
                    {item.originalPrice && item.originalPrice > (item.price || 0) && (
                      <span className="text-[9px] line-through block"
                        style={{ color: "hsl(var(--p-text-faint))" }}>
                        {formatPrice(item.originalPrice)}
                      </span>
                    )}
                    <span className="text-[12px] font-bold" style={{ color: accent }}>
                      {formatPrice(item.price!)}
                    </span>
                  </div>
                )}
                {item.type === "transfer" && item.price != null && item.price > 0 && (
                  <span className="text-[12px] font-bold" style={{ color: "hsl(var(--warning))" }}>
                    {formatPrice(item.price)}
                  </span>
                )}
                {isActivity && (
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                    style={{ color: "hsl(var(--p-text-faint))" }} />
                )}
              </div>
            </div>
          </button>

          {/* Expanded details (activity only) */}
          <AnimatePresence>
            {expanded && isActivity && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-xl p-3 space-y-3"
                  style={{
                    background: "hsl(var(--p-card))",
                    border: "1px solid hsl(var(--p-border) / 0.4)",
                  }}>

                  {/* Highlights */}
                  {item.highlights && item.highlights.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5"
                        style={{ color: "hsl(var(--p-text-muted))" }}>
                        Highlights
                      </p>
                      <div className="space-y-1">
                        {item.highlights.slice(0, 4).map((h, hi) => (
                          <div key={hi} className="flex items-start gap-1.5">
                            <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "hsl(var(--success))" }} />
                            <span className="text-[10px] leading-relaxed" style={{ color: "hsl(var(--p-text))" }}>
                              {h}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Places Covered */}
                  {item.placesCovered && item.placesCovered.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5"
                        style={{ color: "hsl(var(--p-text-muted))" }}>
                        Places Covered
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.placesCovered.slice(0, 6).map((place, pi) => (
                          <span key={pi} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                            style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
                            <MapPin className="w-2.5 h-2.5" />
                            {place}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inclusions / Exclusions */}
                  <div className="grid grid-cols-2 gap-3">
                    {item.includes && item.includes.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider mb-1"
                          style={{ color: "hsl(var(--success))" }}>
                          Includes
                        </p>
                        {item.includes.map((inc, ii) => (
                          <div key={ii} className="flex items-center gap-1 mb-0.5">
                            <Check className="w-2.5 h-2.5" style={{ color: "hsl(var(--success))" }} />
                            <span className="text-[9px]" style={{ color: "hsl(var(--p-text-muted))" }}>{inc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.excludes && item.excludes.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider mb-1"
                          style={{ color: "hsl(var(--destructive))" }}>
                          Not included
                        </p>
                        {item.excludes.map((exc, ei) => (
                          <div key={ei} className="flex items-center gap-1 mb-0.5">
                            <X className="w-2.5 h-2.5" style={{ color: "hsl(var(--destructive) / 0.6)" }} />
                            <span className="text-[9px]" style={{ color: "hsl(var(--p-text-faint))" }}>{exc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timing notes */}
                  {(item.bestTimeNote || item.crowdNote || item.bufferMinutesAfter) && (
                    <div className="flex flex-wrap gap-2">
                      {item.bestTimeNote && (
                        <span className="text-[9px] font-medium flex items-center gap-1 rounded-lg px-2 py-1"
                          style={{ background: "hsl(25 80% 55% / 0.1)", color: "hsl(25 80% 55%)" }}>
                          <Sun className="w-3 h-3" /> {item.bestTimeNote}
                        </span>
                      )}
                      {item.crowdNote && (
                        <span className="text-[9px] font-medium flex items-center gap-1 rounded-lg px-2 py-1"
                          style={{ background: "hsl(var(--warning) / 0.1)", color: "hsl(var(--warning))" }}>
                          <Users className="w-3 h-3" /> {item.crowdNote}
                        </span>
                      )}
                      {item.bufferMinutesAfter && item.bufferMinutesAfter > 0 && (
                        <span className="text-[9px] font-medium flex items-center gap-1 rounded-lg px-2 py-1"
                          style={{ background: "hsl(var(--p-surface))", color: "hsl(var(--p-text-faint))" }}>
                          <Clock className="w-3 h-3" /> {item.bufferMinutesAfter}min buffer after
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {item.productCode && (
                      <Button size="sm" variant="outline"
                        className="h-7 rounded-lg text-[10px] font-semibold gap-1"
                        style={{ borderColor: `${accent}33`, color: accent }}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(buildTourUrl({
                            title: item.productName || item.title,
                            destination: item.city || "",
                            productCode: item.productCode!,
                            velaId: item.velaId,
                            slug: item.slug,
                          }), "_blank");
                        }}>
                        <Eye className="w-3 h-3" /> View Details
                      </Button>
                    )}
                    {hasAlternatives && (
                      <Button size="sm" variant="outline"
                        className="h-7 rounded-lg text-[10px] font-semibold gap-1"
                        style={{ borderColor: "hsl(var(--p-border))", color: "hsl(var(--p-text-muted))" }}
                        onClick={(e) => { e.stopPropagation(); setAltOpen(!altOpen); }}>
                        <ArrowRightLeft className="w-3 h-3" /> Alternatives
                      </Button>
                    )}
                    {onReplace && (
                      <Button size="sm" variant="outline"
                        className="h-7 rounded-lg text-[10px] font-semibold gap-1"
                        style={{ borderColor: "hsl(var(--p-border))", color: "hsl(var(--p-text-muted))" }}
                        onClick={(e) => { e.stopPropagation(); onReplace(item.id); }}>
                        <RefreshCw className="w-3 h-3" /> Replace
                      </Button>
                    )}
                  </div>

                  {/* Alternatives drawer */}
                  {hasAlternatives && (
                    <AlternativesDrawer
                      options={item.options!}
                      open={altOpen}
                      onClose={() => setAltOpen(false)}
                      onSelect={(optId) => onAlternativeSelect?.(item.id, optId)}
                      formatPrice={formatPrice}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TimelineItem;
