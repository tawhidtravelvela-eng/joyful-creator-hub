import { supabase } from "@/integrations/supabase/client";
import type { Itinerary } from "@/components/trip-planner/tripTypes";

export type ChangeSource = "ai" | "user" | "system" | "api";
export type ActionType = "create" | "update" | "reorder" | "delete" | "inject_activity" | "refine" | "day_edit";

interface TrackChangeParams {
  tripId: string;
  actionType: ActionType;
  source: ChangeSource;
  actorId?: string | null;
  beforeState?: Partial<Itinerary> | null;
  afterState?: Partial<Itinerary> | null;
  changeSummary?: string;
}

/**
 * Fire-and-forget: log an itinerary change and bump the version on saved_trips.
 */
export async function trackItineraryChange(params: TrackChangeParams) {
  try {
    // Get current version
    const { data: trip } = await supabase
      .from("saved_trips")
      .select("current_version")
      .eq("id", params.tripId)
      .single();

    const newVersion = ((trip as any)?.current_version ?? 0) + 1;

    // Compress states: strip large arrays to keep logs lean
    const leanState = (state: any) => {
      if (!state) return null;
      const { live_flights, live_hotels, live_activities, hotel_alternatives, ...rest } = state;
      return rest;
    };

    // Insert change log
    await supabase.from("itinerary_change_logs").insert({
      trip_id: params.tripId,
      version: newVersion,
      action_type: params.actionType,
      source: params.source,
      actor_id: params.actorId || null,
      before_state: leanState(params.beforeState),
      after_state: leanState(params.afterState),
      change_summary: params.changeSummary || null,
    } as any);

    // Update saved_trips version
    await supabase
      .from("saved_trips")
      .update({
        current_version: newVersion,
        last_modified_by: params.actorId || "system",
        last_modified_source: params.source,
      } as any)
      .eq("id", params.tripId);
  } catch (err) {
    console.error("[ItineraryTracker] Failed to log change:", err);
  }
}

/**
 * Fetch change history for a trip (admin or owner).
 */
export async function fetchChangeHistory(tripId: string, limit = 20) {
  const { data, error } = await supabase
    .from("itinerary_change_logs")
    .select("*")
    .eq("trip_id", tripId)
    .order("version", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[ItineraryTracker] Fetch history error:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetch errors for a trip.
 */
export async function fetchItineraryErrors(tripId: string) {
  const { data, error } = await supabase
    .from("itinerary_errors")
    .select("*")
    .eq("trip_id", tripId)
    .order("detected_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[ItineraryTracker] Fetch errors:", error);
    return [];
  }
  return data || [];
}
