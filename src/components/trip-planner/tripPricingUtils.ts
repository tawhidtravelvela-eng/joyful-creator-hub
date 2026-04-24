/**
 * Pricing utility functions for the AI Trip Planner.
 * Extracted from TripPlanner.tsx for reusability and testability.
 */
import type { FareDetails, Itinerary } from "./tripTypes";
import { AIRLINE_NAMES } from "@/data/airlines";

// ── Room calculation ──
export function calcRooms(adults: number, children: number): number {
  const totalBeds = adults + Math.ceil(children / 2);
  return Math.max(1, Math.ceil(totalBeds / 2));
}

// ── Fare extraction ──
export function getExactFareTotal(fare?: FareDetails | null): number | null {
  if (!fare) return null;
  const explicitTotal = fare.total ?? fare.totalFare;
  if (Number.isFinite(explicitTotal)) return Math.round(Number(explicitTotal));
  const base = fare.base ?? fare.baseFare;
  const taxes = fare.taxes;
  if (Number.isFinite(base) && Number.isFinite(taxes)) {
    return Math.round(Number(base) + Number(taxes));
  }
  return null;
}

export function buildExactFare(total?: number | null): FareDetails | undefined {
  return total != null && Number.isFinite(total)
    ? { total: Math.round(Number(total)), totalFare: Math.round(Number(total)) }
    : undefined;
}

export function getFlightFareBreakdown(flight: any): { adult: number | null; child: number | null; infant: number | null } {
  if (!flight) return { adult: null, child: null, infant: null };
  return {
    adult: getExactFareTotal(flight.paxPricing?.ADT) ?? getExactFareTotal(flight.adultFare) ?? (Number.isFinite(flight.price) ? Math.round(Number(flight.price)) : null),
    child: getExactFareTotal(flight.paxPricing?.CHD) ?? getExactFareTotal(flight.childFare),
    infant: getExactFareTotal(flight.paxPricing?.INF) ?? getExactFareTotal(flight.infantFare),
  };
}

export function aggregateFlightFareBreakdown(flights: any[]): { paxPricing?: Record<string, { base: number; taxes: number; total: number }>; adultFare?: FareDetails; childFare?: FareDetails; infantFare?: FareDetails } {
  const aggregatedPaxPricing: Record<string, { base: number; taxes: number; total: number }> = {};
  let adultTotal = 0, childTotal = 0, infantTotal = 0;
  let hasAdultFare = false, hasChildFare = false, hasInfantFare = false;

  for (const flight of flights) {
    const pp = flight?.paxPricing;
    if (pp) {
      for (const paxType of ["ADT", "CHD", "INF"] as const) {
        if (pp[paxType]) {
          if (!aggregatedPaxPricing[paxType]) aggregatedPaxPricing[paxType] = { base: 0, taxes: 0, total: 0 };
          aggregatedPaxPricing[paxType].base += Number(pp[paxType].base || 0);
          aggregatedPaxPricing[paxType].taxes += Number(pp[paxType].taxes || 0);
          aggregatedPaxPricing[paxType].total += Number(pp[paxType].total || 0);
        }
      }
    }
    const adultFare = getExactFareTotal(flight?.adultFare);
    const childFare = getExactFareTotal(flight?.childFare);
    const infantFare = getExactFareTotal(flight?.infantFare);
    if (adultFare != null) { adultTotal += adultFare; hasAdultFare = true; }
    if (childFare != null) { childTotal += childFare; hasChildFare = true; }
    if (infantFare != null) { infantTotal += infantFare; hasInfantFare = true; }
  }

  return {
    paxPricing: Object.keys(aggregatedPaxPricing).length > 0 ? aggregatedPaxPricing : undefined,
    adultFare: buildExactFare(hasAdultFare ? adultTotal : null),
    childFare: buildExactFare(hasChildFare ? childTotal : null),
    infantFare: buildExactFare(hasInfantFare ? infantTotal : null),
  };
}

