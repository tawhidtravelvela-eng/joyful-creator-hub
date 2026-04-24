import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchChangeHistory, fetchItineraryErrors } from "@/utils/itineraryChangeTracker";
import { History, AlertTriangle, Bug, Eye, ChevronRight, Clock, User, Bot, Cpu, Globe } from "lucide-react";
import { format } from "date-fns";

interface Props {
  tripId: string;
}

const SOURCE_ICON: Record<string, any> = {
  ai: Bot,
  user: User,
  system: Cpu,
  api: Globe,
};

const SOURCE_COLOR: Record<string, string> = {
  ai: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  user: "bg-primary/10 text-primary border-primary/20",
  system: "bg-muted text-muted-foreground border-border",
  api: "bg-accent/10 text-accent border-accent/20",
};

const ERROR_COLOR: Record<string, string> = {
  timeline_broken: "bg-destructive/10 text-destructive",
  missing_transfer: "bg-warning/10 text-warning",
  arrival_violation: "bg-destructive/10 text-destructive",
  invalid_order: "bg-warning/10 text-warning",
  empty_itinerary: "bg-muted text-muted-foreground",
  empty_day: "bg-muted text-muted-foreground",
};

export default function ItineraryDebugPanel({ tripId }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [tripMeta, setTripMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [diffView, setDiffView] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [historyData, errorData] = await Promise.all([
      fetchChangeHistory(tripId),
      fetchItineraryErrors(tripId),
    ]);
    setLogs(historyData);
    setErrors(errorData);

    const { data: trip } = await supabase
      .from("saved_trips")
      .select("current_version, last_modified_by, last_modified_source, title, created_at, updated_at, itinerary_code")
      .eq("id", tripId)
      .single();
    setTripMeta(trip);
    setLoading(false);
  }, [tripId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  const SourceIcon = ({ source }: { source: string }) => {
    const Icon = SOURCE_ICON[source] || Cpu;
    return <Icon className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-4">
      {/* Meta Card */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bug className="h-4 w-4" /> Itinerary Debug Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-muted-foreground">Itinerary ID</div>
            <div className="font-mono font-bold text-primary">{(tripMeta as any)?.itinerary_code || "—"}</div>
            <div className="text-muted-foreground">Version</div>
            <div className="font-mono">v{(tripMeta as any)?.current_version ?? 1}</div>
            <div className="text-muted-foreground">Last Modified By</div>
            <div className="flex items-center gap-1.5">
              <SourceIcon source={(tripMeta as any)?.last_modified_source || "system"} />
              <span className="capitalize">{(tripMeta as any)?.last_modified_source || "—"}</span>
              {(tripMeta as any)?.last_modified_by && (
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  ({(tripMeta as any)?.last_modified_by})
                </span>
              )}
            </div>
            <div className="text-muted-foreground">Errors</div>
            <div>
              {errors.length > 0 ? (
                <Badge variant="destructive" className="text-xs">{errors.length} issues</Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-[hsl(152,70%,42%/0.3)] text-[hsl(152,70%,42%)]">Clean</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Validation Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {errors.map((err: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className={ERROR_COLOR[err.error_type] || ""}>
                      {err.error_type}
                    </Badge>
                    <span className="text-muted-foreground">
                      {err.details?.message || err.error_type}
                    </span>
                    <span className="ml-auto text-muted-foreground whitespace-nowrap">
                      {err.detected_at ? format(new Date(err.detected_at), "MMM d, HH:mm") : ""}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Change History */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> Change History ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1">
              {logs.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">No changes recorded yet</p>
              )}
              {logs.map((log: any, i: number) => (
                <div
                  key={log.id || i}
                  className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 text-xs group cursor-pointer"
                  onClick={() => setDiffView(log)}
                >
                  <Badge variant="outline" className={`text-[10px] ${SOURCE_COLOR[log.source] || ""}`}>
                    <SourceIcon source={log.source} />
                    <span className="ml-1">v{log.version}</span>
                  </Badge>
                  <span className="font-medium capitalize">{log.action_type.replace(/_/g, " ")}</span>
                  {log.change_summary && (
                    <span className="text-muted-foreground truncate max-w-[200px]">{log.change_summary}</span>
                  )}
                  <span className="ml-auto text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {log.created_at ? format(new Date(log.created_at), "MMM d, HH:mm") : ""}
                  </span>
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Diff Dialog */}
      <Dialog open={!!diffView} onOpenChange={(open) => !open && setDiffView(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              Version {diffView?.version} — {diffView?.action_type?.replace(/_/g, " ")}
              <Badge variant="outline" className={SOURCE_COLOR[diffView?.source] || ""}>
                {diffView?.source}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-medium mb-2 text-destructive">Before</h4>
              <pre className="bg-muted p-3 rounded overflow-auto max-h-[50vh] text-[10px] leading-relaxed">
                {diffView?.before_state ? JSON.stringify(diffView.before_state, null, 2) : "— initial —"}
              </pre>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-[hsl(152,70%,42%)]">After</h4>
              <pre className="bg-muted p-3 rounded overflow-auto max-h-[50vh] text-[10px] leading-relaxed">
                {diffView?.after_state ? JSON.stringify(diffView.after_state, null, 2) : "— deleted —"}
              </pre>
            </div>
          </div>
          {diffView?.change_summary && (
            <p className="text-xs text-muted-foreground mt-2">Summary: {diffView.change_summary}</p>
          )}
          {diffView?.actor_id && (
            <p className="text-xs text-muted-foreground">Actor: {diffView.actor_id}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
