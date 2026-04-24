import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Play, RotateCcw, Pause } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hydrateHotelDataFromWire } from "@/lib/hotelWireAdapter";

interface SyncState {
  status: string;
  next_cursor: string | null;
  total_hotels_synced: number;
  total_cities_synced: number;
  pages_processed: number;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
}

const TripjackSyncCard = () => {
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const autoSyncRef = useRef(false);

  const fetchSyncStatus = async () => {
    try {
      const { data } = await supabase.functions.invoke("unified-hotel-search", {
        body: { action: "sync-status" },
      });
      if (data) hydrateHotelDataFromWire(data);
      if (data?.success) setSyncState(data);
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    } finally {
      setLoadingState(false);
    }
  };

  useEffect(() => { fetchSyncStatus(); }, []);

  // Auto-poll status while syncing
  useEffect(() => {
    if (!syncing && !autoSync) return;
    const interval = setInterval(fetchSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [syncing, autoSync]);

  const runSync = async (freshStart: boolean) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("unified-hotel-search", {
        body: { action: "sync-hotels", maxPages: 10, freshStart },
      });
      if (data) hydrateHotelDataFromWire(data);
      if (error) throw error;
      if (data?.success) {
        toast.success(`Synced ${data.batchHotels || 0} hotels (${data.totalHotelsProcessed} total, ${data.citiesSynced} cities)`);
        if (data.alreadyComplete) {
          toast.info("Sync already completed. Click 'Fresh Start' to re-sync.");
          setAutoSync(false);
          autoSyncRef.current = false;
        }
      } else {
        toast.error(data?.error || "Sync failed");
      }
      await fetchSyncStatus();
      return data;
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
      return null;
    } finally {
      setSyncing(false);
    }
  };

  // Auto-continue loop
  useEffect(() => {
    autoSyncRef.current = autoSync;
  }, [autoSync]);

  const startAutoSync = async (freshStart = false) => {
    setAutoSync(true);
    autoSyncRef.current = true;
    let result = await runSync(freshStart);
    while (autoSyncRef.current && result?.success && !result?.complete && !result?.alreadyComplete) {
      await new Promise(r => setTimeout(r, 2000));
      if (!autoSyncRef.current) break;
      result = await runSync(false);
    }
    setAutoSync(false);
    autoSyncRef.current = false;
  };

  const stopAutoSync = () => {
    setAutoSync(false);
    autoSyncRef.current = false;
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "default";
    if (s === "syncing") return "secondary";
    if (s === "paused") return "outline";
    return "secondary";
  };

  const canResume = (syncState?.status === "paused" || syncState?.status === "syncing") && syncState?.next_cursor;
  const isComplete = syncState?.status === "completed";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Tripjack Hotel Sync</span>
            {syncState && (
              <Badge variant={statusColor(syncState.status) as any}>
                {autoSync ? "auto-syncing" : syncState.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {autoSync ? (
              <Button size="sm" variant="outline" onClick={stopAutoSync}>
                <Pause className="mr-1.5 h-3 w-3" /> Stop Auto-Sync
              </Button>
            ) : (
              <>
                {canResume && (
                  <Button size="sm" onClick={() => startAutoSync(false)} disabled={syncing}>
                    {syncing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Play className="mr-1.5 h-3 w-3" />}
                    Auto-Continue
                  </Button>
                )}
                {!canResume && !isComplete && (
                  <Button size="sm" onClick={() => startAutoSync(false)} disabled={syncing}>
                    {syncing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Play className="mr-1.5 h-3 w-3" />}
                    Start Auto-Sync
                  </Button>
                )}
                {isComplete && (
                  <Button size="sm" variant="outline" onClick={() => runSync(false)} disabled={syncing}>
                    {syncing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                    Check for Updates
                  </Button>
                )}
              </>
            )}
            <Button size="sm" variant="destructive" onClick={() => startAutoSync(true)} disabled={syncing || autoSync}>
              {syncing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1.5 h-3 w-3" />}
              Fresh Start
            </Button>
          </div>
        </div>

        {syncState && syncState.total_hotels_synced > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span><strong>{syncState.total_hotels_synced.toLocaleString()}</strong> hotels</span>
            <span><strong>{syncState.total_cities_synced.toLocaleString()}</strong> cities</span>
            <span><strong>{syncState.pages_processed.toLocaleString()}</strong> pages</span>
            {syncState.started_at && (
              <span>Started: {new Date(syncState.started_at).toLocaleString()}</span>
            )}
            {syncState.completed_at && (
              <span>Completed: {new Date(syncState.completed_at).toLocaleString()}</span>
            )}
          </div>
        )}

        {loadingState && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading sync status...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TripjackSyncCard;
