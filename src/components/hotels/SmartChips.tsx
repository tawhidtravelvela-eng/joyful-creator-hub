import { Sparkles, Shield, Coffee, MapPin, Crown, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartChipsProps {
  activeChip: string | null;
  onChipClick: (chip: string | null) => void;
}

const CHIPS = [
  { id: "best-value", label: "Best Value", icon: Tag },
  { id: "free-cancel", label: "Free Cancellation", icon: Shield },
  { id: "breakfast", label: "Breakfast Included", icon: Coffee },
  { id: "near-center", label: "Near Center", icon: MapPin },
  { id: "luxury", label: "Luxury", icon: Crown },
] as const;

const SmartChips = ({ activeChip, onChipClick }: SmartChipsProps) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
      <div className="flex items-center gap-1 text-muted-foreground mr-1">
        <Sparkles className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold whitespace-nowrap">Quick filters:</span>
      </div>
      {CHIPS.map((chip) => {
        const Icon = chip.icon;
        const isActive = activeChip === chip.id;
        return (
          <button
            key={chip.id}
            onClick={() => onChipClick(isActive ? null : chip.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 border",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                : "bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="w-3 h-3" />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
};

export default SmartChips;
