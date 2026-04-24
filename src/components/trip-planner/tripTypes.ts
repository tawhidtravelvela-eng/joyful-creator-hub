/**
 * Comprehensive types for the AI Trip Planner system.
 * Centralizes all inline interfaces previously in TripPlanner.tsx.
 */

// Re-export shared types that were already extracted
export type { FlightLeg, SelectedFlight, SelectedHotel, DayPlan, ConversionSummary, DecisionLayer, BudgetEstimate } from "./types";
export { formatTravelers, CATEGORY_ICON_KEYS } from "./types";
export type { HybridPreviewData, PreviewPackage, Assumption } from "./HybridPreviewView";

export type Msg = { role: "user" | "assistant"; content: string };
export type LiveData = { flightsFound: number; hotelsFound: number; activitiesFound?: number } | null;

// Inspiration Mode types
export interface InspirationData {
  mode: "inspiration";
  archetype: string;
  destination: string;
  trip_type: string;
  traveler_type: string;
  experience_clusters: { name: string; priority: "essential" | "recommended" | "optional"; typical_duration: string; indoor_outdoor: "indoor" | "outdoor" | "both" }[];
  trip_frames: { label: string; duration: string; pacing: string; ideal_for: string; rough_budget_range: string; sample_flow: string[] }[];
  preview_itinerary: { day: number; flow: string }[];
  clarification_prompts: string[];
  ai_summary: string;
}

export interface PreviewData {
  popularRoutes?: { from_city: string; from_code: string; to_city: string; to_code: string; lowest_price: number; currency: string; airline: string; duration: string; stops: number }[];
  cachedFlightPrices?: { lowest_price: number; currency: string; source: string; travel_date: string; cabin_class: string }[];
  hotelPreviews?: { name: string; city: string; stars: number; rating: number; price: number; image: string }[];
  tjHotelPreviews?: { name: string; city_name: string; rating: number; hero_image_url: string; property_type: string }[];
  destinationInfo?: { name: string; country: string; image_url: string; rating: number; price: number };
}

export interface CityIntro {
  city_name: string;
  country: string;
  hero_image_url: string;
  intro_text: string;
  popular_areas: string[];
  best_time_to_visit: string;
  budget_ranges: {
    budget?: { min: number; max: number; currency: string; note: string };
    mid_range?: { min: number; max: number; currency: string; note: string };
    luxury?: { min: number; max: number; currency: string; note: string };
  };
}

export interface RouteIntelligence {
  origin: string;
  destination: string;
  cached_prices: { lowest_price: number; currency: string; cabin_class: string; source: string; travel_date: string }[];
  popular_routes: { from_code: string; to_code: string; from_city: string; to_city: string; airline: string; duration: string; stops: number; lowest_price: number }[];
  city_intro: CityIntro | null;
  route_tips: { flight_tip: string; best_months: string; avg_duration: string; common_airlines: string[]; travel_notes: string } | null;
}

export interface ExtractedParams {
  destination_city?: string;
  destination_country?: string;
  destination_countries?: string[];
  origin_city?: string;
  depart_date?: string;
  duration_days?: number;
  adults?: number;
  children?: number;
  infants?: number;
  travel_type?: string;
  travel_style?: string;
  prefer_direct?: boolean;
  cabin_class?: string;
  selection_priority?: string;
  budget_min?: number;
  budget_max?: number;
  budget_currency?: string;
  hotel_stars?: number;
  include_breakfast?: boolean;
  cities?: { name: string; days: number; nights?: number; country?: string; needs_city?: boolean; preferred_hotel?: string; hotel_area?: string; self_managed_nights?: number; must_visit?: string[] }[];
}

export interface FareDetails {
  base?: number;
  taxes?: number;
  total?: number;
  baseFare?: number;
  totalFare?: number;
}

