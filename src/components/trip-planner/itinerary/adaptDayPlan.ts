/**
 * Converts legacy DayPlan activities into the premium DayCardData format.
 */
import type { DayPlan } from "../types";
import type { DayCardData, TimelineItemData } from "./types";

// Heuristic to detect item type from activity text/category
function inferType(act: any): TimelineItemData["type"] {
  const name = (act.activity || "").toLowerCase();
  const cat = (act.category || "").toLowerCase();

  if (cat === "transport" || /airport.*transfer|hotel.*transfer|transfer.*hotel|sedan|suv/i.test(name)) return "transfer";
  if (cat === "hotel" || /check.?in|hotel.*refresh|check.?out|rest/i.test(name)) return "hotel";
  if (/arrive|arrival|flight|depart/i.test(name) || cat === "flight") return "flight";
  if (/free.*exploration|free.*time|leisure|wander|stroll|explore.*own/i.test(name)) return "free";
  if (/meal|lunch|dinner|breakfast|dining/i.test(name) || cat === "food") return "meal";
  if (/buffer|break|rest.*buffer|recovery/i.test(name)) return "buffer";
  return "activity";
}

function inferRecommendationBadge(act: any): TimelineItemData["recommendationBadge"] | undefined {
  if (act.is_live_price && act.cost_estimate > 0) return "recommended";
  if (act.source === "free") return undefined;
  return undefined;
}

function inferReasoning(act: any, type: string): string | undefined {
  const name = (act.activity || "").toLowerCase();
  if (type === "hotel") return act.description || undefined;
  if (type === "buffer") return "Recovery buffer to keep a comfortable pace.";
  if (type === "transfer") return act.description || undefined;
  if (type === "flight") return act.description || undefined;
  if (type === "free") return "Free cultural stop — enjoy at your own pace.";
  // For activities, use description as reasoning if short enough
  if (act.description && act.description.length < 120) return act.description;
  return undefined;
}

function inferTags(act: any): string[] {
  const tags: string[] = [];
  const name = (act.activity || "").toLowerCase();
  const desc = (act.description || "").toLowerCase();
  const combined = name + " " + desc;

  if (/skyline|observation|view|sky/i.test(combined)) tags.push("Skyline");
  if (/garden|nature|park|botanical/i.test(combined)) tags.push("Nature");
  if (/adventure|zip|climb|dive/i.test(combined)) tags.push("Adventure");
  if (/family|kids|child/i.test(combined)) tags.push("Family-friendly");
  if (/culture|heritage|museum|temple|mosque|church/i.test(combined)) tags.push("Culture");
  if (/walk|stroll/i.test(combined)) tags.push("Walking");
  if (/sunset/i.test(combined)) tags.push("Sunset Spot");
  if (/indoor|aquarium|mall/i.test(combined)) tags.push("Indoor");
  if (/rain/i.test(combined)) tags.push("Rain-safe");

  return tags.slice(0, 4);
}

function parseFlightDetails(name: string): { airline?: string; flightNumber?: string; durationMinutes?: number } {
  const fnMatch = name.match(/([A-Z]{2}\d{2,4})/);
  const durMatch = name.match(/(\d+)h\s*(\d+)?m/);
  return {
    flightNumber: fnMatch?.[1],
    durationMinutes: durMatch ? parseInt(durMatch[1]) * 60 + parseInt(durMatch[2] || "0") : undefined,
  };
}

function parseTransferType(name: string): string | undefined {
  if (/sedan/i.test(name)) return "Sedan";
  if (/suv/i.test(name)) return "SUV";
  if (/van/i.test(name)) return "Van";
  if (/bus/i.test(name)) return "Bus";
  if (/taxi|cab/i.test(name)) return "Taxi";
  return undefined;
}

