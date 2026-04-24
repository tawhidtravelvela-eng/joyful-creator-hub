/**
 * useTripSearch — orchestrates the sendMessage flow, progressive search,
 * and AI generation for the Trip Planner.
 * Extracted from TripPlanner.tsx for maintainability.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import type { Msg, LiveData, ExtractedParams, Itinerary, InspirationData, HybridPreviewData } from "@/components/trip-planner/tripTypes";
import type { RefinementState } from "@/components/trip-planner/TripRefinementControls";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { hydrateFlightsFromWire } from "@/lib/flightWireAdapter";
import {
  loadCachedSearchedFlights, saveCachedSearchedFlights,
  loadCachedSearchedHotels, saveCachedSearchedHotels,
  loadCachedHotelsByCity, saveCachedHotelsByCity,
  loadCachedSearchedActivities, saveCachedSearchedActivities,
  loadCachedActivitiesByCity, saveCachedActivitiesByCity,
  saveCachedLiveData,
  loadCachedExtractedParams, saveCachedExtractedParams,
  loadCachedRefinement, saveCachedRefinement,
  loadCachedAiTravelers, saveCachedAiTravelers,
  loadCachedSearchedCities, saveCachedSearchedCities,
  CACHE_EXTRACTED_PARAMS_KEY, CACHE_REFINEMENT_KEY, CACHE_AI_TRAVELERS_KEY,
} from "@/components/trip-planner/tripCacheHelpers";
import { normalizeItinerary, parseItinerary, getTextContent, sanitizeMessages, sanitizeRetryContent } from "@/components/trip-planner/tripParsingUtils";
import { resolveCity, getHotelImg, getSelectedRoomImg, aggregateFlightFareBreakdown } from "@/components/trip-planner/tripPricingUtils";

// ── Types ──

export interface UseTripSearchParams {
  /** Current messages ref (kept in sync by useTripChat) */
  messagesRef: React.MutableRefObject<Msg[]>;
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  setLastLiveData: React.Dispatch<React.SetStateAction<LiveData>>;
  setStructuredItinerary: React.Dispatch<React.SetStateAction<Itinerary | null>>;
  structuredItinerary: Itinerary | null;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  currency: string;
  /** Called to clear the chat input field after sending */
  clearInput?: () => void;
  /** Called when a day_fix arrives — receives dayIndex and new activities */
  onDayFix?: (dayIndex: number, activities: any[]) => void;
  /** Called when day_fix_multi arrives — receives array of patches */
  onDayFixMulti?: (patches: { dayIndex: number; activities: any[] }[]) => void;
  /** Called when previewData arrives */
  onPreviewData?: (data: any) => void;
  /** Fallback text when no explicit text is passed to sendMessage */
  getInputText?: () => string;
}

export interface UseTripSearchReturn {
  // Core actions
  sendMessage: (text?: string, triggerSearch?: boolean, isRetry?: boolean) => Promise<void>;

  // Loading state
  loading: boolean;
  isSearching: boolean;
  rightPanelError: boolean;
  setRightPanelError: React.Dispatch<React.SetStateAction<boolean>>;

  // Search results
  allSearchedFlights: any[];
  setAllSearchedFlights: React.Dispatch<React.SetStateAction<any[]>>;
  allSearchedHotels: any[];
  setAllSearchedHotels: React.Dispatch<React.SetStateAction<any[]>>;
  backendResolvedTransfers: any[];
  allSearchedActivities: any[];
  setAllSearchedActivities: React.Dispatch<React.SetStateAction<any[]>>;
  hotelsByCity: Record<string, any[]>;
  setHotelsByCity: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  activitiesByCity: Record<string, any[]>;
  setActivitiesByCity: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  searchedCities: { name: string; days: number; nights?: number }[];
  setSearchedCities: React.Dispatch<React.SetStateAction<{ name: string; days: number; nights?: number }[]>>;

  // Progressive search UI
  progressiveFlights: any[] | null;
  progressiveHotels: any[] | null;
  progressiveActivities: any[] | null;
  searchPhase: "idle" | "searching" | "generating";
  genProgressStep: number;
  genProgressLabel: string;

  // Extracted params
  extractedParams: ExtractedParams | null;
  setExtractedParams: React.Dispatch<React.SetStateAction<ExtractedParams | null>>;
  languageSession: { current_language: string; last_strong_language: string; user_language_switched: boolean } | null;
  setLanguageSession: React.Dispatch<React.SetStateAction<{ current_language: string; last_strong_language: string; user_language_switched: boolean } | null>>;

  // Missing fields for picker UI
  lastMissingFields: string[];
  setLastMissingFields: React.Dispatch<React.SetStateAction<string[]>>;

  // Refinement
  refinement: RefinementState;
  setRefinement: React.Dispatch<React.SetStateAction<RefinementState>>;
  aiTravelers: { adults: number; children: number; infants: number } | null;
  setAiTravelers: React.Dispatch<React.SetStateAction<{ adults: number; children: number; infants: number } | null>>;
  refinementSyncedRef: React.MutableRefObject<boolean>;
  itinerarySyncedRef: React.MutableRefObject<string | null>;

  // User selections
  userSelectedFlight: any | null;
  setUserSelectedFlight: React.Dispatch<React.SetStateAction<any | null>>;
  userSelectedFlightsByLeg: Record<string, any>;
  setUserSelectedFlightsByLeg: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  userSelectedHotel: any | null;
  setUserSelectedHotel: React.Dispatch<React.SetStateAction<any | null>>;
  userSelectedHotelsByCity: Record<string, any>;
  setUserSelectedHotelsByCity: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  userSelectedActivities: any[];
  setUserSelectedActivities: React.Dispatch<React.SetStateAction<any[]>>;
  dayActivityOverrides: Record<string, any>;
  setDayActivityOverrides: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  swapTarget: { dayIdx: number; actIdx: number } | null;
  setSwapTarget: React.Dispatch<React.SetStateAction<{ dayIdx: number; actIdx: number } | null>>;

  // Sending guard ref
  sendingRef: React.MutableRefObject<boolean>;

  // Debug mode
  debugModeRef: React.MutableRefObject<boolean>;
  debugSnapshots: any;
  setDebugSnapshots: React.Dispatch<React.SetStateAction<any>>;

  // Inspiration mode
  inspirationData: InspirationData | null;
  setInspirationData: React.Dispatch<React.SetStateAction<InspirationData | null>>;

  // Hybrid preview mode
  hybridPreviewData: HybridPreviewData | null;
  setHybridPreviewData: React.Dispatch<React.SetStateAction<HybridPreviewData | null>>;

  // Reset method for new trip
  resetSearchState: () => void;
}

const DEFAULT_REFINEMENT: RefinementState = {
  budgetRange: [300, 2000],
  adults: 1,
  children: 0,
  infants: 0,
  cabinClass: "economy",
  hotelStars: 0,
  travelStyle: "",
  directFlightsOnly: false,
  flexibleDates: true,
  includeBreakfast: false,
};

