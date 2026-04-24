// Shared types for the premium flight results UI
export interface FlightSegmentLite {
  carrier?: string;
  operatingCarrier?: string;
  origin?: string;
  destination?: string;
  departure?: string;
  arrival?: string;
  flightNumber?: string;
  duration?: string;
}

export interface PremiumFlight {
  id: string;
  airline: string;
  from_city: string;
  to_city: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  stops: number;
  class: string;
  source?: string;
  flightNumber?: string;
  currency?: string;
  isRefundable?: boolean;
  segments?: FlightSegmentLite[];
  baggageAllowance?: { cabin?: string; checkin?: string } | null;
  basePrice?: number;
  taxes?: number;
}

export type SortMode = "best" | "cheapest" | "fastest" | "earliest" | "ai";

export interface RouteInsight {
  common_route: string;
  shortest_avg_duration: string;
  cheaper_dates?: { date: string; price: number; delta_pct: number }[];
}

export interface UrgencySignal {
  level: "low" | "medium" | "high";
  message: string;
}

// Structured advisor payload — replaces flat one-liners with a senior-agent style breakdown
export interface AdvisorEvidence {
  icon: "price" | "time" | "comfort" | "stops" | "baggage" | "refund" | "ontime" | "trend";
  label: string;       // ≤4 words, e.g. "18% below typical"
  detail?: string;     // optional ≤8 words clarifier shown on hover/below
  tone?: "good" | "neutral" | "warn";
}

export interface AdvisorPayload {
  // Conversational lead written like a human travel agent (12-26 words).
  lead: string;
  // Verdict pill that summarises the recommendation in 1-3 words.
  verdict: { label: string; tone: "good" | "neutral" | "warn" };
  // 2-4 evidence chips that prove the recommendation.
  evidence: AdvisorEvidence[];
  // Optional 1 action: "Book within 3 days" / "Hold and watch" / "See cheaper dates".
  action?: { label: string; kind: "book_now" | "hold" | "shift_dates" | "compare" };
}

export interface FlightInsight {
  headline: string;
  recommendation: string;
  confidence: "low" | "medium" | "high";
  price_verdict: "great_deal" | "fair" | "above_average" | "unknown";
  trend_direction: "up" | "down" | "stable" | "unknown";
  trend_sparkline: number[];
  trend_dates: string[];
  predicted_change_pct: number;
  best_book_window: string;
  fare_alerts: string[];
  ai_pick_id?: string;
  ai_pick_rationale?: string;
  ai_pick_value_delta_pct?: number;
  // NEW: structured advisor breakdowns
  smart_tip?: AdvisorPayload;        // for the right-rail Smart Tip card
  pick_advisor?: AdvisorPayload;     // for the per-card "Why Vela picked this"
  route_insight?: RouteInsight;
  urgency?: UrgencySignal;
  trust_signals?: string[];
  generated_at: string;
  source: "ai" | "heuristic" | "cache";
}
