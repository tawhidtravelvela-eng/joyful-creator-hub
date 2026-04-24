import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Sparkles, Luggage, Briefcase, RefreshCw, Tag, Plane, MapPin, AlertTriangle,
  Flame, Clock, Star, Shuffle, ArrowRight,
} from "lucide-react";
import type { B2BFareRow } from "./types";
import { computeFareBreakdown, type CommissionRuleLite, type AitSettings } from "@/lib/b2bFareBreakdown";

interface Props {
  row: B2BFareRow;
  isAiPick?: boolean;
  isCheapest?: boolean;
  isFastest?: boolean;
  aiRationale?: string;
  bookedToday?: number;
  cheapestSell?: number;
  currencySymbol: string;
  onSelect: (id: string) => void;
  onCompareToggle: (id: string, on: boolean) => void;
  inCompare: boolean;
  commissionRules?: CommissionRuleLite[];
  aitSettings?: AitSettings | null;
}

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
  catch { return "--:--"; }
};
const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }); }
  catch { return ""; }
};
const fmtTtl = (mins: number) => {
  if (mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return `${h}h${m ? ` ${m}m` : ""}`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

const TabButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className={cn(
      "px-3.5 py-2.5 text-[12px] font-semibold transition-colors relative whitespace-nowrap",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    )}>
    {children}
    {active && <span className="absolute -bottom-px left-2 right-2 h-0.5 bg-primary rounded-full" />}
  </button>
);

export const PremiumFareCard = ({
  row, isAiPick, isCheapest, isFastest, aiRationale, bookedToday,
  cheapestSell, currencySymbol, onSelect, onCompareToggle, inCompare,
  commissionRules, aitSettings,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"flight" | "rules" | "baggage" | "fare">("flight");

  const savings = cheapestSell && row.sellFare < cheapestSell ? cheapestSell - row.sellFare : null;
  const breakdown = computeFareBreakdown(row, commissionRules || [], aitSettings || null);
  const layoverIatas = row.layovers.map(l => l.airport);
  const showTtl = row.ttlMinutes > 0;
  const ttlClass = !showTtl ? "text-muted-foreground"
    : row.ttlMinutes <= 30 ? "text-danger dark:text-danger font-bold"
    : row.ttlMinutes <= 180 ? "text-warning dark:text-warning font-semibold"
    : "text-foreground";

  return (
    <article className={cn(
      "relative rounded-2xl bg-card overflow-hidden transition-all",
      "shadow-[0_1px_3px_-1px_hsl(var(--foreground)/0.05)] hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.18)]",
      isAiPick
        ? "border-2 border-primary ring-2 ring-primary/15"
        : "border border-border/60 hover:border-primary/30",
    )}>
      {isAiPick && (
        <div className="bg-gradient-to-r from-primary/[0.05] via-primary/[0.10] to-transparent border-b border-primary/15 px-4 py-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-primary uppercase tracking-wider bg-primary/15 px-2.5 py-1 rounded-md">
            <Sparkles className="h-3 w-3" /> AI Pick
          </span>
          <span className="text-[12.5px] font-semibold text-foreground">Best Balance of Price, Duration &amp; Comfort</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-12 gap-4">
          {/* Left: airline + route + fare meta */}
          <div className="col-span-12 lg:col-span-9 space-y-3">
            {/* Airline header */}
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                <img src={`https://pics.avs.io/64/64/${row.airline}.png`} alt={row.airlineName}
                  className="w-8 h-8 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[15px] font-bold text-foreground tracking-tight">{row.airlineName}</span>
                  {row.isPreferredAirline && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success dark:text-success bg-success/10 dark:bg-success/50/15 px-2 py-0.5 rounded-md">
                      <Star className="h-2.5 w-2.5 fill-current" /> Preferred
                    </span>
                  )}
                  {isCheapest && !isAiPick && (
                    <span className="text-[10px] font-bold text-warning dark:text-warning bg-warning/10 dark:bg-warning/50/15 px-2 py-0.5 rounded-md">Cheapest</span>
                  )}
                  {isFastest && !isAiPick && (
                    <span className="text-[10px] font-bold text-info dark:text-info bg-info/10 dark:bg-info/50/15 px-2 py-0.5 rounded-md">Fastest</span>
                  )}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  <span className="font-mono">{row.flightNumberSummary}</span>
                  {row.segments[0]?.aircraft ? <> · {row.segments[0].aircraft}</> : <> · {row.cabin}</>}
                </div>
              </div>
            </div>

            {/* Times / route visualisation */}
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 mt-1">
              <div className="text-left">
                <div className="text-2xl font-extrabold tabular-nums leading-none text-foreground">{fmtTime(row.departure)}</div>
                <div className="text-[11px] font-semibold text-foreground/80 mt-1.5">{row.origin}</div>
              </div>
              <div className="flex flex-col items-center gap-1.5 px-2">
                <div className="text-[11px] text-foreground font-semibold tabular-nums">{row.durationTotal}</div>
                <div className="relative w-full h-px bg-border">
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                  {layoverIatas.map((c, i) => (
                    <div key={i} className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-warning/50"
                      style={{ left: `${((i + 1) / (layoverIatas.length + 1)) * 100}%`, transform: "translate(-50%, -50%)" }} />
                  ))}
                </div>
                <div className="text-[11px] font-semibold text-primary">
                  {row.stops === 0 ? "Non-stop" : `${row.stops} Stop · ${row.layovers.map(l => l.airport).join(" · ")}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold tabular-nums leading-none text-foreground">{fmtTime(row.arrival)}</div>
                <div className="text-[11px] font-semibold text-foreground/80 mt-1.5">{row.destination}</div>
              </div>
            </div>

            {/* Fare meta strip — only fields backed by live data */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-border/60">
              {row.baggageCheckin && <Meta icon={Luggage} label={`${row.baggageCheckin} Check-in`} />}
              {row.baggageCabin && <Meta icon={Briefcase} label={`${row.baggageCabin} Cabin`} />}
              <Meta icon={RefreshCw} label={row.isRefundable ? "Refundable" : "Non-refundable"}
                tone={row.isRefundable ? "good" : "muted"} />
              {(row.fareFamily || row.brandName) && (
                <Meta icon={Tag} label={`${row.fareFamily || ""}${row.brandName ? ` · ${row.brandName}` : ""}`.replace(/^ · /, "")} />
              )}
              {row.hasSelfTransfer && <Meta icon={Shuffle} label="Self-transfer" tone="warn" />}
            </div>

            {/* Why picked */}
            {isAiPick && aiRationale && (
              <div className="rounded-xl bg-primary/[0.04] border border-primary/15 p-3 flex items-start gap-2.5">
                <Plane className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="text-[12px] text-foreground/90 leading-relaxed">
                  <span className="font-bold text-primary">Why this is picked: </span>
                  {aiRationale}
                </div>
              </div>
            )}

            {/* Compare */}
            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={inCompare} onCheckedChange={(v) => onCompareToggle(row.id, !!v)}
                  className="h-3.5 w-3.5 rounded-[3px]" />
                <span className="text-[11.5px] text-muted-foreground font-medium">Compare</span>
              </label>
            </div>
          </div>

          {/* Right: pricing + CTAs (B2B: net + sell) */}
          <div className="col-span-12 lg:col-span-3 flex flex-row lg:flex-col items-end lg:items-stretch justify-between gap-3 lg:border-l lg:border-border/60 lg:pl-5">
            <div className="text-right lg:text-right">
              {savings && (
                <div className="inline-block bg-success/10 text-success dark:bg-success/50/15 dark:text-success text-[10.5px] font-extrabold px-2 py-0.5 rounded-md mb-1">
                  Save {currencySymbol}{savings.toLocaleString()}
                </div>
              )}
              <div className="text-[26px] font-extrabold tabular-nums leading-none text-foreground">
                {currencySymbol}{row.sellFare.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">per traveler</div>
              {row.netFare > 0 && row.netFare !== row.sellFare && (
                <div className="mt-2 grid grid-cols-2 gap-x-3 text-[10.5px] tabular-nums text-muted-foreground">
                  <span>Net</span>
                  <span className="text-right text-foreground/80 font-semibold">{currencySymbol}{row.netFare.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full max-w-[180px]">
              <Button onClick={() => onSelect(row.id)}
                className={cn("h-10 rounded-xl font-bold text-[13px] shadow-sm",
                  isAiPick ? "bg-warning/50 hover:bg-warning text-white" : "")}>
                Select
              </Button>
              <Button variant="outline" onClick={() => setOpen(o => !o)}
                className="h-9 rounded-xl text-[12px] font-semibold border-border">
                {open ? "Hide Details" : "View Details"}
              </Button>
              {bookedToday && bookedToday > 0 && (
                <div className="text-[10.5px] text-danger dark:text-danger font-bold text-center inline-flex items-center justify-center gap-1 mt-0.5">
                  <Flame className="h-3 w-3" /> Booked {bookedToday} times today
                </div>
              )}
              {showTtl && (
                <div className={cn("text-[10.5px] text-center inline-flex items-center justify-center gap-1", ttlClass)}>
                  <Clock className="h-3 w-3" /> Hold for {fmtTtl(row.ttlMinutes)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded detail with tabs — premium redesign */}
      {open && (
        <div className="border-t border-border/60 bg-gradient-to-b from-muted/40 to-muted/10">
          <div className="flex items-center gap-1 px-4 border-b border-border/60 overflow-x-auto bg-card/50 backdrop-blur">
            <TabButton active={tab === "flight"} onClick={() => setTab("flight")}>Flight Details</TabButton>
            <TabButton active={tab === "fare"} onClick={() => setTab("fare")}>Fare Information</TabButton>
            <TabButton active={tab === "baggage"} onClick={() => setTab("baggage")}>Baggage</TabButton>
            <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>Fare Rules</TabButton>
          </div>

          <div className="p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-5 text-[12px]">
            <div>
              {tab === "flight" && (
                <div className="space-y-5">
                  {row.segments.map((s, i) => {
                    const lay = row.layovers[i];
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            Leg {i + 1} · {fmtDate(s.departure)}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground font-mono">{s.carrier} {s.flightNumber}</div>
                        </div>

                        <div className="bg-card rounded-xl border border-border/60 p-4">
                          <div className="flex items-stretch gap-4">
                            {/* Timeline rail */}
                            <div className="flex flex-col items-center pt-1">
                              <div className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
                              <div className="w-px flex-1 bg-gradient-to-b from-primary via-primary/40 to-primary my-1.5" />
                              <div className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
                            </div>

                            {/* Endpoints */}
                            <div className="flex-1 space-y-3">
                              {/* Depart */}
                              <div className="flex items-baseline gap-3">
                                <div className="text-[18px] font-extrabold tabular-nums text-foreground leading-none">{fmtTime(s.departure)}</div>
                                <div className="font-mono text-[13px] font-bold text-foreground/80">{s.origin}</div>
                                <div className="text-[11px] text-muted-foreground">{i === 0 ? row.originCity : ""}</div>
                              </div>

                              {/* Mid */}
                              <div className="flex items-center gap-2 pl-1 text-[11px] text-muted-foreground">
                                <Plane className="h-3 w-3 text-primary" />
                                <span className="font-semibold text-foreground/80">{s.duration}</span>
                                {s.aircraft && <span>· {s.aircraft}</span>}
                                {s.cabin && <span>· {s.cabin}</span>}
                              </div>

                              {/* Arrive */}
                              <div className="flex items-baseline gap-3">
                                <div className="text-[18px] font-extrabold tabular-nums text-foreground leading-none">{fmtTime(s.arrival)}</div>
                                <div className="font-mono text-[13px] font-bold text-foreground/80">{s.destination}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {i === row.segments.length - 1 ? row.destinationCity : ""}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {lay && (
                          <div className="flex items-center gap-2 my-3 ml-4 pl-3 border-l-2 border-dashed border-warning/25 dark:border-warning/50/40 py-1.5">
                            <span className="inline-flex items-center gap-1.5 bg-warning/5 dark:bg-warning/50/10 text-warning dark:text-warning text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-warning/15 dark:border-warning/50/30">
                              <MapPin className="h-2.5 w-2.5" />
                              {lay.duration} layover · {lay.city || lay.airport} ({lay.airport})
                            </span>
                            {lay.selfTransfer && (
                              <span className="text-[10.5px] font-bold text-danger dark:text-danger inline-flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Self-transfer
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "rules" && (
                <div className="bg-card rounded-xl border border-border/60 p-4 space-y-3">
                  <p className="text-foreground/90 leading-relaxed">{row.fareRulesSummary}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {row.changeFeeNote && <Info label="Change fee" value={row.changeFeeNote} />}
                    {row.refundFeeNote && <Info label="Refund fee" value={row.refundFeeNote} />}
                  </div>
                  {!row.changeFeeNote && !row.refundFeeNote && (
                    <div className="text-[11px] text-muted-foreground">Detailed change &amp; refund rules will be revalidated at booking.</div>
                  )}
                </div>
              )}

              {tab === "baggage" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-card rounded-xl border border-border/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-3.5 w-3.5 text-primary" />
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cabin</div>
                    </div>
                    <div className="text-[14px] font-bold text-foreground">{row.baggageCabin || "As per airline policy"}</div>
                  </div>
                  <div className="bg-card rounded-xl border border-border/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Luggage className="h-3.5 w-3.5 text-primary" />
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Check-in</div>
                    </div>
                    <div className="text-[14px] font-bold text-foreground">{row.baggageCheckin || "As per airline policy"}</div>
                  </div>
                </div>
              )}

              {tab === "fare" && (
                <div className="bg-card rounded-xl border border-border/60 p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                  <Info label="Cabin" value={row.cabin} />
                  <Info label="Fare Family" value={row.fareFamily || "Standard"} />
                  {row.brandName && <Info label="Brand" value={row.brandName} />}
                  <Info label="Validating Carrier" value={<span className="font-mono">{row.validatingCarrier}</span>} />
                  {row.segments[0]?.fareBasis && (
                    <Info label="Fare Basis" value={<span className="font-mono">{row.segments[0].fareBasis}</span>} />
                  )}
                  {row.segments[0]?.bookingClass && (
                    <Info label="Booking Class" value={<span className="font-mono">{row.segments[0].bookingClass}</span>} />
                  )}
                </div>
              )}
            </div>

            {/* Right meta panel */}
            <div className="space-y-3">
              <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Price Breakdown</div>
                <div className="space-y-1.5 text-[12px]">
                  {breakdown.baseFare > 0 && breakdown.taxes > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Base Fare</span>
                        <span className="font-semibold text-foreground/90 tabular-nums">{currencySymbol}{breakdown.baseFare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Taxes &amp; Fees</span>
                        <span className="font-semibold text-foreground/90 tabular-nums">{currencySymbol}{breakdown.taxes.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-1">
                    <span className="text-foreground font-bold">Total Fare</span>
                    <span className="font-extrabold text-foreground tabular-nums text-[14px]">{currencySymbol}{breakdown.totalFare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  {breakdown.commissionPct > 0 && (
                    <div className="flex items-center justify-between text-success dark:text-success">
                      <span className="font-medium">Commission ({breakdown.commissionPct}%)</span>
                      <span className="font-semibold tabular-nums">− {currencySymbol}{breakdown.commissionAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {breakdown.aitPct > 0 && (
                    <div className="flex items-center justify-between text-warning dark:text-warning">
                      <span className="font-medium">AIT ({breakdown.aitPct}%)</span>
                      <span className="font-semibold tabular-nums">+ {currencySymbol}{breakdown.aitAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {(breakdown.commissionPct > 0 || breakdown.aitPct > 0) && (
                    <div className="flex items-center justify-between border-t border-primary/30 pt-2 mt-1 bg-primary/5 -mx-4 px-4 py-2 rounded-b-xl">
                      <span className="text-primary font-extrabold uppercase tracking-wider text-[11px]">Net Fare</span>
                      <span className="font-extrabold text-primary tabular-nums text-[16px]">{currencySymbol}{breakdown.netFare.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {showTtl && (
                <div className="bg-card border border-border/60 rounded-xl p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Hold Time</div>
                  <div className={cn("text-[14px] inline-flex items-center gap-1.5", ttlClass)}>
                    <Clock className="h-3.5 w-3.5" /> {fmtTtl(row.ttlMinutes)}
                  </div>
                </div>
              )}

              {row.remarks && (
                <div className="bg-warning/5 dark:bg-warning/50/5 border border-warning/15 dark:border-warning/50/20 rounded-xl p-3 text-warning dark:text-warning flex gap-2 text-[11.5px]">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{row.remarks}</span>
                </div>
              )}

              <Button onClick={() => onSelect(row.id)}
                className="w-full h-10 rounded-xl font-bold text-[13px] gap-1.5">
                Continue to book <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

const Meta = ({ icon: Icon, label, tone = "default", mono }: {
  icon: any; label: string; tone?: "default" | "good" | "warn" | "violet" | "muted"; mono?: boolean;
}) => {
  const cls = tone === "good" ? "text-success dark:text-success"
    : tone === "warn" ? "text-warning dark:text-warning"
    : tone === "violet" ? "text-violet-700 dark:text-violet-400"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground/85";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-medium", cls)}>
      <Icon className="h-3 w-3" /> <span className={mono ? "font-mono" : ""}>{label}</span>
    </span>
  );
};

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-[13px] text-foreground mt-0.5 font-medium">{value}</div>
  </div>
);

export default PremiumFareCard;