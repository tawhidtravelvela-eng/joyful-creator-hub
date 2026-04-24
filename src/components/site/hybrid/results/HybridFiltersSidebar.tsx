import { useState, ReactNode } from "react";
import { Sliders, Search, X, Sunrise, Sun, Sunset, Moon, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ShellProps {
  title?: string;
  activeCount?: number;
  onResetAll?: () => void;
  children: ReactNode;
}

export const HybridFilterShell = ({ title = "Refine results", activeCount = 0, onResetAll, children }: ShellProps) => (
  <div
    className={cn(
      "relative rounded-3xl overflow-hidden",
      "bg-card/70 backdrop-blur-xl",
      "border border-border/40",
      "shadow-[0_2px_24px_-8px_hsl(var(--foreground)/0.08)]",
    )}
  >
    <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[hsl(var(--primary)/0.10)] blur-3xl" />
    <div className="pointer-events-none absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-[hsl(var(--accent)/0.08)] blur-3xl" />

    <div className="relative px-5 pt-5 pb-3 border-b border-border/40">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80 mb-1">Editorial</div>
          <h3
            className="text-[18px] font-semibold text-foreground tracking-tight"
            style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
          >
            {title}
          </h3>
        </div>
        <Sliders className="w-4 h-4 text-primary/70" />
      </div>
      {activeCount > 0 && onResetAll && (
        <button
          onClick={onResetAll}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 uppercase tracking-wider"
        >
          Reset all · {activeCount}
        </button>
      )}
    </div>

    <div className="relative p-5 space-y-6">{children}</div>
  </div>
);

export const HybridFilterSection = ({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="relative">
    <div className="flex items-baseline justify-between mb-3">
      <div className="flex items-baseline gap-2">
        <span className="h-1 w-1 rounded-full bg-primary/70" />
        <h4
          className="text-[12.5px] font-semibold text-foreground tracking-wide"
          style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h4>
      </div>
      {action}
    </div>
    {hint && <p className="text-[10.5px] text-muted-foreground mb-2.5">{hint}</p>}
    <div className="space-y-2 pl-3 border-l border-border/30">{children}</div>
  </section>
);

export const HybridChoiceChip = ({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all border",
      active
        ? "border-primary/50 bg-primary/10 text-primary shadow-[0_4px_12px_-6px_hsl(var(--primary)/0.4)]"
        : "border-border/50 bg-background/50 text-foreground hover:border-primary/30 hover:text-primary",
      disabled && "opacity-40 cursor-not-allowed",
    )}
  >
    {children}
  </button>
);

export const HybridPriceRange = ({
  currencySymbol,
  min,
  max,
  value,
  onChange,
}: {
  currencySymbol: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-baseline justify-between">
      <div>
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">From</div>
        <div
          className="text-[20px] font-semibold text-foreground tabular-nums leading-tight"
          style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
        >
          {currencySymbol}{value[0].toLocaleString()}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">Up to</div>
        <div
          className="text-[20px] font-semibold text-primary tabular-nums leading-tight"
          style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
        >
          {currencySymbol}{value[1].toLocaleString()}
        </div>
      </div>
    </div>
    <Slider
      min={min}
      max={max}
      step={Math.max(50, Math.round((max - min) / 100))}
      value={value}
      onValueChange={(v) => onChange(v as [number, number])}
    />
  </div>
);

const TIME_SLOTS: { id: string; label: string; range: [number, number]; icon: typeof Sun }[] = [
  { id: "morning",   label: "Morning",   range: [6, 12],  icon: Sunrise },
  { id: "afternoon", label: "Afternoon", range: [12, 18], icon: Sun },
  { id: "evening",   label: "Evening",   range: [18, 24], icon: Sunset },
  { id: "night",     label: "Night",     range: [0, 6],   icon: Moon },
];

const formatHour = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

export const HybridTimeOfDayPicker = ({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) => {
  const isActive = (range: [number, number]) => value[0] === range[0] && value[1] === range[1];
  const anySelected = value[0] !== 0 || value[1] !== 24;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {TIME_SLOTS.map((slot) => {
          const Icon = slot.icon;
          const active = isActive(slot.range);
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onChange(active ? [0, 24] : slot.range)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2.5 transition-all",
                active
                  ? "border-primary/40 bg-primary/10 text-primary shadow-[0_4px_14px_-6px_hsl(var(--primary)/0.45)]"
                  : "border-border/50 bg-background/40 hover:border-primary/30 text-foreground",
              )}
            >
              <Icon className={cn("w-4 h-4", active ? "text-primary" : "text-muted-foreground")} />
              <span className="text-[11px] font-semibold leading-tight">{slot.label}</span>
              <span className={cn("text-[9.5px] tabular-nums leading-tight", active ? "text-primary/80" : "text-muted-foreground")}>
                {formatHour(slot.range[0])}–{formatHour(slot.range[1])}
              </span>
            </button>
          );
        })}
      </div>
      {anySelected && (
        <button onClick={() => onChange([0, 24])} className="text-[10.5px] text-primary font-semibold hover:underline">
          Clear time selection
        </button>
      )}
    </div>
  );
};

