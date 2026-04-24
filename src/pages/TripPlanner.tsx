import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Loader2, MapPin, Calendar as CalendarIcon, DollarSign,
  Plane, Hotel, Utensils, Camera, Bus, Star, ChevronDown,
  ChevronUp, Lightbulb, Clock, Users, Zap, Radio,
  Globe, Compass, SunMedium, Mountain, Check,
  X, Shield, Plus, Crown, Wallet,
  Heart, UserRound, AlertTriangle,
  ShoppingCart, TrendingDown, ArrowRight, Sun, Moon, ChevronRight, RefreshCw,
  Trash2, PencilLine, ChevronLeft, LogIn, LogOut, Search, Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import TripRefinementControls, { type RefinementState } from "@/components/trip-planner/TripRefinementControls";
import TripOverviewCard from "@/components/trip-planner/TripOverviewCard";
// TripCTA merged into PriceSummaryCard
import TripContextSidebar from "@/components/trip-planner/TripContextSidebar";
import MobileTripResults from "@/components/trip-planner/MobileTripResults";
import TravelerStylePicker, { detectMissingFields } from "@/components/trip-planner/TravelerStylePicker";
import BookingDialogContent, { BOOKING_TIERS, type BookingTierId } from "@/components/trip-planner/BookingDialog";
import WhyThisPlanCard from "@/components/trip-planner/results/WhyThisPlanCard";
import SmartAlertsCard from "@/components/trip-planner/results/SmartAlertsCard";
import ConfidenceBadgeRow from "@/components/trip-planner/results/ConfidenceBadgeRow";
import TopExperiencesCarousel from "@/components/trip-planner/results/TopExperiencesCarousel";
import PriceSummaryCard from "@/components/trip-planner/results/PriceSummaryCard";
import DesktopFlightsCard from "@/components/trip-planner/results/DesktopFlightsCard";
import DesktopHotelsCard from "@/components/trip-planner/results/DesktopHotelsCard";
import DesktopActivitiesCard from "@/components/trip-planner/results/DesktopActivitiesCard";
import type { NormalizedTransfer } from "@/components/trip-planner/transferTypes";
import FlightDetailDialog from "@/components/trip-planner/FlightDetailDialog";
import AllFlightsPopup from "@/components/trip-planner/AllFlightsPopup";
import AllHotelsPopup from "@/components/trip-planner/AllHotelsPopup";
import AllActivitiesPopup from "@/components/trip-planner/AllActivitiesPopup";
import OptionPickerBadge from "@/components/trip-planner/OptionPickerBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { useIsHybridSkin } from "@/hooks/useIsHybridSkin";
import TripErrorBoundary from "@/components/trip-planner/TripErrorBoundary";
import ReactMarkdown from "react-markdown";
import ImageCarousel from "@/components/ui/image-carousel";
import { useCurrency, CURRENCIES } from "@/contexts/CurrencyContext";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useBotIdentity } from "@/hooks/useBotIdentity";
import BotAvatar from "@/components/trip-planner/BotAvatar";
import { toast } from "@/hooks/use-toast";
import { generateItineraryPdf } from "@/components/trip-planner/tripPdfGenerator";
import AirlineLogo from "@/components/trip-planner/AirlineLogo";
import FlightLegRow from "@/components/trip-planner/FlightLegRow";
import { AIRLINE_NAMES } from "@/data/airlines";
import { buildHotelPath } from "@/utils/hotelSlug";
import { trackTripEvent } from "@/utils/tripTracking";
import { buildTourUrl } from "@/utils/tourSlug";
import ItineraryDebugTag from "@/components/trip-planner/ItineraryDebugTag";
import InspirationView from "@/components/trip-planner/InspirationView";
import HybridPreviewView from "@/components/trip-planner/HybridPreviewView";
import TripDetailsFormCard from "@/components/trip-planner/TripDetailsFormCard";
import { useTripDayEditor } from "@/components/trip-planner/useTripDayEditor";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { useTripChat } from "@/hooks/useTripChat";
import { useTripSearch } from "@/hooks/useTripSearch";
import { useTripUIReducer } from "@/hooks/useTripUIReducer";
import { useDisplayItinerary } from "@/hooks/useDisplayItinerary";
import { useTransferResolution, extractTransferNeeds } from "@/hooks/useTransferResolution";
import { useTripHolidays } from "@/hooks/useTripHolidays";
import { useAuth } from "@/contexts/AuthContext";
import { useTripCollaboration } from "@/hooks/useTripCollaboration";
import CollaborationPanel from "@/components/trip-planner/CollaborationPanel";

// ── Extracted modules ──
import type { Msg, LiveData, PreviewData, CityIntro, RouteIntelligence, ExtractedParams, FareDetails, Itinerary, ConversationEntry, PlannerTheme } from "@/components/trip-planner/tripTypes";
import {
  calcRooms, getExactFareTotal, buildExactFare, getFlightFareBreakdown,
  aggregateFlightFareBreakdown, calcFlightCost, getPerAdultPrice, getPerChildPrice,
  getPerInfantPrice, calcHotelCost, calcActivityCost, formatTravelerBreakdown,
  getAirlineInfo, formatAirlineDisplay, computeFlightDuration, prefixFlightNumber,
  formatFlightTime, formatFlightDate, IATA_TO_CITY, resolveCity,
  cleanInsightReason, generateHotelInsight, generateFlightInsight,
  buildBookingFlight, getBaggageFromRawFlights,
  normalizeHotelText, getRoomImg, getHotelImg, getSelectedRoomImg,
  getPreferredHotelCardImage, findHotelImage,
  isRecord, asString, asNumber, asStringArray,
} from "@/components/trip-planner/tripPricingUtils";
import { normalizeItinerary, parseItinerary, getTextContent, sanitizeMessages, sanitizeRetryContent } from "@/components/trip-planner/tripParsingUtils";
import { hydrateHotelDataFromWire } from "@/lib/hotelWireAdapter";
import { hydrateTourDataFromWire } from "@/lib/tourWireAdapter";
import {
  CACHE_FLIGHTS_KEY, CACHE_HOTELS_KEY,
  CACHE_HOTELS_BY_CITY_KEY, CACHE_ACTIVITIES_KEY, CACHE_ACTIVITIES_BY_CITY_KEY,
  loadCachedSearchedFlights, saveCachedSearchedFlights,
  loadCachedSearchedHotels, saveCachedSearchedHotels,
  loadCachedHotelsByCity, saveCachedHotelsByCity,
  loadCachedSearchedActivities, saveCachedSearchedActivities,
  loadCachedActivitiesByCity, saveCachedActivitiesByCity,
  saveCachedLiveData,
} from "@/components/trip-planner/tripCacheHelpers";


// Pricing functions imported from tripPricingUtils.ts above

// Itinerary type imported from tripTypes.ts above

const categoryIcon: Record<string, typeof Plane> = {
  flight: Plane, hotel: Hotel, activity: Camera, flights: Plane,
  hotels: Hotel, activities: Camera, transport: Bus, food: Utensils,
};

const budgetKeyLabel: Record<string, string> = {
  flights: "Flights", hotels: "Hotels", activities: "Activities",
  food: "Food", transport: "Transport",
};

const categoryColor: Record<string, string> = {
  flight: "text-primary bg-primary/10 border-primary/20",
  hotel: "text-accent bg-accent/10 border-accent/20",
  activity: "text-success bg-success/10 border-success/20",
  transport: "text-amber-600 bg-amber-500/10 border-amber-500/20",
};

const buildActivityDisplayName = (act: any) => {
  const productName = (act?.product_name || "").trim();
  const activityName = (act?.activity || "").trim();
  const option = (act?.option_title || "").trim();
  
  // If product_name is set and differs from activity, use product_name as primary
  // But if they're essentially the same (one contains the other), don't duplicate
  let primary = productName || activityName;
  
  // Avoid showing "product_name — option_title" when product_name already contains option
  // Also avoid "Universal Studios Singapore — Universal Studios Singapore Express Pass"
  if (option && primary) {
    const pLower = primary.toLowerCase();
    const oLower = option.toLowerCase();
    // Only append option if it adds genuinely new info
    if (!pLower.includes(oLower) && !oLower.includes(pLower)) {
      // Check if option is just the product name + extra words (redundant prefix)
      const optWords = oLower.split(/\s+/).filter(w => w.length > 2);
      const primaryWords = new Set(pLower.split(/\s+/).filter(w => w.length > 2));
      const newWords = optWords.filter(w => !primaryWords.has(w));
      if (newWords.length > 0) {
        primary = `${primary} — ${option}`;
      }
    }
  }
  
  return (primary || option || activityName).replace(/^(ℹ️\s*External\s*[-–—:]?\s*|✅\s*Bookable.*[-–—:]?\s*|🆓\s*Free.*[-–—:]?\s*)/i, "");
};

