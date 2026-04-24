import { useEffect, useMemo, useState } from "react";
import { Calendar as CalIcon, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  origin: string;
  destination: string;
  departDate: string; // yyyy-MM-dd
  currencySymbol: string;
  currencyCode?: string;
  baselinePrice: number;
  onPickDate: (date: string) => void;
  trigger: React.ReactNode;
}

interface PriceMap { [date: string]: number }

const pickTrustedDailyPrice = (values: number[]): number | undefined => {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!clean.length) return undefined;
  if (clean.length <= 2) return clean[0];
  const median = clean[Math.floor(clean.length / 2)];
  const floor = median * 0.5;
  const ceiling = median * 1.8;
  const clustered = clean.filter((v) => v >= floor && v <= ceiling);
  return (clustered.length ? clustered : clean)[0];
};

export const PriceCalendarPopover = ({
  origin, destination, departDate, currencySymbol, currencyCode, baselinePrice, onPickDate, trigger,
}: Props) => {
  const { convertFromSource } = useCurrency();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<PriceMap>({});
  const [isEmpty, setIsEmpty] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => parseISO(departDate));

  useEffect(() => {
    if (!open || !origin || !destination) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        // Sky Scrapper's getPriceCalendar populates ~12 months of cache in a single
        // bootstrap call. Widen the calendar query to match — otherwise navigating
        // past the ±30 day window around the depart date shows blank cells even
        // though the data exists. Anchor the start at the EARLIER of (depart-30)
        // and the start of the currently visible month.
        const base = parseISO(departDate);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const earliestAnchor = startOfMonth(viewMonth) < addDays(base, -30)
          ? startOfMonth(viewMonth)
          : addDays(base, -30);
        const startDate = earliestAnchor < today ? today : earliestAnchor;
        // 14 months forward covers the full Sky Scrapper window plus user navigation.
        const endDate = addDays(base, 365 + 30);
        const start = format(startDate, "yyyy-MM-dd");
        const end = format(endDate, "yyyy-MM-dd");

        // Pull real user-search history first, fall back to date-grid cache.
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
            .not("source", "eq", "ai-estimate"),
        ]);
        if (cancelled) return;

        const rawMap: PriceMap = {};
        const sourceMap: Record<string, "real" | "cache"> = {};
        const trendCandidates: Record<string, number[]> = {};
        // Real user-search trends — keep the LOWEST converted price per day
        // (handles dup currency rows like both USD and INR for the same date).
        (trendsRes.data || []).forEach((r: any) => {
          const d = String(r.depart_date);
          if ((r.min_price ?? 0) <= 0) return;
          const converted = convertFromSource(Number(r.min_price), String(r.currency || "USD").toUpperCase());
          if (converted <= 0) return;
          trendCandidates[d] ||= [];
          trendCandidates[d].push(converted);
        });
        Object.entries(trendCandidates).forEach(([d, values]) => {
          const trusted = pickTrustedDailyPrice(values);
          if (!trusted) return;
          rawMap[d] = trusted;
          sourceMap[d] = "real";
        });
        // Cache fallback — only fill days the trends didn't cover.
        (cacheRes.data || []).forEach((r: any) => {
          if (!r.travel_date || (r.lowest_price ?? 0) <= 0) return;
          const d = r.travel_date as string;
          if (sourceMap[d] === "real") return;
          const converted = convertFromSource(Number(r.lowest_price), String(r.currency || "USD").toUpperCase());
          if (converted <= 0) return;
          const existing = rawMap[d];
          if (existing === undefined || converted < existing) {
            rawMap[d] = converted;
            sourceMap[d] = "cache";
          }
        });

        // RAW MODE: show real FX-converted prices as-is. Only the selected day
        // is overridden with the live baseline (since today's search result is the
        // freshest truth for that specific date).
        const map: PriceMap = { ...rawMap };
        if (baselinePrice > 0) {
          map[departDate] = Math.round(baselinePrice);
        }

        setPrices(map);
        setIsEmpty(Object.keys(map).length === 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    // Re-run when backfill completes
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.from === origin && detail.to === destination) run();
    };
    window.addEventListener("flight-price-grid:updated", handler as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("flight-price-grid:updated", handler as EventListener);
    };
    // viewMonth in deps so navigating to a far-future month re-anchors the
    // query window if the user paged outside the initial range.
  }, [open, origin, destination, departDate, baselinePrice, viewMonth]);

  // Reference price for color coding — prefer live baseline so coloring stays consistent with search results.
  const baseline = baselinePrice > 0 ? baselinePrice : (prices[departDate] ?? 0);
  const today = useMemo(() => new Date(new Date().toDateString()), []);
  const selected = useMemo(() => parseISO(departDate), [departDate]);

  const days = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const leadingBlanks = getDay(startOfMonth(viewMonth));

  const colorFor = (price?: number): { bg: string; text: string; label: string } => {
    if (!price || !baseline) return { bg: "", text: "text-muted-foreground", label: "" };
    const pct = (price - baseline) / baseline;
    if (pct <= -0.1) return { bg: "bg-success/10 dark:bg-success/50/20", text: "text-success dark:text-success", label: "low" };
    if (pct <= 0.05) return { bg: "bg-info/10 dark:bg-info/50/15", text: "text-info dark:text-info", label: "fair" };
    if (pct <= 0.2) return { bg: "bg-warning/10 dark:bg-warning/50/15", text: "text-warning dark:text-warning", label: "high" };
    return { bg: "bg-danger/10 dark:bg-danger/50/15", text: "text-danger dark:text-danger", label: "peak" };
  };

  const fmtPrice = (p: number) => {
    if (p >= 1000) return `${currencySymbol}${(p / 1000).toFixed(p >= 10000 ? 0 : 1)}k`;
    return `${currencySymbol}${Math.round(p)}`;
  };

  const handlePick = (d: Date) => {
    if (d < today) return;
    const iso = format(d, "yyyy-MM-dd");
    onPickDate(iso);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 pointer-events-auto" align="end" side="top">
        <div className="p-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-[13px] font-bold text-foreground inline-flex items-center gap-1.5">
              <CalIcon className="h-3.5 w-3.5 text-primary" />
              {format(viewMonth, "MMMM yyyy")}
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <button
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1 text-[10.5px] text-muted-foreground">
            {baseline > 0
              ? `Lowest cached fare per day vs ${currencySymbol}${Math.round(baseline).toLocaleString()} baseline`
              : "Lowest cached fare per day"}
          </div>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-[9.5px] font-semibold text-muted-foreground text-center uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const isPast = d < today;
              const price = prices[iso];
              const c = colorFor(price);
              const isSel = isSameDay(d, selected);
              return (
                <button
                  key={iso}
                  disabled={isPast}
                  onClick={() => handlePick(d)}
                  className={cn(
                    "aspect-square rounded-md flex flex-col items-center justify-center text-[10px] font-medium transition-all",
                    "hover:ring-2 hover:ring-primary/40",
                    c.bg,
                    isSel && "ring-2 ring-primary shadow-sm",
                    isPast && "opacity-30 cursor-not-allowed hover:ring-0",
                    !price && !isPast && "bg-muted/30 text-muted-foreground/60",
                  )}
                  title={price ? `${format(d, "EEE, dd MMM")} · ${currencySymbol}${Math.round(price).toLocaleString()}` : format(d, "EEE, dd MMM")}
                >
                  <span className={cn("text-[10.5px] font-semibold leading-none", isSel && "text-primary")}>
                    {format(d, "d")}
                  </span>
                  {price ? (
                    <span className={cn("text-[8.5px] font-bold leading-none mt-0.5 tabular-nums", c.text)}>
                      {fmtPrice(price)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-success/10 dark:bg-success/50/20" /> Low
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-info/10 dark:bg-info/50/15" /> Fair
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-warning/10 dark:bg-warning/50/15" /> High
            </div>
            <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-danger/10 dark:bg-danger/50/15" /> Peak
            </div>
          </div>
          {!loading && isEmpty && (
            <div className="mt-3 text-[10.5px] text-muted-foreground text-center">
              No cached prices yet — pick any date to search live.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PriceCalendarPopover;
