import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain, Zap, DollarSign, Activity, TrendingUp, BarChart3,
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Target,
  Wrench, Eye, ArrowUpRight, Package, Lightbulb, RefreshCw,
  GraduationCap, Flag, ThumbsUp, ThumbsDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

type Period = "1d" | "7d" | "15d" | "30d";

const PERIOD_LABELS: Record<Period, string> = {
  "1d": "Today",
  "7d": "Last 7 Days",
  "15d": "Last 15 Days",
  "30d": "Last 30 Days",
};

const PERIOD_DAYS: Record<Period, number> = { "1d": 1, "7d": 7, "15d": 15, "30d": 30 };

const PRICING: Record<string, { input: number; output: number; label: string }> = {
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30, label: "Gemini 2.5 Flash Lite" },
  "gemini-2.5-flash": { input: 0.15, output: 0.60, label: "Gemini 2.5 Flash" },
  "gemini-2.5-pro": { input: 1.25, output: 10.00, label: "Gemini 2.5 Pro" },
  "gemini-3-flash-preview": { input: 0.50, output: 3.00, label: "Gemini 3 Flash" },
  "gpt-5-mini": { input: 0.40, output: 1.60, label: "GPT-5 Mini" },
  "gpt-5-nano": { input: 0.10, output: 0.40, label: "GPT-5 Nano" },
  "gpt-5": { input: 2.00, output: 8.00, label: "GPT-5" },
  "gpt-4.1-mini": { input: 0.40, output: 1.60, label: "GPT-4.1 Mini" },
  "gpt-4.1": { input: 2.00, output: 8.00, label: "GPT-4.1" },
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"];

// ── Period Selector ──
function PeriodSelector({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-2">
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
        <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
          {PERIOD_LABELS[p]}
        </Button>
      ))}
    </div>
  );
}

