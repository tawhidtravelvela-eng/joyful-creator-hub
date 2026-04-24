import React, { useState, useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ProductOption {
  productOptionCode: string;
  title?: string;
  description?: string;
  fromPrice?: number;
}

interface OptionPickerBadgeProps {
  /** Current option title displayed on badge */
  optionTitle: string;
  /** Current option code */
  optionCode?: string;
  /** All available options from the matched product */
  productOptions: ProductOption[];
  /** Base product price for diff calculation */
  basePrice?: number;
  /** Currency formatter */
  formatPrice: (n: number) => string;
  /** Called when user picks a different option */
  onOptionChange: (option: ProductOption) => void;
}

const OptionPickerBadge: React.FC<OptionPickerBadgeProps> = ({
  optionTitle,
  optionCode,
  productOptions,
  basePrice,
  formatPrice,
  onOptionChange,
}) => {
  const [open, setOpen] = useState(false);
  const hasMultiple = productOptions.length > 1;
  const truncated = optionTitle.length > 35 ? optionTitle.slice(0, 33) + "…" : optionTitle;

  const currentCode = optionCode || productOptions.find(
    o => (o.title || o.description || "").toLowerCase() === optionTitle.toLowerCase()
  )?.productOptionCode;

  if (!hasMultiple) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
        style={{ background: `hsl(var(--primary) / 0.1)`, color: `hsl(var(--primary))` }}
      >
        🎫 {truncated}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={e => { e.stopPropagation(); e.preventDefault(); }}
          className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
          style={{ background: `hsl(var(--primary) / 0.1)`, color: `hsl(var(--primary))` }}
        >
          🎫 {truncated}
          <ChevronDown className="w-2.5 h-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-1.5 z-[100]"
        align="start"
        side="bottom"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold text-muted-foreground px-2 py-1">Select Option</p>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {productOptions.map((opt) => {
            const isActive = opt.productOptionCode === currentCode;
            const label = opt.title || opt.description || opt.productOptionCode;
            const optPrice = opt.fromPrice;
            const priceDiff = optPrice != null && basePrice != null ? optPrice - basePrice : null;

            return (
              <button
                key={opt.productOptionCode}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isActive) onOptionChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-[10px] transition-colors flex items-center gap-2",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/60 text-foreground"
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{label}</span>
                  {optPrice != null && (
                    <span className="text-[9px] text-muted-foreground">
                      {formatPrice(optPrice)}
                      {priceDiff != null && priceDiff !== 0 && (
                        <span className={cn("ml-1", priceDiff > 0 ? "text-destructive" : "text-success")}>
                          ({priceDiff > 0 ? "+" : ""}{formatPrice(Math.abs(priceDiff))})
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {isActive && <Check className="w-3 h-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default OptionPickerBadge;