// Flights variant
export interface AirlineOption { code: string; name: string; count: number; lowestPrice: number; }
export interface ActiveChip { id: string; label: string; onRemove: () => void; }

interface FlightsProps {
  currencySymbol: string;
  activeChips: ActiveChip[];
  priceMin: number; priceMax: number;
  priceValue: [number, number];
  onPriceChange: (v: [number, number]) => void;
  stopFilter: number | null;
  onStopChange: (v: number | null) => void;
  stopCounts: { 0: number; 1: number; 2: number };
  airlines: AirlineOption[];
  selectedAirlines: Set<string>;
  onToggleAirline: (code: string) => void;
  departureTime: [number, number];
  onDepartureTimeChange: (v: [number, number]) => void;
  arrivalTime: [number, number];
  onArrivalTimeChange: (v: [number, number]) => void;
  refundableOnly: boolean;
  onRefundableChange: (v: boolean) => void;
  onResetAll: () => void;
}

export const HybridFlightsFiltersSidebar = ({
  currencySymbol,
  activeChips,
  priceMin, priceMax, priceValue, onPriceChange,
  stopFilter, onStopChange, stopCounts,
  airlines, selectedAirlines, onToggleAirline,
  departureTime, onDepartureTimeChange,
  arrivalTime, onArrivalTimeChange,
  refundableOnly, onRefundableChange,
  onResetAll,
}: FlightsProps) => {
  const [airlineQuery, setAirlineQuery] = useState("");
  const [showAllAirlines, setShowAllAirlines] = useState(false);
  const filteredAirlines = airlines.filter((a) => a.name.toLowerCase().includes(airlineQuery.toLowerCase()));
  const visibleAirlines = showAllAirlines ? filteredAirlines : filteredAirlines.slice(0, 5);

  return (
    <HybridFilterShell title="Refine flights" activeCount={activeChips.length} onResetAll={onResetAll}>
      {activeChips.length > 0 && (
        <HybridFilterSection title="Active">
          <div className="flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.id}
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20 hover:bg-primary/15"
              >
                {chip.label}<X className="w-3 h-3" />
              </button>
            ))}
          </div>
        </HybridFilterSection>
      )}

      <HybridFilterSection title="Stops" hint="Direct flights save hours of travel time.">
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 0, label: "Non-stop", count: stopCounts[0] },
            { value: 1, label: "1 Stop", count: stopCounts[1] },
            { value: 2, label: "2+ Stops", count: stopCounts[2] },
          ].map((opt) => (
            <HybridChoiceChip
              key={opt.value}
              active={stopFilter === opt.value}
              disabled={opt.count === 0}
              onClick={() => onStopChange(stopFilter === opt.value ? null : opt.value)}
            >
              {opt.label}
              <span className="text-[10px] tabular-nums opacity-70">{opt.count}</span>
            </HybridChoiceChip>
          ))}
        </div>
      </HybridFilterSection>

      <HybridFilterSection title="Price" hint="Adjust to fit your budget.">
        <HybridPriceRange currencySymbol={currencySymbol} min={priceMin} max={priceMax} value={priceValue} onChange={onPriceChange} />
      </HybridFilterSection>

      <HybridFilterSection title="Departure">
        <HybridTimeOfDayPicker value={departureTime} onChange={onDepartureTimeChange} />
      </HybridFilterSection>

      <HybridFilterSection title="Arrival">
        <HybridTimeOfDayPicker value={arrivalTime} onChange={onArrivalTimeChange} />
      </HybridFilterSection>

      {airlines.length > 0 && (
        <HybridFilterSection
          title="Airlines"
          action={selectedAirlines.size > 0 ? (
            <button
              onClick={() => airlines.forEach((a) => selectedAirlines.has(a.code) && onToggleAirline(a.code))}
              className="text-[10.5px] text-primary font-semibold uppercase tracking-wider"
            >
              Clear
            </button>
          ) : null}
        >
          {airlines.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={airlineQuery}
                onChange={(e) => setAirlineQuery(e.target.value)}
                placeholder="Search airlines…"
                className="h-8 pl-7 text-[12px] rounded-full bg-background/60 border-border/50"
              />
            </div>
          )}
          <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-1">
            {visibleAirlines.map((a) => (
              <label
                key={a.code}
                className="flex items-center gap-2.5 cursor-pointer group py-1 rounded-xl hover:bg-muted/30 px-1"
              >
                <Checkbox
                  checked={selectedAirlines.has(a.code)}
                  onCheckedChange={() => onToggleAirline(a.code)}
                  className="h-4 w-4 rounded-[4px]"
                />
                <div className="h-7 w-7 rounded bg-muted/40 border border-border/40 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={`https://pics.avs.io/64/64/${a.code}.png`}
                    alt={a.name}
                    className="w-5 h-5 object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <span className="text-[12.5px] font-medium text-foreground truncate flex-1 group-hover:text-primary">{a.name}</span>
                <span className="text-[11px] font-bold text-foreground/80 tabular-nums whitespace-nowrap">
                  {currencySymbol}{a.lowestPrice.toLocaleString()}
                </span>
              </label>
            ))}
          </div>
          {filteredAirlines.length > 5 && (
            <button onClick={() => setShowAllAirlines((s) => !s)} className="text-[11.5px] text-primary font-semibold hover:underline">
              {showAllAirlines ? "Show less" : `Show ${filteredAirlines.length - 5} more`}
            </button>
          )}
        </HybridFilterSection>
      )}

      <HybridFilterSection title="Fare options">
        <label className="flex items-center justify-between gap-2 cursor-pointer">
          <span className="text-[12.5px] text-foreground font-medium">Refundable only</span>
          <Switch checked={refundableOnly} onCheckedChange={onRefundableChange} />
        </label>
      </HybridFilterSection>
    </HybridFilterShell>
  );
};

