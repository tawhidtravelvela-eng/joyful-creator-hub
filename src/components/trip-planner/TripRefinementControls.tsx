import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Users, Plane, Hotel, Compass, ChevronDown,
  Minus, Plus, Baby, Crown, Wallet, Gem, Star, X, Calendar,
  SlidersHorizontal, UtensilsCrossed,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCurrency, type CurrencyCode } from "@/contexts/CurrencyContext";

export interface RefinementState {
  budgetRange: [number, number];
  adults: number;
  children: number;
  infants: number;
  cabinClass: "economy" | "premium_economy" | "business" | "first";
  hotelStars: number;
  travelStyle: "budget" | "comfortable" | "luxury" | "";
  directFlightsOnly: boolean;
  flexibleDates: boolean;
  includeBreakfast: boolean;
}

interface Props {
  state: RefinementState;
  onChange: (state: RefinementState) => void;
  onApply: (refinementText: string, triggerSearch?: boolean) => void;
  loading: boolean;
  hasItinerary: boolean;
  aiTravelers?: { adults: number; children: number; infants: number } | null;
}

const BUDGET_CONFIG: Partial<Record<CurrencyCode, { min: number; max: number; step: number; defaultMin: number; defaultMax: number }>> & { USD: { min: number; max: number; step: number; defaultMin: number; defaultMax: number } } = {
  USD: { min: 100, max: 15000, step: 50, defaultMin: 300, defaultMax: 2000 },
  EUR: { min: 100, max: 14000, step: 50, defaultMin: 250, defaultMax: 1800 },
  GBP: { min: 80, max: 12000, step: 50, defaultMin: 200, defaultMax: 1500 },
  BDT: { min: 5000, max: 1500000, step: 1000, defaultMin: 30000, defaultMax: 200000 },
  CNY: { min: 500, max: 100000, step: 500, defaultMin: 2000, defaultMax: 15000 },
  INR: { min: 5000, max: 1200000, step: 1000, defaultMin: 25000, defaultMax: 150000 },
  AED: { min: 500, max: 50000, step: 100, defaultMin: 1000, defaultMax: 7000 },
  SAR: { min: 500, max: 55000, step: 100, defaultMin: 1000, defaultMax: 7500 },
};

const CABIN_OPTIONS = [
  { id: "economy" as const, label: "Economy", emoji: "💺" },
  { id: "premium_economy" as const, label: "Premium", emoji: "✨" },
  { id: "business" as const, label: "Business", emoji: "🥂" },
  { id: "first" as const, label: "First", emoji: "👑" },
];

const HOTEL_STAR_OPTIONS = [
  { stars: 0, label: "Any" },
  { stars: 3, label: "3★" },
  { stars: 4, label: "4★" },
  { stars: 5, label: "5★" },
];

const STYLE_OPTIONS = [
  { id: "budget" as const, label: "Budget", icon: Wallet, emoji: "💰" },
  { id: "comfortable" as const, label: "Comfort", icon: Gem, emoji: "✨" },
  { id: "luxury" as const, label: "Luxury", icon: Crown, emoji: "👑" },
];

type SheetType = "budget" | "travelers" | "class" | "more" | null;

// Counter row
const CounterRow = ({ label, emoji, subtitle, value, onChange, min = 0, max = 9, disabled = false }: {
  label: string; emoji: string; subtitle: string; value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean;
}) => (
  <div className="flex items-center justify-between py-2.5">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="text-base">{emoji}</span>
      <div>
        <p className="text-sm font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%) / 0.85)` }}>{label}</p>
        <p className="text-[10px]" style={{ color: `hsl(var(--p-text-faint, 222 10% 40%))` }}>{subtitle}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
        style={{ backgroundColor: `hsl(var(--p-card-alt, 222 35% 14%))`, borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))`, border: '1px solid' }}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="text-sm font-bold w-5 text-center" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
        style={{ backgroundColor: `hsl(var(--p-card-alt, 222 35% 14%))`, borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))`, border: '1px solid' }}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// Bottom sheet overlay (mobile)
