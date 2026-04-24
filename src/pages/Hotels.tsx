import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Star, MapPin, SlidersHorizontal, Loader2, Search, CalendarDays, Users, Building2, ChevronDown, BedDouble, Globe, ArrowRight, X, Flag, Minus, Plus, Check, Map } from "lucide-react";

const HotelMap = lazy(() => import("@/components/hotels/HotelMap"));
import { COUNTRIES, detectCountry } from "@/utils/geolocation";
import { buildHotelPath } from "@/utils/hotelSlug";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency, CURRENCIES } from "@/contexts/CurrencyContext";
import { trackHotelInteraction } from "@/utils/hotelTracking";
import HotelLocationPicker, { type HotelLocation } from "@/components/home/HotelLocationPicker";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";

import HotelCard from "@/components/hotels/HotelCard";
import HybridHotelCard from "@/components/site/hybrid/cards/HybridHotelCard";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";
import HotelSearchLoader from "@/components/hotels/HotelSearchLoader";
import HybridSearchLoader from "@/components/site/hybrid/HybridSearchLoader";
import HotelFilters, { PRICE_RANGES } from "@/components/hotels/HotelFilters";
import SmartChips from "@/components/hotels/SmartChips";
import SortBar, { type SortOption } from "@/components/hotels/SortBar";
import { hydrateHotelDataFromWire } from "@/lib/hotelWireAdapter";
import {
  HybridResultsHeader,
  HybridInsightsRail,
  HybridHotelsFiltersSidebar,
} from "@/components/site/hybrid/results";

interface Hotel {
  id: string;
  name: string;
  city: string;
  rating: number;
  reviews: number;
  price: number;
  image: string | null;
  amenities: string[];
  stars: number;
  source?: string;
  searchId?: string;
  images?: string[];
  country?: string;
  propertyType?: string;
  availableRooms?: any[];
  mealBasis?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  isPreview?: boolean;
  hasFreeCancellation?: boolean;
  popularityScore?: number;
  isSoldOut?: boolean;
}

const HOTELS_PER_PAGE = 15;
const INFINITE_SCROLL_THRESHOLD = 300;

