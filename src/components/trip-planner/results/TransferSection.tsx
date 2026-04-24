import React from "react";
import { motion } from "framer-motion";
import { Car, Loader2 } from "lucide-react";
import type { NormalizedTransfer } from "@/components/trip-planner/transferTypes";
import TransferCard from "./TransferCard";

interface TransferSectionProps {
  transfers: NormalizedTransfer[];
  isResolving: boolean;
  formatPrice: (n: number) => string;
  totalCost: number;
}

const TransferSection: React.FC<TransferSectionProps> = ({
  transfers, isResolving, formatPrice, totalCost,
}) => {
  if (transfers.length === 0 && !isResolving) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.25 }}
      className="rounded-2xl overflow-hidden backdrop-blur-sm"
      style={{
        background: `linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--p-card)) 40%)`,
        border: `1px solid hsl(var(--primary) / 0.2)`,
        boxShadow: `0 4px 20px hsl(var(--p-shadow)), 0 0 0 1px hsl(var(--primary) / 0.06)`,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 border-b flex items-center justify-between"
        style={{
          borderColor: `hsl(var(--primary) / 0.15)`,
          background: `linear-gradient(90deg, hsl(var(--primary) / 0.08) 0%, transparent 100%)`,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Car className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: `hsl(var(--p-text))` }}>
              Transfers & Pickups
            </span>
            <p className="text-[11px]" style={{ color: `hsl(var(--p-text-subtle))` }}>
              {isResolving ? "Arranging transfers..." : `${transfers.length} arranged`}
              {totalCost > 0 && ` • ${formatPrice(totalCost)} total`}
            </p>
          </div>
        </div>
        {isResolving && <Loader2 className="w-4 h-4 animate-spin text-primary/60" />}
      </div>

      {/* Cards */}
      <div className="p-3 space-y-2.5">
        {isResolving && transfers.length === 0 && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary/50" />
            <span className="text-xs" style={{ color: `hsl(var(--p-text-subtle))` }}>
              Arranging your transfers...
            </span>
          </div>
        )}
        {transfers.map((t, i) => (
          <TransferCard key={t.id || i} transfer={t} formatPrice={formatPrice} />
        ))}
      </div>
    </motion.div>
  );
};

export default React.memo(TransferSection);
