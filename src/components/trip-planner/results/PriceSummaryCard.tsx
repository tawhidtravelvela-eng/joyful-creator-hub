import React from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Plane, Hotel, Camera, Bus, Car, DollarSign, Zap,
  AlertTriangle, Shield, Sparkles, Download, Loader2,
  PencilLine, Check, Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

const catIcons: Record<string, React.ElementType> = {
  flights: Plane, hotels: Hotel, activities: Camera, transport: Bus,
  transfers: Car, food: DollarSign, shopping: DollarSign, visa: DollarSign,
};

interface PricingIntelligence {
  total_display_price: number;
  live_portion: number;
  cached_portion: number;
  estimated_portion: number;
  confidence_score: number;
  requires_booking_revalidation: boolean;
  component_count: number;
  live_count: number;
  stale_count: number;
}

interface PriceSummaryCardProps {
  breakdown: Record<string, number>;
  formatPrice: (n: number) => string;
  onBook: () => void;
  onCustomize: () => void;
  onDownloadPDF: () => void;
  onSave?: () => void;
  loading: boolean;
  pdfDownloading: boolean;
  saving?: boolean;
  travelers?: number;
  delay?: number;
  pricingIntelligence?: PricingIntelligence;
}

const INCLUSIONS = [
  { key: "flights", label: "Flights included", Icon: Plane },
  { key: "hotels", label: "Hotels included", Icon: Hotel },
  { key: "activities", label: "Activities included", Icon: Camera },
  { key: "transfers", label: "Transfers included", Icon: Car },
];

