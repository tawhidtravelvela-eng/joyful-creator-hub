import React, { useMemo, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  Hotel, Star, MapPin, Sparkles, Check, Shield, Utensils, Search,
  ArrowRight, Trophy, TrendingUp, User, Compass, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AllHotelsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allSearchedHotels: any[];
  searchedCities: { name: string }[];
  hotelsByCity: Record<string, any[]>;
  displayItinerary: any;
  formatDirectPrice: (n: number) => string;
  getNightsForCity: (city: string) => number;
  buildHotelPath: (hotel: { id: string; name: string; city: string }) => string;
  ImageCarousel: React.FC<any>;
  userSelectedHotel: any;
  setUserSelectedHotel: (h: any) => void;
  userSelectedHotelsByCity: Record<string, any>;
  setUserSelectedHotelsByCity: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  hotelSortChip: string;
  setHotelSortChip: (s: string) => void;
  hotelFilterBreakfast: boolean;
  setHotelFilterBreakfast: React.Dispatch<React.SetStateAction<boolean>>;
  hotelSearchQuery: string;
  setHotelSearchQuery: (q: string) => void;
  popupCityTab: string;
  setPopupCityTab: (t: string) => void;
  setLightboxImages: (imgs: string[]) => void;
  setLightboxIdx: (idx: number) => void;
  setLightboxOpen: (open: boolean) => void;
  aiRecommendedHotelsByCity?: Record<string, string>;
  activeHotelCity?: string | null;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

const AllHotelsPopup: React.FC<AllHotelsPopupProps> = ({
  open, onOpenChange, allSearchedHotels, searchedCities, hotelsByCity,
  displayItinerary, formatDirectPrice, getNightsForCity, buildHotelPath,
  ImageCarousel,
  userSelectedHotel, setUserSelectedHotel,
  userSelectedHotelsByCity, setUserSelectedHotelsByCity,
  hotelSortChip, setHotelSortChip, hotelFilterBreakfast, setHotelFilterBreakfast,
  hotelSearchQuery, setHotelSearchQuery, popupCityTab, setPopupCityTab,
  setLightboxImages, setLightboxIdx, setLightboxOpen,
  aiRecommendedHotelsByCity = {},
  activeHotelCity = null,
  onLoadMore,
  isLoadingMore = false,
}) => {
  // Lazy-load more hotels when popup opens
  const loadTriggeredRef = useRef(false);
  useEffect(() => {
    if (open && onLoadMore && !loadTriggeredRef.current && allSearchedHotels.length > 0) {
      loadTriggeredRef.current = true;
      onLoadMore();
    }
    if (!open) loadTriggeredRef.current = false;
  }, [open, onLoadMore, allSearchedHotels.length]);
  // Derive cities from hotelsByCity as fallback when searchedCities is empty
  const effectiveCities = useMemo(() => {
    if (searchedCities.length > 0) return searchedCities;
    const cityKeys = Object.keys(hotelsByCity).filter(k => (hotelsByCity[k] || []).length > 0);
    if (cityKeys.length > 1) return cityKeys.map(name => ({ name, days: 1 }));
    return searchedCities;
  }, [searchedCities, hotelsByCity]);

  const isMultiCity = effectiveCities.length > 1;

  // Build AI-recommended hotel names per city
  const aiRecSet = useMemo(() => {
    const s = new Map<string, string>();
    for (const [city, name] of Object.entries(aiRecommendedHotelsByCity)) {
      s.set(city.toLowerCase(), (name || "").toLowerCase());
    }
    const selHotels = displayItinerary?.selected_hotels || [];
    if (selHotels.length > 0) {
      for (const sh of selHotels) {
        const city = (sh.city || "").toLowerCase();
        if (city && !s.has(city)) s.set(city, (sh.name || "").toLowerCase());
      }
    } else if (displayItinerary?.selected_hotel) {
      const sh = displayItinerary.selected_hotel;
      const city = (sh.city || displayItinerary?.destination || "").toLowerCase();
      if (city && !s.has(city)) s.set(city, (sh.name || "").toLowerCase());
    }
    return s;
  }, [aiRecommendedHotelsByCity, displayItinerary]);

  function getHotelBadge(h: any): string | null {
    const hotelCity = (h._searchCity || h.city || "").toLowerCase();
    const hotelName = (h.name || "").toLowerCase();
    const userPick = isMultiCity ? userSelectedHotelsByCity[hotelCity] : userSelectedHotel;
    if (userPick && (userPick.name || "").toLowerCase() === hotelName) {
      const aiRecName = aiRecSet.get(hotelCity) || "";
      return aiRecName === hotelName ? "ai_recommended" : "user_selected";
    }
    const aiRecName = aiRecSet.get(hotelCity) || "";
    if (aiRecName && aiRecName === hotelName) return "ai_recommended";
    return null;
  }

  function isHotelSelected(h: any): boolean {
    const hotelCity = (h._searchCity || h.city || "").toLowerCase();
    if (isMultiCity) {
      const pick = userSelectedHotelsByCity[hotelCity];
      return pick ? (pick.name === h.name && pick.pricePerNight === h.pricePerNight) : false;
    }
    return userSelectedHotel ? (userSelectedHotel.name === h.name && userSelectedHotel.pricePerNight === h.pricePerNight) : false;
  }

  function isAiDefault(h: any): boolean {
    const hotelCity = (h._searchCity || h.city || "").toLowerCase();
    const aiRecName = aiRecSet.get(hotelCity) || "";
    return aiRecName === (h.name || "").toLowerCase();
  }

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) setHotelSearchQuery("");
  };

  // Static seed: well-known sub-areas (extended automatically by hotel search results)
  const SEED_SUB_AREAS: Record<string, string[]> = {
    penang: ["george town", "georgetown", "batu ferringhi", "batu feringghi", "batu ferringi", "tanjung bungah", "gurney", "jelutong", "pulau pinang"],
    "kuala lumpur": ["kl", "klcc", "bukit bintang", "bangsar", "mont kiara", "cheras", "petaling jaya", "pj", "subang", "putrajaya", "cyberjaya", "genting", "sentul"],
    singapore: ["sentosa", "marina bay", "orchard", "chinatown", "little india", "bugis", "jurong", "changi", "harbourfront", "clarke quay"],
    langkawi: ["cenang", "pantai cenang", "kuah", "datai", "tanjung rhu"],
    bangkok: ["sukhumvit", "silom", "siam", "khao san", "pratunam", "sathorn", "riverside", "thonglor"],
    bali: ["ubud", "seminyak", "kuta", "nusa dua", "canggu", "sanur", "jimbaran", "uluwatu", "denpasar"],
    phuket: ["patong", "kata", "karon", "kamala", "rawai", "surin", "bang tao"],
    dubai: ["downtown dubai", "deira", "jumeirah", "marina", "palm jumeirah", "bur dubai", "jbr"],
    istanbul: ["sultanahmet", "taksim", "beyoglu", "kadikoy", "besiktas", "fatih"],
    delhi: ["new delhi", "connaught place", "karol bagh", "paharganj", "dwarka", "aerocity"],
  };

  // Auto-extend sub-area mapping from actual hotel search results
  // Hotels have _searchCity (what we searched) and city (what the hotel reports).
  // When these differ, we learn a new sub-area mapping automatically.
  const CITY_SUB_AREAS: Record<string, string[]> = useMemo(() => {
    const merged: Record<string, Set<string>> = {};
    // Seed
    for (const [parent, subs] of Object.entries(SEED_SUB_AREAS)) {
      merged[parent] = new Set(subs);
    }
    // Learn from hotel data
    for (const h of allSearchedHotels) {
      const searchCity = (h._searchCity || "").toLowerCase().trim();
      const hotelCity = (h.city || "").toLowerCase().trim();
      if (!searchCity || !hotelCity || searchCity === hotelCity) continue;
      // Skip if hotelCity is already a substring match of searchCity
      if (hotelCity.includes(searchCity) || searchCity.includes(hotelCity)) continue;
      // Add hotelCity as a sub-area of searchCity
      if (!merged[searchCity]) merged[searchCity] = new Set();
      merged[searchCity].add(hotelCity);
    }
    // Convert to plain object
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(merged)) {
      result[k] = Array.from(v);
    }
    return result;
  }, [allSearchedHotels]);

  // Fuzzy city match helper — uses auto-extended sub-area mapping
  const matchesCity = useCallback((hotelCity: string, tabCity: string): boolean => {
    const hc = hotelCity.toLowerCase().trim();
    const tc = tabCity.toLowerCase().trim();
    if (hc === tc) return true;
    if (hc.includes(tc) || tc.includes(hc)) return true;

    // Check if hotelCity is a known sub-area of tabCity
    for (const [parent, subs] of Object.entries(CITY_SUB_AREAS)) {
      const parentMatch = tc === parent || tc.includes(parent) || parent.includes(tc);
      if (parentMatch && subs.some(s => hc === s || hc.includes(s) || s.includes(hc))) return true;
    }

    // Reverse: check if tabCity is a sub-area of hotelCity's parent
    for (const [parent, subs] of Object.entries(CITY_SUB_AREAS)) {
      if (subs.some(s => hc === s || hc.includes(s) || s.includes(hc))) {
        if (tc === parent || tc.includes(parent) || parent.includes(tc)) return true;
      }
    }

    return false;
  }, [CITY_SUB_AREAS]);

  // Count hotels per city using fuzzy matching
  const hotelCountsByCity = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of effectiveCities) {
      counts[c.name] = allSearchedHotels.filter(h => {
        const hc = (h._searchCity || h.city || "").toLowerCase();
        return matchesCity(hc, c.name);
      }).length;
    }
    return counts;
  }, [allSearchedHotels, effectiveCities, matchesCity]);

  const sortedHotels = useMemo(() => {
    let filtered = [...allSearchedHotels].filter((h: any) => {
      if (popupCityTab !== "all") {
        const hotelCity = (h._searchCity || h.city || "").toLowerCase();
        if (hotelCity && !matchesCity(hotelCity, popupCityTab)) return false;
      }
      if (hotelSearchQuery.trim() && !h.name?.toLowerCase().includes(hotelSearchQuery.trim().toLowerCase())) return false;
      if (!hotelFilterBreakfast) return true;
      const mb = h.mealBasis || "";
      return /breakfast|bb|b&b|half.?board|full.?board|all.?inclusive|continental|buffet/i.test(mb);
    });

    const sortKey = hotelSortChip || "price";
    filtered.sort((a: any, b: any) => {
      if (sortKey === "price") return (a.pricePerNight || 0) - (b.pricePerNight || 0);
      if (sortKey === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortKey === "stars") return (b.stars || 0) - (a.stars || 0);
      const valA = ((a.rating || 5) * (a.stars || 3)) / Math.max(a.pricePerNight || 1, 1);
      const valB = ((b.rating || 5) * (b.stars || 3)) / Math.max(b.pricePerNight || 1, 1);
      return valB - valA;
    });

    // Pin: selected → AI recommended → rest
    const pinned: any[] = [];
    const aiPinned: any[] = [];
    const rest: any[] = [];
    for (const h of filtered) {
      if (isHotelSelected(h)) pinned.push(h);
      else if (isAiDefault(h)) aiPinned.push(h);
      else rest.push(h);
    }
    return [...pinned, ...aiPinned, ...rest];
  }, [allSearchedHotels, popupCityTab, hotelSearchQuery, hotelFilterBreakfast, hotelSortChip, userSelectedHotel, userSelectedHotelsByCity, aiRecSet, matchesCity]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Hotel className="w-4 h-4 text-accent" />
            Available Hotels ({allSearchedHotels.length})
            {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {effectiveCities.length > 1
              ? effectiveCities.map(c => c.name).join(', ')
              : displayItinerary?.destination || 'your destination'}
            {activeHotelCity && <span className="ml-2 text-accent font-semibold">· Changing hotel for {popupCityTab !== "all" ? popupCityTab : activeHotelCity}</span>}
          </p>

          {/* Sort chips */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] font-medium text-muted-foreground mr-1">Sort:</span>
            {([
              { id: "value", label: "Best Value" },
              { id: "price", label: "Lowest Price" },
              { id: "rating", label: "Highest Rated" },
              { id: "stars", label: "Most Stars" },
            ] as const).map(chip => (
              <button key={chip.id} onClick={() => setHotelSortChip(chip.id)} className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all", (hotelSortChip || "price") === chip.id ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted/50")}>
                {chip.label}
              </button>
            ))}
            <button onClick={() => setHotelFilterBreakfast(prev => !prev)} className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all flex items-center gap-1", hotelFilterBreakfast ? "bg-success/15 text-success" : "text-muted-foreground hover:bg-muted/50")}>
              <Utensils className="w-2.5 h-2.5" /> Breakfast
            </button>
          </div>

          {/* City tabs */}
          {effectiveCities.length > 1 && (
            <div className="flex items-center gap-1.5 pt-1">
              <button onClick={() => setPopupCityTab("all")} className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all", popupCityTab === "all" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted/50")}>
                All ({allSearchedHotels.length})
              </button>
              {effectiveCities.map(c => {
                const count = hotelCountsByCity[c.name] || 0;
                return (
                  <button key={c.name} onClick={() => setPopupCityTab(c.name)} className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 transition-all", popupCityTab === c.name ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted/50")}>
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="relative pt-1">
            <input type="text" value={hotelSearchQuery} onChange={(e) => setHotelSearchQuery(e.target.value)} placeholder="Search by hotel name..." className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-accent/40 placeholder:text-muted-foreground/60" />
            <Compass className="absolute left-2.5 top-1/2 mt-0.5 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            {hotelSearchQuery && (
              <button onClick={() => setHotelSearchQuery("")} className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Hotel list — card-based like activity popup */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {sortedHotels.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No hotel results available
            </div>
          ) : (
            sortedHotels.map((h: any, i: number) => {
              const isSelected = isHotelSelected(h);
              const badge = getHotelBadge(h);
              const nights = h._nights || getNightsForCity(h._searchCity || popupCityTab) || displayItinerary?.selected_hotel?.nights || 1;
              const totalPrice = Math.round((h.pricePerNight || 0) * nights);
              const mealLabel = h.mealBasis && h.mealBasis !== "Room Only" ? h.mealBasis : "Room Only";
              const isBreakfast = /breakfast|bb|b&b|half.?board|full.?board|all.?inclusive/i.test(mealLabel);
              const amenities = (h.amenities || []).slice(0, 3);

              const handleSelect = () => {
                const hotelCity = (h._searchCity || h.city || "").toLowerCase();
                if (isMultiCity) {
                  setUserSelectedHotelsByCity(prev => {
                    const updated = { ...prev };
                    if (isSelected) delete updated[hotelCity]; else updated[hotelCity] = h;
                    return updated;
                  });
                } else {
                  setUserSelectedHotel(isSelected ? null : h);
                }
                if (!isSelected && !isMultiCity) onOpenChange(false);
              };

              return (
                <div key={`hotel-${i}`} className={cn("p-3 rounded-xl border transition-all cursor-pointer", isSelected ? "border-accent bg-accent/5 ring-1 ring-accent/30" : badge === "ai_recommended" ? "border-accent/30 bg-accent/[0.03]" : "border-border hover:border-accent/30 hover:bg-muted/30")} onClick={handleSelect}>
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    {(() => {
                      const imgs: string[] = (h.images || []).map((img: any) => typeof img === 'string' ? img : img?.url).filter(Boolean);
                      if (h.image && !imgs.includes(h.image)) imgs.unshift(h.image);
                      return imgs.length > 0 ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                          <ImageCarousel images={imgs.slice(0, 8)} alt={h.name} className="w-full h-full" showDots={false} />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                          <Hotel className="w-6 h-6 text-accent/40" />
                        </div>
                      );
                    })()}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{h.name}</p>
                        {isSelected && <span className="text-[9px] font-bold bg-accent/15 text-accent rounded-full px-2 py-0.5 flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> Selected</span>}
                        {badge === "ai_recommended" && !isSelected && <span className="text-[9px] font-bold bg-accent/15 text-accent rounded-full px-2 py-0.5 flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI Pick</span>}
                        {badge === "user_selected" && <span className="text-[9px] font-bold bg-primary/15 text-primary rounded-full px-2 py-0.5 flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> Your Pick</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {(h.stars || 0) > 0 && (
                          <span className="flex items-center gap-0.5">
                            {Array.from({ length: Math.min(h.stars, 5) }).map((_, s) => (
                              <Star key={s} className="w-2.5 h-2.5 fill-warning text-warning" />
                            ))}
                          </span>
                        )}
                        {h.rating > 0 && <span>★ {typeof h.rating === 'number' ? h.rating.toFixed(1) : h.rating}</span>}
                        {h.city && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {h.city}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={cn("text-[10px] font-medium rounded px-1.5 py-[1px]", isBreakfast ? "bg-success/10 text-success" : "bg-muted/60 text-muted-foreground")}>
                          {mealLabel}
                        </span>
                        {h.isRefundable && (
                          <span className="text-[10px] font-medium rounded px-1.5 py-[1px] bg-blue-500/10 text-blue-500 flex items-center gap-0.5">
                            <Shield className="w-2 h-2" /> Refundable
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{nights}n</span>
                        {amenities.slice(0, 2).map((a: string, ai: number) => (
                          <span key={ai} className="text-[10px] bg-muted/60 text-muted-foreground rounded px-1.5 py-[1px]">
                            {typeof a === 'string' ? a : (a as any)?.name || ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Price + actions */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <div>
                        <p className="text-base font-bold text-accent">{formatDirectPrice(h.pricePerNight)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {nights > 1 ? `${formatDirectPrice(totalPrice)} · ${nights}n` : "/night"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant={isSelected ? "default" : "outline"} className={cn("h-7 text-[11px] rounded-lg px-3 font-semibold", isSelected ? "bg-accent text-accent-foreground hover:bg-accent/90" : "border-accent/30 text-accent hover:bg-accent/5")} onClick={(e) => { e.stopPropagation(); handleSelect(); }}>
                          {isSelected ? "✓ Selected" : "Select"}
                        </Button>
                        {h.id && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg px-3 font-semibold border-accent/30 text-accent hover:bg-accent/5" onClick={(e) => { e.stopPropagation(); window.open(buildHotelPath({ id: h.id, name: h.name, city: h.city || displayItinerary?.destination || '' }), '_blank'); }}>
                            Details
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isMultiCity
              ? <span className="font-semibold text-accent">{Object.keys(userSelectedHotelsByCity).length} of {effectiveCities.length} cities selected</span>
              : userSelectedHotel
                ? <span className="font-semibold text-accent">{userSelectedHotel.name}</span>
                : "No hotel selected"
            }
          </p>
          <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); setHotelSearchQuery(""); }} className="gap-1.5">
            <Check className="w-3.5 h-3.5" /> Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AllHotelsPopup;
