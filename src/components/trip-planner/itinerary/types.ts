/** Premium Itinerary Day Card — Data types */

export interface TimelineItemData {
  id: string;
  type: "flight" | "transfer" | "hotel" | "activity" | "meal" | "free" | "buffer";
  title: string;
  subtitle?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  travelMinutesFromPrevious?: number;
  bufferMinutesAfter?: number;
  locationArea?: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  isBookable?: boolean;
  statusBadge?: string;
  recommendationBadge?: "recommended" | "best_value" | "popular" | "premium" | "family" | "sunset" | "easy_day" | "fast_access";
  reasoning?: string;
  bestTimeNote?: string;
  crowdNote?: string;
  tags?: string[];
  includes?: string[];
  excludes?: string[];
  productCode?: string;
  productName?: string;
  productOptionCode?: string;
  optionTitle?: string;
  velaId?: string;
  slug?: string;
  highlights?: string[];
  placesCovered?: string[];
  source?: string;
  category?: string;
  city?: string;

  // AI match quality — from decision engine scoring (0-100)
  aiMatchScore?: number;

  // Flight-specific
  flightNumber?: string;
  airline?: string;
  arrivalTerminal?: string;

  // Transfer-specific
  transferType?: string;
  vehicleType?: string;

  // Hotel-specific
  hotelName?: string;
  restBufferMinutes?: number;

  // Alternatives
  options?: AlternativeOption[];
  selectedOptionId?: string;
}

export interface AlternativeOption {
  id: string;
  label: string;
  type: "selected" | "premium" | "value" | "budget" | "free_alt";
  name: string;
  shortDiff?: string;
  price?: number;
  priceDelta?: number;
  currency?: string;
  whyChoose?: string;
  features?: string[];
  isSelected?: boolean;
}

export interface DayCardData {
  dayNumber: number;
  title: string;
  city?: string;
  /** For transition days: the city being departed */
  departureCity?: string;
  /** For transition days: the city being arrived at */
  arrivalCity?: string;
  date?: string;
  dayType?: string;
  summary?: string;
  totalPrice?: number;
  currency?: string;
  bookableCount?: number;
  totalCount?: number;
  paceLabel?: string;
  weatherNote?: string;
  smartNotes?: string[];
  items: TimelineItemData[];
}
