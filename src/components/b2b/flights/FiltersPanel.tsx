import { Filter, ChevronDown, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { B2BFiltersState } from "./types";

interface AirlineOpt { code: string; name: string; count: number; price: number; tag?: "cheapest" | "best_value" }

interface Props {
  filters: B2BFiltersState;
  onChange: (next: B2BFiltersState) => void;
  airlines: AirlineOpt[];
  onReset: () => void;
  currencySymbol: string;
  visible: boolean;
  onToggleVisible: () => void;
  appliedCount: number;
}

const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <div className="border-t border-border/60 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
    <div className="flex items-center justify-between mb-2.5">
      <h4 className="text-[13px] font-bold text-foreground tracking-tight">{title}</h4>
      {action}
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const StopRow = ({ id, label, price, currencySymbol, checked, onChange }: { id: string; label: string; price?: number; currencySymbol: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer group">
    <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} className="h-4 w-4 rounded-[4px]" />
    <span className="text-[12.5px] text-foreground font-medium group-hover:text-primary transition-colors flex-1">{label}</span>
    {price !== undefined && Number.isFinite(price) && <span className="text-[11.5px] font-semibold tabular-nums text-foreground/80">{currencySymbol}{price.toLocaleString()}</span>}
  </label>
);

const ToggleRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[12.5px] text-foreground font-medium">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export const FiltersPanel = ({
  filters, onChange, airlines, onReset, currencySymbol,
  visible, onToggleVisible, appliedCount,
}: Props) => {
  const [airlineQuery, setAirlineQuery] = useState("");
  const [showAllAirlines, setShowAllAirlines] = useState(false);

  const set = <K extends keyof B2BFiltersState>(k: K, v: B2BFiltersState[K]) => onChange({ ...filters, [k]: v });
  const tog = <T,>(arr: T[], v: T) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const filteredAirlines = airlines.filter(a => a.name.toLowerCase().includes(airlineQuery.toLowerCase()));
  const visibleAirlines = showAllAirlines ? filteredAirlines : filteredAirlines.slice(0, 5);
  const minStopPrice = airlines.length ? airlines.reduce((min, a) => Math.min(min, a.price), Infinity) : undefined;

  if (!visible) {
    return (
      <Button variant="outline" onClick={onToggleVisible}
        className="w-full justify-center gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/5 h-11 font-semibold">
        <Filter className="h-4 w-4" /> Show Filters {appliedCount > 0 && <span className="ml-1 bg-primary text-primary-foreground text-[10px] h-5 min-w-5 px-1.5 rounded-full inline-flex items-center justify-center">{appliedCount}</span>}
      </Button>
    );
  }

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <button onClick={onToggleVisible}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-primary/5 border-b border-primary/10 hover:bg-primary/10 transition-colors">
        <span className="flex items-center gap-2 text-primary font-semibold text-[13px]">
          <Filter className="h-4 w-4" /> Hide Filters
        </span>
        {appliedCount > 0 && <span className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 px-1.5 rounded-full inline-flex items-center justify-center font-bold">{appliedCount}</span>}
      </button>

      <div className="p-4">
        <Section title="Stops">
          <StopRow id="s-0" label="Non-stop" price={Number.isFinite(minStopPrice as number) ? (minStopPrice as number) : undefined} currencySymbol={currencySymbol}
            checked={filters.stops.includes("0")} onChange={() => set("stops", tog(filters.stops, "0") as any)} />
          <StopRow id="s-1" label="1 Stop" currencySymbol={currencySymbol}
            checked={filters.stops.includes("1")} onChange={() => set("stops", tog(filters.stops, "1") as any)} />
          <StopRow id="s-2" label="2+ Stops" currencySymbol={currencySymbol}
            checked={filters.stops.includes("2+")} onChange={() => set("stops", tog(filters.stops, "2+") as any)} />
        </Section>

        <Section title="Airlines" action={
          airlines.some(a => filters.airlines.includes(a.code))
            ? <button onClick={() => set("airlines", [])} className="text-[10.5px] text-primary font-semibold uppercase tracking-wider">Clear</button>
            : null
        }>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input value={airlineQuery} onChange={e => setAirlineQuery(e.target.value)} placeholder="Search airlines…"
              className="h-8 pl-7 text-[12px] rounded-lg" />
          </div>
          {visibleAirlines.map(a => (
            <label key={a.code} htmlFor={`air-${a.code}`} className="flex items-center gap-2.5 cursor-pointer group py-1">
              <Checkbox id={`air-${a.code}`} checked={filters.airlines.includes(a.code)}
                onCheckedChange={() => set("airlines", tog(filters.airlines, a.code))}
                className="h-4 w-4 rounded-[4px]" />
              <div className="h-7 w-7 rounded bg-muted/40 border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                <img src={`https://pics.avs.io/64/64/${a.code}.png`} alt={a.name}
                  className="w-5 h-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-foreground truncate group-hover:text-primary">{a.name}</div>
                <div className="text-[10.5px] text-muted-foreground">{a.count} flight{a.count > 1 ? "s" : ""} · from {currencySymbol}{a.price.toLocaleString()}</div>
              </div>
              {a.tag && (
                <span className={cn("text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded",
                  a.tag === "cheapest" ? "bg-warning/10 text-warning dark:bg-warning/50/15 dark:text-warning"
                                       : "bg-success/10 text-success dark:bg-success/50/15 dark:text-success")}>
                  {a.tag === "cheapest" ? "Cheapest" : "Best Value"}
                </span>
              )}
            </label>
          ))}
          {filteredAirlines.length > 5 && (
            <button onClick={() => setShowAllAirlines(s => !s)}
              className="text-[11.5px] text-primary font-semibold hover:underline mt-1 block">
              {showAllAirlines ? "Show Less" : `Show ${filteredAirlines.length - 5} More`}
            </button>
          )}
        </Section>

        <Section title="Price Range">
          <div className="flex items-center justify-between text-[11.5px] tabular-nums text-foreground font-semibold">
            <span>{currencySymbol}{filters.priceRange[0].toLocaleString()}</span>
            <span>—</span>
            <span>{currencySymbol}{Number.isFinite(filters.priceRange[1]) ? filters.priceRange[1].toLocaleString() : "—"}</span>
          </div>
          <Slider min={0} max={Math.max(5000, filters.priceRange[1] || 5000)} step={50} value={filters.priceRange}
            onValueChange={(v) => set("priceRange", v as [number, number])} className="mt-2" />
        </Section>

        <Section title="Fare Quality">
          <ToggleRow label="Refundable Only" checked={filters.refundableOnly} onChange={(v) => set("refundableOnly", v)} />
          <ToggleRow label="Baggage Included" checked={filters.baggageOnly} onChange={(v) => set("baggageOnly", v)} />
        </Section>

        <Button onClick={onReset} variant="outline"
          className="w-full mt-4 h-10 rounded-xl text-primary border-primary/30 hover:bg-primary/5 font-semibold text-[12.5px]">
          Reset All Filters
        </Button>
      </div>
    </div>
  );
};

export default FiltersPanel;