const BottomSheet = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl safe-area-pb overflow-hidden flex flex-col"
          style={{ backgroundColor: `hsl(var(--p-surface, 222 45% 8%))`, maxHeight: '85vh' }}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: `hsl(var(--p-border-strong, 222 25% 18%))` }} />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: `hsl(var(--p-border, 222 30% 14%))` }}>
            <h3 className="text-sm font-bold" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>{title}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))` }}>
              <X className="w-4 h-4" style={{ color: `hsl(var(--p-text-muted, 222 12% 65%))` }} />
            </button>
          </div>
          <div className="px-5 py-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            {children}
          </div>
          <div className="px-5 py-3 border-t" style={{ borderColor: `hsl(var(--p-border, 222 30% 14%))` }}>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground transition-all active:scale-[0.98]"
              style={{ boxShadow: `0 0 16px hsl(var(--primary) / 0.3)` }}
            >
              Apply
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// Desktop popup overlay
const RefinePopup = ({ open, onClose, children, onApplySearch, needsNewSearch, loading }: {
  open: boolean; onClose: () => void; children: React.ReactNode;
  onApplySearch?: () => void; needsNewSearch: boolean; loading: boolean;
}) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="rounded-2xl overflow-hidden flex flex-col shadow-2xl pointer-events-auto"
            style={{
              backgroundColor: `hsl(var(--p-surface, 222 45% 8%))`,
              border: `1px solid hsl(var(--p-border-strong, 222 25% 18%))`,
              width: 'min(460px, 92vw)',
              maxHeight: '80vh',
            }}
          >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: `hsl(var(--p-border, 222 30% 14%))` }}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>Refine Your Trip</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-primary/10" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))` }}>
              <X className="w-4 h-4" style={{ color: `hsl(var(--p-text-muted, 222 12% 65%))` }} />
            </button>
          </div>
          {/* Content */}
          <div className="px-5 py-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(80vh - 120px)' }}>
            {children}
          </div>
          {/* Footer */}
          <div className="px-5 py-3 border-t flex items-center gap-3" style={{ borderColor: `hsl(var(--p-border, 222 30% 14%))` }}>
            {needsNewSearch ? (
              <button
                onClick={() => { onApplySearch?.(); onClose(); }}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ boxShadow: `0 0 16px hsl(var(--primary) / 0.3)` }}
              >
                {loading ? (
                  <><span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Searching…</>
                ) : (
                  <>🔄 Search with new preferences</>
                )}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground transition-all active:scale-[0.98]"
                style={{ boxShadow: `0 0 16px hsl(var(--primary) / 0.3)` }}
              >
                ✓ Apply & Update
              </button>
            )}
          </div>
          </motion.div>
        </div>
      </>
    )}
  </AnimatePresence>
);

