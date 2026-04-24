/**
 * Normalized transfer types for the managed transfer system.
 * Frontend reads these exclusively — never raw API or estimation data directly.
 */

export type PricingSource = "UNIFIED_API" | "PRODUCT_MATCH" | "SIMILAR_PRODUCT" | "AI_ESTIMATED";
export type PriceAccuracy = "EXACT" | "HIGH" | "MEDIUM" | "LOW";
export type Bookability = "live_bookable" | "likely_bookable" | "arrange_manually" | "verification_needed";

export type VehicleClass =
  | "standard_sedan"
  | "family_mpv"
  | "premium_suv"
  | "private_van"
  | "shared_shuttle"
  | "resort_speedboat"
  | "seaplane"
  | "domestic_flight_boat";

export type TransferType =
  | "airport_hotel"
  | "hotel_airport"
  | "hotel_hotel"
  | "resort_transfer"
  | "intercity"
  | "port_hotel"
  | "station_hotel";

export type TimeBucket = "early_morning" | "daytime" | "evening" | "late_night";

export interface NormalizedTransfer {
  id: string;
  title: string;
  transfer_type: TransferType;
  mode: string;
  vehicle_class: VehicleClass;
  duration_minutes: number;
  pricing_source: PricingSource;
  price_accuracy: PriceAccuracy;
  currency: string;
  total_price: number;
  per_person_price?: number;
  is_roundtrip: boolean;
  tags: string[];
  reason_text: string;
  confidence_score: number;
  is_mandatory: boolean;
  bookability: Bookability;
  policies?: {
    cancellation?: string;
    baggage?: string;
    meeting_point?: string;
    daylight_only?: boolean;
  };
  source_freshness?: string;
  // Pickup / dropoff
  pickup_type: string;
  pickup_code?: string;
  pickup_name?: string;
  dropoff_type: string;
  dropoff_code?: string;
  dropoff_name?: string;
  // Product match metadata
  product_code?: string;
  product_name?: string;
  // Day association
  day_index?: number;
  position?: "arrival" | "departure" | "intercity" | "resort";
  // Traveler fit
  traveler_fit?: string;
  luggage_fit?: string;
}

export interface TransferResolutionRequest {
  transfers: {
    pickup_type: string;
    pickup_code?: string;
    pickup_name?: string;
    dropoff_type: string;
    dropoff_code?: string;
    dropoff_name?: string;
    city: string;
    country: string;
    passengers: number;
    adults?: number;
    children?: number;
    infants?: number;
    luggage_class?: string;
    vehicle_class?: string;
    time_bucket?: TimeBucket;
    transfer_type?: TransferType;
    day_index?: number;
    position?: "arrival" | "departure" | "intercity" | "resort";
  }[];
  currency: string;
  available_products?: any[]; // tour/activity products that might be transfers
}

export interface TransferResolutionResponse {
  transfers: NormalizedTransfer[];
  cache_hits: number;
  api_calls: number;
  estimation_count: number;
}

// Transfer detection patterns for identifying transfer products in tour results
export const TRANSFER_PATTERNS = [
  /airport\s*transfer/i,
  /airport\s*pickup/i,
  /airport\s*drop/i,
  /private\s*transfer/i,
  /shared\s*transfer/i,
  /hotel\s*transfer/i,
  /chauffeur/i,
  /intercity\s*transfer/i,
  /speedboat\s*transfer/i,
  /seaplane/i,
  /resort\s*transfer/i,
  /port\s*transfer/i,
  /station\s*transfer/i,
  /ferry\s*transfer/i,
  /limousine/i,
  /private\s*car/i,
  /(?:to|from)\s+(?:airport|hotel|resort|port|station)/i,
  /pick[\s-]?up.*(?:airport|hotel)/i,
  /drop[\s-]?off.*(?:airport|hotel)/i,
];

export function isTransferProduct(name: string): boolean {
  return TRANSFER_PATTERNS.some(p => p.test(name));
}

// Badge display helpers
export function getSourceBadge(source: PricingSource): { label: string; variant: "default" | "success" | "warning" | "info" } {
  switch (source) {
    case "UNIFIED_API": return { label: "Live Price", variant: "success" };
    case "PRODUCT_MATCH": return { label: "Matched Product", variant: "info" };
    case "SIMILAR_PRODUCT": return { label: "Similar Route", variant: "info" };
    case "AI_ESTIMATED": return { label: "Arranged Price", variant: "warning" };
  }
}

export function getAccuracyBadge(accuracy: PriceAccuracy): { label: string; color: string } {
  switch (accuracy) {
    case "EXACT": return { label: "Exact Price", color: "text-emerald-400" };
    case "HIGH": return { label: "Recently Verified", color: "text-blue-400" };
    case "MEDIUM": return { label: "Estimated", color: "text-amber-400" };
    case "LOW": return { label: "Approximate", color: "text-orange-400" };
  }
}

export function getVehicleLabel(vc: VehicleClass): string {
  const labels: Record<VehicleClass, string> = {
    standard_sedan: "Sedan",
    family_mpv: "Family MPV",
    premium_suv: "Premium SUV",
    private_van: "Private Van",
    shared_shuttle: "Shared Shuttle",
    resort_speedboat: "Speedboat",
    seaplane: "Seaplane",
    domestic_flight_boat: "Domestic Flight + Boat",
  };
  return labels[vc] || vc;
}

export function getTransferTitle(t: NormalizedTransfer): string {
  if (t.title) return t.title;
  const positionLabels: Record<string, string> = {
    arrival: "Arranged Airport Pickup",
    departure: "Hotel to Airport Drop-off",
    intercity: "Private Transfer Arranged",
    resort: "Resort Transfer",
  };
  return positionLabels[t.position || "arrival"] || "Private Transfer Arranged";
}
