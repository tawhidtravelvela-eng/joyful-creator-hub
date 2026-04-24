import React from "react";
import { motion } from "framer-motion";
import {
  Hotel, Star, Sparkles, ChevronRight, Search, Trophy, MapPin, TrendingUp, User, ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HotelEntry {
  name: string;
  city?: string;
  stars: number;
  price_per_night: number;
  nights: number;
  total_price: number;
  room_type?: string;
  meal_basis?: string;
  is_live_price?: boolean;
  _searchCity?: string;
  _placeholder?: boolean;
  _badges?: string[];
}

interface DesktopHotelsCardProps {
  displayItinerary: any;
  allSearchedHotels: any[];
  searchedCities: { name: string; days: number }[];
  userSelectedHotel: any;
  userSelectedHotelsByCity: Record<string, any>;
  formatPrice: (n: number) => string;
  findHotelImage: (name: string, allHotels: any[], roomType?: string) => string;
  resolvedHotelImage: string;
  ImageCarousel: React.FC<any>;
  onOpenHotelPopup: (city: string) => void;
  onShowAllHotels: () => void;
  aiRecommendedHotelsByCity?: Record<string, string>;
  activeHotelCity?: string | null;
}

const BADGE_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  ai_recommended: { label: "AI Recommended", icon: Sparkles, className: "text-accent bg-accent/10" },
  best_value:     { label: "Best Value",     icon: Trophy,   className: "text-success bg-success/10" },
  closest_match:  { label: "Closest Match",  icon: MapPin,   className: "text-blue-500 bg-blue-500/10" },
  popular_choice: { label: "Popular Choice", icon: TrendingUp, className: "text-warning bg-warning/10" },
  user_selected:  { label: "Your Pick",      icon: User,     className: "text-primary bg-primary/10" },
};

function HotelBadge({ type }: { type: string }) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`text-[8px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5 flex-shrink-0 ${config.className}`}>
      <Icon className="w-2 h-2" /> {config.label}
    </span>
  );
}

