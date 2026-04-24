import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, Pause, RotateCcw, Database, RefreshCw, Zap, Globe, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hydrateTourDataFromWire } from "@/lib/tourWireAdapter";

interface DestState {
  destination_id: string;
  destination_name: string;
  status: string;
  total_products_found: number;
  products_detailed: number;
  priority: number;
  error_count: number;
  last_error: string | null;
  completed_at: string | null;
  updated_at: string;
}

const TourSyncCard = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [reResolving, setReResolving] = useState(false);
  const [syncingTaxonomy, setSyncingTaxonomy] = useState(false);
  const autoRef = useRef(false);
  const [summary, setSummary] = useState<any>(null);
  const [destinations, setDestinations] = useState<DestState[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [zeroPriceCount, setZeroPriceCount] = useState<number | null>(null);

  const fetchStatus = async () => {
    try {
      const { data } = await supabase.functions.invoke("tour-inventory-sync", {
        body: { action: "sync-status" },
      });
      if (data?.success) {
        setSummary(data.summary);
        setDestinations(data.destinations || []);
      }
    } catch (e) {
      console.error("Tour sync status error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); fetchZeroPriceCount(); }, []);

  const fetchZeroPriceCount = async () => {
    try {
      const { count } = await supabase
        .from("tour_product_cache" as any)
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .or("price.eq.0,price.is.null");
      setZeroPriceCount(count || 0);
    } catch { setZeroPriceCount(null); }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    let totalFixed = 0;
    let totalDeactivated = 0;
    let rounds = 0;
    try {
      while (rounds < 30) { // Max 30 rounds of 5 = 150 products
        const { data, error } = await supabase.functions.invoke("unified-tour-search", {
          body: { action: "backfill-zero-prices", batchSize: 5 },
        });
        if (data) hydrateTourDataFromWire(data);
        if (error || !data?.success) break;
        totalFixed += data.fixed || 0;
        totalDeactivated += data.deactivated || 0;
        rounds++;
        if (data.total === 0) break; // No more $0 products
        await new Promise(r => setTimeout(r, 1000)); // Brief delay between batches
      }
      toast.success(`Price backfill: ${totalFixed} fixed, ${totalDeactivated} deactivated`);
      await fetchZeroPriceCount();
    } catch (e: any) {
      toast.error(e.message || "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  const runReResolve = async () => {
    setReResolving(true);
    let totalChanged = 0;
    let totalProcessed = 0;
    let rounds = 0;
    try {
      while (rounds < 20) {
        const { data, error } = await supabase.functions.invoke("tour-inventory-sync", {
          body: { action: "re-resolve" },
        });
        if (error || !data?.success) break;
        totalChanged += data.changed || 0;
        totalProcessed += data.processed || 0;
        rounds++;
        if (data.remaining === 0 || data.processed === 0) break;
        await new Promise(r => setTimeout(r, 500));
      }
      toast.success(`Re-resolved: ${totalChanged} fixed, ${totalProcessed} processed`);
      await fetchStatus();
    } catch (e: any) {
      toast.error(e.message || "Re-resolve failed");
    } finally {
      setReResolving(false);
    }
  };

  useEffect(() => {
    if (!syncing && !autoSync) return;
    const iv = setInterval(fetchStatus, 8000);
    return () => clearInterval(iv);
  }, [syncing, autoSync]);

  const initDestinations = async () => {
    const { data } = await supabase.functions.invoke("tour-inventory-sync", {
      body: { action: "sync-init" },
    });
    if (data?.success) {
      toast.success(`Initialized ${data.destinations} destinations`);
      fetchStatus();
    }
  };

  const runBatch = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("tour-inventory-sync", {
        body: { action: "sync-batch" },
      });
      if (error) throw error;
      if (data?.idle) {
        toast.info("All destinations synced — nothing to do");
        setAutoSync(false);
        autoRef.current = false;
      } else if (data?.rateLimited) {
        toast.warning("Rate limited — pausing for 30s");
      } else if (data?.success) {
        toast.success(`${data.destination}: ${data.detailsFetched} products detailed`);
      }
      await fetchStatus();
      return data;
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
      return null;
    } finally {
      setSyncing(false);
    }
  };

  const startAutoSync = async () => {
    setAutoSync(true);
    autoRef.current = true;
    let result = await runBatch();
    while (autoRef.current && result?.success && !result?.idle) {
      const delay = result?.rateLimited ? 30000 : 3000;
      await new Promise(r => setTimeout(r, delay));
      if (!autoRef.current) break;
      result = await runBatch();
    }
    setAutoSync(false);
    autoRef.current = false;
  };

  const stopAutoSync = () => {
    setAutoSync(false);
    autoRef.current = false;
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "default";
    if (s === "syncing") return "secondary";
    if (s === "paused") return "outline";
    return "secondary";
  };

  const totalProducts = summary?.total_detailed_products || 0;
  const completedDests = summary?.completed || 0;
  const totalDests = summary?.total_destinations || 0;
  const progress = totalDests > 0 ? (completedDests / totalDests) * 100 : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Tour Inventory Sync</span>
            {summary && (
              <Badge variant="secondary">
                {totalProducts.toLocaleString()} products
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalDests === 0 && (
              <Button size="sm" onClick={initDestinations}>
                <Database className="mr-1.5 h-3 w-3" /> Initialize
              </Button>
            )}
            {autoSync ? (
              <Button size="sm" variant="outline" onClick={stopAutoSync}>
                <Pause className="mr-1.5 h-3 w-3" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={startAutoSync} disabled={syncing || totalDests === 0}>
                {syncing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Play className="mr-1.5 h-3 w-3" />}
                {syncing ? "Syncing..." : "Auto-Sync"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => runBatch()} disabled={syncing || autoSync || totalDests === 0}>
              <RefreshCw className="mr-1.5 h-3 w-3" /> 1 Batch
            </Button>
            {(zeroPriceCount ?? 0) > 0 && (
              <Button size="sm" variant="outline" onClick={runBackfill} disabled={backfilling}>
                {backfilling ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1.5 h-3 w-3" />}
                Fix $0 ({zeroPriceCount})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={runReResolve} disabled={reResolving}>
              {reResolving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1.5 h-3 w-3" />}
              Re-resolve
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              setBackfilling(true);
              let totalFixed = 0;
              try {
                for (let r = 0; r < 50; r++) {
                  const { data, error } = await supabase.functions.invoke("tour-inventory-sync", {
                    body: { action: "backfill-highlights", batchSize: 200 },
                  });
                  if (error || !data?.success) break;
                  totalFixed += data.fixed || 0;
                  if (data.remaining === 0 || data.fixed === 0) break;
                  await new Promise(r => setTimeout(r, 300));
                }
                toast.success(`Highlights backfill: ${totalFixed} products enriched`);
              } catch (e: any) {
                toast.error(e.message || "Highlights backfill failed");
              } finally {
                setBackfilling(false);
              }
            }} disabled={backfilling}>
              {backfilling ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1.5 h-3 w-3" />}
              Fix Highlights
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const priorityDests = ["60449", "335", "338", "339"]; // SG, KL, Langkawi, Penang
                for (const id of priorityDests) {
                  await supabase.functions.invoke("tour-inventory-sync", {
                    body: { action: "sync-prioritize", destinationId: id },
                  });
                }
                toast.success("SG/KL/Langkawi/Penang prioritized — hit Auto-Sync to process fast");
              } catch (e: any) {
                toast.error(e.message || "Priority boost failed");
              }
            }}>
              <Zap className="mr-1.5 h-3 w-3" /> Priority MY/SG
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              setSyncingTaxonomy(true);
              try {
                const { data, error } = await supabase.functions.invoke("tour-inventory-sync", {
                  body: { action: "sync-taxonomy" },
                });
                if (error) throw error;
                toast.success(`Taxonomy synced: ${data?.upserted || 0} destinations cached (${data?.totalInMap || 0} total)`);
              } catch (e: any) {
                toast.error(e.message || "Taxonomy sync failed");
              } finally {
                setSyncingTaxonomy(false);
              }
            }} disabled={syncingTaxonomy}>
              {syncingTaxonomy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Globe className="mr-1.5 h-3 w-3" />}
              Taxonomy
            </Button>
          </div>
        </div>

        {summary && totalDests > 0 && (
          <>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completedDests}/{totalDests} destinations</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
              <span><strong>{totalProducts.toLocaleString()}</strong> detailed</span>
              <span><strong>{summary.total_cached_products?.toLocaleString()}</strong> cached</span>
              <span className="text-green-600">{completedDests} done</span>
              <span className="text-blue-600">{summary.syncing || 0} active</span>
              <span className="text-yellow-600">{summary.paused || 0} paused</span>
              <button className="underline" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? "hide" : "details"}
              </button>
            </div>

            {showDetails && (
              <div className="max-h-48 overflow-auto space-y-1 text-xs border rounded p-2">
                {destinations.map(d => (
                  <div key={d.destination_id} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Badge variant={statusColor(d.status) as any} className="text-[10px] px-1 py-0">
                        {d.status}
                      </Badge>
                      {d.destination_name}
                    </span>
                    <span className="text-muted-foreground">
                      {d.products_detailed}/{d.total_products_found || "?"}
                      {d.last_error && <span className="text-destructive ml-1" title={d.last_error}>⚠</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TourSyncCard;
