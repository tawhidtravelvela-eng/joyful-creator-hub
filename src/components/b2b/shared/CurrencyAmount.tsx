import { cn } from "@/lib/utils";

/**
 * Display a monetary amount in the profile (operational) currency.
 * Business rule: B2B amounts MUST display in the fixed profile currency.
 * An optional secondary converted value can be shown as reference.
 */

const SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", CNY: "¥", INR: "₹",
  AED: "د.إ", MYR: "RM", SGD: "S$", THB: "฿", SAR: "﷼",
};

interface CurrencyAmountProps {
  amount: number;
  currency?: string;
  secondary?: { amount: number; currency: string };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const CurrencyAmount = ({ amount, currency = "USD", secondary, className, size = "md" }: CurrencyAmountProps) => {
  const sym = SYMBOLS[currency] || currency + " ";
  const formatted = `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const sizes = {
    sm: "text-sm",
    md: "text-base font-semibold",
    lg: "text-xl font-bold",
  };

  return (
    <div className={cn("inline-flex flex-col", className)}>
      <span className={cn(sizes[size], "text-foreground")}>{formatted}</span>
      {secondary && (
        <span className="text-[10px] text-muted-foreground">
          ≈ {SYMBOLS[secondary.currency] || secondary.currency}{secondary.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      )}
    </div>
  );
};