export function calcFlightCost(flight: any, adults: number, children: number, infants: number): number {
  if (!flight) return 0;
  // For multi-city combined flights, totalPrice is the authoritative all-pax sum
  // computed server-side across all legs. Prefer it over per-pax multiplication
  // which would use estimated child/infant ratios.
  const isMultiCity = flight.inter_city_legs?.length > 0;
  if (isMultiCity && flight.totalPrice && flight.totalPrice > 0) {
    return Math.round(flight.totalPrice);
  }
  const fares = getFlightFareBreakdown(flight);
  if (fares.adult != null) {
    return Math.round((fares.adult * adults) + ((fares.child ?? 0) * children) + ((fares.infant ?? 0) * infants));
  }
  if (flight.totalPrice && flight.totalPrice > 0) return Math.round(flight.totalPrice);
  return Math.round((Number(flight.price) || 0) * adults);
}

export function getPerAdultPrice(flight: any): number {
  return getFlightFareBreakdown(flight).adult ?? 0;
}

export function getPerChildPrice(flight: any): number | null {
  return getFlightFareBreakdown(flight).child;
}

export function getPerInfantPrice(flight: any): number | null {
  return getFlightFareBreakdown(flight).infant;
}

export function calcHotelCost(pricePerNightPerRoom: number, nights: number, rooms: number): number {
  return Math.round(pricePerNightPerRoom * nights * rooms);
}

export function calcActivityCost(perPersonPrice: number, adults: number, children: number, childPrice?: number): number {
  const effectiveChildPrice = childPrice != null ? childPrice : perPersonPrice;
  return Math.round(perPersonPrice * adults + effectiveChildPrice * children);
}

export function formatTravelerBreakdown(adults: number, children: number, infants: number): string {
  const parts: string[] = [];
  parts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
  if (children > 0) parts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
  if (infants > 0) parts.push(`${infants} infant${infants !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

// ── Airline helpers ──
export function getAirlineInfo(airlineRaw: string): { name: string; code: string; logoUrl: string } {
  const raw = (airlineRaw || "").trim();
  const isCode = /^[A-Z0-9]{2}$/i.test(raw);
  if (isCode) {
    const code = raw.toUpperCase();
    return { code, name: AIRLINE_NAMES[code] || code, logoUrl: `https://pics.avs.io/48/48/${code}.png` };
  }
  const upperRaw = raw.toUpperCase();
  let foundCode = "";
  for (const [code, name] of Object.entries(AIRLINE_NAMES)) {
    if (name.toUpperCase() === upperRaw || upperRaw.includes(name.toUpperCase())) { foundCode = code; break; }
  }
  const fnMatch = raw.match(/^([A-Z0-9]{2})\d/i);
  if (!foundCode && fnMatch) foundCode = fnMatch[1].toUpperCase();
  return { code: foundCode, name: foundCode ? (AIRLINE_NAMES[foundCode] || raw) : raw, logoUrl: foundCode ? `https://pics.avs.io/48/48/${foundCode}.png` : "" };
}

export function formatAirlineDisplay(ai: { code: string; name: string }): string {
  if (!ai.code) return ai.name || "Airline";
  if (ai.name && ai.name !== ai.code) return `${ai.name} (${ai.code})`;
  return ai.code;
}

// ── Flight helpers ──
export const computeFlightDuration = (dep: string | undefined, arr: string | undefined): string => {
  if (!dep || !arr) return "";
  try {
    const diff = new Date(arr).getTime() - new Date(dep).getTime();
    if (diff <= 0 || isNaN(diff)) return "";
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  } catch { return ""; }
};

export const prefixFlightNumber = (fn: string | undefined, airlineCode: string | undefined): string => {
  if (!fn) return "";
  if (/^[A-Z]{2}/i.test(fn)) return fn;
  return airlineCode ? `${airlineCode}${fn}` : fn;
};

export const formatFlightTime = (t: string | undefined): string => {
  if (!t) return "TBD";
  const isoMatch = t.match(/T(\d{2}:\d{2})/);
  if (isoMatch) return isoMatch[1];
  const timeMatch = t.match(/^(\d{1,2}:\d{2})/);
  if (timeMatch) return timeMatch[1].padStart(5, "0");
  return t.length > 5 ? t.slice(0, 5) : t;
};

