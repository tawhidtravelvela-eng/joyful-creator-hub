import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from "lucide-react";

export interface FiltersState {
  maxPrice: number;
  stopFilter: number | null;
  selectedAirlines: Set<string>;
}

interface Props {
  state: FiltersState;
  setState: (s: FiltersState) => void;
  priceMin: number;
  priceMax: number;
  airlineOptions: { code: string; name: string; lowestPrice: number }[];
  stopCounts: Record<number, number>;
  totalCount?: number;
  currencySymbol: string;
  onClear?: () => void;
  onApply?: () => void;
}

const INITIAL_AIRLINES = 5;

export default function FiltersSidebar({
  state, setState, priceMin, priceMax, airlineOptions, stopCounts,
  totalCount, currencySymbol, onClear, onApply,
}: Props) {
  const update = (patch: Partial<FiltersState>) => setState({ ...state, ...patch });
  const [airlineQuery, setAirlineQuery] = useState("");
  const [showAllAirlines, setShowAllAirlines] = useState(false);
  const [openSections, setOpenSections] = useState({
    price: true, stops: true, airlines: true,
    baggage: false, depart: false, arrival: false, duration: false,
  });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const filteredAirlines = airlineOptions.filter((a) =>
    a.name.toLowerCase().includes(airlineQuery.toLowerCase())
  );
  const visibleAirlines = showAllAirlines ? filteredAirlines : filteredAirlines.slice(0, INITIAL_AIRLINES);

  const totalAirlineCount = stopCounts[0] + stopCounts[1] + stopCounts[2] || totalCount || 0;

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-bold text-foreground">Refine Results</h3>
        {onClear && (
          <button onClick={onClear} className="text-[11px] font-semibold text-primary hover:underline">
            Reset All
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Price Range */}
        <Section title="Price Range" open={openSections.price} onToggle={() => toggle("price")}>
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{currencySymbol}{priceMin.toLocaleString()}</span>
              <span className="font-bold text-primary tabular-nums">
                {currencySymbol}{priceMin.toLocaleString()} - {currencySymbol}{state.maxPrice.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[state.maxPrice]}
              min={priceMin}
              max={priceMax}
              step={Math.max(50, Math.round((priceMax - priceMin) / 40))}
              onValueChange={(v) => update({ maxPrice: v[0] })}
              className="py-1"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{currencySymbol}{priceMin.toLocaleString()}</span>
              <span>{currencySymbol}{priceMax.toLocaleString()}</span>
            </div>
          </div>
        </Section>

        {/* Stops — 4-pill grid */}
        <Section title="Stops" open={openSections.stops} onToggle={() => toggle("stops")}>
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { v: null, label: "Any", count: totalAirlineCount },
              { v: 0, label: "Direct", count: stopCounts[0] || 0 },
              { v: 1, label: "1 Stop", count: stopCounts[1] || 0 },
              { v: 2, label: "2+ Stops", count: stopCounts[2] || 0 },
            ].map((opt) => {
              const active = state.stopFilter === opt.v;
              return (
                <button
                  key={String(opt.v)}
                  onClick={() => update({ stopFilter: opt.v })}
                  className={cn(
                    "flex flex-col items-center justify-center px-1 py-2 rounded-lg border text-[11px] transition-all",
                    active
                      ? "bg-primary/10 border-primary text-primary font-bold"
                      : "bg-card border-border/70 text-foreground hover:border-primary/40"
                  )}
                >
                  <span className="font-semibold leading-tight">{opt.label}</span>
                  <span className={cn("text-[10px] mt-0.5", active ? "text-primary/80" : "text-muted-foreground")}>
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Airlines */}
        {airlineOptions.length > 0 && (
          <Section
            title="Airlines"
            open={openSections.airlines}
            onToggle={() => toggle("airlines")}
            action={
              state.selectedAirlines.size > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    update({ selectedAirlines: new Set() });
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Clear
                </button>
              )
            }
          >
            <div className="space-y-2 pt-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={airlineQuery}
                  onChange={(e) => setAirlineQuery(e.target.value)}
                  placeholder="Search airlines..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/60 rounded-lg focus:outline-none focus:border-primary/40 focus:bg-card transition-colors"
                />
              </div>

              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {visibleAirlines.map((a) => {
                  const checked = state.selectedAirlines.has(a.code);
                  return (
                    <label
                      key={a.code}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = new Set(state.selectedAirlines);
                          if (v) next.add(a.code);
                          else next.delete(a.code);
                          update({ selectedAirlines: next });
                        }}
                      />
                      <img
                        src={`https://pics.avs.io/40/40/${a.code}.png`}
                        alt=""
                        className="h-5 w-5 object-contain shrink-0 rounded"
                        loading="lazy"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                      <span className="text-xs text-foreground flex-1 truncate font-medium">{a.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {currencySymbol}{Math.round(a.lowestPrice).toLocaleString()}
                      </span>
                    </label>
                  );
                })}
              </div>

              {filteredAirlines.length > INITIAL_AIRLINES && (
                <button
                  onClick={() => setShowAllAirlines((v) => !v)}
                  className="text-[11px] font-semibold text-primary hover:underline px-2"
                >
                  {showAllAirlines ? "Show less" : `Show ${filteredAirlines.length - INITIAL_AIRLINES} more`}
                </button>
              )}
            </div>
          </Section>
        )}

        {/* Collapsed placeholder sections (UX parity with reference) */}
        <Section title="Baggage" open={openSections.baggage} onToggle={() => toggle("baggage")}>
          <p className="text-[11px] text-muted-foreground pt-1">Baggage filters coming soon.</p>
        </Section>
        <Section title="Departure Time" open={openSections.depart} onToggle={() => toggle("depart")}>
          <p className="text-[11px] text-muted-foreground pt-1">Time of day filters coming soon.</p>
        </Section>
        <Section title="Arrival Time" open={openSections.arrival} onToggle={() => toggle("arrival")}>
          <p className="text-[11px] text-muted-foreground pt-1">Time of day filters coming soon.</p>
        </Section>
        <Section title="Duration" open={openSections.duration} onToggle={() => toggle("duration")}>
          <p className="text-[11px] text-muted-foreground pt-1">Duration filters coming soon.</p>
        </Section>
      </div>

      {/* Sticky bottom apply */}
      {onApply && (
        <div className="border-t border-border/60 p-3 bg-muted/20 rounded-b-xl">
          <Button
            onClick={onApply}
            className="w-full h-9 text-xs font-bold gap-1.5 rounded-lg shadow-sm shadow-primary/20"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Apply Filters
            {totalCount !== undefined && (
              <span className="ml-auto bg-primary-foreground/20 text-primary-foreground rounded-md px-1.5 py-0.5 text-[10px]">
                {totalCount} Results
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/* --- Collapsible section helper --- */
function Section({
  title, open, onToggle, action, children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/40 last:border-b-0 pb-3 last:pb-0">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors flex-1 text-left py-1"
        >
          <span>{title}</span>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {action}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
