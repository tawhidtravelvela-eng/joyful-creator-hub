import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Percent, Plane, Building, Globe, DollarSign, Trash2, PlusCircle, Hotel, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

interface CommissionRule {
  id?: string;
  carrier_code: string;
  api_provider: string;
  module: string;
  origin: string;
  commission_type: string;
  profit_type: string;
  amount: number;
  is_active: boolean;
  created_at?: string;
}

interface FlightRow {
  id: string;
  airline: string;
  from_city: string;
  to_city: string;
  price: number;
  markup_percentage: number;
  class: string;
}

const AdminMarkups = () => {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkMarkup, setBulkMarkup] = useState<number>(0);
  const [editedMarkups, setEditedMarkups] = useState<Record<string, number>>({});
  const [airlineMarkups, setAirlineMarkups] = useState<Record<string, number>>({});
  const [editedAirlineMarkups, setEditedAirlineMarkups] = useState<Record<string, number>>({});
  const [apiMarkupId, setApiMarkupId] = useState<string | null>(null);
  // Per-API markup: { travelport: { global: 5, airlines: { QR: 3 } }, ... }
  const [perApiMarkups, setPerApiMarkups] = useState<Record<string, { global: number; airlines: Record<string, number> }>>({
    travelport: { global: 0, airlines: {} },
    amadeus: { global: 0, airlines: {} },
    travelvela: { global: 0, airlines: {} },
    tripjack: { global: 0, airlines: {} },
  });
  const [perApiMarkupsOriginal, setPerApiMarkupsOriginal] = useState<Record<string, { global: number; airlines: Record<string, number> }>>({
    travelport: { global: 0, airlines: {} },
    amadeus: { global: 0, airlines: {} },
    travelvela: { global: 0, airlines: {} },
    tripjack: { global: 0, airlines: {} },
  });
  const [newApiAirlineCodes, setNewApiAirlineCodes] = useState<Record<string, string>>({});
  const [activeMarkupTab, setActiveMarkupTab] = useState("travelport");

  // Commission rules from commission_rules table
  const [commRules, setCommRules] = useState<CommissionRule[]>([]);
  const [commSaving, setCommSaving] = useState(false);
  const [newCommCode, setNewCommCode] = useState("");
  const [newCommApi, setNewCommApi] = useState("travelport");
  const [newCommModule, setNewCommModule] = useState("flights");
  const [newCommOrigin, setNewCommOrigin] = useState("");
  const [newCommType, setNewCommType] = useState("commission");
  const [newCommProfitType, setNewCommProfitType] = useState("percentage");
  const [activeApiTab, setActiveApiTab] = useState("travelport");
  const { formatPrice } = useCurrency();

  // AIT settings
  const [aitEnabled, setAitEnabled] = useState(false);
  const [aitPerApi, setAitPerApi] = useState<Record<string, number>>({ travelport: 0, amadeus: 0, travelvela: 0, tripjack: 0 });
  const [aitOriginal, setAitOriginal] = useState<{ enabled: boolean; perApi: Record<string, number> }>({ enabled: false, perApi: { travelport: 0, amadeus: 0, travelvela: 0, tripjack: 0 } });
  const [aitSaving, setAitSaving] = useState(false);

  const fetchFlights = async () => {
    const { data } = await supabase.from("flights").select("id, airline, from_city, to_city, price, markup_percentage, class").order("created_at");
    if (data) {
      setFlights(data as FlightRow[]);
      const markups: Record<string, number> = {};
      data.forEach((f: any) => { markups[f.id] = f.markup_percentage || 0; });
      setEditedMarkups(markups);

      const airlineMap: Record<string, number[]> = {};
      data.forEach((f: any) => {
        if (!airlineMap[f.airline]) airlineMap[f.airline] = [];
        airlineMap[f.airline].push(f.markup_percentage || 0);
      });
      const avgMarkups: Record<string, number> = {};
      Object.entries(airlineMap).forEach(([airline, values]) => {
        avgMarkups[airline] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
      });
      setAirlineMarkups(avgMarkups);
      setEditedAirlineMarkups(avgMarkups);
    }

    // Fetch API markup setting (per-API structure)
    const { data: settings } = await supabase.from("api_settings").select("*").eq("provider", "api_markup").maybeSingle();
    if (settings) {
      const m = (settings.settings as any) || {};
      setApiMarkupId(settings.id);
      // Support legacy format (single global) and new per-API format
      if (m.per_api) {
        setPerApiMarkups(m.per_api);
        setPerApiMarkupsOriginal(JSON.parse(JSON.stringify(m.per_api)));
      } else {
        // Migrate old format: apply old global to all APIs
        const legacy = {
          travelport: { global: m.markup_percentage || 0, airlines: m.airline_markups || {} },
          amadeus: { global: m.markup_percentage || 0, airlines: {} },
          travelvela: { global: m.markup_percentage || 0, airlines: {} },
          tripjack: { global: m.markup_percentage || 0, airlines: {} },
        };
        setPerApiMarkups(legacy);
        setPerApiMarkupsOriginal(JSON.parse(JSON.stringify(legacy)));
      }
    }

    // Fetch commission rules from commission_rules table
    const { data: commData } = await supabase
      .from("commission_rules")
      .select("*")
      .order("created_at", { ascending: true });
    if (commData) {
      setCommRules(commData.map((r: any) => ({
        id: r.id,
        carrier_code: r.carrier_code,
        api_provider: r.api_provider,
        module: r.module,
        origin: r.origin || "",
        commission_type: r.commission_type,
        profit_type: r.profit_type,
        amount: Number(r.amount),
        is_active: r.is_active,
        created_at: r.created_at,
      })));
    }

    // Fetch AIT settings
    const { data: aitData } = await supabase.from("api_settings").select("*").eq("provider", "ait_settings").maybeSingle();
    if (aitData) {
      setAitEnabled(aitData.is_active);
      const perApi = (aitData.settings as any)?.per_api || { travelport: 0, amadeus: 0, travelvela: 0, tripjack: 0 };
      setAitPerApi(perApi);
      setAitOriginal({ enabled: aitData.is_active, perApi: JSON.parse(JSON.stringify(perApi)) });
    }

    setLoading(false);
  };

  useEffect(() => { fetchFlights(); }, []);

  const updateMarkup = (id: string, value: number) => {
    setEditedMarkups(prev => ({ ...prev, [id]: value }));
  };

  const saveSingle = async (id: string) => {
    setSaving(id);
    const { error } = await supabase.from("flights").update({ markup_percentage: editedMarkups[id] || 0 }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Markup updated");
    setSaving(null);
  };

  const applyBulk = async () => {
    setSaving("bulk");
    const { error } = await supabase.from("flights").update({ markup_percentage: bulkMarkup }).neq("id", "");
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Applied ${bulkMarkup}% markup to all flights`);
      fetchFlights();
    }
    setSaving(null);
  };

  const applyAirlineMarkup = async (airline: string) => {
    const value = editedAirlineMarkups[airline] ?? 0;
    setSaving(`airline-${airline}`);
    const flightIds = flights.filter(f => f.airline === airline).map(f => f.id);
    const { error } = await supabase.from("flights").update({ markup_percentage: value }).in("id", flightIds);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Applied ${value}% markup to all ${airline} flights`);
      fetchFlights();
    }
    setSaving(null);
  };

  const saveApiMarkups = async () => {
    if (!apiMarkupId) return;
    setSaving("api");
    // Also compute legacy fields for backward compat
    const { error } = await supabase.from("api_settings").update({
      settings: {
        per_api: perApiMarkups,
        // Legacy: keep a flat markup_percentage as the average for old code paths
        markup_percentage: perApiMarkups.travelport?.global || 0,
        airline_markups: perApiMarkups.travelport?.airlines || {},
      } as any,
    }).eq("id", apiMarkupId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("API markups saved");
      setPerApiMarkupsOriginal(JSON.parse(JSON.stringify(perApiMarkups)));
    }
    setSaving(null);
  };

  const updatePerApiGlobal = (api: string, value: number) => {
    setPerApiMarkups(prev => ({
      ...prev,
      [api]: { ...prev[api], global: value },
    }));
  };

  const addPerApiAirline = (api: string) => {
    const code = (newApiAirlineCodes[api] || "").trim().toUpperCase();
    if (!code) return;
    if (perApiMarkups[api]?.airlines[code] !== undefined) { toast.error("Airline already added"); return; }
    setPerApiMarkups(prev => ({
      ...prev,
      [api]: { ...prev[api], airlines: { ...prev[api].airlines, [code]: 0 } },
    }));
    setNewApiAirlineCodes(prev => ({ ...prev, [api]: "" }));
  };

  const removePerApiAirline = (api: string, code: string) => {
    setPerApiMarkups(prev => {
      const next = { ...prev[api].airlines };
      delete next[code];
      return { ...prev, [api]: { ...prev[api], airlines: next } };
    });
  };

  const updatePerApiAirlineMarkup = (api: string, code: string, value: number) => {
    setPerApiMarkups(prev => ({
      ...prev,
      [api]: { ...prev[api], airlines: { ...prev[api].airlines, [code]: value } },
    }));
  };

  const isApiDirty = JSON.stringify(perApiMarkups) !== JSON.stringify(perApiMarkupsOriginal);

  const API_LABELS: Record<string, string> = { travelport: "Travelport", amadeus: "Amadeus", travelvela: "TravelVela", tripjack: "Tripjack" };

  // Commission & Markup helpers — now using commission_rules table
  const addCommRule = async () => {
    const code = newCommCode.trim().toUpperCase();
    if (!code) { toast.error("Enter an airline/hotel code"); return; }
    const origin = newCommOrigin.trim().toUpperCase();
    const exists = commRules.some(r => r.carrier_code === code && r.api_provider === newCommApi && (r.origin || "") === origin);
    if (exists) { toast.error("Rule already exists for this combination"); return; }

    setCommSaving(true);
    const { data, error } = await supabase.from("commission_rules").insert({
      carrier_code: code,
      api_provider: newCommApi,
      module: newCommModule,
      origin,
      commission_type: newCommType,
      profit_type: newCommProfitType,
      amount: 0,
    } as any).select().single();
    if (error) { toast.error(error.message); }
    else if (data) {
      setCommRules(prev => [...prev, {
        id: (data as any).id,
        carrier_code: (data as any).carrier_code,
        api_provider: (data as any).api_provider,
        module: (data as any).module,
        origin: (data as any).origin || "",
        commission_type: (data as any).commission_type,
        profit_type: (data as any).profit_type,
        amount: Number((data as any).amount),
        is_active: (data as any).is_active,
        created_at: (data as any).created_at,
      }]);
      toast.success("Rule added");
    }
    setNewCommCode("");
    setNewCommOrigin("");
    setCommSaving(false);
  };

  const updateCommRuleAmount = async (rule: CommissionRule, newAmount: number) => {
    if (!rule.id) return;
    const { error } = await supabase.from("commission_rules").update({ amount: newAmount } as any).eq("id", rule.id);
    if (error) { toast.error(error.message); return; }
    setCommRules(prev => prev.map(r => r.id === rule.id ? { ...r, amount: newAmount } : r));
  };

  const removeCommRule = async (rule: CommissionRule) => {
    if (!rule.id) return;
    const { error } = await supabase.from("commission_rules").delete().eq("id", rule.id);
    if (error) { toast.error(error.message); return; }
    setCommRules(prev => prev.filter(r => r.id !== rule.id));
    toast.success("Rule deleted");
  };

  // AIT helpers
  const isAitDirty = aitEnabled !== aitOriginal.enabled || JSON.stringify(aitPerApi) !== JSON.stringify(aitOriginal.perApi);

  const saveAitSettings = async () => {
    setAitSaving(true);
    const { error } = await supabase
      .from("api_settings")
      .update({ is_active: aitEnabled, settings: { per_api: aitPerApi } as any })
      .eq("provider", "ait_settings");
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("AIT settings saved");
      setAitOriginal({ enabled: aitEnabled, perApi: JSON.parse(JSON.stringify(aitPerApi)) });
    }
    setAitSaving(false);
  };

  const getFinalPrice = (price: number, markup: number) =>
    Math.round(price * (1 + markup / 100) * 100) / 100;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Fare Markups</h2>

        {/* Per-API Markup Cards */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">API Fare Markups</CardTitle>
                <CardDescription>Set global and per-airline markups for each flight API individually</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeMarkupTab} onValueChange={setActiveMarkupTab}>
              <TabsList className="grid grid-cols-4 w-full max-w-lg">
                {Object.entries(API_LABELS).map(([key, label]) => (
                  <TabsTrigger key={key} value={key} className="text-xs gap-1">
                    {label}
                    {(perApiMarkups[key]?.global > 0 || Object.keys(perApiMarkups[key]?.airlines || {}).length > 0) && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                        {perApiMarkups[key]?.global}%
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(API_LABELS).map(([apiKey, apiLabel]) => {
                const apiData = perApiMarkups[apiKey] || { global: 0, airlines: {} };
                const airlines = apiData.airlines || {};
                return (
                  <TabsContent key={apiKey} value={apiKey} className="mt-4 space-y-5">
                    {/* Global markup for this API */}
                    <div>
                      <Label className="text-sm font-semibold">{apiLabel} Global Markup (%)</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Default markup for all {apiLabel} flights unless overridden per-airline below.
                      </p>
                      <Input
                        type="number" min={0} step={0.5}
                        className="max-w-[200px]"
                        value={apiData.global}
                        onChange={(e) => updatePerApiGlobal(apiKey, parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 5"
                      />
                    </div>

                    {/* Per-airline overrides for this API */}
                    <div>
                      <Label className="text-sm font-semibold">Per-Airline Overrides</Label>
                      <div className="flex items-end gap-2 mt-2 mb-3">
                        <Input
                          placeholder="Airline code (e.g. EK)"
                          className="max-w-[140px]"
                          value={newApiAirlineCodes[apiKey] || ""}
                          onChange={(e) => setNewApiAirlineCodes(prev => ({ ...prev, [apiKey]: e.target.value.toUpperCase() }))}
                          onKeyDown={(e) => e.key === "Enter" && addPerApiAirline(apiKey)}
                        />
                        <Button variant="outline" size="sm" onClick={() => addPerApiAirline(apiKey)}>+ Add</Button>
                      </div>

                      {Object.keys(airlines).length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Airline</TableHead>
                              <TableHead className="w-28">Markup %</TableHead>
                              <TableHead className="w-16"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(airlines).sort(([a], [b]) => a.localeCompare(b)).map(([code, val]) => (
                              <TableRow key={code}>
                                <TableCell className="font-mono font-medium">{code}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number" min={0} step={0.5}
                                    className="h-8 w-24"
                                    value={val}
                                    onChange={(e) => updatePerApiAirlineMarkup(apiKey, code, parseFloat(e.target.value) || 0)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => removePerApiAirline(apiKey, code)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground py-2">No airline overrides. Global {apiData.global}% applies to all {apiLabel} flights.</p>
                      )}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>

            <div className="flex items-center gap-4 pt-2 border-t border-border">
              <Button onClick={saveApiMarkups} disabled={saving === "api" || !isApiDirty}>
                {saving === "api" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save All API Markups
              </Button>
              {isApiDirty && <Badge variant="outline" className="text-xs">Unsaved changes</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* API-Specific Commission & Markup Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">API Commissions</CardTitle>
                <CardDescription>
                  Per-airline/hotel commission rules by API provider, with optional origin filtering.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new rule form */}
            <div className="flex items-end gap-2 flex-wrap p-4 rounded-lg bg-muted/50 border border-border/50">
              <div>
                <Label className="text-xs">Module</Label>
                <Select value={newCommModule} onValueChange={setNewCommModule}>
                  <SelectTrigger className="w-[110px] mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flights">Flights</SelectItem>
                    <SelectItem value="hotels">Hotels</SelectItem>
                    <SelectItem value="tours">Tours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">API</Label>
                <Select value={newCommApi} onValueChange={(v) => { setNewCommApi(v); setActiveApiTab(v); }}>
                  <SelectTrigger className="w-[140px] mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="travelport">Travelport</SelectItem>
                    <SelectItem value="amadeus">Amadeus</SelectItem>
                    <SelectItem value="travelvela">TravelVela</SelectItem>
                    <SelectItem value="tripjack">Tripjack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Airline/Hotel Code</Label>
                <Input
                  placeholder="e.g. QR"
                  className="max-w-[100px] mt-1"
                  value={newCommCode}
                  onChange={(e) => setNewCommCode(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <Label className="text-xs">Origin (optional)</Label>
                <Input
                  placeholder="e.g. DAC - Dhaka"
                  className="max-w-[140px] mt-1"
                  value={newCommOrigin}
                  onChange={(e) => setNewCommOrigin(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={newCommType} onValueChange={setNewCommType}>
                  <SelectTrigger className="w-[130px] mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Profit Type</Label>
                <Select value={newCommProfitType} onValueChange={setNewCommProfitType}>
                  <SelectTrigger className="w-[140px] mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={addCommRule} disabled={commSaving} className="gap-1">
                {commSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />} Add Rule
              </Button>
            </div>

            {/* API Tabs */}
            <Tabs value={activeApiTab} onValueChange={setActiveApiTab}>
              <TabsList className="grid grid-cols-4 w-full max-w-lg">
                {["travelport", "amadeus", "travelvela", "tripjack"].map((api) => {
                  const count = commRules.filter(r => r.api_provider === api).length;
                  return (
                    <TabsTrigger key={api} value={api} className="text-xs capitalize gap-1">
                      {api} {count > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {["travelport", "amadeus", "travelvela", "tripjack"].map((api) => {
                const apiRules = commRules.filter(r => r.api_provider === api);

                return (
                  <TabsContent key={api} value={api} className="mt-4">
                    {apiRules.length > 0 ? (
                      <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-xs w-10">SL</TableHead>
                              <TableHead className="text-xs">Entry Date</TableHead>
                              <TableHead className="text-xs">Module</TableHead>
                              <TableHead className="text-xs">Airline/Hotel Code</TableHead>
                              <TableHead className="text-xs">Origin</TableHead>
                              <TableHead className="text-xs">Type</TableHead>
                              <TableHead className="text-xs">Profit Type</TableHead>
                              <TableHead className="text-xs w-28">Amount</TableHead>
                              <TableHead className="text-xs w-20">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {apiRules.map((rule, idx) => (
                              <TableRow key={rule.id || idx}>
                                <TableCell className="font-semibold text-primary">{idx + 1}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {rule.created_at ? new Date(rule.created_at).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    {rule.module === "flights" ? <Plane className="w-3.5 h-3.5 text-muted-foreground" /> : <Hotel className="w-3.5 h-3.5 text-muted-foreground" />}
                                    <span className="capitalize text-sm">{rule.module}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono font-semibold">{rule.carrier_code}</TableCell>
                                <TableCell className="text-sm">{rule.origin || <span className="text-muted-foreground">All</span>}</TableCell>
                                <TableCell>
                                  <Badge variant={rule.commission_type === "commission" ? "default" : "outline"} className="text-xs capitalize">
                                    {rule.commission_type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {rule.profit_type === "percentage" ? "Percentage (%)" : "Fixed"}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number" min={0} step={0.1}
                                    className="h-8 w-24 font-semibold text-primary"
                                    defaultValue={rule.amount}
                                    onBlur={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      if (val !== rule.amount) updateCommRuleAmount(rule, val);
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => removeCommRule(rule)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No rules for <span className="capitalize font-medium">{api}</span>. Add one above.</p>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>

            <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-2">
              <strong>Commission:</strong> Subtracted from the API base price (your earning). &nbsp;
              <strong>Discount:</strong> Applied as a reduction. &nbsp;
              Origin filter narrows when the rule applies. Leave blank for global. Changes save automatically on blur.
            </p>
          </CardContent>
        </Card>

        {/* AIT Settings Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">AIT (Advance Income Tax)</CardTitle>
                <CardDescription>
                  Per-provider AIT percentage applied to total fare. For commission tickets, AIT is deducted from commission. For markup-only tickets, AIT is added to the markup. Tracked separately for accounting.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="ait-toggle" className="text-sm font-medium">
                  {aitEnabled ? "Enabled" : "Disabled"}
                </Label>
                <input
                  id="ait-toggle"
                  type="checkbox"
                  checked={aitEnabled}
                  onChange={(e) => setAitEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {aitEnabled && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(API_LABELS).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-semibold">{label} AIT (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={aitPerApi[key] || 0}
                      onChange={(e) => setAitPerApi(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      placeholder="e.g. 0.3"
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            )}
            {!aitEnabled && (
              <p className="text-sm text-muted-foreground py-2">Enable AIT to configure per-provider tax percentages.</p>
            )}
            <div className="flex items-center gap-4 pt-2 border-t border-border">
              <Button onClick={saveAitSettings} disabled={aitSaving || !isAitDirty}>
                {aitSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save AIT Settings
              </Button>
              {isAitDirty && <Badge variant="outline" className="text-xs">Unsaved changes</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Percent className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Bulk Markup</CardTitle>
                <CardDescription>Apply a uniform markup percentage to all flights at once</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label>Markup Percentage (%)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={bulkMarkup}
                  onChange={(e) => setBulkMarkup(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 10"
                />
              </div>
              <Button onClick={applyBulk} disabled={saving === "bulk"}>
                {saving === "bulk" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Apply to All
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This will overwrite all individual markups. Use with caution.
            </p>
          </CardContent>
        </Card>

        {/* Per-Airline Markups */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Building className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Per-Airline Markup</CardTitle>
                <CardDescription>Set markup percentages by airline — applies to all flights of that airline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Airline</TableHead>
                  <TableHead>Flights</TableHead>
                  <TableHead className="w-32">Markup %</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(editedAirlineMarkups).sort().map((airline) => {
                  const count = flights.filter(f => f.airline === airline).length;
                  const current = editedAirlineMarkups[airline] ?? 0;
                  const original = airlineMarkups[airline] ?? 0;
                  const isDirty = current !== original;
                  return (
                    <TableRow key={airline}>
                      <TableCell className="font-medium">{airline}</TableCell>
                      <TableCell>{count} flight{count !== 1 ? "s" : ""}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          className="h-8 w-24"
                          value={current}
                          onChange={(e) => setEditedAirlineMarkups(prev => ({ ...prev, [airline]: parseFloat(e.target.value) || 0 }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={isDirty ? "default" : "ghost"}
                          disabled={!isDirty || saving === `airline-${airline}`}
                          onClick={() => applyAirlineMarkup(airline)}
                        >
                          {saving === `airline-${airline}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Object.keys(editedAirlineMarkups).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No airlines found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Plane className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Per-Flight Markups</CardTitle>
                <CardDescription>Set individual markup percentages for each flight</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Airline</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead className="w-32">Markup %</TableHead>
                  <TableHead>Customer Price</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flights.map((f) => {
                  const markup = editedMarkups[f.id] ?? f.markup_percentage;
                  const isDirty = markup !== f.markup_percentage;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.airline}</TableCell>
                      <TableCell>{f.from_city} → {f.to_city}</TableCell>
                      <TableCell>{f.class}</TableCell>
                      <TableCell>{formatPrice(f.price, "local_inventory")}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          className="h-8 w-24"
                          value={markup}
                          onChange={(e) => updateMarkup(f.id, parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatPrice(getFinalPrice(f.price, markup), "local_inventory")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={isDirty ? "default" : "ghost"}
                          disabled={!isDirty || saving === f.id}
                          onClick={() => saveSingle(f.id)}
                        >
                          {saving === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {flights.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No flights found. Add flights first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminMarkups;
