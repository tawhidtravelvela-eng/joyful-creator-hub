/**
 * itinerary-override — Backend endpoint for user overrides.
 *
 * When a user swaps a flight, hotel, or activity, the frontend calls
 * this endpoint instead of mutating locally. The backend:
 *   1. Validates the override
 *   2. For flight changes: reshuffles activity timing on affected days
 *   3. For hotel changes: updates hotel data, no timing changes
 *   4. For activity changes: swaps the activity in the correct slot
 *   5. Returns the updated itinerary to the frontend
 *
 * This ensures backend is the single source of truth.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OverrideRequest {
  action: "flight_change" | "hotel_change" | "activity_swap";
  /** The current itinerary (days, selected_flight, selected_hotels, etc.) */
  itinerary: any;
  /** Override-specific payload */
  payload: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: OverrideRequest = await req.json();
    const { action, itinerary, payload } = body;

    if (!itinerary || !action) {
      return new Response(JSON.stringify({ error: "Missing itinerary or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatedItinerary: any;

    switch (action) {
      case "flight_change":
        updatedItinerary = handleFlightChange(itinerary, payload);
        break;
      case "hotel_change":
        updatedItinerary = handleHotelChange(itinerary, payload);
        break;
      case "activity_swap":
        updatedItinerary = handleActivitySwap(itinerary, payload);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ itinerary: updatedItinerary, action, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[itinerary-override] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// FLIGHT CHANGE — Reshuffle activity timing on affected days
// ═══════════════════════════════════════════════════════════════

function handleFlightChange(itinerary: any, payload: any): any {
  const { flight, legType } = payload;
  // legType: "outbound" | "return" | "intercity"
  // flight: the new flight object with segments, departure, arrival times

  const result = JSON.parse(JSON.stringify(itinerary));
  const days = result.days || [];
  if (days.length === 0) return result;

  const fmtMin = (m: number) =>
    `${String(Math.min(Math.floor(m / 60), 23)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  const parseTime = (t: string): number | null => {
    if (!t) return null;
    // Handle "HH:MM" or ISO datetime
    const timeStr = t.includes("T") ? t.split("T")[1]?.slice(0, 5) : t.slice(0, 5);
    if (!timeStr || !timeStr.includes(":")) return null;
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  if (legType === "outbound" || legType === "arrival") {
    // Arrival day — reshuffle Day 1 activities after arrival + settle time
    const arrivalTime = parseTime(
      flight.arrival || flight.segments?.[flight.segments.length - 1]?.arrival || ""
    );
    if (arrivalTime !== null && days[0]) {
      const settleMinutes = arrivalTime + 90; // 90min settle buffer
      let nextSlot = settleMinutes;

      days[0].activities = days[0].activities.map((act: any) => {
        if (!act.time) return act;
        const label = (act.activity || "").toLowerCase();
        // Keep "arrive" activities as-is
        if (label.includes("arrive") && (label.includes("in ") || label.includes("at "))) {
          return act;
        }
        const actMin = parseTime(act.time);
        if (actMin !== null && actMin < settleMinutes) {
          if (label.includes("check-in") || label.includes("check in") || label.includes("settle") || label.includes("refresh")) {
            return { ...act, time: fmtMin(settleMinutes) };
          }
          nextSlot = Math.max(nextSlot, settleMinutes + 30);
          const newTime = fmtMin(nextSlot);
          nextSlot += 90; // 90min gap between activities
          return { ...act, time: newTime };
        }
        return act;
      });
      days[0].activities.sort((a: any, b: any) =>
        (a.time || "99:99").localeCompare(b.time || "99:99")
      );
    }
  }

  if (legType === "return" || legType === "departure") {
    // Departure day — remove activities after cutoff (departure - 3h)
    const lastIdx = days.length - 1;
    const depTime = parseTime(
      flight.departure || flight.segments?.[0]?.departure || ""
    );
    if (depTime !== null && lastIdx >= 0) {
      const cutoffMinutes = Math.max(depTime - 180, 0); // 3h before departure
      const cutoffTime = fmtMin(cutoffMinutes);

      // Update airport/departure transfer time
      const airportActIdx = days[lastIdx].activities.findIndex((a: any) => {
        const l = (a.activity || "").toLowerCase();
        return l.includes("airport") || l.includes("depart") || l.includes("transfer") || l.includes("check-out") || l.includes("checkout");
      });
      if (airportActIdx >= 0) {
        days[lastIdx].activities[airportActIdx] = {
          ...days[lastIdx].activities[airportActIdx],
          time: cutoffTime,
        };
      }

      // Remove activities that fall after the cutoff
      days[lastIdx].activities = days[lastIdx].activities.filter((act: any) => {
        if (!act.time) return true;
        const l = (act.activity || "").toLowerCase();
        if (l.includes("airport") || l.includes("depart") || l.includes("transfer")) return true;
        const actMin = parseTime(act.time);
        return actMin === null || actMin <= cutoffMinutes;
      });
      days[lastIdx].activities.sort((a: any, b: any) =>
        (a.time || "99:99").localeCompare(b.time || "99:99")
      );
    }
  }

  if (legType === "intercity") {
    // Inter-city transition — find the arrival day and reshuffle
    const destCity = (flight.to || flight.to_city || "").toLowerCase();
    const arrivalTime = parseTime(
      flight.arrival || flight.segments?.[flight.segments.length - 1]?.arrival || ""
    );
    if (arrivalTime !== null && destCity) {
      const settleMinutes = arrivalTime + 90;

      for (let di = 0; di < days.length; di++) {
        const dc = (days[di].city || "").toLowerCase();
        const hasArrival = (days[di].activities || []).some((a: any) => {
          const l = (a.activity || "").toLowerCase();
          return l.includes("arrive") && l.includes(destCity.split(" ")[0] || "___");
        });
        const cityMatch = dc && destCity.includes(dc.split(",")[0]);

        if (hasArrival || cityMatch) {
          let nextSlot = settleMinutes + 60;
          days[di].activities = days[di].activities.map((act: any) => {
            if (!act.time) return act;
            const label = (act.activity || "").toLowerCase();
            if (label.includes("arrive")) return act;
            const actMin = parseTime(act.time);
            if (actMin !== null && actMin < settleMinutes) {
              if (label.includes("check-in") || label.includes("check in") || label.includes("hotel")) {
                return { ...act, time: fmtMin(settleMinutes + 30) };
              }
              if (label.includes("transfer") || label.includes("airport") || label.includes("depart")) {
                return act;
              }
              const newTime = fmtMin(nextSlot);
              nextSlot += 90;
              return { ...act, time: newTime };
            }
            return act;
          });
          days[di].activities.sort((a: any, b: any) =>
            (a.time || "99:99").localeCompare(b.time || "99:99")
          );
          break; // Only process the first matching day
        }
      }
    }
  }

  result.days = days;
  // Recalculate budget with new flight
  result.budget_estimate = recalcBudget(result);

  console.log(`[itinerary-override] Flight change (${legType}) — reshuffled affected days`);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// HOTEL CHANGE — Update hotel data, no timing changes needed
// ═══════════════════════════════════════════════════════════════

function handleHotelChange(itinerary: any, payload: any): any {
  const { hotel, city } = payload;
  const result = JSON.parse(JSON.stringify(itinerary));

  if (city && result.selected_hotels?.length) {
    // Multi-city: update the specific city's hotel
    result.selected_hotels = result.selected_hotels.map((sh: any) => {
      if ((sh.city || "").toLowerCase() !== city.toLowerCase()) return sh;
      const perNight = hotel.pricePerNight || hotel.price_per_night || 0;
      return {
        ...sh,
        name: hotel.name,
        stars: hotel.stars || sh.stars,
        price_per_night: perNight,
        total_price: Math.round(perNight * (sh.nights || 1)),
        meal_basis: hotel.mealBasis || hotel.meal_basis || sh.meal_basis || "",
        room_type: hotel.roomType || hotel.room_type || sh.room_type || "",
        reason: "",
        is_live_price: true,
      };
    });
    // Sync first hotel to selected_hotel
    if (result.selected_hotels[0] && result.selected_hotel) {
      result.selected_hotel = { ...result.selected_hotel, ...result.selected_hotels[0] };
    }
  } else if (result.selected_hotel) {
    // Single hotel
    const perNight = hotel.pricePerNight || hotel.price_per_night || 0;
    const nights = result.selected_hotel.nights || 1;
    result.selected_hotel = {
      ...result.selected_hotel,
      name: hotel.name,
      stars: hotel.stars || result.selected_hotel.stars || 3,
      price_per_night: perNight,
      total_price: Math.round(perNight * nights),
      nights,
      meal_basis: hotel.mealBasis || hotel.meal_basis || result.selected_hotel.meal_basis || "",
      room_type: hotel.roomType || hotel.room_type || result.selected_hotel.room_type || "",
      reason: "",
      is_live_price: true,
    };
  }

  result.budget_estimate = recalcBudget(result);
  console.log(`[itinerary-override] Hotel change — ${hotel.name} in ${city || "single"}`);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY SWAP — Replace specific activity in a day slot
// ═══════════════════════════════════════════════════════════════

function handleActivitySwap(itinerary: any, payload: any): any {
  const { dayIndex, activityIndex, newActivity } = payload;
  const result = JSON.parse(JSON.stringify(itinerary));

  if (!result.days || !result.days[dayIndex]) {
    console.warn(`[itinerary-override] Invalid dayIndex: ${dayIndex}`);
    return result;
  }

  const day = result.days[dayIndex];
  if (!day.activities || !day.activities[activityIndex]) {
    console.warn(`[itinerary-override] Invalid activityIndex: ${activityIndex} on day ${dayIndex}`);
    return result;
  }

  const existingAct = day.activities[activityIndex];

  // Replace with new activity, preserving time slot
  day.activities[activityIndex] = {
    ...existingAct,
    activity: newActivity.name || newActivity.activity,
    product_name: newActivity.product_name || newActivity.name,
    option_title: newActivity.option_title || "",
    description: newActivity.duration
      ? `${newActivity.duration} · ${newActivity.category || "Tour"}`
      : (newActivity.description || existingAct.description),
    cost_estimate: newActivity.price || 0,
    is_live_price: true,
    source: newActivity.source || "travelvela",
    product_code: newActivity.productCode || newActivity.product_code || "",
    highlights: newActivity.highlights || [],
    places_covered: newActivity.places_covered || [],
    pricingType: newActivity.pricingType || "PER_PERSON",
    category: newActivity.category || "activity",
    duration_hours: newActivity.duration_hours || newActivity._durationHours || existingAct.duration_hours,
    vela_id: newActivity.velaId || newActivity.vela_id || existingAct.vela_id,
    slug: newActivity.slug || existingAct.slug,
  };

  result.budget_estimate = recalcBudget(result);
  console.log(`[itinerary-override] Activity swap — Day ${dayIndex + 1}, slot ${activityIndex}: "${newActivity.name}"`);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// BUDGET RECALCULATION — Simple arithmetic on itinerary data
// ═══════════════════════════════════════════════════════════════

function recalcBudget(itinerary: any): any {
  if (!itinerary.budget_estimate) return itinerary.budget_estimate;

  const a = itinerary.adults || itinerary.travelers || 1;
  const c = itinerary.children || 0;

  // Flights
  const flightCost = itinerary.selected_flight?.price
    ? itinerary.selected_flight.price * a + (c > 0 ? itinerary.selected_flight.price * 0.75 * c : 0)
    : (itinerary.budget_estimate.breakdown?.flights || 0);

  // Hotels
  let hotelCost = 0;
  if (itinerary.selected_hotels?.length) {
    hotelCost = itinerary.selected_hotels.reduce(
      (sum: number, h: any) => sum + (h.price_per_night || 0) * (h.nights || 1), 0,
    );
  } else if (itinerary.selected_hotel) {
    hotelCost = (itinerary.selected_hotel.price_per_night || 0) * (itinerary.selected_hotel.nights || 1);
  } else {
    hotelCost = itinerary.budget_estimate.breakdown?.hotels || 0;
  }

  // Activities
  let activityCost = 0;
  if (itinerary.days) {
    for (const day of itinerary.days) {
      for (const act of (day.activities || [])) {
        const cat = (act.category || "").toLowerCase();
        if (cat === "flight" || cat === "hotel" || cat === "transport" || cat === "logistics") continue;
        const unitPrice = act.cost_estimate || 0;
        if (unitPrice <= 0) continue;
        const isPerGroup = (act.pricingType || "PER_PERSON") === "PER_GROUP";
        activityCost += isPerGroup ? unitPrice : unitPrice * a + (c > 0 ? unitPrice * 0.75 * c : 0);
      }
    }
  }
  if (activityCost === 0) activityCost = itinerary.budget_estimate.breakdown?.activities || 0;

  const breakdown = {
    ...itinerary.budget_estimate.breakdown,
    flights: Math.round(flightCost),
    hotels: Math.round(hotelCost),
    activities: Math.round(activityCost),
  };

  const total = Object.values(breakdown).reduce(
    (sum: number, v: any) => sum + (typeof v === "number" ? v : 0), 0,
  );

  return {
    ...itinerary.budget_estimate,
    total: Math.max(0, Math.round(total)),
    breakdown,
  };
}
