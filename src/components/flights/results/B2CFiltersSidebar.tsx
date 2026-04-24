import { useState } from "react";
import { Filter, Search, X, Sunrise, Sun, Sunset, Moon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AirlineOption {
  code: string;
  name: string;
  count: number;
  lowestPrice: number;
}

export interface ActiveChip { id: string; label: string; onRemove: () => void; }

interface Props {
  currencySymbol: string;
  activeChips: ActiveChip[];

  // Price
  priceMin: number;
  priceMax: number;
  priceValue: [number, number];
  onPriceChange: (v: [number, number]) => void;

  // Stops
  stopFilter: number | null;
  onStopChange: (v: number | null) => void;
  stopCounts: { 0: number; 1: number; 2: number };

  // Airlines
  airlines: AirlineOption[];
  selectedAirlines: Set<string>;
  onToggleAirline: (code: string) => void;

  // Departure / Arrival time
  departureTime: [number, number];
  onDepartureTimeChange: (v: [number, number]) => void;
  arrivalTime: [number, number];
  onArrivalTimeChange: (v: [number, number]) => void;

  // Refundable
  refundableOnly: boolean;
  onRefundableChange: (v: boolean) => void;

  onResetAll: () => void;
}

const Section = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="border-t border-border/50 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
    <div className="flex items-center justify-between mb-2.5">
      <h4 className="text-[11px] font-bold text-foreground tracking-wider uppercase">{title}</h4>
      {action}
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const TIME_SLOTS: { id: string; label: string; range: [number, number]; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "morning",   label: "Morning",   range: [6, 12],  icon: Sunrise },
  { id: "afternoon", label: "Afternoon", range: [12, 18], icon: Sun },
  { id: "evening",   label: "Evening",   range: [18, 24], icon: Sunset },
  { id: "night",     label: "Night",     range: [0, 6],   icon: Moon },
];

const formatHour = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
const rangeLabel = (r: [number, number]) =>
  r[0] === 0 && r[1] === 24 ? "Any time" : `${formatHour(r[0])} – ${formatHour(r[1])}`;

