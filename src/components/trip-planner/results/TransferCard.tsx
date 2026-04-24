import React from "react";
import { motion } from "framer-motion";
import {
  Car, Plane, Ship, MapPin, Clock, Shield, Users, Luggage,
  ChevronRight, RefreshCw, Check, AlertTriangle, Info, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NormalizedTransfer } from "@/components/trip-planner/transferTypes";
import { getVehicleLabel, getSourceBadge } from "@/components/trip-planner/transferTypes";

interface TransferCardProps {
  transfer: NormalizedTransfer;
  formatPrice: (n: number) => string;
  compact?: boolean;
  onViewOptions?: () => void;
  onRefreshPrice?: () => void;
}

const modeIcons: Record<string, React.ReactNode> = {
  private_car: <Car className="w-4 h-4" />,
  resort_speedboat: <Ship className="w-4 h-4" />,
  seaplane: <Plane className="w-4 h-4" />,
  domestic_flight_boat: <Plane className="w-4 h-4" />,
  shared_shuttle: <Car className="w-4 h-4" />,
};

const TransferCard: React.FC<TransferCardProps> = ({
  transfer, formatPrice, compact, onViewOptions, onRefreshPrice,
}) => {
  const { label: sourceBadgeLabel, variant: sourceBadgeVariant } = getSourceBadge(transfer.pricing_source);
  const vehicleLabel = getVehicleLabel(transfer.vehicle_class);
  const icon = modeIcons[transfer.mode] || modeIcons[transfer.vehicle_class] || <Car className="w-4 h-4" />;

  const badgeColors: Record<string, string> = {
    default: "bg-muted/30 text-muted-foreground border-muted/20",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    info: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2 rounded-xl"
        style={{
          background: `hsl(var(--p-card) / 0.6)`,
          border: `1px solid hsl(var(--primary) / 0.12)`,
        }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `hsl(var(--primary) / 0.12)` }}>
          <span className="text-primary">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: `hsl(var(--p-text))` }}>
            {transfer.title}
          </p>
          <p className="text-[10px]" style={{ color: `hsl(var(--p-text-subtle))` }}>
            {vehicleLabel} • {transfer.duration_minutes} min
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold" style={{ color: `hsl(var(--p-text))` }}>
            {formatPrice(transfer.total_price)}
          </p>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${badgeColors[sourceBadgeVariant]}`}>
            {sourceBadgeLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--p-card)) 40%)`,
        border: `1px solid hsl(var(--primary) / 0.15)`,
        boxShadow: `0 4px 20px hsl(var(--p-shadow))`,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid hsl(var(--primary) / 0.1)` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `hsl(var(--primary) / 0.12)` }}>
            <span className="text-primary">{icon}</span>
          </div>
          <div>
            <h4 className="text-sm font-bold" style={{ color: `hsl(var(--p-text))` }}>
              {transfer.title}
            </h4>
            <p className="text-[11px] flex items-center gap-1" style={{ color: `hsl(var(--p-text-subtle))` }}>
              {vehicleLabel}
              <span className="mx-0.5">•</span>
              <Clock className="w-3 h-3" />
              {transfer.duration_minutes} min
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-bold" style={{ color: `hsl(var(--p-text))` }}>
            {formatPrice(transfer.total_price)}
          </p>
          {transfer.per_person_price && (
            <p className="text-[10px]" style={{ color: `hsl(var(--p-text-subtle))` }}>
              {formatPrice(transfer.per_person_price)}/person
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Route visualization */}
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          <span className="text-xs" style={{ color: `hsl(var(--p-text))` }}>
            {transfer.pickup_name || transfer.pickup_code || "Pickup"}
          </span>
          <ChevronRight className="w-3 h-3 text-primary/40 shrink-0" />
          <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          <span className="text-xs" style={{ color: `hsl(var(--p-text))` }}>
            {transfer.dropoff_name || transfer.dropoff_code || "Drop-off"}
          </span>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeColors[sourceBadgeVariant]}`}>
            {sourceBadgeLabel}
          </span>
          {transfer.is_mandatory && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/20">
              Mandatory
            </span>
          )}
          {transfer.is_roundtrip && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-purple-500/15 text-purple-400 border-purple-500/20">
              Roundtrip
            </span>
          )}
          {transfer.tags?.includes("private") && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeColors.default}`}>
              Private
            </span>
          )}
          {transfer.tags?.includes("resort") && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeColors.info}`}>
              Resort Transfer
            </span>
          )}
        </div>

        {/* Recommendation text */}
        {transfer.reason_text && (
          <div className="flex items-start gap-1.5 pt-0.5">
            <Sparkles className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] leading-snug" style={{ color: `hsl(var(--p-text-subtle))` }}>
              {transfer.reason_text}
            </p>
          </div>
        )}

        {/* Traveler & luggage fit */}
        <div className="flex items-center gap-3 pt-0.5">
          {transfer.traveler_fit && (
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-primary/50" />
              <span className="text-[10px]" style={{ color: `hsl(var(--p-text-subtle))` }}>{transfer.traveler_fit}</span>
            </div>
          )}
          {transfer.luggage_fit && (
            <div className="flex items-center gap-1">
              <Luggage className="w-3 h-3 text-primary/50" />
              <span className="text-[10px]" style={{ color: `hsl(var(--p-text-subtle))` }}>{transfer.luggage_fit}</span>
            </div>
          )}
        </div>

        {/* Policies */}
        {transfer.policies?.meeting_point && (
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: `hsl(var(--p-text-subtle))` }}>
            <Info className="w-3 h-3 text-blue-400/70" />
            {transfer.policies.meeting_point}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: `1px solid hsl(var(--primary) / 0.08)`, background: `hsl(var(--p-card) / 0.5)` }}>
        <div className="flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-medium" style={{ color: `hsl(var(--p-text-subtle))` }}>
            Driver coordination included
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onRefreshPrice && transfer.pricing_source !== "UNIFIED_API" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={onRefreshPrice}
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          )}
          {onViewOptions && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={onViewOptions}
            >
              Options
              <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(TransferCard);