export function useTripSearch({
  messagesRef, setMessages, setLastLiveData, setStructuredItinerary,
  structuredItinerary, inputRef, currency,
  clearInput, onDayFix, onDayFixMulti, onPreviewData, getInputText,
}: UseTripSearchParams): UseTripSearchReturn {

  // ── Loading & error state ──
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [rightPanelError, setRightPanelError] = useState(false);
  const sendingRef = useRef(false);
  const debugModeRef = useRef(false);
  const [debugSnapshots, setDebugSnapshots] = useState<any>(null);
  const [inspirationData, setInspirationData] = useState<InspirationData | null>(null);
  const [hybridPreviewData, setHybridPreviewData] = useState<HybridPreviewData | null>(null);

  // ── Search results ──
  const [allSearchedFlights, setAllSearchedFlights] = useState<any[]>(() => loadCachedSearchedFlights());
  const [allSearchedHotels, setAllSearchedHotels] = useState<any[]>(() => loadCachedSearchedHotels());
  const [allSearchedActivities, setAllSearchedActivities] = useState<any[]>(() => loadCachedSearchedActivities());
  const [backendResolvedTransfers, setBackendResolvedTransfers] = useState<any[]>([]);
  const [hotelsByCity, setHotelsByCity] = useState<Record<string, any[]>>(() => loadCachedHotelsByCity());
  const [activitiesByCity, setActivitiesByCity] = useState<Record<string, any[]>>(() => loadCachedActivitiesByCity());
  const [searchedCities, setSearchedCities] = useState<{ name: string; days: number; nights?: number }[]>(() => loadCachedSearchedCities());

  // ── Progressive search UI ──
  const [progressiveFlights, setProgressiveFlights] = useState<any[] | null>(null);
  const [progressiveHotels, setProgressiveHotels] = useState<any[] | null>(null);
  const [progressiveActivities, setProgressiveActivities] = useState<any[] | null>(null);
  const [searchPhase, setSearchPhase] = useState<"idle" | "searching" | "generating">("idle");
  const [genProgressStep, setGenProgressStep] = useState(0);

  // ── Extracted params & language ──
  const [extractedParams, setExtractedParams] = useState<ExtractedParams | null>(() => loadCachedExtractedParams());
  const [languageSession, setLanguageSession] = useState<{ current_language: string; last_strong_language: string; user_language_switched: boolean } | null>(null);
  const [lastMissingFields, setLastMissingFields] = useState<string[]>([]);

  // ── Refinement ──
  const [refinement, setRefinement] = useState<RefinementState>(() => loadCachedRefinement() || { ...DEFAULT_REFINEMENT });
  const [aiTravelers, setAiTravelers] = useState<{ adults: number; children: number; infants: number } | null>(() => loadCachedAiTravelers());
  const refinementSyncedRef = useRef(!!loadCachedExtractedParams());
  const itinerarySyncedRef = useRef<string | null>(null);

  // ── User selections ──
  const [userSelectedFlight, setUserSelectedFlight] = useState<any | null>(null);
  const [userSelectedFlightsByLeg, setUserSelectedFlightsByLeg] = useState<Record<string, any>>({});
  const [userSelectedHotel, setUserSelectedHotel] = useState<any | null>(null);
  const [userSelectedHotelsByCity, setUserSelectedHotelsByCity] = useState<Record<string, any>>({});
  const [userSelectedActivities, setUserSelectedActivities] = useState<any[]>([]);
  const [dayActivityOverrides, setDayActivityOverrides] = useState<Record<string, any>>({});
  const [swapTarget, setSwapTarget] = useState<{ dayIdx: number; actIdx: number } | null>(null);

  // ── Persist extractedParams, refinement, aiTravelers to localStorage ──
  useEffect(() => { saveCachedExtractedParams(extractedParams); }, [extractedParams]);
  useEffect(() => { saveCachedRefinement(refinement); }, [refinement]);
  useEffect(() => { saveCachedAiTravelers(aiTravelers); }, [aiTravelers]);
  useEffect(() => { saveCachedSearchedCities(searchedCities); }, [searchedCities]);

  // ── Restore search results from cache when tab becomes visible (browser hibernation recovery) ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // If state is empty but cache has data, restore it
      if (allSearchedFlights.length === 0) {
        const cached = loadCachedSearchedFlights();
        if (cached.length > 0) {
          console.log(`[TabRestore] Restoring ${cached.length} flights from cache`);
          setAllSearchedFlights(cached);
        }
      }
      if (allSearchedHotels.length === 0) {
        const cached = loadCachedSearchedHotels();
        if (cached.length > 0) {
          console.log(`[TabRestore] Restoring ${cached.length} hotels from cache`);
          setAllSearchedHotels(cached);
        }
      }
      if (allSearchedActivities.length === 0) {
        const cached = loadCachedSearchedActivities();
        if (cached.length > 0) {
          console.log(`[TabRestore] Restoring ${cached.length} activities from cache`);
          setAllSearchedActivities(cached);
        }
      }
      if (Object.keys(hotelsByCity).length === 0) {
        const cached = loadCachedHotelsByCity();
        if (Object.keys(cached).length > 0) {
          console.log(`[TabRestore] Restoring hotels by city from cache`);
          setHotelsByCity(cached);
        }
      }
      if (Object.keys(activitiesByCity).length === 0) {
        const cached = loadCachedActivitiesByCity();
        if (Object.keys(cached).length > 0) {
          console.log(`[TabRestore] Restoring activities by city from cache`);
          setActivitiesByCity(cached);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [allSearchedFlights.length, allSearchedHotels.length, allSearchedActivities.length, hotelsByCity, activitiesByCity]);

  // ── Reset for new trip ──
  const resetSearchState = useCallback(() => {
    setRightPanelError(false);
    setIsSearching(false);
    setLoading(false);
    setExtractedParams(null);
    setLanguageSession(null);
    setLastMissingFields([]);
    refinementSyncedRef.current = false;
    setAiTravelers(null);
    itinerarySyncedRef.current = null;
    setAllSearchedFlights([]);
    setAllSearchedHotels([]);
    setHotelsByCity({});
    setAllSearchedActivities([]);
    setActivitiesByCity({});
    setSearchedCities([]);
    setProgressiveFlights(null);
    setProgressiveHotels(null);
    setProgressiveActivities(null);
    setSearchPhase("idle");
    setGenProgressStep(0);
    setUserSelectedFlight(null);
    setUserSelectedFlightsByLeg({});
    setUserSelectedHotel(null);
    setUserSelectedHotelsByCity({});
    setUserSelectedActivities([]);
    setDayActivityOverrides({});
    setSwapTarget(null);
    setRefinement({ ...DEFAULT_REFINEMENT });
    setInspirationData(null);
    setHybridPreviewData(null);
    // Clear refinement caches
    saveCachedExtractedParams(null);
    saveCachedRefinement(null);
    saveCachedAiTravelers(null);
    saveCachedSearchedCities([]);
  }, []);

  // ── Progress streaming state ──
  const [genProgressLabel, setGenProgressLabel] = useState<string>("");
  const progressChannelRef = useRef<any>(null);
  const progressIdRef = useRef<string>("");

  // ── Real-time progress subscription via Supabase Realtime Broadcast ──
  // Falls back to timer-based progress if no events arrive within 8s
  useEffect(() => {
    if (searchPhase !== "generating") {
      setGenProgressStep(0);
      setGenProgressLabel("");
      // Cleanup channel if phase exits
      if (progressChannelRef.current) {
        supabase.removeChannel(progressChannelRef.current);
        progressChannelRef.current = null;
      }
      return;
    }

    const progressId = progressIdRef.current;
    if (!progressId) {
      // No progressId — use timer fallback
      setGenProgressStep(0);
      const cities = extractedParams?.cities?.length || 1;
      const nights = extractedParams?.cities?.reduce((s: number, c: any) => s + (c.nights || (c.days ? Math.max(c.days - 1, 1) : 2)), 0) || 3;
      const isMulti = cities >= 2 || nights >= 6;
      const estimatedMs = isMulti ? 50000 : 25000;
      const stepDelay = estimatedMs / 7;
      const timers = [1, 2, 3, 4, 5, 6].map((step) => setTimeout(() => setGenProgressStep(step), step * stepDelay));
      return () => timers.forEach(clearTimeout);
    }

    // Subscribe to real-time progress channel
    let gotRealEvent = false;
    const channel = supabase.channel(`trip-progress-${progressId}`)
      .on("broadcast", { event: "progress" }, (payload: any) => {
        const { step, label } = payload.payload || {};
        if (typeof step === "number") {
          gotRealEvent = true;
          // Only move progress forward — never backward (parallel tasks finish out of order)
          setGenProgressStep(prev => Math.max(prev, step));
          if (label) setGenProgressLabel(label);
          console.log(`[Progress] Step ${step}: ${label || ""}`);
        }
      })
      .subscribe();

    progressChannelRef.current = channel;

    // Fallback: if no real events arrive within 8s, start timer-based progress
    const fallbackTimer = setTimeout(() => {
      if (!gotRealEvent) {
        console.log("[Progress] No real-time events — falling back to timer");
        const stepTimers = [1, 2, 3, 4, 5, 6].map((step) => setTimeout(() => {
          if (!gotRealEvent) setGenProgressStep(prev => Math.max(prev, step));
        }, step * 5000));
        // store for cleanup
        (channel as any)._fallbackTimers = stepTimers;
      }
    }, 8000);

    return () => {
      clearTimeout(fallbackTimer);
      const fbTimers = (channel as any)?._fallbackTimers;
      if (fbTimers) fbTimers.forEach((t: any) => clearTimeout(t));
      supabase.removeChannel(channel);
      progressChannelRef.current = null;
    };
  }, [searchPhase, extractedParams]);

  const buildItinerarySummary = useCallback((itin: any) => {
    if (!itin) return undefined;
    // Send structured JSON with full metadata so backend can merge properly
    const days = (itin.days || []).map((d: any, i: number) => ({
      day: i + 1,
      title: d.title || `Day ${i + 1}`,
      city: d.city || d.hotel?.area || "",
      activities: (d.activities || []).map((a: any) => ({
        time: a.time || "",
        activity: a.activity || a.title || a.name || "",
        description: a.description || "",
        category: a.category || "activity",
        cost_estimate: a.cost_estimate || 0,
        product_code: a.product_code || undefined,
        product_name: a.product_name || undefined,
        source: a.source || undefined,
        is_live_price: a.is_live_price || undefined,
        highlights: a.highlights || undefined,
        places_covered: a.places_covered || undefined,
        booking_url: a.booking_url || undefined,
        vela_id: a.vela_id || undefined,
        slug: a.slug || undefined,
      })),
    }));
    return { days };
  }, []);

  // ── Core sendMessage ──
  const sendMessage = useCallback(async (text?: string, triggerSearch = false, isRetry = false) => {
    const rawText = (text || getInputText?.() || "").trim();
    if (!rawText || loading || sendingRef.current) return;
    sendingRef.current = true;
    const msgText = sanitizeRetryContent(rawText);
    clearInput?.();

    const baseMessages = sanitizeMessages(messagesRef.current);
    const hadSanitizedMessages = JSON.stringify(baseMessages) !== JSON.stringify(messagesRef.current);
    if (hadSanitizedMessages) {
      setMessages(baseMessages);
    }

    let currentMessages = baseMessages;

    if (!isRetry) {
      const userMsg: Msg = { role: "user", content: msgText };
      currentMessages = [...baseMessages, userMsg];
      setMessages(currentMessages);
    }
    setLoading(true);
    setIsSearching(triggerSearch);
    setRightPanelError(false);
    setLastMissingFields([]);

    // Build refinement overrides from control bar
    const refinementOverrides: Record<string, any> = {};
    if (refinement.budgetRange[0] !== 300 || refinement.budgetRange[1] !== 2000) {
      refinementOverrides.budget_min = refinement.budgetRange[0];
      refinementOverrides.budget_max = refinement.budgetRange[1];
    }
    const aiA = aiTravelers?.adults ?? 1;
    const aiC = aiTravelers?.children ?? 0;
    const aiI = aiTravelers?.infants ?? 0;
    if (refinement.adults !== aiA) refinementOverrides.adults = refinement.adults;
    else if (refinement.adults !== 1) refinementOverrides.adults = refinement.adults;
    if (refinement.children !== aiC && refinement.children > 0) refinementOverrides.children = refinement.children;
    if (refinement.infants !== aiI && refinement.infants > 0) refinementOverrides.infants = refinement.infants;
    if (refinement.cabinClass !== "economy") refinementOverrides.cabin_class = refinement.cabinClass === "premium_economy" ? "Premium Economy" : refinement.cabinClass.charAt(0).toUpperCase() + refinement.cabinClass.slice(1);
    if (refinement.hotelStars > 0) refinementOverrides.hotel_stars = refinement.hotelStars;
    if (refinement.travelStyle) refinementOverrides.travel_style = refinement.travelStyle;
    if (refinement.directFlightsOnly) refinementOverrides.prefer_direct = true;
    if (!refinement.flexibleDates) refinementOverrides.flexible_dates = false;

    const requestMessages = currentMessages
      .slice(-20)
      .map((m) => ({ role: m.role, content: getTextContent(m.content).slice(0, 1400) }));

    const buildTripPlannerBody = () => ({
      messages: requestMessages,
      currency,
      languageSession,
      hasItinerary: !!structuredItinerary,
      ...(structuredItinerary ? { itinerarySummary: buildItinerarySummary(structuredItinerary) } : {}),
      ...(Object.keys(refinementOverrides).length > 0 ? { refinements: refinementOverrides } : {}),
    });

    const raceWithTimeout = async <T,>(
      promise: Promise<T>,
      timeoutMs: number,
      message: string
    ): Promise<T> => {
      const timeoutCall = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      });
      return Promise.race([promise, timeoutCall]);
    };

    const extractMsgText = requestMessages.map(m => m.content).join(" ");
    const isLikelyMultiCity = /\b\d+\s*n(ight)?s?\b/i.test(extractMsgText) && (extractMsgText.match(/\b\d+\s*n(ight)?s?\b/gi) || []).length > 1;
    const defaultExtractTimeout = isLikelyMultiCity || extractMsgText.length > 1500 ? 60000 : 30000;
    const invokePlannerWithTimeout = async (timeoutMs = defaultExtractTimeout): Promise<any> => {
      try {
        return await raceWithTimeout(
          supabase.functions.invoke("ai-trip-planner", { body: buildTripPlannerBody() }),
          timeoutMs,
          `AI request timed out after ${Math.round(timeoutMs / 1000)}s`
        );
      } catch (err: any) {
        return {
          data: null,
          error: { message: err?.message || "AI request timed out", name: err?.name || "TimeoutError" },
        };
      }
    };

    try {
      const { data, error } = await invokePlannerWithTimeout();

      if (error) {
        console.error("Trip planner invoke error:", error);
        throw error;
      }
      if (!data) throw new Error("No data returned from AI trip planner");
      if (data?.error === "LOGIN_REQUIRED") {
        toast({ title: "Login Required", description: data.message || "Please log in to use the AI Trip Planner.", variant: "destructive" });
        setMessages((prev) => prev.slice(0, -1));
        setLoading(false);
        setIsSearching(false);
        sendingRef.current = false;
        return;
      }
      if (data?.error) throw new Error(data.error);

      // ── PROGRESSIVE SEARCH FLOW ──
      if (data?.readyToSearch) {
        const sp = data.searchParams;
        setExtractedParams(data.extractedParams);
        if (data.languageSession) setLanguageSession(data.languageSession);
        setSearchPhase("searching");
        setIsSearching(true);
        setProgressiveFlights(null);
        setProgressiveHotels(null);
        setProgressiveActivities(null);

        setMessages((prev) => [...prev, { role: "assistant", content: "✨ Great — I have everything I need! Searching for the best options now…" }]);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "apikey": anonKey };

        // ── Search Result Caching ──
        const CACHE_TTL_30M = 30 * 60 * 1000;
        const CACHE_TTL_1H = 60 * 60 * 1000;
        const tripDaysOut = (() => {
          try {
            const departDate = new Date(sp.depart_date);
            return Math.floor((departDate.getTime() - Date.now()) / 86400000);
          } catch { return 0; }
        })();
        const tripDateFarEnough = tripDaysOut > 7;
        const CACHE_TTL_MS = tripDaysOut > 30 ? CACHE_TTL_1H : CACHE_TTL_30M;

        const buildSearchCacheKey = (type: string, params: Record<string, any>): string => {
          const parts: string[] = [type];
          for (const key of Object.keys(params).sort()) {
            parts.push(`${key}=${String(params[key] ?? "").toLowerCase()}`);
          }
          return parts.join("|");
        };

        const getCachedSearch = async (type: string, cacheKey: string): Promise<any[] | null> => {
          if (!tripDateFarEnough) return null;
          try {
            const { data: cached } = await supabase.from("trip_search_cache")
              .select("results, result_count")
              .eq("cache_key", cacheKey)
              .gt("expires_at", new Date().toISOString())
              .single();
            if (cached?.result_count > 0) {
              console.log(`[Cache] HIT ${type}: ${cacheKey} (${cached.result_count} results)`);
              return cached.results as any[];
            }
          } catch {}
          console.log(`[Cache] MISS ${type}: ${cacheKey}`);
          return null;
        };

        const setCachedSearch = async (type: string, cacheKey: string, params: any, results: any[]) => {
          if (!tripDateFarEnough || results.length === 0) return;
          try {
            const slim = type === "flights" ? results.map((f: any) => {
              const { amadeusRawOffer, amadeusDictionaries, travelportRaw, ...rest } = f;
              return rest;
            }) : results;
            await supabase.from("trip_search_cache").upsert({
              cache_key: cacheKey, search_type: type, search_params: params,
              results: slim, result_count: slim.length,
              cached_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
            }, { onConflict: "cache_key" });
            console.log(`[Cache] SET ${type}: ${cacheKey} (${slim.length} results, TTL ${CACHE_TTL_MS / 60000}m)`);
          } catch (e: any) { console.warn(`[Cache] SET error:`, e.message); }
        };

        // ── Multi-city detection ──
        const cities = (Array.isArray(sp.cities) && sp.cities.length > 1
          ? sp.cities
          : [{ name: (sp.hotel_city_name || sp.destination_city || "").trim(), days: sp.duration_days || 3 }]
        ).map((city: any) => ({
          ...city,
          days: Number(city?.days) > 0 ? Number(city.days) : (Number(city?.nights) > 0 ? Number(city.nights) + 1 : 3),
          nights: Number(city?.nights) > 0 ? Number(city.nights) : (Number(city?.days) > 1 ? Number(city.days) - 1 : 2),
        }));
        setSearchedCities(cities);
        const isMultiCity = cities.length > 1;
        console.log(`[Progressive] ${isMultiCity ? 'Multi-city' : 'Single-city'} trip: ${cities.map(c => `${c.name} (${c.days}d/${c.nights}n)`).join(' → ')}`);

        // Creative prefetch removed — per-city parallel generation is faster and has richer context

        // ── Flights & Hotels: handled server-side by match engine — no frontend search ──
        setProgressiveFlights(null); // null = "searching" state
        setProgressiveHotels(null); // null = "searching" state
        setProgressiveActivities(null); // null = "searching" state

        const searchTimeout = isMultiCity ? 80000 : 35000;

        // ── V2 Pipeline: Fire AI generation AND match-v2 prefetch IN PARALLEL ──
        const genTimeout = isMultiCity ? 210000 : 55000;
        const debugMode = debugModeRef.current || false;
        const userMsgs = currentMessages.filter((m: Msg) => m.role === "user").map((m: Msg) => m.content);
        const rawRequest = userMsgs.join("\n\n");

        // Generate a unique progress ID for real-time streaming
        const progressId = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        progressIdRef.current = progressId;
        setSearchPhase("generating"); // Start early so subscription connects

        // Fire AI generation AND flight+hotel prefetch in PARALLEL
        console.log("[V2 Pipeline] 🚀 Firing AI generation + flight/hotel prefetch in PARALLEL...");
        
        // 1. AI Generation (doesn't need search results)
        const v2GenP = raceWithTimeout(
          supabase.functions.invoke("ai-trip-generate-v2", {
            body: {
              raw_request: rawRequest,
              searchParams: { ...sp, request_type: "full_trip" },
              currency,
              debug_mode: debugMode,
              progress_id: progressId,
            },
          }),
          isMultiCity ? 120000 : 60000,
          "V2 generation timed out"
        ).catch((err: any) => ({ error: err }));

        // 2. Match engine prefetch: flights + hotels (no itinerary needed)
        const prefetchP = raceWithTimeout(
          supabase.functions.invoke("ai-trip-match-v2", {
            body: {
              mode: "prefetch",
              searchParams: sp,
              origin: resolveCity(sp.origin_airport),
              adults: sp.adults || refinement.adults || 1,
              children: sp.children || refinement.children || 0,
              infants: sp.infants || refinement.infants || 0,
              currency,
              progress_id: progressId,
              travel_connections: sp.travel_connections || [],
            },
          }),
          searchTimeout,
          "Prefetch timed out"
        ).catch((err: any) => {
          console.warn("[V2 Pipeline] Prefetch failed:", err.message);
          return { data: { flights: { selected: [], allSearchedFlights: [] }, hotels: { selected: [], hotelSwapPools: {}, allSearchedHotels: [] } } };
        });

        // Wait for BOTH gen + prefetch, but fire activity search AS SOON as gen resolves
        let v2GenData: any = null;
        let activityPrefetchP: Promise<any> | null = null;

        // Start gen + prefetch in parallel
        const v2GenSettled = v2GenP.then((res: any) => {
          // As soon as gen resolves, fire activity prefetch immediately
          const data = res?.data;
          if (!res?.error && !data?.error && data?.itinerary?.days) {
            v2GenData = data;
            console.log(`[V2 Pipeline] 🎯 Gen returned ${data.itinerary.days.length} days — firing activity prefetch NOW`);
            activityPrefetchP = raceWithTimeout(
              supabase.functions.invoke("ai-trip-match-v2", {
                body: {
                  mode: "activity-prefetch",
                  itinerary: data.itinerary,
                  searchParams: sp,
                  adults: sp.adults || refinement.adults || 1,
                  children: sp.children || refinement.children || 0,
                  infants: sp.infants || refinement.infants || 0,
                  currency,
                  progress_id: progressId,
                },
              }),
              isMultiCity ? 90000 : 45000,
              "Activity prefetch timed out"
            ).catch((err: any) => {
              console.warn("[V2 Pipeline] Activity prefetch failed:", err.message);
              return { data: null };
            });
          }
          return res;
        });

        // Wait for both gen (which triggers activity prefetch) + flight/hotel prefetch
        const [v2GenRaw, prefetchRaw] = await Promise.all([v2GenSettled, prefetchP]);

        const prefetchData = (prefetchRaw as any)?.data || prefetchRaw || {};
        const prefetchedFlights = prefetchData.flights || { selected: [], allSearchedFlights: [] };
        const prefetchedHotels = prefetchData.hotels || { selected: [], hotelSwapPools: {}, allSearchedHotels: [] };

        // Wait for activity prefetch to complete (it started when gen finished)
        let prefetchedActivities: any = null;
        if (activityPrefetchP) {
          console.log("[V2 Pipeline] ⏳ Waiting for activity prefetch to complete...");
          const actRes: any = await activityPrefetchP;
          prefetchedActivities = actRes?.data?.activityResult || null;
          if (prefetchedActivities) {
            console.log(`[V2 Pipeline] 🎭 Activity prefetch done: ${prefetchedActivities.stats?.matched || 0} matched`);
            setProgressiveActivities(prefetchedActivities.allSearchedActivities || []);
          }
        }

        // Update UI with prefetched results immediately
        if (prefetchedFlights.allSearchedFlights?.length > 0) {
          setAllSearchedFlights(prefetchedFlights.allSearchedFlights);
          saveCachedSearchedFlights(prefetchedFlights.allSearchedFlights);
          setProgressiveFlights(prefetchedFlights.allSearchedFlights);
          console.log(`[V2 Pipeline] ✈️ Prefetch: ${prefetchedFlights.allSearchedFlights.length} flights ready`);
        }
        if (prefetchedHotels.allSearchedHotels?.length > 0) {
          setAllSearchedHotels(prefetchedHotels.allSearchedHotels);
          saveCachedSearchedHotels(prefetchedHotels.allSearchedHotels);
          const hByCity: Record<string, any[]> = {};
          for (const h of prefetchedHotels.allSearchedHotels) {
            const c = h.city || "Unknown";
            if (!hByCity[c]) hByCity[c] = [];
            hByCity[c].push(h);
          }
          setHotelsByCity(hByCity);
          saveCachedHotelsByCity(hByCity);
          setProgressiveHotels(prefetchedHotels.allSearchedHotels);
          console.log(`[V2 Pipeline] 🏨 Prefetch: ${prefetchedHotels.allSearchedHotels.length} hotels ready`);
        }

        setDayActivityOverrides({});
        setSwapTarget(null);

        let genData: any = null;
        let usedV2 = false;

        try {
          // Process V2 generation result
          const v2GenRes: any = v2GenRaw;
          if (!v2GenData) {
            const data = v2GenRes?.data;
            if (v2GenRes?.error || data?.error) throw new Error(data?.error || v2GenRes?.error?.message || "V2 generation failed");
            if (!data?.itinerary) throw new Error("V2 returned no itinerary");
            v2GenData = data;
          }
          console.log(`[V2 Pipeline] Step 1 done: ${v2GenData.itinerary.duration_days} days, ${v2GenData.itinerary.days?.length} day plans`);

          // Step 2: V2 Assemble (inject pre-fetched flights/hotels/activities + AI review)
          console.log("[V2 Pipeline] Step 2: ai-trip-match-v2 ASSEMBLE (inject all prefetched data + AI review)...");
          const v2MatchRes: any = await raceWithTimeout(
            supabase.functions.invoke("ai-trip-match-v2", {
              body: {
                mode: "assemble",
                itinerary: v2GenData.itinerary,
                searchParams: sp,
                startDate: sp.depart_date,
                origin: resolveCity(sp.origin_airport),
                adults: sp.adults || refinement.adults || 1,
                children: sp.children || refinement.children || 0,
                infants: sp.infants || refinement.infants || 0,
                currency,
                debug_mode: debugMode,
                progress_id: progressId,
                // Pass ALL pre-fetched data
                prefetchedFlights,
                prefetchedHotels,
                prefetchedActivities,
              },
            }),
            isMultiCity ? 120000 : 60000,
            "V2 assembly timed out"
          );
          const v2MatchData = v2MatchRes?.data;
          if (v2MatchRes?.error || v2MatchData?.error) throw new Error(v2MatchData?.error || v2MatchRes?.error?.message || "V2 assembly failed");

          const matchedItinerary = v2MatchData?.itinerary || v2GenData.itinerary;
          console.log(`[V2 Pipeline] Step 2 done: matched itinerary ready`);

          // Step 3: Consume all search results from match engine
          const totalProductsByCity: Record<string, number> = v2MatchData?.totalProductsByCity || {};
          const totalInventory = Object.values(totalProductsByCity).reduce((s: number, n: number) => s + n, 0);
          if (totalInventory > 0) {
            console.log(`[V2 Pipeline] 📊 Analysing from ${totalInventory} activities across ${Object.keys(totalProductsByCity).length} cities`);
          }

          // Activities from match engine
          const matchEngineActivities: any[] = v2MatchData?.allSearchedActivities || [];
          const actSwapPools: Record<string, any[]> = v2MatchData?.activitySwapPools || {};

          const actByCity: Record<string, any[]> = {};
          for (const p of matchEngineActivities) {
            const city = p._searchCity || p.city || "Unknown";
            if (!actByCity[city]) actByCity[city] = [];
            actByCity[city].push(p);
          }
          const activities = matchEngineActivities;
          setActivitiesByCity(actByCity);
          saveCachedActivitiesByCity(actByCity);
          setAllSearchedActivities(matchEngineActivities);
          saveCachedSearchedActivities(matchEngineActivities);
          setProgressiveActivities(matchEngineActivities);
          setUserSelectedActivities([]);

          // Hotels from match engine (includes swap pools)
          const matchEngineHotels: any[] = v2MatchData?.allSearchedHotels || [];
          const hotelSwapPoolsData: Record<string, any[]> = v2MatchData?.hotelSwapPools || {};
          if (matchEngineHotels.length > 0) {
            setAllSearchedHotels(matchEngineHotels);
            saveCachedSearchedHotels(matchEngineHotels);
            const hByCity: Record<string, any[]> = {};
            for (const h of matchEngineHotels) {
              const c = h.city || "Unknown";
              if (!hByCity[c]) hByCity[c] = [];
              hByCity[c].push(h);
            }
            setHotelsByCity(hByCity);
            saveCachedHotelsByCity(hByCity);
          }

          // Flights from match engine (all flight search is server-side now)
          const matchEngineFlights: any[] = v2MatchData?.allSearchedFlights || [];
          if (matchEngineFlights.length > 0) {
            setAllSearchedFlights(matchEngineFlights);
            saveCachedSearchedFlights(matchEngineFlights);
            setProgressiveFlights(matchEngineFlights);
          } else {
            setProgressiveFlights([]);
          }
          setUserSelectedFlight(null);
          setUserSelectedFlightsByLeg({});

           console.log(`[V2 Pipeline] Step 3 done: ${matchEngineActivities.length} activities, ${matchEngineHotels.length} hotels, ${matchEngineFlights.length} flights from match engine`);

           // Transfers resolved by backend
           const backendTransfers: any[] = v2MatchData?.resolvedTransfers || [];
           if (backendTransfers.length > 0) {
             setBackendResolvedTransfers(backendTransfers);
             console.log(`[V2 Pipeline] 🚗 Backend resolved ${backendTransfers.length} transfers`);
           }

          // Step 4: Ensure live_* fields on itinerary are populated
          if (matchedItinerary) {
            if (!matchedItinerary.live_flights?.length && matchEngineFlights.length) matchedItinerary.live_flights = matchEngineFlights;
            if (!matchedItinerary.live_hotels?.length && matchEngineHotels.length) matchedItinerary.live_hotels = matchEngineHotels;
            if (!matchedItinerary.live_activities?.length && matchedItinerary.live_activities === undefined) {
              // Only set if backend didn't provide any — don't merge full search pool
              matchedItinerary.live_activities = [];
            }
          }

          matchedItinerary._pipeline_version = "v2_parallel_prefetch";
          matchedItinerary._totalProductsByCity = totalProductsByCity;
          matchedItinerary._activitySwapPools = actSwapPools;
          matchedItinerary._hotelSwapPools = hotelSwapPoolsData;

          genData = {
            itinerary: matchedItinerary,
            reply: v2GenData.reply || `✨ Your ${matchedItinerary.duration_days}-day trip plan is ready! Check the results panel →`,
            liveData: {
              flightsFound: matchEngineFlights.length,
              hotelsFound: matchEngineHotels.length,
              activitiesFound: matchEngineActivities.length,
              totalInventory,
            },
            debug_snapshots: debugMode ? { v2_gen: v2GenData.debug, v2_match: v2MatchData?.matchMeta || v2MatchData?._matchMeta } : undefined,
          };
          usedV2 = true;
          console.log("[V2 Pipeline] ✅ Complete — parallel prefetch + assemble pipeline");
        } catch (v2Err: any) {
          console.error(`[V2 Pipeline] ❌ Failed: ${v2Err.message}`);
          throw v2Err; // No V1 fallback — V2 only
        }

        if (!genData) throw new Error("Generation failed — no data returned");

        setSearchPhase("idle");
        setIsSearching(false);
        setProgressiveFlights(null);
        setProgressiveHotels(null);
        setProgressiveActivities(null);

        if (genData?.debug_snapshots) {
          setDebugSnapshots(genData.debug_snapshots);
          console.log("[Debug] Pipeline snapshots captured:", Object.keys(genData.debug_snapshots));
        }
        if (genData?.liveData) { setLastLiveData(genData.liveData); saveCachedLiveData(genData.liveData); }
        const generatedItinerary = genData?.itinerary ? normalizeItinerary(genData.itinerary) : (typeof genData?.reply === "string" ? parseItinerary(genData.reply) : null);
        if (generatedItinerary) setStructuredItinerary(generatedItinerary);

        let replyContent = typeof genData?.reply === "string" ? getTextContent(genData.reply) : "";
        if (!replyContent.trim()) {
          replyContent = generatedItinerary ? "✨ Your trip plan is ready! Check the results panel →" : "✨ I found your results — check the panel on the right.";
        }

        setMessages((prev) => {
          const cleaned = prev.filter(m => m.content !== "✨ Great — I have everything I need! Searching for the best options now…");
          return [...cleaned, { role: "assistant", content: replyContent }];
        });

        setLoading(false);
        sendingRef.current = false;
        inputRef.current?.focus();
        return;
      }

      // ── Handle refinement_update ──
      if (data?.refinement_update) {
        const ru = data.refinement_update;
        setRefinement(prev => {
          const patch: any = {};
          if (ru.prefer_direct) patch.directFlightsOnly = true;
          if (ru.hotel_stars) patch.hotelStars = ru.hotel_stars;
          if (ru.cabin_class) patch.cabinClass = ru.cabin_class;
          if (ru.travel_style) patch.travelStyle = ru.travel_style;
          if (ru.include_breakfast !== undefined) patch.includeBreakfast = ru.include_breakfast;
          if (ru.selection_priority) patch.selectionPriority = ru.selection_priority;
          return { ...prev, ...patch };
        });
        if (extractedParams) setExtractedParams((prev: any) => ({ ...prev, ...ru }));
        const replyContent = typeof data.reply === "string" ? data.reply : "✅ Changes applied!";
        if (data.languageSession) setLanguageSession(data.languageSession);
        setMessages(prev => [...prev, { role: "assistant" as const, content: replyContent }]);
        setLoading(false);
        sendingRef.current = false;
        inputRef.current?.focus();
        return;
      }

      // ── Handle day_fix ──
      if (data?.day_fix) {
        if (data.languageSession) setLanguageSession(data.languageSession);
        const replyContent = typeof data.reply === "string" ? data.reply : `✅ Day ${data.day_fix.dayIndex + 1} fixed!`;
        setMessages(prev => [...prev, { role: "assistant" as const, content: replyContent }]);
        setLoading(false);
        sendingRef.current = false;
        inputRef.current?.focus();
        if (onDayFix) {
          onDayFix(data.day_fix.dayIndex, data.day_fix.activities);
        }
        return;
      }

      // ── Handle multi-day fix ──
      if (data?.day_fix_multi && Array.isArray(data.day_fix_multi)) {
        if (data.languageSession) setLanguageSession(data.languageSession);
        const replyContent = typeof data.reply === "string" ? data.reply : "✅ Itinerary fixed!";
        setMessages(prev => [...prev, { role: "assistant" as const, content: replyContent }]);
        setLoading(false);
        sendingRef.current = false;
        inputRef.current?.focus();
        if (onDayFixMulti) {
          onDayFixMulti(data.day_fix_multi);
        }
        return;
      }

      // ── Handle inspiration mode ──
      if (data?.inspiration) {
        if (data.languageSession) setLanguageSession(data.languageSession);
        if (data.extractedParams) setExtractedParams(data.extractedParams);
        setInspirationData(data.inspiration as InspirationData);
        const replyContent = typeof data.reply === "string" ? data.reply : data.inspiration.ai_summary || "Here's what I'd recommend ✨";
        setMessages(prev => [...prev, { role: "assistant" as const, content: replyContent }]);
        setLoading(false);
        sendingRef.current = false;
        inputRef.current?.focus();
        return;
      }

      // ── Handle hybrid preview mode ──
      if (data?.hybrid_preview) {
        if (data.languageSession) setLanguageSession(data.languageSession);
        if (data.extractedParams) setExtractedParams(data.extractedParams);
        setHybridPreviewData(data.hybrid_preview as HybridPreviewData);
        const replyContent = typeof data.reply === "string" ? data.reply : data.hybrid_preview.ai_summary || "Here are some estimated options ✨";
        setMessages(prev => [...prev, { role: "assistant" as const, content: replyContent }]);
        setLoading(false);
        sendingRef.current = false;
        inputRef.current?.focus();
        return;
      }

      if (data?.liveData) { setLastLiveData(data.liveData); saveCachedLiveData(data.liveData); }
      if (data?.itinerary) setStructuredItinerary(normalizeItinerary(data.itinerary));
      if (data?.previewData) {
        onPreviewData?.(data.previewData);
      }
      if (data?.extractedParams) setExtractedParams(data.extractedParams);
      if (data?.languageSession) setLanguageSession(data.languageSession);

      // Missing fields
      if (data?.missingFields && Array.isArray(data.missingFields)) {
        const pickerHandled = ["duration", "travel_type", "travelers", "travel_style"];
        const chatRequired = ["destination", "destination_city", "destination_cities", "origin", "dates", "dates_or_duration"];
        const hasChatFieldsRemaining = data.missingFields.some((f: string) => chatRequired.includes(f));
        const replyText = (typeof data?.reply === "string" ? data.reply : "").toLowerCase();
        const isAskingChatFields = /when.*(?:travel|go|plan)|কবে|কখন|where.*(?:go|travel|from)|কোথায়|কোথা থেকে|which city|কোন শহর/i.test(replyText);
        if (!hasChatFieldsRemaining && !isAskingChatFields) {
          setLastMissingFields(data.missingFields.filter((f: string) => pickerHandled.includes(f)));
        } else {
          setLastMissingFields([]);
        }
      } else {
        setLastMissingFields([]);
      }

      let replyContent = typeof data?.reply === "string" ? data.reply
        : typeof data?.reply === "object" && data.reply !== null
          ? (data.reply.text || data.reply.content || data.reply.message || "Here's your trip plan! ✈️")
          : String(data?.reply ?? "");

      // Strip leaked system prompt content
      const leakPatterns = [
        /\*?\*?CONTEXT\s*[—–-]\s*What we already know\*?\*?:.*$/gims,
        /\*?\*?YOUR TASK\*?\*?:.*$/gims,
        /\*?\*?CRITICAL RULES\*?\*?:.*$/gims,
        /\*?\*?Question templates by type\*?\*?:.*$/gims,
        /\*?\*?LANGUAGE\s*[—–-]\s*ABSOLUTE LOCK\*?\*?:.*$/gims,
        /\*?\*?Still needed\*?\*?:.*$/gims,
        /\[SYSTEM INSTRUCTIONS[^\]]*\].*?\[END INSTRUCTIONS[^\]]*\]/gis,
      ];
      for (const pattern of leakPatterns) replyContent = replyContent.replace(pattern, "").trim();
      replyContent = getTextContent(replyContent);
      if (!replyContent.trim()) replyContent = "✨ Your trip plan is ready! Check the results panel →";

      setMessages((prev) => [...prev, { role: "assistant", content: replyContent }]);
    } catch (e: any) {
      console.error("Trip planner error:", e);
      // Single retry
      if (!isRetry) {
        try {
          const retryRes = await invokePlannerWithTimeout(30000);
          if (!retryRes.error && retryRes.data?.reply) {
            let retryReply = typeof retryRes.data.reply === "string" ? getTextContent(retryRes.data.reply) : String(retryRes.data.reply);
            if (retryRes.data?.extractedParams) setExtractedParams(retryRes.data.extractedParams);
            if (retryRes.data?.languageSession) setLanguageSession(retryRes.data.languageSession);
            if (retryRes.data?.missingFields) {
              const pickerHandled = ["duration", "travel_type", "travelers", "travel_style"];
              const chatRequired = ["destination", "destination_city", "destination_cities", "origin", "dates", "dates_or_duration"];
              const hasChatFieldsRemaining = retryRes.data.missingFields.some((f: string) => chatRequired.includes(f));
              if (!hasChatFieldsRemaining) {
                setLastMissingFields(retryRes.data.missingFields.filter((f: string) => pickerHandled.includes(f)));
              }
            }
            if (retryReply.trim()) {
              setMessages((prev) => [...prev, { role: "assistant", content: retryReply }]);
              setLoading(false);
              sendingRef.current = false;
              inputRef.current?.focus();
              return;
            }
          }
        } catch (retryErr) {
          console.error("[TripPlanner] Retry exception:", retryErr);
        }
      }
      setRightPanelError(true);
      setMessages((prev) => {
        const cleaned = prev.filter((m) => m.content !== "Hmm, let me try that again…");
        return [...cleaned, { role: "assistant", content: "Having trouble fetching results right now. Please try again in a moment — I'll be ready! 🙏" }];
      });
    } finally {
      setLoading(false);
      setIsSearching(false);
      setSearchPhase("idle");
      sendingRef.current = false;
      inputRef.current?.focus();
    }
  }, [loading, refinement, aiTravelers, currency, languageSession, structuredItinerary, extractedParams, messagesRef, setMessages, setLastLiveData, setStructuredItinerary, inputRef, buildItinerarySummary, clearInput, onDayFix, onDayFixMulti, onPreviewData, getInputText]);

  return {
    sendMessage,
    loading, isSearching, rightPanelError, setRightPanelError,
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
    debugSnapshots, setDebugSnapshots,
    inspirationData, setInspirationData,
    hybridPreviewData, setHybridPreviewData,
    resetSearchState,
    backendResolvedTransfers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Extracted search helpers (keep sendMessage body manageable)
// ═══════════════════════════════════════════════════════════════════════════

const DESTINATION_IATA_MC: Record<string, string> = {
  "Langkawi": "LGK", "Phuket": "HKT", "Bali": "DPS", "Maldives": "MLE",
  "Singapore": "SIN", "Kuala Lumpur": "KUL", "Bangkok": "BKK", "Dubai": "DXB",
  "Colombo": "CMB", "Male": "MLE", "Hanoi": "HAN", "Ho Chi Minh City": "SGN",
  "Tokyo": "NRT", "Seoul": "ICN", "Hong Kong": "HKG", "Taipei": "TPE",
  "Jakarta": "CGK", "Manila": "MNL", "Delhi": "DEL", "Mumbai": "BOM",
  "Kathmandu": "KTM", "Muscat": "MCT", "Doha": "DOH", "Istanbul": "IST",
  "Penang": "PEN", "Krabi": "KBV", "Koh Samui": "USM", "Lombok": "LOP",
  "Da Nang": "DAD", "Siem Reap": "REP", "Chittagong": "CGP", "Cox's Bazar": "CXB",
  "Goa": "GOI", "Jeddah": "JED", "Riyadh": "RUH", "Abu Dhabi": "AUH",
  "Dhaka": "DAC", "Kolkata": "CCU", "Chennai": "MAA",
  "Kuala Terengganu": "TGG", "Johor Bahru": "JHB", "Malacca": "MKZ",
  "Chiang Mai": "CNX", "Kuching": "KCH", "Kota Kinabalu": "BKI", "Ipoh": "IPH",
  "Nha Trang": "CXR", "Sylhet": "ZYL", "Pokhara": "PKR", "Jaipur": "JAI",
  "Marrakech": "RAK", "Casablanca": "CMN", "Cape Town": "CPT", "Nairobi": "NBO",
  "Salalah": "SLL", "Manama": "BAH", "Jeju": "CJU", "Boracay": "KLO",
  "Luang Prabang": "LPQ", "Negombo": "CMB", "Ella": "CMB", "Kandy": "CMB",
  "Hulhumale": "MLE", "Addu": "GAN", "Santorini": "JTR", "Zanzibar": "ZNZ",
  "Maui": "OGG", "Cancun": "CUN",
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

async function resolveIATA(cityName: string): Promise<string> {
  if (DESTINATION_IATA_MC[cityName]) return DESTINATION_IATA_MC[cityName];
  try {
    const { data: airportRow } = await supabase.from("airports").select("iata_code").eq("city", cityName).eq("is_active", true).limit(1);
    if (airportRow?.[0]) return airportRow[0].iata_code;
    const { data: nameRow } = await supabase.from("airports").select("iata_code").ilike("name", `%${cityName}%`).eq("is_active", true).limit(1);
    if (nameRow?.[0]) return nameRow[0].iata_code;
  } catch {}
  return "";
}

async function searchMultiCityFlights(
  sp: any, cities: { name: string; days: number; nights?: number }[], headers: any, supabaseUrl: string,
  buildSearchCacheKey: (type: string, params: Record<string, any>) => string,
  getCachedSearch: (type: string, key: string) => Promise<any[] | null>,
  setCachedSearch: (type: string, key: string, params: any, results: any[]) => Promise<void>,
  setAllSearchedFlights: React.Dispatch<React.SetStateAction<any[]>>,
  setProgressiveFlights: React.Dispatch<React.SetStateAction<any[] | null>>,
  setUserSelectedFlight: React.Dispatch<React.SetStateAction<any | null>>,
  setUserSelectedFlightsByLeg: React.Dispatch<React.SetStateAction<Record<string, any>>>,
): Promise<any[]> {
  // Resolve all city coordinates
  const cityCoords: Record<string, { lat: number; lon: number; code: string }> = {};
  try {
    const cityNames = cities.map(c => c.name);
    const { data: airportRows } = await supabase.from("airports").select("city, iata_code, latitude, longitude").in("city", cityNames).eq("is_active", true);
    if (airportRows) {
      for (const a of airportRows) {
        if (a.latitude && a.longitude && !cityCoords[a.city]) {
          cityCoords[a.city] = { lat: a.latitude, lon: a.longitude, code: a.iata_code };
        }
      }
    }
    const missing = cityNames.filter(c => !cityCoords[c]);
    for (const mc of missing) {
      const code = DESTINATION_IATA_MC[mc];
      if (code) {
        const { data: fb } = await supabase.from("airports").select("latitude, longitude").eq("iata_code", code).limit(1);
        if (fb?.[0]?.latitude && fb?.[0]?.longitude) cityCoords[mc] = { lat: fb[0].latitude, lon: fb[0].longitude, code };
        else cityCoords[mc] = { lat: 0, lon: 0, code };
      }
    }
  } catch {}

  const legSearches: Promise<any[]>[] = [];
  const originCity = resolveCity(sp.origin_airport);

  // Leg 1: Outbound
  const firstCityCode = cityCoords[cities[0].name]?.code || await resolveIATA(cities[0].name) || sp.destination_airport;
  const outLabel = `${originCity} → ${cities[0].name}`;
  legSearches.push(
    (async () => {
      const legCK = buildSearchCacheKey("flights", { from: sp.origin_airport, to: firstCityCode, depart: sp.depart_date, adults: sp.adults || 1, type: "outbound" });
      const cached = await getCachedSearch("flights", legCK);
      if (cached) return cached.map((f: any) => ({ ...f, _legType: "outbound", _legLabel: outLabel }));
      const res = await fetch(`${supabaseUrl}/functions/v1/unified-flight-search`, {
        method: "POST", headers,
        body: JSON.stringify({ from: sp.origin_airport, to: firstCityCode, departDate: sp.depart_date, adults: sp.adults || 1, children: sp.children || 0, infants: sp.infants || 0, cabinClass: sp.cabin_class || "Economy" }),
      }).then(r => r.json());
      const flights = res?.success ? hydrateFlightsFromWire(res.flights || []) : [];
      setCachedSearch("flights", legCK, { from: sp.origin_airport, to: firstCityCode }, flights);
      return flights.map((f: any) => ({ ...f, _legType: "outbound", _legLabel: outLabel }));
    })().catch(() => [])
  );

  // Inter-city legs
  let dayOffset = 0;
  for (let i = 0; i < cities.length - 1; i++) {
    dayOffset += (cities[i].nights || (cities[i].days ? Math.max(cities[i].days - 1, 1) : 1));
    const fromCity = cities[i].name;
    const toCity = cities[i + 1].name;
    const fromCoord = cityCoords[fromCity];
    const toCoord = cityCoords[toCity];
    const fromCode = fromCoord?.code || DESTINATION_IATA_MC[fromCity] || "";
    const toCode = toCoord?.code || DESTINATION_IATA_MC[toCity] || "";
    const legDate = new Date(sp.depart_date);
    legDate.setDate(legDate.getDate() + dayOffset);
    const legDateStr = legDate.toISOString().split("T")[0];
    const legLabel = `${fromCity} → ${toCity}`;

    if (!fromCode || !toCode) continue;

    legSearches.push(
      (async () => {
        const icCK = buildSearchCacheKey("flights", { from: fromCode, to: toCode, depart: legDateStr, adults: sp.adults || 1, type: "intercity" });
        const cached = await getCachedSearch("flights", icCK);
        if (cached) return cached.map((f: any) => ({ ...f, _legType: "intercity", _legLabel: legLabel, _legFrom: fromCity, _legTo: toCity, _legDate: legDateStr }));

        // Try direct first
        const res = await fetch(`${supabaseUrl}/functions/v1/unified-flight-search`, {
          method: "POST", headers,
          body: JSON.stringify({ from: fromCode, to: toCode, departDate: legDateStr, adults: sp.adults || 1, children: sp.children || 0, infants: sp.infants || 0, cabinClass: sp.cabin_class || "Economy", quickSearch: true, directFlight: true }),
        }).then(r => r.json()).catch(() => null);

        if (res?.success && res.flights?.length) {
          const directFlights = res.flights.filter((f: any) => (f.stops ?? f.totalStops ?? (f.segments?.length ? f.segments.length - 1 : 0)) === 0);
          if (directFlights.length > 0) {
            const sliced = directFlights.slice(0, 5);
            setCachedSearch("flights", icCK, { from: fromCode, to: toCode }, sliced);
            return sliced.map((f: any) => ({ ...f, _legType: "intercity", _legLabel: legLabel, _legFrom: fromCity, _legTo: toCity, _legDate: legDateStr }));
          }
        }

        // Fallback: without direct-only
        const fallbackRes = await fetch(`${supabaseUrl}/functions/v1/unified-flight-search`, {
          method: "POST", headers,
          body: JSON.stringify({ from: fromCode, to: toCode, departDate: legDateStr, adults: sp.adults || 1, children: sp.children || 0, infants: sp.infants || 0, cabinClass: sp.cabin_class || "Economy", quickSearch: true }),
        }).then(r => r.json()).catch(() => null);

        if (fallbackRes?.success && fallbackRes.flights?.length) {
          const sorted = fallbackRes.flights.sort((a: any, b: any) => {
            const aS = a.stops ?? a.totalStops ?? 99;
            const bS = b.stops ?? b.totalStops ?? 99;
            return aS !== bS ? aS - bS : (a.price || 0) - (b.price || 0);
          });
          const sliced = sorted.slice(0, 5);
          setCachedSearch("flights", icCK, { from: fromCode, to: toCode }, sliced);
          return sliced.map((f: any) => ({ ...f, _legType: "intercity", _legLabel: legLabel, _legFrom: fromCity, _legTo: toCity, _legDate: legDateStr }));
        }
        return [];
      })()
    );
  }

  // Return leg
  const totalNights = cities.reduce((sum, c) => sum + (c.nights || (c.days ? Math.max(c.days - 1, 1) : 2)), 0);
  const computedReturnDate = sp.return_date || (() => {
    const d = new Date(sp.depart_date);
    d.setDate(d.getDate() + totalNights);
    return d.toISOString().split("T")[0];
  })();
  {
    const lastCity = cities[cities.length - 1].name;
    const lastCityCode = cityCoords[lastCity]?.code || await resolveIATA(lastCity) || "";
    const retLabel = `${lastCity} → ${originCity}`;
    if (lastCityCode && lastCityCode !== sp.origin_airport) {
      legSearches.push(
        (async () => {
          const retCK = buildSearchCacheKey("flights", { from: lastCityCode, to: sp.origin_airport, depart: computedReturnDate, adults: sp.adults || 1, type: "return" });
          const cached = await getCachedSearch("flights", retCK);
          if (cached) return cached.map((f: any) => ({ ...f, _legType: "return", _legLabel: retLabel }));
          const res = await fetch(`${supabaseUrl}/functions/v1/unified-flight-search`, {
            method: "POST", headers,
            body: JSON.stringify({ from: lastCityCode, to: sp.origin_airport, departDate: computedReturnDate, adults: sp.adults || 1, children: sp.children || 0, infants: sp.infants || 0, cabinClass: sp.cabin_class || "Economy" }),
          }).then(r => r.json());
          const flights = res?.success ? hydrateFlightsFromWire(res.flights || []) : [];
          setCachedSearch("flights", retCK, { from: lastCityCode, to: sp.origin_airport }, flights);
          return flights.map((f: any) => ({ ...f, _legType: "return", _legLabel: retLabel }));
        })().catch(() => [])
      );
    }
  }

  const legResults = await Promise.all(legSearches);
  const tagged = legResults.flat();
  setAllSearchedFlights(tagged);
  setProgressiveFlights(tagged);
  setUserSelectedFlight(null);
  setUserSelectedFlightsByLeg({});
  console.log(`[Progressive] All multi-city flights: ${tagged.length}`);
  return tagged;
}

async function searchRoundTripFlights(
  sp: any, headers: any, supabaseUrl: string, currency: string,
  buildSearchCacheKey: (type: string, params: Record<string, any>) => string,
  getCachedSearch: (type: string, key: string) => Promise<any[] | null>,
  setCachedSearch: (type: string, key: string, params: any, results: any[]) => Promise<void>,
  setAllSearchedFlights: React.Dispatch<React.SetStateAction<any[]>>,
  setProgressiveFlights: React.Dispatch<React.SetStateAction<any[] | null>>,
  setUserSelectedFlight: React.Dispatch<React.SetStateAction<any | null>>,
  setUserSelectedFlightsByLeg: React.Dispatch<React.SetStateAction<Record<string, any>>>,
): Promise<any[]> {
  const flightCacheKey = buildSearchCacheKey("flights", { from: sp.origin_airport, to: sp.destination_airport, depart: sp.depart_date, ret: sp.return_date || "", adults: sp.adults || 1, children: sp.children || 0, infants: sp.infants || 0, cabin: sp.cabin_class || "Economy" });
  const cachedFlights = await getCachedSearch("flights", flightCacheKey);
  if (cachedFlights) {
    setAllSearchedFlights(cachedFlights);
    setProgressiveFlights(cachedFlights);
    setUserSelectedFlight(null);
    setUserSelectedFlightsByLeg({});
    return cachedFlights;
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/unified-flight-search`, {
    method: "POST", headers,
    body: JSON.stringify({ from: sp.origin_airport, to: sp.destination_airport, departDate: sp.depart_date, returnDate: sp.return_date, adults: sp.adults || 1, children: sp.children || 0, infants: sp.infants || 0, cabinClass: sp.cabin_class || "Economy" }),
  }).then(r => r.json());
  const flights = res?.success ? hydrateFlightsFromWire(res.flights || []) : [];
  setAllSearchedFlights(flights);
  setProgressiveFlights(flights);
  setUserSelectedFlight(null);
  setUserSelectedFlightsByLeg({});
  setCachedSearch("flights", flightCacheKey, { from: sp.origin_airport, to: sp.destination_airport }, flights);
  return flights;
}

async function searchHotelsForCity(
  cityName: string, cityDays: number, startOffset: number,
  sp: any, headers: any, supabaseUrl: string, currency: string,
  buildSearchCacheKey: (type: string, params: Record<string, any>) => string,
  getCachedSearch: (type: string, key: string) => Promise<any[] | null>,
  setCachedSearch: (type: string, key: string, params: any, results: any[]) => Promise<void>,
): Promise<any[]> {
  const baseDate = sp.depart_date ? new Date(sp.depart_date) : (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d; })();
  if (isNaN(baseDate.getTime())) return [];
  const checkin = (() => { const d = new Date(baseDate); d.setDate(d.getDate() + startOffset); return d.toISOString().split("T")[0]; })();
  const checkout = (() => { const d = new Date(baseDate); d.setDate(d.getDate() + startOffset + cityDays); return d.toISOString().split("T")[0]; })();
  try {
    const hotelCacheKey = buildSearchCacheKey("hotels", { city: cityName, checkin, checkout, adults: sp.adults || 1, children: sp.children || 0, infants: sp.infants || 0, currency });
    const cachedHotels = await getCachedSearch("hotels", hotelCacheKey);
    if (cachedHotels) return cachedHotels;
    const adults = Number(sp.adults || 1);
    const children = Number(sp.children || 0);
    const infants = Number(sp.infants || 0);
    // Calculate rooms: ceil((adults + children/2) / 2), infants don't need beds
    const rooms = Math.max(1, Math.ceil((adults + Math.ceil(children / 2)) / 2));
    const res = await fetch(`${supabaseUrl}/functions/v1/unified-hotel-search`, {
      method: "POST", headers,
      body: JSON.stringify({ cityName, checkinDate: checkin, checkoutDate: checkout, adults, children, infants, rooms, currency, clientNationality: sp.origin_airport || sp.origin || undefined }),
    }).then(r => r.json());
    const mapped = (res?.success ? (res.hotels || []).filter((h: any) => h.price > 0).map((h: any) => {
      const nights = Math.max(1, Math.ceil((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000));
      const firstRoom = h.availableRooms?.[0];
      const roomTypeName = firstRoom?.rooms?.[0]?.name || firstRoom?.name || h.roomTypeName || "";
      const roomFeaturedImage = getSelectedRoomImg({ availableRooms: h.availableRooms || [], roomType: roomTypeName }, roomTypeName);
      return { id: h.id || "", name: h.name, stars: h.stars, totalPrice: h.totalPrice || h.price, pricePerNight: h.pricePerNight || h.price, currency: res.displayCurrency || currency || h.currency || "USD", mealBasis: h.mealBasis || firstRoom?.mealBasis || "", roomType: roomTypeName, city: cityName, source: h.source, image: getHotelImg(h), roomFeaturedImage, availableRooms: h.availableRooms || [], rating: h.rating || 0, amenities: h.amenities || [], isRefundable: h.isRefundable || false, _searchCity: cityName, _nights: nights };
    }) : []) as any[];
    setCachedSearch("hotels", hotelCacheKey, { city: cityName, checkin, checkout }, mapped);
    return mapped;
  } catch { return []; }
}

async function searchActivitiesForCity(
  cityName: string, headers: any, supabaseUrl: string, currency: string,
  buildSearchCacheKey: (type: string, params: Record<string, any>) => string,
  getCachedSearch: (type: string, key: string) => Promise<any[] | null>,
  setCachedSearch: (type: string, key: string, params: any, results: any[]) => Promise<void>,
): Promise<any[]> {
  const actCacheKey = buildSearchCacheKey("activities", { city: cityName, currency });
  const cachedActs = await getCachedSearch("activities", actCacheKey);
  if (cachedActs) return cachedActs;

  const mapProducts = (products: any[]) => products.filter((p: any) => p.price > 0).map((p: any) => {
    // P0 FIX: Use the product's REAL city/destination, NOT the search bucket city.
    // Blindly stamping _searchCity=cityName caused cross-city contamination
    // (e.g., Singapore products appearing in KL bucket when searching "kuala lumpur").
    const productRealCity = p.destination || p.city || p.locality || "";
    return {
      name: p.name, price: p.price, currency: p.currency || "USD", duration: p.duration || "", rating: p.rating || 0, reviewCount: p.reviewCount || 0, category: p.category || "Tour", productCode: p.productCode, image: p.image || "",
      _searchCity: productRealCity || cityName,   // prefer product truth; fallback to search city only if product has no city
      _queryCity: cityName,                       // keep original query city for debugging
      city: productRealCity || cityName,           // expose real city for DE city-gate
      highlights: (p.highlights || []).slice(0, 3), pricingType: p.pricingType || "PER_PERSON", shortDescription: p.shortDescription || "",
    };
  });

  try {
    const cityLower = cityName.toLowerCase().trim();
    let destId: string | null = null;
    try {
      const { data: mapRow } = await supabase.from("viator_destination_map").select("dest_id, city_name").ilike("city_name", cityLower).limit(1).maybeSingle();
      if (mapRow?.dest_id) { destId = String(mapRow.dest_id); }
      else {
        const { data: syncRow } = await supabase.from("tour_sync_state").select("destination_id").ilike("destination_name", cityLower).limit(1).maybeSingle();
        if (syncRow?.destination_id) destId = syncRow.destination_id;
      }
    } catch {}

    let allActivities: any[] = [];
    if (destId) {
      const searchRes = await fetch(`${supabaseUrl}/functions/v1/unified-tour-search`, { method: "POST", headers, body: JSON.stringify({ action: "search", destinationId: destId, searchText: cityName, targetCurrency: currency, limit: 80, sortOrder: "TRAVELER_RATING" }) }).then(r => r.json()).catch(() => null);
      allActivities = searchRes?.success ? mapProducts(searchRes.tours || []) : [];
    } else {
      const freetextRes = await fetch(`${supabaseUrl}/functions/v1/unified-tour-search`, { method: "POST", headers, body: JSON.stringify({ action: "freetext", searchText: cityName, targetCurrency: currency, limit: 80 }) }).then(r => r.json()).catch(() => null);
      allActivities = freetextRes?.success ? mapProducts(freetextRes.products || []) : [];
    }

    // Deduplicate
    const seen = new Set<string>();
    allActivities = allActivities.filter(a => {
      if (seen.has(a.productCode)) return false;
      seen.add(a.productCode);
      return true;
    });

    setCachedSearch("activities", actCacheKey, { city: cityName, currency }, allActivities);
    return allActivities;
  } catch { return []; }
}