const TripRefinementControls = ({ state, onChange, onApply, loading, hasItinerary, aiTravelers }: Props) => {
  const { currency, formatDirectPrice } = useCurrency();
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  const prevStateRef = useRef<RefinementState>(state);
  const prevCurrencyRef = useRef<CurrencyCode>(currency);

  const budgetCfg = BUDGET_CONFIG[currency] || BUDGET_CONFIG.USD;

  useEffect(() => {
    if (prevCurrencyRef.current !== currency) {
      const cfg = BUDGET_CONFIG[currency] || BUDGET_CONFIG.USD;
      onChange({ ...state, budgetRange: [cfg.defaultMin, cfg.defaultMax] });
      prevCurrencyRef.current = currency;
    }
  }, [currency]);

  const update = useCallback((patch: Partial<RefinementState>) => {
    onChange({ ...state, ...patch });
  }, [state, onChange]);

  const needsNewSearch = hasItinerary && (
    prevStateRef.current.adults !== state.adults ||
    prevStateRef.current.children !== state.children ||
    prevStateRef.current.infants !== state.infants ||
    prevStateRef.current.cabinClass !== state.cabinClass ||
    prevStateRef.current.travelStyle !== state.travelStyle ||
    prevStateRef.current.hotelStars !== state.hotelStars ||
    prevStateRef.current.includeBreakfast !== state.includeBreakfast
  );

  const handleNewSearch = useCallback(() => {
    const parts: string[] = [];
    const prev = prevStateRef.current;
    if (prev.adults !== state.adults || prev.children !== state.children || prev.infants !== state.infants) {
      const pax = [`${state.adults} adult${state.adults > 1 ? "s" : ""}`];
      if (state.children > 0) pax.push(`${state.children} child${state.children > 1 ? "ren" : ""}`);
      if (state.infants > 0) pax.push(`${state.infants} infant${state.infants > 1 ? "s" : ""}`);
      parts.push(`travelers: ${pax.join(", ")}`);
    }
    if (prev.cabinClass !== state.cabinClass) parts.push(`cabin class: ${state.cabinClass.replace("_", " ")}`);
    if (prev.travelStyle !== state.travelStyle) parts.push(`travel style: ${state.travelStyle || "any"}`);
    if (prev.hotelStars !== state.hotelStars) parts.push(`hotel stars: ${state.hotelStars > 0 ? state.hotelStars + "★" : "any"}`);
    if (prev.includeBreakfast !== state.includeBreakfast) parts.push(`breakfast: ${state.includeBreakfast ? "required" : "not required"}`);
    if (parts.length > 0) {
      onApply(`Please update the plan with these preferences: ${parts.join("; ")}`, true);
      prevStateRef.current = { ...state };
    }
  }, [state, onApply]);

  useEffect(() => { prevStateRef.current = state; }, []);

  // Shared refinement content — used in both desktop popup and mobile sheets
  const RefinementContent = () => (
    <div className="space-y-4">
      {/* Travel Style (replaces budget slider) */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: `hsl(var(--p-text-faint, 222 15% 25%))` }}><Compass className="w-3 h-3" /> Budget Preference</p>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => update({ travelStyle: state.travelStyle === opt.id ? "" : opt.id })}
              className={cn("flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-[10px] font-medium transition-all", state.travelStyle === opt.id ? "border-primary/50 bg-primary/15 text-primary" : "")}
              style={state.travelStyle === opt.id ? { boxShadow: `0 0 12px hsl(var(--primary) / 0.2)` } : { borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))` }}>
              <span className="text-sm">{opt.emoji}</span><span>{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[9px] mt-1.5 text-center" style={{ color: `hsl(var(--p-text-faint, 222 15% 25%))` }}>AI will optimize picks based on your preference</p>
      </div>
      {/* Travelers */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: `hsl(var(--p-text-faint, 222 15% 25%))` }}>
          <Users className="w-3 h-3" /> Travelers
          {aiTravelers && (
            <span className="ml-1 text-[8px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `hsl(var(--primary) / 0.15)`, color: `hsl(var(--primary))` }}>
              🔒 Set from conversation
            </span>
          )}
        </p>
        <div className="rounded-xl px-3 py-1" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, borderColor: `hsl(var(--p-border, 222 30% 14%))`, border: '1px solid' }}>
          <CounterRow label="Adults" emoji="🧑" subtitle="12+ years" value={state.adults} onChange={(v) => update({ adults: v })} min={1} max={9} disabled={!!aiTravelers} />
          <div style={{ borderTop: `1px solid hsl(var(--p-border, 222 30% 14%))` }} />
          <CounterRow label="Children" emoji="👧" subtitle="2–11 years" value={state.children} onChange={(v) => update({ children: v })} max={9} disabled={!!aiTravelers} />
          <div style={{ borderTop: `1px solid hsl(var(--p-border, 222 30% 14%))` }} />
          <CounterRow label="Infants" emoji="👶" subtitle="Under 2" value={state.infants} onChange={(v) => update({ infants: v })} max={9} disabled={!!aiTravelers} />
        </div>
        {aiTravelers && (
          <p className="text-[9px] mt-1" style={{ color: `hsl(var(--p-text-faint, 222 10% 40%))` }}>
            ℹ️ Travelers are locked from the conversation: {state.adults} adult{state.adults !== 1 ? "s" : ""}{state.children > 0 ? `, ${state.children} child${state.children !== 1 ? "ren" : ""}` : ""}{state.infants > 0 ? `, ${state.infants} infant${state.infants !== 1 ? "s" : ""}` : ""}
          </p>
        )}
      </div>
      {/* Cabin Class */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: `hsl(var(--p-text-faint, 222 15% 25%))` }}><Plane className="w-3 h-3" /> Cabin Class</p>
        <div className="grid grid-cols-4 gap-1.5">
          {CABIN_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => update({ cabinClass: opt.id })}
              className={cn("flex flex-col items-center gap-0.5 py-2 rounded-lg border text-[10px] font-medium transition-all", state.cabinClass === opt.id ? "border-primary/50 bg-primary/15 text-primary" : "")}
              style={state.cabinClass === opt.id ? { boxShadow: `0 0 12px hsl(var(--primary) / 0.2)` } : { borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))` }}>
              <span className="text-sm">{opt.emoji}</span><span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Hotel Class */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: `hsl(var(--p-text-faint, 222 15% 25%))` }}><Hotel className="w-3 h-3" /> Hotel Class</p>
        <div className="grid grid-cols-4 gap-1.5">
          {HOTEL_STAR_OPTIONS.map((opt) => (
            <button key={opt.stars} onClick={() => update({ hotelStars: opt.stars })}
              className={cn("flex items-center justify-center gap-1 py-2 rounded-lg border text-[10px] font-medium transition-all", state.hotelStars === opt.stars ? "border-primary/50 bg-primary/15 text-primary" : "")}
              style={state.hotelStars === opt.stars ? { boxShadow: `0 0 12px hsl(var(--primary) / 0.2)` } : { borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))` }}>
              {opt.stars > 0 ? <span className="flex items-center gap-0.5">{opt.label.replace("★", "")}<Star className="w-3 h-3 fill-warning text-warning" /></span> : opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Toggles */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, border: `1px solid hsl(var(--p-border, 222 30% 14%))` }}>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>Include breakfast</span>
          </div>
          <Switch checked={state.includeBreakfast} onCheckedChange={(v) => update({ includeBreakfast: v })} className="scale-[0.8]" />
        </label>
        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, border: `1px solid hsl(var(--p-border, 222 30% 14%))` }}>
          <div className="flex items-center gap-2">
            <Plane className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>Direct flights only</span>
          </div>
          <Switch checked={state.directFlightsOnly} onCheckedChange={(v) => update({ directFlightsOnly: v })} className="scale-[0.8]" />
        </label>
        <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, border: `1px solid hsl(var(--p-border, 222 30% 14%))` }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>Flexible dates (±3 days)</span>
          </div>
          <Switch checked={state.flexibleDates} onCheckedChange={(v) => update({ flexibleDates: v })} className="scale-[0.8]" />
        </label>
      </div>
      {/* New search hint */}
      {needsNewSearch && (
        <p className="text-[9px] text-center" style={{ color: `hsl(var(--p-text-faint, 222 10% 40%))` }}>
          Changing preferences will update your plan selections
        </p>
      )}
    </div>
  );

  // Chip data for mobile
  const chips = [
    {
      key: "budget" as SheetType,
      icon: Compass,
      label: state.travelStyle ? STYLE_OPTIONS.find(s => s.id === state.travelStyle)?.label || "Style" : "Budget Style",
      active: !!state.travelStyle,
    },
    {
      key: "travelers" as SheetType,
      icon: Users,
      label: (() => {
        const parts: string[] = [`${state.adults}A`];
        if (state.children > 0) parts.push(`${state.children}C`);
        if (state.infants > 0) parts.push(`${state.infants}I`);
        return parts.join(" ");
      })(),
      active: state.adults > 1 || state.children > 0 || state.infants > 0,
    },
    {
      key: "class" as SheetType,
      icon: Plane,
      label: state.cabinClass === "premium_economy" ? "Premium" : state.cabinClass.charAt(0).toUpperCase() + state.cabinClass.slice(1),
      active: state.cabinClass !== "economy",
    },
    {
      key: "more" as SheetType,
      icon: Compass,
      label: state.flexibleDates ? "Flexible" : "More",
      active: state.directFlightsOnly || state.flexibleDates || state.hotelStars > 0 || !!state.travelStyle,
    },
  ];

  return (
    <>
      <div className="shrink-0 border-b" style={{ borderColor: `hsl(var(--p-border, 222 30% 14%))`, backgroundColor: `hsl(var(--p-surface, 222 45% 8%))` }}>
        {/* ── MOBILE: Horizontal scroll chips → open bottom sheets ── */}
        <div className="sm:hidden px-3 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setActiveSheet(chip.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border whitespace-nowrap shrink-0 text-[11px] font-semibold transition-all active:scale-95",
                chip.active ? "border-primary/40" : ""
              )}
              style={{
                backgroundColor: chip.active ? `hsl(var(--primary) / 0.12)` : `hsl(var(--p-card, 222 35% 12%))`,
                borderColor: chip.active ? `hsl(var(--primary) / 0.4)` : `hsl(var(--p-border-strong, 222 25% 18%))`,
                color: chip.active ? `hsl(var(--primary))` : `hsl(var(--p-text, 0 0% 96%))`,
                boxShadow: chip.active ? `0 0 8px hsl(var(--primary) / 0.15)` : 'none',
              }}
            >
              <chip.icon className="w-3.5 h-3.5" />
              <span>{chip.label}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
          ))}
        </div>

        {/* ── DESKTOP: Clickable pill bar → opens popup ── */}
        <div className="hidden sm:block">
          <button
            onClick={() => setPopupOpen(true)}
            className="w-full px-4 py-2.5 flex items-center gap-2 flex-wrap cursor-pointer transition-colors hover:bg-primary/[0.03]"
          >
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: state.travelStyle ? `hsl(var(--primary) / 0.12)` : `hsl(var(--p-card, 222 35% 12%))`, borderColor: state.travelStyle ? `hsl(var(--primary) / 0.3)` : `hsl(var(--p-border-strong, 222 25% 18%))`, border: '1px solid' }}>
              <Compass className="w-3 h-3 text-primary" />
              <span className="font-semibold capitalize" style={{ color: state.travelStyle ? `hsl(var(--primary))` : `hsl(var(--p-text, 0 0% 96%))` }}>{state.travelStyle || "Budget Style"}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, border: '1px solid' }}>
              <Users className="w-3 h-3 text-primary" />
              <span className="font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>
                {state.adults}A{state.children > 0 ? ` ${state.children}C` : ""}{state.infants > 0 ? ` ${state.infants}I` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, border: '1px solid' }}>
              <Plane className="w-3 h-3 text-primary" />
              <span className="font-medium capitalize" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>{state.cabinClass.replace("_", " ")}</span>
            </div>
            {state.hotelStars > 0 && (
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, border: '1px solid' }}>
                <Hotel className="w-3 h-3 text-primary" />
                <span className="font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>{state.hotelStars}★</span>
              </div>
            )}
             {state.directFlightsOnly && (
               <span className="text-[9px] font-bold bg-primary/20 text-primary rounded-full px-2.5 py-1 border border-primary/30">Direct only</span>
             )}
             {state.includeBreakfast && (
               <span className="text-[9px] font-bold bg-success/20 text-success rounded-full px-2.5 py-1 border border-success/30 flex items-center gap-0.5"><UtensilsCrossed className="w-2.5 h-2.5" /> Breakfast</span>
             )}
             {state.travelStyle && (
               <span className="text-[9px] font-bold bg-primary/20 text-primary rounded-full px-2.5 py-1 border border-primary/30 capitalize">{state.travelStyle}</span>
             )}
            <div className="ml-auto flex items-center gap-1 text-[10px] font-semibold" style={{ color: `hsl(var(--p-text-muted, 222 12% 65%))` }}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Refine
            </div>
          </button>
        </div>
      </div>

      {/* ── DESKTOP POPUP ── */}
      <RefinePopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onApplySearch={handleNewSearch}
        needsNewSearch={needsNewSearch}
        loading={loading}
      >
        <RefinementContent />
      </RefinePopup>

      {/* ── MOBILE BOTTOM SHEETS ── */}
      <BottomSheet open={activeSheet === "budget"} onClose={() => setActiveSheet(null)} title="Budget Preference">
        <div className="space-y-4">
          <p className="text-[11px] text-center" style={{ color: `hsl(var(--p-text-faint, 222 10% 40%))` }}>How should AI prioritize your trip?</p>
          <div className="grid grid-cols-3 gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button key={opt.id} onClick={() => update({ travelStyle: state.travelStyle === opt.id ? "" : opt.id })}
                className={cn("flex flex-col items-center gap-1.5 py-4 rounded-xl border text-xs font-medium transition-all", state.travelStyle === opt.id ? "border-primary/50 bg-primary/15 text-primary" : "")}
                style={state.travelStyle === opt.id ? { boxShadow: `0 0 12px hsl(var(--primary) / 0.2)` } : { borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))` }}>
                <span className="text-xl">{opt.emoji}</span><span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={activeSheet === "travelers"} onClose={() => setActiveSheet(null)} title="Travelers">
        {aiTravelers && (
          <p className="text-[10px] mb-3 flex items-center gap-1" style={{ color: `hsl(var(--primary))` }}>
            🔒 Traveler count set from your conversation. Changing will trigger a new search.
          </p>
        )}
        <div className="rounded-xl" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, borderColor: `hsl(var(--p-border, 222 30% 14%))`, border: '1px solid' }}>
          <div className="px-4">
            <CounterRow label="Adults" emoji="🧑" subtitle="12+ years" value={state.adults} onChange={(v) => update({ adults: v })} min={1} max={9} disabled={!!aiTravelers} />
          </div>
          <div style={{ borderTop: `1px solid hsl(var(--p-border, 222 30% 14%))` }} />
          <div className="px-4">
            <CounterRow label="Children" emoji="👧" subtitle="2–11 years" value={state.children} onChange={(v) => update({ children: v })} max={9} disabled={!!aiTravelers} />
          </div>
          <div style={{ borderTop: `1px solid hsl(var(--p-border, 222 30% 14%))` }} />
          <div className="px-4">
            <CounterRow label="Infants" emoji="👶" subtitle="Under 2" value={state.infants} onChange={(v) => update({ infants: v })} max={9} disabled={!!aiTravelers} />
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={activeSheet === "class"} onClose={() => setActiveSheet(null)} title="Cabin & Hotel Class">
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5 flex items-center gap-1.5" style={{ color: `hsl(var(--p-text-faint, 222 15% 25%))` }}><Plane className="w-3.5 h-3.5" /> Cabin Class</p>
            <div className="grid grid-cols-2 gap-2">
              {CABIN_OPTIONS.map((opt) => (
                <button key={opt.id} onClick={() => update({ cabinClass: opt.id })}
                  className={cn("flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-medium transition-all", state.cabinClass === opt.id ? "border-primary/50 bg-primary/15 text-primary" : "")}
                  style={state.cabinClass === opt.id ? { boxShadow: `0 0 12px hsl(var(--primary) / 0.2)` } : { borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))` }}>
                  <span className="text-lg">{opt.emoji}</span><span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5 flex items-center gap-1.5" style={{ color: `hsl(var(--p-text-faint, 222 15% 25%))` }}><Hotel className="w-3.5 h-3.5" /> Hotel Class</p>
            <div className="grid grid-cols-4 gap-2">
              {HOTEL_STAR_OPTIONS.map((opt) => (
                <button key={opt.stars} onClick={() => update({ hotelStars: opt.stars })}
                  className={cn("flex items-center justify-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all", state.hotelStars === opt.stars ? "border-primary/50 bg-primary/15 text-primary" : "")}
                  style={state.hotelStars === opt.stars ? { boxShadow: `0 0 12px hsl(var(--primary) / 0.2)` } : { borderColor: `hsl(var(--p-border-strong, 222 25% 18%))`, backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, color: `hsl(var(--p-text-muted, 222 12% 65%))` }}>
                  {opt.stars > 0 ? <span className="flex items-center gap-0.5">{opt.label.replace("★", "")}<Star className="w-3.5 h-3.5 fill-warning text-warning" /></span> : opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={activeSheet === "more"} onClose={() => setActiveSheet(null)} title="More Options">
        <div className="space-y-5">
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, border: `1px solid hsl(var(--p-border, 222 30% 14%))` }}>
            <div className="flex items-center gap-2.5">
              <Plane className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>Direct flights only</p>
                <p className="text-[10px]" style={{ color: `hsl(var(--p-text-faint, 222 10% 40%))` }}>No layovers or connections</p>
              </div>
            </div>
            <Switch checked={state.directFlightsOnly} onCheckedChange={(v) => update({ directFlightsOnly: v })} />
          </label>
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl" style={{ backgroundColor: `hsl(var(--p-card, 222 35% 12%))`, border: `1px solid hsl(var(--p-border, 222 30% 14%))` }}>
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium" style={{ color: `hsl(var(--p-text, 0 0% 96%))` }}>Flexible dates</p>
                <p className="text-[10px]" style={{ color: `hsl(var(--p-text-faint, 222 10% 40%))` }}>±3 days for better prices</p>
              </div>
            </div>
            <Switch checked={state.flexibleDates} onCheckedChange={(v) => update({ flexibleDates: v })} />
          </label>
        </div>
      </BottomSheet>
    </>
  );
};

export default TripRefinementControls;
