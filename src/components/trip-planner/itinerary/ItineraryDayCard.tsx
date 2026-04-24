import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, ChevronDown, Sparkles, Clock, Shield, Lightbulb,
  ShoppingCart, PencilLine, RefreshCw, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TimelineItem from "./TimelineItem";
import type { DayCardData } from "./types";

interface Props {
  day: DayCardData;
  defaultOpen?: boolean;
  formatPrice: (n: number) => string;
  onReplace?: (itemId: string) => void;
  onAlternativeSelect?: (itemId: string, optionId: string) => void;
  onBookDay?: (dayNumber: number) => void;
  onCustomizeDay?: (dayNumber: number) => void;
}

const ItineraryDayCard: React.FC<Props> = ({
  day, defaultOpen = false, formatPrice,
  onReplace, onAlternativeSelect, onBookDay, onCustomizeDay,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [notesOpen, setNotesOpen] = useState(false);
  const bookableCount = day.bookableCount ?? day.items.filter(i => i.isBookable).length;
  const totalCount = day.totalCount ?? day.items.filter(i => i.type === "activity" || i.type === "free").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "hsl(var(--p-card))",
        border: "1px solid hsl(var(--p-border) / 0.5)",
        boxShadow: "0 4px 20px -4px hsl(var(--p-shadow))",
      }}
    >
      {/* ── Day Header ── */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3.5 active:bg-primary/5 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Day badge */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.08))",
              border: "1px solid hsl(var(--primary) / 0.2)",
              boxShadow: "0 0 12px hsl(var(--primary) / 0.08)",
            }}>
            <span className="text-sm font-extrabold text-primary">{day.dayNumber}</span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Title + City + Date */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] font-bold truncate" style={{ color: "hsl(var(--p-text))" }}>
                {day.title}
              </h3>
              {/* City badge — show both cities on transition days */}
              {day.departureCity && day.arrivalCity ? (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-0.5 shrink-0"
                  style={{
                    color: "hsl(var(--primary))",
                    background: "hsl(var(--primary) / 0.1)",
                    border: "1px solid hsl(var(--primary) / 0.15)",
                  }}>
                  <MapPin className="w-2.5 h-2.5" /> {day.departureCity}
                  <ArrowRight className="w-2.5 h-2.5 mx-0.5" />
                  {day.arrivalCity}
                </span>
              ) : day.city ? (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-0.5 shrink-0"
                  style={{
                    color: "hsl(var(--success))",
                    background: "hsl(var(--success) / 0.1)",
                    border: "1px solid hsl(var(--success) / 0.15)",
                  }}>
                  <MapPin className="w-2.5 h-2.5" /> {day.city}
                </span>
              ) : null}
              {day.date && (
                <span className="text-[9px] font-medium" style={{ color: "hsl(var(--p-text-muted))" }}>
                  {day.date}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {totalCount > 0 && (
                <span className="text-[10px] font-medium" style={{ color: "hsl(var(--p-text-muted))" }}>
                  {totalCount} activit{totalCount === 1 ? "y" : "ies"}
                </span>
              )}
              {day.totalPrice != null && day.totalPrice > 0 && (
                <span className="text-[10px] font-bold" style={{ color: "hsl(var(--primary))" }}>
                  {formatPrice(day.totalPrice)}
                </span>
              )}
              {bookableCount > 0 && (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-0.5"
                  style={{ color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.1)" }}>
                  <Shield className="w-2.5 h-2.5" /> {bookableCount}/{totalCount} Bookable
                </span>
              )}
              {day.paceLabel && (
                <span className="text-[9px] font-medium flex items-center gap-0.5"
                  style={{ color: "hsl(var(--p-text-faint))" }}>
                  <Clock className="w-2.5 h-2.5" /> {day.paceLabel}
                </span>
              )}
            </div>

            {/* AI Summary */}
            {day.summary && (
              <p className="text-[10px] mt-1.5 leading-relaxed"
                style={{ color: "hsl(var(--p-text-subtle))" }}>
                <Sparkles className="w-3 h-3 inline mr-1 text-primary" />
                {day.summary}
              </p>
            )}
          </div>

          <ChevronDown
            className={`w-4 h-4 shrink-0 mt-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: "hsl(var(--p-text-muted))" }}
          />
        </div>
      </button>

      {/* ── Expanded Content ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Divider */}
              <div className="h-px mb-4" style={{ background: "hsl(var(--p-border) / 0.4)" }} />

              {/* Timeline */}
              <div className="space-y-0">
                {day.items.map((item, idx) => (
                  <TimelineItem
                    key={item.id}
                    item={item}
                    isLast={idx === day.items.length - 1}
                    formatPrice={formatPrice}
                    onReplace={onReplace}
                    onAlternativeSelect={onAlternativeSelect}
                  />
                ))}
              </div>

              {/* Smart Notes */}
              {day.smartNotes && day.smartNotes.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setNotesOpen(!notesOpen)}
                    className="w-full flex items-center gap-2 text-left"
                  >
                    <Lightbulb className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(var(--warning))" }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "hsl(var(--warning))" }}>
                      Why This Day Works
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 ml-auto transition-transform ${notesOpen ? "rotate-180" : ""}`}
                      style={{ color: "hsl(var(--p-text-faint))" }}
                    />
                  </button>
                  <AnimatePresence>
                    {notesOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 rounded-xl p-3 space-y-1.5"
                          style={{ background: "hsl(var(--warning) / 0.05)", border: "1px solid hsl(var(--warning) / 0.12)" }}>
                          {day.smartNotes.map((note, ni) => (
                            <div key={ni} className="flex items-start gap-2">
                              <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "hsl(var(--warning))" }} />
                              <p className="text-[10px] leading-relaxed" style={{ color: "hsl(var(--p-text))" }}>
                                {note}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Day Actions */}
              {(onBookDay || onCustomizeDay) && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t"
                  style={{ borderColor: "hsl(var(--p-border) / 0.3)" }}>
                  {onBookDay && bookableCount > 0 && (
                    <Button size="sm"
                      className="h-8 rounded-xl text-[10px] font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => onBookDay(day.dayNumber)}>
                      <ShoppingCart className="w-3 h-3" /> Book Day {day.dayNumber}
                    </Button>
                  )}
                  {onCustomizeDay && (
                    <Button size="sm" variant="outline"
                      className="h-8 rounded-xl text-[10px] font-semibold gap-1"
                      style={{ borderColor: "hsl(var(--p-border))", color: "hsl(var(--p-text-muted))" }}
                      onClick={() => onCustomizeDay(day.dayNumber)}>
                      <PencilLine className="w-3 h-3" /> Customize
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ItineraryDayCard;
