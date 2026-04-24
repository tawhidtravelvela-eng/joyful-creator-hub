import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeroSearchBar from "./HeroSearchBar";
import SortPillRow, { buildDefaultPills, type SortMode } from "./SortPillRow";
import FiltersPanel from "./FiltersPanel";
import AirlineStrip from "./AirlineStrip";
import PremiumFareCard from "./PremiumFareCard";
import RightInsightsPanel from "./RightInsightsPanel";
import StickyCompareBar from "./StickyCompareBar";
import type { B2BFareRow, B2BFiltersState, B2BSearchContext } from "./types";
import { Button } from "@/components/ui/button";
import { Loader2, SearchX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { flightToFareRow, type UnifiedFlight } from "./flightToFareRow";
import { toast } from "sonner";
import { useB2BCommissions } from "@/hooks/useB2BCommissions";
import { hydrateFlightsFromWire } from "@/lib/flightWireAdapter";

const defaultFilters: B2BFiltersState = {
  airlines: [],
  stops: [],
  refundableOnly: false,
  baggageOnly: false,
  layoverMaxMinutes: 720,
  priceRange: [0, Number.MAX_SAFE_INTEGER],
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", CNY: "¥", INR: "₹",
  AED: "د.إ", MYR: "RM", SGD: "S$", THB: "฿", SAR: "﷼",
  KWD: "د.ك", QAR: "﷼", OMR: "﷼", BHD: ".د.ب", JPY: "¥",
  KRW: "₩", PHP: "₱", IDR: "Rp", VND: "₫", LKR: "Rs",
};
const symbolFor = (cur?: string) => CURRENCY_SYMBOLS[cur || "USD"] || (cur ? cur + " " : "$");

const parseDurationMin = (s: string) => {
  const m = s.match(/(\d+)h(?:\s*(\d+)m)?/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2] || "0") : 0;
};

interface Props {
  ctx?: B2BSearchContext;
  rows?: B2BFareRow[];
  onModify?: () => void;
}