export interface Itinerary {
  trip_title: string;
  destination: string;
  duration_days: number;
  travelers: number;
  adults?: number;
  children?: number;
  infants?: number;
  rooms?: number;
  budget_estimate: {
    currency: string;
    total: number;
    breakdown: Record<string, number>;
    is_estimated?: boolean;
  };
  selected_flight?: {
    outbound?: { airline: string; flight_number: string; from: string; to: string; departure: string; arrival: string; date: string; duration: string; stops: number; cabin_class: string };
    inbound?: { airline: string; flight_number: string; from: string; to: string; departure: string; arrival: string; date: string; duration: string; stops: number; cabin_class: string };
    inter_city_legs?: { label: string; airline: string; flight_number: string; from: string; to: string; departure: string; arrival: string; date: string; duration: string; stops: number; cabin_class: string; price?: number; currency?: string }[];
    summary: string; reason: string; price: number; currency: string; is_live_price: boolean;
    totalPrice?: number;
    paxPricing?: { ADT?: { base: number; taxes: number; total: number }; CHD?: { base: number; taxes: number; total: number }; INF?: { base: number; taxes: number; total: number } };
    adultFare?: FareDetails;
    childFare?: FareDetails;
    infantFare?: FareDetails;
    _rawId?: string; _rawSource?: string; _rawSegments?: any[];
  };
  selected_hotel?: { name: string; stars: number; price_per_night: number; total_price: number; nights: number; reason: string; currency: string; is_live_price: boolean; meal_basis?: string; room_type?: string; city?: string };
  selected_hotels?: { name: string; stars: number; price_per_night: number; total_price: number; nights: number; reason: string; currency: string; is_live_price: boolean; meal_basis?: string; room_type?: string; city: string }[];
  hotel_alternatives?: { name: string; stars: number; price_per_night: number; currency: string; meal_basis: string; price_note: string; is_live_price: boolean; room_type?: string }[];
  days: {
    day: number;
    title: string;
    city?: string;
    date?: string;
    day_type?: string;
    is_travel_day?: boolean;
    departure_city?: string;
    arrival_city?: string;
    activities: {
      time: string;
      activity: string;
      description: string;
      cost_estimate: number;
      category: string;
      is_free?: boolean;
      is_bookable?: boolean;
      is_live_price?: boolean;
      source?: string;
      product_code?: string;
      product_option_code?: string;
      option_title?: string;
      product_name?: string;
      highlights?: string[];
      places_covered?: string[];
      pricingType?: string;
      duration_hours?: number;
      _durationHours?: number;
      durationMinutes?: number;
      duration_source?: string;
      duration_confidence?: string;
      vela_id?: string;
      slug?: string;
      booking_notes?: string;
      product_option_title?: string;
      search_title?: string;
      rating?: number;
      review_count?: number;
      tips?: string;
      price_confidence?: string;
    }[];
    hotel: { name: string; area: string; price_per_night: number; stars: number; is_live_price?: boolean };
  }[];
  travel_connections?: { from_city: string; to_city: string; day: number; mode: string; estimated_duration?: string; notes?: string; estimated_price?: number; price_currency?: string; from_code?: string; to_code?: string }[];
  included?: string[];
  excluded?: string[];
  refund_policy?: string;
  assumptions?: string[];
  tips: string[];
  best_time_to_visit: string;
  live_flights?: { airline: string; flight_number: string; from: string; to: string; departure: string; arrival: string; date?: string; duration: string; stops: number; price: number; totalPrice?: number; currency: string; cabin_class?: string; paxPricing?: { ADT?: { base: number; taxes: number; total: number }; CHD?: { base: number; taxes: number; total: number }; INF?: { base: number; taxes: number; total: number } }; adultFare?: FareDetails; childFare?: FareDetails; infantFare?: FareDetails; return_flight?: { flight_number: string; departure: string; arrival: string; date?: string; duration: string; stops: number } }[];
  live_hotels?: { name: string; stars: number; price_per_night: number; currency: string; meal_basis: string }[];
  live_activities?: { name: string; price: number; currency: string; duration: string; rating: number; review_count: number; category: string; product_code: string; image: string; is_live_price: boolean; highlights?: string[]; pricingType?: string; shortDescription?: string }[];
  conversion_summary?: { trip_style: string; highlight_experiences: string[]; why_this_plan_works: string };
  conversion_score?: number;
  conversion_flags?: string[];
  improvement_actions?: string[];
  decision_layer?: {
    smart_alerts?: string[];
    price_optimization_suggestions?: string[];
    next_steps?: string[];
    confidence_message?: string;
    quick_preview?: string[];
  };
  decision_intelligence?: {
    score: number;
    score_breakdown: {
      must_visit_coverage: number;
      product_quality: number;
      option_accuracy: number;
      pacing_quality: number;
      geo_optimization: number;
      flight_quality: number;
      hotel_quality: number;
      price_value: number;
    };
    badges: { key: string; label: string; color: string }[];
    alerts: { type: "critical" | "warning" | "improvement" | "suggestion"; title: string; message: string; action?: string }[];
    recommendations: { type: "upgrade" | "replace" | "add" | "optimize"; target: "flight" | "hotel" | "activity"; message: string; impact: "high" | "medium" | "low" }[];
    confidence: { score: number; label: string };
  };
  pricing_intelligence?: {
    total_display_price: number;
    live_portion: number;
    cached_portion: number;
    estimated_portion: number;
    confidence_score: number;
    requires_booking_revalidation: boolean;
    component_count: number;
    live_count: number;
    stale_count: number;
  };
}

export type ConversationEntry = {
  id: string;
  messages: Msg[];
  liveData: LiveData;
  itinerary?: Itinerary | null;
  timestamp: number;
  title: string;
};

export type PlannerTheme = "dark" | "light";
