/**
 * useTripUIReducer — consolidates ~30 UI-only useState calls from TripPlanner.tsx
 * into a single useReducer for fewer re-renders and cleaner state transitions.
 */
import { useReducer, useCallback } from "react";
import type { PreviewData, CityIntro, RouteIntelligence, PlannerTheme } from "@/components/trip-planner/tripTypes";
import type { BookingTierId } from "@/components/trip-planner/BookingDialog";

// ── State shape ──
export interface TripUIState {
  // Theme
  plannerTheme: PlannerTheme;

  // Preview / intel
  previewData: PreviewData | null;
  cityIntro: CityIntro | null;
  cityIntroLoading: boolean;
  routeIntel: RouteIntelligence | null;
  routeIntelLoading: boolean;

  // Flight popup & filters
  flightDetailOpen: boolean;
  showAllFlightsPopup: boolean;
  flightFilterStops: number | null;
  flightFilterAirline: string | null;
  flightSortBy: string;
  flightLegTab: string;
  flightInfoPopup: any;

  // Hotel popup & filters
  showAllHotelsPopup: boolean;
  hotelSortChip: string;
  hotelFilterBreakfast: boolean;
  hotelSearchQuery: string;

  // Activity popup & filters
  showAllActivitiesPopup: boolean;
  activitySortBy: "relevance" | "price_low" | "price_high" | "rating" | "duration";
  activitySearchQuery: string;
  popupCityTab: string;

  // Lightbox
  lightboxImages: string[];
  lightboxIdx: number;
  lightboxOpen: boolean;

  // Booking dialog
  showBookingDialog: boolean;
  bookingInitialTier: BookingTierId | undefined;

  // Misc
  resolvedHotelImage: string;
  pdfDownloading: boolean;

  // Selection state (Decision Engine)
  activeHotelCity: string | null;
  activeTourCity: string | null;
  aiRecommendedHotelsByCity: Record<string, string>;    // city → hotelId
  aiRecommendedToursByActivity: Record<string, string>; // activityKey → tourId
}

// ── Actions ──
export type TripUIAction =
  | { type: "SET_PLANNER_THEME"; payload: PlannerTheme }
  | { type: "SET_PREVIEW_DATA"; payload: PreviewData | null }
  | { type: "SET_CITY_INTRO"; payload: CityIntro | null }
  | { type: "SET_CITY_INTRO_LOADING"; payload: boolean }
  | { type: "SET_ROUTE_INTEL"; payload: RouteIntelligence | null }
  | { type: "SET_ROUTE_INTEL_LOADING"; payload: boolean }
  | { type: "SET_FLIGHT_DETAIL_OPEN"; payload: boolean }
  | { type: "SET_SHOW_ALL_FLIGHTS_POPUP"; payload: boolean }
  | { type: "SET_FLIGHT_FILTER_STOPS"; payload: number | null }
  | { type: "SET_FLIGHT_FILTER_AIRLINE"; payload: string | null }
  | { type: "SET_FLIGHT_SORT_BY"; payload: string }
  | { type: "SET_FLIGHT_LEG_TAB"; payload: string }
  | { type: "SET_FLIGHT_INFO_POPUP"; payload: any }
  | { type: "SET_SHOW_ALL_HOTELS_POPUP"; payload: boolean }
  | { type: "SET_HOTEL_SORT_CHIP"; payload: string }
  | { type: "SET_HOTEL_FILTER_BREAKFAST"; payload: boolean }
  | { type: "SET_HOTEL_SEARCH_QUERY"; payload: string }
  | { type: "SET_SHOW_ALL_ACTIVITIES_POPUP"; payload: boolean }
  | { type: "SET_ACTIVITY_SORT_BY"; payload: TripUIState["activitySortBy"] }
  | { type: "SET_ACTIVITY_SEARCH_QUERY"; payload: string }
  | { type: "SET_POPUP_CITY_TAB"; payload: string }
  | { type: "OPEN_LIGHTBOX"; payload: { images: string[]; startIdx: number } }
  | { type: "CLOSE_LIGHTBOX" }
  | { type: "SET_LIGHTBOX_IDX"; payload: number }
  | { type: "SET_SHOW_BOOKING_DIALOG"; payload: boolean }
  | { type: "SET_BOOKING_INITIAL_TIER"; payload: BookingTierId | undefined }
  | { type: "OPEN_BOOKING_DIALOG"; payload: { tier?: BookingTierId } }
  | { type: "SET_RESOLVED_HOTEL_IMAGE"; payload: string }
  | { type: "SET_PDF_DOWNLOADING"; payload: boolean }
  | { type: "SET_ACTIVE_HOTEL_CITY"; payload: string | null }
  | { type: "SET_ACTIVE_TOUR_CITY"; payload: string | null }
  | { type: "SET_AI_RECOMMENDED_HOTELS"; payload: Record<string, string> }
  | { type: "SET_AI_RECOMMENDED_TOURS"; payload: Record<string, string> }
  | { type: "RESET_UI" };

// ── Initial state ──
function createInitialState(): TripUIState {
  const storedTheme = typeof window !== "undefined"
    ? (localStorage.getItem("vela-planner-theme") as PlannerTheme | null)
    : null;

  return {
    plannerTheme: storedTheme || "dark",
    previewData: null,
    cityIntro: null,
    cityIntroLoading: false,
    routeIntel: null,
    routeIntelLoading: false,
    flightDetailOpen: false,
    showAllFlightsPopup: false,
    flightFilterStops: null,
    flightFilterAirline: null,
    flightSortBy: "price",
    flightLegTab: "all",
    flightInfoPopup: null,
    showAllHotelsPopup: false,
    hotelSortChip: "price",
    hotelFilterBreakfast: false,
    hotelSearchQuery: "",
    showAllActivitiesPopup: false,
    activitySortBy: "relevance",
    activitySearchQuery: "",
    popupCityTab: "all",
    lightboxImages: [],
    lightboxIdx: 0,
    lightboxOpen: false,
    showBookingDialog: false,
    bookingInitialTier: undefined,
    resolvedHotelImage: "",
    pdfDownloading: false,
    activeHotelCity: null,
    activeTourCity: null,
    aiRecommendedHotelsByCity: {},
    aiRecommendedToursByActivity: {},
  };
}

