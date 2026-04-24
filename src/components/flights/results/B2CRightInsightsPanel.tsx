import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, Calendar as CalIcon, Clock as ClockIcon, Headphones, ShieldCheck, Flame, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import mascot from "@/assets/vela-ai-mascot.png";
import type { FlightInsight } from "./types";
import PriceCalendarPopover from "./PriceCalendarPopover";
import AdvisorBlock from "./AdvisorBlock";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  currencySymbol: string;
  currencyCode?: string;
  cheapestPrice: number;
  origin: string;
  destination: string;
  departDate?: string | null;
  insight?: FlightInsight | null;
  smartTip?: string;
  airlineHighlight?: string;
  onPickDate?: (date: string) => void;
}

interface CheaperDate {
  date: string;
  label: string;
  price: number;
  save: number;
  note?: string;
  source?: "real" | "cache" | "estimated";
}

interface RecentSearch {
  from: string;
  to: string;
  date?: string;
  price?: number;
  ts: number;
}

const RECENT_KEY = "tv_recent_flight_searches";

function loadRecentSearches(currentFrom: string, currentTo: string): RecentSearch[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const all: RecentSearch[] = JSON.parse(raw);
    return all
      .filter((r) => !(r.from === currentFrom && r.to === currentTo))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 2);
  } catch {
    return [];
  }
}

function pushRecentSearch(entry: RecentSearch) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const all: RecentSearch[] = raw ? JSON.parse(raw) : [];
    const filtered = all.filter((r) => !(r.from === entry.from && r.to === entry.to));
    filtered.unshift(entry);
    localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 6)));
  } catch { /* ignore */ }
}

