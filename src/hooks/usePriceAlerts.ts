import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface PriceAlert {
  id: string;
  alert_type: string;
  route_from: string | null;
  route_to: string | null;
  travel_date: string | null;
  trip_id: string | null;
  threshold_price: number;
  current_price: number | null;
  currency: string;
  status: string;
  last_checked_at: string | null;
  triggered_at: string | null;
  created_at: string;
}

export function usePriceAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("price_alerts" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAlerts((data || []) as unknown as PriceAlert[]);
    } catch (err) {
      console.error("Failed to fetch price alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createRouteAlert = useCallback(async (params: {
    routeFrom: string;
    routeTo: string;
    travelDate?: string;
    thresholdPrice: number;
    currency: string;
  }) => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return null;
    }

    // Check if user already has an active alert
    const { data: existing } = await supabase
      .from("price_alerts" as any)
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (existing && (existing as any[]).length > 0) {
      toast({
        title: "Active alert exists",
        description: "You can only have one active price alert. Check your notifications first.",
        variant: "destructive",
      });
      return null;
    }

    const { data, error } = await supabase
      .from("price_alerts" as any)
      .insert({
        user_id: user.id,
        alert_type: "route",
        route_from: params.routeFrom,
        route_to: params.routeTo,
        travel_date: params.travelDate || null,
        threshold_price: params.thresholdPrice,
        currency: params.currency,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to create alert", description: error.message, variant: "destructive" });
      return null;
    }

    toast({ title: "Price alert set ✓", description: `We'll notify you when the price drops below ${params.currency} ${params.thresholdPrice}` });
    fetchAlerts();
    return data as unknown as PriceAlert;
  }, [user, fetchAlerts]);

  const createTripAlert = useCallback(async (params: {
    tripId: string;
    thresholdPrice: number;
    currency: string;
  }) => {
    if (!user) return null;

    const { data: existing } = await supabase
      .from("price_alerts" as any)
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (existing && (existing as any[]).length > 0) {
      toast({
        title: "Active alert exists",
        description: "You can only have one active price alert at a time.",
        variant: "destructive",
      });
      return null;
    }

    const { data, error } = await supabase
      .from("price_alerts" as any)
      .insert({
        user_id: user.id,
        alert_type: "trip",
        trip_id: params.tripId,
        threshold_price: params.thresholdPrice,
        currency: params.currency,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to create alert", description: error.message, variant: "destructive" });
      return null;
    }

    toast({ title: "Trip price alert set ✓" });
    fetchAlerts();
    return data as unknown as PriceAlert;
  }, [user, fetchAlerts]);

  const cancelAlert = useCallback(async (alertId: string) => {
    if (!user) return;
    await supabase
      .from("price_alerts" as any)
      .update({ status: "cancelled" } as any)
      .eq("id", alertId)
      .eq("user_id", user.id);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "cancelled" } : a));
    toast({ title: "Alert cancelled" });
  }, [user]);

  return { alerts, loading, fetchAlerts, createRouteAlert, createTripAlert, cancelAlert };
}
