import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const HotelstonSyncCard = () => {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const syncData = async (action: string, label: string) => {
    setSyncing(action);
    try {
      const { data, error } = await supabase.functions.invoke("hotelston-static-data", {
        body: { action },
      });
      if (error) throw error;
      setResults(prev => ({ ...prev, [action]: data }));
      if (data?.success) {
        const count = data.destinations?.length || data.hotels?.length || data.nationalities?.length || data.boardTypes?.length || 0;
        toast.success(`${label}: ${count} items fetched`);
      } else {
        toast.error(data?.error || `${label} failed`);
      }
    } catch (err: any) {
      toast.error(err.message || `${label} failed`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Hotelston Static Data</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { action: "destinations", label: "Destinations" },
            { action: "hotelList", label: "Hotel List" },
            { action: "nationalities", label: "Nationalities" },
            { action: "boardTypes", label: "Board Types" },
          ].map(({ action, label }) => (
            <Button
              key={action}
              size="sm"
              variant="outline"
              onClick={() => syncData(action, label)}
              disabled={syncing !== null}
            >
              {syncing === action ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3 w-3" />
              )}
              {label}
              {results[action]?.success && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                  {results[action]?.destinations?.length ||
                    results[action]?.hotels?.length ||
                    results[action]?.nationalities?.length ||
                    results[action]?.boardTypes?.length || 0}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default HotelstonSyncCard;