const getActivityDisplayHighlights = (act: any) => {
  const merged = [
    ...(Array.isArray(act?.places_covered) ? act.places_covered : []),
    ...(Array.isArray(act?.highlights) ? act.highlights : []),
  ]
    .map((item: any) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
  return merged.slice(0, 4);
};

// Parsing + text sanitization imported from tripParsingUtils.ts above
// Insight generators imported from tripPricingUtils.ts above

// AirlineLogo, FlightLegRow, LiveFlightCard, LiveHotelCard, LiveActivityCard
// extracted to separate component files under src/components/trip-planner/

const useSuggestions = () => {
  const { currency } = useCurrency();
  const sym = CURRENCIES[currency].symbol;
  const budgetMap: Record<string, string> = {
    BDT: `${sym}50,000`, USD: `$800`, EUR: `€750`, GBP: `£650`,
    SAR: `${sym}3,000`, AED: `${sym}3,000`, INR: `${sym}40,000`,
    MYR: `${sym}3,500`, SGD: `${sym}1,200`, CAD: `${sym}1,100`,
    AUD: `${sym}1,200`, JPY: `${sym}120,000`, CNY: `${sym}5,500`,
  };
  const budget = budgetMap[currency] || `$800`;
  return [
    { text: `3 days in Bangkok under ${budget}`, icon: SunMedium, emoji: "✈️" },
    { text: "Honeymoon in Maldives", icon: Compass, emoji: "💍" },
    { text: "Cheapest trip next weekend", icon: Globe, emoji: "⚡" },
    { text: "Business trip to Guangzhou", icon: Mountain, emoji: "💼" },
  ];
};

// ── Mobile Day Accordion ──
const MobileDayAccordion = ({ day }: { day: { day: number; title: string; activities: Array<{ time?: string; activity: string }> } }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-primary/5"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{day.day}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: `hsl(var(--p-text))` }}>{day.title}</p>
          <p className="text-[10px]" style={{ color: `hsl(var(--p-text-faint))` }}>{day.activities.length} activities</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4" style={{ color: `hsl(var(--p-text-faint))` }} />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pl-[3.75rem] space-y-2">
              {[...day.activities].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")).map((act, j) => (
                <div key={j} className="flex items-start gap-2 text-[11px]">
                  {act.time && (
                    <span className="shrink-0 font-medium w-14" style={{ color: `hsl(var(--p-text-muted))` }}>{act.time}</span>
                  )}
                  <span style={{ color: `hsl(var(--p-text))` }}>{act.activity}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── ItineraryCard, ItineraryActions, BookingDialogContent, TravelerStylePicker, SearchProgressLoader ──
// All extracted to modular components under src/components/trip-planner/

/** Extract check-in/check-out dates from itinerary day plans */
function getHotelDates(itinerary: any): { checkin?: string; checkout?: string } {
  const days = itinerary?.day_plans || itinerary?.itinerary;
  if (!Array.isArray(days) || days.length === 0) return {};
  const checkin = days[0]?.date;
  const checkout = days[days.length - 1]?.date;
  return { checkin, checkout };
}

// Cache helpers, conversation history, and sanitization imported from tripCacheHelpers.ts above
// PlannerTheme type imported from tripTypes.ts above

// ── Main Page ──
const TripPlanner = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currency, formatDirectPrice, formatFromSource, convertFromSource } = useCurrency();
  const tripSuggestions = useSuggestions();
  const { saveTrip, saving: tripSaving } = useSavedTrips();
  const { user, isAdmin } = useAuth();
  const { isHybrid } = useIsHybridSkin();
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
  const [itineraryCode, setItineraryCode] = useState<string | null>(null);
  const { collaborators, presenceUsers, isOwner, addCollaborator, removeCollaborator, broadcastUpdate } = useTripCollaboration(savedTripId);
  
  // ── Consolidated UI state (useReducer) ──
  const { ui, dispatch, cyclePlannerTheme, openLightbox, openBookingDialog } = useTripUIReducer();
  // ── Chat state (extracted to useTripChat hook) ──
  const {
    messages, setMessages, messagesRef,
    input, setInput, inputRef,
    history, showHistory, setShowHistory,
    handleLoadConversation, handleDeleteConversation,
    lastLiveData, setLastLiveData,
    structuredItinerary, setStructuredItinerary,
    handleNewTrip: chatHandleNewTrip,
  } = useTripChat();

  // Day editing — must be before useTripSearch so we can pass updateItineraryDay as callback
  const {
    editingDayIdx, setEditingDayIdx,
    moveToDayTarget, setMoveToDayTarget,
    daySuggestionText, setDaySuggestionText,
    daySuggestionLoading,
    updateItineraryDay, recalculateTimes,
    removeActivity, moveActivity, moveActivityToDay,
    improveDayWithAI, addDayToItinerary, removeDayFromItinerary,
  } = useTripDayEditor(structuredItinerary, setStructuredItinerary, savedTripId, user?.id);

  // ── Preview data now in reducer (ui.previewData) ──

  // ── Day fix callbacks for useTripSearch ──
  // Backend handles all merge logic and sends ready-to-use activities.
  // Frontend just sets them directly.
  const onDayFix = useCallback((dayIndex: number, activities: any[]) => {
    if (structuredItinerary && activities?.length > 0) {
      updateItineraryDay(dayIndex, d => {
        // Keep anchors (flight/hotel/transport) that backend didn't include
        const aiActivityNames = new Set(activities.map((a: any) => (a.activity || a.name || "").toLowerCase().trim()));
        const preserved = d.activities.filter(a => {
          const isAnchor = a.category === "flight" || a.category === "hotel" || a.category === "transport";
          if (!isAnchor) return false;
          return !aiActivityNames.has((a.activity || "").toLowerCase().trim());
        });
        const mapped = activities.map((a: any) => ({
          time: a.time || "10:00",
          activity: a.activity || a.name || "",
          description: a.description || "",
          cost_estimate: Number(a.cost_estimate || 0),
          category: (a.category || "activity") as any,
          source: a.source || "day-fix",
          product_code: a.product_code || null,
          product_name: a.product_name || null,
          highlights: a.highlights || [],
          places_covered: a.places_covered || [],
          booking_url: a.booking_url || null,
          is_live_price: a.is_live_price || false,
          vela_id: a.vela_id || null,
          slug: a.slug || null,
        }));
        return { ...d, activities: [...preserved, ...mapped].sort((a, b) => (a.time || "").localeCompare(b.time || "")) };
      });
    }
  }, [structuredItinerary, updateItineraryDay]);

  const onDayFixMulti = useCallback((patches: { dayIndex: number; activities: any[] }[]) => {
    if (!structuredItinerary) return;
    for (const patch of patches) {
      const { dayIndex, activities: newActivities } = patch;
      if (!newActivities?.length || dayIndex == null) continue;
      onDayFix(dayIndex, newActivities);
    }
  }, [structuredItinerary, onDayFix]);

  // ── Search state (extracted to useTripSearch hook) ──
  const {
    sendMessage, loading, isSearching, rightPanelError, setRightPanelError,
    allSearchedFlights, setAllSearchedFlights,
    allSearchedHotels, setAllSearchedHotels,
    allSearchedActivities, setAllSearchedActivities,
    hotelsByCity, setHotelsByCity,
    activitiesByCity, setActivitiesByCity,
    searchedCities, setSearchedCities,
    progressiveFlights, progressiveHotels, progressiveActivities,
    searchPhase, genProgressStep, genProgressLabel,
    extractedParams, setExtractedParams,
    languageSession, setLanguageSession,
    lastMissingFields, setLastMissingFields,
    refinement, setRefinement,
    aiTravelers, setAiTravelers,
    refinementSyncedRef, itinerarySyncedRef,
    userSelectedFlight, setUserSelectedFlight,
    userSelectedFlightsByLeg, setUserSelectedFlightsByLeg,
    userSelectedHotel, setUserSelectedHotel,
    userSelectedHotelsByCity, setUserSelectedHotelsByCity,
    userSelectedActivities, setUserSelectedActivities,
    dayActivityOverrides, setDayActivityOverrides,
    swapTarget, setSwapTarget,
    sendingRef,
    debugModeRef,
    debugSnapshots,
    inspirationData, setInspirationData,
    hybridPreviewData, setHybridPreviewData,
    resetSearchState,
    backendResolvedTransfers,
  } = useTripSearch({
    messagesRef, setMessages, setLastLiveData, setStructuredItinerary,
    structuredItinerary, inputRef, currency,
    clearInput: () => setInput(""),
    getInputText: () => input,
    onDayFix,
    onDayFixMulti,
    onPreviewData: (d: any) => dispatch({ type: "SET_PREVIEW_DATA", payload: d }),
  });

  // ── Debug mode keyboard shortcut (Ctrl+Shift+D) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        debugModeRef.current = !debugModeRef.current;
        toast({ title: debugModeRef.current ? "🔍 Debug mode ON" : "Debug mode OFF", description: debugModeRef.current ? "Next generation will capture pipeline snapshots" : "" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Forward debug snapshots to admin page ──
  useEffect(() => {
    if (debugSnapshots) {
      localStorage.setItem("vela_debug_snapshots", JSON.stringify(debugSnapshots));
      window.dispatchEvent(new CustomEvent("vela-debug-snapshots", { detail: debugSnapshots }));
      toast({ title: "🔍 Pipeline snapshots captured!", description: "View at /admin/pipeline-debug" });
    }
  }, [debugSnapshots]);

  // ── Lazy-load full hotel inventory when popup opens ──
  const [isLoadingMoreHotels, setIsLoadingMoreHotels] = useState(false);
  const hotelFullLoadDoneRef = useRef<string>("");
  const handleLoadMoreHotels = useCallback(async () => {
    if (isLoadingMoreHotels) return;
    const dest = structuredItinerary?.destination || extractedParams?.destination_city || "";
    if (!dest || hotelFullLoadDoneRef.current === dest.toLowerCase()) return;
    hotelFullLoadDoneRef.current = dest.toLowerCase();

    const cities = searchedCities.length > 0
      ? searchedCities
      : [{ name: dest, days: extractedParams?.duration_days || 3 }];
    const { checkin } = getHotelDates(structuredItinerary);
    if (!checkin) return;

    setIsLoadingMoreHotels(true);
    try {
      const existingNames = new Set(allSearchedHotels.map((h: any) => (h.name || "").toLowerCase()));
      const newHotels: any[] = [];

      await Promise.all(cities.map(async (city) => {
        const cityName = city.name;
        const nights = getNightsForCity(cityName) || (city as any).days || 2;
        let cityCheckin = checkin;
        if (cities.length > 1) {
          let dayOffset = 0;
          for (const c of cities) {
            if (c.name === cityName) break;
            dayOffset += (c as any).days || 2;
          }
          const ci = new Date(checkin);
          ci.setDate(ci.getDate() + dayOffset);
          cityCheckin = ci.toISOString().split("T")[0];
        }
        const co = new Date(cityCheckin);
        co.setDate(co.getDate() + nights);
        const cityCheckout = co.toISOString().split("T")[0];

        const resp = await supabase.functions.invoke("unified-hotel-search", {
          body: {
            action: "cache-first-search",
            cityName,
            checkinDate: cityCheckin,
            checkoutDate: cityCheckout,
            adults: refinement.adults || extractedParams?.adults || 1,
            children: refinement.children || extractedParams?.children || 0,
            rooms: calcRooms(refinement.adults || 1, refinement.children || 0),
            limit: 200,
            offset: 0,
            targetCurrency: currency,
          },
        });
        if (resp?.data) resp.data = hydrateHotelDataFromWire(resp.data);

        const hotels = resp.data?.hotels || [];
        for (const h of hotels) {
          if (existingNames.has((h.name || "").toLowerCase())) continue;
          existingNames.add((h.name || "").toLowerCase());
          const hPrice = h.price || h.pricePerNight || 0;
          newHotels.push({
            hotel_id: h.id || h.hotelId || "",
            id: h.id || h.hotelId || "",
            name: h.name || "",
            city: cityName,
            _searchCity: cityName,
            stars: h.stars || 0,
            pricePerNight: hPrice,
            price_per_night: hPrice,
            total_price: hPrice * nights,
            _nights: nights,
            currency,
            rating: h.rating || 0,
            image: h.image || "",
            images: h.images || [],
            amenities: (h.amenities || []).slice(0, 5),
            mealBasis: h.mealBasis || "",
            isRefundable: h.isRefundable || false,
            source: hPrice > 0 ? "unified_hotel_search" : "hotel_catalogue",
            is_live_price: hPrice > 0 && !h.isPreview,
          });
        }
      }));

      if (newHotels.length > 0) {
        console.log(`[LazyLoad] 🏨 Loaded ${newHotels.length} additional hotels`);
        setAllSearchedHotels(prev => [...prev, ...newHotels]);
        setHotelsByCity(prev => {
          const updated = { ...prev };
          for (const h of newHotels) {
            const c = h.city || "Unknown";
            if (!updated[c]) updated[c] = [];
            updated[c].push(h);
          }
          return updated;
        });

        // ── Smart-price: fetch live prices for hotels that came back with price=0 ──
        const zeroPriceByCity: Record<string, { ids: string[]; checkin: string; checkout: string }> = {};
        for (const h of newHotels) {
          if ((h.pricePerNight || 0) > 0) continue;
          const hId = h.id || h.hotel_id;
          if (!hId) continue;
          const cityKey = h._searchCity || h.city || "";
          if (!zeroPriceByCity[cityKey]) {
            // Reconstruct dates for this city
            const cityObj = cities.find(c => c.name === cityKey);
            const nights = getNightsForCity(cityKey) || (cityObj as any)?.days || 2;
            let ci = checkin;
            if (cities.length > 1) {
              let dayOff = 0;
              for (const c of cities) { if (c.name === cityKey) break; dayOff += (c as any).days || 2; }
              const d = new Date(checkin); d.setDate(d.getDate() + dayOff); ci = d.toISOString().split("T")[0];
            }
            const coDate = new Date(ci); coDate.setDate(coDate.getDate() + nights);
            zeroPriceByCity[cityKey] = { ids: [], checkin: ci, checkout: coDate.toISOString().split("T")[0] };
          }
          zeroPriceByCity[cityKey].ids.push(String(hId));
        }

        // Fire smart-price requests in parallel per city (batches of 100)
        const pricePromises = Object.entries(zeroPriceByCity).map(async ([cityKey, info]) => {
          if (info.ids.length === 0) return;
          console.log(`[LazyLoad] 💰 Smart-pricing ${info.ids.length} zero-price hotels for ${cityKey}`);
          try {
            const resp = await supabase.functions.invoke("unified-hotel-search", {
              body: {
                action: "smart-price",
                hotelIds: info.ids.slice(0, 100),
                cityName: cityKey,
                checkinDate: info.checkin,
                checkoutDate: info.checkout,
                adults: refinement.adults || extractedParams?.adults || 1,
                children: refinement.children || extractedParams?.children || 0,
                rooms: calcRooms(refinement.adults || 1, refinement.children || 0),
                currency,
              },
            });
            if (resp?.data) resp.data = hydrateHotelDataFromWire(resp.data);
            const pricedHotels = resp.data?.hotels || [];
            if (pricedHotels.length > 0) {
              const priceMap = new Map<string, any>();
              for (const ph of pricedHotels) {
                const pid = String(ph.id || ph.hotelId || "");
                if (pid) priceMap.set(pid, ph);
              }
              // Update state with live prices
              const updateHotelPrice = (h: any) => {
                const hid = String(h.id || h.hotel_id || "");
                const priced = priceMap.get(hid);
                if (!priced) return h;
                const livePrice = priced.price || priced.pricePerNight || 0;
                if (livePrice <= 0) return h;
                const nights = h._nights || 1;
                return { ...h, pricePerNight: livePrice, price_per_night: livePrice, total_price: livePrice * nights, source: "unified_hotel_search", is_live_price: true };
              };
              setAllSearchedHotels(prev => prev.map(updateHotelPrice));
              setHotelsByCity(prev => {
                const updated = { ...prev };
                for (const key of Object.keys(updated)) {
                  updated[key] = updated[key].map(updateHotelPrice);
                }
                return updated;
              });
              console.log(`[LazyLoad] ✅ Priced ${priceMap.size} hotels for ${cityKey}`);
            }
          } catch (e) {
            console.warn(`[LazyLoad] Smart-price failed for ${cityKey}:`, e);
          }
        });
        // Don't block the main flow — fire and forget
        Promise.all(pricePromises).catch(() => {});
      }
    } catch (err) {
      console.warn("[LazyLoad] Hotel load failed:", err);
    } finally {
      setIsLoadingMoreHotels(false);
    }
  }, [structuredItinerary, extractedParams, searchedCities, allSearchedHotels, refinement, currency, isLoadingMoreHotels]);

  // ── Lazy-load full activity inventory when popup opens ──
  const [isLoadingMoreActivities, setIsLoadingMoreActivities] = useState(false);
  const activityFullLoadDoneRef = useRef<string>("");
  const handleLoadMoreActivities = useCallback(async () => {
    if (isLoadingMoreActivities) return;
    const dest = structuredItinerary?.destination || extractedParams?.destination_city || "";
    if (!dest || activityFullLoadDoneRef.current === dest.toLowerCase()) return;
    activityFullLoadDoneRef.current = dest.toLowerCase();

    const cities = searchedCities.length > 0
      ? searchedCities
      : [{ name: dest, days: extractedParams?.duration_days || 3 }];

    setIsLoadingMoreActivities(true);
    try {
      const existingKeys = new Set(allSearchedActivities.map((a: any) => (a.productCode || a.product_code || a.name || "").toLowerCase()));
      const newActivities: any[] = [];

      await Promise.all(cities.map(async (city) => {
        const cityName = city.name;
        const resp = await supabase.functions.invoke("unified-tour-search", {
          body: {
            action: "freetext",
            searchText: cityName,
            destination: cityName,
            limit: 100,
            targetCurrency: currency,
          },
        });
        if (resp?.data) resp.data = hydrateTourDataFromWire(resp.data);

        const products = resp.data?.products || [];
        for (const p of products) {
          const key = (p.productCode || p.product_code || p.title || "").toLowerCase();
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          newActivities.push({
            ...p,
            name: p.title || p.name || "",
            product_code: p.productCode || p.product_code || "",
            price: p.price || p.fromPrice || 0,
            city: cityName,
            _searchCity: cityName,
            image: p.thumbnailUrl || p.image || "",
            images: p.images || [],
            rating: p.reviewRating || p.rating || 0,
            review_count: p.reviewCount || p.review_count || 0,
            duration: p.duration || "",
            highlights: p.highlights || [],
            source: "unified_tour_search_lazy",
          });
        }
      }));

      if (newActivities.length > 0) {
        console.log(`[LazyLoad] 🎯 Loaded ${newActivities.length} additional activities`);
        setAllSearchedActivities(prev => [...prev, ...newActivities]);
        setActivitiesByCity(prev => {
          const updated = { ...prev };
          for (const a of newActivities) {
            const c = a.city || a._searchCity || "Unknown";
            if (!updated[c]) updated[c] = [];
            updated[c].push(a);
          }
          return updated;
        });
      }
    } catch (err) {
      console.warn("[LazyLoad] Activity load failed:", err);
    } finally {
      setIsLoadingMoreActivities(false);
    }
  }, [structuredItinerary, extractedParams, searchedCities, allSearchedActivities, currency, isLoadingMoreActivities]);

  // ── Transfer resolution ──
  const { resolvedTransfers, isResolving: isResolvingTransfers, resolveTransfers, clearTransfers, transfersByDay, totalTransferCost, seedTransfers } = useTransferResolution();
  const transferResolvedRef = useRef<string>("");
  const transferSeededRef = useRef(false);


  // ── UI-only refs (not in reducer) ──
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);
  const resolvedHotelImageRef = useRef<string>("");
  const cityIntroFetchedRef = useRef<string>("");
  const routeIntelFetchedRef = useRef<string>("");

  // PDF download support
  const { branding: pdfBranding } = useSiteBranding();
  const bot = useBotIdentity();
  const pdfItineraryRef = useRef<Itinerary | null>(null);

  const handlePdfDownload = useCallback(async () => {
    const itinerary = pdfItineraryRef.current;
    if (ui.pdfDownloading || !itinerary) return;
    dispatch({ type: "SET_PDF_DOWNLOADING", payload: true });
    try {
      await generateItineraryPdf(itinerary, pdfBranding, itineraryCode);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      dispatch({ type: "SET_PDF_DOWNLOADING", payload: false });
    }
  }, [ui.pdfDownloading, pdfBranding, dispatch]);

  // Listen for PDF download trigger from sidebar
  useEffect(() => {
    const handler = () => handlePdfDownload();
    window.addEventListener('vela-download-pdf', handler);
    return () => window.removeEventListener('vela-download-pdf', handler);
  }, [handlePdfDownload]);

  // Helper: map dayIdx → correct city based on cumulative day offsets
  const getCityForDay = useCallback((dayIdx: number): string => {
    if (searchedCities.length <= 1) return searchedCities[0]?.name || "all";
    let cumDays = 0;
    for (const city of searchedCities) {
      cumDays += city.days;
      if (dayIdx < cumDays) return city.name;
    }
    return searchedCities[searchedCities.length - 1]?.name || "all";
  }, [searchedCities]);

  // Helper: get nights for a specific city
  const getNightsForCity = useCallback((cityName: string): number => {
    if (!cityName || cityName === "all") return searchedCities.reduce((sum, c) => sum + c.days, 0);
    const city = searchedCities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
    return city?.days || 1;
  }, [searchedCities]);

  // ── Real-time collaboration: listen for remote updates ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, data, userId } = (e as CustomEvent).detail || {};
      if (userId === user?.id) return; // ignore own broadcasts
      if (type === "itinerary_update" && data) {
        setStructuredItinerary(data);
        toast({ title: "Trip updated", description: "A collaborator made changes." });
      }
    };
    window.addEventListener("trip-collab-update", handler);
    return () => window.removeEventListener("trip-collab-update", handler);
  }, [user?.id, setStructuredItinerary]);


  // ── Navigate to booking — price verification happens on the booking page ──
  const navigateToFlightBooking = useCallback((sf: any, allFlights: any[], travelers: number) => {
    const result = buildBookingFlight(sf, allFlights, travelers);
    if (!result) {
      toast({ title: "No flight data available", description: "Please select a different flight.", variant: "destructive" });
      return;
    }

    const flightObj = result.flightObj;

    // Open booking in a new tab via sessionStorage (preserves trip planner state)
    sessionStorage.setItem('ai_flight_booking', JSON.stringify(flightObj));
    window.open(`/flights/${flightObj.id}/book?fromAi=true&adults=${travelers}`, '_blank');
  }, [toast]);

  // ── Sync refinement chips with AI-extracted params ──
  useEffect(() => {
    if (!extractedParams) return;
    const patch: Partial<RefinementState> = {};
    let changed = false;

    // Always sync travelers from AI extraction (authoritative source)
    if (extractedParams.adults && extractedParams.adults >= 1) {
      patch.adults = extractedParams.adults;
      changed = true;
    }
    if (typeof extractedParams.children === "number") {
      patch.children = extractedParams.children;
      changed = true;
    }
    if (typeof extractedParams.infants === "number") {
      patch.infants = extractedParams.infants;
      changed = true;
    }
    // Track AI-extracted travelers for lock indicator
    if (extractedParams.adults || typeof extractedParams.children === "number" || typeof extractedParams.infants === "number") {
      setAiTravelers({
        adults: extractedParams.adults || 1,
        children: extractedParams.children || 0,
        infants: extractedParams.infants || 0,
      });
    }

    if (extractedParams.travel_style) {
      const styleMap: Record<string, RefinementState["travelStyle"]> = {
        budget: "budget", cheap: "budget", affordable: "budget",
        comfort: "comfortable", comfortable: "comfortable", mid: "comfortable",
        luxury: "luxury", premium: "luxury", high: "luxury",
      };
      const mapped = styleMap[extractedParams.travel_style.toLowerCase()] || "";
      if (mapped && mapped !== refinement.travelStyle) {
        patch.travelStyle = mapped;
        changed = true;
      }
    }
    // Sync prefer_direct from extraction to refinement
    if (extractedParams.prefer_direct && !refinement.directFlightsOnly) {
      patch.directFlightsOnly = true;
      changed = true;
    }
    // Sync cabin class from extraction to refinement
    if (extractedParams.cabin_class) {
      const cabinMap: Record<string, RefinementState["cabinClass"]> = {
        "economy": "economy", "premium economy": "premium_economy",
        "business": "business", "first": "first",
      };
      const mapped = cabinMap[extractedParams.cabin_class.toLowerCase()] || "economy";
      if (mapped !== refinement.cabinClass) {
        patch.cabinClass = mapped;
        changed = true;
      }
    }
    // Sync hotel stars preference from extraction
    if (typeof extractedParams.hotel_stars === "number" && extractedParams.hotel_stars > 0 && extractedParams.hotel_stars !== refinement.hotelStars) {
      patch.hotelStars = extractedParams.hotel_stars;
      changed = true;
    }
    // Sync breakfast preference from extraction
    if (typeof extractedParams.include_breakfast === "boolean" && extractedParams.include_breakfast !== refinement.includeBreakfast) {
      patch.includeBreakfast = extractedParams.include_breakfast;
      changed = true;
    }
    // Sync budget range from extraction
    if (extractedParams.budget_max && extractedParams.budget_max > 0) {
      const newMin = extractedParams.budget_min || 0;
      const newMax = extractedParams.budget_max;
      if (newMin !== refinement.budgetRange[0] || newMax !== refinement.budgetRange[1]) {
        patch.budgetRange = [newMin, newMax];
        changed = true;
      }
    }
    if (changed) {
      refinementSyncedRef.current = true;
      setRefinement(prev => ({ ...prev, ...patch }));
    }
  }, [extractedParams]);

  // ── Fetch city intro as soon as destination is known (any stage) ──
  useEffect(() => {
    const dest = extractedParams?.destination_city || extractedParams?.destination_country;
    if (!dest) { dispatch({ type: "SET_CITY_INTRO", payload: null }); return; }
    // Don't re-fetch for the same city
    if (cityIntroFetchedRef.current === dest.toLowerCase()) return;
    cityIntroFetchedRef.current = dest.toLowerCase();
    dispatch({ type: "SET_CITY_INTRO_LOADING", payload: true });
    supabase.functions.invoke("generate-city-intro", { body: { city: dest, country: extractedParams?.destination_country } })
      .then(({ data }) => {
        if (data?.success && data.intro) {
          dispatch({ type: "SET_CITY_INTRO", payload: data.intro });
        }
      })
      .catch(() => {})
      .finally(() => dispatch({ type: "SET_CITY_INTRO_LOADING", payload: false }));
  }, [extractedParams]);

  // ── Fetch route intelligence when origin + destination are known ──
  useEffect(() => {
    const dest = extractedParams?.destination_city || extractedParams?.destination_country;
    const orig = extractedParams?.origin_city;
    if (!dest || !orig) { dispatch({ type: "SET_ROUTE_INTEL", payload: null }); return; }
    const key = `${orig.toLowerCase()}_${dest.toLowerCase()}`;
    if (routeIntelFetchedRef.current === key) return;
    routeIntelFetchedRef.current = key;
    dispatch({ type: "SET_ROUTE_INTEL_LOADING", payload: true });
    supabase.functions.invoke("route-intelligence", {
      body: {
        origin_city: orig,
        destination_city: dest,
        origin_code: "",
        destination_code: "",
      },
    })
      .then(({ data }) => {
        if (data?.success && data.intel) dispatch({ type: "SET_ROUTE_INTEL", payload: data.intel });
      })
      .catch(() => {})
      .finally(() => dispatch({ type: "SET_ROUTE_INTEL_LOADING", payload: false }));
  }, [extractedParams]);

  // ── Smart generation progress stepper managed by useTripSearch hook ──

  // ── Resolve hotel image from DB when searched results lack images ──
  useEffect(() => {
    const hotelName = structuredItinerary?.selected_hotel?.name;
    const selectedRoomType = userSelectedHotel?.roomType || userSelectedHotel?.room_type || structuredItinerary?.selected_hotel?.room_type;
    if (!hotelName) {
      dispatch({ type: "SET_RESOLVED_HOTEL_IMAGE", payload: "" });
      resolvedHotelImageRef.current = "";
      return;
    }

    const directImage = getPreferredHotelCardImage(userSelectedHotel || structuredItinerary?.selected_hotel, selectedRoomType);
    if (directImage) {
      dispatch({ type: "SET_RESOLVED_HOTEL_IMAGE", payload: directImage });
      return;
    }

    const fromSearch = findHotelImage(hotelName, allSearchedHotels, selectedRoomType);
    if (fromSearch) { dispatch({ type: "SET_RESOLVED_HOTEL_IMAGE", payload: fromSearch }); return; }
    if (resolvedHotelImageRef.current === hotelName) return;
    resolvedHotelImageRef.current = hotelName;
    dispatch({ type: "SET_RESOLVED_HOTEL_IMAGE", payload: "" });

    // Hotel featured image only from DB; room image remains the explicit backup.
    const tryTripjack = async () => {
      const { data } = await supabase.from("tripjack_hotels")
        .select("hero_image_url, image_url")
        .ilike("name", `%${hotelName}%`)
        .eq("is_deleted", false)
        .limit(1);
      if (data?.[0]) return getHotelImg(data[0]);
      return null;
    };

    const tryHotelsTable = async () => {
      const { data } = await supabase.from("hotels")
        .select("image")
        .ilike("name", `%${hotelName}%`)
        .limit(1);
      if (data?.[0]?.image) return data[0].image;
      return null;
    };

    (async () => {
      const img = await tryTripjack() || await tryHotelsTable() || getSelectedRoomImg(userSelectedHotel || structuredItinerary?.selected_hotel, selectedRoomType);
      if (img) dispatch({ type: "SET_RESOLVED_HOTEL_IMAGE", payload: img });
    })();
  }, [structuredItinerary?.selected_hotel, userSelectedHotel, allSearchedHotels]);

  // ── Populate aiRecommendedHotelsByCity from itinerary on first load ──
  useEffect(() => {
    if (!structuredItinerary) return;
    const rec: Record<string, string> = {};
    const selHotels = structuredItinerary.selected_hotels || [];
    if (selHotels.length > 0) {
      for (const sh of selHotels) {
        const city = (sh.city || "").toLowerCase();
        if (city && sh.name) rec[city] = sh.name;
      }
    } else if (structuredItinerary.selected_hotel) {
      const sh = structuredItinerary.selected_hotel;
      const city = (sh.city || structuredItinerary.destination || "").toLowerCase();
      if (city && sh.name) rec[city] = sh.name;
    }
    if (Object.keys(rec).length > 0) {
      dispatch({ type: "SET_AI_RECOMMENDED_HOTELS", payload: rec });
    }
  }, [structuredItinerary?.selected_hotels, structuredItinerary?.selected_hotel]);

  const handleNewTrip = useCallback(() => {
    chatHandleNewTrip(() => {
      resetSearchState();
      dispatch({ type: "RESET_UI" });
      cityIntroFetchedRef.current = "";
      routeIntelFetchedRef.current = "";
      hotelFullLoadDoneRef.current = "";
      activityFullLoadDoneRef.current = "";
      resolvedHotelImageRef.current = "";
    });
  }, [chatHandleNewTrip, resetSearchState, dispatch]);

  // Persist searched flights/hotels to sessionStorage so they survive reloads
  useEffect(() => {
    if (allSearchedFlights.length > 0) saveCachedSearchedFlights(allSearchedFlights);
  }, [allSearchedFlights]);
  useEffect(() => {
    if (allSearchedHotels.length > 0) saveCachedSearchedHotels(allSearchedHotels);
  }, [allSearchedHotels]);
  useEffect(() => {
    if (Object.keys(hotelsByCity).length > 0) saveCachedHotelsByCity(hotelsByCity);
  }, [hotelsByCity]);

  // Show toast when resuming a cached session
   useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = location.state as { initialQuery?: string } | null;
    if (state?.initialQuery && !initialSent.current) {
      initialSent.current = true;
      sendMessage(state.initialQuery);
    }
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  // sendMessage is now provided by useTripSearch hook

  // ── Display itinerary (extracted to useDisplayItinerary hook) ──
  const { displayItinerary } = useDisplayItinerary({
    structuredItinerary, messages, refinement,
    allSearchedFlights, allSearchedHotels, allSearchedActivities,
    userSelectedFlight, userSelectedFlightsByLeg,
    userSelectedHotel, userSelectedHotelsByCity,
    userSelectedActivities, dayActivityOverrides,
    currency, extractedParams,
  });

  // ── Holiday awareness ──
  const tripDestCountries = useMemo(() => {
    const countries: string[] = [];
    if (extractedParams?.destination_country) countries.push(extractedParams.destination_country);
    if (extractedParams?.destination_countries) countries.push(...extractedParams.destination_countries);
    if (extractedParams?.cities) {
      for (const c of extractedParams.cities) {
        if (c.country && !countries.includes(c.country)) countries.push(c.country);
      }
    }
    return countries;
  }, [extractedParams]);

  // Build city→country map for holiday filtering on multi-city trips
  const cityCountryMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (extractedParams?.cities) {
      for (const c of extractedParams.cities) {
        if (c.name && c.country) {
          map[c.name] = c.country;
          map[c.name.toLowerCase()] = c.country;
        }
      }
    }
    return map;
  }, [extractedParams]);

  const { getHolidaysForDay } = useTripHolidays(
    extractedParams?.depart_date,
    displayItinerary?.duration_days,
    tripDestCountries,
    cityCountryMap
  );

  const tripSourceCurrency = displayItinerary?.budget_estimate?.currency || currency;
  const formatTripPrice = useCallback(
    (amount: number) => formatFromSource(amount, tripSourceCurrency),
    [formatFromSource, tripSourceCurrency]
  );

  // Keep PDF ref in sync with displayItinerary
  useEffect(() => { pdfItineraryRef.current = displayItinerary || null; }, [displayItinerary]);

  // ── Seed transfers from backend response ──
  useEffect(() => {
    if (backendResolvedTransfers.length > 0 && !transferSeededRef.current) {
      transferSeededRef.current = true;
      seedTransfers(backendResolvedTransfers);
      // Build initial hotel signature for change detection
      if (displayItinerary?.days) {
        const sig = [
          ...(displayItinerary.selected_hotels || []).map((h: any) => `${h._searchCity || h.city || ""}:${h.name || ""}`),
          ...displayItinerary.days.map((d: any) => `${d.city || d.location || ""}:${d.hotel?.name || d.selected_hotel?.name || ""}`),
        ].join("|");
        transferResolvedRef.current = sig;
      }
    }
  }, [backendResolvedTransfers, seedTransfers, displayItinerary]);

  // ── Re-resolve transfers on hotel override (user swaps hotel) ──
  useEffect(() => {
    if (!displayItinerary?.days || displayItinerary.days.length === 0) return;
    // Skip if backend hasn't seeded yet
    if (backendResolvedTransfers.length > 0 && !transferSeededRef.current) return;

    const hotelSignature = [
      ...(displayItinerary.selected_hotels || []).map((h: any) => `${h._searchCity || h.city || ""}:${h.name || ""}`),
      ...displayItinerary.days.map((d: any) => `${d.city || d.location || d.arrival_city || ""}:${d.hotel?.name || d.selected_hotel?.name || ""}`),
    ].join("|");

    // Only re-resolve if hotel signature actually changed (user swapped a hotel)
    if (transferResolvedRef.current === hotelSignature) return;
    if (!transferResolvedRef.current) { transferResolvedRef.current = hotelSignature; return; }
    transferResolvedRef.current = hotelSignature;

    console.log("[Transfers] Hotel change detected — re-resolving transfers");
    const needs = extractTransferNeeds(displayItinerary);
    if (needs.length > 0) {
      resolveTransfers({
        transfers: needs,
        currency,
        available_products: allSearchedActivities,
      });
    } else {
      clearTransfers();
    }
  }, [
    displayItinerary?.selected_hotel?.name,
    JSON.stringify((displayItinerary?.selected_hotels || []).map((h: any) => `${h._searchCity || h.city || ""}:${h.name || ""}`)),
    JSON.stringify((displayItinerary?.days || []).map((d: any) => `${d.city || d.location || d.arrival_city || ""}:${d.hotel?.name || d.selected_hotel?.name || ""}`)),
    resolveTransfers,
    clearTransfers,
    currency,
    allSearchedActivities,
    backendResolvedTransfers,
  ]);

  // Day editing helpers extracted to useTripDayEditor hook (imported above)

  return (
    <Layout>
      {/*
        Hybrid skin: force the planner into its `light` theme tokens and lay
        a subtle editorial backdrop (dotted grid + brand glow) underneath
        so the planner body reads as the same Hybrid surface used on
        /flights and /hotels. We keep the existing planner theme system
        intact for non-Hybrid skins so the dark cockpit aesthetic is
        preserved on Travel Vela / B2C tenants.
      */}
      <div
        data-planner-theme={isHybrid ? "light" : ui.plannerTheme}
        className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden relative"
        style={{ backgroundColor: `hsl(var(--p-bg))` }}
      >
        {isHybrid && (
          <>
            {/* dotted editorial grid */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-[0.05]"
              style={{
                backgroundImage:
                  "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* warm brand glow */}
            <div
              aria-hidden
              className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 70%)",
              }}
            />
            <div
              aria-hidden
              className="absolute -bottom-40 -left-32 w-[26rem] h-[26rem] rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--accent) / 0.14) 0%, transparent 70%)",
              }}
            />
          </>
        )}
        {/* Compact Header Bar */}
        <div className="relative shrink-0 overflow-hidden border-b" style={{ backgroundColor: `hsl(var(--p-surface))`, borderColor: `hsl(var(--p-border))` }}>
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute top-2 left-[10%] w-16 h-16 border rounded-full" style={{ borderColor: `hsl(var(--p-border))` }} />
            <div className="absolute bottom-1 right-[15%] w-10 h-10 border rounded-full" style={{ borderColor: `hsl(var(--p-border))` }} />
          </div>
          <div className="container mx-auto px-4 py-3 relative">
            {/* ── MOBILE HEADER: Back + Title + Past Trips ── */}
            <div className="flex sm:hidden items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95"
                style={{ backgroundColor: `hsl(var(--p-card))`, border: `1px solid hsl(var(--p-border-strong))` }}
              >
                <ChevronDown className="w-4 h-4 rotate-90" style={{ color: `hsl(var(--p-text-muted))` }} />
              </button>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ border: `1px solid hsl(var(--primary) / 0.25)`, boxShadow: `0 0 10px hsl(var(--primary) / 0.1)` }}>
                  {bot.avatarUrl ? (<img src={bot.avatarUrl} alt={bot.name} className="w-full h-full object-contain p-0.5" />) : (<div className="w-full h-full grid place-items-center text-primary-foreground font-bold" style={{background:"linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.78) 100%)"}}>{bot.initials}</div>)}
                </div>
                <div>
                  <h1 className="text-sm font-bold leading-tight" style={{ color: `hsl(var(--p-text))` }}>{bot.name}</h1>
                  <p className="text-[10px]" style={{ color: `hsl(var(--p-text-subtle))` }}>{bot.tagline}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-[10px] gap-1.5 h-8 px-2.5 transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                style={{
                  backgroundColor: `hsl(var(--p-card))`,
                  borderColor: `hsl(var(--p-border-strong))`,
                  color: `hsl(var(--p-text-muted))`,
                }}
              >
                <Clock className="w-3 h-3" />
                {history.length > 0 ? "View past trip" : "Past Trips"}
                {history.length > 0 && (
                  <span className="bg-primary/30 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold">{history.length}</span>
                )}
              </Button>
            </div>

            {/* ── DESKTOP HEADER ── */}
            <div className="hidden sm:flex items-center gap-3">
              <BotAvatar size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-4 h-px" style={{ backgroundColor: `hsl(var(--primary) / 0.6)` }} />
                  <span
                    className="text-[9px] uppercase font-semibold tracking-[0.22em]"
                    style={{ color: `hsl(var(--primary))` }}
                  >
                    AI Concierge
                  </span>
                </div>
                <h1
                  className="text-lg font-semibold leading-tight planner-text tracking-tight"
                  style={{ color: `hsl(var(--p-text))`, fontFamily: "var(--font-heading, inherit)" }}
                >
                  {bot.name}
                </h1>
                <p className="text-[11px] planner-text-subtle" style={{ color: `hsl(var(--p-text-subtle))` }}>{bot.tagline}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Theme toggle — hidden on Hybrid skin (theme is locked to editorial light) */}
                {!isHybrid && (
                <button
                  onClick={cyclePlannerTheme}
                  className="h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                  style={{
                    backgroundColor: `hsl(var(--p-card))`,
                    borderColor: `hsl(var(--p-border-strong))`,
                    color: `hsl(var(--p-text-muted))`,
                    border: '1px solid',
                  }}
                  title={`Theme: ${ui.plannerTheme}`}
                >
                  {ui.plannerTheme === "light" ? (
                    <Sun className="w-3.5 h-3.5" />
                  ) : (
                    <Moon className="w-3.5 h-3.5" />
                  )}
                </button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[11px] gap-1.5 h-8 px-3 transition-all duration-200 hover:border-primary/40 hover:text-primary hover:bg-primary/5 hover:shadow-sm"
                  style={{
                    backgroundColor: `hsl(var(--p-card))`,
                    borderColor: `hsl(var(--p-border-strong))`,
                    color: `hsl(var(--p-text-muted))`,
                  }}
                >
                  <Clock className="w-3 h-3" />
                  {history.length > 0 ? "View past trip" : "Past Trips"}
                  {history.length > 0 && (
                    <span className="ml-0.5 bg-primary/30 text-primary rounded-full px-1.5 py-0.5 text-[9px] font-bold">{history.length}</span>
                  )}
                </Button>
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewTrip}
                    className="text-[11px] gap-1 h-8 px-2.5 transition-all duration-200 hover:border-primary/40 hover:text-primary hover:bg-primary/5 hover:shadow-sm"
                    style={{
                      backgroundColor: `hsl(var(--p-card))`,
                      borderColor: `hsl(var(--p-border-strong))`,
                      color: `hsl(var(--p-text-muted))`,
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    New
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Past Trips History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-b shrink-0 planner-surface planner-border"
              style={{ backgroundColor: `hsl(var(--p-surface))`, borderColor: `hsl(var(--p-border))` }}
            >
              <div className="container mx-auto px-4 max-w-4xl py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Past Conversations
                  </p>
                  <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No past conversations yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {history.map((entry) => {
                      const msgCount = entry.messages.length;
                      const timeAgo = (() => {
                        const diff = Date.now() - entry.timestamp;
                        const mins = Math.floor(diff / 60000);
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        const days = Math.floor(hrs / 24);
                        return `${days}d ago`;
                      })();
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:border-primary/20"
                          style={{ borderColor: `hsl(var(--p-border))`, backgroundColor: `hsl(var(--p-card))` }}
                          onClick={() => handleLoadConversation(entry)}
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
                            <p className="text-[10px] text-muted-foreground">{msgCount} messages · {timeAgo}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteConversation(entry.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SPLIT LAYOUT: Single column mobile | 60/40 desktop ── */}
        <div className={cn("flex-1 flex flex-col lg:flex-row", displayItinerary ? "overflow-y-auto lg:overflow-hidden" : "overflow-hidden")}>

          {/* ── LEFT PANEL: Chat ── */}
          <div className={cn("flex-1 lg:w-[60%] lg:max-w-[60%] flex flex-col relative", displayItinerary ? "lg:overflow-hidden" : "overflow-hidden")} style={{ background: `linear-gradient(180deg, hsl(var(--p-surface)) 0%, hsl(var(--p-bg)) 40%, hsl(var(--p-bg)) 100%)` }}>
            {/* Aurora background effect */}
            <div className="planner-aurora" />
            <div className="planner-mesh" />
            <div className="planner-noise" />
            {/* Subtle vignette for depth */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, transparent 40%, hsl(var(--p-bg) / 0.6) 100%)` }} />
            {/* Chat messages */}
            <div ref={chatContainerRef} className={cn("flex-1 px-4 sm:px-6 py-4", displayItinerary ? "lg:overflow-y-auto" : "overflow-y-auto")}>
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center px-2 relative"
                >
                  {/* Ambient background — desktop only */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden hidden sm:block">
                    <motion.div
                      animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.1, 0.06] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full"
                      style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)` }}
                    />
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.04, 0.07, 0.04] }}
                      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                      className="absolute top-[35%] left-[55%] -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full"
                      style={{ background: `radial-gradient(circle, hsl(var(--accent) / 0.1) 0%, transparent 70%)` }}
                    />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: 0.04 }}>
                      <path d="M 15 65 Q 50 25 85 60" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" style={{ color: `hsl(var(--p-text-muted))` }} />
                      <path d="M 25 75 Q 55 40 80 45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 10" style={{ color: `hsl(var(--primary))` }} />
                    </svg>
                    {/* Floating particles — subtle depth */}
                    {[
                      { x: '18%', y: '58%', delay: 0, size: 3, drift: -8 },
                      { x: '82%', y: '52%', delay: 1, size: 2.5, drift: 6 },
                      { x: '45%', y: '30%', delay: 2.5, size: 2, drift: -10 },
                      { x: '70%', y: '72%', delay: 1.5, size: 2, drift: 8 },
                      { x: '30%', y: '42%', delay: 3, size: 1.5, drift: -6 },
                      { x: '55%', y: '65%', delay: 0.8, size: 2, drift: 12 },
                      { x: '15%', y: '35%', delay: 2, size: 1.5, drift: -14 },
                      { x: '85%', y: '38%', delay: 3.5, size: 2.5, drift: 10 },
                    ].map((dot, i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.06, 0.25, 0.06], scale: [0.8, 1.2, 0.8], y: [0, dot.drift, 0] }}
                        transition={{ duration: 5 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: dot.delay }}
                        className="absolute rounded-full"
                        style={{ left: dot.x, top: dot.y, width: dot.size, height: dot.size, backgroundColor: i % 3 === 0 ? `hsl(var(--primary))` : i % 3 === 1 ? `hsl(var(--accent))` : `hsl(var(--p-text-muted))` }}
                      />
                    ))}
                  </div>

                  {/* ── MOBILE HERO: Clean & focused ── */}
                  <div className="relative sm:hidden w-full max-w-sm">
                    <div className="flex items-center justify-center gap-2.5 mb-3">
                      <div className="relative">
                        <motion.div
                          animate={{ opacity: [0.2, 0.4, 0.2] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute -inset-2 rounded-xl"
                          style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)` }}
                        />
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden" style={{ border: `1px solid hsl(var(--primary) / 0.3)`, boxShadow: `0 0 14px hsl(var(--primary) / 0.15)` }}>
                          {bot.avatarUrl ? (<img src={bot.avatarUrl} alt={bot.name} className="w-full h-full object-contain p-0.5" />) : (<div className="w-full h-full grid place-items-center text-primary-foreground font-bold" style={{background:"linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.78) 100%)"}}>{bot.initials}</div>)}
                        </div>
                      </div>
                      <h2 className="text-base font-bold" style={{ color: `hsl(var(--p-text))` }}>
                        {`Plan your trip with ${bot.name}`}
                      </h2>
                    </div>
                    <p className="text-[11px] mb-5" style={{ color: `hsl(var(--p-text-subtle))` }}>
                      Tell me where, when & budget — I'll find flights, hotels & activities.
                    </p>
                    <button
                      onClick={() => inputRef.current?.focus()}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98]"
                      style={{
                        backgroundColor: `hsl(var(--p-card))`,
                        borderColor: `hsl(var(--p-border-strong))`,
                        boxShadow: `0 0 0 2px hsl(var(--primary) / 0.1), 0 4px 16px hsl(var(--p-shadow))`,
                      }}
                    >
                      <Sparkles className="w-5 h-5 text-primary shrink-0" />
                      <span className="text-sm text-left" style={{ color: `hsl(var(--p-text-subtle))` }}>
                        Describe your trip — e.g. 5 days in Dubai under ৳60,000
                      </span>
                    </button>

                    {/* High-intent suggestion chips */}
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-5 mb-2.5" style={{ color: `hsl(var(--p-text-faint))` }}>
                      Try one of these
                    </p>
                    <div className="space-y-2">
                      {tripSuggestions.map((s, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.08 }}
                          onClick={() => sendMessage(s.text)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98] active:bg-primary/10"
                          style={{
                            borderColor: `hsl(var(--p-border-strong))`,
                            backgroundColor: `hsl(var(--p-card))`,
                          }}
                        >
                          <span className="text-base shrink-0">{s.emoji}</span>
                          <span className="text-[12px] font-medium" style={{ color: `hsl(var(--p-text) / 0.85)` }}>{s.text}</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: `hsl(var(--p-text-faint))` }} />
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* ── DESKTOP HERO: Full experience ── */}
                  <div className="relative hidden sm:flex flex-col items-center">
                    {/* Subtle ambient depth glow behind hero */}
                    <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 50% at 50% 30%, hsl(var(--p-glow-primary) / 0.06) 0%, transparent 60%), radial-gradient(circle at 25% 60%, hsl(var(--p-aurora-2)) 0%, transparent 50%), radial-gradient(circle at 75% 70%, hsl(var(--p-aurora-3)) 0%, transparent 45%)` }} />
                    {/* Floating micro-particles — premium depth */}
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={`particle-${i}`}
                        className="absolute rounded-full pointer-events-none"
                        style={{
                          width: `${1.5 + (i % 4)}px`,
                          height: `${1.5 + (i % 4)}px`,
                          left: `${10 + i * 11}%`,
                          top: `${15 + (i % 4) * 18}%`,
                          backgroundColor: i % 3 === 0 ? `hsl(var(--primary) / 0.35)` : i % 3 === 1 ? `hsl(var(--accent) / 0.25)` : `hsl(280 70% 65% / 0.2)`,
                        }}
                        animate={{
                          y: [0, -15 - i * 2, 0],
                          x: [0, (i % 2 === 0 ? 8 : -8), 0],
                          opacity: [0.1, 0.6, 0.1],
                          scale: [0.8, 1.3, 0.8],
                        }}
                        transition={{
                          duration: 5 + i * 0.8,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.4,
                        }}
                      />
                    ))}
                    <div className="relative mb-5">
                      {/* Multi-layered glow rings */}
                      <motion.div
                        animate={{ opacity: [0.15, 0.4, 0.15], scale: [0.92, 1.08, 0.92] }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -inset-4 rounded-3xl"
                        style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.06) 50%, transparent 70%)` }}
                      />
                      <motion.div
                        animate={{ opacity: [0.08, 0.18, 0.08] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                        className="absolute -inset-8 rounded-[2rem]"
                        style={{ background: `radial-gradient(circle, hsl(var(--accent) / 0.1) 0%, hsl(280 70% 60% / 0.04) 50%, transparent 65%)` }}
                      />
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden" style={{ border: `1px solid hsl(var(--primary) / 0.25)`, boxShadow: `0 0 30px hsl(var(--primary) / 0.2), 0 8px 24px hsl(var(--p-shadow)), inset 0 1px 0 hsl(var(--p-text) / 0.08)` }}>
                        {bot.avatarUrl ? (<img src={bot.avatarUrl} alt={bot.name} className="w-full h-full object-contain p-0.5" />) : (<div className="w-full h-full grid place-items-center text-primary-foreground font-bold" style={{background:"linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.78) 100%)"}}>{bot.initials}</div>)}
                      </div>
                    </div>
                    <h2 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: `hsl(var(--p-text))` }}>
                      <span>Plan your perfect trip</span>
                    </h2>
                    <p className="text-xs max-w-xs mb-3 leading-relaxed" style={{ color: `hsl(var(--p-text-subtle))` }}>
                      Tell me where, when & budget — I'll find flights, hotels & build your itinerary in seconds.
                    </p>

                    {/* Live capability badges */}
                    <div className="flex items-center gap-3 mb-6">
                      {[
                        { icon: Plane, label: "Live flight prices" },
                        { icon: Hotel, label: "Real-time hotel deals" },
                        { icon: CalendarIcon, label: "Smart itinerary" },
                      ].map((cap, i) => (
                        <motion.div
                          key={cap.label}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                          style={{
                            backgroundColor: `hsl(var(--p-card))`,
                            border: `1px solid hsl(var(--p-border))`,
                            color: `hsl(var(--p-text-muted))`,
                          }}
                        >
                          <cap.icon className="w-3 h-3 text-primary/70" />
                          {cap.label}
                        </motion.div>
                      ))}
                    </div>

                    <p className="text-[9px] font-medium uppercase tracking-widest mb-2.5 opacity-50" style={{ color: `hsl(var(--p-text-faint))` }}>or try a popular idea</p>
                    <div className="grid grid-cols-2 gap-2 max-w-sm w-full">
                      {tripSuggestions.map((s, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 200 }}
                          onClick={() => sendMessage(s.text)}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className="text-left px-4 py-3.5 rounded-xl transition-all duration-200 group backdrop-blur-sm planner-suggestion border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                          style={{
                            borderColor: `hsl(var(--p-border-strong))`,
                            backgroundColor: `hsl(var(--p-card))`,
                            backgroundImage: `linear-gradient(135deg, hsl(var(--p-card)) 0%, hsl(var(--p-card-alt)) 100%)`,
                            boxShadow: `0 2px 8px hsl(var(--p-shadow))`,
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base drop-shadow-sm">{s.emoji}</span>
                            <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate" style={{ color: `hsl(var(--p-text))` }}>{s.text}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3 sm:space-y-4 pb-4">
                  {messages.map((msg, i) => {
                    const isUser = msg.role === "user";
                    const itinerary = !isUser ? parseItinerary(msg.content) : null;
                    const textContent = !isUser ? getTextContent(msg.content) : msg.content;
                    const hasItinerary = !!itinerary;

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={cn(
                          "flex",
                          /* Mobile: full-width stacked, no side avatars */
                          "flex-col sm:flex-row sm:gap-2.5",
                          isUser ? "items-end sm:justify-end" : "items-start sm:justify-start"
                        )}
                      >
                        {/* AI avatar — desktop only */}
                        {!isUser && (
                          <div className="hidden sm:block w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 mt-1" style={{ borderColor: `hsl(var(--primary) / 0.3)`, border: '1px solid', boxShadow: `0 0 14px hsl(var(--primary) / 0.15), 0 0 30px hsl(var(--primary) / 0.06)` }}>
                            <BotAvatar size="sm" ringed={false} className="!border-0 !shadow-none" />
                          </div>
                        )}
                        {/* Mobile: inline sender label */}
                        {!isUser && (
                          <div className="flex items-center gap-1.5 mb-1 sm:hidden">
                            <div className="w-5 h-5 rounded-md overflow-hidden" style={{ border: `1px solid hsl(var(--primary) / 0.2)` }}>
                              <BotAvatar size="xs" ringed={false} className="!border-0 !shadow-none" />
                            </div>
                            <span className="text-[10px] font-semibold" style={{ color: `hsl(var(--p-text-muted))` }}>{bot.shortName}</span>
                          </div>
                        )}
                        <div className={cn(
                          "space-y-2",
                          /* Mobile: near full width. Desktop: capped */
                          "w-[92%] sm:w-auto sm:max-w-[70%]",
                          isUser ? "items-end" : "items-start"
                        )}>
                          {textContent && (
                            <div
                              className={cn(
                                "px-4 py-3 text-sm leading-relaxed",
                                isUser
                                  ? "rounded-2xl rounded-br-sm text-white shadow-lg"
                                  : "rounded-2xl rounded-tl-sm backdrop-blur-sm planner-ai-bubble"
                              )}
                              style={isUser ? {
                                background: `linear-gradient(135deg, hsl(217 90% 52%), hsl(217 85% 45%))`,
                                boxShadow: `0 4px 20px hsl(217 90% 50% / 0.25)`,
                              } : {
                                backgroundColor: `hsl(220 30% 20%)`,
                                border: '1px solid hsl(220 22% 28% / 0.5)',
                                color: `hsl(210 30% 94%)`,
                                boxShadow: `0 2px 12px hsl(222 50% 5% / 0.2)`,
                              }}
                            >
                              {isUser ? (
                                <p>{textContent}</p>
                              ) : (
                                <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:leading-relaxed">
                                  <ReactMarkdown>{textContent}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Smart Quick-Reply Action Cards — detect AI question context */}
                          {!isUser && !hasItinerary && !loading &&
                           i === messages.length - 1 &&
                           lastMissingFields.length === 0 && (() => {
                            const t = (textContent || "").toLowerCase();
                            // Skip if AI is already processing/searching
                            if (/let me (?:find|check|pull|build|plan|try|search)|searching|looking up/i.test(t)) return null;

                            type QuickOption = { icon: any; label: string; reply: string };

                            // Detect question type and provide contextual options
                            let options: QuickOption[] = [];

                            // 1. Request type (flights/hotels/full trip) — exclude visa/passport/weather context
                            if (/(?:what.*looking for|flight.*hotel.*package|complete.*trip|which.*service|activities.*included)/i.test(t) &&
                                !/(?:visa|passport|embassy|nationality|weather|temperature)/i.test(t) &&
                                !messages.some((m) => m.role === "user" && /(?:i want (?:flights|hotels|a full trip)|full trip|flights only|hotels only)/i.test(m.content))) {
                              options = [
                                { icon: Plane, label: "✈️ Flights Only", reply: "I want flights only" },
                                { icon: Hotel, label: "🏨 Hotels Only", reply: "I want hotels only" },
                                { icon: Compass, label: "🌍 Full Trip Plan", reply: "I want a full trip plan with flights, hotels and itinerary" },
                              ];
                            }
                            // 2. Travel type (solo/couple/family/etc)
                            // Skip if user already indicated travel type OR if infant/children mentioned (implies family)
                            else if (/(?:solo.*couple|couple.*family|honeymoon|who.*travel|traveling.*with|কি ধরনের|সলো|কাপল)/i.test(t) &&
                                     !messages.some((m) => m.role === "user" && /\b(solo|couple|honeymoon|family|group|business)\b/i.test(m.content)) &&
                                     !messages.some((m) => m.role === "user" && /\b(infant|infants|baby|babies|toddler|child|children|kids)\b/i.test(m.content))) {
                              options = [
                                { icon: UserRound, label: "🧑 Solo", reply: "Solo trip" },
                                { icon: Heart, label: "💑 Couple", reply: "Couple trip" },
                                { icon: Heart, label: "💍 Honeymoon", reply: "Honeymoon" },
                                { icon: Users, label: "👨‍👩‍👧 Family", reply: "Family trip" },
                                { icon: Users, label: "👫 Group", reply: "Group of friends" },
                              ];
                            }
                            // 3. Travel style (budget/comfort/luxury)
                            else if (/(?:budget.*comfort|comfort.*luxury|what.*style|type.*trip|ধরনের ট্রিপ|budget.*luxury)/i.test(t) &&
                                     !messages.some((m) => m.role === "user" && /\b(budget|comfortable|luxury|mid-range)\b/i.test(m.content))) {
                              options = [
                                { icon: Wallet, label: "💰 Budget", reply: "Budget-friendly trip" },
                                { icon: Star, label: "⭐ Comfortable", reply: "Mid-range comfortable trip" },
                                { icon: Crown, label: "👑 Luxury", reply: "Luxury trip" },
                              ];
                            }

                            if (options.length === 0) return null;

                            return (
                              <motion.div
                                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-wrap gap-1.5 mt-2"
                              >
                                {options.map((opt) => (
                                  <button
                                    key={opt.label}
                                    onClick={() => sendMessage(opt.reply)}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-2 rounded-xl border backdrop-blur-sm",
                                      "hover:scale-[1.03] active:scale-[0.97] transition-all duration-150 cursor-pointer",
                                      "text-[12px] font-semibold"
                                    )}
                                    style={{
                                      backgroundColor: `hsl(var(--p-card-alt))`,
                                      borderColor: `hsl(var(--primary) / 0.2)`,
                                      color: `hsl(var(--p-text))`,
                                      boxShadow: `0 2px 8px hsl(var(--p-shadow))`,
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </motion.div>
                            );
                          })()}

                          {hasItinerary && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/[0.06] border border-accent/15 text-xs backdrop-blur-sm">
                              <MapPin className="w-3.5 h-3.5 text-accent" />
                              <span className="font-medium text-foreground">{itinerary!.trip_title}</span>
                              <span className="hidden sm:inline text-muted-foreground">→ View in results panel</span>
                              <ChevronRight className="w-3 h-3 text-accent sm:hidden" />
                            </div>
                          )}
                        </div>
                        {/* User avatar — desktop only */}
                        {isUser && (
                          <div className="hidden sm:flex w-7 h-7 rounded-lg bg-primary/15 items-center justify-center flex-shrink-0 mt-1 border border-primary/20">
                            <Users className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Interactive traveler/style picker */}
                  {!loading && lastMissingFields.length > 0 && (
                    <TravelerStylePicker onSubmit={(text, triggerSearch) => { setLastMissingFields([]); sendMessage(text, triggerSearch); }} loading={loading} missingFields={lastMissingFields} />
                  )}
                  {/* Trip Details Form Card — shown when hybrid preview needs more info */}
                  {!loading && hybridPreviewData && !structuredItinerary && hybridPreviewData.missing_for_exact_pricing.length > 0 && (
                    <TripDetailsFormCard
                      missingFields={hybridPreviewData.missing_for_exact_pricing}
                      destination={hybridPreviewData.destination}
                      onSubmit={(text) => {
                        setHybridPreviewData(null);
                        sendMessage(text);
                      }}
                    />
                  )}
                  {/* Loading state — uses real-time progressive data */}
                  {loading && (isSearching ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2.5 max-w-md"
                    >
                      <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0" style={{ borderColor: `hsl(var(--p-border-strong))`, border: '1px solid' }}>
                        <BotAvatar size="sm" ringed={false} className="!border-0 !shadow-none" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="rounded-2xl rounded-bl-sm px-4 py-2.5 backdrop-blur-sm" style={{ backgroundColor: `hsl(var(--p-card-alt))`, borderColor: `hsl(var(--p-border))`, border: '1px solid' }}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inset-0 rounded-full bg-primary/40" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                            </span>
                            <span className="text-[11px] font-bold" style={{ color: `hsl(var(--p-text))` }}>✨ Planning your trip…</span>
                          </div>
                        </div>
                        <div className="space-y-0.5 ml-1">
                          {[
                            { done: progressiveFlights !== null, count: progressiveFlights?.length || 0, doneText: (c: number) => `${c} flight${c !== 1 ? 's' : ''} found`, pendingText: "Searching flights", emoji: "✈️" },
                            { done: progressiveHotels !== null, count: progressiveHotels?.length || 0, doneText: (c: number) => `${c} hotel${c !== 1 ? 's' : ''} found`, pendingText: "Checking availability", emoji: "🏨" },
                            { done: progressiveActivities !== null, count: progressiveActivities?.length || 0, doneText: (c: number) => `${c} experience${c !== 1 ? 's' : ''} found`, pendingText: "Discovering experiences", emoji: "🗺️" },
                          ].map((item, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 + idx * 0.12 }}
                              className="flex items-center gap-2 px-4 py-1"
                            >
                              {item.done ? (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[10px]">✅</motion.span>
                              ) : (
                                <span className="flex items-center gap-[3px]">
                                  {[0, 1, 2].map(i => (
                                    <motion.span
                                      key={i}
                                      className="w-[5px] h-[5px] rounded-full bg-primary"
                                      animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                                    />
                                  ))}
                                </span>
                              )}
                              <span className="text-[10px] font-medium" style={{ color: item.done ? `hsl(var(--p-text))` : `hsl(var(--p-text-muted))` }}>
                                {item.done ? `${item.emoji} ${item.doneText(item.count)}` : `${item.emoji} ${item.pendingText}`}
                              </span>
                            </motion.div>
                          ))}
                          <AnimatePresence>
                            {progressiveFlights !== null && progressiveHotels !== null && progressiveActivities !== null && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-1">
                                <Sparkles className="w-3 h-3" style={{ color: `hsl(var(--primary))` }} />
                                <span className="text-[10px] font-bold" style={{ color: `hsl(var(--primary))` }}>Building itinerary…</span>
                                <div className="flex items-center gap-[3px] ml-auto">
                                  {[0, 1, 2].map(i => (
                                    <motion.span key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: `hsl(var(--primary))` }}
                                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.3, 0.7] }}
                                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2.5 max-w-md"
                    >
                      <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0" style={{ borderColor: `hsl(var(--p-border-strong))`, border: '1px solid' }}>
                        <BotAvatar size="sm" ringed={false} className="!border-0 !shadow-none" />
                      </div>
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3 backdrop-blur-sm" style={{ backgroundColor: `hsl(var(--p-card-alt))`, borderColor: `hsl(var(--p-border))`, border: '1px solid' }}>
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map(i => (
                            <motion.span
                              key={i}
                              className="w-[6px] h-[6px] rounded-full bg-primary"
                              animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* AI Thinking State — shows when user is typing */}
            <AnimatePresence>
              {input.trim().length > 0 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="shrink-0 flex justify-center px-4 sm:px-6 pb-1"
                >
                  <div
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md"
                    style={{
                      backgroundColor: `hsl(var(--p-card) / 0.85)`,
                      border: `1px solid hsl(var(--p-border-strong))`,
                      boxShadow: `0 2px 12px hsl(var(--p-shadow))`,
                    }}
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden shrink-0" style={{ border: `1px solid hsl(var(--p-border))` }}>
                      {bot.avatarUrl ? (<img src={bot.avatarUrl} alt="" className="w-full h-full object-contain p-0.5" />) : (<div className="w-full h-full grid place-items-center text-[8px] text-primary-foreground font-bold bg-primary">{bot.initials}</div>)}
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: `hsl(var(--p-text-muted))` }}>
                      {`${bot.shortName} is planning your trip`}
                    </span>
                    <div className="flex items-center gap-[3px]">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-[3px] h-[3px] rounded-full"
                          style={{ backgroundColor: `hsl(var(--p-text-muted))` }}
                          animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.7, 1.2, 0.7] }}
                          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar — sticky bottom on mobile (no itinerary), inline when results showing, pinned on desktop */}
            <div className={cn("z-20 shrink-0 px-3 sm:px-6 pb-3 pt-3 border-t planner-input-bar", displayItinerary ? "relative" : "sticky bottom-0 safe-area-pb sm:relative")} style={{ background: `linear-gradient(to top, hsl(var(--p-bg)), hsl(var(--p-bg) / 0.95))`, borderColor: `hsl(var(--p-border))` }}>
              {/* Hint text above input — only when empty & no messages */}
              {!input.trim() && messages.length === 0 && !displayItinerary && (
                <p className="text-center text-[10px] mb-2 animate-pulse" style={{ color: `hsl(var(--primary) / 0.6)` }}>
                  💡 Try: "5 days in Dubai under {formatDirectPrice(currency === "BDT" ? 60000 : currency === "CNY" ? 5000 : currency === "EUR" || currency === "GBP" ? 800 : 1000)}"
                </p>
              )}
              <div
                className="relative rounded-xl transition-all duration-300 group/input cursor-text"
                style={{
                  backgroundColor: `hsl(var(--p-input-bg))`,
                  border: '2px solid',
                  borderColor: `hsl(var(--primary) / 0.4)`,
                  boxShadow: `0 0 24px hsl(var(--primary) / 0.15), 0 0 0 1px hsl(var(--primary) / 0.1), 0 6px 28px hsl(var(--p-shadow))`,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  if (!el.contains(document.activeElement)) {
                    el.style.borderColor = `hsl(var(--primary) / 0.6)`;
                    el.style.boxShadow = `0 0 36px hsl(var(--primary) / 0.2), 0 0 0 1px hsl(var(--primary) / 0.15), 0 8px 32px hsl(var(--p-shadow))`;
                    el.style.transform = `translateY(-1px)`;
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  if (!el.contains(document.activeElement)) {
                    el.style.borderColor = `hsl(var(--primary) / 0.4)`;
                    el.style.boxShadow = `0 0 24px hsl(var(--primary) / 0.15), 0 0 0 1px hsl(var(--primary) / 0.1), 0 6px 28px hsl(var(--p-shadow))`;
                    el.style.transform = `translateY(0)`;
                  }
                }}
                onClick={() => inputRef.current?.focus()}
                onFocusCapture={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = `hsl(var(--primary) / 0.85)`;
                  el.style.boxShadow = `0 0 0 4px hsl(var(--primary) / 0.2), 0 0 50px hsl(var(--primary) / 0.2), 0 0 100px hsl(var(--primary) / 0.08), 0 8px 28px hsl(var(--p-shadow))`;
                  el.style.transform = `translateY(-2px)`;
                }}
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    const el = e.currentTarget;
                    el.style.borderColor = `hsl(var(--primary) / 0.4)`;
                    el.style.boxShadow = `0 0 24px hsl(var(--primary) / 0.15), 0 0 0 1px hsl(var(--primary) / 0.1), 0 6px 28px hsl(var(--p-shadow))`;
                    el.style.transform = `translateY(0)`;
                  }
                }}
              >
                <div className="flex items-end gap-1">
                  <div className="pl-3.5 pb-3 flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary/70" />
                  </div>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length === 1) val = val.toUpperCase();
                      else if (val.length >= 2 && /[.!?]\s[a-z]$/.test(val.slice(-3))) {
                        val = val.slice(0, -1) + val.slice(-1).toUpperCase();
                      }
                      setInput(val);
                      const ta = e.target;
                      ta.style.height = 'auto';
                      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                        if (inputRef.current) {
                          inputRef.current.style.height = 'auto';
                        }
                      }
                    }}
                    placeholder={`Describe your trip… e.g. 5 days in Dubai under ${formatDirectPrice(currency === "BDT" ? 60000 : currency === "CNY" ? 5000 : currency === "EUR" || currency === "GBP" ? 800 : 1000)}`}
                    disabled={loading}
                    rows={1}
                    className="flex-1 bg-transparent px-3 py-3 text-sm outline-none resize-none planner-textarea-input overflow-y-auto"
                    style={{ color: `hsl(var(--p-text))`, maxHeight: '120px', overflowY: 'auto' }}
                  />
                  <div className="pr-2 pb-2 flex-shrink-0">
                    <Button
                      onClick={() => {
                        sendMessage();
                        if (inputRef.current) inputRef.current.style.height = 'auto';
                      }}
                      disabled={!input.trim() || loading}
                      size="icon"
                      className="h-9 w-9 rounded-lg bg-primary hover:bg-primary/80 hover:scale-110 text-primary-foreground shrink-0 transition-all duration-200 disabled:opacity-30 disabled:hover:scale-100 disabled:shadow-none"
                      style={{ boxShadow: `0 0 18px hsl(var(--primary) / 0.35), 0 0 40px hsl(var(--primary) / 0.15), 0 2px 8px hsl(var(--primary) / 0.2)` }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-center text-[9px] mt-1.5 hidden sm:block" style={{ color: `hsl(var(--p-text-faint))` }}>
                AI-generated · Prices may vary at time of booking
              </p>
            </div>
          </div>

          {/* ── RIGHT PANEL: Live Results ── */}
          <div className={cn("hidden lg:flex flex-col overflow-hidden relative transition-all duration-700", displayItinerary ? "lg:w-[55%] lg:max-w-[55%]" : "lg:w-[40%] lg:max-w-[40%]")} style={{ backgroundColor: `hsl(var(--p-surface-alt))`, boxShadow: `inset 1px 0 30px hsl(var(--p-shadow)), 0 0 80px hsl(var(--p-glow-primary) / 0.06)` }}>
            {/* Glowing divider line on left edge */}
            <div className="absolute left-0 top-0 bottom-0 w-px z-10" style={{ background: `linear-gradient(180deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--primary) / 0.25) 30%, hsl(var(--primary) / 0.3) 50%, hsl(var(--primary) / 0.25) 70%, hsl(var(--primary) / 0.05) 100%)`, boxShadow: `0 0 8px hsl(var(--primary) / 0.15), 0 0 20px hsl(var(--primary) / 0.08)` }} />
            {/* Multi-layer ambient glow */}
            <div className="absolute inset-0 pointer-events-none transition-opacity duration-700" style={{ opacity: input.trim().length > 0 ? 0.9 : 0.5, background: `radial-gradient(ellipse at 30% 0%, hsl(var(--p-aurora-1)) 0%, transparent 50%), radial-gradient(ellipse at 70% 100%, hsl(var(--p-aurora-2)) 0%, transparent 50%)` }} />
            {/* Aurora effect on right panel */}
            <div className="planner-aurora" style={{ opacity: 0.7 }} />
            <div className="planner-noise" />
            {/* Faint inner border glow */}
            <div className="absolute inset-0 pointer-events-none rounded-none" style={{ boxShadow: `inset 0 1px 0 hsl(var(--p-border-strong) / 0.5), inset 0 -1px 0 hsl(var(--p-border) / 0.3)` }} />

            {/* Panel header */}
            <div className="shrink-0 px-4 py-3 border-b relative" style={{ borderColor: `hsl(var(--p-border))`, background: `linear-gradient(180deg, hsl(var(--p-surface) / 0.95) 0%, hsl(var(--p-surface-alt) / 0.9) 100%)`, backdropFilter: 'blur(12px)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: `hsl(var(--p-text))` }}>
                  <div className="relative">
                    <Zap className="w-4 h-4 text-accent" />
                    <div className="absolute inset-0 animate-ping opacity-20"><Zap className="w-4 h-4 text-accent" /></div>
                  </div>
                  Live Results
                </h3>
                {displayItinerary ? (
                  <span className="text-xs font-semibold text-accent bg-accent/15 rounded-full px-2.5 py-1 flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse" /> Updated
                  </span>
                ) : (
                  <span className="text-xs font-medium flex items-center gap-1.5 transition-all duration-500" style={{ color: loading ? `hsl(var(--primary))` : input.trim().length > 0 ? `hsl(var(--primary))` : `hsl(var(--p-text-subtle))` }}>
                    <span className={cn("w-2 h-2 rounded-full animate-pulse transition-colors duration-500", loading ? "bg-primary" : input.trim().length > 0 ? "bg-primary" : "bg-emerald-400/60")} />
                    {loading ? "Processing…" : input.trim().length > 0 ? "Planning…" : "AI Ready"}
                  </span>
                )}
              </div>
            </div>

            {/* ── TOP CONTROL BAR — only after itinerary is generated ── */}
            {displayItinerary && (
              <TripRefinementControls
                state={refinement}
                onChange={setRefinement}
                onApply={(text, triggerSearch) => sendMessage(text, triggerSearch)}
                loading={loading}
                hasItinerary={!!displayItinerary}
                aiTravelers={aiTravelers}
              />
            )}

            {/* Inspiration / Hybrid Preview — shown in right panel */}
            {!loading && inspirationData && !structuredItinerary && (
              <div className="flex-1 overflow-y-auto px-4 py-5">
                <InspirationView
                  data={inspirationData}
                  onSelectFrame={(frame) => {
                    setInspirationData(null);
                    sendMessage(`I want the ${frame.label} option`);
                  }}
                  onSendMessage={(text) => {
                    setInspirationData(null);
                    sendMessage(text);
                  }}
                />
              </div>
            )}
            {!loading && hybridPreviewData && !structuredItinerary && !inspirationData && (
              <div className="flex-1 overflow-y-auto px-4 py-5">
                <HybridPreviewView
                  data={hybridPreviewData}
                  onGetExactPrice={() => {
                    setHybridPreviewData(null);
                    const missing = hybridPreviewData.missing_for_exact_pricing;
                    if (missing.length > 0) {
                      sendMessage(`My ${missing.map(m => m.toLowerCase()).join(", ")} — let me provide those details`);
                    } else {
                      sendMessage("Get exact prices for this trip");
                    }
                  }}
                  onSendMessage={(text) => {
                    setHybridPreviewData(null);
                    sendMessage(text);
                  }}
                  onCustomize={(field) => {
                    const prompts: Record<string, string> = {
                      "Travel dates": "Let me set my travel dates",
                      "Departure city": "I'll be travelling from",
                      "Number of travelers": "We'll be",
                      "Trip duration": "I want to go for",
                    };
                    sendMessage(prompts[field] || `Let me specify ${field}`);
                  }}
                />
              </div>
            )}

            {displayItinerary ? (
              /* ── TWO-PANEL RESULTS VIEW ── */
              <TripErrorBoundary onReset={() => setStructuredItinerary(null)}>
              <div className="flex-1 flex overflow-hidden">
                {/* Left: Trip Context Sidebar */}
                <div className="hidden xl:flex w-[240px] min-w-[240px] flex-col border-r overflow-hidden" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--p-surface) / 0.95)` }}>
                  <TripContextSidebar
                    destination={displayItinerary.destination}
                    durationDays={displayItinerary.duration_days}
                    adults={displayItinerary.adults || displayItinerary.travelers || 1}
                    children={displayItinerary.children || 0}
                    infants={displayItinerary.infants || 0}
                    rooms={displayItinerary.rooms || 1}
                    totalPrice={(() => {
                      const bd = displayItinerary.budget_estimate.breakdown;
                      const bKeys = ["flights", "hotels", "activities"];
                      return Object.entries(bd).filter(([k]) => bKeys.includes(k) && bd[k] > 0).reduce((s, [, v]) => s + v, 0) + totalTransferCost;
                    })()}
                    formatPrice={formatTripPrice}
                    breakdown={displayItinerary.budget_estimate.breakdown}
                    conversionSummary={displayItinerary.conversion_summary}
                    conversionScore={displayItinerary.conversion_score}
                    included={displayItinerary.included}
                    excluded={displayItinerary.excluded}
                    tips={displayItinerary.tips}
                  />
                  {/* Collaboration Panel */}
                  {savedTripId && (
                    <div className="px-3 py-3 border-t" style={{ borderColor: `hsl(var(--p-border))` }}>
                      <CollaborationPanel
                        collaborators={collaborators}
                        presenceUsers={presenceUsers}
                        isOwner={isOwner}
                        onAdd={addCollaborator}
                        onRemove={removeCollaborator}
                        ownerEmail={user?.email}
                      />
                    </div>
                  )}
                </div>

                {/* Right: Main Results Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <motion.div
                  key={displayItinerary.trip_title}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  {/* ── TRIP OVERVIEW CARD (NEW) ── */}
                  <TripOverviewCard
                    tripTitle={displayItinerary.trip_title}
                    destination={displayItinerary.destination}
                    durationDays={displayItinerary.duration_days}
                    adults={displayItinerary.adults || displayItinerary.travelers || 1}
                    children={displayItinerary.children || 0}
                    infants={displayItinerary.infants || 0}
                    rooms={displayItinerary.rooms || 1}
                    totalPrice={(() => {
                      const bd = displayItinerary.budget_estimate.breakdown;
                      const bKeys = ["flights", "hotels", "activities"];
                      return Object.entries(bd).filter(([k]) => bKeys.includes(k) && bd[k] > 0).reduce((s, [, v]) => s + v, 0) + totalTransferCost;
                    })()}
                    formatPrice={formatTripPrice}
                    conversionSummary={displayItinerary.conversion_summary}
                    conversionScore={displayItinerary.conversion_score}
                    hasLivePrices={displayItinerary.selected_flight?.is_live_price || displayItinerary.selected_hotel?.is_live_price}
                    itineraryCode={itineraryCode}
                  />
                  {/* Debug tag (admin-visible) */}
                  {isAdmin && savedTripId && (
                    <ItineraryDebugTag
                      createdBy="ai"
                      lastModifiedSource={(displayItinerary as any)?.last_modified_source || "ai"}
                      currentVersion={(displayItinerary as any)?.current_version || 1}
                      itineraryCode={itineraryCode}
                      className="px-1"
                    />
                  )}
                  {/* ── AI SUMMARY CARD ── */}
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="rounded-2xl p-4 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(var(--accent) / 0.08) 100%)`,
                      border: `1px solid hsl(var(--primary) / 0.2)`,
                      boxShadow: `0 0 30px hsl(var(--primary) / 0.08), 0 4px 16px hsl(var(--p-shadow))`,
                    }}
                  >
                    {/* Shimmer accent */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_4s_ease-in-out_infinite]" style={{ background: `linear-gradient(90deg, transparent, hsl(var(--primary) / 0.06), transparent)` }} />
                    <div className="flex items-start gap-3 relative">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `hsl(var(--primary) / 0.15)`, border: `1px solid hsl(var(--primary) / 0.25)` }}>
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: `hsl(var(--primary))` }}>AI Summary</p>
                        <p className="text-[15px] font-semibold leading-relaxed" style={{ color: `hsl(var(--p-text))` }}>
                          {(() => {
                            const it = displayItinerary;
                            const dest = it.destination || 'your destination';
                            const days = it.duration_days;
                            const bd = it.budget_estimate?.breakdown || {};
                            const bKeys = ["flights", "hotels", "activities"];
                            const total = Object.entries(bd).filter(([k]) => bKeys.includes(k) && (bd as any)[k] > 0).reduce((s, [, v]) => s + (v as number), 0) + totalTransferCost;
                            const travelerText = formatTravelerBreakdown(it.adults || 1, it.children || 0, it.infants || 0);
                            const parts: string[] = [];
                            if (it.selected_flight) parts.push('flights');
                            if (it.selected_hotel) parts.push('hotel');
                            if (it.days?.length > 0) parts.push('activities');
                            const inclusions = parts.length > 0 ? ` including ${parts.join(', ')}` : '';
                            return total > 0
                              ? `✨ I found a ${days}-day ${dest} trip for ${formatTripPrice(total)} for ${travelerText}${inclusions}.`
                              : `✨ Here's your ${days}-day ${dest} trip plan for ${travelerText}${inclusions}.`;
                          })()}
                        </p>
                        {displayItinerary.duration_days && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--primary) / 0.1)` }}>
                              <CalendarIcon className="w-3 h-3" /> {displayItinerary.duration_days} days
                            </span>
                            {displayItinerary.selected_flight && (
                              <span className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--primary) / 0.1)` }}>
                                <Plane className="w-3 h-3" /> Flight included
                              </span>
                            )}
                            {displayItinerary.selected_hotel && (
                              <span className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--accent) / 0.1)` }}>
                                <Hotel className="w-3 h-3" /> Hotel included
                              </span>
                            )}
                            <span className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1" style={{ color: `hsl(var(--p-text))`, backgroundColor: `hsl(var(--primary) / 0.1)` }}>
                              <Users className="w-3 h-3" /> {formatTravelerBreakdown(displayItinerary.adults || 1, displayItinerary.children || 0, displayItinerary.infants || 0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* ── DECISION LAYER CARDS ── */}
                  <WhyThisPlanCard
                    reasons={displayItinerary.conversion_summary?.why_this_plan_works}
                    tripStyle={displayItinerary.conversion_summary?.trip_style}
                    delay={0.08}
                  />
                  <SmartAlertsCard
                    alerts={displayItinerary.decision_intelligence?.alerts || displayItinerary.decision_layer?.smart_alerts}
                    delay={0.1}
                  />
                  <ConfidenceBadgeRow
                    confidenceMessage={displayItinerary.decision_layer?.confidence_message}
                    conversionScore={displayItinerary.decision_intelligence?.score ?? displayItinerary.conversion_score}
                    hasLivePrices={displayItinerary.selected_flight?.is_live_price || displayItinerary.selected_hotel?.is_live_price}
                    tripStyle={displayItinerary.conversion_summary?.trip_style}
                    backendBadges={displayItinerary.decision_intelligence?.badges}
                    confidenceLabel={displayItinerary.decision_intelligence?.confidence?.label}
                    delay={0.12}
                  />
                  <TopExperiencesCarousel
                    highlights={displayItinerary.conversion_summary?.highlight_experiences}
                    delay={0.14}
                  />

                  {/* ── SECTION 1: FLIGHTS ── */}
                  <DesktopFlightsCard
                    selectedFlight={displayItinerary.selected_flight}
                    displayItinerary={displayItinerary}
                    allSearchedFlights={allSearchedFlights}
                    userSelectedFlight={userSelectedFlight}
                    userSelectedFlightsByLeg={userSelectedFlightsByLeg}
                    formatPrice={formatTripPrice}
                    calcFlightCost={calcFlightCost}
                    getPerAdultPrice={getPerAdultPrice}
                    resolveCity={resolveCity}
                    generateFlightInsight={generateFlightInsight}
                    FlightLegRow={FlightLegRow}
                    onViewDetails={() => dispatch({ type: "SET_FLIGHT_DETAIL_OPEN", payload: true })}
                    onBook={() => {
                      if (displayItinerary.selected_flight.is_live_price) {
                        dispatch({ type: "SET_BOOKING_INITIAL_TIER", payload: "flight_only" });
                        dispatch({ type: "SET_SHOW_BOOKING_DIALOG", payload: true });
                      } else {
                        const f = displayItinerary.selected_flight;
                        if (f?.outbound) {
                          const params = new URLSearchParams({
                            from: f.outbound.from, to: f.outbound.to,
                            departDate: f.outbound.date || '',
                            ...(f.inbound?.date ? { returnDate: f.inbound.date } : {}),
                            adults: String(displayItinerary.travelers || 1),
                            cabinClass: f.outbound.cabin_class || 'Economy',
                          });
                          window.open(`/flights?${params.toString()}`, '_blank');
                        }
                      }
                    }}
                    onShowAllFlights={() => {
                      dispatch({ type: "SET_POPUP_CITY_TAB", payload: "all" });
                      dispatch({ type: "SET_FLIGHT_LEG_TAB", payload: "all" });
                      dispatch({ type: "SET_SHOW_ALL_FLIGHTS_POPUP", payload: true });
                    }}
                    onSwapLeg={(legId: string) => {
                      dispatch({ type: "SET_POPUP_CITY_TAB", payload: "all" });
                      // Map legId to the correct leg tab label
                      const sf = displayItinerary.selected_flight;
                      let legLabel = "all";
                      if (legId === "outbound" && sf?.outbound) {
                        legLabel = allSearchedFlights.find((f: any) => f._legType === "outbound")?._legLabel || `${resolveCity(sf.outbound.from)} → ${resolveCity(sf.outbound.to)}`;
                      } else if (legId === "inbound" && sf?.inbound) {
                        legLabel = allSearchedFlights.find((f: any) => f._legType === "inbound")?._legLabel || `${resolveCity(sf.inbound.from)} → ${resolveCity(sf.inbound.to)}`;
                      } else if (legId.startsWith("inter-")) {
                        const idx = parseInt(legId.replace("inter-", ""));
                        const interLeg = sf?.inter_city_legs?.[idx];
                        if (interLeg) {
                          legLabel = allSearchedFlights.find((f: any) => f._legType === `inter-${idx}`)?._legLabel || `${resolveCity(interLeg.from)} → ${resolveCity(interLeg.to)}`;
                        }
                      }
                      dispatch({ type: "SET_FLIGHT_LEG_TAB", payload: legLabel });
                      dispatch({ type: "SET_SHOW_ALL_FLIGHTS_POPUP", payload: true });
                    }}
                  />

                  {/* ── SECTION 2: HOTELS ── */}
                  <DesktopHotelsCard
                    displayItinerary={displayItinerary}
                    allSearchedHotels={allSearchedHotels}
                    searchedCities={searchedCities}
                    userSelectedHotel={userSelectedHotel}
                    userSelectedHotelsByCity={userSelectedHotelsByCity}
                    formatPrice={formatTripPrice}
                    findHotelImage={findHotelImage}
                    resolvedHotelImage={ui.resolvedHotelImage}
                    ImageCarousel={ImageCarousel}
                    onOpenHotelPopup={(city) => { dispatch({ type: "SET_ACTIVE_HOTEL_CITY", payload: city }); dispatch({ type: "SET_POPUP_CITY_TAB", payload: city }); dispatch({ type: "SET_SHOW_ALL_HOTELS_POPUP", payload: true }); }}
                    onShowAllHotels={() => { dispatch({ type: "SET_ACTIVE_HOTEL_CITY", payload: null }); dispatch({ type: "SET_POPUP_CITY_TAB", payload: "all" }); dispatch({ type: "SET_SHOW_ALL_HOTELS_POPUP", payload: true }); }}
                  />





                  {/* Transfers are now embedded in the itinerary timeline per day */}
                  {isResolvingTransfers && resolvedTransfers.length === 0 && (
                    <div className="flex items-center gap-2 py-3 px-4 rounded-xl" style={{ background: `hsl(var(--p-card))`, border: `1px solid hsl(var(--p-border))` }}>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span className="text-xs" style={{ color: `hsl(var(--p-text-subtle))` }}>Arranging your transfers...</span>
                    </div>
                  )}

                  {/* ── SECTION 4: ITINERARY OVERVIEW ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="rounded-2xl overflow-hidden backdrop-blur-sm"
                    style={{
                      background: `linear-gradient(145deg, hsl(var(--accent) / 0.04) 0%, hsl(var(--p-card)) 30%)`,
                      border: `1px solid hsl(var(--p-border))`,
                      boxShadow: `0 4px 20px hsl(var(--p-shadow))`,
                    }}
                  >
                    <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: `hsl(var(--p-border))`, background: `linear-gradient(90deg, hsl(var(--accent) / 0.08) 0%, transparent 100%)` }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                          <CalendarIcon className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <div>
                          <span className="text-sm font-bold" style={{ color: `hsl(var(--p-text))` }}>
                            {displayItinerary.duration_days === 1 ? 'Day Trip' : `${displayItinerary.duration_days}-Day`} Itinerary
                          </span>
                          <p className="text-[11px]" style={{ color: `hsl(var(--p-text-subtle))` }}>{displayItinerary.destination}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-accent bg-accent/10 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> AI Planned
                      </span>
                    </div>

                    {/* Day cards */}
                    <div className="divide-y" style={{ borderColor: `hsl(var(--p-border))` }}>
                      {displayItinerary.days.map((day, dayIdx) => {
                        const dayTotal = day.activities.reduce((sum, a) => sum + (a.is_live_price ? (a.cost_estimate || 0) : 0), 0);
                        const bookableActivities = day.activities.filter(a => a.product_code && a.product_code !== "free" && !a.activity?.toLowerCase().includes("check-in") && !a.activity?.toLowerCase().includes("check-out"));
                        const bookableCount = bookableActivities.length;
                        const totalSightseeing = day.activities.filter(a => !a.activity?.toLowerCase().includes("check-in") && !a.activity?.toLowerCase().includes("check-out") && !a.activity?.toLowerCase().includes("transfer") && !a.activity?.toLowerCase().includes("arrive") && !a.activity?.toLowerCase().includes("depart")).length;
                        const hasBookable = bookableCount > 0;
                        const isMultiCityTrip = searchedCities.length > 1;
                        // Use backend day.city when available, fallback to getCityForDay heuristic
                        const currentCity = day.city || (searchedCities.length >= 1 ? getCityForDay(dayIdx) : "");
                        const prevDay = dayIdx > 0 ? displayItinerary.days[dayIdx - 1] : null;
                        // For transition days, use arrival_city as the effective city for next-day comparison
                        const prevCity = (prevDay?.arrival_city && prevDay?.departure_city && prevDay.arrival_city !== prevDay.departure_city)
                          ? prevDay.arrival_city
                          : (prevDay?.city || (dayIdx > 0 ? getCityForDay(dayIdx - 1) : ""));
                        // Detect city transition using backend day_type or departure_city/arrival_city metadata
                        // BUT: if the previous day was already a transition TO this city, this day is the first full day — not a transition
                        const prevWasTransitionToHere = prevDay && (
                          prevDay.day_type === "transition" ||
                          (prevDay.departure_city && prevDay.arrival_city && prevDay.departure_city !== prevDay.arrival_city)
                        ) && (prevDay.arrival_city || "").toLowerCase() === currentCity.toLowerCase();

                        const isCityTransition = isMultiCityTrip && !prevWasTransitionToHere && (
                          day.day_type === "transition" ||
                          (day.departure_city && day.arrival_city && day.departure_city !== day.arrival_city) ||
                          (dayIdx > 0 && currentCity.toLowerCase() !== prevCity.toLowerCase())
                        );
                        const cityNights = Math.max(1, (searchedCities.find(c => c.name === currentCity)?.days || 1) - 1);

                        // Check if THIS day is a transition day (title contains "→")
                        const isTransitionDay = day.day_type === "transition" || day.is_travel_day === true || day.title?.includes("→") || day.title?.includes("Travel to");
                        // Check if the PREVIOUS day was a transition day — if so, show divider before this day
                        const prevWasTransition = prevDay?.day_type === "transition" || prevDay?.is_travel_day === true || prevDay?.title?.includes("→") || prevDay?.title?.includes("Travel to");
                        const showDividerBeforeThisDay = isMultiCityTrip && prevWasTransition && dayIdx > 0;

                        return (
                          <React.Fragment key={day.day}>

                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.45 + dayIdx * 0.06 }}
                              className="group transition-colors hover:bg-accent/[0.03] cursor-default"
                            >
                              {/* Day Header */}
                              <div className="px-4 pt-3 pb-1 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                  <span className="text-xs font-bold text-primary">{day.day}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-bold truncate" style={{ color: `hsl(var(--p-text))` }}>{day.title}</p>
                                    {currentCity && (
                                      <span className="text-[9px] font-semibold bg-accent/10 text-accent rounded-full px-2 py-0.5 whitespace-nowrap flex items-center gap-0.5 shrink-0">
                                        <MapPin className="w-2 h-2" />
                                        {isCityTransition && (day.departure_city || prevCity)
                                          ? `${day.departure_city || prevCity} → ${day.arrival_city || currentCity}`
                                          : currentCity}
                                      </span>
                                    )}
                                    {(() => {
                                      const holidays = getHolidaysForDay(day.day, currentCity);
                                      if (holidays.length === 0) return null;
                                      return holidays.map((h, hi) => (
                                        <span key={hi} className="text-[9px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap flex items-center gap-1 shrink-0"
                                          style={{
                                            background: h.mood === "solemn" ? `hsl(var(--muted))` : `hsl(var(--warning) / 0.12)`,
                                            color: h.mood === "solemn" ? `hsl(var(--muted-foreground))` : `hsl(var(--warning))`,
                                          }}>
                                          {h.emoji} {h.label}
                                        </span>
                                      ));
                                    })()}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px]" style={{ color: `hsl(var(--p-text-subtle))` }}>{day.activities.length} activities</span>
                                    {dayTotal > 0 && (
                                      <span className="text-[11px] font-semibold text-accent">{formatTripPrice(dayTotal)}</span>
                                    )}
                                    {hasBookable && (
                                      <span className="text-[10px] bg-success/10 text-success rounded px-1.5 py-0.5 font-bold flex items-center gap-0.5">
                                        <Radio className="w-2.5 h-2.5" /> {bookableCount}/{totalSightseeing} Bookable
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Edit button — opens inline day editor */}
                                <button
                                  onClick={() => setEditingDayIdx(dayIdx)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-2.5 py-1 flex items-center gap-0.5"
                                >
                                  <PencilLine className="w-3 h-3" /> Edit
                                </button>
                              </div>

                            {/* Activity Timeline */}
                            <div className="px-4 pb-3 ml-[52px]">
                              <div className="relative pl-4">
                                <div className="absolute left-0 top-1 bottom-1 w-px" style={{ background: `hsl(var(--p-border))` }} />
                                <div className="space-y-1.5">
                                  {(() => {
                                    // Build hotel event for this day
                                    const totalDays = displayItinerary.days.length;
                                    const isFirstDay = dayIdx === 0;
                                    const isLastDay = dayIdx === totalDays - 1;
                                    const dayHotel = day.hotel || displayItinerary.selected_hotel;
                                    // Check if this city's hotel is self-managed (partially or fully)
                                    const matchedSelectedHotel = (displayItinerary.selected_hotels || []).find((h: any) =>
                                      (h._searchCity || h.city || "").toLowerCase() === currentCity.toLowerCase()
                                    );
                                    const selfManagedNights = Number((matchedSelectedHotel as any)?.self_managed_nights || 0);
                                    const totalCityNights = Number((matchedSelectedHotel as any)?.total_nights || (matchedSelectedHotel as any)?.nights || 0);
                                    const paidNights = selfManagedNights > 0 ? Math.max(0, totalCityNights - selfManagedNights) : totalCityNights;
                                    const isSelfManaged = (matchedSelectedHotel as any)?.is_self_managed || (dayHotel as any)?.is_self_managed || (selfManagedNights > 0 && paidNights === 0);

                                    // Determine which day within this city we're on (0-indexed)
                                    let dayInCity = 0;
                                    for (let di = dayIdx - 1; di >= 0; di--) {
                                      const dCity = (displayItinerary.days[di] as any)?.city || "";
                                      if (dCity.toLowerCase() === currentCity.toLowerCase()) dayInCity++;
                                      else break;
                                    }
                                    // If partially self-managed: booked hotel covers first `paidNights` nights, rest are self-managed
                                    const isDaySelfManaged = selfManagedNights > 0 && paidNights > 0 && dayInCity >= paidNights;
                                    // Is this the checkout day from the booked hotel (transition to self-managed)?
                                    const isBookedHotelCheckoutDay = selfManagedNights > 0 && paidNights > 0 && dayInCity === paidNights;
                                    const outboundFlight = displayItinerary.selected_flight?.outbound;
                                    const inboundFlight = displayItinerary.selected_flight?.inbound;

                                    let hotelEvent: { time: string; label: string; icon: any; stars: number; price: number; isCheckout: boolean; hotel: any } | null = null;
                                    // For city transitions, also build a checkout event for the previous city's hotel
                                    let hotelCheckoutEvent: { time: string; label: string; icon: any; stars: number; price: number; isCheckout: boolean; hotel: any } | null = null;

                                    if (isCityTransition && !isFirstDay) {
                                      // Use backend departure_city/arrival_city when available
                                      const departureCityName = day.departure_city || prevCity;
                                      const arrivalCityName = day.arrival_city || currentCity;
                                      // Check out of previous city hotel — only if there's a real previous hotel (not fallback)
                                      const prevHotel = displayItinerary.days[dayIdx - 1]?.hotel || 
                                        (displayItinerary.selected_hotels || []).find((h: any) => 
                                          (h._searchCity || h.city || "").toLowerCase() === departureCityName.toLowerCase()
                                        );
                                      if (prevHotel?.name) {
                                        hotelCheckoutEvent = {
                                          time: "08:00",
                                          label: `Check out · ${prevHotel.name}`,
                                          icon: LogOut,
                                          stars: prevHotel.stars || 0,
                                          price: prevHotel.price_per_night || 0,
                                          isCheckout: true,
                                          hotel: prevHotel,
                                        };
                                      }
                                      // Check in to new city hotel — time based on flight arrival + 1.5h buffer
                                      if (dayHotel?.name) {
                                        // Find the inter-city leg arriving at this city
                                        let checkinTime = "15:00";
                                        const interLeg = displayItinerary.selected_flight?.inter_city_legs?.find((l: any) => {
                                          const lTo = resolveCity(l.to);
                                          return lTo.toLowerCase() === arrivalCityName.toLowerCase();
                                        });
                                        if (interLeg) {
                                          const arrTimeRaw = formatFlightTime(interLeg.arrival);
                                          if (arrTimeRaw && arrTimeRaw !== "TBD") {
                                            const [h, m] = arrTimeRaw.split(":").map(Number);
                                            const checkinMin = (h * 60 + (m || 0)) + 90; // 1.5h after landing
                                            const cH = Math.min(Math.floor(checkinMin / 60), 23);
                                            const cM = checkinMin % 60;
                                            checkinTime = `${String(cH).padStart(2, "0")}:${String(cM).padStart(2, "0")}`;
                                          }
                                        }
                                        hotelEvent = {
                                          time: checkinTime,
                                          label: `Check in · ${dayHotel.name}`,
                                          icon: LogIn,
                                          stars: dayHotel.stars || displayItinerary.selected_hotel?.stars || 0,
                                          price: dayHotel.price_per_night || displayItinerary.selected_hotel?.price_per_night || 0,
                                          isCheckout: false,
                                          hotel: dayHotel,
                                        };
                                      }
                                    } else if (dayHotel?.name) {
                                      let hotelTime = "";
                                      let hotelLabel = "";
                                      let hotelIcon = Hotel;
                                      let isCheckout = false;

                                      if (isFirstDay) {
                                        const arrTime = formatFlightTime(outboundFlight?.arrival);
                                        let earlyArrival = false;
                                        if (arrTime && arrTime !== "TBD") {
                                          const [h] = arrTime.split(":").map(Number);
                                          if (h < 13) { hotelTime = "14:00"; earlyArrival = true; }
                                          else { hotelTime = `${String(Math.min(h + 1, 23)).padStart(2, "0")}:00`; }
                                        } else { hotelTime = "14:00"; }
                                        hotelLabel = earlyArrival ? `Check in · ${dayHotel.name} (drop bags early)` : `Check in · ${dayHotel.name}`;
                                        hotelIcon = LogIn;
                                      } else if (isLastDay && totalDays > 1) {
                                        isCheckout = true;
                                        const depTime = formatFlightTime(inboundFlight?.departure);
                                        if (depTime && depTime !== "TBD") {
                                          const [h] = depTime.split(":").map(Number);
                                          hotelTime = h >= 15 ? "12:00" : `${String(Math.max(h - 3, 0)).padStart(2, "0")}:00`;
                                        } else { hotelTime = "12:00"; }
                                        hotelLabel = `Check out · ${dayHotel.name}`;
                                        hotelIcon = LogOut;
                                      } else {
                                        hotelLabel = `Staying overnight · ${dayHotel.name}`;
                                        hotelTime = "23:59";
                                        hotelIcon = Hotel;
                                      }
                                      hotelEvent = {
                                        time: hotelTime,
                                        label: hotelLabel,
                                        icon: hotelIcon,
                                        stars: dayHotel.stars || displayItinerary.selected_hotel?.stars || 0,
                                        price: dayHotel.price_per_night || displayItinerary.selected_hotel?.price_per_night || 0,
                                        isCheckout,
                                        hotel: dayHotel,
                                      };
                                    }

                                    // Handle self-managed accommodation
                                    if (isSelfManaged) {
                                      // Fully self-managed city — no booked hotel events at all
                                      hotelEvent = null;
                                      // Keep checkout event for previous city (not self-managed)
                                    } else if (isDaySelfManaged) {
                                      // This specific day is self-managed (partial: booked hotel period ended)
                                      if (isBookedHotelCheckoutDay && dayHotel?.name) {
                                        // Show checkout from booked hotel on this day
                                        hotelCheckoutEvent = hotelCheckoutEvent || {
                                          time: "11:00",
                                          label: `Check out · ${dayHotel.name}`,
                                          icon: LogOut,
                                          stars: dayHotel.stars || 0,
                                          price: dayHotel.price_per_night || 0,
                                          isCheckout: true,
                                          hotel: dayHotel,
                                        };
                                      }
                                      // Show self-managed label instead of booked hotel
                                      hotelEvent = {
                                        time: "23:59",
                                        label: "Self-managed accommodation",
                                        icon: Hotel,
                                        stars: 0,
                                        price: 0,
                                        isCheckout: false,
                                        hotel: null,
                                      };
                                    }

                                    // Build flight events for this day
                                    type FlightEvent = { time: string; label: string; from: string; to: string; airline: string; flightNo: string; duration: string; stops: number };
                                    const flightEvents: FlightEvent[] = [];
                                    const selectedFlight = displayItinerary.selected_flight;

                                    if (selectedFlight) {
                                      // Outbound arrival on first day
                                      if (isFirstDay && outboundFlight) {
                                        const arrTime = formatFlightTime(outboundFlight.arrival);
                                        flightEvents.push({
                                          time: arrTime && arrTime !== "TBD" ? arrTime : "09:00",
                                          label: `Arrive in ${resolveCity(outboundFlight.to)}`,
                                          from: outboundFlight.from || "",
                                          to: outboundFlight.to || "",
                                          airline: outboundFlight.airline || "",
                                          flightNo: outboundFlight.flight_number || "",
                                          duration: outboundFlight.duration || "",
                                          stops: outboundFlight.stops || 0,
                                        });
                                      }

                                      // Inter-city flight/transfer on transition days (skip Day 1 — outbound flight covers it)
                                      if (isCityTransition && !isFirstDay) {
                                        const arrivalCityName = day.arrival_city || currentCity;
                                        const departureCityName = day.departure_city || prevCity;
                                        let addedLeg = false;
                                        if (selectedFlight.inter_city_legs?.length) {
                                          const leg = selectedFlight.inter_city_legs.find(l => {
                                            const lTo = resolveCity(l.to);
                                            return lTo.toLowerCase() === arrivalCityName.toLowerCase();
                                          });
                                          if (leg) {
                                            const depTime = formatFlightTime(leg.departure);
                                            flightEvents.push({
                                              time: depTime && depTime !== "TBD" ? depTime : "10:00",
                                              label: `✈ ${resolveCity(leg.from)} → ${resolveCity(leg.to)}`,
                                              from: leg.from, to: leg.to,
                                              airline: leg.airline || "",
                                              flightNo: leg.flight_number || "",
                                              duration: leg.duration || "",
                                              stops: leg.stops || 0,
                                            });
                                            addedLeg = true;
                                          }
                                        }
                                        // Fallback: always show a transfer event on city change even without inter_city_legs
                                        if (!addedLeg) {
                                          flightEvents.push({
                                            time: "10:00",
                                            label: `🚀 Transfer: ${departureCityName} → ${arrivalCityName}`,
                                            from: departureCityName, to: arrivalCityName,
                                            airline: "", flightNo: "", duration: "", stops: 0,
                                          });
                                        }
                                      }

                                      // Return departure on last day
                                      if (isLastDay && totalDays > 1 && inboundFlight) {
                                        const depTime = formatFlightTime(inboundFlight.departure);
                                        flightEvents.push({
                                          time: depTime && depTime !== "TBD" ? depTime : "18:00",
                                          label: `Depart to ${resolveCity(inboundFlight.to)}`,
                                          from: inboundFlight.from || "",
                                          to: inboundFlight.to || "",
                                          airline: inboundFlight.airline || "",
                                          flightNo: inboundFlight.flight_number || "",
                                          duration: inboundFlight.duration || "",
                                          stops: inboundFlight.stops || 0,
                                        });
                                      }
                                    }

                                    // Build unified timeline: activities + hotel event + flight events + transfers
                                    type TimelineItem = { type: "activity"; act: any; origIdx: number; sortTime: string } | { type: "hotel"; sortTime: string; hotelData?: typeof hotelEvent } | { type: "flight"; flight: FlightEvent; sortTime: string } | { type: "transfer"; transfer: any; sortTime: string };
                                    // Convert text times to sortable values
                                    const textTimeToSort = (t: string): string => {
                                      if (/^\d{2}:\d{2}$/.test(t)) return t;
                                      const lower = (t || "").toLowerCase().trim();
                                      if (/^(early\s*)?morning|dawn|sunrise|arrive/i.test(lower)) return "07:00";
                                      if (/^mid[\s-]*morning/i.test(lower)) return "09:30";
                                      if (/^(late\s*)?morning/i.test(lower)) return "10:00";
                                      if (/noon|midday|lunch/i.test(lower)) return "12:00";
                                      if (/^(early\s*)?afternoon/i.test(lower)) return "13:30";
                                      if (/afternoon/i.test(lower)) return "15:00";
                                      if (/evening|sunset|dinner/i.test(lower)) return "18:00";
                                      if (/night|late/i.test(lower)) return "21:00";
                                      if (/all\s*day|full\s*day/i.test(lower)) return "08:00";
                                      return "99:99";
                                    };
                                     // Filter out "Arrive in ..." text activities when a flight event already covers arrival
                                     const hasArrivalFlight = flightEvents.some(fe => /arrive in/i.test(fe.label));
                                     // Check if real flight events exist (to filter AI placeholder flight activities)
                                     const hasRealFlightEvent = flightEvents.length > 0;
                                     // Filter out skeleton-generated transfer activities when real transfer cards exist for this day
                                     const dayTransfersForFilter = transfersByDay[dayIdx] || [];
                                     const hasResolvedTransfers = dayTransfersForFilter.length > 0;
                                     const TRANSFER_ACTIVITY_RX = /airport\s*→?\s*hotel|hotel\s*→?\s*airport|airport.*transfer|transfer.*airport/i;
                                     // Pattern for AI-generated placeholder flight/transport activities
                                     const AI_FLIGHT_PLACEHOLDER_RX = /\bflight\b.*\bfrom\b.*\bto\b|\bfly\b.*\bto\b|\bcheck[\s-]?in\b.*\bhotel\b|\bhotel\s+check[\s-]?in\b|\btransfer\s*:\s*\w+.*→\s*\w+/i;
                                      const timeline: TimelineItem[] = day.activities
                                        .filter((act: any) => {
                                          const actName = (act.activity || "").trim();
                                          if (hasArrivalFlight && /^arrive in/i.test(actName)) return false;
                                          // Remove AI placeholder flight activities when real flight events exist
                                          if (hasRealFlightEvent && (act.category === "transport" || act.category === "flight") && AI_FLIGHT_PLACEHOLDER_RX.test(actName) && !act.product_code) return false;
                                          // Remove AI placeholder hotel check-in/checkout when real hotel events exist
                                          if (hotelEvent && /\bcheck[\s-]?in\b/i.test(actName) && !act.product_code && act.category !== "activity") return false;
                                          if (hotelCheckoutEvent && /\bcheck[\s-]?out\b/i.test(actName) && !act.product_code) return false;
                                          // Remove skeleton transfer activities when live transfer cards cover them
                                          if (hasResolvedTransfers && (act.category === "transport" || /transport/i.test(act.category || "")) && TRANSFER_ACTIVITY_RX.test(actName)) return false;
                                          return true;
                                        })
                                       .map((act: any, i: number) => ({
                                       type: "activity" as const, act, origIdx: i,
                                       sortTime: textTimeToSort(act.time || ""),
                                     }));
                                    if (hotelCheckoutEvent) {
                                      timeline.push({ type: "hotel" as const, sortTime: hotelCheckoutEvent.time, hotelData: hotelCheckoutEvent });
                                    }
                                    if (hotelEvent) {
                                      const hSortTime = hotelEvent.time === "23:59" ? "99:98" : hotelEvent.time;
                                      timeline.push({ type: "hotel" as const, sortTime: hSortTime, hotelData: hotelEvent });
                                    }
                                    for (const fe of flightEvents) {
                                      timeline.push({ type: "flight" as const, flight: fe, sortTime: fe.time });
                                    }
                                    // Inject transfers for this day
                                    const dayTransfers = transfersByDay[dayIdx] || [];
                                    // Find inter-city flight time for positioning transfers
                                    const interCityFe = flightEvents.find(fe => /✈|→/i.test(fe.label));
                                    for (const tr of dayTransfers) {
                                      // Position transfers relative to the flight
                                      let sortTime = "08:30";
                                      if (tr.position === "departure") {
                                        // Departure transfer: hotel → airport, BEFORE the flight
                                        const depFe = flightEvents.find(fe => /depart/i.test(fe.label)) || interCityFe;
                                        if (depFe) {
                                          const [h, m] = depFe.time.split(":").map(Number);
                                          // Transfer starts 2h before flight
                                          const totalMin = Math.max((h * 60 + (m || 0)) - 120, 0);
                                          sortTime = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
                                        } else {
                                          sortTime = "08:30";
                                        }
                                      } else if (tr.position === "arrival") {
                                        // Arrival transfer: airport → hotel, AFTER the flight
                                        const arrFe = flightEvents.find(fe => /arrive/i.test(fe.label)) || interCityFe;
                                        if (arrFe) {
                                          const [h, m] = arrFe.time.split(":").map(Number);
                                          // For inter-city flights, estimate arrival time from duration
                                          let arrivalMin = h * 60 + (m || 0);
                                          if (interCityFe && arrFe === interCityFe && interCityFe.duration) {
                                            const durMatch = interCityFe.duration.match(/(\d+)h\s*(\d+)?/);
                                            if (durMatch) arrivalMin += parseInt(durMatch[1]) * 60 + parseInt(durMatch[2] || "0");
                                          }
                                          // Add 30min for immigration/customs
                                          const totalMin = arrivalMin + 30;
                                          sortTime = `${String(Math.min(Math.floor(totalMin / 60), 23)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
                                        } else {
                                          sortTime = "16:00";
                                        }
                                      } else if (tr.position === "intercity") {
                                        sortTime = "09:30";
                                      }
                                      timeline.push({ type: "transfer" as const, transfer: tr, sortTime });
                                    }
                                    timeline.sort((a, b) => a.sortTime.localeCompare(b.sortTime));

                                    // Fix: ensure sightseeing activities don't start before hotel check-in on arrival days
                                    // Only apply to actual check-in events, NOT "Staying overnight" (which is at 23:59)
                                    const checkinItem = timeline.find(t =>
                                      t.type === "hotel" && (t as any).hotelData &&
                                      !(t as any).hotelData.isCheckout &&
                                      /check\s*in/i.test((t as any).hotelData.label || "")
                                    );
                                    if (checkinItem && checkinItem.sortTime !== "99:98") {
                                      const ciTime = checkinItem.sortTime;
                                      for (const t of timeline) {
                                        if (t.type === "activity" && !/check|transfer|airport|flight|arrive|depart/i.test((t as any).act?.activity || "")) {
                                          if (t.sortTime < ciTime && t.sortTime !== "99:99") {
                                            // Shift activity to 15 min after check-in
                                            const [ch, cm] = ciTime.split(":").map(Number);
                                            const shiftedMin = Math.min(ch * 60 + (cm || 0) + 15, 23 * 60);
                                            t.sortTime = `${String(Math.floor(shiftedMin / 60)).padStart(2, "0")}:${String(shiftedMin % 60).padStart(2, "0")}`;
                                            if ((t as any).act) (t as any).act.time = t.sortTime;
                                          }
                                        }
                                      }
                                      timeline.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
                                    }

                                    return timeline.map((item, tIdx) => {
                                      if (item.type === "activity") {
                                        const act = item.act;
                                        const origIdx = item.origIdx;
                                        const actLabel = (act.activity || "").trim();
                                        const actLower = actLabel.toLowerCase();
                                        
                                        // ── FREE DAY / REST DAY detection ──
                                        const isFreeDay = /free day|rest day|self[- ]managed|no activities|leisure day|relax/i.test(actLower);
                                        if (isFreeDay) {
                                          return (
                                            <div key={`act-${tIdx}`} className="flex items-center gap-2 relative mt-1 pt-1 -mx-1 px-1 rounded-md" style={{ borderTop: `1px dashed hsl(var(--muted-foreground) / 0.15)`, background: `hsl(var(--muted) / 0.3)` }}>
                                              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-card" style={{ borderColor: `hsl(var(--muted-foreground) / 0.4)` }} />
                                              <span className="text-[11px] font-mono font-semibold w-11 shrink-0" style={{ color: `hsl(var(--muted-foreground))` }}>{act.time || "—"}</span>
                                              <SunMedium className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate" style={{ color: `hsl(var(--muted-foreground))` }}>{actLabel.slice(0, 50)}</p>
                                                {act.description && <p className="text-[10px] truncate" style={{ color: `hsl(var(--muted-foreground) / 0.7)` }}>{act.description.slice(0, 60)}</p>}
                                              </div>
                                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">Free</span>
                                            </div>
                                          );
                                        }
                                        
                                        // ── TRANSFER / TRANSPORT detection ──
                                        const isTransfer = act.category === "transport" || /→.*transfer|airport → hotel|hotel → airport|private.*(sedan|suv|mpv|van)/i.test(actLower);
                                        if (isTransfer) {
                                          // Extract vehicle type if mentioned
                                          const vehicleMatch = actLabel.match(/Private\s+(Sedan|SUV\/MPV|SUV|MPV|Van)/i);
                                          const vehicleType = vehicleMatch ? vehicleMatch[1] : null;
                                          return (
                                            <div key={`act-${tIdx}`} className="flex items-center gap-2 relative mt-0.5 -mx-1 px-1 rounded-md" style={{ background: `hsl(45 100% 50% / 0.04)` }}>
                                              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 bg-card" style={{ borderColor: `hsl(45 80% 45% / 0.5)` }} />
                                              <span className="text-[11px] font-mono font-semibold w-11 shrink-0 text-amber-600">{act.time}</span>
                                              <Bus className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                              <p className="text-xs font-medium truncate flex-1 text-amber-700 dark:text-amber-400">{actLabel.slice(0, 45)}</p>
                                              {vehicleType && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 shrink-0">{vehicleType}</span>
                                              )}
                                            </div>
                                          );
                                        }

                                        // ── ARRIVAL event (immigration/baggage) ──
                                        const isArrivalEvent = /^arrive in|immigration|collect baggage|land at/i.test(actLower);
                                        if (isArrivalEvent) {
                                          return (
                                            <div key={`act-${tIdx}`} className="flex items-center gap-2 relative mt-1 pt-1 -mx-1 px-1 rounded-md" style={{ borderTop: `1px dashed hsl(var(--primary) / 0.15)`, background: `hsl(var(--primary) / 0.03)` }}>
                                              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-card" style={{ borderColor: `hsl(var(--primary) / 0.5)` }} />
                                              <span className="text-[11px] font-mono font-semibold w-11 shrink-0 text-primary">{act.time}</span>
                                              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-primary truncate">{actLabel.slice(0, 45)}</p>
                                                {act.description && <p className="text-[10px] truncate" style={{ color: `hsl(var(--p-text-muted))` }}>{act.description.slice(0, 60)}</p>}
                                              </div>
                                            </div>
                                          );
                                        }

                                        // ── DEPARTURE event ──
                                        const isDepartureEvent = /^depart|board your flight/i.test(actLower);
                                        if (isDepartureEvent) {
                                          return (
                                            <div key={`act-${tIdx}`} className="flex items-center gap-2 relative mt-1 pt-1 -mx-1 px-1 rounded-md" style={{ borderTop: `1px dashed hsl(var(--destructive) / 0.15)`, background: `hsl(var(--destructive) / 0.03)` }}>
                                              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-card" style={{ borderColor: `hsl(var(--destructive) / 0.4)` }} />
                                              <span className="text-[11px] font-mono font-semibold w-11 shrink-0" style={{ color: `hsl(var(--destructive))` }}>{act.time}</span>
                                              <Plane className="w-3.5 h-3.5 shrink-0" style={{ color: `hsl(var(--destructive))` }} />
                                              <p className="text-xs font-semibold truncate flex-1" style={{ color: `hsl(var(--destructive))` }}>{actLabel.slice(0, 45)}</p>
                                            </div>
                                          );
                                        }

                                        // ── DEFAULT activity rendering ──
                                        const Icon = categoryIcon[act.category] || Camera;
                                        const displayName = buildActivityDisplayName(act);
                                        const actHighlights = getActivityDisplayHighlights(act);
                                        return (
                                          <div key={`act-${tIdx}`} className="flex items-start gap-2 relative group/dayact">
                                            <div className="absolute -left-4 top-2.5 -translate-x-1/2 w-2 h-2 rounded-full border-2 bg-card" style={{ borderColor: `hsl(var(--primary) / 0.4)` }} />
                                            <span className="text-[11px] font-mono font-semibold w-11 shrink-0 pt-0.5" style={{ color: `hsl(var(--p-text-subtle))` }}>{act.time}</span>
                                            <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: `hsl(var(--p-text-muted))` }} />
                                            <div className="flex-1 min-w-0">
                                              {act.product_code ? (
                                                <a
                                                  href={buildTourUrl({ title: displayName, destination: act.city || (day as any).city || "", productCode: act.product_code, velaId: act.vela_id, slug: act.slug })}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                   className="text-xs font-medium block hover:underline transition-colors leading-snug"
                                                   style={{ color: `hsl(var(--primary))` }}
                                                   onClick={e => e.stopPropagation()}
                                                 >
                                                   {displayName}
                                                </a>
                                              ) : (
                                                <p className="text-xs font-medium leading-snug" style={{ color: `hsl(var(--p-text))` }}>
                                                  {displayName}
                                                </p>
                                              )}
                                              {act.option_title && (() => {
                                                const matchedProduct = allSearchedActivities.find((p: any) => {
                                                  const pk = p.productCode || p.product_code;
                                                  return pk && pk === act.product_code;
                                                });
                                                const opts = matchedProduct?.productOptions || [];
                                                return (
                                                  <OptionPickerBadge
                                                    optionTitle={act.option_title}
                                                    optionCode={act.product_option_code}
                                                    productOptions={opts}
                                                    basePrice={matchedProduct?.price}
                                                    formatPrice={formatTripPrice}
                                                    onOptionChange={(opt) => {
                                                      const key = `${dayIdx}-${origIdx}`;
                                                      const newAct = { ...act, option_title: opt.title || opt.description || "", product_option_code: opt.productOptionCode, cost_estimate: opt.fromPrice || act.cost_estimate };
                                                      setDayActivityOverrides(prev => ({ ...prev, [key]: { ...matchedProduct, ...newAct, productCode: act.product_code, name: act.activity } }));
                                                    }}
                                                  />
                                                );
                                              })()}
                                              {actHighlights.length > 0 && (
                                                <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                                  {actHighlights.slice(0, 3).map((h, hi) => (
                                                    <span key={hi} className="text-[9px] flex items-center gap-0.5" style={{ color: `hsl(var(--p-text-muted))` }}>
                                                      <span className="text-primary">✓</span> {h.length > 30 ? h.slice(0, 28) + "…" : h}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                            {act.is_live_price && (
                                              <span className="text-[8px] font-bold text-primary bg-primary/10 rounded px-1 py-[1px] shrink-0 flex items-center gap-0.5 mt-0.5">
                                                <Sparkles className="w-2 h-2" /> AI
                                              </span>
                                            )}
                                            {act.cost_estimate > 0 && act.is_live_price && (
                                              <span className="text-[10px] font-bold shrink-0 mt-0.5 text-success">
                                                {formatTripPrice(act.cost_estimate)}
                                              </span>
                                            )}
                                            {(!act.cost_estimate || act.cost_estimate === 0) && act.source === "free" && act.category !== "hotel" && act.category !== "transport" && (
                                              <span className="text-[9px] font-bold text-success bg-success/10 rounded px-1.5 py-[1px] shrink-0 mt-0.5">Free</span>
                                            )}
                                            {allSearchedActivities.length > 0 && (act.category === "activity" || act.source === "travelvela") && (
                                              <button
                                                onClick={() => { const cityForDay = searchedCities.length > 1 ? getCityForDay(dayIdx) : "all"; dispatch({ type: "SET_POPUP_CITY_TAB", payload: cityForDay }); setSwapTarget({ dayIdx, actIdx: origIdx }); dispatch({ type: "SET_SHOW_ALL_ACTIVITIES_POPUP", payload: true }); }}
                                                className="sm:opacity-0 sm:group-hover/dayact:opacity-100 transition-opacity shrink-0 w-5 h-5 rounded bg-muted/60 hover:bg-primary/10 flex items-center justify-center mt-0.5"
                                                title="Swap activity"
                                              >
                                                <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
                                              </button>
                                            )}
                                          </div>
                                        );
                                      }
                                      // Flight event
                                      if (item.type === "flight") {
                                        const fe = (item as any).flight as FlightEvent;
                                        return (
                                          <div
                                            key={`flight-${tIdx}`}
                                            className="flex items-center gap-2 relative mt-1 pt-1 -mx-1 px-1 rounded-md"
                                            style={{ borderTop: `1px dashed hsl(var(--primary) / 0.2)`, borderBottom: `1px dashed hsl(var(--primary) / 0.2)`, background: `hsl(var(--primary) / 0.04)` }}
                                          >
                                            <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-card" style={{ borderColor: `hsl(var(--primary) / 0.6)` }} />
                                            <span className="text-[11px] font-mono font-semibold w-11 shrink-0 text-primary">{fe.time}</span>
                                            <Plane className="w-3.5 h-3.5 shrink-0 text-primary" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-semibold text-primary leading-snug">
                                                {fe.label}
                                              </p>
                                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                {fe.airline && <AirlineLogo code={fe.airline} name={fe.airline} size={14} />}
                                                {fe.flightNo && <span className="font-mono">{fe.flightNo}</span>}
                                                {fe.duration && <span>· {fe.duration}</span>}
                                                {fe.stops > 0 && <span>· {fe.stops} stop{fe.stops > 1 ? 's' : ''}</span>}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      // Transfer event (embedded in itinerary, collapsed by default)
                                      if (item.type === "transfer") {
                                        const tr = (item as any).transfer as NormalizedTransfer;
                                        const vehicleLabel = tr.vehicle_class === "standard_sedan" ? "Sedan" :
                                          tr.vehicle_class === "family_mpv" ? "MPV" :
                                          tr.vehicle_class === "premium_suv" ? "SUV" :
                                          tr.vehicle_class === "private_van" ? "Van" :
                                          tr.vehicle_class === "shared_shuttle" ? "Shuttle" : tr.vehicle_class || "Private";
                                        return (
                                          <details key={`transfer-${tIdx}`} className="relative -mx-1 px-1 rounded-md mt-0.5 group/transfer">
                                            <summary className="flex items-center gap-2 cursor-pointer list-none py-0.5 hover:bg-amber-500/5 rounded transition-colors">
                                              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-card" style={{ borderColor: `hsl(45 80% 45% / 0.6)` }} />
                                              <span className="text-[11px] font-mono font-semibold w-11 shrink-0 text-amber-600">{item.sortTime}</span>
                                              <Car className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                              <p className="text-xs font-medium flex-1 text-amber-700 dark:text-amber-400 leading-snug">
                                                {tr.pickup_name || tr.pickup_code || "Pickup"} → {tr.dropoff_name || tr.dropoff_code || "Drop-off"}
                                              </p>
                                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 shrink-0">{vehicleLabel}</span>
                                              {tr.total_price > 0 && (
                                                <span className="text-[10px] font-bold text-amber-600 shrink-0">{formatTripPrice(tr.total_price)}</span>
                                              )}
                                            </summary>
                                            <div className="ml-[52px] pl-4 pb-1.5 pt-0.5 space-y-1 text-[10px]" style={{ color: `hsl(var(--p-text-subtle))` }}>
                                              {tr.product_name && (
                                                <p className="flex items-center gap-1">
                                                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                                  <span className="font-medium">{tr.product_name}</span>
                                                </p>
                                              )}
                                              {tr.duration_minutes > 0 && <p>⏱ ~{tr.duration_minutes} min</p>}
                                              {tr.traveler_fit && <p>👥 {tr.traveler_fit}</p>}
                                              {tr.luggage_fit && <p>🧳 {tr.luggage_fit}</p>}
                                              {tr.reason_text && <p className="italic">{tr.reason_text}</p>}
                                              {tr.policies?.meeting_point && <p>📍 {tr.policies.meeting_point}</p>}
                                            </div>
                                          </details>
                                        );
                                      }
                                      // Hotel event
                                      const thisHotelEvent = (item as any).hotelData || hotelEvent;
                                      if (!thisHotelEvent) return null;
                                      const HotelStayIcon = thisHotelEvent.icon;
                                      const displayTime = thisHotelEvent.time === "23:59" ? "🌙" : thisHotelEvent.time;
                                      return (
                                        <div
                                          key={`hotel-${tIdx}`}
                                          className="flex items-center gap-2 relative group/hotelstay mt-1 pt-1 cursor-pointer hover:bg-accent/5 -mx-1 px-1 rounded-md transition-colors"
                                          style={{ borderTop: `1px dashed hsl(var(--accent) / 0.2)` }}
                                          onClick={() => { if (allSearchedHotels.length > 0) { const dh = thisHotelEvent!.hotel as any; const cityForDay = dh?.city || dh?._searchCity || (searchedCities.length > 1 ? getCityForDay(dayIdx) : "all"); dispatch({ type: "SET_ACTIVE_HOTEL_CITY", payload: cityForDay !== "all" ? cityForDay : null }); dispatch({ type: "SET_POPUP_CITY_TAB", payload: cityForDay || "all" }); dispatch({ type: "SET_SHOW_ALL_HOTELS_POPUP", payload: true }); } }}
                                        >
                                          <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-card" style={{ borderColor: `hsl(var(--accent) / 0.6)` }} />
                                          <span className="text-[11px] font-mono font-semibold w-11 shrink-0" style={{ color: `hsl(var(--accent) / 0.6)` }}>
                                            {displayTime}
                                          </span>
                                          <HotelStayIcon className="w-3.5 h-3.5 shrink-0 text-accent" />
                                          <p className="text-xs font-medium flex-1 text-accent leading-snug">
                                            {thisHotelEvent.label}
                                          </p>
                                          {thisHotelEvent.stars > 0 && (
                                            <span className="flex items-center gap-0 shrink-0">
                                              {Array.from({ length: Math.min(thisHotelEvent.stars, 5) }).map((_, s) => (
                                                <Star key={s} className="w-2.5 h-2.5 fill-warning text-warning" />
                                              ))}
                                            </span>
                                          )}
                                          {thisHotelEvent.price > 0 && !thisHotelEvent.isCheckout && (
                                            <span className="text-[10px] font-bold text-accent shrink-0">
                                              {formatTripPrice(thisHotelEvent.price)}/n
                                            </span>
                                          )}
                                          {allSearchedHotels.length > 0 && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); const dh = thisHotelEvent!.hotel as any; const cityForDay = dh?.city || dh?._searchCity || (searchedCities.length > 1 ? getCityForDay(dayIdx) : "all"); dispatch({ type: "SET_ACTIVE_HOTEL_CITY", payload: cityForDay !== "all" ? cityForDay : null }); dispatch({ type: "SET_POPUP_CITY_TAB", payload: cityForDay || "all" }); dispatch({ type: "SET_SHOW_ALL_HOTELS_POPUP", payload: true }); }}
                                              className="sm:opacity-0 sm:group-hover/hotelstay:opacity-100 transition-opacity shrink-0 w-5 h-5 rounded bg-accent/10 hover:bg-accent/20 flex items-center justify-center"
                                              title="Change hotel"
                                            >
                                              <RefreshCw className="w-2.5 h-2.5 text-accent" />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Quick Actions Bar */}
                    <div className="px-4 py-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: `hsl(var(--p-border))`, background: `hsl(var(--p-card))` }}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-primary/30 text-primary hover:bg-primary/5 text-xs font-semibold gap-1"
                        onClick={addDayToItinerary}
                      >
                        <Plus className="w-3 h-3" /> Add Day
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-accent/30 text-accent hover:bg-accent/5 text-xs font-semibold gap-1"
                         onClick={() => { dispatch({ type: "SET_ACTIVE_HOTEL_CITY", payload: null }); dispatch({ type: "SET_POPUP_CITY_TAB", payload: "all" }); dispatch({ type: "SET_SHOW_ALL_HOTELS_POPUP", payload: true }); }}
                      >
                        <Hotel className="w-3 h-3" /> Change Hotel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-success/30 text-success hover:bg-success/5 text-xs font-semibold gap-1"
                         onClick={() => { dispatch({ type: "SET_POPUP_CITY_TAB", payload: "all" }); dispatch({ type: "SET_SHOW_ALL_ACTIVITIES_POPUP", payload: true }); }}
                      >
                        <Camera className="w-3 h-3" /> Browse Activities
                      </Button>
                    </div>
                  </motion.div>

                  {/* ── BUDGET SUMMARY (PriceSummaryCard) ── */}
                  <PriceSummaryCard
                    breakdown={{ ...displayItinerary.budget_estimate.breakdown, ...(totalTransferCost > 0 ? { transfers: totalTransferCost } : {}) }}
                    formatPrice={formatTripPrice}
                    onBook={() => { trackTripEvent("booking_clicked", { source: "desktop_price_card" }); dispatch({ type: "SET_SHOW_BOOKING_DIALOG", payload: true }); }}
                    onCustomize={() => { trackTripEvent("customize_clicked", { source: "desktop_price_card" }); sendMessage("I'd like to customize this plan"); }}
                    onDownloadPDF={() => { trackTripEvent("pdf_downloaded"); window.dispatchEvent(new CustomEvent('vela-download-pdf')); }}
                    onSave={async () => {
                      trackTripEvent("trip_saved", { source: "desktop_price_card" });
                      const saved = await saveTrip({
                        title: displayItinerary.trip_title || `${displayItinerary.destination} Trip`,
                        destination: displayItinerary.destination,
                        origin: extractedParams?.origin_city,
                        duration_days: displayItinerary.duration_days,
                        travelers: displayItinerary.travelers,
                        itinerary: structuredItinerary,
                        live_data: lastLiveData,
                        messages: messages,
                      });
                      if (saved?.id) {
                        setSavedTripId(saved.id);
                        setItineraryCode((saved as any).itinerary_code || null);
                      }
                    }}
                    loading={loading}
                    pdfDownloading={ui.pdfDownloading}
                    saving={tripSaving}
                    travelers={displayItinerary.travelers || 1}
                    delay={0.6}
                    pricingIntelligence={displayItinerary.pricing_intelligence}
                  />

                  {/* ── REFINE YOUR TRIP ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85 }}
                    className="rounded-2xl border p-4 backdrop-blur-sm"
                    style={{ backgroundColor: `hsl(var(--p-card))`, borderColor: `hsl(var(--p-border))`, boxShadow: `0 4px 12px hsl(var(--p-shadow))` }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: `hsl(var(--p-text-subtle))` }}>
                      <Sparkles className="w-3 h-3 text-primary" /> Refine Your Trip
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Make it cheaper", icon: TrendingDown },
                        { label: "Add luxury hotel", icon: Crown },
                        { label: "Shorter trip", icon: Clock },
                        { label: "Add beach day", icon: SunMedium },
                        { label: "More activities", icon: Camera },
                        { label: "Change destination", icon: MapPin },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          onClick={() => sendMessage(chip.label)}
                          disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-200 disabled:opacity-40 planner-chip hover:scale-[1.03]"
                          style={{
                            borderColor: `hsl(var(--p-border-strong))`,
                            backgroundColor: `hsl(var(--p-card-alt))`,
                            color: `hsl(var(--p-text-muted))`,
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            el.style.borderColor = `hsl(var(--primary) / 0.4)`;
                            el.style.backgroundColor = `hsl(var(--primary) / 0.08)`;
                            el.style.color = `hsl(var(--primary))`;
                            el.style.boxShadow = `0 0 12px hsl(var(--primary) / 0.12), 0 0 4px hsl(var(--primary) / 0.08)`;
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget;
                            el.style.borderColor = `hsl(var(--p-border-strong))`;
                            el.style.backgroundColor = `hsl(var(--p-card-alt))`;
                            el.style.color = `hsl(var(--p-text-muted))`;
                            el.style.boxShadow = 'none';
                          }}
                        >
                          <chip.icon className="w-3 h-3" />
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>

                  {/* ── AI SUGGESTIONS ── */}
                  {displayItinerary.tips?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                      className="bg-accent/[0.06] rounded-2xl border border-accent/15 p-4 shadow-lg shadow-black/10 backdrop-blur-sm"
                    >
                       <p className="text-xs font-bold uppercase tracking-wider text-accent mb-3 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-accent" /> AI Suggestions
                      </p>
                      <div className="space-y-2">
                        {displayItinerary.tips.slice(0, 3).map((tip, i) => (
                          <button
                            key={i}
                            onClick={() => sendMessage(`Apply this suggestion: ${tip}`)}
                            disabled={loading}
                            className="w-full flex items-start gap-2.5 text-left p-2.5 rounded-lg hover:bg-accent/5 transition-colors group"
                          >
                            <span className="w-5 h-5 rounded-md bg-accent/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-accent/20 transition-colors">
                              <TrendingDown className="w-3 h-3 text-accent" />
                            </span>
                            <span className="text-xs leading-relaxed" style={{ color: `hsl(var(--p-text))` }}>{tip}</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-1 group-hover:text-accent transition-colors" style={{ color: `hsl(var(--p-text-subtle))` }} />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}


                  {/* spacer for sticky CTA */}
                  <div className="h-2" />
                </motion.div>
                </div>
              </div>
              </TripErrorBoundary>
            ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {searchPhase !== "idle" ? (
                /* 🔄 PROGRESSIVE SEARCH RESULTS — show as they arrive */
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Search phase indicator */}
                  <div
                    className="rounded-2xl p-4 border"
                    style={{
                      backgroundColor: `hsl(var(--primary) / 0.06)`,
                      borderColor: `hsl(var(--primary) / 0.15)`,
                      color: `hsl(var(--p-text))`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-3 w-3"><span className="animate-ping absolute inset-0 rounded-full bg-primary/40" /><span className="relative inline-flex rounded-full h-3 w-3 bg-primary" /></span>
                      <span className="text-sm font-semibold" style={{ color: `hsl(var(--p-text))` }}>
                        {searchPhase === "generating" ? "✨ Creating your itinerary…" : "🔍 Searching live providers…"}
                      </span>
                    </div>

                    {/* Search phase: show provider status */}
                    {searchPhase === "searching" && (
                      <div className="space-y-1.5 ml-5">
                        <div className="flex items-center gap-2 text-xs" style={{ color: `hsl(var(--p-text-muted))` }}>
                          <Plane className="w-3 h-3" style={{ color: `hsl(var(--p-text-faint))` }} />
                          <span style={{ color: `hsl(var(--p-text))` }}>{progressiveFlights === null ? "Searching flights…" : `✅ ${progressiveFlights.length} flights found`}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: `hsl(var(--p-text-muted))` }}>
                          <Hotel className="w-3 h-3" style={{ color: `hsl(var(--p-text-faint))` }} />
                          <span style={{ color: `hsl(var(--p-text))` }}>{progressiveHotels === null ? "Searching hotels…" : `✅ ${progressiveHotels.length} hotels found`}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: `hsl(var(--p-text-muted))` }}>
                          <Camera className="w-3 h-3" style={{ color: `hsl(var(--p-text-faint))` }} />
                          <span style={{ color: `hsl(var(--p-text))` }}>{progressiveActivities === null ? "Searching activities…" : `✅ ${progressiveActivities.length} activities found`}</span>
                        </div>
                      </div>
                    )}

                    {/* Generation phase: show engaging step-by-step progress */}
                    {searchPhase === "generating" && (() => {
                      const genSteps = [
                        { icon: "🧠", label: "Planning your itinerary with AI…" },
                        { icon: "🗓️", label: "Building day-by-day schedule…" },
                        { icon: "📅", label: "Normalizing dates & connections…" },
                        { icon: "🎯", label: "Searching activities & experiences…" },
                        { icon: "🏨", label: "Matching hotels & flights…" },
                        { icon: "🛡️", label: "Running quality checks…" },
                        { icon: "✨", label: "Finalizing your personalized itinerary…" },
                      ];
                      return (
                        <div className="space-y-1 ml-5 mt-1">
                          {genSteps.map((step, idx) => {
                            const isDone = genProgressStep > idx;
                            const isActive = genProgressStep === idx;
                            const isPending = genProgressStep < idx;
                            // Use real-time label for the active step if available
                            const displayLabel = isActive && genProgressLabel ? genProgressLabel : step.label;
                            return (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
                                transition={{ delay: idx * 0.05, duration: 0.25 }}
                                className="flex items-center gap-2 text-xs py-0.5"
                              >
                                <span className="w-4 text-center shrink-0">
                                  {isDone ? "✅" : isActive ? (
                                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: `hsl(var(--primary))` }} />
                                  ) : "○"}
                                </span>
                                <span style={{ color: isDone ? `hsl(var(--p-text-muted))` : isActive ? `hsl(var(--p-text))` : `hsl(var(--p-text-faint))`, fontWeight: isActive ? 600 : 400 }}>
                                  {step.icon} {displayLabel}
                                </span>
                              </motion.div>
                            );
                          })}
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: `hsl(var(--primary) / 0.1)` }}>
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))` }}
                              initial={{ width: "5%" }}
                              animate={{ width: `${Math.min(95, 10 + genProgressStep * 13)}%` }}
                              transition={{ duration: 1.5, ease: "easeInOut" }}
                            />
                          </div>
                          <p className="text-[10px] text-center mt-1" style={{ color: `hsl(var(--p-text-faint))` }}>
                            {(() => {
                              const c = extractedParams?.cities?.length || 1;
                              const n = extractedParams?.cities?.reduce((s: number, ci: any) => s + (ci.nights || 2), 0) || 3;
                              if (c >= 3 || n >= 10) return "Complex multi-city trip — this may take 60-90 seconds ✨";
                              if (c >= 2 || n >= 6) return "Multi-city trip — this usually takes 30-50 seconds ✨";
                              return "This usually takes 15-25 seconds — we're crafting something great ✨";
                            })()}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Show flight cards as they arrive */}
                  {progressiveFlights && progressiveFlights.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>✈️ Flights Found</p>
                      {progressiveFlights.slice(0, 3).map((f: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="rounded-xl border p-3 text-xs"
                          style={{
                            backgroundColor: `hsl(var(--p-card))`,
                            borderColor: `hsl(var(--p-border))`,
                            color: `hsl(var(--p-text))`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <AirlineLogo code={f.airline} name={f.airline} size={20} />
                              <div className="min-w-0">
                                <p className="font-semibold truncate" style={{ color: `hsl(var(--p-text))` }}>{resolveCity(f.from_city || f.from || "—")} → {resolveCity(f.to_city || f.to || "—")}</p>
                                <p className="truncate" style={{ color: `hsl(var(--p-text-muted))` }}>{f.duration} · {f.stops === 0 ? "Direct" : `${f.stops} stop(s)`}</p>
                              </div>
                            </div>
                            <p className="font-bold shrink-0" style={{ color: `hsl(var(--primary))` }}>{f.currency} {f.price?.toLocaleString()}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                  {/* Show hotel cards as they arrive */}
                  {progressiveHotels && progressiveHotels.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>🏨 Hotels Found</p>
                      {progressiveHotels.slice(0, 3).map((h: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="rounded-xl border p-3 text-xs"
                          style={{
                            backgroundColor: `hsl(var(--p-card))`,
                            borderColor: `hsl(var(--p-border))`,
                            color: `hsl(var(--p-text))`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold truncate" style={{ color: `hsl(var(--p-text))` }}>{h.name}</p>
                              <p className="truncate" style={{ color: `hsl(var(--p-text-muted))` }}>{"⭐".repeat(h.stars || 3)} · {h.mealBasis || "Room Only"}</p>
                            </div>
                            <p className="font-bold shrink-0" style={{ color: `hsl(var(--primary))` }}>{h.currency} {h.pricePerNight?.toLocaleString()}/night</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                  {/* Show activities as they arrive */}
                  {progressiveActivities && progressiveActivities.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-muted))` }}>🎯 Activities Found</p>
                      {progressiveActivities.slice(0, 3).map((a: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="rounded-xl border p-3 text-xs"
                          style={{
                            backgroundColor: `hsl(var(--p-card))`,
                            borderColor: `hsl(var(--p-border))`,
                            color: `hsl(var(--p-text))`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[200px]" style={{ color: `hsl(var(--p-text))` }}>{a.name}</p>
                              <p className="truncate" style={{ color: `hsl(var(--p-text-muted))` }}>{a.duration} · ⭐ {a.rating?.toFixed(1)}</p>
                            </div>
                            <p className="font-bold shrink-0" style={{ color: `hsl(var(--primary))` }}>{formatTripPrice(a.price)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ) : rightPanelError && !displayItinerary ? (
                /* 🔴 ERROR STATE — Premium retry */
                <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `hsl(var(--destructive) / 0.1)`, border: `1px solid hsl(var(--destructive) / 0.2)` }}
                  >
                    <AlertTriangle className="w-7 h-7 text-destructive/70" />
                  </motion.div>
                  <p className="text-sm font-semibold mb-1" style={{ color: `hsl(var(--p-text))` }}>Something went wrong</p>
                  <p className="text-[11px] mb-5 max-w-[240px]" style={{ color: `hsl(var(--p-text-faint))` }}>
                    We couldn't load your results. This is usually temporary — let's try again.
                  </p>
                  <Button
                    size="sm"
                    className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 px-5 h-9"
                    onClick={() => {
                      setRightPanelError(false);
                      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                      if (lastUserMsg) sendMessage(lastUserMsg.content, false, true);
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" /> Retry
                  </Button>
                </div>
              ) : (extractedParams?.destination_city || extractedParams?.destination_country) ? (
                /* 🟡 PROGRESSIVE PREVIEW STATE — Cards appear as AI gathers info */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {/* ── Destination Summary Card (always first) ── */}
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.05 }}
                    className="rounded-2xl border border-primary/15 overflow-hidden backdrop-blur-sm"
                  >
                    {/* Hero image / skeleton */}
                    {ui.cityIntroLoading && !ui.cityIntro?.hero_image_url && (
                      <div className="relative h-36 w-full overflow-hidden bg-[hsl(var(--p-card-alt,222_35%_14%))]">
                        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" style={{ animationDuration: '1.8s' }} />
                        <div className="absolute bottom-3 left-4 right-4 space-y-1.5">
                          <div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
                          <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" />
                        </div>
                      </div>
                    )}
                    {ui.cityIntro?.hero_image_url && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="relative h-36 w-full overflow-hidden"
                      >
                        <img src={ui.cityIntro.hero_image_url} alt={ui.cityIntro.city_name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--p-bg,222_47%_6%))] via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4">
                          <p className="text-lg font-bold text-white drop-shadow-lg">
                            {extractedParams.destination_city || extractedParams.destination_country}
                            {extractedParams.origin_city && (
                              <span className="text-sm font-medium text-white/70"> from {extractedParams.origin_city}</span>
                            )}
                          </p>
                          {ui.cityIntro.country && (
                            <p className="text-xs text-white/80 drop-shadow">{ui.cityIntro.country}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                    {!ui.cityIntro?.hero_image_url && !ui.cityIntroLoading && (
                      <div className="bg-gradient-to-br from-primary/[0.08] to-accent/[0.04] p-5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/15">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-[hsl(var(--p-text,0_0%_96%))]">
                              {extractedParams.destination_city || extractedParams.destination_country}
                              {extractedParams.origin_city && (
                                <span className="text-sm font-medium text-[hsl(var(--p-text-muted,222_12%_65%))]"> from {extractedParams.origin_city}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Parameter chips — origin moved to header */}
                    {(extractedParams.duration_days || extractedParams.adults) && (
                      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[hsl(var(--p-border,222_30%_14%))]">
                        {extractedParams.duration_days && (
                          <span className="text-[10px] text-[hsl(var(--p-text-muted,222_12%_65%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2 py-0.5">
                            {extractedParams.duration_days} days
                          </span>
                        )}
                        {extractedParams.adults && (
                          <span className="text-[10px] text-[hsl(var(--p-text-muted,222_12%_65%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2 py-0.5">
                            {extractedParams.adults} traveler{extractedParams.adults > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Progress dots */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[hsl(var(--p-border,222_30%_14%))]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inset-0 rounded-full bg-primary/30" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
                      </span>
                      <span className="text-[10px] text-[hsl(var(--p-text-subtle,222_10%_52%))] font-medium">
                        {ui.cityIntroLoading ? "Loading destination info…" : 
                          (searchPhase as string) === "generating" ? (
                            genProgressLabel || (
                              genProgressStep <= 1 ? "Planning your itinerary…" :
                              genProgressStep <= 3 ? "Building your itinerary…" :
                              genProgressStep <= 5 ? "Matching products & prices…" :
                              "Final touches…"
                            )
                          ) : "Searching live providers…"}
                      </span>
                    </div>
                  </motion.div>

                  {/* ── CITY INTRO: Inspiration content (destination known, no origin) ── */}
                  {!extractedParams.origin_city && ui.cityIntroLoading && !ui.cityIntro ? (
                    <>
                      {/* Skeleton: Popular Areas */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden"
                      >
                        <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 animate-pulse" />
                          <div className="h-3.5 w-24 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                        </div>
                        <div className="divide-y divide-[hsl(var(--p-border,222_30%_14%))]">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-primary/[0.06] animate-pulse flex-shrink-0" />
                              <div className="flex-1 space-y-1">
                                <div className="h-3 w-3/4 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                      {/* Skeleton: Best Time */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden"
                      >
                        <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-accent/10 animate-pulse" />
                          <div className="h-3.5 w-28 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                        </div>
                        <div className="px-4 py-3 space-y-1.5">
                          <div className="h-3 w-full rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                          <div className="h-3 w-2/3 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                        </div>
                      </motion.div>
                      {/* Skeleton: Budget */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden"
                      >
                        <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-accent/10 animate-pulse" />
                          <div className="h-3.5 w-32 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                        </div>
                        <div className="divide-y divide-[hsl(var(--p-border,222_30%_14%))]">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="px-4 py-3 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse flex-shrink-0" />
                              <div className="flex-1 space-y-1">
                                <div className="h-3 w-16 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                                <div className="h-2.5 w-32 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                              </div>
                              <div className="h-4 w-16 rounded bg-[hsl(var(--p-card-alt,222_35%_14%))] animate-pulse" />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  ) : ui.cityIntro && !extractedParams.origin_city ? (
                    <>
                      {/* Popular Areas */}
                      {ui.cityIntro.popular_areas?.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
                          className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                        >
                          <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2 bg-primary/[0.04]">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Compass className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Popular Areas</span>
                          </div>
                          <div className="divide-y divide-[hsl(var(--p-border,222_30%_14%))]">
                            {ui.cityIntro.popular_areas.map((area, i) => (
                              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-primary/[0.06] flex items-center justify-center flex-shrink-0">
                                  <MapPin className="w-3 h-3 text-primary/60" />
                                </div>
                                <p className="text-[11px] text-[hsl(var(--p-text,0_0%_96%))] leading-snug">{area}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Best Time to Visit */}
                      {ui.cityIntro.best_time_to_visit && (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.25 }}
                          className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                        >
                          <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                              <Sun className="w-3.5 h-3.5 text-accent" />
                            </div>
                            <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Best Time to Visit</span>
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-[11px] text-[hsl(var(--p-text-muted,222_12%_65%))] leading-relaxed">{ui.cityIntro.best_time_to_visit}</p>
                          </div>
                        </motion.div>
                      )}

                      {/* Budget Ranges */}
                      {ui.cityIntro.budget_ranges && Object.keys(ui.cityIntro.budget_ranges).length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.35 }}
                          className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                        >
                          <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2 bg-accent/[0.04]">
                            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                              <Wallet className="w-3.5 h-3.5 text-accent" />
                            </div>
                            <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Daily Budget Ranges</span>
                            <span className="ml-auto text-[9px] text-[hsl(var(--p-text-subtle,222_10%_52%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2 py-0.5">per person/day</span>
                          </div>
                          <div className="divide-y divide-[hsl(var(--p-border,222_30%_14%))]">
                            {[
                              { key: "budget" as const, label: "Budget", icon: TrendingDown, color: "text-green-400" },
                              { key: "mid_range" as const, label: "Mid-Range", icon: DollarSign, color: "text-accent" },
                              { key: "luxury" as const, label: "Luxury", icon: Crown, color: "text-warning" },
                            ].map(({ key, label, icon: Icon, color }) => {
                              const range = ui.cityIntro.budget_ranges[key];
                              if (!range) return null;
                              return (
                                <div key={key} className="px-4 py-3 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--p-card-alt,222_35%_14%))] flex items-center justify-center flex-shrink-0">
                                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-[hsl(var(--p-text,0_0%_96%))]">{label}</p>
                                    <p className="text-[10px] text-[hsl(var(--p-text-subtle,222_10%_52%))] mt-0.5">{range.note}</p>
                                  </div>
                                  <p className="text-xs font-bold text-primary shrink-0">
                                    {formatFromSource(range.min, range.currency || "USD")}–{formatFromSource(range.max, range.currency || "USD")}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}

                      {/* CTA */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center justify-center gap-2 py-3"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary/50" />
                        <span className="text-[11px] text-[hsl(var(--p-text-faint,222_10%_40%))]">Tell me more to build your full trip plan</span>
                      </motion.div>
                    </>
                  ) : (
                    <>
                      {/* ── ROUTE INTELLIGENCE: origin + destination known ── */}

                      {/* Route Tips Card */}
                      {ui.routeIntel?.route_tips && (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
                          className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                        >
                          <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2 bg-primary/[0.04]">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Zap className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Route Intelligence</span>
                          </div>
                          <div className="px-4 py-3 space-y-3">
                            {/* Flight tip */}
                            <div className="flex items-start gap-2.5">
                              <Lightbulb className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                              <p className="text-[11px] text-[hsl(var(--p-text-muted,222_12%_65%))] leading-relaxed">{ui.routeIntel.route_tips.flight_tip}</p>
                            </div>
                            {/* Stats row */}
                            <div className="flex items-center gap-3 flex-wrap">
                              {ui.routeIntel.route_tips.avg_duration && (
                                <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--p-text-subtle,222_10%_52%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2.5 py-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{ui.routeIntel.route_tips.avg_duration}</span>
                                </div>
                              )}
                              {ui.routeIntel.route_tips.best_months && (
                                <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--p-text-subtle,222_10%_52%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2.5 py-1">
                                  <CalendarIcon className="w-3 h-3" />
                                  <span>{ui.routeIntel.route_tips.best_months}</span>
                                </div>
                              )}
                            </div>
                            {/* Common airlines */}
                            {ui.routeIntel.route_tips.common_airlines?.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-[hsl(var(--p-text-faint,222_10%_40%))] uppercase tracking-wider font-bold">Top Airlines</span>
                                <div className="flex items-center gap-1.5">
                                  {ui.routeIntel.route_tips.common_airlines.slice(0, 4).map((code) => (
                                    <div key={code} className="flex items-center gap-1 bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-md px-1.5 py-0.5">
                                      <img src={`https://pics.avs.io/24/24/${code}.png`} alt={code} className="w-4 h-4 rounded-sm object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                      <span className="text-[10px] text-[hsl(var(--p-text,0_0%_96%))] font-medium">{AIRLINE_NAMES[code] || code}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Travel notes */}
                            {ui.routeIntel.route_tips.travel_notes && (
                              <div className="flex items-start gap-2 pt-1 border-t border-[hsl(var(--p-border,222_30%_14%))]">
                                <Shield className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                                <p className="text-[10px] text-[hsl(var(--p-text-subtle,222_10%_52%))] leading-relaxed">{ui.routeIntel.route_tips.travel_notes}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Cached Flight Prices */}
                      {(ui.routeIntel?.cached_prices?.length || ui.previewData?.cachedFlightPrices?.length) ? (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.15 }}
                          className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                        >
                          <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2 bg-primary/[0.04]">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Plane className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Price Hints</span>
                            <span className="ml-auto text-[9px] font-semibold text-[hsl(var(--p-text-subtle,222_10%_52%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2 py-0.5">From past searches</span>
                          </div>
                          <div className="divide-y divide-[hsl(var(--p-border,222_30%_14%))]">
                            {(ui.routeIntel?.cached_prices || ui.previewData?.cachedFlightPrices || []).slice(0, 3).map((f, i) => (
                              <div key={i} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                  <p className="text-[11px] text-[hsl(var(--p-text-muted,222_12%_65%))]">{f.cabin_class}</p>
                                  <p className="text-[10px] text-[hsl(var(--p-text-faint,222_10%_40%))]">{f.travel_date}</p>
                                </div>
                                <p className="text-sm font-bold text-primary">from {formatTripPrice(f.lowest_price)}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}

                      {/* Popular Routes */}
                      {(ui.routeIntel?.popular_routes?.length || ui.previewData?.popularRoutes?.length) ? (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.25 }}
                          className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                        >
                          <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                              <Globe className="w-3.5 h-3.5 text-accent" />
                            </div>
                            <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Related Routes</span>
                          </div>
                          <div className="divide-y divide-[hsl(var(--p-border,222_30%_14%))]">
                            {(ui.routeIntel?.popular_routes || ui.previewData?.popularRoutes || []).slice(0, 4).map((r, i) => (
                              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-[hsl(var(--p-text,0_0%_96%))] truncate">{r.from_city || r.from_code} → {r.to_city || r.to_code}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--p-text-subtle,222_10%_52%))] mt-0.5">
                                    {r.airline && <span>{AIRLINE_NAMES[r.airline] || r.airline}</span>}
                                    {r.duration && <><span>•</span><span>{r.duration}</span></>}
                                    <span>•</span>
                                    <span>{r.stops === 0 ? "Direct" : `${r.stops} stop${r.stops > 1 ? "s" : ""}`}</span>
                                  </div>
                                </div>
                                {r.lowest_price > 0 && (
                                  <p className="text-xs font-bold text-accent shrink-0">from {formatTripPrice(r.lowest_price)}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}

                      {/* Destination insights from city intro */}
                      {(ui.routeIntel?.city_intro || ui.cityIntro) && (() => {
                        const intro = ui.routeIntel?.city_intro || ui.cityIntro;
                        return intro ? (
                          <motion.div
                            initial={{ opacity: 0, y: 16, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.3 }}
                            className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                          >
                            <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                                <Compass className="w-3.5 h-3.5 text-accent" />
                              </div>
                              <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Destination Insights</span>
                            </div>
                            <div className="px-4 py-3 space-y-2">
                              {intro.intro_text && (
                                <p className="text-[11px] text-[hsl(var(--p-text-muted,222_12%_65%))] leading-relaxed">{intro.intro_text}</p>
                              )}
                              <div className="flex items-center gap-3 flex-wrap">
                                {intro.best_time_to_visit && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--p-text-subtle,222_10%_52%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2.5 py-1">
                                    <Sun className="w-3 h-3" />
                                    <span>{intro.best_time_to_visit}</span>
                                  </div>
                                )}
                              </div>
                              {intro.popular_areas?.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                  <span className="text-[9px] text-[hsl(var(--p-text-faint,222_10%_40%))] uppercase tracking-wider font-bold">Popular</span>
                                  {intro.popular_areas.slice(0, 3).map((area: string, i: number) => (
                                    <span key={i} className="text-[10px] text-[hsl(var(--p-text-muted,222_12%_65%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2 py-0.5">{area.split("—")[0].trim()}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ) : null;
                      })()}

                      {/* Hotel previews */}
                      {(ui.previewData?.hotelPreviews?.length || ui.previewData?.tjHotelPreviews?.length) ? (
                        <motion.div
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.35 }}
                          className="bg-[hsl(var(--p-card,222_35%_12%))] rounded-2xl border border-[hsl(var(--p-border,222_30%_14%))] overflow-hidden shadow-lg shadow-black/10 backdrop-blur-sm"
                        >
                          <div className="px-4 py-2.5 border-b border-[hsl(var(--p-border,222_30%_14%))] flex items-center gap-2 bg-accent/[0.04]">
                            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                              <Hotel className="w-3.5 h-3.5 text-accent" />
                            </div>
                            <span className="text-xs font-bold text-[hsl(var(--p-text,0_0%_96%))]">Hotels in {extractedParams?.destination_city || "Destination"}</span>
                            <span className="ml-auto text-[9px] font-semibold text-[hsl(var(--p-text-subtle,222_10%_52%))] bg-[hsl(var(--p-card-alt,222_35%_14%))] rounded-full px-2 py-0.5">Preview</span>
                          </div>
                          <div className="divide-y divide-[hsl(var(--p-border,222_30%_14%))]">
                            {(ui.previewData?.hotelPreviews || []).slice(0, 3).map((h, i) => (
                              <div key={`h-${i}`} className="px-4 py-3 flex items-center gap-3">
                                {h.image ? (
                                  <img src={h.image} alt={h.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                    <Hotel className="w-4 h-4 text-accent/60" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-[hsl(var(--p-text,0_0%_96%))] truncate">{h.name}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {Array.from({ length: Math.min(h.stars || 0, 5) }).map((_, s) => (
                                      <Star key={s} className="w-2 h-2 fill-warning text-warning" />
                                    ))}
                                    {h.rating > 0 && <span className="text-[9px] text-[hsl(var(--p-text-subtle,222_10%_52%))] ml-1">{h.rating}★</span>}
                                  </div>
                                </div>
                                {h.price > 0 && (
                                  <p className="text-xs font-bold text-[hsl(var(--p-text-muted,222_12%_65%))] shrink-0">{formatTripPrice(h.price)}</p>
                                )}
                              </div>
                            ))}
                            {(ui.previewData?.tjHotelPreviews || []).slice(0, ui.previewData?.hotelPreviews?.length ? 1 : 3).map((h, i) => (
                              <div key={`tj-${i}`} className="px-4 py-3 flex items-center gap-3">
                                {h.hero_image_url ? (
                                  <img src={h.hero_image_url} alt={h.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                    <Hotel className="w-4 h-4 text-accent/60" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-[hsl(var(--p-text,0_0%_96%))] truncate">{h.name}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {h.rating > 0 && (
                                      <>
                                        {Array.from({ length: Math.min(Math.round(h.rating), 5) }).map((_, s) => (
                                          <Star key={s} className="w-2 h-2 fill-warning text-warning" />
                                        ))}
                                      </>
                                    )}
                                    {h.property_type && <span className="text-[9px] text-[hsl(var(--p-text-subtle,222_10%_52%))] ml-1">{h.property_type}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}

                      {/* Planning suggestion CTA */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center justify-center gap-2 py-3"
                      >
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inset-0 rounded-full bg-primary/25" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary/50" />
                        </span>
                        <span className="text-[11px] text-[hsl(var(--p-text-faint,222_10%_40%))]">
                          {ui.routeIntelLoading ? "Loading route insights…" : "Tell me your dates to get the full trip plan"}
                        </span>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              ) : (
                /* 🟢 EMPTY STATE / LOADING STATE — Alive preview engine */
                <div className={cn("flex flex-col h-full px-5 py-6 overflow-y-auto relative transition-all duration-700", loading && "planner-typing-active")}>
                  {/* Ambient background pulse — intensifies when typing */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full animate-pulse transition-opacity duration-700" style={{ opacity: loading ? 0.1 : 0.04, background: `radial-gradient(circle, hsl(var(--primary)), transparent)` }} />
                  </div>

                  {/* Header */}
                  <div className="text-center mb-6 relative">
                    <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center relative transition-all duration-500" style={{ backgroundColor: `hsl(var(--p-card))`, border: `1px solid hsl(var(--p-border-strong))`, boxShadow: `0 0 ${loading ? '35' : '20'}px hsl(var(--primary) / ${loading ? '0.25' : '0.12'})` }}>
                      <Compass className={cn("w-6 h-6 text-primary transition-transform duration-700", loading && "animate-spin")} style={loading ? { animationDuration: '3s' } : undefined} />
                      {/* Pulsing ring around icon */}
                      <motion.div
                        className="absolute inset-0 rounded-xl"
                        style={{ border: `2px solid hsl(var(--primary) / 0.3)` }}
                        animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-xl"
                        style={{ border: `1px solid hsl(var(--primary) / 0.2)` }}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0, 0.2] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                      />
                    </div>
                    <p className="text-sm font-semibold transition-colors duration-500" style={{ color: (loading && isSearching) ? `hsl(var(--primary))` : `hsl(var(--p-text))` }}>{(loading && isSearching) ? "✨ Creating your personalized trip plan…" : loading ? "💬 Thinking…" : "Live Trip Engine"}</p>
                    <p className="text-[11px] mt-1" style={{ color: `hsl(var(--p-text-subtle))` }}>{(loading && isSearching) ? "Searching flights, hotels & experiences for you" : loading ? "Preparing a response for you" : "Results appear here as you chat"}</p>
                    <div className="flex items-center justify-center gap-2 mt-4 px-3.5 py-2 rounded-full mx-auto" style={{ backgroundColor: (loading && isSearching) ? `hsl(var(--primary) / 0.1)` : loading ? `hsl(var(--primary) / 0.06)` : `hsl(160 60% 45% / 0.1)`, border: `1px solid ${(loading && isSearching) ? `hsl(var(--primary) / 0.2)` : loading ? `hsl(var(--primary) / 0.1)` : `hsl(160 60% 45% / 0.15)`}`, boxShadow: `0 0 16px ${(loading && isSearching) ? `hsl(var(--primary) / 0.12)` : `hsl(160 60% 45% / 0.08)`}`, transition: 'all 0.5s ease' }}>
                      <span className="relative flex h-2 w-2">
                        <motion.span
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: (loading && isSearching) ? `hsl(var(--primary))` : loading ? `hsl(var(--primary) / 0.7)` : `hsl(160 60% 50%)` }}
                          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: (loading && isSearching) ? `hsl(var(--primary))` : loading ? `hsl(var(--primary) / 0.7)` : `hsl(160 60% 50%)` }} />
                      </span>
                      <span className="text-[10px] font-semibold tracking-wide" style={{ color: (loading && isSearching) ? `hsl(var(--primary))` : loading ? `hsl(var(--primary) / 0.8)` : `hsl(160 60% 50%)`, transition: 'color 0.5s ease' }}>
                        {(loading && isSearching) ? "⚡ Creating your trip plan…" : loading ? "💬 Processing…" : "AI Ready — Waiting for your trip"}
                      </span>
                    </div>
                  </div>

                  {/* Preview blocks */}
                  <div className="space-y-3 flex-1 relative">
                    {/* Flights block */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="rounded-xl p-4 relative overflow-hidden"
                      style={{ backgroundColor: `hsl(var(--p-card))`, border: `1px solid hsl(var(--p-border))`, boxShadow: `0 2px 8px hsl(var(--p-shadow))` }}
                    >
                      {/* Shimmer sweep */}
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" style={{ background: `linear-gradient(90deg, transparent, hsl(var(--primary) / 0.03), transparent)` }} />
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                          <Plane className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: `hsl(var(--p-text))` }}>Flights</p>
                          <p className="text-[10px] transition-colors duration-500" style={{ color: loading ? `hsl(var(--primary) / 0.7)` : `hsl(var(--p-text-subtle))` }}>
                            {loading ? (
                              <span className="flex items-center gap-1">
                                Finding the best flight options
                                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>…</motion.span>
                              </span>
                            ) : 'Real-time pricing from multiple airlines'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[1, 2].map(r => (
                          <div key={r} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ backgroundColor: `hsl(var(--p-surface))` }}>
                            <div className="w-8 h-5 rounded animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton))` }} />
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2 rounded-full flex-1 animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton))`, maxWidth: r === 1 ? '5rem' : '4rem' }} />
                                <div className="h-px flex-1" style={{ backgroundColor: `hsl(var(--p-border))` }} />
                                <div className="h-2 rounded-full animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton))`, width: r === 1 ? '3rem' : '3.5rem' }} />
                              </div>
                            </div>
                            <div className="h-3 w-10 rounded animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton))` }} />
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Hotels block */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-xl p-4 relative overflow-hidden"
                      style={{ backgroundColor: `hsl(var(--p-card))`, border: `1px solid hsl(var(--p-border))`, boxShadow: `0 2px 8px hsl(var(--p-shadow))` }}
                    >
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_1.5s_infinite]" style={{ background: `linear-gradient(90deg, transparent, hsl(var(--primary) / 0.03), transparent)` }} />
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                          <Hotel className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: `hsl(var(--p-text))` }}>Hotels</p>
                          <p className="text-[10px] transition-colors duration-500" style={{ color: loading ? `hsl(var(--primary) / 0.7)` : `hsl(var(--p-text-subtle))` }}>
                            {loading ? (
                              <span className="flex items-center gap-1">
                                Checking hotel availability
                                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}>…</motion.span>
                              </span>
                            ) : 'Best deals with live availability'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2].map(r => (
                          <div key={r} className="rounded-lg overflow-hidden" style={{ backgroundColor: `hsl(var(--p-surface))` }}>
                            <div className="h-16 w-full animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton))` }} />
                            <div className="p-2 space-y-1.5">
                              <div className="h-2 rounded-full animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton))`, width: '75%' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Activities block */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 }}
                      className="rounded-xl p-4 relative overflow-hidden"
                      style={{ backgroundColor: `hsl(var(--p-card))`, border: `1px solid hsl(var(--p-border))`, boxShadow: `0 2px 8px hsl(var(--p-shadow))` }}
                    >
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_3s_infinite]" style={{ background: `linear-gradient(90deg, transparent, hsl(var(--primary) / 0.03), transparent)` }} />
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                          <Camera className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: `hsl(var(--p-text))` }}>Experiences & Itinerary</p>
                          <p className="text-[10px] transition-colors duration-500" style={{ color: loading ? `hsl(var(--primary) / 0.7)` : `hsl(var(--p-text-subtle))` }}>
                            {loading ? (
                              <span className="flex items-center gap-1">
                                Designing your day-by-day itinerary
                                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}>…</motion.span>
                              </span>
                            ) : 'Day-by-day plan with curated experiences'}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {['Day 1', 'Day 2', 'Day 3'].map((day, i) => (
                          <div key={day} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: `hsl(var(--p-surface))` }}>
                            <div className="w-10 text-center shrink-0">
                              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `hsl(var(--p-text-faint))` }}>{day}</p>
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="h-2 rounded-full animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton))`, width: `${65 - i * 10}%` }} />
                              <div className="h-1.5 rounded-full animate-pulse" style={{ backgroundColor: `hsl(var(--p-skeleton-dim))`, width: `${45 - i * 5}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* ── STICKY BOOK PACKAGE CTA ── */}
            {displayItinerary && (() => {
              const bd = displayItinerary.budget_estimate.breakdown;
              const pkgTotal = (bd.flights || 0) + (bd.hotels || 0) + (bd.activities || 0) + totalTransferCost;
              return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="shrink-0 px-4 py-3 border-t backdrop-blur-sm planner-cta-bar" style={{ borderColor: `hsl(var(--p-border))`, backgroundColor: `hsl(var(--p-surface-hover))` }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div className="flex items-center gap-1">
                      <Plane className="w-3 h-3 text-primary" />
                      <Check className="w-2.5 h-2.5 text-primary" />
                    </div>
                    <span className="text-[hsl(var(--p-text-faint,222_10%_40%))]">+</span>
                    <div className="flex items-center gap-1">
                      <Hotel className="w-3 h-3 text-accent" />
                      <Check className="w-2.5 h-2.5 text-accent" />
                    </div>
                    <span className="text-[hsl(var(--p-text-faint,222_10%_40%))]">+</span>
                    <div className="flex items-center gap-1">
                      <Camera className="w-3 h-3 text-warning" />
                      <Check className="w-2.5 h-2.5 text-warning" />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: `hsl(var(--p-text-faint))` }}>Package</p>
                    <p className="text-sm font-bold text-primary">{formatTripPrice(pkgTotal)}</p>
                  </div>
                </div>
                <Button
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold gap-2 shadow-lg shadow-primary/20"
                  onClick={() => dispatch({ type: "SET_SHOW_BOOKING_DIALOG", payload: true })}
                  disabled={loading}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Book Package
                </Button>
              </motion.div>
              );
            })()}
          </div>

          {/* Mobile: Show results below chat in single-column flow */}
          {displayItinerary && (
            <div className="lg:hidden flex flex-col" style={{ backgroundColor: `hsl(var(--p-surface-alt))` }}>
              <MobileTripResults
                destination={displayItinerary.destination}
                tripTitle={displayItinerary.trip_title}
                durationDays={displayItinerary.duration_days}
                adults={displayItinerary.adults || displayItinerary.travelers || 1}
                children={displayItinerary.children || 0}
                infants={displayItinerary.infants || 0}
                rooms={displayItinerary.rooms || 1}
                days={displayItinerary.days}
                selectedFlight={displayItinerary.selected_flight}
                selectedHotel={displayItinerary.selected_hotel}
                hotelAlternatives={displayItinerary.hotel_alternatives}
                budgetEstimate={displayItinerary.budget_estimate}
                decisionLayer={displayItinerary.decision_layer}
                conversionSummary={displayItinerary.conversion_summary}
                conversionScore={displayItinerary.conversion_score}
                hasLivePrices={displayItinerary.selected_flight?.is_live_price !== false}
                formatPrice={formatTripPrice}
                loading={loading}
                pdfDownloading={ui.pdfDownloading}
                onBook={() => { trackTripEvent("booking_clicked", { source: "mobile_cta" }); dispatch({ type: "SET_SHOW_BOOKING_DIALOG", payload: true }); }}
                onCustomize={() => { trackTripEvent("customize_clicked", { source: "mobile_cta" }); sendMessage("I'd like to customize this plan"); }}
                onDownloadPDF={() => { trackTripEvent("pdf_downloaded"); window.dispatchEvent(new CustomEvent('vela-download-pdf')); }}
                onBack={() => {
                  // Scroll chat area back into view
                  chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                onShowFlights={() => {
                  dispatch({ type: "SET_POPUP_CITY_TAB", payload: "all" });
                  const hasMulti = allSearchedFlights.some((f: any) => f._legType);
                  if (hasMulti) {
                    const firstLabel = allSearchedFlights.find((f: any) => f._legType === "outbound")?._legLabel;
                    if (firstLabel) dispatch({ type: "SET_FLIGHT_LEG_TAB", payload: firstLabel });
                  } else {
                    dispatch({ type: "SET_FLIGHT_LEG_TAB", payload: "all" });
                  }
                  dispatch({ type: "SET_SHOW_ALL_FLIGHTS_POPUP", payload: true });
                }}
                onShowHotels={() => {
                  dispatch({ type: "SET_ACTIVE_HOTEL_CITY", payload: null });
                  dispatch({ type: "SET_POPUP_CITY_TAB", payload: "all" });
                  dispatch({ type: "SET_SHOW_ALL_HOTELS_POPUP", payload: true });
                }}
                onFlightBook={() => navigateToFlightBooking(displayItinerary.selected_flight, allSearchedFlights, displayItinerary.travelers || 1)}
                onHotelView={() => {
                  const hotelDates = getHotelDates(displayItinerary);
                  const match = allSearchedHotels.find((h: any) => h.name === displayItinerary.selected_hotel?.name);
                  if (match?.id) {
                    const p = new URLSearchParams();
                    if (hotelDates.checkin) p.set("checkin", hotelDates.checkin);
                    if (hotelDates.checkout) p.set("checkout", hotelDates.checkout);
                    const base = buildHotelPath({ id: match.id, name: match.name, city: match.city || displayItinerary.destination });
                    window.open(`${base}${base.includes('?') ? '&' : '?'}${p.toString()}`, '_blank');
                  } else {
                    const p = new URLSearchParams({ city: displayItinerary.destination, q: displayItinerary.selected_hotel?.name || '' });
                    if (hotelDates.checkin) p.set("checkin", hotelDates.checkin);
                    if (hotelDates.checkout) p.set("checkout", hotelDates.checkout);
                    window.open(`/hotels?${p.toString()}`, '_blank');
                  }
                }}
                allFlightsCount={allSearchedFlights.length}
                allHotelsCount={allSearchedHotels.length}
                hotelImage={findHotelImage(displayItinerary.selected_hotel?.name, allSearchedHotels, displayItinerary.selected_hotel?.room_type) || ui.resolvedHotelImage}
                getAirlineInfo={getAirlineInfo}
                formatFlightTime={formatFlightTime}
                resolveCity={resolveCity}
                AirlineLogo={AirlineLogo}
                getHolidaysForDay={getHolidaysForDay}
              />
            </div>
          )}
        </div>
      </div>
      {/* ── Flight Detail Dialog ── */}
      <FlightDetailDialog
        open={ui.flightDetailOpen}
        onOpenChange={(v: any) => dispatch({ type: "SET_FLIGHT_DETAIL_OPEN", payload: v })}
        displayItinerary={displayItinerary}
        getAirlineInfo={getAirlineInfo}
        formatFlightTime={formatFlightTime}
        formatFlightDate={formatFlightDate}
        formatDirectPrice={formatTripPrice}
        userSelectedFlight={userSelectedFlight}
        userSelectedFlightsByLeg={userSelectedFlightsByLeg}
        allSearchedFlights={allSearchedFlights}
        getBaggageFromRawFlights={getBaggageFromRawFlights}
        flightInfoPopup={ui.flightInfoPopup}
        setFlightInfoPopup={(v: any) => dispatch({ type: "SET_FLIGHT_INFO_POPUP", payload: v })}
        supabase={supabase}
        generateFlightInsight={generateFlightInsight}
        navigateToFlightBooking={navigateToFlightBooking}
        resolveCity={resolveCity}
      />

      {/* ── ALL FLIGHTS POPUP ── */}
      <AllFlightsPopup
        open={ui.showAllFlightsPopup}
        onOpenChange={(v: any) => dispatch({ type: "SET_SHOW_ALL_FLIGHTS_POPUP", payload: v })}
        allSearchedFlights={allSearchedFlights}
        displayItinerary={displayItinerary}
        formatDirectPrice={formatTripPrice}
        formatFlightTime={formatFlightTime}
        getAirlineInfo={getAirlineInfo}
        formatAirlineDisplay={formatAirlineDisplay}
        prefixFlightNumber={prefixFlightNumber}
        computeFlightDuration={computeFlightDuration}
        getBaggageFromRawFlights={getBaggageFromRawFlights}
        resolveCity={resolveCity}
        userSelectedFlight={userSelectedFlight}
        setUserSelectedFlight={setUserSelectedFlight}
        userSelectedFlightsByLeg={userSelectedFlightsByLeg}
        setUserSelectedFlightsByLeg={setUserSelectedFlightsByLeg}
        flightFilterStops={ui.flightFilterStops}
        setFlightFilterStops={(v: any) => dispatch({ type: "SET_FLIGHT_FILTER_STOPS", payload: v })}
        flightFilterAirline={ui.flightFilterAirline}
        setFlightFilterAirline={(v: any) => dispatch({ type: "SET_FLIGHT_FILTER_AIRLINE", payload: v })}
        flightSortBy={ui.flightSortBy}
        setFlightSortBy={(v: any) => dispatch({ type: "SET_FLIGHT_SORT_BY", payload: v })}
        flightLegTab={ui.flightLegTab}
        setFlightLegTab={(v: any) => dispatch({ type: "SET_FLIGHT_LEG_TAB", payload: v })}
        flightInfoPopup={ui.flightInfoPopup}
        setFlightInfoPopup={(v: any) => dispatch({ type: "SET_FLIGHT_INFO_POPUP", payload: v })}
        supabase={supabase}
        toast={toast}
      />

      {/* ── ALL HOTELS POPUP ── */}
      <AllHotelsPopup
        open={ui.showAllHotelsPopup}
        onOpenChange={(v: any) => { dispatch({ type: "SET_SHOW_ALL_HOTELS_POPUP", payload: v }); if (!v) dispatch({ type: "SET_ACTIVE_HOTEL_CITY", payload: null }); }}
        allSearchedHotels={allSearchedHotels}
        searchedCities={searchedCities}
        hotelsByCity={hotelsByCity}
        displayItinerary={displayItinerary}
        formatDirectPrice={formatTripPrice}
        getNightsForCity={getNightsForCity}
        buildHotelPath={buildHotelPath}
        ImageCarousel={ImageCarousel}
        userSelectedHotel={userSelectedHotel}
        setUserSelectedHotel={setUserSelectedHotel}
        userSelectedHotelsByCity={userSelectedHotelsByCity}
        setUserSelectedHotelsByCity={setUserSelectedHotelsByCity}
        hotelSortChip={ui.hotelSortChip}
        setHotelSortChip={(v: any) => dispatch({ type: "SET_HOTEL_SORT_CHIP", payload: v })}
        hotelFilterBreakfast={ui.hotelFilterBreakfast}
        setHotelFilterBreakfast={(v: any) => dispatch({ type: "SET_HOTEL_FILTER_BREAKFAST", payload: v })}
        hotelSearchQuery={ui.hotelSearchQuery}
        setHotelSearchQuery={(v: any) => dispatch({ type: "SET_HOTEL_SEARCH_QUERY", payload: v })}
        popupCityTab={ui.popupCityTab}
        setPopupCityTab={(v: any) => dispatch({ type: "SET_POPUP_CITY_TAB", payload: v })}
        setLightboxImages={(v: any) => dispatch({ type: "OPEN_LIGHTBOX", payload: { images: v, startIdx: 0 } })}
        setLightboxIdx={(v: any) => dispatch({ type: "SET_LIGHTBOX_IDX", payload: v })}
        setLightboxOpen={(v: any) => v ? void 0 : dispatch({ type: "CLOSE_LIGHTBOX" })}
        aiRecommendedHotelsByCity={ui.aiRecommendedHotelsByCity}
        activeHotelCity={ui.activeHotelCity}
        onLoadMore={handleLoadMoreHotels}
        isLoadingMore={isLoadingMoreHotels}
      />

      {/* ── HOTEL IMAGE GALLERY POPUP ── */}
      <Dialog open={ui.lightboxOpen} onOpenChange={(v: any) => v ? void 0 : dispatch({ type: "CLOSE_LIGHTBOX" })}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] p-0 overflow-hidden border-0 rounded-2xl [&>button]:text-white/70 [&>button]:hover:text-white [&>button]:opacity-100 [&>button]:z-20"
          style={{ background: `hsl(222 28% 10%)`, boxShadow: `0 25px 60px -15px rgba(0,0,0,0.8)` }}
        >
          <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center">
            {ui.lightboxImages[ui.lightboxIdx] && (
              <img src={ui.lightboxImages[ui.lightboxIdx]} alt={`Hotel photo ${ui.lightboxIdx + 1}`} className="w-full h-full object-contain" />
            )}
            {ui.lightboxImages.length > 1 && (
              <>
                <button className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: `hsl(0 0% 0% / 0.5)`, color: `white` }} onClick={() => dispatch({ type: "SET_LIGHTBOX_IDX", payload: (ui.lightboxIdx - 1 + ui.lightboxImages.length) % ui.lightboxImages.length })}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ background: `hsl(0 0% 0% / 0.5)`, color: `white` }} onClick={() => dispatch({ type: "SET_LIGHTBOX_IDX", payload: (ui.lightboxIdx + 1) % ui.lightboxImages.length })}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold rounded-full px-3 py-1" style={{ background: `hsl(0 0% 0% / 0.6)`, color: `white` }}>
              {ui.lightboxIdx + 1} / {ui.lightboxImages.length}
            </div>
          </div>
          {ui.lightboxImages.length > 1 && (
            <div className="flex gap-1.5 p-3 overflow-x-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `hsl(220 25% 24%) transparent` }}>
              {ui.lightboxImages.map((img, i) => (
                <button key={i} onClick={() => dispatch({ type: "SET_LIGHTBOX_IDX", payload: i })} className="w-14 h-10 rounded-md overflow-hidden flex-shrink-0 transition-all" style={{ border: i === ui.lightboxIdx ? `2px solid hsl(var(--accent))` : `1px solid hsl(220 25% 20%)`, opacity: i === ui.lightboxIdx ? 1 : 0.5 }}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── ALL ACTIVITIES POPUP ── */}
      <AllActivitiesPopup
        open={ui.showAllActivitiesPopup}
        onOpenChange={(v: any) => dispatch({ type: "SET_SHOW_ALL_ACTIVITIES_POPUP", payload: v })}
        allSearchedActivities={allSearchedActivities}
        searchedCities={searchedCities}
        activitiesByCity={activitiesByCity}
        displayItinerary={displayItinerary}
        formatDirectPrice={formatTripPrice}
        calcActivityCost={calcActivityCost}
        ImageCarousel={ImageCarousel}
        userSelectedActivities={userSelectedActivities}
        setUserSelectedActivities={setUserSelectedActivities}
        dayActivityOverrides={dayActivityOverrides}
        setDayActivityOverrides={setDayActivityOverrides}
        swapTarget={swapTarget}
        setSwapTarget={setSwapTarget}
        activitySortBy={ui.activitySortBy}
        setActivitySortBy={(v: any) => dispatch({ type: "SET_ACTIVITY_SORT_BY", payload: v })}
        activitySearchQuery={ui.activitySearchQuery}
        setActivitySearchQuery={(v: any) => dispatch({ type: "SET_ACTIVITY_SEARCH_QUERY", payload: v })}
        popupCityTab={ui.popupCityTab}
        setPopupCityTab={(v: any) => dispatch({ type: "SET_POPUP_CITY_TAB", payload: v })}
        onLoadMore={handleLoadMoreActivities}
        isLoadingMore={isLoadingMoreActivities}
      />

      {/* ── DAY EDITOR DIALOG ── */}
      <Dialog open={editingDayIdx !== null} onOpenChange={(open) => { if (!open) setEditingDayIdx(null); }}>
        <DialogContent
          data-planner-theme="dark"
          className="max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden border-0 rounded-2xl [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/10"
          style={{ background: `hsl(220 42% 8%)`, boxShadow: `0 40px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px hsl(var(--primary) / 0.15)` }}
        >
          {editingDayIdx !== null && structuredItinerary?.days?.[editingDayIdx] && (() => {
            const day = structuredItinerary.days[editingDayIdx];
            return (
              <>
                {/* Header */}
                <div className="px-5 pt-5 pb-3" style={{ background: `linear-gradient(180deg, hsl(var(--primary) / 0.08) 0%, transparent 100%)` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `hsl(var(--primary) / 0.15)`, border: `1px solid hsl(var(--primary) / 0.2)` }}>
                      <span className="text-sm font-bold text-primary">{day.day}</span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold" style={{ color: `hsl(var(--p-text))` }}>{day.title}</h2>
                      <p className="text-[11px]" style={{ color: `hsl(var(--p-text-muted))` }}>{day.activities.length} activities</p>
                    </div>
                  </div>
                </div>

                {/* Activities list */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5" style={{ background: `hsl(220 42% 7%)` }}>
                  {day.activities.map((act, actIdx) => {
                    const Icon = categoryIcon[act.category] || Camera;
                    return (
                      <div
                        key={actIdx}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 group/editact"
                        style={{ background: `hsl(220 35% 16%)`, border: `1px solid hsl(220 28% 20%)` }}
                      >
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => moveActivity(editingDayIdx, actIdx, "up")}
                            disabled={actIdx === 0}
                            className="w-5 h-5 rounded flex items-center justify-center transition-colors disabled:opacity-20"
                            style={{ color: `hsl(var(--p-text-muted))` }}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveActivity(editingDayIdx, actIdx, "down")}
                            disabled={actIdx === day.activities.length - 1}
                            className="w-5 h-5 rounded flex items-center justify-center transition-colors disabled:opacity-20"
                            style={{ color: `hsl(var(--p-text-muted))` }}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-[11px] font-mono font-semibold w-10 shrink-0" style={{ color: `hsl(var(--p-text-subtle))` }}>{act.time}</span>
                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: `hsl(var(--p-text-muted))` }} />
                        <div className="flex-1 min-w-0">
                          {(act as any).product_code ? (
                            <a
                              href={buildTourUrl({ title: buildActivityDisplayName(act), destination: (act as any).city || "", productCode: (act as any).product_code, velaId: (act as any).vela_id, slug: (act as any).slug })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold truncate block hover:underline transition-colors"
                              style={{ color: `hsl(var(--primary))` }}
                              onClick={e => e.stopPropagation()}
                            >
                              {buildActivityDisplayName(act)}
                            </a>
                          ) : (
                            <p className="text-xs font-semibold truncate" style={{ color: `hsl(var(--p-text))` }}>
                              {buildActivityDisplayName(act)}
                            </p>
                          )}
                          {(act as any).option_title && (() => {
                            const matchedProduct = allSearchedActivities.find((p: any) => {
                              const pk = p.productCode || p.product_code;
                              return pk && pk === (act as any).product_code;
                            });
                            const opts = matchedProduct?.productOptions || [];
                            return (
                              <OptionPickerBadge
                                optionTitle={(act as any).option_title}
                                optionCode={(act as any).product_option_code}
                                productOptions={opts}
                                basePrice={matchedProduct?.price}
                                formatPrice={formatTripPrice}
                                onOptionChange={(opt) => {
                                  const key = `${editingDayIdx}-${actIdx}`;
                                  const newAct = { ...(act as any), option_title: opt.title || opt.description || "", product_option_code: opt.productOptionCode, cost_estimate: opt.fromPrice || (act as any).cost_estimate };
                                  setDayActivityOverrides(prev => ({ ...prev, [key]: { ...matchedProduct, ...newAct, productCode: (act as any).product_code, name: (act as any).activity } }));
                                }}
                              />
                            );
                          })()}
                          {getActivityDisplayHighlights(act).length > 0 && (
                            <div className="flex flex-wrap gap-x-1.5 gap-y-0 mt-0.5">
                              {getActivityDisplayHighlights(act).slice(0, 3).map((h: string, hi: number) => (
                                <span key={hi} className="text-[8px]" style={{ color: `hsl(var(--p-text-muted))` }}>✓ {h.length > 25 ? h.slice(0, 23) + "…" : h}</span>
                              ))}
                            </div>
                          )}
                          {act.cost_estimate > 0 && act.is_live_price && (
                            <span className="text-[10px] font-bold text-success">
                              {formatTripPrice(act.cost_estimate)}
                            </span>
                          )}
                          {(!act.cost_estimate || act.cost_estimate === 0) && (act as any).source === "free" && act.category !== "hotel" && act.category !== "transport" && (
                            <span className="text-[9px] font-bold text-success bg-success/10 rounded px-1.5 py-[1px]">Free</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Move to another day */}
                          {structuredItinerary.days.length > 1 && (
                            <div className="relative">
                              <button
                                onClick={() => setMoveToDayTarget(
                                  moveToDayTarget?.dayIdx === editingDayIdx && moveToDayTarget?.actIdx === actIdx
                                    ? null
                                    : { dayIdx: editingDayIdx, actIdx }
                                )}
                                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-primary/15"
                                style={{ color: `hsl(var(--p-text-muted))` }}
                                title="Move to another day"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              {moveToDayTarget?.dayIdx === editingDayIdx && moveToDayTarget?.actIdx === actIdx && (
                                <div
                                  className="absolute right-0 top-7 z-50 rounded-lg py-1 shadow-xl min-w-[120px]"
                                  style={{ background: `hsl(220 35% 20%)`, border: `1px solid hsl(220 28% 28%)` }}
                                >
                                  {structuredItinerary.days.map((d, di) => {
                                    if (di === editingDayIdx) return null;
                                    // Only allow moving within the same city
                                    const sourceCity = getCityForDay(editingDayIdx);
                                    const targetCity = getCityForDay(di);
                                    if (searchedCities.length > 1 && sourceCity !== targetCity) return null;
                                    return (
                                      <button
                                        key={di}
                                        onClick={() => {
                                          moveActivityToDay(editingDayIdx, actIdx, di);
                                          setMoveToDayTarget(null);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-primary/15 transition-colors"
                                        style={{ color: `hsl(var(--p-text))` }}
                                      >
                                        Day {d.day}: {d.title?.replace(/^Day\s+\d+\s*[-–—:]\s*/i, "").slice(0, 20)}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {allSearchedActivities.length > 0 && (act.category === "activity" || act.source === "travelvela") && (
                            <button
                              onClick={() => { const cityForDay = searchedCities.length > 1 ? getCityForDay(editingDayIdx) : "all"; dispatch({ type: "SET_POPUP_CITY_TAB", payload: cityForDay }); setSwapTarget({ dayIdx: editingDayIdx, actIdx }); dispatch({ type: "SET_SHOW_ALL_ACTIVITIES_POPUP", payload: true }); }}
                              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-primary/15"
                              style={{ color: `hsl(var(--p-text-muted))` }}
                              title="Swap activity"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => removeActivity(editingDayIdx, actIdx)}
                            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-destructive/15"
                            style={{ color: `hsl(var(--p-text-muted))` }}
                            title="Remove activity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add activity from search */}
                  {allSearchedActivities.length > 0 && (
                    <button
                      onClick={() => { setSwapTarget(null); dispatch({ type: "SET_SHOW_ALL_ACTIVITIES_POPUP", payload: true }); }}
                      className="w-full rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      style={{ border: `1px dashed hsl(220 30% 22%)`, color: `hsl(var(--p-text-muted))` }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add from Search
                    </button>
                  )}

                  {/* AI Suggestion to improve day */}
                  <div
                    className="rounded-lg px-3 py-2.5 space-y-2"
                    style={{ border: `1px dashed hsl(220 30% 22%)`, background: `hsl(220 35% 12%)` }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: `hsl(var(--p-text-muted))` }}>
                      <Sparkles className="w-3 h-3" /> Suggest Improvement
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={daySuggestionText}
                        onChange={(e) => setDaySuggestionText(e.target.value)}
                        placeholder="e.g. Add cable car ride, group Sentosa activities"
                        disabled={daySuggestionLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && daySuggestionText.trim() && !daySuggestionLoading) {
                            improveDayWithAI(editingDayIdx!, daySuggestionText);
                          }
                        }}
                        className="flex-1 rounded-md px-2.5 py-1.5 text-xs bg-transparent placeholder:text-[hsl(var(--p-text-faint))] focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
                        style={{ border: `1px solid hsl(220 28% 22%)`, color: `hsl(var(--p-text))` }}
                      />
                      <button
                        onClick={() => {
                          if (daySuggestionText.trim() && !daySuggestionLoading) {
                            improveDayWithAI(editingDayIdx!, daySuggestionText);
                          }
                        }}
                        disabled={!daySuggestionText.trim() || daySuggestionLoading}
                        className="w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-30"
                        style={{ background: `hsl(var(--primary) / 0.2)`, color: `hsl(var(--primary))` }}
                      >
                        {daySuggestionLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {daySuggestionLoading && (
                      <p className="text-[10px] animate-pulse" style={{ color: `hsl(var(--p-text-muted))` }}>
                        AI is optimizing your day...
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `1px solid hsl(220 28% 20%)`, background: `hsl(220 42% 9%)` }}>
                  {structuredItinerary.days.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
                      onClick={() => {
                        if (confirm('Remove this entire day?')) removeDayFromItinerary(editingDayIdx);
                      }}
                    >
                      <Trash2 className="w-3 h-3" /> Remove Day
                    </Button>
                  ) : <div />}
                  <Button
                    size="sm"
                    className="h-8 text-xs rounded-lg px-5 font-bold text-primary-foreground"
                    style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))`, boxShadow: `0 4px 16px hsl(var(--primary) / 0.35)` }}
                    onClick={() => setEditingDayIdx(null)}
                  >
                    Done
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      {/* ── BOOKING DIALOG ── */}
      <Dialog open={ui.showBookingDialog} onOpenChange={(v) => { dispatch({ type: "SET_SHOW_BOOKING_DIALOG", payload: v }); if (!v) dispatch({ type: "SET_BOOKING_INITIAL_TIER", payload: undefined }); }}>
        <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl overflow-hidden">
          {displayItinerary && (
            <BookingDialogContent itinerary={displayItinerary} onClose={() => { dispatch({ type: "SET_SHOW_BOOKING_DIALOG", payload: false }); dispatch({ type: "SET_BOOKING_INITIAL_TIER", payload: undefined }); }} initialTier={ui.bookingInitialTier} resolveCity={resolveCity} />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default TripPlanner;
