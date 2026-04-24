/**
 * Itinerary parsing and text sanitization utilities.
 * Extracted from TripPlanner.tsx.
 */
import type { Itinerary, Msg } from "./tripTypes";
import { isRecord, asString, asNumber, asStringArray, calcRooms, calcHotelCost } from "./tripPricingUtils";

export function normalizeItinerary(value: unknown): Itinerary | null {
  if (!isRecord(value)) return null;
  const source = isRecord(value.itinerary) ? value.itinerary : value;
  const daysSource = Array.isArray(source.days) ? source.days : Array.isArray(source.daily_plan) ? source.daily_plan : [];

  if (!daysSource.length) {
    const numDays = asNumber(source.duration_days) || asNumber(source.durationDays) || 1;
    const dest = asString(source.destination) || asString(source.destination_city) || "your destination";
    for (let d = 1; d <= numDays; d++) {
      daysSource.push({
        day: d,
        title: d === 1 ? `Arrival in ${dest}` : d === numDays ? `Departure Day` : `Day ${d} in ${dest}`,
        activities: [{ time: "09:00", activity: d === 1 ? "Check-in & settle" : d === numDays ? "Check-out & airport transfer" : `Explore ${dest}`, description: "" }],
        hotel: {},
      });
    }
    if (!daysSource.length) daysSource.push({ day: 1, title: `Day 1 in ${dest}`, activities: [], hotel: {} });
  }

  const normalizedDays: Itinerary["days"] = daysSource.map((day, index) => {
    const dayObj = isRecord(day) ? day : {};
    const hotelObj = isRecord(dayObj.hotel) ? dayObj.hotel : {};
    const activitiesSource = Array.isArray(dayObj.activities) ? dayObj.activities : [];
    return {
      day: asNumber(dayObj.day, index + 1),
      title: asString(dayObj.title, `Day ${index + 1}`),
      city: asString(dayObj.city) || undefined,
      date: asString(dayObj.date) || undefined,
      day_type: asString(dayObj.day_type) || (dayObj.is_travel_day === true ? "transition" : undefined) || undefined,
      is_travel_day: typeof dayObj.is_travel_day === "boolean" ? dayObj.is_travel_day : undefined,
      departure_city: asString(dayObj.departure_city) || undefined,
      arrival_city: asString(dayObj.arrival_city) || undefined,
      activities: activitiesSource.map((activity) => {
        const activityObj = isRecord(activity) ? activity : {};
        return {
          time: asString(activityObj.time), activity: asString(activityObj.activity), description: asString(activityObj.description),
          cost_estimate: asNumber(activityObj.cost_estimate), category: asString(activityObj.category, "activity"),
          is_free: typeof activityObj.is_free === "boolean" ? activityObj.is_free : (asNumber(activityObj.cost_estimate) === 0),
          is_bookable: typeof activityObj.is_bookable === "boolean" ? activityObj.is_bookable : undefined,
          is_live_price: typeof activityObj.is_live_price === "boolean" ? activityObj.is_live_price : undefined,
          source: asString(activityObj.source), product_code: asString(activityObj.product_code),
          product_option_code: asString(activityObj.product_option_code) || undefined,
          option_title: asString(activityObj.option_title) || asString(activityObj.product_option_title) || undefined,
          product_option_title: asString(activityObj.product_option_title) || asString(activityObj.option_title) || undefined,
          product_name: asString(activityObj.product_name) || undefined,
          search_title: asString(activityObj.search_title) || undefined,
          highlights: Array.isArray(activityObj.highlights) ? activityObj.highlights as string[] : undefined,
          places_covered: Array.isArray(activityObj.places_covered) ? activityObj.places_covered as string[] : undefined,
          pricingType: asString(activityObj.pricingType) || undefined,
          duration_hours: asNumber(activityObj.duration_hours) || undefined,
          rating: asNumber(activityObj.rating) || undefined,
          review_count: asNumber(activityObj.review_count) || undefined,
          price_confidence: asString(activityObj.price_confidence) || undefined,
          vela_id: asString(activityObj.vela_id) || undefined,
          slug: asString(activityObj.slug) || undefined,
          booking_notes: asString(activityObj.booking_notes) || undefined,
          tips: asString(activityObj.tips) || undefined,
        };
      }),
      hotel: { name: asString(hotelObj.name), area: asString(hotelObj.area), price_per_night: asNumber(hotelObj.price_per_night), stars: asNumber(hotelObj.stars), is_live_price: typeof hotelObj.is_live_price === "boolean" ? hotelObj.is_live_price : undefined },
    };
  });

  const budgetEstimate = isRecord(source.budget_estimate) ? source.budget_estimate : {};
  const budgetBreakdown = isRecord(budgetEstimate.breakdown) ? budgetEstimate.breakdown : {};
  const rawTravelers = asNumber(source.travelers, 0);
  const adults = asNumber(source.adults, 0);
  const children = asNumber(source.children, 0);
  const infants = asNumber(source.infants, 0);
  const normalizedAdults = Math.max(1, adults || (rawTravelers > 0 ? Math.max(1, rawTravelers - children - infants) : 1));
  const normalizedChildren = Math.max(0, children);
  const normalizedInfants = Math.max(0, infants);
  const rooms = calcRooms(normalizedAdults, normalizedChildren);

  const normalized: Itinerary = {
    trip_title: asString(source.trip_title) || asString(source.tripTitle) || asString(source.title) || asString(source.trip_name) || "Your Trip Plan",
    destination: asString(source.destination) || asString(source.destination_city) || asString(source.hotel_city_name),
    duration_days: asNumber(source.duration_days, normalizedDays.length || 1),
    travelers: Math.max(1, rawTravelers || normalizedAdults + normalizedChildren + normalizedInfants),
    adults: normalizedAdults, children: normalizedChildren, infants: normalizedInfants, rooms,
    budget_estimate: {
      currency: asString(budgetEstimate.currency, "USD"),
      total: asNumber(budgetEstimate.total),
      is_estimated: typeof budgetEstimate.is_estimated === "boolean" ? budgetEstimate.is_estimated : undefined,
      breakdown: { flights: asNumber(budgetBreakdown.flights) + asNumber(budgetBreakdown.inter_city_flights), hotels: asNumber(budgetBreakdown.hotels), activities: asNumber(budgetBreakdown.activities) },
    },
    selected_flight: isRecord(source.selected_flight) ? (source.selected_flight as Itinerary["selected_flight"]) : undefined,
    selected_hotel: isRecord(source.selected_hotel) ? (() => {
      const h = source.selected_hotel as any;
      const ppn = asNumber(h.price_per_night) || asNumber(h.pricePerNight) || 0;
      const n = asNumber(h.nights, 1);
      const rawTotal = asNumber(h.total_price) || asNumber(h.totalPrice) || 0;
      const total = ppn > 0 ? calcHotelCost(ppn, n, rooms) : rawTotal;
      return { ...h, price_per_night: ppn, nights: n, total_price: total } as Itinerary["selected_hotel"];
    })() : undefined,
    selected_hotels: Array.isArray(source.selected_hotels) ? (source.selected_hotels as Itinerary["selected_hotels"]) : undefined,
    hotel_alternatives: Array.isArray(source.hotel_alternatives) ? (source.hotel_alternatives as Itinerary["hotel_alternatives"]) : undefined,
    days: normalizedDays,
    included: asStringArray(source.included), excluded: asStringArray(source.excluded),
    refund_policy: asString(source.refund_policy), assumptions: asStringArray(source.assumptions),
    tips: asStringArray(source.tips), best_time_to_visit: asString(source.best_time_to_visit),
    travel_connections: Array.isArray(source.travel_connections) ? (source.travel_connections as Itinerary["travel_connections"]) : undefined,
    live_flights: Array.isArray(source.live_flights) ? (source.live_flights as Itinerary["live_flights"]) : undefined,
    live_hotels: Array.isArray(source.live_hotels) ? (source.live_hotels as Itinerary["live_hotels"]) : undefined,
    live_activities: Array.isArray(source.live_activities) ? (source.live_activities as Itinerary["live_activities"]) : undefined,
  };
  return normalized;
}

