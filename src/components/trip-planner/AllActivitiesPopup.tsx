import React, { useEffect, useRef } from "react";
import {
  Camera, Clock, Star, Sparkles, Check, MapPin, Compass, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildTourUrl } from "@/utils/tourSlug";

interface AllActivitiesPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allSearchedActivities: any[];
  searchedCities: { name: string }[];
  activitiesByCity: Record<string, any[]>;
  displayItinerary: any;
  formatDirectPrice: (n: number) => string;
  calcActivityCost: (price: number, adults: number, children: number) => number;
  ImageCarousel: React.FC<any>;
  userSelectedActivities: any[];
  setUserSelectedActivities: React.Dispatch<React.SetStateAction<any[]>>;
  dayActivityOverrides: Record<string, any>;
  setDayActivityOverrides: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  swapTarget: { dayIdx: number; actIdx: number } | null;
  setSwapTarget: (t: { dayIdx: number; actIdx: number } | null) => void;
  activitySortBy: "relevance" | "price_low" | "price_high" | "rating" | "duration";
  setActivitySortBy: (s: "relevance" | "price_low" | "price_high" | "rating" | "duration") => void;
  activitySearchQuery: string;
  setActivitySearchQuery: (q: string) => void;
  popupCityTab: string;
  setPopupCityTab: (t: string) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

