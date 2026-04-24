/**
 * Browser cache and conversation history helpers for the Trip Planner.
 * Extracted from TripPlanner.tsx.
 */
import type { Msg, LiveData, Itinerary, ConversationEntry } from "./tripTypes";
import { normalizeItinerary, parseItinerary, sanitizeMessages } from "./tripParsingUtils";

// ── Constants ──
export const CACHE_VERSION = "v15_subdest_dedup";
const CACHE_VERSION_KEY = "trip_planner_cache_version";
const CACHE_KEY = "trip_planner_chat";
export const CACHE_LIVE_KEY = "trip_planner_live_data";
const CACHE_ITINERARY_KEY = "trip_planner_itinerary";
export const HISTORY_KEY = "trip_planner_history";
export const CACHE_FLIGHTS_KEY = "trip_planner_flights";
export const CACHE_HOTELS_KEY = "trip_planner_hotels";
export const CACHE_HOTELS_BY_CITY_KEY = "trip_planner_hotels_by_city";
export const CACHE_ACTIVITIES_KEY = "trip_planner_activities";
export const CACHE_ACTIVITIES_BY_CITY_KEY = "trip_planner_activities_by_city";
export const CACHE_EXTRACTED_PARAMS_KEY = "trip_planner_extracted_params";
export const CACHE_REFINEMENT_KEY = "trip_planner_refinement";
export const CACHE_AI_TRAVELERS_KEY = "trip_planner_ai_travelers";
export const CACHE_SEARCHED_CITIES_KEY = "trip_planner_searched_cities";
export const CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

// One-time cache invalidation
(function clearStaleCache() {
  try {
    if (localStorage.getItem(CACHE_VERSION_KEY) !== CACHE_VERSION) {
      [CACHE_KEY, CACHE_LIVE_KEY, CACHE_ITINERARY_KEY, HISTORY_KEY, CACHE_EXTRACTED_PARAMS_KEY, CACHE_REFINEMENT_KEY, CACHE_AI_TRAVELERS_KEY].forEach(k => localStorage.removeItem(k));
      [CACHE_FLIGHTS_KEY, CACHE_HOTELS_KEY, CACHE_HOTELS_BY_CITY_KEY, CACHE_ACTIVITIES_KEY, CACHE_ACTIVITIES_BY_CITY_KEY, CACHE_SEARCHED_CITIES_KEY].forEach(k => sessionStorage.removeItem(k));
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
      console.log("[TripPlanner] Cache cleared — upgraded to", CACHE_VERSION);
    }
  } catch {}
})();