const DesktopHotelsCard: React.FC<DesktopHotelsCardProps> = ({
  displayItinerary, allSearchedHotels, searchedCities,
  userSelectedHotel, userSelectedHotelsByCity,
  formatPrice, findHotelImage, resolvedHotelImage, ImageCarousel,
  onOpenHotelPopup, onShowAllHotels,
  aiRecommendedHotelsByCity = {},
  activeHotelCity = null,
}) => {
  const hasHotels = displayItinerary.selected_hotel || (displayItinerary.hotel_alternatives && displayItinerary.hotel_alternatives.length > 0);
  if (!hasHotels) return null;

  // Build hotel list for all cities
  const selectedList: HotelEntry[] = displayItinerary.selected_hotels?.length
    ? displayItinerary.selected_hotels
    : displayItinerary.selected_hotel
      ? [{ ...displayItinerary.selected_hotel, city: displayItinerary.destination }]
      : [];

  const hotelsToShow: HotelEntry[] = [];
  if (searchedCities.length > 1) {
    for (const sc of searchedCities) {
      const existing = selectedList.find((h: any) => h.city?.toLowerCase() === sc.name.toLowerCase());
      if (existing) {
        hotelsToShow.push(existing);
      } else {
        hotelsToShow.push({
          city: sc.name, _placeholder: true, name: `Browse hotels in ${sc.name}`,
          stars: 0, price_per_night: 0, nights: sc.days, meal_basis: '', room_type: '', total_price: 0,
        } as any);
      }
    }
  } else {
    hotelsToShow.push(...selectedList);
  }

  const isMulti = hotelsToShow.length > 1;

  // Determine badge for each hotel
  function getHotelBadge(sh: HotelEntry): string {
    const city = (sh.city || "").toLowerCase();
    const hotelName = (sh.name || "").toLowerCase();
    const isUserPick = userSelectedHotelsByCity[city] || userSelectedHotel;
    const userPickName = (isUserPick?.name || "").toLowerCase();
    const aiRecName = (aiRecommendedHotelsByCity[city] || "").toLowerCase();

    if (userPickName && userPickName === hotelName && aiRecName !== hotelName) return "user_selected";
    if (sh._badges?.includes("ai_recommended")) return "ai_recommended";
    if (sh._badges?.includes("best_value")) return "best_value";
    if (aiRecName === hotelName) return "ai_recommended";
    return "ai_recommended"; // default for selected hotel
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, boxShadow: `0 12px 40px hsl(var(--accent) / 0.15)` }}
      transition={{ delay: 0.35, duration: 0.25 }}
      className="rounded-2xl overflow-hidden backdrop-blur-sm cursor-default"
      style={{
        background: `linear-gradient(145deg, hsl(var(--accent) / 0.06) 0%, hsl(var(--p-card)) 40%, hsl(var(--p-card)) 100%)`,
        border: `1px solid hsl(var(--accent) / 0.2)`,
        boxShadow: `0 4px 20px hsl(var(--p-shadow)), 0 0 0 1px hsl(var(--accent) / 0.06)`,
      }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: `hsl(var(--accent) / 0.15)`, background: `linear-gradient(90deg, hsl(var(--accent) / 0.1) 0%, transparent 100%)` }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
            <Hotel className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-sm font-bold" style={{ color: `hsl(var(--p-text))` }}>Hotels</span>
        </div>
        {activeHotelCity && (
          <span className="text-[9px] font-semibold rounded-full px-2 py-0.5" style={{ color: `hsl(var(--accent))`, background: `hsl(var(--accent) / 0.1)` }}>
            Changing hotel for {activeHotelCity}
          </span>
        )}
      </div>

      {/* Hotel rows */}
      <div className="divide-y" style={{ borderColor: `hsl(var(--p-border))` }}>
        {hotelsToShow.map((sh, hIdx) => {
          const isPlaceholder = !!(sh as any)._placeholder;
          const hotelCity = (sh.city || "").toLowerCase();

          // If activeHotelCity is set and this hotel is NOT for that city, collapse it
          if (activeHotelCity && hotelCity !== activeHotelCity.toLowerCase() && !isPlaceholder) {
            return (
              <div key={`hotel-collapsed-${hIdx}`} className="flex items-center gap-2 px-3 py-1.5 opacity-50">
                <Hotel className="w-3 h-3 text-accent/30" />
                <span className="text-[9px] font-medium truncate" style={{ color: `hsl(var(--p-text-muted))` }}>{sh.city} — {sh.name}</span>
              </div>
            );
          }

          if (isPlaceholder) {
            return (
              <div
                key={`hotel-placeholder-${hIdx}`}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => onOpenHotelPopup(sh.city || "all")}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: `hsl(var(--accent) / 0.08)` }}>
                  <Search className="w-4 h-4 text-accent/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: `hsl(var(--accent))`, background: `hsl(var(--accent) / 0.08)` }}>
                      {sh.city}
                    </span>
                    <p className="text-xs font-medium truncate" style={{ color: `hsl(var(--p-text-muted))` }}>Tap to pick a hotel</p>
                  </div>
                  <p className="text-[8px] mt-0.5" style={{ color: `hsl(var(--p-text-subtle))` }}>{sh.nights} night{sh.nights !== 1 ? 's' : ''} needed</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(var(--p-text-muted))` }} />
              </div>
            );
          }

          const badge = getHotelBadge(sh);
          const match = allSearchedHotels.find((h: any) => h.name === sh.name);
          const imgs: string[] = (match?.images || []).map((i: any) => typeof i === 'string' ? i : i?.url).filter(Boolean);
          const mainImg = findHotelImage(sh.name, allSearchedHotels, sh.room_type) || resolvedHotelImage;
          if (mainImg && !imgs.includes(mainImg)) imgs.unshift(mainImg);
          const heroImg = imgs[0] || "";
          const mb = sh.meal_basis || "";
          const hasBreakfast = /breakfast|bb|b&b|half.?board|full.?board|all.?inclusive|continental|buffet/i.test(mb);

          return (
            <div
              key={`hotel-pick-${hIdx}`}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/5 transition-colors"
              onClick={() => onOpenHotelPopup(isMulti ? (sh.city || "all") : "all")}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: `hsl(var(--accent) / 0.08)` }}>
                {heroImg ? (
                  <img src={heroImg} alt={sh.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Hotel className="w-4 h-4 text-accent/25" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isMulti && sh.city && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: `hsl(var(--accent))`, background: `hsl(var(--accent) / 0.08)` }}>
                      {sh.city}
                    </span>
                  )}
                  <p className="text-xs font-semibold truncate" style={{ color: `hsl(var(--p-text))` }}>{sh.name}</p>
                  <HotelBadge type={badge} />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="flex items-center gap-px">
                    {Array.from({ length: Math.min(sh.stars || 0, 5) }).map((_, s) => (
                      <Star key={s} className="w-2 h-2 fill-warning text-warning" />
                    ))}
                  </span>
                  {mb && mb !== "Room Only" && mb !== "ROOM ONLY" ? (
                    <span className={`text-[8px] rounded px-1.5 py-0.5 font-medium ${hasBreakfast ? "text-success bg-success/10" : ""}`} style={!hasBreakfast ? { color: `hsl(var(--p-text-muted))`, background: `hsl(var(--p-surface, var(--muted)) / 0.3)` } : {}}>
                      {mb}
                    </span>
                  ) : null}
                  <span className="text-[8px] font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>{sh.nights}n</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-extrabold text-accent leading-none">{formatPrice(sh.price_per_night)}</p>
                <p className="text-[8px]" style={{ color: `hsl(var(--p-text-subtle))` }}>/night</p>
              </div>
              <button
                className="flex items-center gap-1 h-6 px-2 text-[10px] font-semibold rounded-md text-accent hover:bg-accent/10 flex-shrink-0 transition-colors"
                onClick={(e) => { e.stopPropagation(); onOpenHotelPopup(isMulti ? (sh.city || "all") : "all"); }}
              >
                <ArrowLeftRight className="w-3 h-3" /> Swap
              </button>
            </div>
          );
        })}

        {/* Per-city swap is handled inline via onOpenHotelPopup on each row — no "Show All" needed */}
      </div>
    </motion.div>
  );
};

export default React.memo(DesktopHotelsCard);
