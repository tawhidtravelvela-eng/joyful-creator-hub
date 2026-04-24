import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { trackItineraryChange } from "@/utils/itineraryChangeTracker";
import { validateItinerary, logValidationErrors } from "@/utils/itineraryValidator";

export interface SavedTrip {
  id: string;
  itinerary_code: string | null;
  title: string;
  destination: string | null;
  origin: string | null;
  duration_days: number | null;
  travelers: number | null;
  itinerary: any;
  live_data: any;
  messages: any;
  share_token: string | null;
  is_public: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useSavedTrips() {
  const { user } = useAuth();
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTrips = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_trips")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setSavedTrips((data as any[]) || []);
    } catch (err) {
      console.error("Failed to load saved trips:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveTrip = useCallback(async (params: {
    title: string;
    destination?: string;
    origin?: string;
    duration_days?: number;
    travelers?: number;
    itinerary: any;
    live_data?: any;
    messages?: any;
  }) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to save trips.", variant: "destructive" });
      return null;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("saved_trips")
        .insert({
          user_id: user.id,
          title: params.title || "Untitled Trip",
          destination: params.destination || null,
          origin: params.origin || null,
          duration_days: params.duration_days || null,
          travelers: params.travelers || 1,
          itinerary: params.itinerary,
          live_data: params.live_data || null,
          messages: params.messages || null,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Track creation
      const savedData = data as any;
      trackItineraryChange({
        tripId: savedData.id,
        actionType: "create",
        source: "user",
        actorId: user.id,
        afterState: params.itinerary,
        changeSummary: `Trip created: ${params.title}`,
      });

      // Validate and log any issues
      const validation = validateItinerary(params.itinerary);
      if (!validation.valid) {
        logValidationErrors(savedData.id, 1, validation.errors, "system");
      }

      toast({ title: "Trip saved ✓", description: "You can access it anytime from your dashboard." });
      setSavedTrips(prev => [savedData, ...prev]);
      return savedData as SavedTrip;
    } catch (err: any) {
      console.error("Save trip error:", err);
      toast({ title: "Save failed", description: err.message || "Please try again.", variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [user]);

  const deleteTrip = useCallback(async (tripId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("saved_trips")
        .delete()
        .eq("id", tripId)
        .eq("user_id", user.id);
      if (error) throw error;
      setSavedTrips(prev => prev.filter(t => t.id !== tripId));
      toast({ title: "Trip deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }, [user]);

  const togglePublic = useCallback(async (tripId: string, isPublic: boolean) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("saved_trips")
        .update({ is_public: isPublic } as any)
        .eq("id", tripId)
        .eq("user_id", user.id)
        .select("share_token")
        .single();
      if (error) throw error;
      setSavedTrips(prev => prev.map(t => t.id === tripId ? { ...t, is_public: isPublic } : t));
      if (isPublic && data) {
        const shareUrl = `${window.location.origin}/trip/shared/${(data as any).share_token}`;
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Share link copied!", description: shareUrl });
      } else {
        toast({ title: "Trip set to private" });
      }
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  }, [user]);

  const loadSharedTrip = useCallback(async (shareToken: string): Promise<SavedTrip | null> => {
    try {
      const { data, error } = await supabase
        .from("saved_trips")
        .select("*")
        .eq("share_token", shareToken)
        .eq("is_public", true)
        .single();
      if (error) throw error;
      return data as any as SavedTrip;
    } catch {
      return null;
    }
  }, []);

  return {
    savedTrips,
    loading,
    saving,
    fetchTrips,
    saveTrip,
    deleteTrip,
    togglePublic,
    loadSharedTrip,
  };
}
