import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, TrendingDown, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type EventRow = {
  page_path: string;
  referrer_host: string | null;
  device: string | null;
  session_id: string | null;
  created_at: string;
};

interface Props {
  tenantId: string;
  liveUrl: string | null;
}

/**
 * Lightweight first-party analytics: last-7-days pageviews, unique visitors,
 * top pages, top referrers. Reads tenant_site_events (RLS scoped to tenant
 * admins). Renders an in-card sparkline of daily pageviews.
 */
export default function AnalyticsCard({ tenantId, liveUrl }: Props) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<7 | 30>(7);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const since = new Date(Date.now() - windowDays * 86400_000).toISOString();
    supabase
      .from("tenant_site_events")
      .select("page_path, referrer_host, device, session_id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data as EventRow[]) || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, windowDays]);

  const stats = useMemo(() => {
    const sessions = new Set<string>();
    const pageMap = new Map<string, number>();
    const refMap = new Map<string, number>();
    const dayMap = new Map<string, number>();
    for (const r of rows) {
      if (r.session_id) sessions.add(r.session_id);
      pageMap.set(r.page_path, (pageMap.get(r.page_path) || 0) + 1);
      const host = r.referrer_host || "Direct";
      refMap.set(host, (refMap.get(host) || 0) + 1);
      const day = r.created_at.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }
    const topPages = Array.from(pageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topRefs = Array.from(refMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    // Build day buckets oldest → newest
    const days: { date: string; count: number }[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days.push({ date: d, count: dayMap.get(d) || 0 });
    }
    const half = Math.floor(days.length / 2);
    const firstHalf = days.slice(0, half).reduce((a, b) => a + b.count, 0);
    const secondHalf = days.slice(half).reduce((a, b) => a + b.count, 0);
    const trend = firstHalf === 0 ? (secondHalf > 0 ? 100 : 0) : Math.round(((secondHalf - firstHalf) / firstHalf) * 100);

    return { views: rows.length, visitors: sessions.size, topPages, topRefs, days, trend };
  }, [rows, windowDays]);

  const maxDay = Math.max(1, ...stats.days.map((d) => d.count));

  return (
    <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03]">
      <CardContent className="relative p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Visitor analytics</div>
              <div className="text-xs text-muted-foreground">Live first-party tracking</div>
            </div>
          </div>
          <div className="flex rounded-md border border-border bg-background p-0.5 text-xs">
            {[7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d as 7 | 30)}
                className={`px-2 py-0.5 rounded-sm font-medium transition-colors ${
                  windowDays === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : stats.views === 0 ? (
          <EmptyState liveUrl={liveUrl} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-foreground tabular-nums">{stats.views.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  Pageviews
                  {stats.trend !== 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                        stats.trend > 0 ? "text-success dark:text-success" : "text-destructive"
                      }`}
                    >
                      {stats.trend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {Math.abs(stats.trend)}%
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground tabular-nums">{stats.visitors.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Unique visitors</div>
              </div>
            </div>

            {/* Sparkline */}
            <div className="flex items-end gap-0.5 h-12">
              {stats.days.map((d) => {
                const h = Math.max(2, Math.round((d.count / maxDay) * 100));
                return (
                  <div
                    key={d.date}
                    className="flex-1 bg-primary/70 hover:bg-primary rounded-t transition-colors"
                    style={{ height: `${h}%` }}
                    title={`${d.date}: ${d.count} views`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Top pages</div>
                <ul className="space-y-1">
                  {stats.topPages.map(([path, count]) => (
                    <li key={path} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-foreground truncate">{path === "/" ? "/ (home)" : path}</span>
                      <span className="font-mono text-muted-foreground tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Sources</div>
                <ul className="space-y-1">
                  {stats.topRefs.map(([host, count]) => (
                    <li key={host} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-foreground truncate">{host}</span>
                      <span className="font-mono text-muted-foreground tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ liveUrl }: { liveUrl: string | null }) {
  return (
    <div className="text-center py-6 space-y-3">
      <div className="text-sm text-muted-foreground">No visitors yet — share your site to start tracking.</div>
      {liveUrl && (
        <Button size="sm" variant="outline" asChild>
          <a href={liveUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Open your site
          </a>
        </Button>
      )}
    </div>
  );
}