import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Tripjack Hotel Sync Cron Handler
 * 
 * Called by pg_cron every 5 minutes. Logic:
 * 1. Check tripjack_sync_state for current status
 * 2. If status = "syncing" or "paused" → continue batch sync (initial load)
 * 3. If status = "completed" → check if it's been > 7 days since last sync
 *    → if yes, trigger incremental sync with lastUpdateTime
 *    → if no, skip (already up to date)
 * 4. If no state exists → start fresh initial sync
 * 
 * This means:
 * - During initial load: cron fires every 5 min, each run fetches ~1000 hotels (10 pages)
 * - After completion: cron fires every 5 min but only actually syncs once per week (incremental)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Check current sync state
    const { data: syncState } = await sb
      .from("tripjack_sync_state")
      .select("*")
      .eq("sync_type", "hotels")
      .maybeSingle();

    const now = new Date();
    let action: "continue" | "incremental" | "start" | "skip" = "skip";
    let body: Record<string, any> = { action: "sync-hotels", maxPages: 10 };

    if (!syncState) {
      // No state → first ever sync
      action = "start";
      console.log("[cron] No sync state found — starting initial sync");
    } else if (syncState.status === "syncing" || syncState.status === "paused") {
      // In progress → continue
      action = "continue";
      console.log(`[cron] Sync in progress (status=${syncState.status}, hotels=${syncState.total_hotels_synced}, cursor=${syncState.next_cursor?.substring(0, 20)})`);
    } else if (syncState.status === "completed") {
      // Check when last completed
      const completedAt = syncState.completed_at ? new Date(syncState.completed_at) : null;
      const daysSinceSync = completedAt
        ? (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      if (daysSinceSync >= 7) {
        action = "incremental";
        // Use completed_at as the lastUpdateTime for delta sync
        const lastUpdateTime = completedAt?.toISOString().split("T")[0] || 
          new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
        body.lastUpdateTime = lastUpdateTime;
        console.log(`[cron] Weekly incremental sync (last completed ${daysSinceSync.toFixed(1)} days ago, lastUpdateTime=${lastUpdateTime})`);
      } else {
        action = "skip";
        console.log(`[cron] Sync completed ${daysSinceSync.toFixed(1)} days ago — skipping (next in ${(7 - daysSinceSync).toFixed(1)} days)`);
      }
    } else {
      // Unknown state → start fresh
      action = "start";
      console.log(`[cron] Unknown sync status "${syncState.status}" — starting fresh`);
    }

    if (action === "skip") {
      return new Response(JSON.stringify({ 
        success: true, action: "skipped",
        message: "Sync is up to date",
        nextSyncIn: syncState?.completed_at 
          ? `${Math.max(0, 7 - ((now.getTime() - new Date(syncState.completed_at).getTime()) / 86400000)).toFixed(1)} days`
          : "unknown"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Call the sync endpoint
    console.log(`[cron] Triggering sync (action=${action})`);
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/unified-hotel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
    });

    const result = await syncResponse.json();
    console.log(`[cron] Sync response: complete=${result.complete}, hotels=${result.totalHotelsProcessed || result.totalSynced}, alreadyComplete=${result.alreadyComplete}`);

    // After incremental sync completes, also fetch deleted hotels
    let deletedResult: any = null;
    if (action === "incremental" && result.complete) {
      console.log(`[cron] Running sync-deleted with lastUpdateTime=${body.lastUpdateTime}`);
      try {
        const delResponse = await fetch(`${supabaseUrl}/functions/v1/unified-hotel-search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
            "apikey": anonKey,
          },
          body: JSON.stringify({ action: "sync-deleted", lastUpdateTime: body.lastUpdateTime }),
        });
        deletedResult = await delResponse.json();
        console.log(`[cron] Deleted sync: ${deletedResult.totalDeleted || 0} hotels removed`);
      } catch (e) {
        console.error(`[cron] sync-deleted failed:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      syncResult: {
        complete: result.complete,
        totalHotels: result.totalHotelsProcessed || result.totalSynced || 0,
        pages: result.pages,
        alreadyComplete: result.alreadyComplete,
        hasMore: !!result.nextCursor,
      },
      ...(deletedResult ? { deletedSync: { totalDeleted: deletedResult.totalDeleted || 0 } } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[cron] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