export function adaptDayPlanToCardData(day: DayPlan, formatPrice?: (n: number) => string): DayCardData {
  let totalPrice = 0;
  let bookable = 0;
  let activityCount = 0;

  const items: TimelineItemData[] = day.activities.map((act: any, idx) => {
    const type = inferType(act);
    const isBookable = !!(act.product_code && act.cost_estimate > 0);
    const isFree = act.source === "free" || (!act.cost_estimate || act.cost_estimate === 0);

    if (type === "activity" || type === "free") activityCount++;
    if (isBookable) { bookable++; totalPrice += act.cost_estimate || 0; }
    if (type === "transfer" && act.cost_estimate > 0) totalPrice += act.cost_estimate;

    const flightInfo = type === "flight" ? parseFlightDetails(act.activity || "") : {};

    // Duration: prefer durationMinutes, then compute from duration_hours
    const durationMinutes = act.durationMinutes
      || (act.duration_hours ? Math.round(Number(act.duration_hours) * 60) : undefined);

    // Inclusions from product data
    const includes = Array.isArray(act.inclusions) ? act.inclusions.slice(0, 5)
      : Array.isArray(act.includes) ? act.includes.slice(0, 5)
      : undefined;

    // AI match score from decision engine
    const aiMatchScore = act._matchScore ? Math.round(Number(act._matchScore)) : undefined;

    // Location area / zone
    const locationArea = act._zone || act.locationArea || undefined;

    return {
      id: `${day.day}-${idx}`,
      type,
      title: act.activity || "",
      subtitle: type === "hotel" ? (act.description || "Refresh and rest before activities") : undefined,
      startTime: act.time || undefined,
      durationMinutes,
      locationArea,
      price: act.cost_estimate > 0 ? act.cost_estimate : undefined,
      isBookable,
      source: act.source,
      productCode: act.product_code,
      productName: act.product_name,
      productOptionCode: act.product_option_code,
      optionTitle: act.option_title,
      velaId: act.vela_id,
      slug: act.slug,
      highlights: act.highlights,
      placesCovered: Array.isArray(act.places_covered) ? act.places_covered : undefined,
      includes,
      city: act.city || day.city,
      category: act.category,
      aiMatchScore,
      recommendationBadge: inferRecommendationBadge(act),
      reasoning: inferReasoning(act, type),
      tags: type === "activity" ? inferTags(act) : undefined,
      statusBadge: isBookable ? "bookable_confirmed" : isFree ? "free" : "suggested",

      // Flight-specific
      ...flightInfo,
      airline: type === "flight" ? (act.airline || flightInfo.flightNumber?.slice(0, 2)) : undefined,

      // Transfer-specific
      vehicleType: type === "transfer" ? parseTransferType(act.activity || "") : undefined,
    } satisfies TimelineItemData;
  });

  // Detect day type from backend day_type field
  const backendDayType = (day.day_type || "").toLowerCase();

  const isTransitionDay = backendDayType === "transition" ||
    (items.some(i => i.type === "flight") && items.some(i => /arrive/i.test(i.title)) && items.some(i => /checkout|check.out/i.test(i.title)));
  const isArrivalDay = backendDayType === "arrival";
  const isDepartureDay = backendDayType === "departure";

  // Extract departure and arrival cities for transition days
  // Prefer backend-provided metadata, fallback to heuristic extraction from activities
  let departureCity: string | undefined = (day as any).departure_city;
  let arrivalCity: string | undefined = (day as any).arrival_city;

  if (isTransitionDay && (!departureCity || !arrivalCity)) {
    const checkoutItem = items.find(i => /checkout|check.out/i.test(i.title));
    const checkinItem = items.find(i => /check.?in/i.test(i.title) && i.type === "hotel");
    const flightItem = items.find(i => i.type === "flight");

    const extractCity = (item: TimelineItemData | undefined): string | undefined => {
      if (!item) return undefined;
      const parenMatch = item.title.match(/\(([^)]+)\)/);
      if (parenMatch) return parenMatch[1];
      return item.city || undefined;
    };

    if (!departureCity) {
      departureCity = extractCity(checkoutItem);
      if (!departureCity && flightItem) {
        const fromMatch = flightItem.title.match(/from\s+(\w[\w\s]*?)(?:\s+to\s|$)/i);
        if (fromMatch) departureCity = fromMatch[1].trim();
      }
    }
    if (!arrivalCity) {
      arrivalCity = extractCity(checkinItem)
        || (flightItem?.title.match(/to\s+(\w[\w\s]*?)(?:\s*[-–(]|$)/i)?.[1]?.trim())
        || day.city;
    }
  }

  // Generate smart notes
  const smartNotes: string[] = [];
  const activityTypes = items.filter(i => i.type === "activity");
  if (isTransitionDay) {
    smartNotes.push("Transition day — travel between cities with light activities after arrival.");
  } else if (isArrivalDay) {
    smartNotes.push("Arrival day — settle in and enjoy light activities.");
  } else if (isDepartureDay) {
    smartNotes.push("Departure day — last-minute exploration before heading to the airport.");
  } else if (activityTypes.length <= 3) {
    smartNotes.push("This day has a relaxed pace — no rushing.");
  }
  if (items.some(i => i.type === "flight") && !isTransitionDay) smartNotes.push("Travel day — activities adjusted around flight schedule.");
  const areas = items.map(i => i.locationArea).filter(Boolean);
  const uniqueAreas = [...new Set(areas)];
  if (uniqueAreas.length === 1) smartNotes.push(`Activities are grouped in ${uniqueAreas[0]} to avoid backtracking.`);

  // Infer summary
  const hasArrival = items.some(i => i.type === "flight" && /arrive|arrival/i.test(i.title));
  const hasDeparture = items.some(i => i.type === "flight" && /depart/i.test(i.title));
  let summary = day.title || "";
  if (isTransitionDay) {
    const fromLabel = departureCity || "previous city";
    const toLabel = arrivalCity || day.city || "the next destination";
    summary = `Travel from ${fromLabel} to ${toLabel} — settling in and light exploration.`;
  } else if (isArrivalDay || (hasArrival && activityTypes.length <= 2)) {
    summary = "Relaxed arrival day with light activities after settling in.";
  } else if (isDepartureDay || hasDeparture) {
    summary = "Departure day — enjoy nearby spots before heading to the airport.";
  } else if (activityTypes.length >= 4) {
    summary = "Action-packed day with back-to-back experiences.";
  } else if (activityTypes.length <= 2) {
    summary = "Easy-going day with plenty of time to explore at your pace.";
  }

  // Pace label — use backend day_type first, fallback to heuristics
  const paceLabel = backendDayType === "arrival" ? "✈ Arrival"
    : backendDayType === "departure" ? "✈ Departure"
    : isTransitionDay ? "🔄 Travel"
    : backendDayType === "full" ? "📅 Full Day"
    : activityTypes.length >= 4 ? "Active"
    : activityTypes.length <= 2 ? "Relaxed"
    : "Balanced";

  return {
    dayNumber: day.day,
    title: day.title,
    city: day.city,
    departureCity: isTransitionDay ? departureCity : undefined,
    arrivalCity: isTransitionDay ? arrivalCity : undefined,
    date: day.date,
    dayType: backendDayType || undefined,
    summary,
    totalPrice: totalPrice > 0 ? totalPrice : undefined,
    bookableCount: bookable,
    totalCount: activityCount,
    paceLabel,
    smartNotes: smartNotes.length > 0 ? smartNotes : undefined,
    items,
  };
}