const AllActivitiesPopup: React.FC<AllActivitiesPopupProps> = ({
  open, onOpenChange, allSearchedActivities, searchedCities, activitiesByCity,
  displayItinerary, formatDirectPrice, calcActivityCost, ImageCarousel,
  userSelectedActivities, setUserSelectedActivities,
  dayActivityOverrides, setDayActivityOverrides,
  swapTarget, setSwapTarget,
  activitySortBy, setActivitySortBy,
  activitySearchQuery, setActivitySearchQuery,
  popupCityTab, setPopupCityTab,
  onLoadMore, isLoadingMore,
}) => {
  // Lazy-load more activities when popup opens
  const loadTriggeredRef = useRef(false);
  useEffect(() => {
    if (open && onLoadMore && !loadTriggeredRef.current && allSearchedActivities.length > 0) {
      loadTriggeredRef.current = true;
      onLoadMore();
    }
    if (!open) loadTriggeredRef.current = false;
  }, [open, onLoadMore, allSearchedActivities.length]);

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) { setSwapTarget(null); setActivitySearchQuery(""); }
  };

  // Collect AI-injected activity keys from itinerary days
  const aiInjectedKeys = new Set<string>();
  if (displayItinerary?.days) {
    for (const day of displayItinerary.days) {
      for (const act of day.activities || []) {
        if ((act.category === "activity" || act.source === "travelvela") && (act.product_code || act.activity)) {
          aiInjectedKeys.add(act.product_code || act.activity);
        }
      }
    }
  }
  const overrideKeys = new Set(Object.values(dayActivityOverrides).map((o: any) => o.productCode || o.product_code || o.name));
  const selectedKeys = new Set(userSelectedActivities.map((ua: any) => ua.productCode || ua.product_code || ua.name));
  const allInUseKeys = new Set([...selectedKeys, ...overrideKeys, ...aiInjectedKeys]);

  // Identify the current activity being swapped
  const currentSwapActivity = swapTarget && displayItinerary?.days?.[swapTarget.dayIdx]?.activities?.[swapTarget.actIdx];
  const currentSwapName = (currentSwapActivity?.activity || currentSwapActivity?.name || "").toLowerCase();
  const currentSwapCode = currentSwapActivity?.product_code || "";

  const query = activitySearchQuery.toLowerCase().trim();
  const sortedActivities = [...allSearchedActivities]
    .filter((a: any) => {
      if (popupCityTab === "all") return true;
      const actCity = (a._searchCity || "").toLowerCase();
      const tabCity = popupCityTab.toLowerCase();
      if (swapTarget) {
        if (!actCity) return false;
        return actCity === tabCity || actCity.includes(tabCity) || tabCity.includes(actCity);
      }
      return !actCity || actCity === tabCity || actCity.includes(tabCity) || tabCity.includes(actCity);
    })
    .filter((a: any) => {
      if (!query) return true;
      const searchable = [a.name, a.category, a.description, a.duration, a._searchCity].filter(Boolean).join(" ").toLowerCase();
      return query.split(/\s+/).every((word: string) => searchable.includes(word));
    })
    .sort((a: any, b: any) => {
      const aKey = a.productCode || a.product_code || a.name;
      const bKey = b.productCode || b.product_code || b.name;

      // Pin current swap activity to top
      if (swapTarget) {
        const aIsCurrent = isCurrentSwapMatch(a);
        const bIsCurrent = isCurrentSwapMatch(b);
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
      }

      const aInUse = allInUseKeys.has(aKey) ? 1 : 0;
      const bInUse = allInUseKeys.has(bKey) ? 1 : 0;
      if (aInUse !== bInUse) return bInUse - aInUse;
      switch (activitySortBy) {
        case "price_low": return (a.price || 0) - (b.price || 0);
        case "price_high": return (b.price || 0) - (a.price || 0);
        case "rating": return (b.rating || 0) - (a.rating || 0);
        case "duration": {
          const parseDur = (d: string) => { const m = d?.match?.(/(\d+)/); return m ? parseInt(m[1]) : 999; };
          return parseDur(a.duration) - parseDur(b.duration);
        }
        default: return (b.rating || 0) - (a.rating || 0);
      }
    });

  function isCurrentSwapMatch(a: any): boolean {
    if (!swapTarget || !currentSwapActivity) return false;
    const aCode = a.productCode || a.product_code || "";
    const aName = (a.name || "").toLowerCase();
    if (currentSwapCode && aCode === currentSwapCode) return true;
    if (currentSwapName && (aName.includes(currentSwapName) || currentSwapName.includes(aName))) return true;
    return false;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="w-4 h-4 text-success" />
            {swapTarget ? `Swap Activity — Day ${(displayItinerary?.days?.[swapTarget.dayIdx]?.day) || swapTarget.dayIdx + 1}` : `All Activities & Tours (${allSearchedActivities.length})`}
          </DialogTitle>
          {swapTarget ? (
            <p className="text-xs text-muted-foreground">Pick a replacement for this activity slot</p>
          ) : (
            <p className="text-xs text-muted-foreground">Select multiple activities to add to your itinerary. Pricing updates instantly.</p>
          )}
          {/* Sort options */}
          {allSearchedActivities.length > 1 && (
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] font-medium text-muted-foreground mr-1">Sort:</span>
              {([
                { id: "relevance", label: "Relevance" },
                { id: "price_low", label: "Price ↑" },
                { id: "price_high", label: "Price ↓" },
                { id: "rating", label: "Rating" },
                { id: "duration", label: "Duration" },
              ] as const).map(opt => (
                <button key={opt.id} onClick={() => setActivitySortBy(opt.id)} className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all", activitySortBy === opt.id ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-muted/50")}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {/* City Tabs */}
          {searchedCities.length > 1 && !swapTarget && (
            <div className="flex items-center gap-1.5 pt-1">
              <button onClick={() => setPopupCityTab("all")} className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all", popupCityTab === "all" ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-muted/50")}>
                All ({allSearchedActivities.length})
              </button>
              {searchedCities.map(c => {
                const count = (activitiesByCity[c.name] || []).length;
                return (
                  <button key={c.name} onClick={() => setPopupCityTab(c.name)} className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all", popupCityTab === c.name ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-muted/50")}>
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
          {/* Search bar */}
          {(swapTarget || allSearchedActivities.length > 5) && (
            <div className="relative pt-1">
              <input type="text" value={activitySearchQuery} onChange={(e) => setActivitySearchQuery(e.target.value)} placeholder="Search activities by name, category, keyword..." className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-success/40 placeholder:text-muted-foreground/60" />
              <Compass className="absolute left-2.5 top-1/2 mt-0.5 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              {activitySearchQuery && (
                <button onClick={() => setActivitySearchQuery("")} className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {sortedActivities.map((act: any, i: number) => {
            const actKey = act.productCode || act.product_code || act.name;
            const isSelected = selectedKeys.has(actKey);
            const isOverride = overrideKeys.has(actKey);
            const isAiInjected = aiInjectedKeys.has(actKey) && !isSelected && !isOverride;
            const isInUse = allInUseKeys.has(actKey);
            const isCurrent = swapTarget ? isCurrentSwapMatch(act) : false;
            return (
              <div key={i} className={cn("p-3 rounded-xl border transition-all", isCurrent ? "border-primary bg-primary/5 ring-1 ring-primary/30" : isInUse ? "border-success bg-success/5 ring-1 ring-success/30" : "border-border hover:border-success/30 hover:bg-muted/30")}>
                <div className="flex items-center gap-3">
                  {(() => {
                    const imgs: string[] = (act.images || []).map((img: any) => typeof img === 'string' ? img : img?.url || img?.variants?.[0]?.url).filter(Boolean);
                    if (act.image && !imgs.includes(act.image)) imgs.unshift(act.image);
                    return imgs.length > 0 ? (
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                        <ImageCarousel images={imgs.slice(0, 8)} alt={act.name} className="w-full h-full" showDots={false} />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5 text-success/40" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{act.name}</p>
                      {isCurrent && <span className="text-[9px] font-bold bg-primary/15 text-primary rounded-full px-2 py-0.5 flex items-center gap-0.5">Current</span>}
                      {isAiInjected && !isCurrent && <span className="text-[9px] font-bold bg-success/15 text-success rounded-full px-2 py-0.5 flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI Picked</span>}
                      {isSelected && <span className="text-[9px] font-bold bg-success/15 text-success rounded-full px-2 py-0.5 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> Selected</span>}
                      {isOverride && !isCurrent && <span className="text-[9px] font-bold bg-primary/15 text-primary rounded-full px-2 py-0.5 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> In Itinerary</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      {act.duration && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {act.duration}</span>}
                      {act.rating > 0 && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-warning text-warning" /> {Number(act.rating).toFixed(1)} ({act.reviewCount || 0})</span>}
                      {act.cancellationPolicy === "FREE_CANCELLATION" && <span className="text-success">· Free Cancellation</span>}
                      {act.category && <span>· {act.category}</span>}
                    </div>
                    {act.highlights?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <MapPin className="w-2.5 h-2.5 text-muted-foreground/50 flex-shrink-0" />
                        {act.highlights.slice(0, 4).map((h: string, hi: number) => (
                          <span key={hi} className="text-[9px] bg-muted/60 text-muted-foreground rounded px-1.5 py-[1px]">{h}</span>
                        ))}
                      </div>
                    )}
                    {act.productOptions?.length > 1 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {act.productOptions.map((opt: any, oi: number) => {
                          const isFirst = oi === 0;
                          const optPrice = opt.fromPrice;
                          const priceDiff = optPrice && act.price ? optPrice - act.price : null;
                          return (
                            <button key={opt.productOptionCode || oi} className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-colors", isFirst ? "border-success/30 bg-success/10 text-success font-semibold" : "border-border text-muted-foreground hover:border-success/30 hover:text-foreground")} title={opt.description}>
                              {opt.description?.slice(0, 25) || `Option ${oi + 1}`}
                              {optPrice != null && !isFirst && priceDiff != null && priceDiff !== 0 && (
                                <span className={cn("ml-1 font-semibold", priceDiff > 0 ? "text-destructive" : "text-success")}>
                                  {priceDiff > 0 ? "+" : ""}{formatDirectPrice(priceDiff)}
                                </span>
                              )}
                              {isFirst && <span className="ml-1 font-semibold">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {(() => {
                    const isGroup = act.pricingType === "PER_GROUP";
                    const adl = displayItinerary?.adults || displayItinerary?.travelers || 1;
                    const chl = displayItinerary?.children || 0;
                    const inf = displayItinerary?.infants || 0;
                    const totalPax = adl + chl + inf;
                    const totalCost = isGroup ? act.price : calcActivityCost(act.price, adl, chl);
                    return (
                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <div>
                          <p className="text-base font-bold text-success">{formatDirectPrice(totalCost)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {isGroup ? "per group" : totalPax > 1 ? `${formatDirectPrice(act.price)} × ${totalPax}` : "per person"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant={isInUse ? "default" : "outline"} className={cn("h-7 text-[11px] rounded-lg px-3 font-semibold", isInUse ? "bg-success text-success-foreground hover:bg-success/90" : "border-success/30 text-success hover:bg-success/5")} onClick={() => {
                            if (swapTarget) {
                              const key = `${swapTarget.dayIdx}-${swapTarget.actIdx}`;
                              setDayActivityOverrides(prev => ({ ...prev, [key]: act }));
                              onOpenChange(false);
                              setSwapTarget(null);
                            } else if (isSelected) {
                              setUserSelectedActivities(prev => prev.filter((ua: any) => (ua.productCode || ua.product_code || ua.name) !== actKey));
                              if (isOverride) {
                                setDayActivityOverrides(prev => {
                                  const next = { ...prev };
                                  for (const [k, v] of Object.entries(next)) {
                                    if ((v as any).productCode === actKey || (v as any).product_code === actKey || (v as any).name === actKey) delete next[k];
                                  }
                                  return next;
                                });
                              }
                            } else {
                              setUserSelectedActivities(prev => [...prev, act]);
                            }
                          }}>
                            {swapTarget ? "Use This" : isInUse ? "✓ Selected" : "Select"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg px-3 font-semibold border-success/30 text-success hover:bg-success/5" onClick={(e) => {
                            e.stopPropagation();
                            if (act.productCode || act.product_code) {
                              const url = buildTourUrl({
                                title: act.name || act.title || '',
                                destination: act.destination || act._searchCity || act.city || 'experience',
                                productCode: act.productCode || act.product_code,
                                velaId: act.velaId || act.vela_id,
                                slug: act.slug,
                              });
                              window.open(url, '_blank');
                            }
                          }}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
          {allSearchedActivities.length === 0 && !isLoadingMore && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No activity results available. Try a new search.
            </div>
          )}
          {isLoadingMore && (
            <div className="text-center py-6 text-muted-foreground text-sm animate-pulse">
              Loading more activities…
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {userSelectedActivities.length > 0 && (() => {
              const adl = displayItinerary?.adults || displayItinerary?.travelers || 1;
              const chl = displayItinerary?.children || 0;
              const inf = displayItinerary?.infants || 0;
              const totalPax = adl + chl + inf;
              const totalActivityCost = userSelectedActivities.reduce((sum: number, a: any) => {
                const isGroup = a.pricingType === "PER_GROUP";
                return sum + (isGroup ? (a.price || 0) : calcActivityCost(a.price || 0, adl, chl));
              }, 0);
              return (
                <span className="font-semibold text-success">
                  {userSelectedActivities.length} selected · {formatDirectPrice(totalActivityCost)} total{totalPax > 1 ? ` (${totalPax} pax)` : ""}
                </span>
              );
            })()}
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
            <Check className="w-3.5 h-3.5" /> Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AllActivitiesPopup;
