import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Plane, Hotel, Camera, Check, X, Shield, ChevronDown,
  ChevronUp, ChevronLeft, CreditCard, ArrowRight, Users, Mail,
  Eye, BedDouble, Building2, Wallet, CalendarIcon, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "@/hooks/use-toast";
import CountryPicker from "@/components/ui/country-picker";
import PhoneInput from "@/components/ui/phone-input";
import { detectCountry } from "@/utils/geolocation";

// ── Types ──
export type BookingTierId = "flight_only" | "flight_hotel" | "full_package";

export const BOOKING_TIERS = [
  { id: "flight_only" as const, label: "Flight Only", icon: Plane, keys: ["flights"] as string[], color: "text-primary" },
  { id: "flight_hotel" as const, label: "Flight + Hotel", icon: Hotel, keys: ["flights", "hotels"] as string[], color: "text-accent" },
  { id: "full_package" as const, label: "Full Package", icon: Camera, keys: ["flights", "hotels", "activities"] as string[], color: "text-primary" },
];

const budgetKeyLabel: Record<string, string> = {
  flights: "Flights",
  hotels: "Hotels",
  activities: "Activities",
  food: "Food",
  transport: "Transport",
};

interface PaxForm {
  title: string; firstName: string; lastName: string; dob: string;
  gender: string; nationality: string; idType: string; idNumber: string;
  idExpiry: string; passportCountry: string;
}

const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "driving_license", label: "Driving License" },
  { value: "voter_id", label: "Voter ID" },
];

const emptyPax = (): PaxForm => ({
  title: "Mr", firstName: "", lastName: "", dob: "", gender: "Male",
  nationality: "", idType: "passport", idNumber: "", idExpiry: "", passportCountry: "",
});

// ── Helpers (kept local since they reference Itinerary internals) ──
function getAirlineInfo(airlineRaw: string): { name: string; code: string; logoUrl: string } {
  const raw = (airlineRaw || "").trim();
  const isCode = /^[A-Z0-9]{2}$/i.test(raw);
  if (isCode) {
    const code = raw.toUpperCase();
    return { code, name: code, logoUrl: `https://pics.avs.io/48/48/${code}.png` };
  }
  const fnMatch = raw.match(/^([A-Z0-9]{2})\d/i);
  const foundCode = fnMatch ? fnMatch[1].toUpperCase() : "";
  return { code: foundCode, name: raw, logoUrl: foundCode ? `https://pics.avs.io/48/48/${foundCode}.png` : "" };
}