export const formatFlightDate = (t: string | undefined, fallbackDate?: string): string => {
  const src = t || fallbackDate || "";
  let dateMatch = src.match(/(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch && fallbackDate) dateMatch = fallbackDate.match(/(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return "";
  try {
    const d = new Date(dateMatch[1] + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  } catch { return dateMatch[1]; }
};

// ── IATA → City resolution ──
export const IATA_TO_CITY: Record<string, string> = {
  DAC: "Dhaka", SIN: "Singapore", KUL: "Kuala Lumpur", LGK: "Langkawi", PEN: "Penang",
  BKK: "Bangkok", DXB: "Dubai", HKT: "Phuket", DPS: "Bali", MLE: "Maldives",
  DEL: "Delhi", BOM: "Mumbai", CCU: "Kolkata", CMB: "Colombo", KTM: "Kathmandu",
  CGP: "Chittagong", CXB: "Cox's Bazar", HKG: "Hong Kong", NRT: "Tokyo", KIX: "Osaka",
  ICN: "Seoul", TPE: "Taipei", MNL: "Manila", SGN: "Ho Chi Minh", HAN: "Hanoi",
  RGN: "Yangon", DOH: "Doha", MCT: "Muscat", IST: "Istanbul", JED: "Jeddah",
  RUH: "Riyadh", AUH: "Abu Dhabi", BAH: "Bahrain", KWI: "Kuwait", CAI: "Cairo",
  LHR: "London", CDG: "Paris", JFK: "New York", LAX: "Los Angeles", SFO: "San Francisco",
  SYD: "Sydney", MEL: "Melbourne", CUN: "Cancun", JTR: "Santorini", ZNZ: "Zanzibar",
  OGG: "Maui", FCO: "Rome", BCN: "Barcelona", AMS: "Amsterdam", FRA: "Frankfurt",
  SHJ: "Sharjah", ATQ: "Amritsar", GAU: "Guwahati", IXZ: "Port Blair", GOI: "Goa",
  MAA: "Chennai", HYD: "Hyderabad", BLR: "Bangalore", AMD: "Ahmedabad", COK: "Kochi",
};

export const resolveCity = (code: string): string => {
  if (!code) return code;
  const upper = code.toUpperCase().trim();
  if (/^[A-Z]{3}$/.test(upper) && IATA_TO_CITY[upper]) return IATA_TO_CITY[upper];
  return code;
};

// ── Insight generators ──
export function cleanInsightReason(reason: string): string {
  if (!reason) return "";
  let cleaned = reason;
  cleaned = cleaned.replace(/no live (?:flight |hotel )?data (?:available|found)[.,]?\s*/gi, "Live pricing is limited. ");
  cleaned = cleaned.replace(/estimate(?:d)? based on (?:typical |average )?(?:lowest )?fares?/gi, "Based on current pricing trends");
  cleaned = cleaned.replace(/cheapest (?:priority )?chosen[.,]?\s*/gi, "Best value option selected. ");
  cleaned = cleaned.replace(/\s{2,}/g, " ").replace(/\.\s*\./g, ".").trim();
  if (cleaned.length > 0) cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned;
}

export function generateHotelInsight(hotel: any, allHotels: any[], destination: string): string {
  if (!hotel) return "Curated pick for your trip";
  const { stars, price_per_night, rating, nights } = hotel;
  const insights: string[] = [];
  if (allHotels.length > 2) {
    const prices = allHotels.map((h: any) => h.pricePerNight || h.price_per_night || 0).filter(Boolean);
    const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const pctBelow = Math.round(((avgPrice - (price_per_night || 0)) / avgPrice) * 100);
    if (price_per_night <= minPrice * 1.05) insights.push("Lowest rate found across all options");
    else if (pctBelow > 20) insights.push(`${pctBelow}% below average nightly rate in ${destination}`);
    else if (pctBelow > 5) insights.push(`Priced below average for ${destination}`);
  }
  if (stars >= 5 && rating && rating >= 8.5) insights.push("5-star luxury with exceptional guest ratings");
  else if (stars >= 5) insights.push("Premium 5-star property");
  else if (stars >= 4 && rating && rating >= 8) insights.push(`${stars}-star hotel with top guest reviews (${rating}/10)`);
  else if (stars >= 4 && price_per_night && allHotels.length > 0) {
    const fiveStarPrices = allHotels.filter((h: any) => (h.stars || 0) >= 5).map((h: any) => h.pricePerNight || 0);
    if (fiveStarPrices.length && price_per_night < fiveStarPrices[0] * 0.7) insights.push(`${stars}-star quality at a fraction of 5-star pricing`);
  }
  if (nights && nights >= 5 && price_per_night) insights.push(`Strong value for ${nights}-night stays`);
  if (!insights.length && rating) {
    if (rating >= 9) insights.push(`Rated ${rating}/10 — among the highest in ${destination}`);
    else if (rating >= 8) insights.push(`Highly rated at ${rating}/10 by recent guests`);
    else if (rating >= 7) insights.push(`Solid ${rating}/10 rating with good guest feedback`);
  }
  if (!insights.length) insights.push(`Selected as best match for your ${destination} itinerary`);
  return insights.slice(0, 2).join(" · ");
}

export function generateFlightInsight(flight: any, allFlights: any[]): string {
  if (!flight) return "Optimized for your route";
  const reason = flight.reason ? cleanInsightReason(flight.reason) : "";
  if (reason && reason.length > 20 && !reason.toLowerCase().includes("selected from") && !reason.toLowerCase().includes("live pricing")) return reason;
  const insights: string[] = [];
  const ob = flight.outbound || flight;
  if (ob.stops === 0 || ob.stops === "0") insights.push("Direct flight — no layovers");
  else if (ob.stops === 1 || ob.stops === "1") insights.push("1 stop — optimal routing");
  if (ob.duration) {
    const durH = parseInt(ob.duration);
    if (durH <= 3) insights.push("Short-haul, under 3 hours");
  }
  if (allFlights.length > 2 && ob.price) {
    const prices = allFlights.map((f: any) => f.price || f.totalPrice || 0).filter(Boolean);
    const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    if (ob.price <= Math.min(...prices) * 1.05) insights.push("Best fare available");
    else if (ob.price < avg * 0.85) insights.push("Below-average fare for this route");
  }
  if (ob.airline) insights.push(`${ob.airline} — reliable carrier`);
  return insights.length ? insights.slice(0, 2).join(" · ") : reason || "Optimized for your route and schedule";
}

// ── Booking flight builder ──
export function buildBookingFlight(sf: any, allFlights: any[], travelers: number): { flightObj: any; adults: number } | null {
  if (!sf?.outbound) return null;
  const rawMatch = allFlights.find((f: any) => {
    const segs = f.segments || f.sI || [];
    if (!segs.length) return false;
    const firstSeg = segs[0];
    const fromCode = firstSeg.da?.code || firstSeg.from || '';
    const flightNo = firstSeg.fD?.fN || firstSeg.flightNumber || '';
    return fromCode === sf.outbound.from && (
      flightNo === sf.outbound.flight_number?.replace(/^[A-Z]{2}/, '') ||
      sf.outbound.flight_number?.includes(flightNo)
    );
  });
  if (rawMatch) {
    const flightObj = {
      id: rawMatch.id || rawMatch.resultId || `ai-${Date.now()}`,
      airline: rawMatch.airline || sf.outbound.airline || '',
      from_city: rawMatch.from_city || sf.outbound.from,
      to_city: rawMatch.to_city || sf.outbound.to,
      departure: rawMatch.departure || sf.outbound.departure || '',
      arrival: rawMatch.arrival || sf.outbound.arrival || '',
      duration: rawMatch.duration || sf.outbound.duration || '',
      price: rawMatch.price || sf.price || 0,
      stops: rawMatch.stops ?? sf.outbound.stops ?? 0,
      class: rawMatch.class || sf.outbound.cabin_class || 'Economy',
      flightNumber: rawMatch.flightNumber || sf.outbound.flight_number || '',
      source: rawMatch.source || 'travelport',
      segments: rawMatch.segments || [],
      basePrice: rawMatch.basePrice,
      taxes: rawMatch.taxes,
      totalPrice: rawMatch.totalPrice,
      ...aggregateFlightFareBreakdown([rawMatch]),
    };
    return { flightObj, adults: travelers || 1 };
  }
  return { flightObj: { id: `ai-${Date.now()}`, airline: sf.outbound?.airline || '', from_city: sf.outbound?.from || '', to_city: sf.outbound?.to || '', departure: sf.outbound?.departure || '', arrival: sf.outbound?.arrival || '', duration: sf.outbound?.duration || '', price: sf.price || 0, stops: sf.outbound?.stops ?? 0, class: sf.outbound?.cabin_class || 'Economy', flightNumber: sf.outbound?.flight_number || '', source: sf._rawSource || 'ai' }, adults: travelers || 1 };
}

// ── Baggage lookup ──
export function getBaggageFromRawFlights(sf: any, allFlights: any[]): { cabin?: string; checkin?: string } | null {
  if (!allFlights?.length) return null;
  const rawId = sf?._rawId;
  const outFrom = sf?.outbound?.from || "";
  const outFn = (sf?.outbound?.flight_number || "").replace(/\s+/g, "");
  const outAirline = sf?.outbound?.airline || "";
  const match = allFlights.find((f: any) => {
    if (rawId && (f.id === rawId || f.tripjackPriceId === rawId)) return true;
    const segs = f.segments || [];
    const first = segs[0];
    const fromCode = first?.origin || first?.da?.code || first?.from || f.from_city || "";
    const flightNo = (first?.flightNumber || first?.fD?.fN || f.flightNumber || "").replace(/\s+/g, "");
    if (outFn && flightNo && (flightNo === outFn || outFn.endsWith(flightNo) || flightNo.endsWith(outFn))) return true;
    if (outFrom && fromCode === outFrom && f.airline === outAirline) return true;
    return false;
  });
  const src = match || allFlights[0];
  if (!src) return null;
  const segs = src.segments || [];
  const cabin = src.cabinBaggage || src.baggageAllowance?.cabin || segs[0]?.baggage?.cabin || "";
  const checkin = src.checkinBaggage || src.baggageAllowance?.checkin || segs[0]?.baggage?.checkin || (typeof src.baggage === "string" ? src.baggage : src.baggage?.checkin || "");
  if (!cabin && !checkin) return null;
  return { cabin: cabin || undefined, checkin: checkin || undefined };
}

// ── Hotel image helpers ──
export function normalizeHotelText(value: string | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getRoomImg(room: any): string {
  const direct = room?.featured_image || room?.featuredImage || room?.room_featured_image || room?.roomFeaturedImage || room?.hero_image_url || room?.image_url || room?.image;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const images = Array.isArray(room?.images) ? room.images : Array.isArray(room?.imgs) ? room.imgs : [];
  const firstImage = images.find((img: any) => typeof img === 'string' ? img.trim() : typeof img?.url === 'string' && img.url.trim());
  return typeof firstImage === 'string' ? firstImage : firstImage?.url || '';
}

export function getHotelImg(h: any): string {
  return h?.hero_image_url || h?.featured_image || h?.featuredImage || h?.heroImage || h?.image_url || h?.image || '';
}

export function getSelectedRoomImg(h: any, preferredRoomType?: string): string {
  const direct = h?.roomFeaturedImage || h?.room_featured_image || h?.selectedRoomImage || h?.selected_room_image;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const preferred = normalizeHotelText(preferredRoomType || h?.room_type || h?.roomType);
  const rooms = (Array.isArray(h?.availableRooms) ? h.availableRooms : []).flatMap((option: any) => {
    if (Array.isArray(option?.rooms) && option.rooms.length > 0) return option.rooms;
    return option ? [option] : [];
  });
  const matchedRoom = rooms.find((room: any) => {
    const roomName = normalizeHotelText(room?.name || room?.roomTypeName || room?.standardName);
    return preferred && roomName && (roomName === preferred || roomName.includes(preferred) || preferred.includes(roomName));
  });
  return getRoomImg(matchedRoom) || getRoomImg(rooms.find((room: any) => !!getRoomImg(room)));
}

export function getPreferredHotelCardImage(h: any, preferredRoomType?: string): string {
  return getHotelImg(h) || getSelectedRoomImg(h, preferredRoomType);
}

export function findHotelImage(hotelName: string | undefined, allHotels: any[], preferredRoomType?: string): string {
  if (!hotelName || !allHotels?.length) return '';
  const exact = allHotels.find((h: any) => h.name === hotelName);
  if (exact) return getPreferredHotelCardImage(exact, preferredRoomType);
  const norm = normalizeHotelText(hotelName);
  const fuzzy = allHotels.find((h: any) => {
    const hNorm = normalizeHotelText(h.name || '');
    return hNorm === norm || hNorm.includes(norm) || norm.includes(hNorm);
  });
  return fuzzy ? getPreferredHotelCardImage(fuzzy, preferredRoomType) : '';
}

// ── Hotel dates ──
export function getHotelDates(itinerary: any): { checkin?: string; checkout?: string } {
  const days = itinerary?.day_plans || itinerary?.itinerary;
  if (!Array.isArray(days) || days.length === 0) return {};
  return { checkin: days[0]?.date, checkout: days[days.length - 1]?.date };
}

// ── Parsing utilities ──
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
