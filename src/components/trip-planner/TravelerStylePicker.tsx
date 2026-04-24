import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Clock, Users, UsersRound, Heart, Gem, Baby,
  Briefcase, Compass, Crown, Wallet, Sparkles, Loader2,
  Minus, Plus, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Data ──
const travelTypes = [
  { id: "solo", label: "Solo Traveler", emoji: "🧳", icon: UserRound, description: "Safety, social hostels, flexible transport", color: "border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/60" },
  { id: "couple", label: "Couple", emoji: "💑", icon: Heart, description: "Dining, views, and privacy", color: "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/60" },
  { id: "honeymoon", label: "Honeymoon", emoji: "💕", icon: Gem, description: "Romantic & unforgettable", color: "border-pink-500/40 bg-pink-500/5 hover:bg-pink-500/10 hover:border-pink-500/60" },
  { id: "family", label: "Family with Kids", emoji: "👨‍👩‍👧‍👦", icon: Users, description: "Kid-friendly, kitchenettes, shorter walks", color: "border-green-500/40 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/60" },
  { id: "group", label: "Group of Friends", emoji: "🎉", icon: UsersRound, description: "Nightlife, group bookings, shared villas", color: "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60" },
  { id: "business", label: "Business", emoji: "💼", icon: Briefcase, description: "Wi-Fi, central, easy airport access", color: "border-slate-500/40 bg-slate-500/5 hover:bg-slate-500/10 hover:border-slate-500/60" },
];

const tripStyles = [
  { id: "budget", label: "Budget-friendly", emoji: "💰", icon: Wallet, description: "Affordable & practical", color: "border-green-500/40 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/60" },
  { id: "comfortable", label: "Mid-range Comfort", emoji: "✨", icon: Gem, description: "Best value for money", color: "border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/60" },
  { id: "luxury", label: "Luxury", emoji: "👑", icon: Crown, description: "Premium experience", color: "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60" },
];

type PickerStep = "duration" | "travel_type" | "travelers" | "style";

const durationOptions = [
  { days: 1, label: "1 Day", emoji: "⚡", description: "Quick trip" },
  { days: 3, label: "3 Days", emoji: "🌤️", description: "Weekend getaway" },
  { days: 5, label: "5 Days", emoji: "✈️", description: "Short vacation" },
  { days: 7, label: "7 Days", emoji: "🏖️", description: "One week" },
  { days: 10, label: "10 Days", emoji: "🌍", description: "Extended trip" },
];

// ── Detect missing fields from AI messages ──
type Msg = { role: "user" | "assistant"; content: string };

export function detectMissingFields(messages: Msg[]): string[] {
  if (messages.length === 0) return [];
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== "assistant") return [];
  const text = lastMsg.content.toLowerCase();
  
  const userTexts = messages.filter(m => m.role === "user").map(m => m.content.toLowerCase()).join(" ");
  const userProvidedTravelType = /\b(solo|couple|honeymoon|family|group|business)\b/.test(userTexts) ||
    /solo traveler|family with kids|group of friends/i.test(userTexts);
  const userProvidedStyle = /\b(budget-friendly|mid-range comfort|luxury)\b/i.test(userTexts) ||
    /budget.*(trip|friendly)|mid-range|comfortable.*trip|luxury.*trip/i.test(userTexts);
  
  const fields: string[] = [];
  const isAskingDestOrOrigin = /where.*(?:go|like|want|travel|fly)|(?:destination|origin|flying from|কোথায়|কোথা থেকে)/i.test(text);
  
  if (!isAskingDestOrOrigin) {
    const userProvidedDuration = /\b(\d+)\s*(day|night|week|n\d*d)/i.test(userTexts);
    if (!userProvidedDuration) {
      const hasDurationAsk = /how many days|how long|duration|কত দিন|কতদিন/i.test(text);
      if (hasDurationAsk) fields.push("duration");
    }

    if (!userProvidedTravelType) {
      const hasTravelTypeMention = /who'?s (coming|traveling)|travel type|solo.*couple|couple.*family|family.*group|honeymoon|কে যাচ্ছে|কে আসছে|কারা যাবে|traveling alone|with whom|who will be/i.test(text);
      if (hasTravelTypeMention) fields.push("travel_type");
    }
    
    if (!userProvidedTravelType || /how many.*(people|travelers|adults|person|going)/i.test(text)) {
      const hasTravelerAsk = /how many (people|travelers|adults|person|going)|কতজন|headcount|group size/i.test(text);
      if (hasTravelerAsk) fields.push("travelers");
    }
    
    if (!userProvidedStyle) {
      const hasStyleMention = /what kind of trip|trip style|travel style|budget.friendly|mid.range|luxury|preference|বাজেট|লাক্সারি|ভ্রমণের ধরন|comfort|budget.*luxury|luxury.*budget/i.test(text);
      if (hasStyleMention) fields.push("travel_style");
    }
  }
  
  return fields;
}