function AirlineLogo({ code, name, size = 24 }: { code: string; name: string; size?: number }) {
  if (!code) return <Plane className="text-muted-foreground" style={{ width: size * 0.6, height: size * 0.6 }} />;
  return (
    <img
      src={`https://pics.avs.io/${size * 2}/${size * 2}/${code}@2x.png`}
      alt={name}
      className="object-contain rounded-sm bg-white/90 p-[1px]"
      style={{ width: size, height: size }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ── Main Component ──
interface BookingDialogContentProps {
  itinerary: any;
  onClose: () => void;
  initialTier?: BookingTierId;
  resolveCity: (code: string) => string;
}

const detectInternational = (itinerary: any): boolean => {
  const sf = itinerary.selected_flight;
  if (!sf?.outbound) return true;
  return true; // Default to international
};

const BookingDialogContent: React.FC<BookingDialogContentProps> = ({ itinerary, onClose, initialTier, resolveCity }) => {
  type BStep = "verifying" | "travelers" | "breakdown" | "payment" | "booking" | "done" | "error";
  const [step, setStep] = useState<BStep>("verifying");
  const [bookingTier, setBookingTier] = useState<BookingTierId>(initialTier || "full_package");
  const [verifiedPrices, setVerifiedPrices] = useState<Record<string, number>>({});
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [paxList, setPaxList] = useState<PaxForm[]>(() => Array.from({ length: Math.max(1, itinerary.travelers) }, () => emptyPax()));
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [geoCountryCode, setGeoCountryCode] = useState("BD");
  const isIntl = detectInternational(itinerary);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["flights", "hotels", "activities"]));
  const [selectedPayment, setSelectedPayment] = useState<string>("card");
  const [showFooterPreview, setShowFooterPreview] = useState(false);
  const [savedPassengers, setSavedPassengers] = useState<any[]>([]);
  const [savedPaxLoaded, setSavedPaxLoaded] = useState(false);
  const { currency, formatDirectPrice } = useCurrency();

  const tierConfig = BOOKING_TIERS.find(t => t.id === bookingTier)!;
  const verifiedTotal = tierConfig.keys.reduce((s, k) => s + (verifiedPrices[k] || itinerary.budget_estimate.breakdown[k] || 0), 0);
  const inputCls = "w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors";

  useEffect(() => {
    if (savedPaxLoaded) return;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session?.user?.id) { setSavedPaxLoaded(true); return; }
      const [paxRes, profRes] = await Promise.all([
        supabase.from("saved_passengers").select("*").eq("user_id", sess.session.user.id).order("first_name"),
        supabase.from("profiles").select("email, phone").eq("user_id", sess.session.user.id).maybeSingle(),
      ]);
      setSavedPassengers(paxRes.data || []);
      if (profRes.data?.email) setContactEmail(profRes.data.email);
      if (profRes.data?.phone) setContactPhone(profRes.data.phone);
      setSavedPaxLoaded(true);
    })();
  }, [savedPaxLoaded]);

  useEffect(() => {
    if (step !== "verifying") return;
    const timer = setTimeout(() => {
      const verified: Record<string, number> = {};
      verified.flights = (itinerary.selected_flight?.price && itinerary.selected_flight.is_live_price)
        ? itinerary.selected_flight.price
        : itinerary.budget_estimate.breakdown.flights || 0;
      verified.hotels = itinerary.selected_hotel?.total_price || itinerary.budget_estimate.breakdown.hotels || 0;
      verified.activities = itinerary.budget_estimate.breakdown.activities || 0;
      setVerifiedPrices(verified);
      setStep("travelers");
    }, 1500);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    const needed = Math.max(1, itinerary.travelers);
    if (paxList.length < needed) setPaxList(prev => [...prev, ...Array(needed - prev.length).fill(null).map(() => emptyPax())]);
  }, [itinerary.travelers]);

  useEffect(() => {
    detectCountry().then(country => {
      if (!country) return;
      setGeoCountryCode(country.code);
      setPaxList(prev => prev.map(p => ({
        ...p,
        nationality: p.nationality || country.code,
        passportCountry: p.passportCountry || country.code,
      })));
    });
  }, []);

  const toggleSection = (id: string) => setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const loadSavedPax = (sp: any, idx: number) => setPaxList(prev => prev.map((p, i) => i === idx ? { title: sp.title || "Mr", firstName: sp.first_name, lastName: sp.last_name, dob: sp.dob || "", gender: ["Mr", "Mstr", "Master"].includes(sp.title) ? "Male" : "Female", nationality: sp.nationality || "", idType: sp.passport_number ? "passport" : "national_id", idNumber: sp.passport_number || "", idExpiry: sp.passport_expiry || "", passportCountry: sp.passport_country || "" } : p));
  const updatePax = (idx: number, field: keyof PaxForm, val: string) => setPaxList(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));

  const handleSubmitBooking = async () => {
    if (!contactEmail.trim()) { toast({ title: "Please enter a contact email", variant: "destructive" }); return; }
    if (!paxList.every(p => p.firstName.trim() && p.lastName.trim())) { toast({ title: "Please enter all passenger names", variant: "destructive" }); return; }
    if (!paxList.every(p => p.dob)) { toast({ title: "Please enter date of birth for all passengers", variant: "destructive" }); return; }
    if (!paxList.every(p => p.nationality.trim() && p.idNumber.trim())) { toast({ title: "Please enter nationality and ID for all passengers", variant: "destructive" }); return; }
    if (isIntl && !paxList.every(p => p.idType === "passport" && p.idExpiry)) { toast({ title: "Passport with expiry date required for international travel", variant: "destructive" }); return; }
    setSubmitting(true); setStep("booking");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id || null;
      const { error } = await supabase.from("trip_finalization_requests").insert({
        user_id: userId, passenger_name: paxList.map(p => `${p.title} ${p.firstName} ${p.lastName}`).join(", "),
        passenger_email: contactEmail.trim(), passenger_phone: contactPhone.trim(),
        trip_title: itinerary.trip_title, destination: itinerary.destination,
        duration_days: itinerary.duration_days, travelers: itinerary.travelers,
        estimated_total: verifiedTotal, currency: itinerary.budget_estimate.currency || currency,
        itinerary_data: { ...itinerary, booking_tier: bookingTier, booking_tier_label: tierConfig.label, verified_prices: verifiedPrices, passengers: paxList, payment_method: selectedPayment } as any,
        conversation_summary: `${itinerary.trip_title} — ${tierConfig.label}, ${paxList.length} pax, ${currency} ${verifiedTotal}`,
        is_large_group: itinerary.travelers > 9,
      } as any);
      if (error) throw error;
      setStep("done"); toast({ title: "Booking confirmed! 🎉" });
    } catch (err: any) { setVerifyError(err.message); setStep("error"); } finally { setSubmitting(false); }
  };

  // ── Step: Verifying ──
  if (step === "verifying") return (
    <div className="p-8 flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      <div className="text-center"><p className="text-base font-bold text-foreground">Verifying Latest Prices</p><p className="text-xs text-muted-foreground mt-1">Checking availability & rates…</p></div>
      <div className="w-full space-y-2 mt-2">
        {["flights", "hotels", "activities"].map(k => (
          <div key={k} className="flex items-center gap-2.5 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" /><span className="flex-1">{budgetKeyLabel[k] || k}</span>
            <span className="text-muted-foreground/60">{formatDirectPrice(itinerary.budget_estimate.breakdown[k] || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Step: Travelers ──
  if (step === "travelers") return (
    <div className="flex flex-col max-h-[80vh]">
      <div className="px-5 py-4 border-b" style={{ borderColor: `hsl(var(--border))`, background: `linear-gradient(135deg, hsl(var(--primary) / 0.04) 0%, hsl(var(--card)) 100%)` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))`, boxShadow: `0 4px 12px hsl(var(--primary) / 0.1)` }}>
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground tracking-tight">Traveler Details</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>{paxList.length} traveler{paxList.length > 1 ? "s" : ""}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{isIntl ? "International 🌍" : "Domestic 🏠"}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span className="text-emerald-600 font-medium">Prices verified ✓</span>
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {BOOKING_TIERS.map(t => {
            const TIcon = t.icon;
            const isActive = bookingTier === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setBookingTier(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <TIcon className="w-3 h-3" />
                {t.id === "flight_only" ? "Flight" : t.id === "flight_hotel" ? "Flights + Hotel" : "Full Package"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {paxList.map((pax, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid hsl(var(--border))`, background: `hsl(var(--card))`, boxShadow: `0 2px 8px hsl(var(--foreground) / 0.03)` }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: `linear-gradient(90deg, hsl(var(--muted) / 0.4) 0%, transparent 100%)`, borderBottom: `1px solid hsl(var(--border) / 0.5)` }}>
              <span className="text-xs font-bold text-foreground tracking-tight">Passenger {idx + 1}</span>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-primary cursor-pointer hover:text-primary/80 transition-all rounded-lg px-2.5 py-1.5" style={{ background: `hsl(var(--primary) / 0.06)` }}>
                  <Camera className="w-3.5 h-3.5" /> Scan Passport
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    toast({ title: "Scanning passport…", description: "Extracting details with AI" });
                    try {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = (reader.result as string).split(",")[1];
                        const { data, error } = await supabase.functions.invoke("passport-ocr", { body: { image: base64, paxIndex: idx } });
                        if (error || !data?.success) { toast({ title: "Could not read passport", description: data?.error || "Please fill manually", variant: "destructive" }); return; }
                        const d = data.extracted;
                        const updates: Partial<PaxForm> = {};
                        if (d.surname) updates.lastName = d.surname;
                        if (d.given_name) updates.firstName = d.given_name;
                        if (d.dob) updates.dob = d.dob;
                        if (d.gender) updates.gender = d.gender === "M" ? "Male" : "Female";
                        if (d.nationality) updates.nationality = d.nationality;
                        if (d.passport_number) { updates.idType = "passport"; updates.idNumber = d.passport_number; }
                        if (d.expiry_date) updates.idExpiry = d.expiry_date;
                        if (d.issuing_country) updates.passportCountry = d.issuing_country;
                        const confirmMsg = Object.entries(updates).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join("\n");
                        if (window.confirm(`Extracted passport details:\n\n${confirmMsg}\n\nApply to Passenger ${idx + 1}?`)) {
                          setPaxList(prev => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
                          toast({ title: "Passport details applied ✓", description: `${updates.firstName || ""} ${updates.lastName || ""}` });
                        }
                      };
                      reader.readAsDataURL(file);
                    } catch { toast({ title: "Scan failed", variant: "destructive" }); }
                  }} />
                </label>
                {savedPassengers.length > 0 && (
                  <select className="text-[10px] bg-transparent border border-border rounded-lg px-2 py-1.5 text-muted-foreground cursor-pointer outline-none hover:border-primary/40 transition-colors" value="" onChange={e => { const sp = savedPassengers.find((s: any) => s.id === e.target.value); if (sp) loadSavedPax(sp, idx); }}>
                    <option value="">Load saved…</option>
                    {savedPassengers.map((sp: any) => (<option key={sp.id} value={sp.id}>{sp.first_name} {sp.last_name}</option>))}
                  </select>
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-muted-foreground/50 px-0.5">Personal Information</p>
                <div className="grid grid-cols-[72px_1fr_1fr] gap-2">
                  <select value={pax.title} onChange={e => { updatePax(idx, "title", e.target.value); updatePax(idx, "gender", ["Mr", "Mstr", "Master"].includes(e.target.value) ? "Male" : "Female"); }} className={cn(inputCls, "text-xs h-10 px-2.5 rounded-xl appearance-none cursor-pointer")}>
                    <option>Mr</option><option>Mrs</option><option>Ms</option><option>Mstr</option><option>Miss</option>
                  </select>
                  <input type="text" value={pax.firstName} onChange={e => updatePax(idx, "firstName", e.target.value)} placeholder="Given Name *" className={cn(inputCls, "text-xs h-10 rounded-xl")} />
                  <input type="text" value={pax.lastName} onChange={e => updatePax(idx, "lastName", e.target.value)} placeholder="Surname *" className={cn(inputCls, "text-xs h-10 rounded-xl")} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none z-[1]" />
                    <input type="date" value={pax.dob} onChange={e => updatePax(idx, "dob", e.target.value)} className={cn(inputCls, "text-xs h-10 rounded-xl pl-8")} />
                    {!pax.dob && <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 pointer-events-none">DOB *</span>}
                  </div>
                  <select value={pax.gender} onChange={e => updatePax(idx, "gender", e.target.value)} className={cn(inputCls, "text-xs h-10 px-2.5 rounded-xl appearance-none cursor-pointer")}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <CountryPicker value={pax.nationality} onChange={v => updatePax(idx, "nationality", v)} placeholder="Nationality *" className="h-10 rounded-xl text-xs border-border bg-muted/50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-muted-foreground/50 px-0.5">Travel Document</p>
                <div className={cn("grid gap-2", isIntl ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
                  <select value={pax.idType} onChange={e => { updatePax(idx, "idType", e.target.value); if (e.target.value !== "passport") updatePax(idx, "idExpiry", ""); }} className={cn(inputCls, "text-xs h-10 px-2.5 rounded-xl appearance-none cursor-pointer")}>
                    {(isIntl ? [ID_TYPES[0]] : ID_TYPES).map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                  <input type="text" value={pax.idNumber} onChange={e => updatePax(idx, "idNumber", e.target.value)} placeholder={`${ID_TYPES.find(t => t.value === pax.idType)?.label || "ID"} # *`} className={cn(inputCls, "text-xs h-10 rounded-xl")} />
                  {(pax.idType === "passport" || isIntl) ? (
                    <div className="relative">
                      <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 pointer-events-none z-[1]" />
                      <input type="date" value={pax.idExpiry} onChange={e => updatePax(idx, "idExpiry", e.target.value)} className={cn(inputCls, "text-xs h-10 rounded-xl pl-8")} />
                      {!pax.idExpiry && <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 pointer-events-none">Expiry *</span>}
                    </div>
                  ) : (
                    <div className="flex items-center text-[10px] text-muted-foreground/50 italic px-3 rounded-xl" style={{ background: `hsl(var(--muted) / 0.3)` }}>No expiry needed</div>
                  )}
                  {isIntl && (
                    <CountryPicker value={pax.passportCountry} onChange={v => updatePax(idx, "passportCountry", v)} placeholder="Issue Country" className="h-10 rounded-xl text-xs border-border bg-muted/50" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <p className="text-[9px] uppercase tracking-[0.12em] font-bold text-muted-foreground/50 px-0.5">Contact Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors z-[1]" />
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Email *" className={cn(inputCls, "pl-9 text-xs h-10 rounded-xl")} />
            </div>
            <PhoneInput value={contactPhone} onChange={setContactPhone} defaultCountryCode={geoCountryCode} className="[&_button]:h-10 [&_button]:rounded-l-xl [&_button]:bg-muted/50 [&_button]:border-border [&_input]:h-10 [&_input]:rounded-r-xl [&_input]:bg-muted/50 [&_input]:border-border [&_input]:text-xs" placeholder="Phone number" />
          </div>
        </div>
      </div>

      {showFooterPreview && (
        <div className="border-t px-5 py-3 space-y-2.5 max-h-[40vh] overflow-y-auto" style={{ borderColor: `hsl(var(--border))`, background: `hsl(var(--muted) / 0.15)` }}>
          <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-muted-foreground/70 mb-1">Booking Summary</p>
          {tierConfig.keys.includes("flights") && itinerary.selected_flight && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Plane className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Flight</span>
                <span className="ml-auto text-xs font-bold text-primary">{formatDirectPrice(verifiedPrices.flights || itinerary.budget_estimate.breakdown.flights || 0)}</span>
              </div>
              {itinerary.selected_flight.outbound && (
                <div className="flex items-center gap-2 text-xs">
                  <AirlineLogo code={getAirlineInfo(itinerary.selected_flight.outbound.airline).code} name={getAirlineInfo(itinerary.selected_flight.outbound.airline).name} size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{resolveCity(itinerary.selected_flight.outbound.from)} → {resolveCity(itinerary.selected_flight.outbound.to)}</p>
                    <p className="text-[10px] text-muted-foreground">{itinerary.selected_flight.outbound.date} · {itinerary.selected_flight.outbound.duration} · {itinerary.selected_flight.outbound.stops === 0 ? "Direct" : `${itinerary.selected_flight.outbound.stops} stop`}</p>
                  </div>
                </div>
              )}
              {itinerary.selected_flight.inbound && (
                <div className="flex items-center gap-2 text-xs">
                  <AirlineLogo code={getAirlineInfo(itinerary.selected_flight.inbound.airline).code} name={getAirlineInfo(itinerary.selected_flight.inbound.airline).name} size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{resolveCity(itinerary.selected_flight.inbound.from)} → {resolveCity(itinerary.selected_flight.inbound.to)}</p>
                    <p className="text-[10px] text-muted-foreground">{itinerary.selected_flight.inbound.date} · {itinerary.selected_flight.inbound.duration} · {itinerary.selected_flight.inbound.stops === 0 ? "Direct" : `${itinerary.selected_flight.inbound.stops} stop`}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {tierConfig.keys.includes("hotels") && itinerary.selected_hotel && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <BedDouble className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Hotel</span>
                <span className="ml-auto text-xs font-bold text-primary">{formatDirectPrice(verifiedPrices.hotels || itinerary.budget_estimate.breakdown.hotels || 0)}</span>
              </div>
              <p className="text-xs font-semibold text-foreground">{itinerary.selected_hotel.name}</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span>{"★".repeat(itinerary.selected_hotel.stars)}</span>
                {itinerary.selected_hotel.room_type && <span>· {itinerary.selected_hotel.room_type}</span>}
                {itinerary.selected_hotel.meal_basis && <span>· {itinerary.selected_hotel.meal_basis}</span>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{itinerary.selected_hotel.nights} nights × {formatDirectPrice(itinerary.selected_hotel.price_per_night)}/night</p>
            </div>
          )}
          {tierConfig.keys.includes("activities") && (() => {
            const acts = itinerary.days.flatMap((d: any) => d.activities.filter((a: any) => a.is_live_price));
            if (acts.length === 0) return null;
            return (
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Camera className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Activities · {acts.length}</span>
                  <span className="ml-auto text-xs font-bold text-primary">{formatDirectPrice(verifiedPrices.activities || itinerary.budget_estimate.breakdown.activities || 0)}</span>
                </div>
                <div className="space-y-1">
                  {acts.slice(0, 4).map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground truncate flex-1">
                        {a.activity}
                        {a.option_title && <span className="text-primary/70 ml-1">· {a.option_title}</span>}
                      </span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{formatDirectPrice(a.cost_estimate)}</span>
                    </div>
                  ))}
                  {acts.length > 4 && <p className="text-[10px] text-muted-foreground">+{acts.length - 4} more</p>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="px-5 py-3.5 border-t flex items-center gap-3" style={{ borderColor: `hsl(var(--border))`, background: `linear-gradient(90deg, hsl(var(--muted) / 0.15) 0%, hsl(var(--card)) 100%)` }}>
        <button
          onClick={() => setShowFooterPreview(!showFooterPreview)}
          className={cn("flex items-center gap-1.5 text-[10px] font-semibold px-3 py-2 rounded-lg border transition-all", showFooterPreview ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30")}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Details</span>
          {showFooterPreview ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        <div className="flex-1 text-right">
          <p className="text-[9px] uppercase tracking-[0.15em] font-semibold text-muted-foreground/60">{tierConfig.label}</p>
          <p className="text-base font-extrabold text-primary leading-tight">{formatDirectPrice(verifiedTotal)}</p>
        </div>
        <Button
          className="h-11 rounded-xl text-sm font-bold gap-2 px-6 shadow-lg shadow-primary/20"
          style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))` }}
          onClick={() => setStep("breakdown")}
          disabled={!paxList[0].firstName.trim() || !paxList[0].lastName.trim() || !contactEmail.trim()}
        >
          Review Package <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // ── Step: Breakdown ──
  if (step === "breakdown") {
    const sf = itinerary.selected_flight; const sh = itinerary.selected_hotel;
    const acts = itinerary.days.flatMap((d: any) => d.activities.filter((a: any) => a.is_live_price));
    const sections = [
      { id: "flights", icon: Plane, label: "Flights", price: verifiedPrices.flights || itinerary.budget_estimate.breakdown.flights || 0, included: tierConfig.keys.includes("flights"),
        content: sf ? (<div className="space-y-2">{sf.outbound && (<div className="flex items-center gap-2 text-xs"><AirlineLogo code={getAirlineInfo(sf.outbound.airline).code} name={getAirlineInfo(sf.outbound.airline).name} size={20} /><div className="flex-1"><p className="font-semibold text-foreground">{resolveCity(sf.outbound.from)} → {resolveCity(sf.outbound.to)}</p><p className="text-muted-foreground">{sf.outbound.date} · {sf.outbound.duration} · {sf.outbound.stops === 0 ? "Direct" : `${sf.outbound.stops} stop`}</p></div></div>)}{sf.inbound && (<div className="flex items-center gap-2 text-xs"><AirlineLogo code={getAirlineInfo(sf.inbound.airline).code} name={getAirlineInfo(sf.inbound.airline).name} size={20} /><div className="flex-1"><p className="font-semibold text-foreground">{resolveCity(sf.inbound.from)} → {resolveCity(sf.inbound.to)}</p><p className="text-muted-foreground">{sf.inbound.date} · {sf.inbound.duration} · {sf.inbound.stops === 0 ? "Direct" : `${sf.inbound.stops} stop`}</p></div></div>)}</div>) : <p className="text-xs text-muted-foreground">No flight selected</p> },
      { id: "hotels", icon: BedDouble, label: `Hotel · ${sh?.nights || itinerary.duration_days - 1} nights`, price: verifiedPrices.hotels || itinerary.budget_estimate.breakdown.hotels || 0, included: tierConfig.keys.includes("hotels"),
        content: sh ? (<div className="text-xs space-y-1"><p className="font-semibold text-foreground">{sh.name}</p><div className="flex items-center gap-2 text-muted-foreground"><span>{"★".repeat(sh.stars)}</span>{sh.room_type && <span>· {sh.room_type}</span>}{sh.meal_basis && <span>· {sh.meal_basis}</span>}</div><p className="text-muted-foreground">{sh.nights} nights × {formatDirectPrice(sh.price_per_night)}/night</p></div>) : <p className="text-xs text-muted-foreground">No hotel selected</p> },
      { id: "activities", icon: Camera, label: `Activities · ${acts.length} items`, price: verifiedPrices.activities || itinerary.budget_estimate.breakdown.activities || 0, included: tierConfig.keys.includes("activities"),
        content: acts.length > 0 ? (<div className="space-y-1.5">{acts.slice(0, 5).map((a: any, i: number) => (<div key={i} className="flex items-center justify-between text-xs"><span className="text-foreground truncate flex-1">{a.activity}</span><span className="text-muted-foreground ml-2 flex-shrink-0">{formatDirectPrice(a.cost_estimate)}</span></div>))}{acts.length > 5 && <p className="text-[10px] text-muted-foreground">+{acts.length - 5} more</p>}</div>) : <p className="text-xs text-muted-foreground">No bookable activities</p> },
    ];
    return (
      <div className="flex flex-col max-h-[80vh]">
        <div className="px-5 py-4 border-b border-border bg-muted/20"><div className="flex items-center gap-3"><button onClick={() => setStep("travelers")} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4 text-muted-foreground" /></button><div className="flex-1"><h3 className="text-sm font-bold text-foreground">Package Breakdown</h3><p className="text-[10px] text-muted-foreground">{tierConfig.label} · {paxList.length} traveler{paxList.length > 1 ? "s" : ""}</p></div></div></div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {sections.map(sec => (<div key={sec.id} className={cn("border rounded-xl overflow-hidden transition-all", sec.included ? "border-border" : "border-dashed border-border/50 opacity-50")}><button onClick={() => sec.included && toggleSection(sec.id)} className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-muted/30 transition-colors"><sec.icon className={cn("w-4 h-4 flex-shrink-0", sec.included ? "text-primary" : "text-muted-foreground")} /><span className="text-xs font-bold text-foreground flex-1 text-left">{sec.label}</span>{!sec.included && <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">Not included</span>}<span className={cn("text-xs font-bold", sec.included ? "text-primary" : "text-muted-foreground")}>{formatDirectPrice(sec.price)}</span>{sec.included && (expandedSections.has(sec.id) ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />)}</button>{sec.included && expandedSections.has(sec.id) && (<div className="px-3.5 pb-3 pt-0.5 border-t border-border/50">{sec.content}</div>)}</div>))}
          {itinerary.excluded && itinerary.excluded.length > 0 && (<div className="bg-muted/20 rounded-xl p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Not included (traveler covers)</p><div className="space-y-1">{itinerary.excluded.map((item: string, i: number) => (<p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><X className="w-3 h-3 mt-0.5 text-destructive/50 flex-shrink-0" /> {item}</p>))}</div></div>)}
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/20"><div className="flex items-center justify-between mb-2.5"><span className="text-xs font-semibold text-foreground">Total Payable</span><span className="text-lg font-bold text-primary">{formatDirectPrice(verifiedTotal)}</span></div><Button className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold gap-2" onClick={() => setStep("payment")}><CreditCard className="w-4 h-4" /> Proceed to Payment</Button></div>
      </div>
    );
  }

  // ── Step: Payment ──
  if (step === "payment") {
    const paymentOptions = [
      { id: "card", label: "Credit / Debit Card", icon: CreditCard, desc: "Visa, Mastercard, Amex" },
      { id: "bank", label: "Bank Transfer", icon: Building2, desc: "Direct bank payment" },
      { id: "wallet", label: "Wallet Balance", icon: Wallet, desc: "Pay from wallet" },
    ];
    return (
      <div className="flex flex-col max-h-[80vh]">
        <div className="px-5 py-4 border-b border-border bg-muted/20"><div className="flex items-center gap-3"><button onClick={() => setStep("breakdown")} className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4 text-muted-foreground" /></button><div className="flex-1"><h3 className="text-sm font-bold text-foreground">Payment</h3><p className="text-[10px] text-muted-foreground">{tierConfig.label} · {formatDirectPrice(verifiedTotal)}</p></div></div></div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="bg-muted/30 rounded-xl p-3.5 space-y-1.5">
            {tierConfig.keys.map(k => (<div key={k} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{budgetKeyLabel[k] || k}</span><span className="font-semibold text-foreground">{formatDirectPrice(verifiedPrices[k] || itinerary.budget_estimate.breakdown[k] || 0)}</span></div>))}
            <div className="border-t border-border pt-1.5 mt-1 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Total</span><span className="text-lg font-bold text-primary">{formatDirectPrice(verifiedTotal)}</span></div>
          </div>
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Payment Method</p><div className="space-y-2">{paymentOptions.map(pm => (<button key={pm.id} onClick={() => setSelectedPayment(pm.id)} className={cn("w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left", selectedPayment === pm.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}><pm.icon className={cn("w-5 h-5", selectedPayment === pm.id ? "text-primary" : "text-muted-foreground")} /><div className="flex-1"><p className={cn("text-xs font-bold", selectedPayment === pm.id ? "text-foreground" : "text-muted-foreground")}>{pm.label}</p><p className="text-[10px] text-muted-foreground">{pm.desc}</p></div>{selectedPayment === pm.id && (<div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-primary-foreground" /></div>)}</button>))}</div></div>
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <Button className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold gap-2 shadow-lg shadow-primary/20" onClick={handleSubmitBooking} disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Pay {formatDirectPrice(verifiedTotal)} Securely</Button>
          <p className="text-[9px] text-center text-muted-foreground mt-2 flex items-center justify-center gap-1"><Shield className="w-3 h-3" /> Secure payment · Verified pricing · Instant confirmation</p>
        </div>
      </div>
    );
  }

  // ── Terminal States ──
  if (step === "booking") return (<div className="p-8 flex flex-col items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div><div className="text-center"><p className="text-base font-bold text-foreground">Processing Your Booking</p><p className="text-xs text-muted-foreground mt-1">Securing your {tierConfig.label.toLowerCase()}…</p></div></div>);

  if (step === "done") return (<div className="p-8 flex flex-col items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-[hsl(152_70%_42%/0.15)] flex items-center justify-center"><Check className="w-8 h-8 text-[hsl(152_70%_42%)]" /></div><div className="text-center"><p className="text-lg font-bold text-foreground">Booking Confirmed! 🎉</p><p className="text-sm text-muted-foreground mt-1.5">Confirmation sent to <span className="font-semibold text-foreground">{contactEmail}</span></p><p className="text-xs text-muted-foreground mt-1">{tierConfig.label} — {formatDirectPrice(verifiedTotal)}</p></div><Button variant="outline" className="rounded-xl mt-2" onClick={onClose}>Close</Button></div>);

  if (step === "error") return (<div className="p-8 flex flex-col items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-8 h-8 text-destructive" /></div><div className="text-center"><p className="text-base font-bold text-foreground">Something went wrong</p><p className="text-xs text-muted-foreground mt-1">{verifyError || "Please try again"}</p></div><Button className="rounded-xl" onClick={() => setStep("verifying")}>Try Again</Button></div>);

  return null;
};

export default BookingDialogContent;
