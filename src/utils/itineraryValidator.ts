import { supabase } from "@/integrations/supabase/client";
import type { Itinerary } from "@/components/trip-planner/tripTypes";

export interface ValidationError {
  error_type: string;
  message: string;
  day?: number;
  activity_index?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate an itinerary for structural integrity before rendering.
 * Checks: arrival first, chronological order, transfer after arrival, no empty days.
 */
export function validateItinerary(itinerary: Itinerary | null): ValidationResult {
  const errors: ValidationError[] = [];

  if (!itinerary || !itinerary.days || itinerary.days.length === 0) {
    errors.push({ error_type: "empty_itinerary", message: "Itinerary has no days" });
    return { valid: false, errors };
  }

  for (let dayIdx = 0; dayIdx < itinerary.days.length; dayIdx++) {
    const day = itinerary.days[dayIdx];
    if (!day.activities || day.activities.length === 0) {
      errors.push({ error_type: "empty_day", message: `Day ${day.day} has no activities`, day: day.day });
      continue;
    }

    // Check chronological order
    let prevMinutes = -1;
    for (let actIdx = 0; actIdx < day.activities.length; actIdx++) {
      const act = day.activities[actIdx];
      if (!act.time) continue;
      const [h, m] = act.time.split(":").map(Number);
      const minutes = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
      if (minutes < prevMinutes) {
        errors.push({
          error_type: "timeline_broken",
          message: `Day ${day.day}: "${act.activity}" at ${act.time} is before previous activity`,
          day: day.day,
          activity_index: actIdx,
        });
      }
      prevMinutes = minutes;
    }

    // Day 1: check arrival flow
    if (dayIdx === 0) {
      const firstAct = day.activities[0];
      const firstActName = (firstAct?.activity || "").toLowerCase();
      const isArrival = /arrival|airport|land|check.?in|arrive/i.test(firstActName) ||
                        firstAct?.category === "transport" || firstAct?.category === "flight";
      
      // Check if any non-transport activity appears before an arrival-type activity
      if (!isArrival) {
        const arrivalIdx = day.activities.findIndex(a =>
          /arrival|airport|land|arrive/i.test(a.activity || "") || a.category === "flight"
        );
        if (arrivalIdx > 0) {
          errors.push({
            error_type: "arrival_violation",
            message: `Day 1: Activities scheduled before arrival at index ${arrivalIdx}`,
            day: 1,
            activity_index: 0,
          });
        }
      }

      // Check for transfer after arrival
      if (isArrival && day.activities.length > 1) {
        const second = day.activities[1];
        const isTransfer = /transfer|taxi|bus|train|transport|shuttle/i.test(second?.activity || "") ||
                           second?.category === "transport";
        if (!isTransfer) {
          errors.push({
            error_type: "missing_transfer",
            message: "Day 1: No transfer/transport found after arrival",
            day: 1,
            activity_index: 1,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Log validation errors to the database for tracking.
 */
export async function logValidationErrors(
  tripId: string,
  version: number | null,
  errors: ValidationError[],
  source: string = "system",
) {
  if (errors.length === 0) return;

  try {
    const rows = errors.map(e => ({
      trip_id: tripId,
      version,
      error_type: e.error_type,
      source,
      details: { message: e.message, day: e.day, activity_index: e.activity_index },
    }));

    await supabase.from("itinerary_errors").insert(rows as any);
  } catch (err) {
    console.error("[Validator] Failed to log errors:", err);
  }
}