// ── Counter Sub-component ──
const Counter = ({ label, icon: Icon, value, onChange, min = 0, max = 9, subtitle, emoji }: {
  label: string; icon: typeof Users; value: number; onChange: (v: number) => void; min?: number; max?: number; subtitle?: string; emoji?: string;
}) => (
  <div className="flex items-center justify-between py-2.5">
    <div className="flex items-center gap-2.5">
      {emoji ? (
        <span className="text-lg w-8 text-center">{emoji}</span>
      ) : (
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/80">{subtitle}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-8 h-8 rounded-full border border-muted-foreground/40 bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-foreground">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-base font-bold text-foreground">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-8 h-8 rounded-full border border-muted-foreground/40 bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-foreground">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ── Main Component ──
interface TravelerStylePickerProps {
  onSubmit: (text: string, triggerSearch?: boolean) => void;
  loading: boolean;
  missingFields: string[];
}

const TravelerStylePicker: React.FC<TravelerStylePickerProps> = ({ onSubmit, loading, missingFields }) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customDuration, setCustomDuration] = useState("");
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [step, setStep] = useState<PickerStep>("duration");

  useEffect(() => {
    if (missingFields.includes("duration")) setStep("duration");
    else if (missingFields.includes("travel_type")) setStep("travel_type");
    else if (missingFields.includes("travelers")) setStep("travelers");
    else if (missingFields.includes("travel_style")) setStep("style");
  }, [missingFields]);

  const needsTravelerCount = selectedType === "family" || selectedType === "group" || selectedType === "business";

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    if (typeId === "family") { setAdults(2); setChildren(1); setInfants(0); }
    else if (typeId === "group" || typeId === "business") { setAdults(4); setChildren(0); setInfants(0); }
  };

  const getNextStep = (current: PickerStep): PickerStep | null => {
    const allSteps: PickerStep[] = ["duration", "travel_type", "travelers", "style"];
    const currentIdx = allSteps.indexOf(current);
    for (let i = currentIdx + 1; i < allSteps.length; i++) {
      const s = allSteps[i];
      if (s === "duration" && missingFields.includes("duration")) return "duration";
      if (s === "travel_type" && missingFields.includes("travel_type")) return "travel_type";
      if (s === "travelers" && needsTravelerCount) return "travelers";
      if (s === "style" && missingFields.includes("travel_style")) return "style";
    }
    return null;
  };

  const handleNext = () => {
    if (step === "duration" && (selectedDuration || customDuration)) {
      const next = getNextStep("duration");
      if (next) setStep(next); else handleFinalSubmit();
    } else if (step === "travel_type" && selectedType) {
      if (needsTravelerCount) setStep("travelers");
      else { const next = getNextStep("travelers"); if (next) setStep(next); else handleFinalSubmit(); }
    } else if (step === "travelers") {
      const next = getNextStep("travelers");
      if (next) setStep(next); else handleFinalSubmit();
    } else if (step === "style" && selectedStyle) {
      handleFinalSubmit();
    }
  };

  const isLastStep = () => {
    if (step === "style") return true;
    if (step === "duration") return !missingFields.includes("travel_type") && !missingFields.includes("travel_style");
    if (step === "travel_type") return !needsTravelerCount && !missingFields.includes("travel_style");
    if (step === "travelers") return !missingFields.includes("travel_style");
    return false;
  };

  const handleFinalSubmit = () => {
    const parts: string[] = [];
    const dur = selectedDuration || (customDuration ? parseInt(customDuration) : null);
    if (dur && missingFields.includes("duration")) parts.push(`${dur} days`);
    const typeLabel = travelTypes.find(t => t.id === selectedType)?.label || "";
    if (selectedType && missingFields.includes("travel_type")) parts.push(`${typeLabel}`);
    if (needsTravelerCount) {
      if (selectedType === "family") {
        const travParts: string[] = [];
        travParts.push(`${adults} adult${adults !== 1 ? "s" : ""}`);
        if (children > 0) travParts.push(`${children} child${children !== 1 ? "ren" : ""}`);
        if (infants > 0) travParts.push(`${infants} infant${infants !== 1 ? "s" : ""}`);
        parts.push(travParts.join(", "));
      } else {
        parts.push(`${adults} people`);
      }
    }
    if (selectedStyle && missingFields.includes("travel_style")) {
      const styleLabel = tripStyles.find(s => s.id === selectedStyle)?.label || "";
      parts.push(`${styleLabel} trip`);
    }
    onSubmit(parts.join(". "), true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="max-w-[85%] ml-11"
    >
      <div className="bg-card border border-border rounded-2xl rounded-bl-sm shadow-lg overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Duration */}
          {step === "duration" && (
            <motion.div key="duration" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-4 pt-5 pb-4">
              <p className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: `hsl(var(--p-text))` }}>
                <Clock className="w-4 h-4 text-muted-foreground" /> How many days?
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {durationOptions.map((opt) => {
                  const isSelected = selectedDuration === opt.days && !showCustomDuration;
                  return (
                    <motion.button key={opt.days} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                      onClick={() => { setSelectedDuration(opt.days); setShowCustomDuration(false); setCustomDuration(""); }}
                      className={cn("relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border-2 transition-all duration-200",
                        isSelected ? "border-primary bg-primary/[0.06] shadow-lg shadow-primary/15 ring-1 ring-primary/25" : "border-border/60 bg-card hover:bg-muted/40 hover:border-muted-foreground/25"
                      )}>
                      {isSelected && (<motion.div layoutId="dur-check" className="absolute -top-1.5 -right-1.5 rounded-full bg-primary flex items-center justify-center shadow-sm" style={{ width: 22, height: 22 }}><Check className="w-3 h-3 text-primary-foreground" /></motion.div>)}
                      <span className="text-xl leading-none">{opt.emoji}</span>
                      <span className={cn("text-sm font-bold transition-colors", isSelected ? "text-primary" : "text-foreground")}>{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{opt.description}</span>
                    </motion.button>
                  );
                })}
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                  onClick={() => { setShowCustomDuration(true); setSelectedDuration(null); }}
                  className={cn("relative flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border-2 transition-all duration-200",
                    showCustomDuration ? "border-primary bg-primary/[0.06] shadow-lg shadow-primary/15 ring-1 ring-primary/25" : "border-border/60 bg-card hover:bg-muted/40 hover:border-muted-foreground/25"
                  )}>
                  {showCustomDuration && (<motion.div layoutId="dur-check" className="absolute -top-1.5 -right-1.5 rounded-full bg-primary flex items-center justify-center shadow-sm" style={{ width: 22, height: 22 }}><Check className="w-3 h-3 text-primary-foreground" /></motion.div>)}
                  <span className="text-xl leading-none">📝</span>
                  <span className={cn("text-sm font-bold", showCustomDuration ? "text-primary" : "text-foreground")}>Other</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Custom days</span>
                </motion.button>
              </div>
              {showCustomDuration && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3">
                  <input type="number" min={1} max={60} value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} placeholder="Enter number of days"
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors" />
                </motion.div>
              )}
              <Button onClick={handleNext} disabled={(!selectedDuration && !customDuration) || loading}
                className={cn("w-full mt-4 rounded-2xl h-12 font-semibold text-sm transition-all duration-300",
                  (selectedDuration || customDuration) ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed"
                )}>
                <Sparkles className="w-4 h-4 mr-2" /> {isLastStep() ? "Plan Your Itinerary ✨" : "Continue"}
              </Button>
            </motion.div>
          )}

          {/* Travel Type */}
          {step === "travel_type" && (
            <motion.div key="travel_type" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-4 pt-4 pb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Who's coming along?</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {travelTypes.map((type) => (
                  <motion.button key={type.id} whileTap={{ scale: 0.95 }} onClick={() => handleTypeSelect(type.id)}
                    className={cn("relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200",
                      selectedType === type.id ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20" : type.color
                    )}>
                    {selectedType === type.id && (<motion.div layoutId="type-check" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm"><Check className="w-3 h-3 text-primary-foreground" /></motion.div>)}
                    <span className="text-xl">{type.emoji}</span>
                    <span className={cn("text-[11px] font-bold transition-colors text-center leading-tight", selectedType === type.id ? "text-primary" : "text-foreground")}>{type.label}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight text-center hidden sm:block">{type.description}</span>
                  </motion.button>
                ))}
              </div>
              <Button onClick={handleNext} disabled={!selectedType || loading}
                className="w-full mt-3 rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/15 transition-all disabled:opacity-40">
                <Sparkles className="w-4 h-4 mr-2" /> {isLastStep() ? "Plan Your Itinerary ✨" : "Continue"}
              </Button>
            </motion.div>
          )}

          {/* Travelers */}
          {step === "travelers" && (
            <motion.div key="travelers" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-4 pt-4 pb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                {selectedType === "family" ? (<><Users className="w-3.5 h-3.5" /> How many are traveling?</>) : (<><UsersRound className="w-3.5 h-3.5" /> How many people? 🧑‍🤝‍🧑</>)}
              </p>
              {selectedType === "family" ? (
                <div className="space-y-1 divide-y divide-muted-foreground/20">
                  <Counter label="Adults" icon={Users} value={adults} onChange={setAdults} min={1} subtitle="12+ years" emoji="🧑" />
                  <Counter label="Children" icon={Users} value={children} onChange={setChildren} subtitle="2-11 years" emoji="👧" />
                  <Counter label="Infants" icon={Baby} value={infants} onChange={setInfants} subtitle="Under 2 years" emoji="👶" />
                </div>
              ) : (
                <Counter label="Travelers" icon={UsersRound} value={adults} onChange={setAdults} min={2} max={20} subtitle="Number of people" emoji="🧑‍🤝‍🧑" />
              )}
              <Button onClick={handleNext} disabled={adults < 1 || loading}
                className="w-full mt-3 rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/15 transition-all disabled:opacity-40">
                <Sparkles className="w-4 h-4 mr-2" /> {isLastStep() ? "Plan Your Itinerary ✨" : "Continue"}
              </Button>
            </motion.div>
          )}

          {/* Style */}
          {step === "style" && (
            <motion.div key="style" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="px-4 pt-4 pb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Compass className="w-3.5 h-3.5" /> What kind of trip?</p>
              <div className="grid grid-cols-3 gap-2">
                {tripStyles.map((style) => (
                  <motion.button key={style.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedStyle(style.id)}
                    className={cn("relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200",
                      selectedStyle === style.id ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20" : style.color
                    )}>
                    {selectedStyle === style.id && (<motion.div layoutId="style-check" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm"><Check className="w-3 h-3 text-primary-foreground" /></motion.div>)}
                    <span className="text-xl">{style.emoji}</span>
                    <span className={cn("text-xs font-bold transition-colors", selectedStyle === style.id ? "text-primary" : "text-foreground")}>{style.label}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight text-center">{style.description}</span>
                  </motion.button>
                ))}
              </div>
              <Button onClick={handleNext} disabled={!selectedStyle || loading}
                className="w-full mt-3 rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/15 transition-all disabled:opacity-40">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Plan Your Itinerary ✨
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TravelerStylePicker;
