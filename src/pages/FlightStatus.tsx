import { useState } from "react";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plane, Clock, MapPin, Search, Info, Navigation, Gauge, ArrowUp, ArrowDown, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LiveTracking {
  latitude: number | null;
  longitude: number | null;
  altitude_feet: number | null;
  speed_knots: number | null;
  speed_kmh: number | null;
  heading: number | null;
  vertical_rate_ms: number | null;
  on_ground: boolean;
  squawk: string | null;
  origin_country: string;
  last_contact_utc: string | null;
  source: string;
}

interface FlightInfo {
  flight_number: string;
  callsign: string;
  airline: { name: string; iata: string; icao: string };
  status: string;
  last_updated_utc: string;
  departure: {
    airport: string; short_name: string; code: string; icao: string;
    city: string; country_code: string; timezone: string;
    terminal: string; gate: string;
    scheduled_utc: string; scheduled_local: string;
    actual_utc: string; actual_local: string;
    predicted_utc: string; predicted_local: string;
    quality: string[];
  };
  arrival: {
    airport: string; short_name: string; code: string; icao: string;
    city: string; country_code: string; timezone: string;
    terminal: string; gate: string; baggage_belt: string;
    scheduled_utc: string; scheduled_local: string;
    actual_utc: string; actual_local: string;
    predicted_utc: string; predicted_local: string;
    quality: string[];
  };
  distance: { km: number; miles: number; nm: number } | null;
  aircraft: { model: string; registration: string; mode_s: string };
  codeshare_status: string;
  is_cargo: boolean;
  live_tracking?: LiveTracking;
  _sources?: { providers_used: string[] };
}

const statusColor = (s: string) => {
  const lower = s.toLowerCase();
  if (lower.includes("arrived") || lower.includes("landed")) return "bg-green-500/10 text-green-700 border-green-300";
  if (lower.includes("en-route") || lower.includes("en route") || lower.includes("in flight") || lower.includes("airborne") || lower.includes("departed")) return "bg-blue-500/10 text-blue-700 border-blue-300";
  if (lower.includes("cancelled") || lower.includes("diverted")) return "bg-red-500/10 text-red-700 border-red-300";
  if (lower.includes("delayed")) return "bg-yellow-500/10 text-yellow-700 border-yellow-300";
  if (lower.includes("scheduled") || lower.includes("expected")) return "bg-muted text-muted-foreground border-border";
  return "bg-muted text-muted-foreground border-border";
};

const formatLocal = (local: string) => {
  if (!local) return "";
  const match = local.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  if (!match) return local;
  const [, datePart, timePart] = match;
  const d = new Date(datePart);
  return `${timePart} · ${d.getDate()} ${d.toLocaleString("en", { month: "short" })} (Local Time)`;
};

// Helper: only render a row if value is truthy
const InfoRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => {
  if (!value) return null;
  return (
    <p className="text-sm">
      {label}: <span className={`font-medium ${highlight ? "text-amber-600" : ""}`}>{value}</span>
    </p>
  );
};

