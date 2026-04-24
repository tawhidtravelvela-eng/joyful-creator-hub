/**
 * AdminPipelineDebug — Displays pipeline debug snapshots side-by-side.
 * Accessed via /admin/pipeline-debug or by pressing Ctrl+Shift+D on Trip Planner.
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Search, AlertTriangle } from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  stage_1_ai_creative: "bg-blue-500/10 border-blue-500/30",
  stage_2_decision_engine: "bg-orange-500/10 border-orange-500/30",
  stage_3_quality_layer: "bg-green-500/10 border-green-500/30",
  stage_4_ai_review: "bg-purple-500/10 border-purple-500/30",
  stage_5_final: "bg-primary/10 border-primary/30",
};

function ActivityRow({ act, highlight }: { act: any; highlight?: string }) {
  const isBookable = act.source === "travelvela" || act.product_code;
  const isFree = act.source === "free";
  return (
    <div className={`flex items-start gap-2 py-1 px-2 rounded text-xs ${highlight || ""}`}>
      <span className="font-mono text-muted-foreground w-12 shrink-0">{act.time || "—"}</span>
      <span className="flex-1">{act.activity}</span>
      {isBookable && <Badge variant="outline" className="text-[10px] shrink-0 bg-green-500/10 text-green-700">bookable</Badge>}
      {isFree && <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-500/10 text-blue-700">free</Badge>}
      {act.product_code && <span className="font-mono text-[9px] text-muted-foreground">{act.product_code}</span>}
      {act.cost_estimate > 0 && <span className="text-muted-foreground">${act.cost_estimate}</span>}
    </div>
  );
}

function SearchTermsPanel({ data }: { data: any }) {
  if (!data) return <p className="text-muted-foreground text-sm p-4">No search terms data captured. Re-run with debug_mode enabled.</p>;

  const enrichmentTerms = data.enrichment_terms || [];
  const rescueTerms = data.rescue_terms || [];
  const sources = data.sources || {};

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-2 px-2">
        <Badge variant="outline" className="bg-blue-500/10">Total Intents: {data.total_intents}</Badge>
        <Badge variant="outline" className="bg-green-500/10">Enrichment Terms: {enrichmentTerms.length}</Badge>
        <Badge variant="outline" className="bg-orange-500/10">Rescue Terms: {rescueTerms.length}</Badge>
      </div>

      {/* Sources breakdown */}
      <Card className="border-dashed">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Intent Sources</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 text-xs space-y-1">
          <div className="flex justify-between"><span>From AI Creative output</span><span className="font-mono">{sources.ai_creative || 0}</span></div>
          <div className="flex justify-between"><span>From user must_visit list</span><span className="font-mono">{sources.must_visit || 0}</span></div>
          <div className="flex justify-between"><span>From static CITY_KEY_ATTRACTIONS</span><span className="font-mono">{sources.static_attractions || 0}</span></div>
        </CardContent>
      </Card>

      {/* Enrichment terms table */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center gap-1">
            <Search className="h-3 w-3" /> Enrichment Search Terms → unified-tour-search
          </CardTitle>
        </CardHeader>
        <CardContent className="py-1 px-1">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="border p-1.5 bg-muted text-left w-8">#</th>
                  <th className="border p-1.5 bg-muted text-left">Search Term</th>
                  <th className="border p-1.5 bg-muted text-left w-24">City Filter</th>
                </tr>
              </thead>
              <tbody>
                {enrichmentTerms.map((t: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                    <td className="border p-1.5 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="border p-1.5 font-mono">{t.term}</td>
                    <td className="border p-1.5 text-muted-foreground">{t.city || "—  (global)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Rescue terms */}
      {rescueTerms.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-orange-500" /> Rescue Search Terms (Pass 2 — failed matches)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-1">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="border p-1.5 bg-muted text-left w-8">#</th>
                    <th className="border p-1.5 bg-muted text-left">Rescue Term</th>
                    <th className="border p-1.5 bg-muted text-left w-24">City</th>
                    <th className="border p-1.5 bg-muted text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rescueTerms.map((t: any, i: number) => (
                    <tr key={i} className="bg-orange-500/5">
                      <td className="border p-1.5 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="border p-1.5 font-mono">{t.term}</td>
                      <td className="border p-1.5 text-muted-foreground">{t.city || "global"}</td>
                      <td className="border p-1.5 text-muted-foreground">{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StagePanel({ stage, stageKey }: { stage: any; stageKey: string }) {
  if (!stage) return <p className="text-muted-foreground text-sm p-4">No data for this stage</p>;
  if (stage.error) return <p className="text-destructive text-sm p-4">Error: {stage.error}</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-2">{stage.label}</p>
      {stage.confidence !== undefined && (
        <Badge variant="outline" className="ml-2">Confidence: {stage.confidence}</Badge>
      )}
      {stage.issues_found !== undefined && (
        <Badge variant="outline" className="ml-2">Issues: {stage.issues_found}</Badge>
      )}
      {stage.changed !== undefined && (
        <Badge variant={stage.changed ? "default" : "outline"} className="ml-2">
          {stage.changed ? "Changed by review" : "No changes"}
        </Badge>
      )}
      {(stage.days || []).map((day: any) => (
        <Card key={day.day} className={`border ${STAGE_COLORS[stageKey] || ""}`}>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium">
              Day {day.day}: {day.city} — {day.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-1 space-y-0.5">
            {(day.activities || []).map((act: any, i: number) => (
              <ActivityRow key={i} act={act} />
            ))}
            {(!day.activities || day.activities.length === 0) && (
              <p className="text-xs text-muted-foreground px-2 py-1">No activities</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ComparisonTable({ snapshots }: { snapshots: any }) {
  const stages = ["stage_1_ai_creative", "stage_2_decision_engine", "stage_3_quality_layer", "stage_4_ai_review", "stage_5_final"];
  const stageLabels = ["1. AI Creative", "2. Decision Engine", "3. Quality Layer", "4. AI Review", "5. Final"];
  
  // Collect all days across stages
  const allDays = new Set<number>();
  for (const sk of stages) {
    for (const d of (snapshots[sk]?.days || [])) allDays.add(d.day);
  }
  const sortedDays = [...allDays].sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="border p-2 bg-muted text-left w-16">Day</th>
            {stages.map((sk, i) => (
              <th key={sk} className={`border p-2 text-left ${STAGE_COLORS[sk] || "bg-muted"}`}>
                {stageLabels[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedDays.map(dayNum => (
            <tr key={dayNum}>
              <td className="border p-2 font-mono font-bold align-top">{dayNum}</td>
              {stages.map(sk => {
                const day = (snapshots[sk]?.days || []).find((d: any) => d.day === dayNum);
                return (
                  <td key={sk} className="border p-1 align-top max-w-[280px]">
                    {day ? (
                      <div>
                        <p className="font-medium text-[10px] text-muted-foreground mb-1">{day.city} — {day.title}</p>
                        {(day.activities || []).map((act: any, i: number) => (
                          <div key={i} className="flex gap-1 py-0.5">
                            <span className="font-mono text-muted-foreground w-10 shrink-0">{act.time || "—"}</span>
                            <span className="truncate">{act.activity}</span>
                            {act.product_code && <span className="text-green-600">✓</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPipelineDebug() {
  const [snapshots, setSnapshots] = useState<any>(null);

  useEffect(() => {
    // Listen for debug data from TripPlanner
    const handler = (e: CustomEvent) => setSnapshots(e.detail);
    window.addEventListener("vela-debug-snapshots" as any, handler as any);
    
    // Check localStorage for stored snapshots
    const stored = localStorage.getItem("vela_debug_snapshots");
    if (stored) {
      try { setSnapshots(JSON.parse(stored)); } catch {}
    } else {
      // Auto-load latest debug snapshots from server
      fetch("/debug_snapshots_latest.json")
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) { setSnapshots(data); localStorage.setItem("vela_debug_snapshots", JSON.stringify(data)); } })
        .catch(() => {});
    }
    
    return () => window.removeEventListener("vela-debug-snapshots" as any, handler as any);
  }, []);

  const handleExportJson = () => {
    if (!snapshots) return;
    const blob = new Blob([JSON.stringify(snapshots, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-debug-${new Date().toISOString().slice(0, 16)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasSearchTerms = !!snapshots?.enrichment_search_terms;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pipeline Debug Comparison</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem("vela_debug_snapshots"); setSnapshots(null); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJson} disabled={!snapshots}>
              <Download className="h-4 w-4 mr-1" /> Export JSON
            </Button>
          </div>
        </div>

        {!snapshots ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-lg mb-2">No debug data yet</p>
              <p className="text-sm">
                Go to Trip Planner, press <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+Shift+D</kbd> to enable debug mode,
                then generate a trip. The pipeline snapshots will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={hasSearchTerms ? "search-terms" : "table"}>
            <TabsList>
              <TabsTrigger value="search-terms" className="flex items-center gap-1">
                <Search className="h-3 w-3" /> Search Terms
                {hasSearchTerms && <Badge variant="secondary" className="text-[10px] ml-1">{snapshots.enrichment_search_terms?.enrichment_terms?.length || 0}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="table">Comparison Table</TabsTrigger>
              <TabsTrigger value="stages">Stage-by-Stage</TabsTrigger>
            </TabsList>

            <TabsContent value="search-terms">
              <Card>
                <CardContent className="p-3">
                  <ScrollArea className="max-h-[75vh]">
                    <SearchTermsPanel data={snapshots.enrichment_search_terms} />
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="table">
              <Card>
                <CardContent className="p-2">
                  <ScrollArea className="max-h-[75vh]">
                    <ComparisonTable snapshots={snapshots} />
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stages" className="space-y-4">
              {["stage_1_ai_creative", "stage_2_decision_engine", "stage_3_quality_layer", "stage_4_ai_review", "stage_5_final"].map(sk => (
                <Card key={sk}>
                  <CardContent className="p-3">
                    <ScrollArea className="max-h-[50vh]">
                      <StagePanel stage={snapshots[sk]} stageKey={sk} />
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
