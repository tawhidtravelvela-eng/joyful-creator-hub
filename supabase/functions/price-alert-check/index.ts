import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active alerts that haven't been checked in 24 hours (or never)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: alerts, error: alertErr } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("status", "active")
      .or(`last_checked_at.is.null,last_checked_at.lt.${twentyFourHoursAgo}`)
      .limit(50);

    if (alertErr) throw alertErr;
    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ checked: 0, triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group route alerts by unique route to minimize API calls
    const routeAlerts = alerts.filter((a: any) => a.alert_type === "route" && a.route_from && a.route_to);
    const tripAlerts = alerts.filter((a: any) => a.alert_type === "trip" && a.trip_id);

    const uniqueRoutes = new Map<string, any[]>();
    for (const alert of routeAlerts) {
      const key = `${alert.route_from}-${alert.route_to}-${alert.travel_date || "any"}`;
      if (!uniqueRoutes.has(key)) uniqueRoutes.set(key, []);
      uniqueRoutes.get(key)!.push(alert);
    }

    let triggered = 0;

    // Check route prices — one API call per unique route
    for (const [, alertGroup] of uniqueRoutes) {
      const sample = alertGroup[0];
      try {
        // Check cache first
        const { data: cached } = await supabase
          .from("flight_price_cache")
          .select("lowest_price, currency")
          .eq("from_code", sample.route_from)
          .eq("to_code", sample.route_to)
          .gte("expires_at", new Date().toISOString())
          .order("cached_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let currentPrice = cached?.lowest_price;
        const priceCurrency = cached?.currency || "USD";

        // If no cache, skip — don't make expensive API calls in cron
        // Price will be checked next time cache is populated by a real search
        if (currentPrice == null) {
          // Just mark as checked
          const ids = alertGroup.map((a: any) => a.id);
          await supabase
            .from("price_alerts")
            .update({ last_checked_at: new Date().toISOString() })
            .in("id", ids);
          continue;
        }

        for (const alert of alertGroup) {
          // Update current price and last checked
          await supabase
            .from("price_alerts")
            .update({
              current_price: currentPrice,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", alert.id);

          // Check if price dropped below threshold
          if (currentPrice <= alert.threshold_price) {
            // Trigger alert — mark as triggered (one-shot)
            await supabase
              .from("price_alerts")
              .update({
                status: "triggered",
                triggered_at: new Date().toISOString(),
              })
              .eq("id", alert.id);

            // Create in-app notification
            await supabase.from("notifications").insert({
              user_id: alert.user_id,
              title: "🔔 Price Drop Alert!",
              message: `${alert.route_from} → ${alert.route_to} dropped to ${priceCurrency} ${currentPrice} (your target: ${alert.currency} ${alert.threshold_price})`,
              type: "price_alert",
              link: `/flights?from=${alert.route_from}&to=${alert.route_to}`,
            });

            triggered++;
          }
        }
      } catch (err) {
        console.error(`Price check failed for route:`, err);
      }
    }

    // Check trip alerts — compare saved trip budget
    for (const alert of tripAlerts) {
      try {
        const { data: trip } = await supabase
          .from("saved_trips")
          .select("itinerary, live_data")
          .eq("id", alert.trip_id)
          .single();

        if (!trip) {
          await supabase.from("price_alerts").update({ status: "expired" }).eq("id", alert.id);
          continue;
        }

        // Extract total cost from itinerary
        const itinerary = trip.itinerary as any;
        const totalCost = itinerary?.budget?.total || itinerary?.estimated_budget?.total || 0;

        await supabase
          .from("price_alerts")
          .update({
            current_price: totalCost,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", alert.id);

        if (totalCost > 0 && totalCost <= alert.threshold_price) {
          await supabase
            .from("price_alerts")
            .update({ status: "triggered", triggered_at: new Date().toISOString() })
            .eq("id", alert.id);

          await supabase.from("notifications").insert({
            user_id: alert.user_id,
            title: "🔔 Trip Price Alert!",
            message: `Your trip budget dropped to ${alert.currency} ${totalCost} (target: ${alert.currency} ${alert.threshold_price})`,
            type: "price_alert",
            link: "/dashboard",
          });

          triggered++;
        }
      } catch (err) {
        console.error("Trip price check failed:", err);
      }
    }

    return new Response(
      JSON.stringify({ checked: alerts.length, triggered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Price alert check error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
