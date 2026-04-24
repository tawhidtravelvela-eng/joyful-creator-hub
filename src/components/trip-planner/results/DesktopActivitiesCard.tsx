import React from "react";
import { motion } from "framer-motion";
import {
  Camera, Star, Clock, Sparkles, Zap, MapPin, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DesktopActivitiesCardProps {
  liveActivities: any[];
  allSearchedActivities: any[];
  userSelectedActivities: any[];
  displayItinerary: any;
  formatPrice: (n: number) => string;
  calcActivityCost: (price: number, adults: number, children: number) => number;
  ImageCarousel: React.FC<any>;
  onShowAllActivities: () => void;
  totalProductsByCity?: Record<string, number>;
}

const DesktopActivitiesCard: React.FC<DesktopActivitiesCardProps> = ({
  liveActivities, allSearchedActivities, userSelectedActivities,
  displayItinerary, formatPrice, calcActivityCost, ImageCarousel,
  onShowAllActivities, totalProductsByCity,
}) => {
  if (!liveActivities || liveActivities.length === 0) return null;

  const adults = displayItinerary.adults || displayItinerary.travelers || 1;
  const children = displayItinerary.children || 0;
  const infants = displayItinerary.infants || 0;
  const totalInventory = totalProductsByCity ? Object.values(totalProductsByCity).reduce((s, n) => s + n, 0) : 0;
  const cityCount = totalProductsByCity ? Object.keys(totalProductsByCity).length : 0;

  // Only show activities that are actually used in the itinerary days
  const itineraryActivityKeys = new Set<string>();
  if (displayItinerary?.days) {
    for (const day of displayItinerary.days) {
      for (const act of day.activities || []) {
        if (act.product_code) itineraryActivityKeys.add(act.product_code);
        else if (act.activity) itineraryActivityKeys.add(act.activity);
      }
    }
  }
  // Also include user-selected activities
  for (const ua of userSelectedActivities) {
    const key = ua.productCode || ua.product_code || ua.name;
    if (key) itineraryActivityKeys.add(key);
  }

  const visibleActivities = itineraryActivityKeys.size > 0
    ? liveActivities.filter((act: any) => {
        const actKey = act.product_code || act.name;
        return itineraryActivityKeys.has(actKey);
      })
    : liveActivities;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.25 }}
      className="rounded-2xl overflow-hidden backdrop-blur-sm cursor-default"
      style={{
        background: `linear-gradient(145deg, hsl(var(--success) / 0.06) 0%, hsl(var(--p-card)) 40%)`,
        border: `1px solid hsl(var(--success) / 0.2)`,
        boxShadow: `0 4px 20px hsl(var(--p-shadow)), 0 0 0 1px hsl(var(--success) / 0.06)`,
      }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: `hsl(var(--success) / 0.15)`, background: `linear-gradient(90deg, hsl(var(--success) / 0.08) 0%, transparent 100%)` }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center">
            <Camera className="w-3.5 h-3.5 text-success" />
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: `hsl(var(--p-text))` }}>Activities & Tours</span>
            <p className="text-[11px]" style={{ color: `hsl(var(--p-text-subtle))` }}>
               {totalInventory > 0
                 ? `Analysed from ${totalInventory.toLocaleString()} activities${cityCount > 1 ? ` across ${cityCount} cities` : ''}`
                 : userSelectedActivities.length > 0 ? `${userSelectedActivities.length} selected experiences` : `${visibleActivities.length} bookable experiences`}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-success bg-success/10 rounded-full px-2.5 py-0.5 flex items-center gap-0.5">
          <Zap className="w-2.5 h-2.5" /> Live Prices
        </span>
      </div>

      {/* Activity rows — show all itinerary-matched activities */}
      <div className="divide-y" style={{ borderColor: `hsl(var(--p-border))` }}>
        {visibleActivities.map((act, i) => {
          const actKey = act.product_code || act.name;
          const isUserPick = userSelectedActivities.some((ua: any) => (ua.productCode || ua.product_code || ua.name) === actKey);
          const searchedMatch = allSearchedActivities.find((sa: any) => (sa.productCode || sa.product_code || sa.name) === actKey);
          const imgs: string[] = ((searchedMatch?.images || (act as any).images || []) as any[]).map((img: any) => typeof img === 'string' ? img : img?.url || img?.variants?.[0]?.url).filter(Boolean);
          if (act.image && !imgs.includes(act.image)) imgs.unshift(act.image);
          const highlights = (searchedMatch?.highlights || (act as any).highlights || []).filter(Boolean).slice(0, 3);
          const isGroup = (act as any).pricingType === "PER_GROUP" || searchedMatch?.pricingType === "PER_GROUP";
          const totalPax = adults + children + infants;
          const totalCost = isGroup ? act.price : calcActivityCost(act.price, adults, children);

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-success/[0.03] group"
            >
              {imgs.length > 0 ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                  <ImageCarousel images={imgs.slice(0, 6)} alt={act.name} className="w-full h-full" showDots={false} />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-success/30" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: `hsl(var(--p-text))` }}>{act.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {act.duration && (
                    <span className="text-[11px] flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-subtle))` }}>
                      <Clock className="w-3 h-3" /> {act.duration}
                    </span>
                  )}
                  {act.rating > 0 && (
                    <span className="text-[11px] flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-subtle))` }}>
                      <Star className="w-3 h-3 fill-warning text-warning" /> {Number(act.rating).toFixed(1)} ({act.review_count})
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-accent bg-accent/10 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> {isUserPick ? "Selected" : "AI Picked"}
                  </span>
                </div>
                {highlights.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <MapPin className="w-2.5 h-2.5 flex-shrink-0" style={{ color: `hsl(var(--p-text-muted))` }} />
                    {highlights.map((h: string, hi: number) => (
                      <span key={hi} className="text-[9px] rounded px-1.5 py-[1px]" style={{ background: `hsl(var(--p-text-muted) / 0.1)`, color: `hsl(var(--p-text-subtle))` }}>{h}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-success">{formatPrice(totalCost)}</p>
                <p className="text-[11px]" style={{ color: `hsl(var(--p-text-subtle))` }}>
                  {isGroup ? "per group" : totalPax > 1 ? `${formatPrice(act.price)} × ${totalPax}` : "per person"}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Show All */}
      {allSearchedActivities.length > 0 && (
        <div className="px-4 py-2.5 border-t" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--p-card))` }}>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-sm font-semibold gap-1.5 rounded-lg border-success/20 text-success hover:bg-success/5"
            onClick={onShowAllActivities}
          >
            <Camera className="w-3.5 h-3.5" />
            Show All {allSearchedActivities.length} Activities
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default React.memo(DesktopActivitiesCard);