export const B2BFlightResultsView = ({ ctx, rows, onModify }: Props) => {
  const navigate = useNavigate();
  const searchCtx = ctx;
  const { rules: commissionRules, ait: aitSettings } = useB2BCommissions();
  const [filters, setFilters] = useState<B2BFiltersState>(defaultFilters);
  const [sort, setSort] = useState<SortMode>("best");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [filtersVisible, setFiltersVisible] = useState(true);

  const [liveRows, setLiveRows] = useState<B2BFareRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!ctx || (rows && rows.length > 0)) return;
    if (!ctx.origin || !ctx.destination || !ctx.departDate) return;

    let cancelled = false;
    setLoading(true);
    setSearchError(null);

    const cabinMap: Record<string, string> = {
      Economy: "Economy",
      "Premium Economy": "PremiumEconomy",
      Business: "Business",
      First: "First",
    };

    const body: any = {
      mode: "search",
      from: ctx.origin,
      to: ctx.destination,
      departDate: ctx.departDate,
      returnDate: (ctx as any).returnDate || null,
      adults: (ctx as any).adults || 1,
      children: (ctx as any).children || 0,
      infants: (ctx as any).infants || 0,
      cabinClass: cabinMap[ctx.cabin as string] || ctx.cabin || "Economy",
    };

    supabase.functions
      .invoke("unified-flight-search", { body })
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error || !data?.success) {
          const msg = error?.message || data?.error || "Search failed";
          setSearchError(msg);
          setLiveRows([]);
          toast.error(`Search failed: ${msg}`);
          return;
        }
        const flights: UnifiedFlight[] = hydrateFlightsFromWire(data.flights || []) as UnifiedFlight[];
        setLiveRows(flights.map(flightToFareRow));
      })
      .catch((e: any) => {
        if (cancelled) return;
        setSearchError(e?.message || "Search failed");
        setLiveRows([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [ctx, rows]);

  const allRows: B2BFareRow[] = rows && rows.length > 0
    ? rows
    : liveRows ?? [];
  const CURRENCY_SYMBOL = symbolFor(allRows[0]?.currency);

  useEffect(() => {
    if (allRows.length === 0) return;
    const fares = allRows.map(r => r.sellFare).filter(n => Number.isFinite(n) && n > 0);
    if (!fares.length) return;
    const min = Math.floor(Math.min(...fares));
    const max = Math.ceil(Math.max(...fares));
    setFilters(prev => {
      const isDefault = prev.priceRange[0] === 0 && prev.priceRange[1] === Number.MAX_SAFE_INTEGER;
      if (!isDefault) return prev;
      return { ...prev, priceRange: [min, max] };
    });
  }, [allRows]);

  const airlines = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number; price: number }>();
    allRows.forEach(r => {
      const e = map.get(r.airline) || { code: r.airline, name: r.airlineName, count: 0, price: r.sellFare };
      e.count++;
      e.price = Math.min(e.price, r.sellFare);
      map.set(r.airline, e);
    });
    const arr = Array.from(map.values()).sort((a, b) => a.price - b.price);
    return arr.map((a, i) => ({ ...a, tag: i === 0 ? "cheapest" as const : i === 1 ? "best_value" as const : undefined }));
  }, [allRows]);

  const filtered = useMemo(() => allRows.filter(r => {
    if (filters.airlines.length && !filters.airlines.includes(r.airline)) return false;
    if (filters.stops.length) {
      const key = r.stops === 0 ? "0" : r.stops === 1 ? "1" : "2+";
      if (!filters.stops.includes(key as any)) return false;
    }
    if (filters.refundableOnly && !r.isRefundable) return false;
    if (filters.baggageOnly && (!r.baggageCheckin || r.baggageCheckin === "Not included" || r.baggageCheckin === "")) return false;
    if (r.sellFare < filters.priceRange[0] || r.sellFare > filters.priceRange[1]) return false;
    return true;
  }), [allRows, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "cheapest":  arr.sort((a, b) => a.sellFare - b.sellFare); break;
      case "fastest":   arr.sort((a, b) => parseDurationMin(a.durationTotal) - parseDurationMin(b.durationTotal)); break;
      case "best":
      default:
        arr.sort((a, b) => {
          const score = (r: typeof a) =>
            r.sellFare / 100 + parseDurationMin(r.durationTotal) / 60
            - (r.isRefundable ? 2 : 0)
            - (r.stops === 0 ? 4 : 0);
          return score(a) - score(b);
        });
    }
    return arr;
  }, [filtered, sort]);

  const cheapest = useMemo(() => sorted.length ? Math.min(...sorted.map(r => r.sellFare)) : 0, [sorted]);
  const fastest = useMemo(() => sorted.length ? Math.min(...sorted.map(r => parseDurationMin(r.durationTotal))) : 0, [sorted]);
  const cheapestId = sorted.find(r => r.sellFare === cheapest)?.id;
  const fastestId = sorted.find(r => parseDurationMin(r.durationTotal) === fastest)?.id;
  const aiPickId = sorted[0]?.id;

  const compareRows = useMemo(() => sorted.filter(r => compareIds.includes(r.id)), [sorted, compareIds]);

  const pills = buildDefaultPills({
    cheapestPrice: cheapest,
    cheapestDuration: sorted.find(r => r.sellFare === cheapest)?.durationTotal || "—",
    fastestPrice: sorted.find(r => parseDurationMin(r.durationTotal) === fastest)?.sellFare || cheapest,
    fastestDuration: sorted.find(r => parseDurationMin(r.durationTotal) === fastest)?.durationTotal || "—",
    bestPrice: sorted.find(r => r.id === aiPickId)?.sellFare || cheapest,
    bestDuration: sorted.find(r => r.id === aiPickId)?.durationTotal || "—",
  });

  const appliedCount = filters.airlines.length + filters.stops.length +
    (filters.refundableOnly ? 1 : 0) + (filters.baggageOnly ? 1 : 0);

  const handleSelect = (rowId: string) => {
    const row = sorted.find(r => r.id === rowId);
    if (!row || !row._raw) {
      toast.error("Could not load fare details");
      return;
    }
    const adults = (searchCtx as any)?.adults || 1;
    const children = (searchCtx as any)?.children || 0;
    const infants = (searchCtx as any)?.infants || 0;
    navigate(
      `/flights/${row.id}/book?adults=${adults}&children=${children}&infants=${infants}`,
      { state: { flight: row._raw } }
    );
  };

  if (!searchCtx) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <SearchX className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-[14px] text-foreground font-semibold">No search yet</div>
        <div className="text-xs text-muted-foreground max-w-sm">
          Start a flight search from the Search &amp; Book panel to see live B2B fares here.
        </div>
        {onModify && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onModify}>
            New search
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <HeroSearchBar ctx={searchCtx} onModify={onModify} />

      <SortPillRow
        active={sort}
        onChange={setSort}
        pills={pills}
        total={sorted.length}
        currencySymbol={CURRENCY_SYMBOL}
        middleSlot={
          <AirlineStrip
            airlines={airlines.map((a) => {
              const carrierRows = sorted.filter((r) => r.airline === a.code);
              if (!carrierRows.length) return { code: a.code, name: a.name, count: a.count, price: a.price };
              const carrierIds = new Set(carrierRows.map((r) => r.id));
              let tag: "cheapest" | "best" | "fastest" | undefined;
              if (aiPickId && carrierIds.has(aiPickId)) tag = "best";
              else if (cheapestId && carrierIds.has(cheapestId)) tag = "cheapest";
              else if (fastestId && carrierIds.has(fastestId)) tag = "fastest";
              return { code: a.code, name: a.name, count: a.count, price: a.price, tag };
            })}
            selected={filters.airlines}
            onToggle={(code) =>
              setFilters((prev) => ({
                ...prev,
                airlines: prev.airlines.includes(code)
                  ? prev.airlines.filter((c) => c !== code)
                  : [...prev.airlines, code],
              }))
            }
            currencySymbol={CURRENCY_SYMBOL}
          />
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3">
          <div className="lg:sticky lg:top-4">
            <FiltersPanel
              filters={filters}
              onChange={setFilters}
              airlines={airlines}
              onReset={() => setFilters(defaultFilters)}
              currencySymbol={CURRENCY_SYMBOL}
              visible={filtersVisible}
              onToggleVisible={() => setFiltersVisible(v => !v)}
              appliedCount={appliedCount}
            />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 space-y-3">
          {loading ? (
            <div className="bg-card border border-border/60 rounded-2xl p-10 text-center flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="text-[14px] text-foreground font-semibold">Searching live fares…</div>
              <div className="text-xs text-muted-foreground">Querying connected inventory</div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="bg-card border border-border/60 rounded-2xl p-10 text-center">
              <div className="text-[14px] text-foreground font-semibold mb-1">
                {searchError
                  ? "Couldn't fetch live fares"
                  : allRows.length === 0
                    ? "No flights found for this route"
                    : "No flights match your filters"}
              </div>
              {searchError && (
                <div className="text-xs text-muted-foreground mb-2">{searchError}</div>
              )}
              {allRows.length === 0 ? (
                <Button variant="link" onClick={onModify}>Modify search</Button>
              ) : (
                <Button variant="link" onClick={() => setFilters(defaultFilters)}>Reset filters</Button>
              )}
            </div>
          ) : sorted.map(r => (
            <PremiumFareCard
              key={r.id}
              row={r}
              isAiPick={r.id === aiPickId}
              isCheapest={r.id === cheapestId}
              isFastest={r.id === fastestId}
              cheapestSell={cheapest}
              currencySymbol={CURRENCY_SYMBOL}
              onSelect={handleSelect}
              onCompareToggle={(id, on) => setCompareIds(ids => on ? [...ids, id].slice(-3) : ids.filter(x => x !== id))}
              inCompare={compareIds.includes(r.id)}
              commissionRules={commissionRules}
              aitSettings={aitSettings}
            />
          ))}
        </div>

        <div className="col-span-12 lg:col-span-3">
          <div className="lg:sticky lg:top-4">
            <RightInsightsPanel rows={sorted} ctx={searchCtx} currencySymbol={CURRENCY_SYMBOL} />
          </div>
        </div>
      </div>

      <StickyCompareBar
        rows={compareRows}
        onRemove={(id) => setCompareIds(ids => ids.filter(x => x !== id))}
        onClear={() => setCompareIds([])}
        onCompare={() => {}}
        currencySymbol={CURRENCY_SYMBOL}
      />
    </div>
  );
};

export default B2BFlightResultsView;
