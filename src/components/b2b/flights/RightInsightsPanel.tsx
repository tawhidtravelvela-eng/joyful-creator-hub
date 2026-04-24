import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Calendar as CalIcon, Clock as ClockIcon, Headphones, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { B2BFareRow, B2BSearchContext } from "./types";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  rows: B2BFareRow[];
  ctx: B2BSearchContext;
  currencySymbol: string;
}

interface PricePoint { date: string; price: number; currency?: string }

/** Format YYYY-MM-DD to "Mon, 11 Nov" */
const fmtShort = (iso: string) => {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
  } catch { return iso; }
};

const Sparkline = ({ data, currencySymbol, todayIdx }: { data: PricePoint[]; currencySymbol: string; todayIdx: number }) => {
  const w = 240, h = 90, pad = 8;
  const values = data.map(d => d.price);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const dx = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((p, i) => [pad + i * dx, h - pad - ((p.price - min) / range) * (h - pad * 2)] as const);
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + ` L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;
  const safeIdx = Math.min(Math.max(0, todayIdx), pts.length - 1);
  const [tx, ty] = pts[safeIdx];
  const todayValue = data[safeIdx]?.price ?? 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[90px]">
      <defs>
        <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.16" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1={pad} x2={w - pad} y1={pad + (h - pad * 2) * p} y2={pad + (h - pad * 2) * p}
          stroke="hsl(var(--border))" strokeDasharray="2 4" strokeWidth="0.5" />
      ))}
      <path d={area} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="1.4" />
      ))}
      <circle cx={tx} cy={ty} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="2" />
      <g>
        <rect x={tx - 30} y={ty - 26} width="60" height="20" rx="4" fill="hsl(220,55%,18%)" />
        <text x={tx} y={ty - 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
          {currencySymbol}{Math.round(todayValue).toLocaleString()}
        </text>
        <text x={tx} y={ty - 3} textAnchor="middle" fontSize="7" fill="white" opacity="0.7">Today</text>
      </g>
    </svg>
  );
};

export const RightInsightsPanel = ({ rows, ctx, currencySymbol }: Props) => {
  const { convertFromSource } = useCurrency();
  const cheapest = useMemo(
    () => (rows.length ? Math.min(...rows.map(r => r.sellFare)) : 0),
    [rows]
  );
  const resultsCurrency = rows[0]?.currency || "USD";

  const [trend, setTrend] = useState<PricePoint[]>([]);
  const [cheaperDates, setCheaperDates] = useState<PricePoint[]>([]);
  const [trendVerdict, setTrendVerdict] = useState<{ direction: "up" | "down" | "stable"; days?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch real ±30-day price history for the route.
  // Priority: flight_price_trends (live user searches — freshest signal) →
  // flight_price_cache (bootstrap data, e.g. background-warmed grid).
  // Provider/source names are NEVER surfaced — we only read the converted price.
  useEffect(() => {
    if (!ctx.origin || !ctx.destination || !ctx.departDate) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const center = new Date(ctx.departDate + "T00:00:00");
        const start = new Date(center); start.setDate(start.getDate() - 30);
        const end = new Date(center); end.setDate(end.getDate() + 30);
        const startIso = start.toISOString().slice(0, 10);
        const endIso = end.toISOString().slice(0, 10);

        // Look back 30 days of sample history for trends — gives us real recency weight.
        const sampleSince = new Date(); sampleSince.setDate(sampleSince.getDate() - 30);
        const sampleSinceIso = sampleSince.toISOString().slice(0, 10);

        const [trendsRes, cacheRes] = await Promise.all([
          supabase
            .from("flight_price_trends")
            .select("depart_date, min_price, currency, sample_date")
            .eq("from_code", ctx.origin)
            .eq("to_code", ctx.destination)
            .gte("depart_date", startIso)
            .lte("depart_date", endIso)
            .gte("sample_date", sampleSinceIso)
            .order("sample_date", { ascending: false }),
          supabase
            .from("flight_price_cache")
            .select("travel_date, lowest_price, currency")
            .eq("from_code", ctx.origin)
            .eq("to_code", ctx.destination)
            .gte("travel_date", startIso)
            .lte("travel_date", endIso)
            // exclude AI-estimate filler; bootstrap + live rows are kept
            .not("source", "eq", "ai-estimate")
            .order("travel_date", { ascending: true }),
        ]);

        if (cancelled) return;

        // Merge: trends win over cache for the same date (live data > bootstrap).
        const byDate = new Map<string, { price: number; trusted: boolean }>();
        (trendsRes.data || []).forEach((r: any) => {
          if (!r.depart_date || (r.min_price ?? 0) <= 0) return;
          const converted = convertFromSource(Number(r.min_price), String(r.currency || "USD").toUpperCase());
          if (converted <= 0) return;
          const existing = byDate.get(r.depart_date);
          if (!existing || converted < existing.price) {
            byDate.set(r.depart_date, { price: converted, trusted: true });
          }
        });
        (cacheRes.data || []).forEach((r: any) => {
          if (!r.travel_date || (r.lowest_price ?? 0) <= 0) return;
          const existing = byDate.get(r.travel_date);
          if (existing?.trusted) return; // never overwrite live data with bootstrap
          const converted = convertFromSource(Number(r.lowest_price), String(r.currency || "USD").toUpperCase());
          if (converted <= 0) return;
          if (!existing || converted < existing.price) {
            byDate.set(r.travel_date, { price: converted, trusted: false });
          }
        });

        const points: PricePoint[] = Array.from(byDate.entries())
          .map(([date, v]) => ({ date, price: v.price, currency: resultsCurrency }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Build a wider trend window centered on departDate (up to 15 points for richer chart)
        const departIdx = points.findIndex(p => p.date === ctx.departDate);
        if (departIdx >= 0 && points.length >= 3) {
          const half = 7;
          const lo = Math.max(0, departIdx - half);
          const hi = Math.min(points.length, lo + 15);
          setTrend(points.slice(lo, hi));
        } else {
          setTrend(points.slice(0, 15));
        }

        // Cheaper alternatives: dates within window that are <= 95% of today's price
        const todayPrice = points.find(p => p.date === ctx.departDate)?.price ?? cheapest;
        if (todayPrice > 0) {
          const cheaper = points
            .filter(p => p.date !== ctx.departDate && p.price <= todayPrice * 0.95)
            .sort((a, b) => a.price - b.price)
            .slice(0, 2);
          setCheaperDates(cheaper);
        }

        // Verdict: compare last 3 vs first 3
        if (points.length >= 6) {
          const slice = points.slice(Math.max(0, departIdx - 3), departIdx + 4);
          const future = slice.slice(Math.ceil(slice.length / 2));
          const past = slice.slice(0, Math.floor(slice.length / 2));
          if (future.length && past.length) {
            const fAvg = future.reduce((s, p) => s + p.price, 0) / future.length;
            const pAvg = past.reduce((s, p) => s + p.price, 0) / past.length;
            const diff = (fAvg - pAvg) / pAvg;
            if (diff > 0.04) setTrendVerdict({ direction: "up", days: 3 });
            else if (diff < -0.04) setTrendVerdict({ direction: "down", days: 3 });
            else setTrendVerdict({ direction: "stable" });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ctx.origin, ctx.destination, ctx.departDate, cheapest, convertFromSource, resultsCurrency]);

  const todayIdx = Math.max(0, trend.findIndex(p => p.date === ctx.departDate));

  const recents = [
    { route: `${ctx.origin} → ${ctx.destination}`, meta: `${fmtShort(ctx.departDate)} · ${ctx.adults} Traveler${ctx.adults > 1 ? "s" : ""}`, color: "bg-info/50" },
  ];

  const cheapestSavings = cheaperDates.length && cheapest
    ? Math.max(0, Math.round(cheapest - cheaperDates[0].price))
    : 0;

  return (
    <div className="space-y-4">
      {/* Price trend */}
      <div className="bg-card border border-border/60 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[14px] font-bold text-foreground tracking-tight">Price Trend</h4>
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="text-[11px] text-muted-foreground mb-3">
          {trend.length > 0 ? `${trend.length}-day forecast` : loading ? "Loading…" : "Building forecast…"}
        </div>
        {trend.length >= 2 ? (
          <Sparkline data={trend} currencySymbol={currencySymbol} todayIdx={todayIdx} />
        ) : (
          <div className="h-[90px] flex items-center justify-center text-[11px] text-muted-foreground">
            Price history is being collected for this route.
          </div>
        )}
        {trend.length >= 2 && (
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
            <span>{fmtShort(trend[0].date)}</span>
            <span>{fmtShort(trend[Math.floor(trend.length / 2)].date)}</span>
            <span>{fmtShort(trend[trend.length - 1].date)}</span>
          </div>
        )}
        {trendVerdict && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ClockIcon className="h-3 w-3" />
            {trendVerdict.direction === "up" && <>Likely to <span className="text-danger dark:text-danger font-semibold">increase</span> in {trendVerdict.days} days</>}
            {trendVerdict.direction === "down" && <>Likely to <span className="text-success dark:text-success font-semibold">drop</span> in {trendVerdict.days} days</>}
            {trendVerdict.direction === "stable" && <>Prices are <span className="font-semibold">stable</span> for now</>}
          </div>
        )}
      </div>

      {/* Cheaper dates */}
      <div className="bg-success/5 dark:bg-success/50/5 border border-success/15 dark:border-success/50/20 rounded-2xl p-4">
        <h4 className="text-[14px] font-bold text-success dark:text-success tracking-tight">Cheaper Dates</h4>
        <div className="text-[11.5px] text-success dark:text-success font-semibold mb-3">
          {cheaperDates.length > 0
            ? `Save up to ${currencySymbol}${cheapestSavings.toLocaleString()}`
            : loading ? "Searching nearby dates…" : "No cheaper dates within ±15 days"}
        </div>
        {cheaperDates.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {cheaperDates.map(d => (
              <button key={d.date}
                className="bg-card border border-success/15 dark:border-success/50/20 rounded-xl p-2.5 text-left hover:border-success/40 hover:shadow-sm transition-all">
                <div className="text-[11px] font-semibold text-foreground">{fmtShort(d.date)}</div>
                <div className="text-[12.5px] font-bold tabular-nums text-success dark:text-success mt-1">
                  {currencySymbol}{Math.round(d.price).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">Try a different month for better fares.</div>
        )}
        <button className="text-[11.5px] text-success dark:text-success font-semibold hover:underline mt-3 inline-flex items-center gap-1">
          <CalIcon className="h-3 w-3" /> View Calendar
        </button>
      </div>

      {/* Recent searches */}
      <div className="bg-warning/5 dark:bg-warning/50/5 border border-warning/15 dark:border-warning/50/20 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[14px] font-bold text-foreground tracking-tight inline-flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Recent Searches
          </h4>
          <button className="text-[11px] font-semibold text-primary hover:underline">Manage</button>
        </div>
        <div className="space-y-2.5">
          {recents.map((r, i) => (
            <button key={i} className="w-full flex items-center gap-2.5 hover:bg-card rounded-lg p-1.5 transition-colors text-left">
              <div className={`w-2 h-2 rounded-full ${r.color}`} />
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-foreground">{r.route}</div>
                <div className="text-[10.5px] text-muted-foreground">{r.meta}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Need help */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(220,55%,18%)] to-[hsl(225,60%,22%)] text-white p-4">
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <Headphones className="h-24 w-24" />
        </div>
        <div className="relative">
          <h4 className="text-[14px] font-bold tracking-tight">Need Help?</h4>
          <p className="text-[11.5px] text-white/70 mt-1">Talk to our team 24/7</p>
          <Button
            size="sm"
            onClick={() => {
              const w = window as any;
              try {
                if (Array.isArray(w.$crisp)) {
                  w.$crisp.push(["do", "chat:show"]);
                  w.$crisp.push(["do", "chat:open"]);
                } else {
                  window.open("mailto:support@travelvela.com", "_blank");
                }
              } catch {
                window.open("mailto:support@travelvela.com", "_blank");
              }
            }}
            className="mt-3 bg-white text-[hsl(220,55%,18%)] hover:bg-white/90 rounded-lg h-8 text-[12px] font-semibold"
          >
            <Headphones className="h-3 w-3 mr-1.5" /> Chat Now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RightInsightsPanel;
