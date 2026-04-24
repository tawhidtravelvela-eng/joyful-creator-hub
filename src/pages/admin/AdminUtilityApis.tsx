import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plane, Globe, Search, CheckCircle, CalendarDays, KeyRound, ExternalLink, TrendingUp } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FlightStatusCard = () => {
  const [flightNo, setFlightNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const check = async () => {
    if (!flightNo.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("flight-status", {
        body: { flight_number: flightNo.trim(), date },
      });
      if (error) throw error;
      setResult(data);
      toast.success(`Found ${data?.count || 0} flight(s)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" /> Flight Status Check
        </CardTitle>
        <CardDescription>AeroDataBox API — check real-time flight status by number & date</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1">
            <Label>Flight Number</Label>
            <Input placeholder="BS325" value={flightNo} onChange={e => setFlightNo(e.target.value.toUpperCase())} className="w-32" />
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" />
          </div>
          <Button onClick={check} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />} Check
          </Button>
        </div>
        {result?.flights?.length > 0 && (
          <div className="space-y-2 text-sm">
            {result.flights.map((f: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{f.flight_number}</span>
                  <Badge variant="outline">{f.status}</Badge>
                  <span className="text-muted-foreground">{f.airline}</span>
                </div>
                <p>{f.departure.airport} ({f.departure.code}) → {f.arrival.airport} ({f.arrival.code})</p>
                {f.aircraft.model && <p className="text-muted-foreground">Aircraft: {f.aircraft.model} ({f.aircraft.registration})</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const VisaDataCard = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [passportCode, setPassportCode] = useState("BD");

  const fetchVisa = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("visa-requirements", {
        body: { passport_code: passportCode },
      });
      if (error) throw error;
      setResult(data);
      toast.success(`Visa data fetched: ${data?.stored || 0} requirements`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" /> Visa Requirements Data
        </CardTitle>
        <CardDescription>Fetch & cache visa requirement data by passport country</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <Label>Passport Country Code</Label>
            <Input placeholder="BD" value={passportCode} onChange={e => setPassportCode(e.target.value.toUpperCase())} className="w-24" />
          </div>
          <Button onClick={fetchVisa} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />} Fetch
          </Button>
        </div>
        {result && (
          <div className="text-sm p-3 rounded-lg bg-muted/50 border border-border">
            <p>Stored: <strong>{result.stored}</strong> requirements</p>
            {result.breakdown && (
              <div className="flex gap-4 mt-2 flex-wrap">
                <span className="text-green-600">🟩 Visa Free: {result.breakdown.visa_free || 0}</span>
                <span className="text-blue-600">🟦 eVisa: {result.breakdown.evisa || 0}</span>
                <span className="text-yellow-600">🟨 eTA: {result.breakdown.eta || 0}</span>
                <span className="text-red-600">🟥 Required: {result.breakdown.visa_required || 0}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const HolidaySyncCard = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<{ countries: number; total: number } | null>(null);

  const fetchStats = async () => {
    try {
      const { data } = await supabase
        .from("high_demand_dates")
        .select("country")
        .neq("country", "");
      if (data) {
        const countries = new Set(data.map((r: any) => r.country)).size;
        setStats({ countries, total: data.length });
      }
    } catch {}
  };

  useState(() => { fetchStats(); });

  const runSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-holidays", {
        body: {},
      });
      if (error) throw error;
      setResult(data);
      fetchStats();
      toast.success(`Synced holidays for ${data?.countries_processed || 0} countries`);
    } catch (e: any) {
      toast.error(e.message || "Sync timed out — it may still be running in the background");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" /> Holiday Sync
        </CardTitle>
        <CardDescription>
          Calendarific API — bulk-fetch national holidays for 230+ countries. Used by hotel search (TTL) and AI trip planner (crowd awareness).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="flex gap-4 text-sm">
            <Badge variant="secondary">{stats.countries} countries cached</Badge>
            <Badge variant="outline">{stats.total} total holiday dates</Badge>
          </div>
        )}
        <div className="flex gap-3 items-center">
          <Button onClick={runSync} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CalendarDays className="h-4 w-4 mr-1" />}
            {loading ? "Syncing..." : "Run Sync Now"}
          </Button>
          <span className="text-xs text-muted-foreground">Auto-runs yearly via cron + monthly catch-up</span>
        </div>
        {result && (
          <div className="text-sm p-3 rounded-lg bg-muted/50 border border-border space-y-1">
            <p>Processed: <strong>{result.countries_processed}</strong> countries ({result.api_calls_used} API calls)</p>
            <p>Holidays cached: <strong>{result.holidays_cached}</strong></p>
            <p>Skipped (already cached): <strong>{result.countries_skipped}</strong></p>
            {result.failed_countries?.length > 0 && (
              <p className="text-destructive">Failed: {result.failed_countries.join(", ")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AviasalesTokenCard = () => {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const checkStatus = async () => {
    try {
      const { data } = await supabase.rpc("get_provider_credential_status", { p_provider: "aviasales" });
      const obj = (data ?? {}) as Record<string, boolean>;
      setConfigured(Boolean(obj.token));
    } catch {
      setConfigured(false);
    }
  };

  useState(() => { checkStatus(); });

  const save = async () => {
    if (!token.trim()) {
      toast.error("Please enter an Aviasales (Travelpayouts) token");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("save_provider_credentials", {
        p_provider: "aviasales",
        p_credentials: { token: token.trim() },
      });
      if (error) throw error;
      toast.success("Aviasales token saved to vault");
      setToken("");
      checkStatus();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Aviasales (Travelpayouts) Token
        </CardTitle>
        <CardDescription>
          Powers ±30-day price calendar &amp; trend sparkline (lazy backfill, cached 24h). Free tier — sign up at{" "}
          <a
            href="https://www.travelpayouts.com/programs/100/tools/api?locale=en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline inline-flex items-center gap-0.5"
          >
            travelpayouts.com <ExternalLink className="h-3 w-3" />
          </a>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={configured ? "default" : "outline"}>
            {configured === null ? "Checking…" : configured ? "Configured" : "Not configured"}
          </Badge>
          <span className="text-xs text-muted-foreground">Stored encrypted in Supabase Vault</span>
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> API Token</Label>
          <Input
            type="password"
            placeholder={configured ? "•••••••• (replace existing)" : "Paste your Travelpayouts API token"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button onClick={save} disabled={saving || !token.trim()} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
          {configured ? "Update Token" : "Save Token"}
        </Button>
      </CardContent>
    </Card>
  );
};

const AdminUtilityApis = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Utility APIs</h2>
        <p className="text-muted-foreground">External API integrations for flight data, visa info, holidays, and other utility services.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <FlightStatusCard />
          <VisaDataCard />
          <HolidaySyncCard />
          <AviasalesTokenCard />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUtilityApis;
