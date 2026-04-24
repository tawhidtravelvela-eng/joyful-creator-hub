// Enterprise B2B flight result types — distinct from consumer PremiumFlight
export interface B2BFareSegment {
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departure: string; // ISO
  arrival: string;   // ISO
  duration: string;
  cabin: string;
  bookingClass: string;
  fareBasis: string;
  aircraft?: string;
  operatingCarrier?: string;
}

export interface B2BLayover {
  airport: string;
  city: string;
  duration: string;
  selfTransfer?: boolean;
  airportChange?: boolean;
}

export type B2BPolicyStatus = "compliant" | "out_of_policy" | "approval_required";

export interface B2BFareRow {
  id: string;
  airline: string;
  airlineName: string;
  flightNumberSummary: string;
  validatingCarrier: string;
  isPreferredAirline?: boolean;

  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  departure: string; // ISO
  arrival: string;   // ISO
  durationTotal: string;
  stops: number;

  cabin: string;
  fareFamily: string;
  brandName?: string;

  baggageCabin: string;
  baggageCheckin: string;

  isRefundable: boolean;
  isReissueAllowed: boolean;
  changeFeeNote?: string;
  refundFeeNote?: string;

  netFare: number;
  taxes: number;
  sellFare: number;
  currency: string;

  /** Inventory provider (e.g. "travelport", "amadeus") — used to resolve commission + AIT % */
  source?: string;
  /** Base fare component when API returns it; used for commission base */
  basePrice?: number;

  ticketingDeadline: string; // ISO
  ttlMinutes: number; // computed convenience

  segments: B2BFareSegment[];
  layovers: B2BLayover[];

  fareRulesSummary: string;
  remarks?: string;

  isLowestNet?: boolean;
  hasSelfTransfer?: boolean;

  /** Raw unified-flight-search payload — used to launch the booking flow */
  _raw?: any;
}

export interface B2BSearchContext {
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  tripType: "OW" | "RT" | "MC";
  fareType: "Published" | "Private" | "Corporate" | "All";
  account: string;
  pnr?: string;
}

export interface B2BFiltersState {
  airlines: string[];
  stops: ("0" | "1" | "2+")[];
  refundableOnly: boolean;
  baggageOnly: boolean;
  layoverMaxMinutes: number;
  priceRange: [number, number];
}
