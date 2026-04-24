/** Shared types for trip planner components */

export interface FlightLeg {
  airline?: string;
  flight_number?: string;
  from?: string;
  to?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  stops?: number;
  label?: string;
}

export interface SelectedFlight {
  summary?: string;
  price: number;
  outbound?: FlightLeg;
  inbound?: FlightLeg;
  inter_city_legs?: FlightLeg[];
  is_live_price?: boolean;
  _rawSegments?: any[];
}

export interface SelectedHotel {
  name: string;
  stars: number;
  price_per_night: number;
  total_price: number;
  nights: number;
  room_type?: string;
  meal_basis?: string;
  is_live_price?: boolean;
}

export interface DayPlan {
  day: number;
  title: string;
  city?: string;
  date?: string;
  day_type?: string;
  is_travel_day?: boolean;
  departure_city?: string;
  arrival_city?: string;
  activities: Array<{
    time?: string;
    activity: string;
    type?: string;
    description?: string;
    cost_estimate?: number;
    category?: string;
    is_free?: boolean;
    is_bookable?: boolean;
    is_live_price?: boolean;
    source?: string;
    product_code?: string;
    product_option_code?: string;
    product_name?: string;
    option_title?: string;
    product_option_title?: string;
    search_title?: string;
    highlights?: string[];
    places_covered?: string[];
    pricingType?: string;
    duration_hours?: number;
    rating?: number;
    review_count?: number;
    price_confidence?: string;
    vela_id?: string;
    slug?: string;
    booking_notes?: string;
    tips?: string;
  }>;
}

export interface ConversionSummary {
  trip_style?: string;
  highlight_experiences?: string[];
  why_this_plan_works?: string;
}

export interface DecisionLayer {
  smart_alerts?: string[];
  price_optimization_suggestions?: string[];
  next_steps?: string[];
  confidence_message?: string;
  quick_preview?: string[];
}

export interface BudgetEstimate {
  total: number;
  breakdown: Record<string, number>;
}

/** Format traveler counts into a readable string */
export function formatTravelers(adults: number, children: number, infants: number): string {
  const parts: string[] = [`${adults} Adult${adults !== 1 ? "s" : ""}`];
  if (children > 0) parts.push(`${children} Child${children !== 1 ? "ren" : ""}`);
  if (infants > 0) parts.push(`${infants} Infant${infants !== 1 ? "s" : ""}`);
  return parts.join(" + ");
}

/** Category icon key map */
export const CATEGORY_ICON_KEYS = ["flights", "hotels", "activities", "transport"] as const;
