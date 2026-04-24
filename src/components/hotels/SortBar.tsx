import { ArrowDownUp, Star, DollarSign, MapPin, Sparkles, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption = "recommended" | "price" | "rating" | "distance" | "deals";

interface SortBarProps {
  sortBy: SortOption;
  onChange: (sort: SortOption) => void;
  resultCount: number;
  cityName?: string;
}

const SORT_OPTIONS: { id: SortOption; label: string; icon: typeof Star }[] = [
  { id: "recommended", label: "Recommended", icon: Sparkles },
  { id: "price", label: "Price", icon: DollarSign },
  { id: "rating", label: "Rating", icon: Star },
  { id: "deals", label: "Deals", icon: Flame },
];

const SortBar = ({ sortBy, onChange, resultCount, cityName }: SortBarProps) => {
  return (
    <div className="sticky top-[64px] z-30 bg-background/95 backdrop-blur-md border-b border-border/30 -mx-4 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-bold text-foreground whitespace-nowrap">
            {resultCount} hotel{resultCount !== 1 ? "s" : ""}
          </p>
          {cityName && (
            <p className="text-sm text-muted-foreground hidden sm:block truncate">
              in <span className="font-medium text-foreground capitalize">{cityName}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = sortBy === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SortBar;
