import { SlidersHorizontal, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const PRICE_RANGES = [
  { label: "Under $50", min: 0, max: 50 },
  { label: "$50 - $100", min: 50, max: 100 },
  { label: "$100 - $200", min: 100, max: 200 },
  { label: "$200 - $500", min: 200, max: 500 },
  { label: "$500+", min: 500, max: Infinity },
];

const STAR_OPTIONS = [5, 4, 3, 2, 1];

interface HotelFiltersProps {
  nameFilter: string;
  onNameFilterChange: (v: string) => void;
  selectedPriceRanges: number[];
  onTogglePriceRange: (idx: number) => void;
  selectedStars: number[];
  onToggleStar: (s: number) => void;
  selectedPropertyTypes: string[];
  onTogglePropertyType: (t: string) => void;
  availablePropertyTypes: string[];
  selectedLocations: string[];
  onToggleLocation: (l: string) => void;
  availableLocations: string[];
  activeFilterCount: number;
  onClearFilters: () => void;
}

const HotelFilters = ({
  nameFilter, onNameFilterChange,
  selectedPriceRanges, onTogglePriceRange,
  selectedStars, onToggleStar,
  selectedPropertyTypes, onTogglePropertyType, availablePropertyTypes,
  selectedLocations, onToggleLocation, availableLocations,
  activeFilterCount, onClearFilters,
}: HotelFiltersProps) => {
  return (
    <div className="bg-card rounded-2xl sticky top-[120px] overflow-hidden border border-border/30 max-h-[calc(100vh-8rem)] overflow-y-auto" style={{ boxShadow: "var(--card-shadow)" }}>
      <div className="px-5 py-4 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-foreground text-sm">Filters</h3>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={onClearFilters} className="text-[11px] font-bold text-accent hover:text-accent/80 transition-colors uppercase tracking-wider flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Search by name */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hotel name</p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={nameFilter}
              onChange={(e) => onNameFilterChange(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl bg-background/50"
            />
          </div>
        </div>

        {/* Star Category */}
        <div className="space-y-3 pt-2 border-t border-border/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Star Rating</p>
          <div className="space-y-2">
            {STAR_OPTIONS.map(s => (
              <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                <Checkbox
                  checked={selectedStars.includes(s)}
                  onCheckedChange={() => onToggleStar(s)}
                  className="w-4 h-4 rounded"
                />
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: s }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />
                  ))}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="space-y-3 pt-2 border-t border-border/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price per night</p>
          <div className="space-y-2">
            {PRICE_RANGES.map((range, idx) => (
              <label key={idx} className="flex items-center gap-2.5 cursor-pointer group">
                <Checkbox
                  checked={selectedPriceRanges.includes(idx)}
                  onCheckedChange={() => onTogglePriceRange(idx)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{range.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Property Type */}
        {availablePropertyTypes.length > 1 && (
          <div className="space-y-3 pt-2 border-t border-border/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property Type</p>
            <div className="space-y-2">
              {availablePropertyTypes.map(t => (
                <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={selectedPropertyTypes.includes(t)}
                    onCheckedChange={() => onTogglePropertyType(t)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors capitalize">{t.toLowerCase()}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Locations */}
        {availableLocations.length > 1 && (
          <div className="space-y-3 pt-2 border-t border-border/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Area</p>
            <div className="space-y-2">
              {availableLocations.slice(0, 8).map(loc => (
                <label key={loc} className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={selectedLocations.includes(loc)}
                    onCheckedChange={() => onToggleLocation(loc)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{loc}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { PRICE_RANGES };
export default HotelFilters;
