import { supabase } from "@/integrations/supabase/client";

type TripEventType =
  | "itinerary_generated"
  | "itinerary_viewed"
  | "itinerary_edited"
  | "component_changed"
  | "booking_clicked"
  | "customize_clicked"
  | "pdf_downloaded"
  | "flight_changed"
  | "hotel_changed"
  | "trip_saved"
  | "abandoned";

/**
 * Fire-and-forget trip event tracking.
 * Inserts into trip_itinerary_events table.
 */
export function trackTripEvent(
  eventType: TripEventType,
  data?: Record<string, any>,
  jobId?: string,
) {
  const userId = undefined; // Will be null in DB (anon tracking)

  supabase
    .from("trip_itinerary_events")
    .insert({
      event_type: eventType,
      event_data: data || {},
      job_id: jobId || null,
      user_id: userId || null,
    })
    .then(() => {}); // silent fire-and-forget
}