// ── Flights ──
export function loadCachedSearchedFlights(): any[] {
  try { const raw = sessionStorage.getItem(CACHE_FLIGHTS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export function saveCachedSearchedFlights(flights: any[]) {
  try {
    if (flights.length === 0) { sessionStorage.removeItem(CACHE_FLIGHTS_KEY); return; }
    const lean = flights.map(f => { const { amadeusRawOffer, amadeusDictionaries, travelportRawOffer, ...rest } = f; return rest; });
    sessionStorage.setItem(CACHE_FLIGHTS_KEY, JSON.stringify(lean));
  } catch {}
}

// ── Hotels ──
export function loadCachedSearchedHotels(): any[] {
  try { const raw = sessionStorage.getItem(CACHE_HOTELS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export function saveCachedSearchedHotels(hotels: any[]) {
  try { if (hotels.length === 0) { sessionStorage.removeItem(CACHE_HOTELS_KEY); return; } sessionStorage.setItem(CACHE_HOTELS_KEY, JSON.stringify(hotels)); } catch {}
}
export function loadCachedHotelsByCity(): Record<string, any[]> {
  try { const raw = sessionStorage.getItem(CACHE_HOTELS_BY_CITY_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export function saveCachedHotelsByCity(data: Record<string, any[]>) {
  try { if (Object.keys(data).length === 0) { sessionStorage.removeItem(CACHE_HOTELS_BY_CITY_KEY); return; } sessionStorage.setItem(CACHE_HOTELS_BY_CITY_KEY, JSON.stringify(data)); } catch {}
}

// ── Activities ──
export function loadCachedSearchedActivities(): any[] {
  try { const raw = sessionStorage.getItem(CACHE_ACTIVITIES_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export function saveCachedSearchedActivities(activities: any[]) {
  try {
    if (activities.length === 0) { sessionStorage.removeItem(CACHE_ACTIVITIES_KEY); return; }
    const lean = activities.map(a => { const { images, ...rest } = a; return { ...rest, images: Array.isArray(images) ? images.slice(0, 2) : images }; });
    sessionStorage.setItem(CACHE_ACTIVITIES_KEY, JSON.stringify(lean));
  } catch {}
}
export function loadCachedActivitiesByCity(): Record<string, any[]> {
  try { const raw = sessionStorage.getItem(CACHE_ACTIVITIES_BY_CITY_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export function saveCachedActivitiesByCity(data: Record<string, any[]>) {
  try { if (Object.keys(data).length === 0) { sessionStorage.removeItem(CACHE_ACTIVITIES_BY_CITY_KEY); return; } sessionStorage.setItem(CACHE_ACTIVITIES_BY_CITY_KEY, JSON.stringify(data)); } catch {}
}

// ── Messages ──
export function loadCachedMessages(): Msg[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const { messages: msgs, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_LIVE_KEY); localStorage.removeItem(CACHE_ITINERARY_KEY);
      return [];
    }
    return Array.isArray(msgs) ? sanitizeMessages(msgs) : [];
  } catch { return []; }
}
export function saveCachedMessages(msgs: Msg[]) {
  try {
    if (msgs.length === 0) { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(CACHE_LIVE_KEY); localStorage.removeItem(CACHE_ITINERARY_KEY); return; }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ messages: sanitizeMessages(msgs), timestamp: Date.now() }));
  } catch {}
}

// ── Live data ──
export function loadCachedLiveData(): LiveData {
  try { const raw = localStorage.getItem(CACHE_LIVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function saveCachedLiveData(data: LiveData) {
  try { if (data) localStorage.setItem(CACHE_LIVE_KEY, JSON.stringify(data)); } catch {}
}

// ── Itinerary ──
export function loadCachedItinerary(): Itinerary | null {
  try {
    const raw = localStorage.getItem(CACHE_ITINERARY_KEY);
    if (raw) return normalizeItinerary(JSON.parse(raw));
    const chatRaw = localStorage.getItem(CACHE_KEY);
    if (!chatRaw) return null;
    const { messages: msgs, timestamp } = JSON.parse(chatRaw);
    if (Date.now() - timestamp > CACHE_MAX_AGE_MS) { localStorage.removeItem(CACHE_ITINERARY_KEY); return null; }
    if (Array.isArray(msgs)) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i]?.role === "assistant") { const parsed = parseItinerary(msgs[i].content); if (parsed) return parsed; }
      }
    }
    return null;
  } catch { return null; }
}
export function saveCachedItinerary(data: Itinerary | null) {
  try {
    if (!data) { localStorage.removeItem(CACHE_ITINERARY_KEY); return; }
    const lean = { ...data, live_flights: undefined, live_hotels: undefined, live_activities: undefined };
    localStorage.setItem(CACHE_ITINERARY_KEY, JSON.stringify(lean));
  } catch {
    try {
      const ultraLean = { ...data, live_flights: undefined, live_hotels: undefined, live_activities: undefined, hotel_alternatives: undefined };
      localStorage.setItem(CACHE_ITINERARY_KEY, JSON.stringify(ultraLean));
    } catch {}
  }
}

// ── Conversation history ──
export function generateConversationTitle(msgs: Msg[]): string {
  const userMsgs = msgs.filter(m => m.role === "user").map(m => m.content);
  if (userMsgs.length === 0) return "Untitled Trip";
  const allText = userMsgs.join(" ");
  const destMatch = allText.match(/(?:to|visit|go to|going to|trip to|travel to)\s+([A-Z][a-zA-Z\s]+)/i);
  if (destMatch) return `Trip to ${destMatch[1].trim().split(/\s+/).slice(0, 3).join(" ")}`;
  return userMsgs[0].slice(0, 40) + (userMsgs[0].length > 40 ? "…" : "");
}

export function loadHistory(): ConversationEntry[] {
  try { const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export function saveToHistory(msgs: Msg[], liveData: LiveData, itinerary?: Itinerary | null) {
  if (msgs.length <= 1) return;
  try {
    const safeMessages = sanitizeMessages(msgs);
    const history = loadHistory();

    // Lean itinerary — strip heavy live data arrays to save space
    let leanItinerary: any = null;
    if (itinerary) {
      const { live_flights, live_hotels, live_activities, hotel_alternatives, ...rest } = itinerary as any;
      leanItinerary = rest;
    }

    // LiveData is just summary counts (flightsFound, hotelsFound, etc.) — small, keep as-is

    const entry: ConversationEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      messages: safeMessages, liveData, itinerary: leanItinerary, timestamp: Date.now(),
      title: generateConversationTitle(safeMessages),
    };

    // Dedup: skip if last entry is same trip
    if (history.length > 0) {
      const lastEntry = history[0];
      const lastFirst = lastEntry.messages.find(m => m.role === "user")?.content;
      const newFirst = safeMessages.find(m => m.role === "user")?.content;
      if (lastFirst === newFirst && Math.abs(lastEntry.timestamp - Date.now()) < 60000) return;
    }

    history.unshift(entry);
    const trimmed = history.slice(0, 20);

    // Try to save; if quota exceeded, progressively trim
    for (let maxEntries = trimmed.length; maxEntries >= 1; maxEntries--) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed.slice(0, maxEntries)));
        return; // success
      } catch (e) {
        if (maxEntries === 1) {
          console.warn("[TripPlanner] Could not save history even with 1 entry, clearing old history");
          localStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
        }
      }
    }
  } catch (e) {
    console.error("[TripPlanner] saveToHistory failed:", e);
  }
}

// ── Extracted params ──
export function loadCachedExtractedParams(): any | null {
  try {
    const raw = localStorage.getItem(CACHE_EXTRACTED_PARAMS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveCachedExtractedParams(params: any | null) {
  try {
    if (!params) { localStorage.removeItem(CACHE_EXTRACTED_PARAMS_KEY); return; }
    localStorage.setItem(CACHE_EXTRACTED_PARAMS_KEY, JSON.stringify(params));
  } catch {}
}

// ── Refinement state ──
export function loadCachedRefinement(): any | null {
  try {
    const raw = localStorage.getItem(CACHE_REFINEMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveCachedRefinement(refinement: any | null) {
  try {
    if (!refinement) { localStorage.removeItem(CACHE_REFINEMENT_KEY); return; }
    localStorage.setItem(CACHE_REFINEMENT_KEY, JSON.stringify(refinement));
  } catch {}
}

// ── AI travelers ──
export function loadCachedAiTravelers(): { adults: number; children: number; infants: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_AI_TRAVELERS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveCachedAiTravelers(travelers: { adults: number; children: number; infants: number } | null) {
  try {
    if (!travelers) { localStorage.removeItem(CACHE_AI_TRAVELERS_KEY); return; }
    localStorage.setItem(CACHE_AI_TRAVELERS_KEY, JSON.stringify(travelers));
  } catch {}
}

// ── Searched cities ──
export function loadCachedSearchedCities(): { name: string; days: number }[] {
  try {
    const raw = sessionStorage.getItem(CACHE_SEARCHED_CITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function saveCachedSearchedCities(cities: { name: string; days: number }[]) {
  try {
    if (cities.length === 0) { sessionStorage.removeItem(CACHE_SEARCHED_CITIES_KEY); return; }
    sessionStorage.setItem(CACHE_SEARCHED_CITIES_KEY, JSON.stringify(cities));
  } catch {}
}

export function deleteFromHistory(id: string) {
  try { const history = loadHistory().filter(h => h.id !== id); localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}