const FlightStatus = () => {
  const [flightNo, setFlightNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<FlightInfo[]>([]);
  const [searched, setSearched] = useState(false);
  const [meta, setMeta] = useState<{ cached: boolean; source: string }>({ cached: false, source: "" });

  const handleSearch = async () => {
    if (!flightNo.trim()) { toast.error("Please enter a flight number"); return; }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("flight-status", {
        body: { flight_number: flightNo.trim(), date },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed");
      setFlights(data.flights || []);
      setMeta({ cached: !!data.cached, source: data.source || "" });
      if (data.flights?.length === 0) toast.info("No flights found for this number and date");
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch flight status");
      setFlights([]);
    } finally {
      setLoading(false);
    }
  };

  const hasAircraft = (f: FlightInfo) => f.aircraft?.model || f.aircraft?.registration || f.aircraft?.mode_s;
  const hasDepGateInfo = (f: FlightInfo) => f.departure.terminal || f.departure.gate;
  const hasArrGateInfo = (f: FlightInfo) => f.arrival.terminal || f.arrival.gate || f.arrival.baggage_belt;

  return (
    <Layout>
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
              <Plane className="h-8 w-8 text-primary" /> Flight Status
            </h1>
            <p className="text-muted-foreground">Check real-time flight status by flight number and date</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="flightNo">Flight Number</Label>
                  <Input id="flightNo" placeholder="e.g. BS325, EK502" value={flightNo}
                    onChange={e => setFlightNo(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <div className="w-full sm:w-44 space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Check Status
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && searched && flights.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              No flights found for {flightNo} on {date}
            </CardContent></Card>
          )}

          {!loading && flights.map((f, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {f.flight_number}
                      {f.callsign && f.callsign !== f.flight_number && (
                        <span className="text-sm font-normal text-muted-foreground">({f.callsign})</span>
                      )}
                    </CardTitle>
                    {(f.airline.name || f.airline.iata) && (
                      <p className="text-sm text-muted-foreground">
                        {f.airline.name || f.airline.iata}
                        {f.airline.iata && f.airline.icao && (
                          <span className="ml-1">({f.airline.iata}/{f.airline.icao})</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {meta.cached && <Badge variant="outline" className="text-xs bg-muted">Cached</Badge>}
                    <Badge variant="outline" className={statusColor(f.status)}>{f.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Route summary — only if we have codes */}
                {(f.departure.code || f.arrival.code) && (
                  <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{f.departure.code || "—"}</p>
                      {f.departure.city && <p className="text-xs text-muted-foreground">{f.departure.city}</p>}
                    </div>
                    <div className="flex-1 mx-4 flex flex-col items-center">
                      <div className="w-full border-t border-dashed border-border relative">
                        <Plane className="h-4 w-4 text-primary absolute -top-2 left-1/2 -translate-x-1/2" />
                      </div>
                      {f.distance && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {Math.round(f.distance.km).toLocaleString()} km · {Math.round(f.distance.miles).toLocaleString()} mi
                        </p>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{f.arrival.code || "—"}</p>
                      {f.arrival.city && <p className="text-xs text-muted-foreground">{f.arrival.city}</p>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Departure — only show sections with data */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Departure</p>
                    {f.departure.airport && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{f.departure.airport}</p>
                          <p className="text-sm text-muted-foreground">
                            {[
                              f.departure.code && f.departure.icao ? `${f.departure.code}/${f.departure.icao}` : f.departure.code || f.departure.icao,
                              f.departure.terminal && `Terminal ${f.departure.terminal}`,
                              f.departure.gate && `Gate ${f.departure.gate}`,
                            ].filter(Boolean).join(" · ")}
                          </p>
                          {(f.departure.country_code || f.departure.timezone) && (
                            <p className="text-xs text-muted-foreground">
                              {[f.departure.country_code, f.departure.timezone].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {(f.departure.scheduled_local || f.departure.actual_local || f.departure.predicted_local) && (
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="space-y-0.5">
                          <InfoRow label="Scheduled" value={formatLocal(f.departure.scheduled_local)} />
                          <InfoRow label="Actual" value={formatLocal(f.departure.actual_local)} />
                          {!f.departure.actual_local && (
                            <InfoRow label="Predicted" value={formatLocal(f.departure.predicted_local)} highlight />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Arrival — only show sections with data */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Arrival</p>
                    {f.arrival.airport && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{f.arrival.airport}</p>
                          <p className="text-sm text-muted-foreground">
                            {[
                              f.arrival.code && f.arrival.icao ? `${f.arrival.code}/${f.arrival.icao}` : f.arrival.code || f.arrival.icao,
                              f.arrival.terminal && `Terminal ${f.arrival.terminal}`,
                              f.arrival.gate && `Gate ${f.arrival.gate}`,
                              f.arrival.baggage_belt && `Belt ${f.arrival.baggage_belt}`,
                            ].filter(Boolean).join(" · ")}
                          </p>
                          {(f.arrival.country_code || f.arrival.timezone) && (
                            <p className="text-xs text-muted-foreground">
                              {[f.arrival.country_code, f.arrival.timezone].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {(f.arrival.scheduled_local || f.arrival.actual_local || f.arrival.predicted_local) && (
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="space-y-0.5">
                          <InfoRow label="Scheduled" value={formatLocal(f.arrival.scheduled_local)} />
                          <InfoRow label="Actual" value={formatLocal(f.arrival.actual_local)} />
                          {!f.arrival.actual_local && (
                            <InfoRow label="Predicted" value={formatLocal(f.arrival.predicted_local)} highlight />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live tracking — only if OpenSky returned data */}
                {f.live_tracking && (f.live_tracking.latitude != null || f.live_tracking.altitude_feet != null) && (
                  <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-green-500 animate-pulse" /> Live Tracking
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {f.live_tracking.altitude_feet != null && (
                        <div className="flex items-center gap-1.5">
                          <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Alt:</span>
                          <span className="font-medium">{f.live_tracking.altitude_feet.toLocaleString()} ft</span>
                        </div>
                      )}
                      {f.live_tracking.speed_knots != null && (
                        <div className="flex items-center gap-1.5">
                          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Speed:</span>
                          <span className="font-medium">{f.live_tracking.speed_knots} kts</span>
                        </div>
                      )}
                      {f.live_tracking.heading != null && (
                        <div className="flex items-center gap-1.5">
                          <Navigation className="h-3.5 w-3.5 text-muted-foreground" style={{ transform: `rotate(${f.live_tracking.heading}deg)` }} />
                          <span className="text-muted-foreground">Heading:</span>
                          <span className="font-medium">{Math.round(f.live_tracking.heading)}°</span>
                        </div>
                      )}
                      {f.live_tracking.vertical_rate_ms != null && f.live_tracking.vertical_rate_ms !== 0 && (
                        <div className="flex items-center gap-1.5">
                          {f.live_tracking.vertical_rate_ms > 0
                            ? <ArrowUp className="h-3.5 w-3.5 text-green-500" />
                            : <ArrowDown className="h-3.5 w-3.5 text-amber-500" />}
                          <span className="text-muted-foreground">V/S:</span>
                          <span className="font-medium">{Math.round(f.live_tracking.vertical_rate_ms * 196.85)} fpm</span>
                        </div>
                      )}
                    </div>
                    {f.live_tracking.latitude != null && f.live_tracking.longitude != null && (
                      <p className="text-xs text-muted-foreground">
                        Position: {f.live_tracking.latitude.toFixed(4)}°, {f.live_tracking.longitude.toFixed(4)}°
                        {f.live_tracking.squawk && <span className="ml-2">Squawk: {f.live_tracking.squawk}</span>}
                      </p>
                    )}
                  </div>
                )}

                {/* Aircraft + meta — only if any data exists */}
                {hasAircraft(f) && (
                  <div className="pt-2 border-t border-border flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <Plane className="h-4 w-4 shrink-0" />
                    {f.aircraft.model && <span>{f.aircraft.model}</span>}
                    {f.aircraft.registration && <span>Reg: {f.aircraft.registration}</span>}
                    {f.aircraft.mode_s && <span>Mode-S: {f.aircraft.mode_s}</span>}
                    {f.codeshare_status && f.codeshare_status !== "IsOperator" && (
                      <Badge variant="outline" className="text-xs">Codeshare</Badge>
                    )}
                  </div>
                )}

                {/* Footer: source + last updated */}
                <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                {f.last_updated_utc && (
                    <span className="flex items-center gap-1">
                      <Info className="h-3 w-3" /> Last updated: {f.last_updated_utc}
                    </span>
                  )}
                  {f._sources?.providers_used && f._sources.providers_used.length > 0 && (
                    <span className="flex items-center gap-1">
                      Sources: {f._sources.providers_used.join(", ")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default FlightStatus;