// ── Reducer ──
function tripUIReducer(state: TripUIState, action: TripUIAction): TripUIState {
  switch (action.type) {
    case "SET_PLANNER_THEME":
      return { ...state, plannerTheme: action.payload };
    case "SET_PREVIEW_DATA":
      return { ...state, previewData: action.payload };
    case "SET_CITY_INTRO":
      return { ...state, cityIntro: action.payload };
    case "SET_CITY_INTRO_LOADING":
      return { ...state, cityIntroLoading: action.payload };
    case "SET_ROUTE_INTEL":
      return { ...state, routeIntel: action.payload };
    case "SET_ROUTE_INTEL_LOADING":
      return { ...state, routeIntelLoading: action.payload };
    case "SET_FLIGHT_DETAIL_OPEN":
      return { ...state, flightDetailOpen: action.payload };
    case "SET_SHOW_ALL_FLIGHTS_POPUP":
      return { ...state, showAllFlightsPopup: action.payload };
    case "SET_FLIGHT_FILTER_STOPS":
      return { ...state, flightFilterStops: action.payload };
    case "SET_FLIGHT_FILTER_AIRLINE":
      return { ...state, flightFilterAirline: action.payload };
    case "SET_FLIGHT_SORT_BY":
      return { ...state, flightSortBy: action.payload };
    case "SET_FLIGHT_LEG_TAB":
      return { ...state, flightLegTab: action.payload };
    case "SET_FLIGHT_INFO_POPUP":
      return { ...state, flightInfoPopup: action.payload };
    case "SET_SHOW_ALL_HOTELS_POPUP":
      return { ...state, showAllHotelsPopup: action.payload };
    case "SET_HOTEL_SORT_CHIP":
      return { ...state, hotelSortChip: action.payload };
    case "SET_HOTEL_FILTER_BREAKFAST":
      return { ...state, hotelFilterBreakfast: action.payload };
    case "SET_HOTEL_SEARCH_QUERY":
      return { ...state, hotelSearchQuery: action.payload };
    case "SET_SHOW_ALL_ACTIVITIES_POPUP":
      return { ...state, showAllActivitiesPopup: action.payload };
    case "SET_ACTIVITY_SORT_BY":
      return { ...state, activitySortBy: action.payload };
    case "SET_ACTIVITY_SEARCH_QUERY":
      return { ...state, activitySearchQuery: action.payload };
    case "SET_POPUP_CITY_TAB":
      return { ...state, popupCityTab: action.payload };
    case "OPEN_LIGHTBOX":
      return {
        ...state,
        lightboxImages: action.payload.images,
        lightboxIdx: action.payload.startIdx,
        lightboxOpen: true,
      };
    case "CLOSE_LIGHTBOX":
      return { ...state, lightboxOpen: false };
    case "SET_LIGHTBOX_IDX":
      return { ...state, lightboxIdx: action.payload };
    case "SET_SHOW_BOOKING_DIALOG":
      return { ...state, showBookingDialog: action.payload };
    case "SET_BOOKING_INITIAL_TIER":
      return { ...state, bookingInitialTier: action.payload };
    case "OPEN_BOOKING_DIALOG":
      return { ...state, showBookingDialog: true, bookingInitialTier: action.payload.tier };
    case "SET_RESOLVED_HOTEL_IMAGE":
      return { ...state, resolvedHotelImage: action.payload };
    case "SET_PDF_DOWNLOADING":
      return { ...state, pdfDownloading: action.payload };
    case "SET_ACTIVE_HOTEL_CITY":
      return { ...state, activeHotelCity: action.payload };
    case "SET_ACTIVE_TOUR_CITY":
      return { ...state, activeTourCity: action.payload };
    case "SET_AI_RECOMMENDED_HOTELS":
      return { ...state, aiRecommendedHotelsByCity: action.payload };
    case "SET_AI_RECOMMENDED_TOURS":
      return { ...state, aiRecommendedToursByActivity: action.payload };
    case "RESET_UI": {
      const fresh = createInitialState();
      // Preserve theme on reset
      return { ...fresh, plannerTheme: state.plannerTheme };
    }
    default:
      return state;
  }
}

// ── Hook ──
export function useTripUIReducer() {
  const [ui, dispatch] = useReducer(tripUIReducer, undefined, createInitialState);

  const cyclePlannerTheme = useCallback(() => {
    const next: PlannerTheme = ui.plannerTheme === "dark" ? "light" : "dark";
    dispatch({ type: "SET_PLANNER_THEME", payload: next });
    localStorage.setItem("vela-planner-theme", next);
  }, [ui.plannerTheme]);

  const openLightbox = useCallback((images: string[], startIdx = 0) => {
    if (!images.length) return;
    dispatch({ type: "OPEN_LIGHTBOX", payload: { images, startIdx } });
  }, []);

  const openBookingDialog = useCallback((tier?: BookingTierId) => {
    dispatch({ type: "OPEN_BOOKING_DIALOG", payload: { tier } });
  }, []);

  return { ui, dispatch, cyclePlannerTheme, openLightbox, openBookingDialog };
}