// Hotels variant
interface HotelsFilterProps {
  currencySymbol: string;
  priceMin: number; priceMax: number;
  priceValue: [number, number];
  onPriceChange: (v: [number, number]) => void;
  starRatings: number[];
  onToggleStar: (n: number) => void;
  amenities: { id: string; label: string; count?: number }[];
  selectedAmenities: Set<string>;
  onToggleAmenity: (id: string) => void;
  guestRatingMin: number;
  onGuestRatingChange: (n: number) => void;
  freeCancellation: boolean;
  onFreeCancellationChange: (v: boolean) => void;
  activeCount: number;
  onResetAll: () => void;
}

export const HybridHotelsFiltersSidebar = ({
  currencySymbol,
  priceMin, priceMax, priceValue, onPriceChange,
  starRatings, onToggleStar,
  amenities, selectedAmenities, onToggleAmenity,
  guestRatingMin, onGuestRatingChange,
  freeCancellation, onFreeCancellationChange,
  activeCount, onResetAll,
}: HotelsFilterProps) => (
  <HybridFilterShell title="Refine stays" activeCount={activeCount} onResetAll={onResetAll}>
    <HybridFilterSection title="Nightly price" hint="Per room, per night.">
      <HybridPriceRange currencySymbol={currencySymbol} min={priceMin} max={priceMax} value={priceValue} onChange={onPriceChange} />
    </HybridFilterSection>

    <HybridFilterSection title="Star rating">
      <div className="flex flex-wrap gap-1.5">
        {[5, 4, 3, 2, 1].map((n) => (
          <HybridChoiceChip key={n} active={starRatings.includes(n)} onClick={() => onToggleStar(n)}>
            {n}<Star className="w-3 h-3 fill-current" />
          </HybridChoiceChip>
        ))}
      </div>
    </HybridFilterSection>

    <HybridFilterSection title="Guest rating" hint="Minimum review score (out of 10).">
      <div className="flex flex-wrap gap-1.5">
        {[9, 8, 7, 6].map((n) => (
          <HybridChoiceChip key={n} active={guestRatingMin === n} onClick={() => onGuestRatingChange(guestRatingMin === n ? 0 : n)}>
            {n}+ {n === 9 ? "Exceptional" : n === 8 ? "Very good" : n === 7 ? "Good" : "Pleasant"}
          </HybridChoiceChip>
        ))}
      </div>
    </HybridFilterSection>

    {amenities.length > 0 && (
      <HybridFilterSection title="Amenities">
        <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-1">
          {amenities.map((a) => (
            <label key={a.id} className="flex items-center gap-2.5 cursor-pointer group py-1 rounded-xl hover:bg-muted/30 px-1">
              <Checkbox
                checked={selectedAmenities.has(a.id)}
                onCheckedChange={() => onToggleAmenity(a.id)}
                className="h-4 w-4 rounded-[4px]"
              />
              <span className="text-[12.5px] font-medium text-foreground truncate flex-1 group-hover:text-primary">{a.label}</span>
              {typeof a.count === "number" && (
                <span className="text-[10.5px] text-muted-foreground tabular-nums">{a.count}</span>
              )}
            </label>
          ))}
        </div>
      </HybridFilterSection>
    )}

    <HybridFilterSection title="Cancellation">
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-[12.5px] text-foreground font-medium">Free cancellation</span>
        <Switch checked={freeCancellation} onCheckedChange={onFreeCancellationChange} />
      </label>
    </HybridFilterSection>
  </HybridFilterShell>
);