const TimeOfDayPicker = ({
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
                "flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 transition-all",
                active
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border/60 bg-background hover:border-primary/40 hover:bg-muted/40 text-foreground",
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-muted-foreground")} />
              <span className="text-[11px] font-semibold leading-tight">{slot.label}</span>
              <span className={cn("text-[9.5px] tabular-nums leading-tight", active ? "text-primary/80" : "text-muted-foreground")}>
                {formatHour(slot.range[0])}–{formatHour(slot.range[1])}
              </span>
            </button>
          );
        })}
      </div>
      {anySelected && (
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>{rangeLabel(value)}</span>
          <button
            onClick={() => onChange([0, 24])}
            className="text-primary font-semibold hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export const B2CFiltersSidebar = ({
  currencySymbol,
  activeChips,
  priceMin, priceMax, priceValue, onPriceChange,
  stopFilter, onStopChange, stopCounts,
  airlines, selectedAirlines, onToggleAirline,
  departureTime, onDepartureTimeChange,
  arrivalTime, onArrivalTimeChange,
  refundableOnly, onRefundableChange,
  onResetAll,
}: Props) => {
  const [airlineQuery, setAirlineQuery] = useState("");
  const [showAllAirlines, setShowAllAirlines] = useState(false);

  const filteredAirlines = airlines.filter(a => a.name.toLowerCase().includes(airlineQuery.toLowerCase()));
  const visibleAirlines = showAllAirlines ? filteredAirlines : filteredAirlines.slice(0, 5);

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-muted/30 to-transparent">
        <h3 className="font-bold text-foreground text-[14px] tracking-tight inline-flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Filters
        </h3>
        {activeChips.length > 0 && (
          <button
            onClick={onResetAll}
            className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Reset All
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <Section title="Active Filters">
            <div className="flex flex-wrap gap-1.5">
              {activeChips.map(chip => (
                <button
                  key={chip.id}
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
                >
                  {chip.label}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Stops */}
        <Section title="Stops">
          {[
            { value: 0, label: "Non-stop", count: stopCounts[0] },
            { value: 1, label: "1 Stop", count: stopCounts[1] },
            { value: 2, label: "2+ Stops", count: stopCounts[2] },
          ].map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 cursor-pointer group py-0.5"
            >
              <Checkbox
                checked={stopFilter === opt.value}
                onCheckedChange={(v) => onStopChange(v ? opt.value : null)}
                className="h-4 w-4 rounded-[4px]"
                disabled={opt.count === 0}
              />
              <span className={cn(
                "text-[12.5px] font-medium flex-1 group-hover:text-primary transition-colors",
                opt.count === 0 ? "text-muted-foreground/50" : "text-foreground"
              )}>
                {opt.label}
              </span>
              <span className="text-[10.5px] text-muted-foreground tabular-nums">{opt.count}</span>
            </label>
          ))}
        </Section>

        {/* Airlines */}
        {airlines.length > 0 && (
          <Section
            title="Airlines"
            action={
              selectedAirlines.size > 0 ? (
                <button
                  onClick={() => airlines.forEach(a => selectedAirlines.has(a.code) && onToggleAirline(a.code))}
                  className="text-[10.5px] text-primary font-semibold uppercase tracking-wider"
                >
                  Clear
                </button>
              ) : null
            }
          >
            {airlines.length > 5 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={airlineQuery}
                  onChange={(e) => setAirlineQuery(e.target.value)}
                  placeholder="Search airlines…"
                  className="h-8 pl-7 text-[12px] rounded-lg"
                />
              </div>
            )}
            <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-1">
              {visibleAirlines.map(a => (
                <label
                  key={a.code}
                  className="flex items-center gap-2.5 cursor-pointer group py-1 rounded-md hover:bg-muted/40 px-1"
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
                  <span className="text-[12.5px] font-medium text-foreground truncate flex-1 group-hover:text-primary">
                    {a.name}
                  </span>
                  <span className="text-[11px] font-bold text-foreground/80 tabular-nums whitespace-nowrap">
                    {currencySymbol}{a.lowestPrice.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
            {filteredAirlines.length > 5 && (
              <button
                onClick={() => setShowAllAirlines(s => !s)}
                className="text-[11.5px] text-primary font-semibold hover:underline mt-1 block"
              >
                {showAllAirlines ? "Show Less" : `Show ${filteredAirlines.length - 5} more`}
              </button>
            )}
          </Section>
        )}

        {/* Price range */}
        <Section title="Price Range">
          <div className="flex items-center justify-between text-[12px] tabular-nums text-foreground font-semibold">
            <span>{currencySymbol}{priceValue[0].toLocaleString()}</span>
            <span className="text-muted-foreground">—</span>
            <span>{currencySymbol}{priceValue[1].toLocaleString()}</span>
          </div>
          <Slider
            min={priceMin}
            max={priceMax}
            step={Math.max(50, Math.round((priceMax - priceMin) / 100))}
            value={priceValue}
            onValueChange={(v) => onPriceChange(v as [number, number])}
            className="mt-2"
          />
        </Section>

        {/* Departure time */}
        <Section title="Departure Time">
          <TimeOfDayPicker value={departureTime} onChange={onDepartureTimeChange} />
        </Section>

        {/* Arrival time */}
        <Section title="Arrival Time">
          <TimeOfDayPicker value={arrivalTime} onChange={onArrivalTimeChange} />
        </Section>

        {/* Refundable */}
        <Section title="Refund Options">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-foreground font-medium">Refundable Only</span>
            <Switch checked={refundableOnly} onCheckedChange={onRefundableChange} />
          </div>
        </Section>

        <Button
          onClick={onResetAll}
          variant="outline"
          className="w-full mt-5 h-9 rounded-xl text-primary border-primary/30 hover:bg-primary/5 font-semibold text-[12px]"
        >
          Reset All Filters
        </Button>
      </div>
    </div>
  );
};

export default B2CFiltersSidebar;