const PriceSummaryCard: React.FC<PriceSummaryCardProps> = ({
  breakdown, formatPrice, onBook, onCustomize, onDownloadPDF, onSave, loading, pdfDownloading, saving, travelers, delay = 0.6, pricingIntelligence,
}) => {
  const bookableKeys = ["flights", "hotels", "activities", "transfers"];
  const bookableEntries = Object.entries(breakdown).filter(([k]) => bookableKeys.includes(k) && breakdown[k] > 0);
  const estimatedEntries = Object.entries(breakdown).filter(([k]) => !bookableKeys.includes(k) && breakdown[k] > 0);
  const bookableTotal = bookableEntries.reduce((s, [, v]) => s + v, 0);
  const perPerson = travelers && travelers > 0 ? Math.round(bookableTotal / travelers) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: `hsl(var(--p-card))`,
        borderColor: `hsl(var(--primary) / 0.25)`,
        boxShadow: `0 8px 32px hsl(var(--primary) / 0.12), 0 4px 12px hsl(var(--p-shadow))`,
      }}
    >
      {/* ── Header: Total Price ── */}
      <div className="px-4 py-4 border-b"
        style={{ borderColor: `hsl(var(--p-border))`, background: `linear-gradient(145deg, hsl(var(--primary) / 0.08), hsl(var(--p-card)))` }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <DollarSign className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>
            Total Package
          </span>
          {pricingIntelligence ? (
            <span className={`ml-auto text-[9px] font-bold rounded-full px-2 py-0.5 flex items-center gap-0.5 ${
              pricingIntelligence.confidence_score >= 0.8 ? "text-primary bg-primary/10" :
              pricingIntelligence.confidence_score >= 0.5 ? "bg-primary/10" : ""
            }`} style={{
              color: pricingIntelligence.confidence_score >= 0.8 ? undefined : `hsl(var(--warning))`,
              background: pricingIntelligence.confidence_score >= 0.5 ? undefined : `hsl(var(--warning) / 0.1)`,
            }}>
              {pricingIntelligence.confidence_score >= 0.8 ? (
                <><Zap className="w-2.5 h-2.5" /> Live</>
              ) : pricingIntelligence.confidence_score >= 0.5 ? (
                <><Check className="w-2.5 h-2.5" /> Verified</>
              ) : (
                <><AlertTriangle className="w-2.5 h-2.5" /> Estimated</>
              )}
            </span>
          ) : (
            <span className="ml-auto text-[9px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" /> Live
            </span>
          )}
        </div>
        <p className="text-2xl font-extrabold text-primary leading-tight">{formatPrice(bookableTotal)}</p>
        {perPerson && (
          <p className="text-[11px] mt-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
            {formatPrice(perPerson)} per person approx
          </p>
        )}
        {/* Pricing confidence bar */}
        {pricingIntelligence && pricingIntelligence.total_display_price > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-0.5 h-1 rounded-full overflow-hidden" style={{ background: `hsl(var(--p-border))` }}>
              {pricingIntelligence.live_portion > 0 && (
                <div className="h-full rounded-full" style={{
                  width: `${(pricingIntelligence.live_portion / pricingIntelligence.total_display_price) * 100}%`,
                  background: `hsl(var(--success))`,
                }} />
              )}
              {pricingIntelligence.cached_portion > 0 && (
                <div className="h-full rounded-full" style={{
                  width: `${(pricingIntelligence.cached_portion / pricingIntelligence.total_display_price) * 100}%`,
                  background: `hsl(var(--primary))`,
                }} />
              )}
              {pricingIntelligence.estimated_portion > 0 && (
                <div className="h-full rounded-full" style={{
                  width: `${(pricingIntelligence.estimated_portion / pricingIntelligence.total_display_price) * 100}%`,
                  background: `hsl(var(--warning))`,
                }} />
              )}
            </div>
            <div className="flex items-center gap-3 text-[9px]" style={{ color: `hsl(var(--p-text-muted))` }}>
              {pricingIntelligence.live_portion > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(var(--success))` }} />
                  Live {Math.round((pricingIntelligence.live_portion / pricingIntelligence.total_display_price) * 100)}%
                </span>
              )}
              {pricingIntelligence.cached_portion > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(var(--primary))` }} />
                  Cached {Math.round((pricingIntelligence.cached_portion / pricingIntelligence.total_display_price) * 100)}%
                </span>
              )}
              {pricingIntelligence.estimated_portion > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(var(--warning))` }} />
                  Est. {Math.round((pricingIntelligence.estimated_portion / pricingIntelligence.total_display_price) * 100)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bookable Breakdown ── */}
      <div className="px-4 py-3 space-y-2">
        {bookableEntries.map(([key, val]) => {
          const Icon = catIcons[key] || DollarSign;
          return (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 capitalize" style={{ color: `hsl(var(--p-text-muted))` }}>
                <Icon className="w-3.5 h-3.5" /> {key}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5">LIVE</span>
                <span className="font-bold" style={{ color: `hsl(var(--p-text))` }}>{formatPrice(val)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Estimated Costs ── */}
      {estimatedEntries.length > 0 && (
        <>
          <div className="mx-4 border-t" style={{ borderColor: `hsl(var(--p-border))` }} />
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3 h-3" style={{ color: `hsl(var(--p-text-muted))` }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>
                Not included in package
              </span>
            </div>
            <div className="space-y-1.5">
              {estimatedEntries.map(([key, val]) => {
                const Icon = catIcons[key] || DollarSign;
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 capitalize" style={{ color: `hsl(var(--p-text-muted))` }}>
                      <Icon className="w-3.5 h-3.5" /> {key}
                    </span>
                    <span className="font-medium" style={{ color: `hsl(var(--p-text-subtle))` }}>~{formatPrice(val)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── ✔ Inclusions Checklist ── */}
      <div className="mx-4 border-t" style={{ borderColor: `hsl(var(--p-border))` }} />
      <div className="px-4 py-3 grid grid-cols-2 gap-1.5">
        {INCLUSIONS.filter(inc => bookableKeys.includes(inc.key) ? (breakdown[inc.key] || 0) > 0 : true).map(({ key, label, Icon }) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px]" style={{ color: `hsl(var(--p-text-muted))` }}>
            <Check className="w-3 h-3 text-primary shrink-0" />
            <span className="font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Urgency Line ── */}
      <div className="mx-4 border-t" style={{ borderColor: `hsl(var(--p-border))` }} />
      <div className="px-4 py-2.5 flex items-center gap-1.5">
        <Zap className="w-3 h-3 shrink-0" style={{ color: `hsl(var(--warning))` }} />
        <span className="text-[10px] font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>
          Prices may increase soon — availability changes frequently
        </span>
      </div>

      {/* ── CTA Buttons ── */}
      <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--primary) / 0.04)` }}>
        <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
          <Button
            onClick={onBook}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold gap-2 shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
          >
            <ShoppingCart className="w-4 h-4" />
            Book This Trip Now
          </Button>
        </motion.div>

        <Button
          onClick={onCustomize}
          disabled={loading}
          variant="outline"
          className="w-full h-10 rounded-xl text-sm font-semibold gap-2 border-accent/30 text-accent hover:bg-accent/5"
        >
          <PencilLine className="w-4 h-4" />
          Customize Plan
        </Button>

        <div className="flex gap-2">
          <button
            onClick={onDownloadPDF}
            disabled={pdfDownloading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-md transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ color: `hsl(var(--p-text-muted))` }}
          >
            {pdfDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {pdfDownloading ? "Generating…" : "Download PDF"}
          </button>
          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-[10px] font-medium py-1.5 rounded-md transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ color: `hsl(var(--p-text-muted))` }}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3" />}
              {saving ? "Saving…" : "Save Trip"}
            </button>
          )}
        </div>
      </div>

      {/* ── Trust Row (3 items) ── */}
      <div className="px-4 py-2.5 border-t flex items-center justify-center gap-4" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--p-surface) / 0.5)` }}>
        <span className="text-[9px] font-medium flex items-center gap-1" style={{ color: `hsl(var(--p-text-muted))` }}>
          <Shield className="w-2.5 h-2.5" /> Secure booking
        </span>
        <span className="text-[9px] font-medium flex items-center gap-1" style={{ color: `hsl(var(--p-text-muted))` }}>
          <Zap className="w-2.5 h-2.5" /> Instant confirmation
        </span>
        <span className="text-[9px] font-medium flex items-center gap-1" style={{ color: `hsl(var(--p-text-muted))` }}>
          <Headphones className="w-2.5 h-2.5" /> 24/7 support
        </span>
      </div>
    </motion.div>
  );
};

export default React.memo(PriceSummaryCard);