const CounterRow = ({ label, subtitle, value, onChange, min = 0, max = 9 }: { label: string; subtitle?: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-30 hover:bg-muted transition-colors"><Minus className="w-3 h-3" /></button>
      <span className="w-6 text-center text-sm font-bold text-foreground">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-foreground disabled:opacity-30 hover:bg-muted transition-colors"><Plus className="w-3 h-3" /></button>
    </div>
  </div>
);

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (s: string): Date | undefined => {
  if (!s) return undefined;
  try { return parse(s, "yyyy-MM-dd", new Date()); } catch { return undefined; }
};

const Hotels = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isHybrid } = useIsHybridSkin();
  const HotelCardComp = isHybrid ? HybridHotelCard : HotelCard;
  const [apiHotels, setApiHotels] = useState<Hotel[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchPhase, setSearchPhase] = useState<'finding' | 'pricing' | 'done'>('finding');
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recommended");
  const [hasSearched, setHasSearched] = useState(false);
  const { formatPrice, formatDirectPrice, convertPrice, currency } = useCurrency();
  const hasAutoSearched = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState(HOTELS_PER_PAGE);
  const scrollSentinelRef = useRef<HTMLDivElement | null>(null);

  // Smart chip
  const [activeChip, setActiveChip] = useState<string | null>(null);

  // Filters
  const [nameFilter, setNameFilter] = useState("");
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<number[]>([]);
  const [selectedStars, setSelectedStars] = useState<number[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  // Mobile filter drawer
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Search state from URL
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(searchParams.get("locationId") || null);
  const [hotelLocation, setHotelLocation] = useState<HotelLocation | null>(() => {
    const c = searchParams.get("city");
    const lid = searchParams.get("locationId");
    const hids = searchParams.get("hotelIds");
    const actualCity = searchParams.get("actualCity") || undefined;
    const hotelName = searchParams.get("hotelName") || undefined;
    if (c && lid) {
      const isHotel = !!hids;
      return {
        location_id: lid,
        city_name: isHotel && hotelName ? hotelName : c,
        country_name: "",
        type: isHotel ? "HOTEL" : "",
        full_region_name: isHotel && hotelName ? `${hotelName}${actualCity ? `, ${actualCity}` : ""}` : c,
        hotel_ids: hids ? hids.split(",").filter(Boolean) : undefined,
        search_type: isHotel ? "hotel" : "city",
        actual_city_name: actualCity,
      };
    }
    return null;
  });
  const [checkin, setCheckin] = useState(searchParams.get("checkin") || "");
  const [checkout, setCheckout] = useState(searchParams.get("checkout") || "");
  const [adults, setAdults] = useState(Math.max(1, Number(searchParams.get("adults") || "1") || 1));
  const [children, setChildren] = useState(Math.max(0, Number(searchParams.get("children") || "0") || 0));
  const [rooms, setRooms] = useState(Math.max(1, Number(searchParams.get("rooms") || "1") || 1));
  const [nationality, setNationality] = useState(searchParams.get("nationality") || "BD");
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [hoveredHotelId, setHoveredHotelId] = useState<string | null>(null);

  // Popover states
  const [datesOpen, setDatesOpen] = useState(false);
  const [dateStep, setDateStep] = useState<"checkin" | "checkout">("checkin");
  const [draftCheckinDate, setDraftCheckinDate] = useState<Date>();
  const [draftCheckoutDate, setDraftCheckoutDate] = useState<Date>();
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState("");

  useEffect(() => {
    if (searchParams.get("nationality")) return;
    detectCountry().then(country => {
      if (country) setNationality(country.code);
    });
  }, []);

  const [settingsLoaded] = useState(true);

  const AMENITY_BLOCKLIST = /elevator door|wheelchair|inches|centimeters|width|height|sq\s?ft|square\s?feet|compliant|ada\s|idd|voltage|wattage|amp\b/i;
  const cleanAmenities = (raw: string[]): string[] => {
    return raw
      .filter(a => a.length > 1 && a.length < 40 && !AMENITY_BLOCKLIST.test(a))
      .map(a => a.replace(/\s*\(.*?\)\s*$/, "").trim())
      .filter(Boolean);
  };

  const hotelMergeKey = (hotel: Pick<Hotel, "name" | "city">) =>
    `${hotel.name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${hotel.city.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const mergeHotelEntries = (existing: Hotel, incoming: Hotel): Hotel => {
    const preferIncoming = (incoming.price || 0) > 0 && ((existing.price || 0) === 0 || incoming.price <= existing.price);
    const base = preferIncoming ? incoming : existing;
    const other = preferIncoming ? existing : incoming;
    return {
      ...base,
      image: base.image || other.image,
      images: (base.images && base.images.length > 0) ? base.images : (other.images || []),
      amenities: Array.from(new Set([...(base.amenities || []), ...(other.amenities || [])])),
      availableRooms: [...(existing.availableRooms || []), ...(incoming.availableRooms || [])],
      source: existing.source && incoming.source && existing.source !== incoming.source
        ? [existing.source, incoming.source].join("+")
        : (base.source || other.source || ""),
      rating: Math.max(existing.rating || 0, incoming.rating || 0),
      reviews: Math.max(existing.reviews || 0, incoming.reviews || 0),
      stars: Math.max(existing.stars || 0, incoming.stars || 0),
      country: base.country || other.country,
      propertyType: base.propertyType || other.propertyType,
      mealBasis: base.mealBasis || other.mealBasis,
      description: base.description || other.description,
      latitude: base.latitude ?? other.latitude,
      longitude: base.longitude ?? other.longitude,
      searchId: base.searchId || other.searchId,
      isPreview: false,
    };
  };

  const mapUnifiedHotels = (items: any[] = []): Hotel[] =>
    items.map((h: any) => {
      const rawImages = Array.isArray(h.images) ? h.images : [];
      const images: string[] = rawImages
        .map((img: any) => (typeof img === "string" ? img : img?.url || ""))
        .filter(Boolean);
      const resolvedImage = images[0] || (typeof h.image === "string" && h.image.trim() !== "" ? h.image : (typeof h.image === "object" && h.image?.url ? h.image.url : null));
      return {
        id: h.id,
        name: h.name,
        city: h.city || h.country || "",
        rating: h.rating || 0,
        reviews: h.reviews || 0,
        price: h.price || 0,
        image: typeof resolvedImage === "string" ? resolvedImage : null,
        amenities: cleanAmenities(Array.isArray(h.amenities) ? h.amenities : []),
        stars: h.stars || 0,
        source: h.source || "",
        images,
        country: h.country || "",
        propertyType: h.propertyType || "Hotel",
        availableRooms: h.availableRooms || [],
        searchId: h.searchId || undefined,
        mealBasis: h.mealBasis || "",
        description: h.description || "",
        latitude: h.latitude || null,
        longitude: h.longitude || null,
        isPreview: h.isPreview || false,
        hasFreeCancellation: h.hasFreeCancellation || false,
        popularityScore: h.popularityScore || 0,
      };
    });

  const lastSearchRef = useRef<{ cityName: string; checkin: string; checkout: string } | null>(null);
  const previewHotelIdsRef = useRef<string[]>([]);

  // Track which hotel IDs have been priced to avoid re-pricing
  const pricedIdsRef = useRef<Set<string>>(new Set());
  const scrollPricingInFlightRef = useRef(false);

  const runSearch = useCallback(async (searchCity: string, searchCheckin: string, searchCheckout: string, searchAdults: number, searchChildren: number, searchRooms: number, searchNationality: string, limit = 50, hotelIds?: string[], actualCityName?: string) => {
    if (!searchCity.trim() && !hotelIds?.length) return;
    setSearching(true);
    setSearchPhase('finding');
    setFetchingPrices(false);
    setApiHotels([]);
    setTotalAvailable(0);
    setHasSearched(true);
    setDisplayedCount(HOTELS_PER_PAGE);
    setSessionId(null);
    setNameFilter("");
    setSelectedPriceRanges([]);
    setSelectedStars([]);
    setSelectedPropertyTypes([]);
    setSelectedLocations([]);
    setActiveChip(null);
    pricedIdsRef.current = new Set();
    scrollPricingInFlightRef.current = false;

    lastSearchRef.current = { cityName: searchCity, checkin: searchCheckin, checkout: searchCheckout };
    previewHotelIdsRef.current = [];

    // Step 1: Fetch hotel IDs + static data from cache (don't display yet)
    let staticHotels: Hotel[] = [];
    let cacheFreshness: string = 'hard_stale';
    let totalInDb = 0;
    try {
      const cacheBody: any = {
        action: "cache-first-search", cityName: searchCity, limit: 200,
        checkinDate: searchCheckin, checkoutDate: searchCheckout,
        adults: searchAdults, children: searchChildren, rooms: searchRooms,
        clientNationality: searchNationality,
      };
      if (hotelIds && hotelIds.length > 0) {
        cacheBody.hotelIds = hotelIds;
        cacheBody.searchType = "hotel";
      }
      const { data: cacheData } = await supabase.functions.invoke("unified-hotel-search", { body: cacheBody });
      if (cacheData) hydrateHotelDataFromWire(cacheData);
      cacheFreshness = cacheData?.cacheFreshness || 'hard_stale';
      totalInDb = cacheData?.totalInDatabase || 0;
      if (cacheData?.success && cacheData.hotels?.length) {
        staticHotels = mapUnifiedHotels(cacheData.hotels).map(h => ({
          ...h,
          isPreview: h.price <= 0,
          hasFreeCancellation: (h as any).hasFreeCancellation || false,
        }));
        // Mark already-priced hotels
        for (const h of staticHotels) {
          if (h.price > 0 && (h as any).priceFresh) {
            pricedIdsRef.current.add(h.id);
          }
        }
      }
    } catch {}

    // Step 2: If cache is fully fresh, display immediately — no API calls needed
    const isHotelSpecific = !!(hotelIds && hotelIds.length > 0);
    if (cacheFreshness === 'fresh' && staticHotels.length > 0) {
      console.log('[Hotels] All prices fresh from cache — displaying immediately, 0 API calls');
      setApiHotels(staticHotels);
      setTotalAvailable(totalInDb || staticHotels.length);
      setSearching(false);
      setSearchCollapsed(true);
      return;
    }

    // Step 3: Price top 100 hotels before displaying anything
    const idsToPrice = staticHotels.length > 0
      ? staticHotels.filter(h => !pricedIdsRef.current.has(h.id)).slice(0, 100).map(h => h.id)
      : (isHotelSpecific ? hotelIds! : []);

    if (idsToPrice.length > 0) {
      setSearchPhase('pricing');
      setFetchingPrices(true);
      try {
        const { data: priceData } = await supabase.functions.invoke("unified-hotel-search", {
          body: {
            action: "smart-price",
            hotelIds: idsToPrice,
            cityName: actualCityName || searchCity,
            checkinDate: searchCheckin,
            checkoutDate: searchCheckout,
            adults: searchAdults,
            children: searchChildren,
            rooms: searchRooms,
            clientNationality: searchNationality,
            currency,
            searchType: isHotelSpecific ? "hotel" : undefined,
          },
        });
        if (priceData) hydrateHotelDataFromWire(priceData);

        if (priceData?.success && priceData.hotels?.length) {
          const pricedHotels = mapUnifiedHotels(priceData.hotels);
          for (const ph of pricedHotels) pricedIdsRef.current.add(ph.id);

          // Build a set of IDs that got priced results
          const pricedIdSet = new Set(pricedHotels.map(h => h.id));
          // Hotels sent for pricing but got no results = sold out
          const soldOutIds = new Set(idsToPrice.filter(id => !pricedIdSet.has(id)));

          // Merge priced results into static data
          const pricedByKey: Record<string, Hotel> = {};
          for (const ph of pricedHotels) {
            const key = hotelMergeKey(ph);
            const existing = pricedByKey[key];
            if (!existing || (ph.price > 0 && ph.price < (existing.price || Infinity))) {
              pricedByKey[key] = ph;
            }
          }

          const merged: Hotel[] = [];
          const usedKeys: Record<string, boolean> = {};
          for (const sh of staticHotels) {
            const key = hotelMergeKey(sh);
            const priced = pricedByKey[key];
            if (priced) {
              merged.push(mergeHotelEntries(sh, priced));
              usedKeys[key] = true;
            } else if (soldOutIds.has(sh.id)) {
              // Mark as sold out — keep in list but push to end
              merged.push({ ...sh, isSoldOut: true, isPreview: false });
            } else if (pricedIdsRef.current.has(sh.id)) {
              merged.push(sh);
            }
            // Others not yet priced are excluded from initial display
          }
          // Add any priced hotels not in static list
          for (const key of Object.keys(pricedByKey)) {
            if (!usedKeys[key]) merged.push(pricedByKey[key]);
          }

          // Sort: priced first, sold out at end
          merged.sort((a, b) => {
            const aSold = a.isSoldOut ? 1 : 0;
            const bSold = b.isSoldOut ? 1 : 0;
            if (aSold !== bSold) return aSold - bSold; // sold out goes to end
            const aPriced = (a.price || 0) > 0 ? 1 : 0;
            const bPriced = (b.price || 0) > 0 ? 1 : 0;
            if (aPriced !== bPriced) return bPriced - aPriced;
            return (b.popularityScore || 0) - (a.popularityScore || 0);
          });

          setApiHotels(merged);
          setTotalAvailable(totalInDb || merged.length);
        } else {
          // No priced results at all — mark all as sold out
          const allSoldOut = staticHotels.map(h => ({
            ...h,
            isSoldOut: idsToPrice.includes(h.id),
            isPreview: false,
          }));
          // Sort: those with cached prices first, sold out at end
          allSoldOut.sort((a, b) => {
            const aSold = a.isSoldOut ? 1 : 0;
            const bSold = b.isSoldOut ? 1 : 0;
            if (aSold !== bSold) return aSold - bSold;
            return (b.popularityScore || 0) - (a.popularityScore || 0);
          });
          setApiHotels(allSoldOut);
          setTotalAvailable(totalInDb || staticHotels.length);
        }
      } catch {
        // On error, fall back to showing static data
        setApiHotels(staticHotels);
        setTotalAvailable(totalInDb || staticHotels.length);
      }
      setFetchingPrices(false);
    } else {
      // All hotels already have fresh prices from cache
      setApiHotels(staticHotels);
      setTotalAvailable(totalInDb || staticHotels.length);
    }

    setSearchPhase('done');
    setSearching(false);
    setSearchCollapsed(true);
  }, [nationality, currency]);

  // Merge priced hotels into the existing list
  const mergeAndSetHotels = useCallback((pricedHotels: Hotel[]) => {
    setApiHotels(prev => {
      const pricedByKey: Record<string, Hotel> = {};
      for (const ph of pricedHotels) {
        const key = hotelMergeKey(ph);
        const existing = pricedByKey[key];
        if (!existing || (ph.price > 0 && ph.price < (existing.price || Infinity))) {
          pricedByKey[key] = ph;
        }
      }

      const merged: Hotel[] = [];
      const usedKeys: Record<string, boolean> = {};
      for (const sh of prev) {
        const key = hotelMergeKey(sh);
        const priced = pricedByKey[key];
        if (priced) {
          // If hotel was sold out but now has price, un-sold-out it
          merged.push({ ...mergeHotelEntries(sh, priced), isSoldOut: false });
          usedKeys[key] = true;
        } else {
          merged.push(sh);
        }
      }
      for (const key of Object.keys(pricedByKey)) {
        if (!usedKeys[key]) merged.push(pricedByKey[key]);
      }

      // Re-sort: sold out at end, then priced first, then by popularityScore
      merged.sort((a, b) => {
        const aSold = a.isSoldOut ? 1 : 0;
        const bSold = b.isSoldOut ? 1 : 0;
        if (aSold !== bSold) return aSold - bSold;
        const aPriced = (a.price || 0) > 0 ? 1 : 0;
        const bPriced = (b.price || 0) > 0 ? 1 : 0;
        if (aPriced !== bPriced) return bPriced - aPriced;
        return (b.popularityScore || 0) - (a.popularityScore || 0);
      });
      return merged;
    });
  }, []);

  // Load more hotels from DB when user has scrolled through initial batch
  const loadingMoreFromDbRef = useRef(false);
  const loadMoreFromDb = useCallback(async () => {
    if (loadingMoreFromDbRef.current || !lastSearchRef.current) return;
    const currentCount = apiHotels.length;
    if (currentCount >= totalAvailable) return; // Already have all
    
    loadingMoreFromDbRef.current = true;
    try {
      const { cityName, checkin: ci, checkout: co } = lastSearchRef.current;
      const { data } = await supabase.functions.invoke("unified-hotel-search", {
        body: {
          action: "cache-first-search",
          cityName,
          checkinDate: ci,
          checkoutDate: co,
          adults, children, rooms,
          clientNationality: nationality,
          limit: 200,
          offset: currentCount,
        },
      });
      if (data) hydrateHotelDataFromWire(data);
      if (data?.success && data.hotels?.length) {
        const newHotels = mapUnifiedHotels(data.hotels).map((h: Hotel) => ({
          ...h,
          isPreview: h.price <= 0,
          hasFreeCancellation: (h as any).hasFreeCancellation || false,
        }));
        setApiHotels(prev => {
          const existingIds = new Set(prev.map(h => h.id));
          const unique = newHotels.filter((h: Hotel) => !existingIds.has(h.id));
          return [...prev, ...unique];
        });
      }
    } catch {}
    loadingMoreFromDbRef.current = false;
  }, [apiHotels.length, totalAvailable, adults, children, rooms, nationality]);

  // Phase 3: Scroll-triggered progressive pricing
  // Pre-fetches next batch BEFORE user reaches unpriced hotels for seamless UX
  const priceNextBatch = useCallback(async () => {
    if (scrollPricingInFlightRef.current || !lastSearchRef.current) return;
    const { cityName, checkin: searchCheckin, checkout: searchCheckout } = lastSearchRef.current;

    // Find next 30 unpriced hotels from current list (exclude sold out)
    const currentHotels = apiHotels;
    const unpriced = currentHotels
      .filter(h => !pricedIdsRef.current.has(h.id) && h.price <= 0 && !h.isSoldOut)
      .slice(0, 30)
      .map(h => h.id);

    if (unpriced.length === 0) {
      // All current hotels priced — load more from DB if available
      if (apiHotels.length < totalAvailable) loadMoreFromDb();
      return;
    }

    scrollPricingInFlightRef.current = true;
    setFetchingPrices(true);
    try {
      const { data: priceData } = await supabase.functions.invoke("unified-hotel-search", {
        body: {
          action: "scroll-price",
          hotelIds: unpriced,
          cityName,
          checkinDate: searchCheckin,
          checkoutDate: searchCheckout,
          adults, children, rooms,
          clientNationality: nationality,
          currency,
        },
      });
      if (priceData) hydrateHotelDataFromWire(priceData);

      if (priceData?.success && priceData.hotels?.length) {
        const pricedHotels = mapUnifiedHotels(priceData.hotels);
        const pricedIdSet = new Set(pricedHotels.map(h => h.id));
        for (const ph of pricedHotels) pricedIdsRef.current.add(ph.id);

        // Mark unpriced hotels that got no results as sold out
        const soldOutIds = new Set(unpriced.filter(id => !pricedIdSet.has(id)));
        if (soldOutIds.size > 0) {
          setApiHotels(prev => prev.map(h =>
            soldOutIds.has(h.id) ? { ...h, isSoldOut: true, isPreview: false } : h
          ).sort((a, b) => {
            const aSold = a.isSoldOut ? 1 : 0;
            const bSold = b.isSoldOut ? 1 : 0;
            if (aSold !== bSold) return aSold - bSold;
            const aPriced = (a.price || 0) > 0 ? 1 : 0;
            const bPriced = (b.price || 0) > 0 ? 1 : 0;
            if (aPriced !== bPriced) return bPriced - aPriced;
            return (b.popularityScore || 0) - (a.popularityScore || 0);
          }));
        }

        mergeAndSetHotels(pricedHotels);
      } else {
        // No results at all — mark all as sold out
        const soldOutSet = new Set(unpriced);
        setApiHotels(prev => prev.map(h =>
          soldOutSet.has(h.id) ? { ...h, isSoldOut: true, isPreview: false } : h
        ).sort((a, b) => {
          const aSold = a.isSoldOut ? 1 : 0;
          const bSold = b.isSoldOut ? 1 : 0;
          if (aSold !== bSold) return aSold - bSold;
          return (b.popularityScore || 0) - (a.popularityScore || 0);
        }));
        for (const id of unpriced) pricedIdsRef.current.add(id);
      }
    } catch {
      // On failure, mark as sold out
      const soldOutSet = new Set(unpriced);
      setApiHotels(prev => prev.map(h =>
        soldOutSet.has(h.id) ? { ...h, isSoldOut: true, isPreview: false } : h
      ));
      for (const id of unpriced) pricedIdsRef.current.add(id);
    }
    setFetchingPrices(false);
    scrollPricingInFlightRef.current = false;
  }, [apiHotels, adults, children, rooms, nationality, currency, mergeAndSetHotels, totalAvailable, loadMoreFromDb]);

  useEffect(() => {
    if (hasAutoSearched.current) return;
    if (!settingsLoaded) return;
    if (!city || !checkin || !checkout) return;
    hasAutoSearched.current = true;
    const urlHotelIds = searchParams.get("hotelIds");
    const hids = urlHotelIds ? urlHotelIds.split(",") : undefined;
    const urlActualCity = searchParams.get("actualCity") || undefined;
    runSearch(city, checkin, checkout, adults, children, rooms, nationality, 50, hids, urlActualCity);
  }, [city, checkin, checkout, adults, children, rooms, runSearch, settingsLoaded]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (selectedLocationId) params.set("locationId", selectedLocationId);
    if (checkin) params.set("checkin", checkin);
    if (checkout) params.set("checkout", checkout);
    params.set("adults", String(adults));
    if (children > 0) params.set("children", String(children));
    params.set("rooms", String(rooms));
    if (nationality) params.set("nationality", nationality);
    const hids = hotelLocation?.hotel_ids;
    const actualCity = hotelLocation?.actual_city_name;
    if (hids && hids.length > 0) params.set("hotelIds", hids.join(","));
    if (actualCity) params.set("actualCity", actualCity);
    navigate(`/hotels?${params.toString()}`, { replace: true });
    if ((city || selectedLocationId || hids?.length) && checkin && checkout) {
      runSearch(city, checkin, checkout, adults, children, rooms, nationality, 50, hids, actualCity);
    }
  };

  const availablePropertyTypes = useMemo(() => {
    const types = new Set<string>();
    apiHotels.forEach(h => { if (h.propertyType) types.add(h.propertyType); });
    return Array.from(types).sort();
  }, [apiHotels]);

  const availableLocations = useMemo(() => {
    const locs = new Set<string>();
    apiHotels.forEach(h => {
      const loc = h.city?.split(",")[0]?.trim();
      if (loc) locs.add(loc);
    });
    return Array.from(locs).sort();
  }, [apiHotels]);

  // Apply filters + smart chips + sort
  const filtered = useMemo(() => {
    let result = [...apiHotels];

    if (nameFilter.trim()) {
      const q = nameFilter.toLowerCase();
      result = result.filter(h => h.name.toLowerCase().includes(q));
    }

    if (selectedPriceRanges.length > 0) {
      result = result.filter(h => {
        const displayPrice = convertPrice(h.price, h.source || "tripjack");
        return selectedPriceRanges.some(idx => {
          const range = PRICE_RANGES[idx];
          return displayPrice >= range.min && displayPrice < (range.max === Infinity ? 999999999 : range.max);
        });
      });
    }

    if (selectedStars.length > 0) result = result.filter(h => selectedStars.includes(h.stars));
    if (selectedPropertyTypes.length > 0) result = result.filter(h => h.propertyType && selectedPropertyTypes.includes(h.propertyType));
    if (selectedLocations.length > 0) {
      result = result.filter(h => {
        const loc = h.city?.split(",")[0]?.trim();
        return loc && selectedLocations.includes(loc);
      });
    }

    // Smart chip filters
    if (activeChip === "breakfast") result = result.filter(h => h.mealBasis && h.mealBasis !== "Room Only");
    if (activeChip === "luxury") result = result.filter(h => h.stars >= 5);
    if (activeChip === "best-value") result = result.filter(h => h.price > 0 && h.rating >= 7 && h.stars >= 3);
    if (activeChip === "free-cancel") result = result.filter(h => h.hasFreeCancellation || h.availableRooms?.some((r: any) => r.isRefundable));

    // Sort — always push sold-out to end, then apply user sort
    const soldOutSort = (a: Hotel, b: Hotel) => {
      const aSold = a.isSoldOut ? 1 : 0;
      const bSold = b.isSoldOut ? 1 : 0;
      if (aSold !== bSold) return aSold - bSold;
      return 0;
    };

    if (sortBy === "price") result.sort((a, b) => soldOutSort(a, b) || a.price - b.price);
    else if (sortBy === "rating") result.sort((a, b) => soldOutSort(a, b) || b.rating - a.rating);
    else if (sortBy === "deals") result.sort((a, b) => soldOutSort(a, b) || ((b.rating * (b.stars || 1)) / Math.max(b.price, 1) - (a.rating * (a.stars || 1)) / Math.max(a.price, 1)));
    else result.sort((a, b) => soldOutSort(a, b) || ((b.popularityScore || 0) - (a.popularityScore || 0)) || b.rating - a.rating); // recommended

    return result;
  }, [apiHotels, nameFilter, selectedPriceRanges, selectedStars, selectedPropertyTypes, selectedLocations, sortBy, convertPrice, activeChip]);

  const visibleHotels = filtered.slice(0, displayedCount);
  const hasMore = displayedCount < filtered.length;

  // Pre-fetch pricing when user is ~70% through visible priced results
  // This ensures prices are ready before users scroll to unpriced hotels
  useEffect(() => {
    if (!scrollSentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore) {
          setLoadingMore(true);
          // Pre-fetch prices for the NEXT batch before showing them
          priceNextBatch();
          setTimeout(() => {
            setDisplayedCount(prev => Math.min(prev + HOTELS_PER_PAGE, filtered.length));
            setLoadingMore(false);
          }, 200);
        }
      },
      { rootMargin: `${INFINITE_SCROLL_THRESHOLD + 400}px` } // trigger earlier for pre-fetch
    );
    observer.observe(scrollSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, filtered.length, priceNextBatch]);

  useEffect(() => { setDisplayedCount(HOTELS_PER_PAGE); }, [nameFilter, selectedPriceRanges, selectedStars, selectedPropertyTypes, selectedLocations, sortBy, activeChip]);

  const togglePriceRange = (idx: number) => setSelectedPriceRanges(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  const toggleStar = (s: number) => setSelectedStars(prev => prev.includes(s) ? prev.filter(i => i !== s) : [...prev, s]);
  const togglePropertyType = (t: string) => setSelectedPropertyTypes(prev => prev.includes(t) ? prev.filter(i => i !== t) : [...prev, t]);
  const toggleLocation = (l: string) => setSelectedLocations(prev => prev.includes(l) ? prev.filter(i => i !== l) : [...prev, l]);

  const activeFilterCount = (nameFilter ? 1 : 0) + selectedPriceRanges.length + selectedStars.length + selectedPropertyTypes.length + selectedLocations.length;
  const clearFilters = () => { setNameFilter(""); setSelectedPriceRanges([]); setSelectedStars([]); setSelectedPropertyTypes([]); setSelectedLocations([]); setActiveChip(null); };

  const hasSearchParams = !!(city && checkin && checkout);

  return (
    <Layout>
      {/* Hero + Search */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,55%,14%)] via-[hsl(222,50%,11%)] to-[hsl(222,45%,8%)]" />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 30% 0%, hsl(var(--primary) / 0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, hsl(var(--accent) / 0.1) 0%, transparent 50%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/[0.02]" />

        <div className="container mx-auto px-4 py-10 sm:py-12 relative z-10">
          {!searchCollapsed && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-white/[0.07] border border-white/[0.08] flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-accent" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  Find Your Perfect <span className="text-accent">Stay</span>
                </h1>
              </div>
              <p className="text-white/35 text-sm md:text-base mb-8 max-w-lg ml-[52px] font-medium">
                Search thousands of hotels worldwide and find the best deals
              </p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {searchCollapsed && hasSearchParams ? (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-card/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap cursor-pointer shadow-2xl shadow-primary/[0.04] border border-border/15"
                onClick={() => setSearchCollapsed(false)}
              >
                <div className="flex items-center gap-5 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Destination</p>
                      <p className="font-bold text-foreground text-sm capitalize">{city}</p>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-border hidden md:block" />
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Dates</p>
                      <p className="font-medium text-foreground text-sm">{checkin} → {checkout}</p>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-border hidden md:block" />
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Guests</p>
                      <p className="font-medium text-foreground text-sm">{adults} Adult{adults > 1 ? "s" : ""}, {rooms} Room{rooms > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
                  Modify <ChevronDown className="w-3 h-3" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-card/95 backdrop-blur-md rounded-2xl p-6 sm:p-7 shadow-2xl shadow-primary/[0.04] border border-border/15"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {/* Destination */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Destination</label>
                    <HotelLocationPicker
                      selected={hotelLocation}
                      onSelect={(loc) => {
                        setHotelLocation(loc);
                        setCity(loc.city_name);
                        setSelectedLocationId(String(loc.location_id));
                      }}
                      placeholder="Where are you going?"
                    />
                  </div>

                  {/* Check-in / Check-out */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Check-in — Check-out</label>
                    <Popover open={datesOpen} onOpenChange={(open) => {
                      setDatesOpen(open);
                      if (open) { setDraftCheckinDate(undefined); setDraftCheckoutDate(undefined); setDateStep("checkin"); }
                    }}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left h-[42px] sm:h-[44px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className={cn("text-xs sm:text-sm font-semibold truncate", checkin ? "text-foreground" : "text-muted-foreground")}>
                              {checkin ? format(parseLocalDate(checkin)!, "dd MMM") : "Check-in"}
                            </span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className={cn("text-xs sm:text-sm font-semibold truncate", checkout ? "text-foreground" : "text-muted-foreground")}>
                              {checkout ? format(parseLocalDate(checkout)!, "dd MMM") : "Check-out"}
                            </span>
                            {checkin && checkout && (() => {
                              const ci = parseLocalDate(checkin);
                              const co = parseLocalDate(checkout);
                              if (ci && co) {
                                const nights = Math.round((co.getTime() - ci.getTime()) / 86400000);
                                return <span className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5 ml-auto flex-shrink-0">{nights}N</span>;
                              }
                              return null;
                            })()}
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-3 pb-1.5 border-b border-border/60">
                          <div className="flex gap-2">
                            <button onClick={() => setDateStep("checkin")} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", dateStep === "checkin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>
                              {draftCheckinDate ? format(draftCheckinDate, "dd MMM yyyy") : "Check-in"}
                            </button>
                            <button onClick={() => { if (draftCheckinDate) setDateStep("checkout"); }} className={cn("flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-semibold transition-all", dateStep === "checkout" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60")}>
                              {draftCheckoutDate ? format(draftCheckoutDate, "dd MMM yyyy") : "Check-out"}
                            </button>
                          </div>
                        </div>
                        <Calendar
                          mode="single"
                          selected={dateStep === "checkin" ? draftCheckinDate : draftCheckoutDate}
                          onSelect={(d) => {
                            if (!d) return;
                            if (dateStep === "checkin") {
                              setDraftCheckinDate(d);
                              if (draftCheckoutDate && draftCheckoutDate <= d) setDraftCheckoutDate(undefined);
                              setDateStep("checkout");
                            } else {
                              setCheckin(formatLocalDate(draftCheckinDate!));
                              setCheckout(formatLocalDate(d));
                              setDatesOpen(false);
                            }
                          }}
                          disabled={(date) => dateStep === "checkin" ? date < new Date() : date <= (draftCheckinDate || new Date())}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Guests & Rooms */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Guests & Rooms</label>
                    <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left h-[42px] sm:h-[44px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap truncate">
                            {adults + children} Guest{adults + children > 1 ? "s" : ""}, {rooms} Room{rooms > 1 ? "s" : ""}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-4 pointer-events-auto" align="start">
                        <div className="space-y-3">
                          <CounterRow label="Adults" subtitle="18+" value={adults} onChange={setAdults} min={1} max={6} />
                          <CounterRow label="Children" subtitle="0-17" value={children} onChange={setChildren} min={0} max={4} />
                          <CounterRow label="Rooms" value={rooms} onChange={setRooms} min={1} max={4} />
                          <Button size="sm" className="w-full mt-2" onClick={() => setGuestsOpen(false)}>Done</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Nationality */}
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2 block">Nationality</label>
                    <Popover open={nationalityOpen} onOpenChange={(o) => { setNationalityOpen(o); if (!o) setNationalitySearch(""); }}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-2 bg-muted/40 rounded-xl border border-border/70 px-3 py-2.5 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 w-full text-left h-[42px] sm:h-[44px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {(() => { const c = COUNTRIES.find(c => c.code === nationality); return c ? `${c.flag} ${c.name}` : nationality; })()}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                              type="text" value={nationalitySearch} onChange={(e) => setNationalitySearch(e.target.value)}
                              placeholder="Search country..." autoFocus
                              className="w-full bg-transparent pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto py-1">
                          {COUNTRIES
                            .filter(c => !nationalitySearch || c.name.toLowerCase().includes(nationalitySearch.toLowerCase()) || c.code.toLowerCase().includes(nationalitySearch.toLowerCase()))
                            .map((c) => (
                              <button
                                key={c.code} type="button"
                                onClick={() => { setNationality(c.code); setNationalityOpen(false); setNationalitySearch(""); }}
                                className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left", nationality === c.code && "bg-primary/5 text-primary")}
                              >
                                <span className="text-base leading-none">{c.flag}</span>
                                <span className="flex-1 truncate">{c.code} — {c.name}</span>
                                {nationality === c.code && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="mt-5 flex justify-center">
                  <Button onClick={handleSearch} disabled={searching || !city} className="h-12 sm:h-14 px-8 sm:px-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all w-full sm:w-auto">
                    {searching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                    Search Hotels
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Welcome state */}
        {!hasSearched && !searching && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-16 text-center max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Globe className="w-10 h-10 text-primary/60" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">Where would you like to stay?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Enter a destination, select your dates, and we'll find the best hotel deals for you.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {["Dhaka", "Dubai", "Bangkok", "Kolkata", "Singapore"].map((suggestion) => (
                <Button key={suggestion} variant="outline" size="sm" className="rounded-full text-xs gap-1.5" onClick={() => {
                  setCity(suggestion);
                  setHotelLocation({ location_id: "", city_name: suggestion, country_name: "", type: "CITY", full_region_name: suggestion });
                }}>
                  <MapPin className="w-3 h-3" /> {suggestion}
                </Button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Full-screen search loader */}
        <AnimatePresence>
          {searching && (isHybrid ? <HybridSearchLoader variant="hotels" /> : <HotelSearchLoader />)}
        </AnimatePresence>

        {/* Results */}
        {hasSearched && !searching && (
          <>
            {/* Fetching prices banner */}
            {fetchingPrices && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 py-3 px-4 mb-4 bg-primary/5 border border-primary/20 rounded-xl"
              >
                <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Finding the best prices...</p>
                  <p className="text-xs text-muted-foreground">Rates are being confirmed — results will update momentarily</p>
                </div>
              </motion.div>
            )}

            {/* Smart chips */}
            {filtered.length > 0 && (
              <div className="mb-4">
                <SmartChips activeChip={activeChip} onChipClick={setActiveChip} />
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar Filters - Desktop */}
              <div className="lg:w-[260px] flex-shrink-0 hidden lg:block">
                {isHybrid ? (
                  <HybridHotelsFiltersSidebar
                    currencySymbol={CURRENCIES[currency]?.symbol || "$"}
                    priceMin={0}
                    priceMax={1000}
                    priceValue={[0, 1000]}
                    onPriceChange={() => { /* legacy uses tier ranges; no-op */ }}
                    starRatings={selectedStars}
                    onToggleStar={toggleStar}
                    amenities={availablePropertyTypes.map((t) => ({ id: t, label: t }))}
                    selectedAmenities={new Set(selectedPropertyTypes)}
                    onToggleAmenity={togglePropertyType}
                    guestRatingMin={0}
                    onGuestRatingChange={() => { /* not wired in legacy state */ }}
                    freeCancellation={false}
                    onFreeCancellationChange={() => { /* not wired */ }}
                    activeCount={activeFilterCount}
                    onResetAll={clearFilters}
                  />
                ) : (
                  <HotelFilters
                    nameFilter={nameFilter} onNameFilterChange={setNameFilter}
                    selectedPriceRanges={selectedPriceRanges} onTogglePriceRange={togglePriceRange}
                    selectedStars={selectedStars} onToggleStar={toggleStar}
                    selectedPropertyTypes={selectedPropertyTypes} onTogglePropertyType={togglePropertyType}
                    availablePropertyTypes={availablePropertyTypes}
                    selectedLocations={selectedLocations} onToggleLocation={toggleLocation}
                    availableLocations={availableLocations}
                    activeFilterCount={activeFilterCount} onClearFilters={clearFilters}
                  />
                )}
              </div>

              {/* Mobile Filter Button */}
              <div className="lg:hidden flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5 flex-1"
                  onClick={() => setShowMobileFilters(true)}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
                </Button>
                {filtered.some(h => h.latitude && h.longitude) && (
                  <Button
                    variant={showMap ? "default" : "outline"}
                    size="sm"
                    className="rounded-xl gap-1.5"
                    onClick={() => setShowMap(!showMap)}
                  >
                    <Map className="w-3.5 h-3.5" />
                    Map
                  </Button>
                )}
              </div>

              {/* Mobile filter drawer */}
              <AnimatePresence>
                {showMobileFilters && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/50 z-50 lg:hidden"
                      onClick={() => setShowMobileFilters(false)}
                    />
                    <motion.div
                      initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="fixed left-0 top-0 bottom-0 w-[300px] z-50 bg-background overflow-y-auto lg:hidden"
                    >
                      <div className="flex items-center justify-between p-4 border-b border-border">
                        <h3 className="font-bold text-foreground">Filters</h3>
                        <button onClick={() => setShowMobileFilters(false)}>
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-0">
                        {isHybrid ? (
                          <HybridHotelsFiltersSidebar
                            currencySymbol={CURRENCIES[currency]?.symbol || "$"}
                            priceMin={0}
                            priceMax={1000}
                            priceValue={[0, 1000]}
                            onPriceChange={() => { /* no-op */ }}
                            starRatings={selectedStars}
                            onToggleStar={toggleStar}
                            amenities={availablePropertyTypes.map((t) => ({ id: t, label: t }))}
                            selectedAmenities={new Set(selectedPropertyTypes)}
                            onToggleAmenity={togglePropertyType}
                            guestRatingMin={0}
                            onGuestRatingChange={() => { /* no-op */ }}
                            freeCancellation={false}
                            onFreeCancellationChange={() => { /* no-op */ }}
                            activeCount={activeFilterCount}
                            onResetAll={clearFilters}
                          />
                        ) : (
                          <HotelFilters
                            nameFilter={nameFilter} onNameFilterChange={setNameFilter}
                            selectedPriceRanges={selectedPriceRanges} onTogglePriceRange={togglePriceRange}
                            selectedStars={selectedStars} onToggleStar={toggleStar}
                            selectedPropertyTypes={selectedPropertyTypes} onTogglePropertyType={togglePropertyType}
                            availablePropertyTypes={availablePropertyTypes}
                            selectedLocations={selectedLocations} onToggleLocation={toggleLocation}
                            availableLocations={availableLocations}
                            activeFilterCount={activeFilterCount} onClearFilters={clearFilters}
                          />
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Hotel list */}
              <div className="flex-1 min-w-0">
                {/* Sort bar */}
                {isHybrid ? (
                  <HybridResultsHeader
                    eyebrow="Curated stays"
                    headline={`${(totalAvailable > filtered.length ? totalAvailable : filtered.length).toLocaleString()} stay${(totalAvailable > filtered.length ? totalAvailable : filtered.length) === 1 ? "" : "s"}${city ? ` in ${city}` : ""}`}
                    meta="Hand-picked properties · Live availability"
                    tabs={[
                      { key: "recommended", label: "Recommended" },
                      { key: "price", label: "Price" },
                      { key: "rating", label: "Rating" },
                      { key: "deals", label: "Deals" },
                    ]}
                    active={sortBy as any}
                    onChange={(k) => setSortBy(k as SortOption)}
                  />
                ) : (
                  <SortBar sortBy={sortBy} onChange={setSortBy} resultCount={totalAvailable > filtered.length ? totalAvailable : filtered.length} cityName={city} />
                )}

                {/* Map toggle - Desktop */}
                {filtered.length > 0 && filtered.some(h => h.latitude && h.longitude) && (
                  <div className="hidden lg:flex justify-end mt-4">
                    <Button
                      variant={showMap ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl gap-1.5"
                      onClick={() => setShowMap(!showMap)}
                    >
                      <Map className="w-3.5 h-3.5" />
                      {showMap ? "Hide Map" : "Show Map"}
                    </Button>
                  </div>
                )}

                {/* Map */}
                {showMap && filtered.some(h => h.latitude && h.longitude) && (
                  <div className="mt-4">
                    <Suspense fallback={<div className="h-[400px] bg-muted rounded-xl animate-pulse" />}>
                      <HotelMap
                        hotels={filtered}
                        selectedHotelId={hoveredHotelId}
                        onHotelClick={(h) => {
                          trackHotelInteraction({ hotelId: h.id, hotelName: h.name, hotelCity: "", hotelStars: h.stars || 0, action: "click" });
                          navigate(buildHotelPath(h), { state: { hotel: apiHotels.find(ah => ah.id === h.id), checkin, checkout, adults, children, rooms } });
                        }}
                        formatPrice={(p) => formatDirectPrice(p)}
                        className="h-[400px] rounded-2xl overflow-hidden"
                      />
                    </Suspense>
                  </div>
                )}

                {/* No results states */}
                {filtered.length === 0 && apiHotels.length > 0 && (
                  <div className="bg-card rounded-2xl p-12 text-center border border-border/30 mt-4">
                    <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-foreground">No hotels match your filters</p>
                    <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters to see more results</p>
                    <Button variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>Clear Filters</Button>
                  </div>
                )}

                {filtered.length === 0 && apiHotels.length === 0 && (
                  <div className="bg-card rounded-2xl p-16 text-center border border-border/30 mt-4">
                    <BedDouble className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-foreground">No hotels found</p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                      Try different dates or search for another destination
                    </p>
                  </div>
                )}

                {/* Hotel cards */}
                <div className="space-y-4 mt-4 wl-results" data-wl-surface="results">
                  {visibleHotels.map((hotel, i) => (
                    <motion.div
                      key={`${hotel.source}-${hotel.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    >
                      <HotelCardComp
                        hotel={hotel}
                        index={i}
                        fetchingPrices={fetchingPrices}
                        formatDirectPrice={formatDirectPrice}
                        onHover={setHoveredHotelId}
                        onViewRooms={() => {
                          trackHotelInteraction({
                            hotelId: hotel.id,
                            hotelName: hotel.name,
                            hotelCity: hotel.city,
                            hotelStars: hotel.stars,
                            action: "click",
                          });
                          navigate(buildHotelPath(hotel), { state: { hotel, checkin, checkout, adults, children, rooms } });
                        }}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                {hasMore && (
                  <div ref={scrollSentinelRef} className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Loading more hotels...</span>
                    </div>
                  </div>
                )}

                {!hasMore && filtered.length > HOTELS_PER_PAGE && (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">
                      Showing all {filtered.length} hotels
                    </p>
                  </div>
                )}
              </div>

              {/* Hybrid editorial insights rail */}
              {isHybrid && filtered.length > 0 && (
                <aside className="hidden lg:block lg:w-[280px] xl:w-[300px] flex-shrink-0">
                  <div className="sticky top-[120px]">
                    <HybridInsightsRail
                      variant="hotels"
                      currencySymbol={CURRENCIES[currency]?.symbol || "$"}
                      cheapestPrice={
                        filtered.reduce(
                          (min, h) => (h.price > 0 && h.price < min ? h.price : min),
                          Number.POSITIVE_INFINITY,
                        ) === Number.POSITIVE_INFINITY
                          ? 0
                          : filtered.reduce(
                              (min, h) => (h.price > 0 && h.price < min ? h.price : min),
                              Number.POSITIVE_INFINITY,
                            )
                      }
                      destination={city}
                    />
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Hotels;
