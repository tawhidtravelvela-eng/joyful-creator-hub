// ai-trip-learner: Analyzes trip generation data and produces learning insights
// Called periodically by admin or cron to aggregate patterns and recommendations
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const lookbackDays = body.lookback_days || 30;
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

    // ── 1. Fetch aggregated data in parallel ──
    const [jobsRes, eventsRes, aiUsageRes, existingInsightsRes] = await Promise.all([
      sb.from("trip_generation_jobs")
        .select("id, status, quality_score, confidence_score, quality_metadata, request_payload, created_at, started_at, completed_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
      sb.from("trip_itinerary_events")
        .select("id, job_id, event_type, event_data, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      sb.from("ai_usage_logs")
        .select("model, provider, function_name, input_tokens, output_tokens, total_tokens, duration_ms, estimated_cost, success, created_at")
        .in("function_name", ["ai-trip-generate", "ai-trip-generate-v2", "ai-trip-match-v2"])
        .gte("created_at", since)
        .limit(500),
      sb.from("trip_learning_insights")
        .select("id, insight_type, category, title, status")
        .eq("status", "active")
        .limit(100),
    ]);

    const jobs = jobsRes.data || [];
    const events = eventsRes.data || [];
    const aiUsage = aiUsageRes.data || [];
    const existingInsights = existingInsightsRes.data || [];

    console.log(`[Learner] Analyzing: ${jobs.length} jobs, ${events.length} events, ${aiUsage.length} AI calls`);

    const insights: any[] = [];
    const recommendations: any[] = [];
    const riskFlags: string[] = [];

    // ── 2. Job Status Analysis ──
    const statusCounts: Record<string, number> = {};
    for (const j of jobs) statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
    const failRate = jobs.length > 0 ? (statusCounts["failed"] || 0) / jobs.length : 0;

    if (failRate > 0.15 && jobs.length >= 5) {
      insights.push({
        type: "pattern",
        category: "reliability",
        title: "High failure rate detected",
        description: `${(failRate * 100).toFixed(1)}% of jobs failed in the last ${lookbackDays} days (${statusCounts["failed"]} / ${jobs.length})`,
        confidence: Math.min(0.95, 0.5 + jobs.length / 100),
        priority: "high",
      });
      riskFlags.push("HIGH_FAILURE_RATE");
    }

    const stuckJobs = jobs.filter(j => j.status === "processing" && j.started_at &&
      (Date.now() - new Date(j.started_at).getTime()) > 300000);
    if (stuckJobs.length > 0) {
      insights.push({
        type: "pattern",
        category: "reliability",
        title: `${stuckJobs.length} stuck job(s) detected`,
        description: "Jobs in 'processing' for >5 minutes — likely timed out without marking failed",
        confidence: 0.95,
        priority: "high",
      });
      riskFlags.push("STUCK_JOBS");
    }

    // ── 3. Quality Score Analysis ──
    const qualityJobs = jobs.filter(j => j.quality_score != null);
    if (qualityJobs.length >= 3) {
      const avgQuality = qualityJobs.reduce((s, j) => s + j.quality_score, 0) / qualityJobs.length;
      const avgConfidence = qualityJobs.filter(j => j.confidence_score != null)
        .reduce((s, j) => s + Number(j.confidence_score), 0) / (qualityJobs.filter(j => j.confidence_score != null).length || 1);

      if (avgQuality < 70) {
        insights.push({
          type: "pattern",
          category: "quality",
          title: "Below-target quality average",
          description: `Average quality score: ${avgQuality.toFixed(0)}/100 (target: 70+)`,
          confidence: Math.min(0.9, 0.5 + qualityJobs.length / 20),
          priority: "high",
        });
        recommendations.push({
          target: "review_trigger",
          action: "increase",
          details: "Enable GPT-5 review pass for all trips until quality stabilizes above 70",
          priority: "high",
        });
      }

      if (avgConfidence < 0.7) {
        riskFlags.push("LOW_CONFIDENCE_TREND");
        insights.push({
          type: "pattern",
          category: "quality",
          title: "Low confidence trend",
          description: `Average confidence: ${avgConfidence.toFixed(2)} (threshold: 0.70)`,
          confidence: 0.8,
          priority: "medium",
        });
      }

      // Issue code frequency from quality_metadata
      const issueCounts: Record<string, number> = {};
      for (const j of qualityJobs) {
        const issues = (j.quality_metadata as any)?.issues || [];
        for (const issue of issues) {
          const code = typeof issue === "string" ? issue : issue.code || "UNKNOWN";
          issueCounts[code] = (issueCounts[code] || 0) + 1;
        }
      }

      const topIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (topIssues.length > 0) {
        insights.push({
          type: "pattern",
          category: "quality",
          title: "Most frequent validation issues",
          description: topIssues.map(([code, count]) => `${code}: ${count}x`).join(", "),
          confidence: 0.9,
          priority: topIssues[0][1] > qualityJobs.length * 0.3 ? "high" : "medium",
          data: { issueCounts },
        });
      }
    }

    // ── 4. User Behavior Analysis ──
    const eventCounts: Record<string, number> = {};
    for (const e of events) eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;

    if (events.length >= 5) {
      // Activity removal patterns
      const removals = events.filter(e => e.event_type === "remove_activity");
      if (removals.length > 0) {
        const removedNames: Record<string, number> = {};
        for (const r of removals) {
          const name = (r.event_data as any)?.activity_name || "unknown";
          removedNames[name] = (removedNames[name] || 0) + 1;
        }
        const frequentRemovals = Object.entries(removedNames)
          .filter(([, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1]);

        if (frequentRemovals.length > 0) {
          insights.push({
            type: "pattern",
            category: "product_ranking",
            title: "Frequently removed activities",
            description: frequentRemovals.map(([name, count]) => `"${name}" removed ${count}x`).join("; "),
            confidence: Math.min(0.85, 0.5 + removals.length / 20),
            priority: "medium",
          });
          recommendations.push({
            target: "product_ranking",
            action: "re-rank",
            details: `Demote frequently removed activities: ${frequentRemovals.map(([n]) => n).join(", ")}`,
            priority: "medium",
          });
        }
      }

      // Conversion funnel
      const views = eventCounts["view"] || 0;
      const edits = eventCounts["edit"] || 0;
      const quotes = eventCounts["quote_request"] || 0;
      const bookings = eventCounts["booking"] || 0;
      const abandons = eventCounts["abandon"] || 0;

      if (views > 0) {
        const conversionRate = bookings / views;
        const quoteRate = quotes / views;
        insights.push({
          type: "pattern",
          category: "conversion",
          title: "Conversion funnel",
          description: `View→Quote: ${(quoteRate * 100).toFixed(1)}%, View→Book: ${(conversionRate * 100).toFixed(1)}%`,
          confidence: Math.min(0.9, 0.4 + views / 50),
          priority: conversionRate < 0.05 ? "high" : "low",
          data: { views, edits, quotes, bookings, abandons },
        });

        if (abandons > views * 0.5 && views >= 10) {
          riskFlags.push("HIGH_ABANDONMENT");
          recommendations.push({
            target: "activity_density",
            action: "decrease",
            details: "High abandonment rate — consider reducing activity density for better user satisfaction",
            priority: "high",
          });
        }
      }
    }

    // ── 5. Cost Analysis ──
    if (aiUsage.length >= 3) {
      const totalCost = aiUsage.reduce((s, u) => s + (Number(u.estimated_cost) || 0), 0);
      const totalTokens = aiUsage.reduce((s, u) => s + (u.total_tokens || 0), 0);
      const avgCostPerTrip = totalCost / aiUsage.length;
      const avgDuration = aiUsage.reduce((s, u) => s + (u.duration_ms || 0), 0) / aiUsage.length;

      // Model distribution
      const modelCounts: Record<string, { calls: number; cost: number; tokens: number }> = {};
      for (const u of aiUsage) {
        if (!modelCounts[u.model]) modelCounts[u.model] = { calls: 0, cost: 0, tokens: 0 };
        modelCounts[u.model].calls++;
        modelCounts[u.model].cost += Number(u.estimated_cost) || 0;
        modelCounts[u.model].tokens += u.total_tokens || 0;
      }

      insights.push({
        type: "pattern",
        category: "cost",
        title: "AI cost summary",
        description: `${aiUsage.length} calls, $${totalCost.toFixed(4)} total, $${avgCostPerTrip.toFixed(4)}/trip avg, ${(avgDuration / 1000).toFixed(1)}s avg latency`,
        confidence: 0.95,
        priority: avgCostPerTrip > 0.05 ? "medium" : "low",
        data: { totalCost, totalTokens, avgCostPerTrip, avgDuration, modelCounts },
      });

      // Check for expensive model overuse
      const proUsage = modelCounts["gemini-2.5-pro"];
      if (proUsage && proUsage.calls > aiUsage.length * 0.2) {
        riskFlags.push("EXPENSIVE_MODEL_OVERUSE");
        recommendations.push({
          target: "review_trigger",
          action: "restrict",
          details: `Gemini 2.5 Pro used ${proUsage.calls}x (${((proUsage.calls / aiUsage.length) * 100).toFixed(0)}%) — restrict to truly complex trips only`,
          priority: "medium",
        });
      }

      // Failure cost waste
      const failedCost = aiUsage.filter(u => !u.success).reduce((s, u) => s + (Number(u.estimated_cost) || 0), 0);
      if (failedCost > totalCost * 0.1 && failedCost > 0.01) {
        riskFlags.push("HIGH_FAILURE_COST");
        insights.push({
          type: "risk_flag",
          category: "cost",
          title: "Wasted spend on failed AI calls",
          description: `$${failedCost.toFixed(4)} spent on failed calls (${((failedCost / totalCost) * 100).toFixed(1)}% of total)`,
          confidence: 0.9,
          priority: "medium",
        });
      }
    }

    // ── 6. Trip Profile Patterns ──
    const travelTypes: Record<string, number> = {};
    const destinations: Record<string, number> = {};
    for (const j of jobs) {
      const payload = j.request_payload as any;
      const sp = payload?.searchParams || payload || {};
      const tt = sp.travel_type || "unknown";
      travelTypes[tt] = (travelTypes[tt] || 0) + 1;
      const dest = sp.destination_city || sp.destination_country || "";
      if (dest) destinations[dest] = (destinations[dest] || 0) + 1;
    }

    if (jobs.length >= 5) {
      const topDest = Object.entries(destinations).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (topDest.length > 0) {
        insights.push({
          type: "pattern",
          category: "template",
          title: "Top requested destinations",
          description: topDest.map(([d, c]) => `${d}: ${c}x`).join(", "),
          confidence: 0.85,
          priority: "low",
          data: { destinations: Object.fromEntries(topDest), travelTypes },
        });

        // Recommend template creation for high-volume destinations
        const highVol = topDest.filter(([, c]) => c >= 3);
        if (highVol.length > 0) {
          recommendations.push({
            target: "template",
            action: "adjust",
            details: `Create/optimize templates for high-volume routes: ${highVol.map(([d]) => d).join(", ")}`,
            priority: "medium",
          });
        }
      }
    }

    // ── 7. Generate overall status ──
    const hasHighRisk = riskFlags.some(f =>
      ["HIGH_FAILURE_RATE", "STUCK_JOBS", "HIGH_ABANDONMENT"].includes(f));
    const hasMediumRisk = riskFlags.length > 0;
    const finalStatus = hasHighRisk ? "critical" : hasMediumRisk ? "needs_review" : "healthy";

    // ── 8. Persist new insights (upsert by title to avoid duplicates) ──
    const existingTitles = new Set(existingInsights.map(i => i.title));
    const newInsights = insights.filter(i => !existingTitles.has(i.title));

    if (newInsights.length > 0) {
      const rows = newInsights.map(i => ({
        insight_type: i.type,
        category: i.category || null,
        priority: i.priority || "medium",
        title: i.title,
        description: i.description,
        data: i.data || {},
        confidence: i.confidence || null,
        sample_size: jobs.length,
        status: "active",
      }));
      const { error: insertErr } = await sb.from("trip_learning_insights").insert(rows);
      if (insertErr) console.error("[Learner] Insert error:", insertErr.message);
      else console.log(`[Learner] Stored ${rows.length} new insights`);
    }

    // ── 9. Return full analysis ──
    const result = {
      status: finalStatus,
      period_days: lookbackDays,
      sample_size: { jobs: jobs.length, events: events.length, ai_calls: aiUsage.length },
      insights,
      recommendations,
      risk_flags: riskFlags,
      policy_updates: {
        trip_profile_rules: travelTypes,
        review_thresholds: {
          quality_minimum: 70,
          confidence_minimum: 0.7,
        },
      },
    };

    console.log(`[Learner] Analysis complete: ${insights.length} insights, ${recommendations.length} recommendations, status=${finalStatus}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Learner] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