// ── Stat Card ──
function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color || "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${color ? "text-foreground" : "text-primary"}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══ TAB 1: AI Cost & Usage ═══
function CostUsageTab({ period }: { period: Period }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["ai-usage-logs", period],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - PERIOD_DAYS[period]);
      const { data, error } = await supabase
        .from("ai_usage_logs" as any)
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const stats = useMemo(() => {
    if (!logs || logs.length === 0) return null;

    const totalCalls = logs.length;
    const totalInputTokens = logs.reduce((s: number, l: any) => s + (l.input_tokens || 0), 0);
    const totalOutputTokens = logs.reduce((s: number, l: any) => s + (l.output_tokens || 0), 0);
    const totalTokens = logs.reduce((s: number, l: any) => s + (l.total_tokens || 0), 0);
    const totalCost = logs.reduce((s: number, l: any) => s + (Number(l.estimated_cost) || 0), 0);
    const avgDuration = logs.reduce((s: number, l: any) => s + (l.duration_ms || 0), 0) / totalCalls;
    const successRate = (logs.filter((l: any) => l.success).length / totalCalls) * 100;

    const byProvider: Record<string, { calls: number; inputTokens: number; outputTokens: number; totalTokens: number; cost: number }> = {};
    for (const l of logs) {
      const key = l.model || l.provider || "unknown";
      if (!byProvider[key]) byProvider[key] = { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 };
      byProvider[key].calls++;
      byProvider[key].inputTokens += l.input_tokens || 0;
      byProvider[key].outputTokens += l.output_tokens || 0;
      byProvider[key].totalTokens += l.total_tokens || 0;
      byProvider[key].cost += Number(l.estimated_cost) || 0;
    }

    const byDay: Record<string, Record<string, number>> = {};
    for (const l of logs) {
      const day = new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!byDay[day]) byDay[day] = {};
      const model = l.model || "unknown";
      byDay[day][model] = (byDay[day][model] || 0) + 1;
    }
    const dailyData = Object.entries(byDay).map(([day, models]) => ({ day, ...models })).reverse();

    // Provider split
    const geminiCalls = logs.filter((l: any) => (l.provider || l.model || "").includes("gemini")).length;
    const openaiCalls = logs.filter((l: any) => (l.provider || "").includes("openai") || (l.model || "").startsWith("gpt")).length;

    const daysInPeriod = PERIOD_DAYS[period];
    const dailyAvgCost = totalCost / daysInPeriod;
    const monthlyEstimate = dailyAvgCost * 30;

    return { totalCalls, totalInputTokens, totalOutputTokens, totalTokens, totalCost, avgDuration, successRate, byProvider, dailyData, monthlyEstimate, geminiCalls, openaiCalls };
  }, [logs, period]);

  const pieData = stats ? Object.entries(stats.byProvider).map(([model, data]) => ({
    name: PRICING[model]?.label || model,
    value: data.calls,
    cost: data.cost,
  })) : [];

  const models = stats ? Object.keys(stats.byProvider) : [];

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>;
  if (!stats) return <Card><CardContent className="py-12 text-center text-muted-foreground">No AI usage data yet.</CardContent></Card>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Brain} label="Total API Calls" value={stats.totalCalls.toLocaleString()} sub={`Gemini: ${stats.geminiCalls} | OpenAI: ${stats.openaiCalls}`} />
        <StatCard icon={Zap} label="Total Tokens" value={`${(stats.totalTokens / 1000).toFixed(1)}K`} sub={`In: ${(stats.totalInputTokens / 1000).toFixed(0)}K | Out: ${(stats.totalOutputTokens / 1000).toFixed(0)}K`} />
        <StatCard icon={DollarSign} label="Period Cost" value={`$${stats.totalCost.toFixed(4)}`} sub={`Avg: $${(stats.totalCost / stats.totalCalls).toFixed(6)}/call`} />
        <StatCard icon={TrendingUp} label="Est. Monthly" value={`$${stats.monthlyEstimate.toFixed(2)}`} color="bg-secondary" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Daily API Calls by Model</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  {models.map((model, i) => (
                    <Bar key={model} dataKey={model} fill={COLORS[i % COLORS.length]} stackId="a" name={PRICING[model]?.label || model} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Model Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, _name: string, props: any) => [`${value} calls ($${props.payload.cost.toFixed(4)})`, _name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Breakdown by Model</CardTitle>
          <CardDescription>Platform pricing estimates based on published rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">API Calls</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Input Tokens</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Output Tokens</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Input Cost</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Output Cost</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byProvider).map(([model, data]) => {
                  const pricing = PRICING[model] || { input: 0.10, output: 0.40, label: model };
                  const inputCost = (data.inputTokens * pricing.input) / 1_000_000;
                  const outputCost = (data.outputTokens * pricing.output) / 1_000_000;
                  return (
                    <tr key={model} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={model.includes("gemini") ? "secondary" : "default"} className="text-xs">
                            {model.includes("gemini") ? "Google" : "OpenAI"}
                          </Badge>
                          <span className="font-medium">{pricing.label}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">{data.calls.toLocaleString()}</td>
                      <td className="text-right py-3 px-4">{(data.inputTokens / 1000).toFixed(1)}K</td>
                      <td className="text-right py-3 px-4">{(data.outputTokens / 1000).toFixed(1)}K</td>
                      <td className="text-right py-3 px-4 text-muted-foreground">${inputCost.toFixed(4)}</td>
                      <td className="text-right py-3 px-4 text-muted-foreground">${outputCost.toFixed(4)}</td>
                      <td className="text-right py-3 px-4 font-semibold">${(inputCost + outputCost).toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20 font-semibold">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4">{stats.totalCalls.toLocaleString()}</td>
                  <td className="text-right py-3 px-4">{(stats.totalInputTokens / 1000).toFixed(1)}K</td>
                  <td className="text-right py-3 px-4">{(stats.totalOutputTokens / 1000).toFixed(1)}K</td>
                  <td colSpan={2} />
                  <td className="text-right py-3 px-4 text-lg">${stats.totalCost.toFixed(4)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Extra stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Activity} label="Avg Response Time" value={`${(stats.avgDuration / 1000).toFixed(1)}s`} />
        <StatCard icon={Zap} label="Success Rate" value={`${stats.successRate.toFixed(1)}%`} />
        <StatCard icon={DollarSign} label="Avg Cost per Call" value={`$${(stats.totalCost / stats.totalCalls).toFixed(6)}`} />
      </div>
    </div>
  );
}

// ═══ TAB 2: Quality & Trust Analytics ═══
function QualityAnalyticsTab({ period }: { period: Period }) {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["trip-quality-analytics", period],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - PERIOD_DAYS[period]);
      const { data, error } = await supabase
        .from("trip_generation_jobs" as any)
        .select("id, status, quality_score, confidence_score, quality_metadata, created_at, completed_at, started_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const stats = useMemo(() => {
    if (!jobs || jobs.length === 0) return null;

    const total = jobs.length;
    const completed = jobs.filter((j: any) => j.status === "completed");
    const failed = jobs.filter((j: any) => j.status === "failed");
    const withQuality = completed.filter((j: any) => j.quality_score != null);

    // Quality scores
    const avgQuality = withQuality.length > 0
      ? withQuality.reduce((s: number, j: any) => s + (j.quality_score || 0), 0) / withQuality.length
      : null;
    const avgConfidence = withQuality.length > 0
      ? withQuality.reduce((s: number, j: any) => s + (Number(j.confidence_score) || 0), 0) / withQuality.length
      : null;

    // Confidence distribution
    const highConf = withQuality.filter((j: any) => Number(j.confidence_score) >= 0.85).length;
    const medConf = withQuality.filter((j: any) => Number(j.confidence_score) >= 0.70 && Number(j.confidence_score) < 0.85).length;
    const lowConf = withQuality.filter((j: any) => Number(j.confidence_score) < 0.70).length;

    // Issue codes aggregation
    const issueCounts: Record<string, number> = {};
    let totalRepairs = 0;
    let criticalRepairs = 0;

    for (const j of withQuality) {
      const meta = j.quality_metadata;
      if (!meta) continue;
      totalRepairs += meta.issues_repaired || 0;
      const codes = meta.issue_codes || [];
      for (const ic of codes) {
        issueCounts[ic.code] = (issueCounts[ic.code] || 0) + 1;
        if (!ic.repaired) criticalRepairs++;
      }
    }

    // Product trust summary
    let bookableConfirmed = 0, needsRecheck = 0, nonBookable = 0;
    for (const j of withQuality) {
      const trust = j.quality_metadata?.product_trust_summary;
      if (!trust) continue;
      bookableConfirmed += trust.bookable_confirmed || 0;
      needsRecheck += trust.bookable_needs_recheck || 0;
      nonBookable += trust.suggested_nonbookable || 0;
    }

    // Status distribution
    const statusCounts = {
      healthy: withQuality.filter((j: any) => Number(j.confidence_score) >= 0.85).length,
      needs_review: withQuality.filter((j: any) => Number(j.confidence_score) >= 0.70 && Number(j.confidence_score) < 0.85).length,
      critical: withQuality.filter((j: any) => Number(j.confidence_score) < 0.70).length,
    };

    // Processing time
    const processingTimes = completed
      .filter((j: any) => j.started_at && j.completed_at)
      .map((j: any) => (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000);
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((s, t) => s + t, 0) / processingTimes.length
      : 0;

    // Daily trend
    const byDay: Record<string, { total: number; avgConf: number; confSum: number; confCount: number }> = {};
    for (const j of jobs) {
      const day = new Date(j.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!byDay[day]) byDay[day] = { total: 0, avgConf: 0, confSum: 0, confCount: 0 };
      byDay[day].total++;
      if (j.confidence_score != null) {
        byDay[day].confSum += Number(j.confidence_score);
        byDay[day].confCount++;
      }
    }
    const dailyTrend = Object.entries(byDay).map(([day, d]) => ({
      day,
      trips: d.total,
      avgConfidence: d.confCount > 0 ? parseFloat((d.confSum / d.confCount).toFixed(3)) : null,
    })).reverse();

    // Performance flags
    const flags: string[] = [];
    if (avgConfidence !== null && avgConfidence < 0.70) flags.push("LOW_CONFIDENCE");
    if (criticalRepairs > 5) flags.push("HIGH_CRITICAL_REPAIRS");
    if (failed.length > total * 0.1) flags.push("HIGH_FAILURE_RATE");
    if (nonBookable > bookableConfirmed * 2) flags.push("PRODUCT_UNCERTAINTY");

    // Top issue codes
    const topIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      total, completed: completed.length, failed: failed.length,
      withQuality: withQuality.length, avgQuality, avgConfidence,
      highConf, medConf, lowConf,
      issueCounts, totalRepairs, criticalRepairs, topIssues,
      bookableConfirmed, needsRecheck, nonBookable,
      statusCounts, avgProcessingTime, dailyTrend, flags,
    };
  }, [jobs]);

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>;
  if (!stats) return <Card><CardContent className="py-12 text-center text-muted-foreground">No trip generation data yet. Quality metrics will appear after trips are generated with the new Quality Layer.</CardContent></Card>;

  const confDistData = [
    { name: "High (≥0.85)", value: stats.highConf, fill: "#10b981" },
    { name: "Medium (0.70–0.84)", value: stats.medConf, fill: "#f59e0b" },
    { name: "Low (<0.70)", value: stats.lowConf, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  const trustData = [
    { name: "Confirmed", value: stats.bookableConfirmed, fill: "#10b981" },
    { name: "Needs Recheck", value: stats.needsRecheck, fill: "#f59e0b" },
    { name: "Non-Bookable", value: stats.nonBookable, fill: "#94a3b8" },
  ].filter(d => d.value > 0);

  const finalStatus = stats.avgConfidence !== null
    ? (stats.avgConfidence >= 0.85 ? "healthy" : stats.avgConfidence >= 0.70 ? "needs_review" : "critical")
    : "unknown";

  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    healthy: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", label: "Healthy" },
    needs_review: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100", label: "Needs Review" },
    critical: { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Critical" },
    unknown: { icon: Eye, color: "text-muted-foreground", bg: "bg-muted", label: "No Data" },
  };
  const sc = statusConfig[finalStatus];

  return (
    <div className="space-y-6">
      {/* System Status Banner */}
      <Card className="border-2 border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${sc.bg}`}>
                <sc.icon className={`h-8 w-8 ${sc.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold">System Status: <span className={sc.color}>{sc.label}</span></p>
                <p className="text-sm text-muted-foreground">
                  {stats.total} trips generated | {stats.completed} completed | {stats.failed} failed
                  {stats.avgConfidence !== null && ` | Avg confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`}
                </p>
              </div>
            </div>
            {stats.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {stats.flags.map(f => (
                  <Badge key={f} variant="destructive" className="text-xs">{f}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Target}
          label="Avg Quality Score"
          value={stats.avgQuality !== null ? `${stats.avgQuality.toFixed(0)}/100` : "—"}
          sub={`${stats.withQuality} trips with quality data`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Avg Confidence"
          value={stats.avgConfidence !== null ? `${(stats.avgConfidence * 100).toFixed(1)}%` : "—"}
          sub={`High: ${stats.highConf} | Med: ${stats.medConf} | Low: ${stats.lowConf}`}
          color="bg-emerald-100"
        />
        <StatCard
          icon={Wrench}
          label="Total Repairs"
          value={stats.totalRepairs.toLocaleString()}
          sub={`${stats.criticalRepairs} unrepaired critical`}
          color="bg-amber-100"
        />
        <StatCard
          icon={Activity}
          label="Avg Processing"
          value={`${stats.avgProcessingTime.toFixed(1)}s`}
          sub={`${stats.completed} completed trips`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trend */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Trip Generation Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Area type="monotone" dataKey="trips" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Trips" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Confidence Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Confidence Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              {confDistData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={confDistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {confDistData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No confidence data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issue Codes + Product Trust */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Issue Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Top Issue Codes</CardTitle>
            <CardDescription>Most common quality issues detected across all trips</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topIssues.length > 0 ? (
              <div className="space-y-3">
                {stats.topIssues.map(([code, count]) => {
                  const severity = code.includes("ARRIVAL") || code.includes("DEPARTURE") || code.includes("TRANSPORT")
                    ? "destructive" : code.includes("DUPLICATE") || code.includes("OVERLOAD") || code.includes("WRONG")
                    ? "default" : "secondary";
                  return (
                    <div key={code} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={severity as any} className="text-xs font-mono">{code}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, (count / stats.total) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No issues detected — system running clean ✓</p>
            )}
          </CardContent>
        </Card>

        {/* Product Trust Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Product Trust Breakdown</CardTitle>
            <CardDescription>Trust level distribution across all recommended products</CardDescription>
          </CardHeader>
          <CardContent>
            {trustData.length > 0 ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={trustData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {trustData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-2xl font-bold text-emerald-700">{stats.bookableConfirmed}</p>
                    <p className="text-xs text-emerald-600">Confirmed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-2xl font-bold text-amber-700">{stats.needsRecheck}</p>
                    <p className="text-xs text-amber-600">Recheck</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-2xl font-bold text-slate-700">{stats.nonBookable}</p>
                    <p className="text-xs text-slate-600">Non-Bookable</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No product trust data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold text-emerald-700">{stats.statusCounts.healthy}</p>
                <p className="text-sm text-emerald-600">Healthy</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.statusCounts.needs_review}</p>
                <p className="text-sm text-amber-600">Needs Review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
              <XCircle className="h-6 w-6 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700">{stats.statusCounts.critical}</p>
                <p className="text-sm text-red-600">Critical</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ TAB 3: Learning Engine ═══
function LearningTab({ period }: { period: Period }) {
  const [isRunning, setIsRunning] = useState(false);

  // Fetch stored insights
  const { data: insights, isLoading: insightsLoading, refetch } = useQuery({
    queryKey: ["learning-insights"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trip_learning_insights")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch recent user events
  const { data: eventStats } = useQuery({
    queryKey: ["trip-events-stats", period],
    queryFn: async () => {
      const since = new Date(Date.now() - PERIOD_DAYS[period] * 86400000).toISOString();
      const { data } = await supabase
        .from("trip_itinerary_events")
        .select("event_type")
        .gte("created_at", since);
      const counts: Record<string, number> = {};
      for (const e of data || []) counts[e.event_type] = (counts[e.event_type] || 0) + 1;
      return counts;
    },
  });

  const runLearner = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-trip-learner", {
        body: { lookback_days: PERIOD_DAYS[period] },
      });
      if (error) throw error;
      console.log("Learner result:", data);
      refetch();
    } catch (err) {
      console.error("Learner error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  const priorityColor = (p: string) =>
    p === "high" ? "text-red-600 bg-red-50" : p === "medium" ? "text-yellow-600 bg-yellow-50" : "text-green-600 bg-green-50";

  const typeIcon = (t: string) => {
    if (t === "pattern") return <TrendingUp className="h-4 w-4" />;
    if (t === "recommendation") return <Lightbulb className="h-4 w-4" />;
    if (t === "risk_flag") return <Flag className="h-4 w-4 text-red-500" />;
    return <Brain className="h-4 w-4" />;
  };

  const totalEvents = Object.values(eventStats || {}).reduce((s, c) => s + c, 0);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Learning Engine</h3>
          <p className="text-sm text-muted-foreground">
            Analyzes trip data to detect patterns and recommend improvements
          </p>
        </div>
        <Button onClick={runLearner} disabled={isRunning} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      {/* User Behavior Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Views", value: eventStats?.view || 0, icon: Eye },
          { label: "Edits", value: eventStats?.edit || 0, icon: Wrench },
          { label: "Removals", value: eventStats?.remove_activity || 0, icon: XCircle },
          { label: "Quotes", value: eventStats?.quote_request || 0, icon: ArrowUpRight },
          { label: "Bookings", value: eventStats?.booking || 0, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights & Recommendations */}
      {insightsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !insights || insights.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No insights yet</p>
              <p className="text-sm mt-1">
                Click "Run Analysis" to analyze trip data and generate insights.
                The engine needs at least 5 trips with quality data to produce meaningful patterns.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {insights.map((insight: any) => (
            <Card key={insight.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{typeIcon(insight.insight_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{insight.title}</span>
                      <Badge variant="outline" className={`text-xs ${priorityColor(insight.priority)}`}>
                        {insight.priority}
                      </Badge>
                      {insight.category && (
                        <Badge variant="secondary" className="text-xs">{insight.category}</Badge>
                      )}
                      {insight.confidence != null && (
                        <span className="text-xs text-muted-foreground">
                          {(insight.confidence * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(insight.created_at).toLocaleDateString()}
                      </span>
                      {insight.sample_size > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Sample: {insight.sample_size} trips
                        </span>
                      )}
                      <div className="flex gap-1 ml-auto">
                        <Button
                          variant="ghost" size="sm" className="h-6 text-xs gap-1"
                          onClick={async () => {
                            await supabase.from("trip_learning_insights")
                              .update({ status: "applied", applied_at: new Date().toISOString() })
                              .eq("id", insight.id);
                            refetch();
                          }}
                        >
                          <ThumbsUp className="h-3 w-3" /> Apply
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-6 text-xs gap-1"
                          onClick={async () => {
                            await supabase.from("trip_learning_insights")
                              .update({ status: "dismissed" })
                              .eq("id", insight.id);
                            refetch();
                          }}
                        >
                          <ThumbsDown className="h-3 w-3" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data Readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Data Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">User Events</p>
              <p className="font-medium">{totalEvents} tracked</p>
              <p className="text-xs text-muted-foreground">{totalEvents >= 10 ? "✅ Sufficient" : "⚠️ Need more data"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Quality Scores</p>
              <p className="font-medium">{insights?.filter((i: any) => i.category === "quality").length || 0} insights</p>
              <p className="text-xs text-muted-foreground">Populated after quality layer runs</p>
            </div>
            <div>
              <p className="text-muted-foreground">Active Insights</p>
              <p className="font-medium">{insights?.length || 0} active</p>
            </div>
            <div>
              <p className="text-muted-foreground">Engine Status</p>
              <p className="font-medium text-green-600">Ready</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══ MAIN PAGE ═══
export default function AdminAiUsage() {
  const [period, setPeriod] = useState<Period>("7d");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-2xl font-bold text-foreground">Vela AI Analytics</h2>
          <PeriodSelector period={period} setPeriod={setPeriod} />
        </div>

        <Tabs defaultValue="quality" className="space-y-6">
          <TabsList>
            <TabsTrigger value="quality" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Quality & Trust
            </TabsTrigger>
            <TabsTrigger value="cost" className="gap-2">
              <DollarSign className="h-4 w-4" /> Cost & Usage
            </TabsTrigger>
            <TabsTrigger value="learning" className="gap-2">
              <GraduationCap className="h-4 w-4" /> Learning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quality">
            <QualityAnalyticsTab period={period} />
          </TabsContent>

          <TabsContent value="cost">
            <CostUsageTab period={period} />
          </TabsContent>

          <TabsContent value="learning">
            <LearningTab period={period} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