function tryParseItinerary(candidate: string): Itinerary | null {
  try { return normalizeItinerary(JSON.parse(candidate)); } catch { return null; }
}

function stripEmbeddedItineraryJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.includes("{")) return trimmed;
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const fullCandidate = trimmed.slice(firstBrace, lastBrace + 1).trim();
    if (tryParseItinerary(fullCandidate)) return `${trimmed.slice(0, firstBrace)} ${trimmed.slice(lastBrace + 1)}`.replace(/\n{3,}/g, "\n\n").trim();
  }
  const braceStarts = [...trimmed.matchAll(/\{/g)].map((m) => m.index ?? -1).filter((i) => i >= 0).slice(0, 12);
  const braceEnds = [...trimmed.matchAll(/\}/g)].map((m) => m.index ?? -1).filter((i) => i >= 0).slice(-12).reverse();
  for (const start of braceStarts) {
    for (const end of braceEnds) {
      if (end <= start) continue;
      const candidate = trimmed.slice(start, end + 1).trim();
      if (tryParseItinerary(candidate)) return `${trimmed.slice(0, start)} ${trimmed.slice(end + 1)}`.replace(/\n{3,}/g, "\n\n").trim();
    }
  }
  return trimmed;
}

function stripAllJsonBlocks(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{" || ch === "[") {
      const close = ch === "{" ? "}" : "]";
      let depth = 1, j = i + 1, inStr = false, escaped = false;
      while (j < text.length && depth > 0) {
        const c = text[j];
        if (escaped) { escaped = false; j++; continue; }
        if (c === "\\") { escaped = true; j++; continue; }
        if (c === '"') { inStr = !inStr; j++; continue; }
        if (!inStr) { if (c === ch) depth++; else if (c === close) depth--; }
        j++;
      }
      if (depth === 0) {
        const block = text.slice(i, j);
        if (block.length > 30 || /[":]/.test(block)) {
          try { JSON.parse(block); i = j; continue; } catch {}
          if (block.length > 80 && /[":,\[\]{}]/.test(block)) { i = j; continue; }
        }
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

export function parseItinerary(text: string): Itinerary | null {
  if (!text) return null;
  const trimmed = text.trim();
  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const match of fencedMatches) { const parsed = tryParseItinerary(match[1].trim()); if (parsed) return parsed; }
  const directParsed = tryParseItinerary(trimmed);
  if (directParsed) return directParsed;
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) { const parsed = tryParseItinerary(trimmed.slice(firstBrace, lastBrace + 1).trim()); if (parsed) return parsed; }
  return null;
}

export function getTextContent(text: string): string {
  const original = text.trim();
  if (!original) return "";
  if (parseItinerary(original)) return "✨ Your trip plan is ready! Check the results panel →";
  let cleaned = original.replace(/```(?:json)?\s*[\s\S]*?\s*```/gi, "").trim();
  cleaned = stripEmbeddedItineraryJson(cleaned);
  cleaned = stripAllJsonBlocks(cleaned);
  cleaned = cleaned.replace(/^\s*[{}\[\],]+\s*$/gm, "").trim();
  cleaned = cleaned.replace(/^[\s,\[\]{}]+$/gm, "").trim();
  try { const parsed = JSON.parse(cleaned); if (typeof parsed === "object" && parsed !== null) return "✨ Your trip plan is ready! Check the results panel →"; } catch {}
  cleaned = cleaned.replace(/\*{0,2}Notes?\s+on\s+calculat(?:ion|ions)\s*:?\*{0,2}\s*[\s\S]*?(?=(?:Let me know|Feel free|Would you|If you|Here'?s|I hope|Enjoy|Happy|Have a|$))/gi, "").trim();
  cleaned = cleaned.replace(/^(?:Flights?|Hotels?|Activities?|Food|Transport|Total):.*(?:BDT|USD|INR|EUR|GBP|live.?price|estimated|converted|rounded).*$/gim, "").trim();
  cleaned = cleaned.replace(/^\s*"[a-z_]+":\s*.*/gim, "").trim();
  cleaned = cleaned.replace(/^\s*"[a-z_]{2,30}"?\s*$/gm, "").trim();
  cleaned = cleaned.replace(/^\s*"[^"\n]{2,80}"\s*[,:\]]?\s*$/gm, "").trim();
  cleaned = cleaned.replace(/^\s*[":,]+\s*$/gm, "").trim();
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  cleaned = cleaned.replace(/^\s*[,\[\]{}]\s*$/gm, "").replace(/\n{2,}/g, "\n\n").trim();
  cleaned = cleaned.replace(/^\s*"{1,3}\s*$/gm, "").replace(/\n{2,}/g, "\n\n").trim();
  if (!cleaned) return "✨ Your trip plan is ready! Check the results panel →";
  return cleaned;
}

// ── Message sanitization ──
export function sanitizeRetryContent(content: string) {
  return content.startsWith("__retry__") ? content.slice(9) : content;
}

export function isTransientAssistantStatusMessage(content: string) {
  const normalized = getTextContent(content).trim();
  return [
    /having trouble fetching results right now/i,
    /^hmm, let me try that again/i,
    /i have everything i need! searching for the best options now/i,
    /i'?m now searching for the best travel options for you/i,
  ].some((pattern) => pattern.test(normalized));
}

export function sanitizeMessages(msgs: Msg[]): Msg[] {
  return msgs.reduce<Msg[]>((acc, msg) => {
    const baseContent = sanitizeRetryContent(msg.content);
    if (msg.role === "assistant" && isTransientAssistantStatusMessage(baseContent)) return acc;
    acc.push(msg.role === "user" ? { ...msg, content: baseContent } : { ...msg, content: getTextContent(baseContent) });
    return acc;
  }, []);
}
