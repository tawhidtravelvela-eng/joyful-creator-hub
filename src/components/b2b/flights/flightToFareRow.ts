import { AIRLINE_NAMES } from "@/data/airlines";
import type { B2BFareRow, B2BFareSegment, B2BLayover } from "./types";

/** Shape returned by unified-flight-search */
export interface UnifiedFlight {
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
  segments?: Array<{
    origin?: string;
    destination?: string;
    from?: string;
    to?: string;
    departure: string;
    arrival: string;
    carrier?: string;
    flightNumber?: string;
    operatingCarrier?: string;
    operatingFlightNumber?: string;
    bookingCode?: string;
    cabin?: string;
    fareBasis?: string;
    aircraft?: string;
    duration?: string;
  }>;
  baggageAllowance?: { cabin?: string; checkin?: string } | null;
  basePrice?: number;
  taxes?: number;
  ticketingDeadline?: string;
  fareFamily?: string;
  brandName?: string;
}

const minsToDuration = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.max(0, Math.round(mins % 60));
  return `${h}h ${m}m`;
};

const diffMins = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

/** Convert a unified-flight-search Flight into a B2B enterprise row */
export function flightToFareRow(f: UnifiedFlight): B2BFareRow {
  const code = f.airline || "";
  const airlineName = AIRLINE_NAMES[code] || code || "Airline";
  const segments: B2BFareSegment[] = (f.segments || []).map((s) => ({
    carrier: s.carrier || code,
    flightNumber: s.flightNumber || f.flightNumber || "",
    origin: s.origin || s.from || "",
    destination: s.destination || s.to || "",
    departure: s.departure,
    arrival: s.arrival,
    duration: s.duration || minsToDuration(diffMins(s.departure, s.arrival)),
    cabin: s.cabin || f.class || "Economy",
    bookingClass: s.bookingCode || "",
    fareBasis: s.fareBasis || "",
    aircraft: s.aircraft,
    operatingCarrier: s.operatingCarrier,
  }));

  const layovers: B2BLayover[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    layovers.push({
      airport: a.destination,
      city: a.destination,
      duration: minsToDuration(diffMins(a.arrival, b.departure)),
    });
  }

  const sell = Number(f.price) || 0;
  // Only set net/taxes when the API returned them — never fabricate
  const base = f.basePrice != null ? Number(f.basePrice) : undefined;
  const taxes = f.taxes != null ? Number(f.taxes) : undefined;
  const net = base != null && taxes != null ? base + taxes : sell;

  // Ticketing deadline: trust API value if present, else null/0
  const deadlineIso = f.ticketingDeadline || "";
  const ttlMinutes = deadlineIso
    ? Math.max(0, Math.round((new Date(deadlineIso).getTime() - Date.now()) / 60000))
    : 0;

  return {
    id: f.id,
    airline: code,
    airlineName,
    flightNumberSummary: `${code} ${f.flightNumber || segments[0]?.flightNumber || ""}`.trim(),
    validatingCarrier: code,

    origin: segments[0]?.origin || "",
    destination: segments[segments.length - 1]?.destination || "",
    originCity: f.from_city || "",
    destinationCity: f.to_city || "",
    departure: f.departure,
    arrival: f.arrival,
    durationTotal: f.duration || minsToDuration(diffMins(f.departure, f.arrival)),
    stops: typeof f.stops === "number" ? f.stops : Math.max(0, segments.length - 1),

    cabin: f.class || "Economy",
    fareFamily: f.fareFamily || "",
    brandName: f.brandName,

    baggageCabin: f.baggageAllowance?.cabin || "",
    baggageCheckin: f.baggageAllowance?.checkin || "",

    isRefundable: !!f.isRefundable,
    isReissueAllowed: false,
    changeFeeNote: undefined,
    refundFeeNote: undefined,

    netFare: net,
    taxes: taxes ?? 0,
    sellFare: sell,
    currency: f.currency || "USD",

    source: f.source,
    basePrice: base,

    ticketingDeadline: deadlineIso,
    ttlMinutes,

    segments,
    layovers,

    fareRulesSummary: f.isRefundable ? "Refundable (fees may apply)" : "Non-refundable",

    _raw: f,
  };
}
