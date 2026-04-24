/**
 * useItineraryOverrides — Calls backend for all user overrides.
 *
 * Instead of frontend mutating itinerary data locally, all changes
 * go through the `itinerary-override` edge function. Backend reshuffles
 * timing (for flight changes) and returns the updated itinerary.
 *
 * This ensures backend is the SINGLE SOURCE OF TRUTH.
 */
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Itinerary } from "@/components/trip-planner/tripTypes";

interface UseItineraryOverridesParams {
  structuredItinerary: Itinerary | null;
  setStructuredItinerary: React.Dispatch<React.SetStateAction<Itinerary | null>>;
}

export function useItineraryOverrides({
  structuredItinerary,
  setStructuredItinerary,
}: UseItineraryOverridesParams) {
  const pendingRef = useRef(false);

  const callOverride = useCallback(async (
    action: "flight_change" | "hotel_change" | "activity_swap",
    payload: any,
  ): Promise<boolean> => {
    if (!structuredItinerary || pendingRef.current) return false;
    pendingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("itinerary-override", {
        body: { action, itinerary: structuredItinerary, payload },
      });

      if (error) throw error;
      if (!data?.itinerary) throw new Error("No itinerary in response");

      setStructuredItinerary(data.itinerary);
      console.log(`[Override] ${action} applied successfully`);
      return true;
    } catch (err: any) {
      console.error(`[Override] ${action} failed:`, err.message);
      toast({
        title: "Override failed",
        description: "Could not apply the change. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      pendingRef.current = false;
    }
  }, [structuredItinerary, setStructuredItinerary]);

  /** Call when user swaps a flight leg */
  const overrideFlight = useCallback((flight: any, legType: "outbound" | "return" | "intercity") => {
    return callOverride("flight_change", { flight, legType });
  }, [callOverride]);

  /** Call when user swaps a hotel */
  const overrideHotel = useCallback((hotel: any, city?: string) => {
    return callOverride("hotel_change", { hotel, city });
  }, [callOverride]);

  /** Call when user swaps an activity in a specific day/slot */
  const overrideActivity = useCallback((dayIndex: number, activityIndex: number, newActivity: any) => {
    return callOverride("activity_swap", { dayIndex, activityIndex, newActivity });
  }, [callOverride]);

  return {
    overrideFlight,
    overrideHotel,
    overrideActivity,
    isPending: pendingRef.current,
  };
}
