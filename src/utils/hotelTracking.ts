import { supabase } from "@/integrations/supabase/client";

let sessionId: string | null = null;
function getSessionId() {
  if (!sessionId) {
    sessionId = sessionStorage.getItem("hotel_session_id");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("hotel_session_id", sessionId);
    }
  }
  return sessionId;
}

interface TrackParams {
  hotelId: string;
  hotelName: string;
  hotelCity: string;
  hotelStars: number;
  action: "view" | "click" | "book";
}

// Fire-and-forget tracking — insert directly into hotel_interactions table
export function trackHotelInteraction(params: TrackParams) {
  supabase.from("hotel_interactions").insert({
    hotel_id: params.hotelId,
    hotel_name: params.hotelName,
    city: params.hotelCity,
    stars: params.hotelStars,
    action: params.action,
    session_id: getSessionId(),
  }).then(() => {}); // silently fail
}