// Tours variant
interface ToursFilterProps {
  currencySymbol: string;
  priceMin: number; priceMax: number;
  priceValue: [number, number];
  onPriceChange: (v: [number, number]) => void;
  durations: { id: string; label: string; count?: number }[];
  selectedDurations: Set<string>;
  onToggleDuration: (id: string) => void;
  categories: { id: string; label: string; count?: number }[];
  selectedCategories: Set<string>;
  onToggleCategory: (id: string) => void;
  ratingMin: number;
  onRatingChange: (n: number) => void;
  freeCancellation: boolean;
  onFreeCancellationChange: (v: boolean) => void;
  activeCount: number;
  onResetAll: () => void;
}

export const HybridToursFiltersSidebar = ({
  currencySymbol,
  priceMin, priceMax, priceValue, onPriceChange,
  durations, selectedDurations, onToggleDuration,
  categories, selectedCategories, onToggleCategory,
  ratingMin, onRatingChange,
  freeCancellation, onFreeCancellationChange,
  activeCount, onResetAll,
}: ToursFilterProps) => (
  <HybridFilterShell title="Refine experiences" activeCount={activeCount} onResetAll={onResetAll}>
    <HybridFilterSection title="Price" hint="Per person.">
      <HybridPriceRange currencySymbol={currencySymbol} min={priceMin} max={priceMax} value={priceValue} onChange={onPriceChange} />
    </HybridFilterSection>

    {durations.length > 0 && (
      <HybridFilterSection title="Duration">
        <div className="flex flex-wrap gap-1.5">
          {durations.map((d) => (
            <HybridChoiceChip key={d.id} active={selectedDurations.has(d.id)} onClick={() => onToggleDuration(d.id)}>
              {d.label}
              {typeof d.count === "number" && <span className="text-[10px] tabular-nums opacity-70">{d.count}</span>}
            </HybridChoiceChip>
          ))}
        </div>
      </HybridFilterSection>
    )}

    {categories.length > 0 && (
      <HybridFilterSection title="Experience type">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <HybridChoiceChip key={c.id} active={selectedCategories.has(c.id)} onClick={() => onToggleCategory(c.id)}>
              {c.label}
              {typeof c.count === "number" && <span className="text-[10px] tabular-nums opacity-70">{c.count}</span>}
            </HybridChoiceChip>
          ))}
        </div>
      </HybridFilterSection>
    )}

    <HybridFilterSection title="Traveller rating">
      <div className="flex flex-wrap gap-1.5">
        {[4.5, 4, 3.5].map((n) => (
          <HybridChoiceChip key={n} active={ratingMin === n} onClick={() => onRatingChange(ratingMin === n ? 0 : n)}>
            {n}+ <Star className="w-3 h-3 fill-current" />
          </HybridChoiceChip>
        ))}
      </div>
    </HybridFilterSection>

    <HybridFilterSection title="Cancellation">
      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-[12.5px] text-foreground font-medium">Free cancellation</span>
        <Switch checked={freeCancellation} onCheckedChange={onFreeCancellationChange} />
      </label>
    </HybridFilterSection>
  </HybridFilterShell>
);

export default HybridFlightsFiltersSidebar;