// Premium price-trend chart: average baseline, color-zoned area, anchored markers, hover tooltip
const TrendChart = ({
  values,
  dates,
  currencySymbol,
  selectedDate,
}: {
  values: number[];
  dates: string[];
  currencySymbol: string;
  selectedDate?: string | null;
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  // Pad y-range 8% so peaks/valleys don't touch edges
  const yPad = (max - min) * 0.12 || max * 0.08 || 1;
  const yMin = min - yPad;
  const yMax = max + yPad;
  const range = Math.max(yMax - yMin, 1);

  const w = 260, h = 96, padL = 8, padR = 8, padT = 14, padB = 8;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const dx = innerW / (values.length - 1);
  const yOf = (v: number) => padT + innerH - ((v - yMin) / range) * innerH;
  const xOf = (i: number) => padL + i * dx;

  const pts = values.map((v, i) => [xOf(i), yOf(v)] as const);
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + ` L ${xOf(values.length - 1)} ${padT + innerH} L ${padL} ${padT + innerH} Z`;
  const avgY = yOf(avg);

  // Anchor indices — Selected = user's chosen date (live price),
  // Cheapest = actual lowest price across the full ±7d window (INCLUDING the selected
  // date, since the live search is real data and may genuinely be the cheapest).
  const selectedIdx = selectedDate ? dates.findIndex((d) => d === selectedDate) : -1;
  const cheapestIdx = values.indexOf(min);

  // Build anchor list (dedupe by index, prioritise Selected > Cheapest)
  const anchors: { idx: number; label: string; color: string; kind: "selected" | "min" | "avg" }[] = [];
  const seen = new Set<number>();
  const addAnchor = (idx: number, label: string, color: string, kind: "selected" | "min" | "avg") => {
    if (idx < 0 || idx >= values.length || seen.has(idx)) return;
    seen.add(idx);
    anchors.push({ idx, label, color, kind });
  };
  if (selectedIdx >= 0) addAnchor(selectedIdx, "Selected", "hsl(var(--primary))", "selected");
  if (cheapestIdx !== selectedIdx) addAnchor(cheapestIdx, "Cheapest", "hsl(142 71% 42%)", "min");

  const fmtDate = (d?: string) => {
    if (!d) return "";
    try { return format(parseISO(d), "EEE, dd MMM"); } catch { return d; }
  };
  const fmtCompact = (n: number) =>
    n >= 1000 ? `${currencySymbol}${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${currencySymbol}${Math.round(n)}`;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w - padL;
    const idx = Math.round(relX / dx);
    setHoverIdx(idx >= 0 && idx < values.length ? idx : null);
  };

  const activeIdx = hoverIdx ?? -1;
  const activeVal = activeIdx >= 0 ? values[activeIdx] : null;
  const activeDate = activeIdx >= 0 ? dates[activeIdx] : null;
  const activeDelta = activeVal !== null ? Math.round(((activeVal - avg) / avg) * 100) : 0;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-[96px] overflow-visible cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="b2cTrendFillGood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="b2cTrendFillHi" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity="0" />
          </linearGradient>
          <clipPath id="clipBelowAvg"><rect x="0" y={avgY} width={w} height={h - avgY} /></clipPath>
          <clipPath id="clipAboveAvg"><rect x="0" y="0" width={w} height={avgY} /></clipPath>
        </defs>

        {/* Color zones: green below average, amber above */}
        <path d={area} fill="url(#b2cTrendFillGood)" clipPath="url(#clipBelowAvg)" />
        <path d={area} fill="url(#b2cTrendFillHi)" clipPath="url(#clipAboveAvg)" />

        {/* Average baseline */}
        <line
          x1={padL} x2={w - padR} y1={avgY} y2={avgY}
          stroke="hsl(var(--muted-foreground))" strokeOpacity="0.35"
          strokeWidth="1" strokeDasharray="3 3"
        />
        <text
          x={w - padR} y={avgY - 3} textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "0.04em" }}
        >
          AVG {fmtCompact(avg)}
        </text>

        {/* Trend line */}
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Subtle dots for every point */}
        {pts.map(([x, y], i) => {
          const isAnchor = seen.has(i);
          if (isAnchor) return null;
          return <circle key={i} cx={x} cy={y} r="1.6" fill="hsl(var(--primary))" fillOpacity="0.55" />;
        })}

        {/* Anchor markers (Today, Cheapest, Selected) */}
        {anchors.map(({ idx, label, color, kind }) => {
          const [x, y] = pts[idx];
          const labelAbove = y > h / 2; // place label opposite the curve
          const ly = labelAbove ? y - 10 : y + 14;
          return (
            <g key={kind}>
              {/* Halo */}
              <circle cx={x} cy={y} r="6" fill={color} fillOpacity="0.18" />
              <circle cx={x} cy={y} r="3.4" fill={color} stroke="hsl(var(--card))" strokeWidth="1.5" />
              <text
                x={x} y={ly} textAnchor="middle"
                style={{ fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.04em" }}
                fill={color}
              >
                {label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Hover crosshair */}
        {activeIdx >= 0 && (
          <g>
            <line
              x1={pts[activeIdx][0]} x2={pts[activeIdx][0]}
              y1={padT} y2={padT + innerH}
              stroke="hsl(var(--foreground))" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 2"
            />
            <circle cx={pts[activeIdx][0]} cy={pts[activeIdx][1]} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {/* Hover tooltip — clamps to panel edges so it doesn't get clipped on Cheapest/Selected hover */}
      {activeIdx >= 0 && activeVal !== null && (() => {
        const xPct = (pts[activeIdx][0] / w) * 100;
        // Clamp horizontally: keep tooltip fully inside container (8% padding each side)
        const clampedPct = Math.max(14, Math.min(86, xPct));
        const isLeftEdge = xPct < 14;
        const isRightEdge = xPct > 86;
        const translateX = isLeftEdge ? "0%" : isRightEdge ? "-100%" : "-50%";
        return (
          <div
            className="pointer-events-none absolute -top-2 z-10 px-2 py-1 rounded-md bg-foreground text-background shadow-lg text-[10px] font-semibold whitespace-nowrap"
            style={{
              left: `${clampedPct}%`,
              transform: `translate(${translateX}, -100%)`,
            }}
          >
            <div className="tabular-nums">{currencySymbol}{Math.round(activeVal).toLocaleString()}</div>
            <div className="opacity-70 text-[9px] font-medium">
              {fmtDate(activeDate || undefined)}
              {activeDelta !== 0 && (
                <span className={cn("ml-1 font-bold", activeDelta < 0 ? "text-success" : "text-warning")}>
                  {activeDelta > 0 ? "+" : ""}{activeDelta}%
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Anchor legend below chart — Selected · Cheapest · Average (responsive grid, no overlap) */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-[9.5px]">
        {anchors.map(({ idx, label, color, kind }) => (
          <div key={kind} className="flex items-center gap-1.5 min-w-0">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="min-w-0">
              <div className="text-muted-foreground font-medium leading-none truncate">{label}</div>
              <div className="text-foreground font-bold tabular-nums leading-none mt-0.5">
                {fmtCompact(values[idx])}
              </div>
            </div>
          </div>
        ))}
        {/* Always show Average as 3rd legend column */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/60" />
          <div className="min-w-0">
            <div className="text-muted-foreground font-medium leading-none truncate">Average</div>
            <div className="text-foreground font-bold tabular-nums leading-none mt-0.5">
              {fmtCompact(avg)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function verdictPill(verdict?: string) {
  switch (verdict) {
    case "great_deal":
      return { label: "Below typical", cls: "bg-success/10 text-success dark:bg-success/50/15 dark:text-success" };
    case "fair":
      return { label: "Typical price", cls: "bg-info/10 text-info dark:bg-info/50/15 dark:text-info" };
    case "above_average":
      return { label: "Above typical", cls: "bg-warning/10 text-warning dark:bg-warning/50/15 dark:text-warning" };
    default:
      return null;
  }
}

function trendChip(dir?: string, pct?: number) {
  if (typeof pct === "number" && pct !== 0) {
    const up = pct > 0;
    return (
      <span className={cn(
        "text-[10px] font-bold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md",
        up ? "text-warning bg-warning/10 dark:text-warning dark:bg-warning/50/15"
           : "text-success bg-success/10 dark:text-success dark:bg-success/50/15"
      )}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}{pct}%
      </span>
    );
  }
  if (dir === "up") return <TrendingUp className="h-3.5 w-3.5 text-danger0" />;
  if (dir === "down") return <TrendingDown className="h-3.5 w-3.5 text-success0" />;
  if (dir === "stable") return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  return null;
}

function openCrispChat() {
  const w = window as any;
  try {
    if (!Array.isArray(w.$crisp)) w.$crisp = [];

    // Always ensure the launcher is visible.
    w.$crisp.push(["do", "chat:show"]);

    // Crisp queues "do" actions before boot, but `chat:open` is sometimes
    // ignored if pushed too early. Retry a few times until the SDK reports
    // ready (window.$crisp.is is defined once boot completes).
    const tryOpen = (attempt = 0) => {
      try {
        w.$crisp.push(["do", "chat:open"]);
      } catch { /* ignore */ }
      // If the SDK exposes `is` (helper), it's booted — done.
      if (typeof w.$crisp?.is === "function") return;
      if (attempt < 10) setTimeout(() => tryOpen(attempt + 1), 250);
    };
    tryOpen();
    return;
  } catch {
    /* fall through to mailto fallback */
  }
  // Fallback if Crisp is fully unavailable: open the user's mail client.
  window.location.href = "mailto:support@travelvela.com?subject=Flight%20support";
}

export const B2CRightInsightsPanel = ({
  currencySymbol,
  currencyCode,
  cheapestPrice,
  origin,
  destination,
  departDate,
  insight,
  smartTip,
  airlineHighlight,
  onPickDate,
}: Props) => {
  const { convertFromSource } = useCurrency();
  const cheapest = cheapestPrice || 0;
  const [cheaperDates, setCheaperDates] = useState<CheaperDate[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [cacheTrend, setCacheTrend] = useState<{ values: number[]; dates: string[]; todayValue: number; verdict: "great_deal" | "fair" | "above_average"; direction: "up" | "down" | "stable" } | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  // Track current search → recents (so other routes appear when user changes search)
  useEffect(() => {
    if (origin && destination && cheapest > 0) {
      pushRecentSearch({ from: origin, to: destination, date: departDate || undefined, price: cheapest, ts: Date.now() });
    }
    setRecent(loadRecentSearches(origin, destination));
  }, [origin, destination, departDate, cheapest]);

  // Listen for backfill completion → re-pull cheaper dates from cache
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.from === origin && detail.to === destination) {
        setRefreshTick((t) => t + 1);
      }
    };
    window.addEventListener("flight-price-grid:updated", handler as EventListener);
    return () => window.removeEventListener("flight-price-grid:updated", handler as EventListener);
  }, [origin, destination]);

  // Fetch cheaper-date data — prioritises real user-search history (flight_price_trends),
  // falls back to flight_price_cache. Window widened to ±7 days for stronger savings,
  // with sanity caps and dedup so we don't show three near-identical days.
  useEffect(() => {
    let cancelled = false;
    if (!origin || !destination || !departDate || !cheapest) {
      setCheaperDates([]);
      return;
    }
    const run = async () => {
      try {
        const base = parseISO(departDate);
        const start = format(addDays(base, -7), "yyyy-MM-dd");
        const end = format(addDays(base, 7), "yyyy-MM-dd");

        const [trendsRes, cacheRes] = await Promise.all([
          supabase
            .from("flight_price_trends")
            .select("depart_date, min_price, currency, sample_date")
            .eq("from_code", origin)
            .eq("to_code", destination)
            .gte("depart_date", start)
            .lte("depart_date", end)
            .gte("sample_date", format(addDays(new Date(), -30), "yyyy-MM-dd"))
            .order("sample_date", { ascending: false }),
          supabase
            .from("flight_price_cache")
            .select("travel_date, lowest_price, currency, source")
            .eq("from_code", origin)
            .eq("to_code", destination)
            .gte("travel_date", start)
            .lte("travel_date", end)
            // TRUST REAL SOURCES ONLY — exclude AI-estimate filler rows
            .not("source", "eq", "ai-estimate")
            .order("travel_date", { ascending: true }),
        ]);
        if (cancelled) return;

        // ===== REAL-DATA-ONLY + CONVERT-TO-DISPLAY-CURRENCY =====
        // flight_price_trends = real user searches (always trusted, freshest signal).
        // flight_price_cache = filtered above to exclude `ai-estimate`.
        const trendRows = (trendsRes.data || []).filter((r: any) => (r.min_price ?? 0) > 0);

        const perDay = new Map<string, number>();
        const perDaySource = new Map<string, "real" | "cache">();
        // Trend rows: keep the LOWEST converted price per day (handles dup rows
        // with different currencies — e.g. both USD and INR samples for the same day).
        trendRows.forEach((r: any) => {
          const d = String(r.depart_date);
          const rowCurrency = String(r.currency || "USD").toUpperCase();
          const v = convertFromSource(Number(r.min_price), rowCurrency);
          if (v <= 0) return;
          if (cheapest > 0 && (v > cheapest * 5 || v < cheapest * 0.2)) return; // sanity filter
          const existing = perDay.get(d);
          if (existing === undefined || v < existing) {
            perDay.set(d, v);
            perDaySource.set(d, "real");
          }
        });
        // Cache fallback — only fill days the trends didn't cover; keep lowest per day.
        (cacheRes.data || []).forEach((r: any) => {
          const d = String(r.travel_date);
          if (perDaySource.get(d) === "real") return; // trends already won this day
          if ((r.lowest_price ?? 0) <= 0) return;
          const rowCurrency = String(r.currency || "USD").toUpperCase();
          const v = convertFromSource(Number(r.lowest_price), rowCurrency);
          if (v <= 0) return;
          if (cheapest > 0 && (v > cheapest * 5 || v < cheapest * 0.2)) return;
          const existing = perDay.get(d);
          if (existing === undefined || v < existing) {
            perDay.set(d, v);
            perDaySource.set(d, "cache");
          }
        });

        // RAW MODE: show real FX-converted prices from cache. No anchor/rescale —
        // any day cheaper than the live `cheapest` (today's search) qualifies.
        const dowName = (d: Date) =>
          ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
        const baseDow = base.getDay();
        const noteFor = (d: Date, offset: number): string | undefined => {
          const dow = d.getDay();
          if ((dow === 2 || dow === 3) && baseDow !== dow) return `${dowName(d)} · usually cheaper`;
          if (dow === 5 || dow === 6) return `${dowName(d)} · weekend`;
          if (offset < 0) return `${Math.abs(offset)}d earlier`;
          return `${offset}d later`;
        };

        const ranked = Array.from(perDay.entries())
          .filter(([d]) => d !== departDate)
          .map(([d, v]) => ({ date: d, price: Math.round(v) }))
          .filter((x) => x.price > 0 && x.price < cheapest)
          .sort((a, b) => a.price - b.price);

        // DEBUG: log what we have so we can diagnose empty Cheaper Dates
        // eslint-disable-next-line no-console
        console.log("[B2CRightInsightsPanel] Cheaper Dates pipeline", {
          origin, destination, departDate, cheapest,
          perDayEntries: Array.from(perDay.entries()),
          rankedCount: ranked.length,
          ranked,
        });

        // Dedup: don't pick two dates within 1 day of each other
        const picked: typeof ranked = [];
        for (const cand of ranked) {
          const tooClose = picked.some(
            (p) => Math.abs(parseISO(p.date).getTime() - parseISO(cand.date).getTime()) <= 1 * 86400000
          );
          if (!tooClose) picked.push(cand);
          if (picked.length >= 3) break;
        }

        const converted: CheaperDate[] = picked.map((x) => {
          const d = parseISO(x.date);
          const offset = Math.round((d.getTime() - base.getTime()) / 86400000);
          return {
            date: x.date,
            label: format(d, "EEE, dd MMM"),
            price: x.price,
            save: Math.round(cheapest - x.price),
            note: noteFor(d, offset),
            source: perDaySource.get(x.date) || "cache",
          };
        });
        setCheaperDates(converted);
      } catch {
        if (!cancelled) setCheaperDates([]);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [origin, destination, departDate, cheapest, refreshTick, currencyCode]);

  // Fetch ±14 day price trend from flight_price_cache for the chart.
  // Same rescaling: anchor today's value to live `cheapest` and scale all other days proportionally.
  useEffect(() => {
    let cancelled = false;
    if (!origin || !destination || !departDate) {
      setCacheTrend(null);
      return;
    }
    const run = async () => {
      try {
        const base = parseISO(departDate);
        // Tighten window to ±7 days — the user's real decision range.
        const start = format(addDays(base, -7), "yyyy-MM-dd");
        const end = format(addDays(base, 7), "yyyy-MM-dd");

        // Pull BOTH real user-search trends (rich signal) and date-grid cache (fallback).
        // flight_price_trends = every real search recorded by unified-flight-search.
        const [trendsRes, cacheRes] = await Promise.all([
          supabase
            .from("flight_price_trends")
            .select("depart_date, min_price, currency, sample_date")
            .eq("from_code", origin)
            .eq("to_code", destination)
            .gte("depart_date", start)
            .lte("depart_date", end)
            .gte("sample_date", format(addDays(new Date(), -30), "yyyy-MM-dd"))
            .order("sample_date", { ascending: false }),
          supabase
            .from("flight_price_cache")
            .select("travel_date, lowest_price, currency, source")
            .eq("from_code", origin)
            .eq("to_code", destination)
            .gte("travel_date", start)
            .lte("travel_date", end)
            // TRUST REAL SOURCES ONLY — exclude AI-estimate filler rows
            .not("source", "eq", "ai-estimate")
            .order("travel_date", { ascending: true }),
        ]);
        if (cancelled) return;

        // ===== REAL-DATA-ONLY + CONVERT-TO-DISPLAY-CURRENCY =====
        // flight_price_trends = real user searches (highest priority, overrides cache).
        // flight_price_cache = real provider snapshots only (ai-estimate filtered out at query level).
        const trendRows = (trendsRes.data || []).filter((r: any) => (r.min_price ?? 0) > 0);
        const perDay = new Map<string, number>();
        const perDaySource = new Map<string, "real" | "cache">();
        // Trend rows: keep the LOWEST converted price per day (handles dup currency rows).
        trendRows.forEach((r: any) => {
          const d = String(r.depart_date);
          const rowCurrency = String(r.currency || "USD").toUpperCase();
          const converted = convertFromSource(Number(r.min_price), rowCurrency);
          if (converted <= 0) return;
          if (cheapest > 0 && (converted > cheapest * 5 || converted < cheapest * 0.2)) return;
          const existing = perDay.get(d);
          if (existing === undefined || converted < existing) {
            perDay.set(d, converted);
            perDaySource.set(d, "real");
          }
        });
        // Cache fallback — only fill days the trends didn't cover; keep lowest per day.
        (cacheRes.data || []).forEach((r: any) => {
          const d = String(r.travel_date);
          if (perDaySource.get(d) === "real") return;
          if ((r.lowest_price ?? 0) <= 0) return;
          const rowCurrency = String(r.currency || "USD").toUpperCase();
          const converted = convertFromSource(Number(r.lowest_price), rowCurrency);
          if (converted <= 0) return;
          if (cheapest > 0 && (converted > cheapest * 5 || converted < cheapest * 0.2)) return;
          const existing = perDay.get(d);
          if (existing === undefined || converted < existing) {
            perDay.set(d, converted);
            perDaySource.set(d, "cache");
          }
        });

        if (perDay.size < 2) { setCacheTrend(null); return; }

        // RAW MODE: today's point uses the LIVE search result (always accurate),
        // every other day uses the real FX-converted cached value (no rescale).
        const sortedRaw = Array.from(perDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const dates = sortedRaw.map((x) => x[0]);
        const values = sortedRaw.map(([d, v]) =>
          d === departDate && cheapest > 0 ? Math.round(cheapest) : Math.round(v)
        );
        const median = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const todayValue = cheapest > 0 ? Math.round(cheapest) : (perDay.get(departDate) ?? median);
        const verdict: "great_deal" | "fair" | "above_average" =
          cheapest && cheapest < median * 0.92 ? "great_deal" :
          cheapest && cheapest > median * 1.1 ? "above_average" : "fair";
        const third = Math.max(1, Math.floor(values.length / 3));
        const firstAvg = values.slice(0, third).reduce((a, b) => a + b, 0) / third;
        const lastAvg = values.slice(-third).reduce((a, b) => a + b, 0) / third;
        const direction: "up" | "down" | "stable" =
          lastAvg > firstAvg * 1.05 ? "up" : lastAvg < firstAvg * 0.95 ? "down" : "stable";
        setCacheTrend({ values, dates, todayValue, verdict, direction });
      } catch {
        if (!cancelled) setCacheTrend(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [origin, destination, departDate, cheapest, refreshTick, currencyCode]);

  // Prefer AI-supplied trend; fallback to cache; final fallback = synthesized from cheapest
  const aiSparkRaw = insight?.trend_sparkline && insight.trend_sparkline.length >= 3 ? insight.trend_sparkline : null;
  const aiTrendDates = insight?.trend_dates || [];
  // RAW MODE: use AI sparkline as-is (already in display currency from edge function).
  // Only override the selected-day point with the live cheapest for accuracy.
  const aiSpark = (() => {
    if (!aiSparkRaw) return null;
    if (!cheapest || cheapest <= 0) return aiSparkRaw;
    let anchorIdx = aiTrendDates.findIndex((d: string) => d === departDate);
    if (anchorIdx < 0) anchorIdx = Math.floor(aiSparkRaw.length / 2);
    return aiSparkRaw.map((v, i) =>
      i === anchorIdx ? Math.round(cheapest) : Math.round(Number(v))
    );
  })();
  // No synthetic trend — only render the chart when we have real AI/cache/trend-store data.
  const trendValues = aiSpark || cacheTrend?.values || null;
  const trendDates = aiTrendDates.length ? aiTrendDates : (cacheTrend?.dates || []);
  const trendDirection = insight?.trend_direction || cacheTrend?.direction;
  const isSyntheticTrend = false;
  const verdict = verdictPill(insight?.price_verdict || cacheTrend?.verdict);
  const headline = insight?.headline?.trim() ||
    (cheapest > 0 ? `Lowest fare from ${currencySymbol}${Math.round(cheapest).toLocaleString()}` : undefined);
  const recommendation = insight?.recommendation?.trim();
  const tip = smartTip?.trim() ||
    (airlineHighlight ? `${airlineHighlight} balances price and comfort on this route.` : "Compare options below to find the best fit for your trip.");
  const showTipCard = !!(headline || recommendation || tip);
  const trustSignals = insight?.trust_signals?.filter(Boolean).slice(0, 3) || [];
  const urgency = insight?.urgency;
  const predictedChange = insight?.predicted_change_pct;
  const bookWindow = insight?.best_book_window?.trim();

  // No synthetic fallback — only show cheaper dates when we have real cache/trend data.
  const displayCheaperDates: CheaperDate[] = cheaperDates;
  const isSyntheticCheaper = false;


  return (
    <aside className="space-y-3">
      {/* Header chip */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-bold text-foreground">Vela AI Insights</span>
        <span className="text-[9px] font-bold tracking-wider bg-primary/15 text-primary rounded px-1.5 py-0.5">BETA</span>
      </div>

      {/* Smart Tip — advisor format with conversational lead + evidence + action */}
      {(insight?.smart_tip || showTipCard) && (
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-fuchsia-500/[0.04] to-card p-3.5 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Vela's Take</div>
                </div>
              </div>
              {insight?.smart_tip ? (
                <AdvisorBlock
                  advisor={insight.smart_tip}
                  variant="tip"
                  onAction={(kind) => {
                    if (kind === "shift_dates") {
                      const el = document.querySelector('[data-price-calendar-trigger]') as HTMLElement | null;
                      el?.click();
                    }
                  }}
                />
              ) : (
                <>
                  {headline && (
                    <div className="text-[12.5px] font-bold text-foreground mb-1 leading-snug">{headline}</div>
                  )}
                  {(recommendation || tip) && (
                    <p className="text-[12px] text-foreground/85 leading-snug">{recommendation || tip}</p>
                  )}
                  {verdict && (
                    <Badge variant="secondary" className={`mt-2 text-[9.5px] font-semibold border-0 ${verdict.cls}`}>
                      {verdict.label}
                    </Badge>
                  )}
                </>
              )}
            </div>
            <img
              src={mascot}
              alt="Vela AI"
              className="h-16 w-16 object-contain shrink-0 -mr-1 -mb-1 drop-shadow-md"
              loading="lazy"
              width={64}
              height={64}
            />
          </div>
        </div>
      )}

      {/* Price Trend chart */}
      {trendValues && (
        <div className="rounded-2xl border border-border/60 bg-card p-3.5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Price Trend</h4>
            {trendChip(trendDirection, predictedChange)}
          </div>
          <p className="text-[10px] text-muted-foreground mb-2.5">
            {trendDirection === "up"
              ? "Prices are likely to increase in 3 days"
              : trendDirection === "down"
                ? "Prices are likely to drop soon"
                : "Prices are stable in the coming days"}
            {!aiSpark && cacheTrend && <span className="ml-1 opacity-60">· cached</span>}
            {isSyntheticTrend && <span className="ml-1 opacity-60">· estimated</span>}
          </p>
          <TrendChart values={trendValues} dates={trendDates} currencySymbol={currencySymbol} selectedDate={departDate} />
          {(typeof predictedChange === "number" && predictedChange !== 0) || bookWindow ? (
            <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground flex-wrap">
              {bookWindow && (
                <span><ClockIcon className="h-3 w-3 inline mr-1" />Best book window: <span className="font-semibold text-foreground/80">{bookWindow}</span></span>
              )}
            </div>
          ) : (
            <p className="text-[10.5px] font-semibold mt-2.5 flex items-center gap-1 text-success dark:text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success/50" />
              {trendDirection === "down" ? "Prices dropping. Good time to book!" :
               trendDirection === "up" ? "Prices rising. Book soon." :
               "Prices stable. Good time to book!"}
            </p>
          )}
        </div>
      )}

      {/* Cheaper / Pricier dates with color-coded cards. Only render the card
          when we actually have something to show — otherwise the header would
          dangle with an empty body. */}
      {displayCheaperDates.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Cheaper Dates
              </h4>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                ± 7 Days
                {isSyntheticCheaper ? (
                  <span className="opacity-60"> · estimated</span>
                ) : displayCheaperDates.some((d) => d.source === "real") ? (
                  <span className="text-success dark:text-success ml-1">· from real searches</span>
                ) : null}
              </div>
            </div>
            {origin && destination && departDate && onPickDate && (
              <PriceCalendarPopover
                origin={origin}
                destination={destination}
                departDate={departDate}
                currencySymbol={currencySymbol}
                currencyCode={currencyCode}
                baselinePrice={cheapest}
                onPickDate={onPickDate}
                trigger={
                  <button
                    className="text-[10.5px] font-semibold text-primary hover:underline inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary/10"
                    aria-label="Open price calendar"
                  >
                    <CalIcon className="h-3 w-3" /> Calendar
                  </button>
                }
              />
            )}
          </div>
          <div className="space-y-1.5">
            {displayCheaperDates.map((d) => (
              <button
                key={d.date}
                onClick={() => onPickDate?.(d.date)}
                className="w-full bg-success/5 dark:bg-success/50/10 border border-success/60 dark:border-success/50/20 hover:bg-success/10 dark:hover:bg-success/50/15 rounded-lg p-2.5 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <CalIcon className="h-3.5 w-3.5 text-success dark:text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{d.label}</span>
                      {d.note && (
                        <span className="text-[9.5px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                          {d.note}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-success dark:text-success font-semibold mt-0.5">
                      Save {currencySymbol}{d.save.toLocaleString()} ({Math.round((d.save / cheapest) * 100)}%)
                    </div>
                  </div>
                  <div className="text-[12px] font-bold text-foreground tabular-nums">
                    {currencySymbol}{d.price.toLocaleString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty-state hint: no cheaper dates found within ±7 days. Surface the
          calendar so users can still explore other dates without a dangling header. */}
      {displayCheaperDates.length === 0 && origin && destination && departDate && onPickDate && (
        <div className="rounded-2xl border border-border/60 bg-card p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Your Date Looks Best
              </h4>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                No cheaper dates found within ±7 days. Explore the full calendar for more options.
              </p>
            </div>
            <PriceCalendarPopover
              origin={origin}
              destination={destination}
              departDate={departDate}
              currencySymbol={currencySymbol}
              currencyCode={currencyCode}
              baselinePrice={cheapest}
              onPickDate={onPickDate}
              trigger={
                <button
                  className="shrink-0 text-[10.5px] font-semibold text-primary hover:underline inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary/10"
                  aria-label="Open price calendar"
                >
                  <CalIcon className="h-3 w-3" /> Calendar
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* Urgency flame card */}
      {urgency && urgency.message && urgency.level !== "low" && (
        <div className={cn(
          "rounded-2xl border p-3 flex items-center gap-2.5",
          urgency.level === "high"
            ? "bg-danger/5 dark:bg-danger/50/10 border-danger/60 dark:border-danger/50/30"
            : "bg-warning/5 dark:bg-warning/50/10 border-warning/60 dark:border-warning/50/30"
        )}>
          <Flame className={cn(
            "h-4 w-4 shrink-0",
            urgency.level === "high" ? "text-danger" : "text-warning"
          )} />
          <div className="text-[11.5px] font-semibold text-foreground">{urgency.message}</div>
        </div>
      )}

      {/* Recently Viewed (from localStorage) */}
      {recent.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Recently Viewed</h4>
          </div>
          <div className="space-y-2">
            {recent.map((r, i) => {
              const dateLabel = r.date ? (() => {
                try { return format(parseISO(r.date), "MMM dd"); } catch { return ""; }
              })() : "";
              return (
                <a
                  key={i}
                  href={`/flights?from=${r.from}&to=${r.to}${r.date ? `&date=${r.date}` : ""}&adults=1&class=Economy`}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Plane className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-bold text-foreground truncate">
                      {r.from} → {r.to}
                    </div>
                    {dateLabel && (
                      <div className="text-[10px] text-muted-foreground">{dateLabel}</div>
                    )}
                  </div>
                  {r.price && (
                    <div className="text-[11px] font-bold text-foreground tabular-nums">
                      {currencySymbol}{Math.round(r.price).toLocaleString()}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Trusted by Travelers */}
      <div className="rounded-2xl border border-border/60 bg-card p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Trusted by Travelers</h4>
        </div>
        <ul className="space-y-1.5 text-[11.5px] text-muted-foreground">
          {(trustSignals.length > 0 ? trustSignals : [
            "Live fares verified before payment",
            "Hand-picked airline partners",
            "24/7 booking support",
          ]).map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-success mt-0.5 font-bold">✓</span>
              <span className="leading-snug">{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Need Help — Crisp chat */}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] p-3.5">
        <div className="flex items-start gap-3 mb-2.5">
          <div className="flex-1">
            <div className="text-[12.5px] font-bold text-foreground">Need Help Deciding?</div>
            <div className="text-[10.5px] text-muted-foreground leading-snug mt-0.5">
              Chat with Vela AI — 24/7 support
            </div>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Headphones className="h-4 w-4 text-primary" />
          </div>
        </div>
        <button
          onClick={openCrispChat}
          className="w-full text-center rounded-lg bg-card border border-border/70 hover:border-primary/40 py-2 text-[11.5px] font-bold text-primary transition-colors"
        >
          Chat Now
        </button>
      </div>
    </aside>
  );
};
