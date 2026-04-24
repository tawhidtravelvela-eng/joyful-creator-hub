import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Code, Key, BarChart3, Copy, Check, Eye, EyeOff, RefreshCw,
  Plane, Building2, Map, ChevronRight, BookOpen, Zap, Shield,
  AlertTriangle, Terminal, Globe, Loader2, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
}

interface ApiKeySet {
  id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  last_used_at: string | null;
  created_at: string;
}

const BASE_URL = `https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1`;

const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl bg-[hsl(222,30%,8%)] border border-border/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <span className="text-[10px] font-mono text-white/30 uppercase">{language}</span>
        <button onClick={handleCopy} className="text-white/40 hover:text-white/80 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono text-success/90">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const EndpointCard = ({ method, path, description, children }: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  children?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const methodColors = {
    GET: "bg-success/50/15 text-success border-success/50/20",
    POST: "bg-info/50/15 text-info border-info/50/20",
    PUT: "bg-warning/50/15 text-warning border-warning/50/20",
    DELETE: "bg-danger/50/15 text-danger border-danger/50/20",
  };
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left">
        <Badge variant="outline" className={cn("font-mono text-[10px] px-2 py-0.5 border", methodColors[method])}>{method}</Badge>
        <code className="text-sm font-mono text-foreground flex-1">{path}</code>
        <span className="text-xs text-muted-foreground hidden sm:block max-w-[200px] truncate">{description}</span>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="border-t border-border/50 p-4 bg-muted/20 space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          {children}
        </div>
      )}
    </div>
  );
};

const ApiDocumentation = ({ userId }: Props) => {
  const { toast } = useToast();
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [keys, setKeys] = useState<{ sandbox?: ApiKeySet; production?: ApiKeySet }>({});
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [generatingKey, setGeneratingKey] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, [userId]);

  const fetchKeys = async () => {
    setLoading(true);
    // Fetch affiliate record to get affiliate_id
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!affiliate) { setLoading(false); return; }

    const { data: apiKeys } = await supabase
      .from("affiliate_api_keys" as any)
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: true });

    const keyList = (apiKeys || []) as any[];
    const sandboxKey = keyList.find((k: any) => k.name?.includes("Sandbox") || k.name?.includes("sandbox"));
    const prodKey = keyList.find((k: any) => k.name?.includes("Production") || k.name?.includes("production"));

    setKeys({
      sandbox: sandboxKey || undefined,
      production: prodKey || undefined,
    });
    setLoading(false);
  };

  const generateKeys = async () => {
    setGeneratingKey(true);
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!affiliate) {
      toast({ title: "Error: Affiliate account not found", variant: "destructive" });
      setGeneratingKey(false);
      return;
    }

    const sandboxKey = "tvk_sandbox_" + crypto.randomUUID().replace(/-/g, "");
    const prodKey = "tvk_prod_" + crypto.randomUUID().replace(/-/g, "");

    await Promise.all([
      supabase.from("affiliate_api_keys" as any).insert({
        affiliate_id: affiliate.id,
        api_key: sandboxKey,
        name: "Sandbox API Key",
        is_active: true,
        rate_limit_per_minute: 120,
      }),
      supabase.from("affiliate_api_keys" as any).insert({
        affiliate_id: affiliate.id,
        api_key: prodKey,
        name: "Production API Key",
        is_active: true,
        rate_limit_per_minute: 60,
      }),
    ]);

    await fetchKeys();
    setGeneratingKey(false);
    toast({ title: "API keys generated!", description: "Both sandbox and production keys are ready." });
  };

  const toggleReveal = (id: string) => setRevealedKeys(prev => ({ ...prev, [id]: !prev[id] }));

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "API key copied to clipboard" });
  };

  const activeKey = env === "sandbox" ? keys.sandbox : keys.production;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> API Documentation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Full REST API reference for flights, hotels & tours</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-1 rounded-full bg-muted/60 border border-border/50">
            <button
              onClick={() => setEnv("sandbox")}
              className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                env === "sandbox" ? "bg-warning/50/15 text-warning shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              🧪 Sandbox
            </button>
            <button
              onClick={() => setEnv("production")}
              className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                env === "production" ? "bg-success/50/15 text-success shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              🚀 Production
            </button>
          </div>
        </div>
      </div>

      {/* Environment Banner */}
      <div className={cn(
        "rounded-xl border p-4 flex items-start gap-3",
        env === "sandbox"
          ? "bg-warning/50/5 border-warning/50/20"
          : "bg-success/50/5 border-success/50/20"
      )}>
        {env === "sandbox" ? (
          <AlertTriangle className="w-5 h-5 text-warning0 flex-shrink-0 mt-0.5" />
        ) : (
          <Shield className="w-5 h-5 text-success0 flex-shrink-0 mt-0.5" />
        )}
        <div>
          <h3 className="text-sm font-bold">{env === "sandbox" ? "Sandbox Environment" : "Production Environment"}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {env === "sandbox"
              ? "Uses sample data. No real bookings are created. Rate limit: 120 req/min. Perfect for testing & development."
              : "Live data. Real bookings are created and wallet is charged. Rate limit: 60 req/min. Booking costs are deducted from your wallet."}
          </p>
        </div>
      </div>

      {/* API Keys */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4 text-primary" /> API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {!keys.sandbox && !keys.production ? (
            <div className="text-center py-6 space-y-3">
              <Key className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No API keys generated yet.</p>
              <Button onClick={generateKeys} disabled={generatingKey} className="gap-2">
                {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Generate API Keys
              </Button>
              <p className="text-xs text-muted-foreground">This will create both sandbox and production keys.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Sandbox", key: keys.sandbox, badge: "bg-warning/50/15 text-warning" },
                { label: "Production", key: keys.production, badge: "bg-success/50/15 text-success" },
              ].map(({ label, key, badge }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", badge)}>{label}</Badge>
                  <code className="text-xs font-mono flex-1 truncate text-muted-foreground">
                    {key ? (revealedKeys[key.id] ? key.api_key : key.api_key.slice(0, 16) + "••••••••••••") : "Not generated"}
                  </code>
                  {key && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleReveal(key.id)}>
                        {revealedKeys[key.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyKey(key.api_key)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Terminal className="w-4 h-4 text-primary" /> Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Base URL</h4>
            <CodeBlock code={`${BASE_URL}/tenant-api`} language="url" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Authentication</h4>
            <p className="text-xs text-muted-foreground mb-2">Include your API key in the <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">x-api-key</code> header with every request.</p>
            <CodeBlock code={`curl -X POST "${BASE_URL}/tenant-api" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${activeKey?.api_key || 'YOUR_API_KEY'}" \\
  -H "x-api-env: ${env}" \\
  -d '{
    "action": "flight_search",
    "params": {
      "from": "DAC",
      "to": "DXB",
      "date": "2026-04-15",
      "adults": 1,
      "cabin_class": "Economy"
    }
  }'`} language="bash" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Environment Header</h4>
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">x-api-env: sandbox</code> for testing with sample data, or <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">x-api-env: production</code> for live operations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Tabs defaultValue="flights" className="space-y-4">
        <TabsList className="bg-muted/40 h-auto p-1 flex-wrap">
          <TabsTrigger value="flights" className="gap-1.5 text-xs"><Plane className="w-3.5 h-3.5" /> Flights</TabsTrigger>
          <TabsTrigger value="hotels" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Hotels</TabsTrigger>
          <TabsTrigger value="tours" className="gap-1.5 text-xs"><Map className="w-3.5 h-3.5" /> Tours</TabsTrigger>
          <TabsTrigger value="booking" className="gap-1.5 text-xs"><BookOpen className="w-3.5 h-3.5" /> Booking</TabsTrigger>
        </TabsList>

        {/* Flights */}
        <TabsContent value="flights" className="space-y-3">
          <EndpointCard method="POST" path="/tenant-api" description="Search flights across all providers">
            <div className="space-y-3">
              <h5 className="text-xs font-bold">Request Body</h5>
              <CodeBlock code={`{
  "action": "flight_search",
  "params": {
    "from": "DAC",          // IATA code
    "to": "DXB",            // IATA code
    "date": "2026-04-15",   // YYYY-MM-DD
    "return_date": "2026-04-22",  // optional (round-trip)
    "adults": 1,
    "children": 0,
    "infants": 0,
    "cabin_class": "Economy",  // Economy | Business | First
    "direct_only": false,
    "student_fare": false
  }
}`} language="json" />
              <h5 className="text-xs font-bold">Response</h5>
              <CodeBlock code={`{
  "success": true,
  "data": {
    "results": [
      {
        "id": "result_id",
        "provider": "tripjack",
        "airline": { "code": "EK", "name": "Emirates" },
        "departure": { "airport": "DAC", "time": "2026-04-15T08:30:00" },
        "arrival": { "airport": "DXB", "time": "2026-04-15T14:45:00" },
        "duration": "6h 15m",
        "stops": 0,
        "price": { "amount": 450.00, "currency": "USD" },
        "fare_class": "V",
        "baggage": { "cabin": "7 Kg", "checkin": "30 Kg" },
        "refundable": false,
        "seats_available": 4
      }
    ],
    "search_id": "search_abc123",
    "total_results": 24
  }
}`} language="json" />
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Get fare details and verify pricing">
            <CodeBlock code={`{
  "action": "flight_price",
  "params": {
    "search_id": "search_abc123",
    "result_id": "result_id",
    "provider": "tripjack"
  }
}`} language="json" />
            <div className="mt-3">
              <h5 className="text-xs font-bold mb-2">Response</h5>
              <CodeBlock code={`{
  "success": true,
  "data": {
    "price_valid": true,
    "price": { "amount": 450.00, "currency": "USD" },
    "fare_rules": { ... },
    "baggage": { "cabin": "7 Kg", "checkin": "30 Kg" },
    "booking_token": "book_token_xyz"
  }
}`} language="json" />
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Get fare rules for a flight">
            <CodeBlock code={`{
  "action": "flight_fare_rules",
  "params": {
    "search_id": "search_abc123",
    "result_id": "result_id",
    "provider": "tripjack"
  }
}`} language="json" />
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Get SSR (meals, seats, baggage)">
            <CodeBlock code={`{
  "action": "flight_ssr",
  "params": {
    "search_id": "search_abc123",
    "result_id": "result_id",
    "provider": "tripjack"
  }
}`} language="json" />
          </EndpointCard>
        </TabsContent>

        {/* Hotels */}
        <TabsContent value="hotels" className="space-y-3">
          <EndpointCard method="POST" path="/tenant-api" description="Search hotels by city or location">
            <CodeBlock code={`{
  "action": "hotel_search",
  "params": {
    "city": "Dubai",
    "country": "UAE",
    "checkin": "2026-04-15",
    "checkout": "2026-04-18",
    "adults": 2,
    "children": 0,
    "rooms": 1,
    "nationality": "BD",
    "stars": [4, 5],         // optional filter
    "max_price": 500         // optional
  }
}`} language="json" />
            <div className="mt-3">
              <h5 className="text-xs font-bold mb-2">Response</h5>
              <CodeBlock code={`{
  "success": true,
  "data": {
    "session_id": "hsess_abc123",
    "hotels": [
      {
        "id": "hotel_id",
        "name": "JW Marriott Marquis",
        "stars": 5,
        "address": "Sheikh Zayed Road",
        "image": "https://...",
        "location": { "lat": 25.19, "lng": 55.27 },
        "rooms": [
          {
            "room_id": "room_abc",
            "name": "Deluxe King Room",
            "price": { "amount": 320, "currency": "USD" },
            "cancellation": "Free cancellation until Apr 13",
            "meal_plan": "Breakfast included",
            "max_occupancy": 3
          }
        ]
      }
    ],
    "total_hotels": 85
  }
}`} language="json" />
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Get hotel room pricing & availability">
            <CodeBlock code={`{
  "action": "hotel_price",
  "params": {
    "session_id": "hsess_abc123",
    "hotel_id": "hotel_id",
    "room_id": "room_abc"
  }
}`} language="json" />
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Review hotel before booking">
            <CodeBlock code={`{
  "action": "hotel_review",
  "params": {
    "session_id": "hsess_abc123",
    "hotel_id": "hotel_id",
    "room_id": "room_abc"
  }
}`} language="json" />
          </EndpointCard>
        </TabsContent>

        {/* Tours */}
        <TabsContent value="tours" className="space-y-3">
          <EndpointCard method="POST" path="/tenant-api" description="Search tours and activities">
            <CodeBlock code={`{
  "action": "tour_search",
  "params": {
    "destination": "Bali",
    "date": "2026-04-15",
    "travelers": 2,
    "category": "adventure"  // optional
  }
}`} language="json" />
            <div className="mt-3">
              <h5 className="text-xs font-bold mb-2">Response</h5>
              <CodeBlock code={`{
  "success": true,
  "data": {
    "tours": [
      {
        "id": "tour_id",
        "name": "Bali Swing & Rice Terrace Tour",
        "duration": "8 hours",
        "price": { "amount": 65, "currency": "USD" },
        "rating": 4.8,
        "reviews_count": 1240,
        "image": "https://...",
        "highlights": ["Tegallalang Rice Terrace", "Bali Swing", "Lunch included"],
        "cancellation": "Free cancellation 24h before"
      }
    ],
    "total_results": 42
  }
}`} language="json" />
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Get tour availability for specific date">
            <CodeBlock code={`{
  "action": "tour_availability",
  "params": {
    "tour_id": "tour_id",
    "date": "2026-04-15",
    "travelers": 2
  }
}`} language="json" />
          </EndpointCard>
        </TabsContent>

        {/* Booking */}
        <TabsContent value="booking" className="space-y-3">
          <EndpointCard method="POST" path="/tenant-api" description="Create a booking (flight, hotel or tour)">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-warning/50/5 border border-warning/50/20 flex items-start gap-2">
                <Lock className="w-4 h-4 text-warning0 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Wallet Deduction:</strong> The booking cost is automatically deducted from your wallet balance. Ensure sufficient balance before booking. Follows same pricing model as White Label purchases.
                </p>
              </div>
              <h5 className="text-xs font-bold">Flight Booking</h5>
              <CodeBlock code={`{
  "action": "book_flight",
  "params": {
    "booking_token": "book_token_xyz",
    "passengers": [
      {
        "title": "Mr",
        "first_name": "John",
        "last_name": "Doe",
        "dob": "1990-05-15",
        "nationality": "BD",
        "passport_number": "AB1234567",
        "passport_expiry": "2030-12-31",
        "passport_country": "BD",
        "type": "adult"
      }
    ],
    "contact": {
      "email": "john@example.com",
      "phone": "+8801712345678",
      "country_code": "BD"
    }
  }
}`} language="json" />
              <h5 className="text-xs font-bold">Hotel Booking</h5>
              <CodeBlock code={`{
  "action": "book_hotel",
  "params": {
    "session_id": "hsess_abc123",
    "hotel_id": "hotel_id",
    "room_id": "room_abc",
    "guests": [
      {
        "title": "Mr",
        "first_name": "John",
        "last_name": "Doe"
      }
    ],
    "contact": {
      "email": "john@example.com",
      "phone": "+8801712345678"
    }
  }
}`} language="json" />
              <h5 className="text-xs font-bold">Booking Response</h5>
              <CodeBlock code={`{
  "success": true,
  "data": {
    "booking_id": "BK-20260415-ABC123",
    "confirmation_number": "CONF-XYZ789",
    "status": "Confirmed",
    "total": { "amount": 450.00, "currency": "USD" },
    "wallet_deducted": 450.00,
    "wallet_remaining": 1550.00
  }
}`} language="json" />
            </div>
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Retrieve booking details">
            <CodeBlock code={`{
  "action": "get_booking",
  "params": {
    "booking_id": "BK-20260415-ABC123"
  }
}`} language="json" />
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="List all bookings">
            <CodeBlock code={`{
  "action": "list_bookings",
  "params": {
    "page": 1,
    "limit": 20,
    "status": "Confirmed",   // optional filter
    "type": "Flight"         // optional filter
  }
}`} language="json" />
          </EndpointCard>

          <EndpointCard method="POST" path="/tenant-api" description="Request booking cancellation">
            <CodeBlock code={`{
  "action": "cancel_booking",
  "params": {
    "booking_id": "BK-20260415-ABC123",
    "reason": "Customer requested cancellation"
  }
}`} language="json" />
          </EndpointCard>
        </TabsContent>
      </Tabs>

      {/* Error Codes */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Error Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            {[
              { code: 400, message: "Bad Request", description: "Invalid parameters or missing required fields" },
              { code: 401, message: "Unauthorized", description: "Missing or invalid API key" },
              { code: 402, message: "Payment Required", description: "Insufficient wallet balance for booking" },
              { code: 403, message: "Forbidden", description: "API key doesn't have access to this environment" },
              { code: 404, message: "Not Found", description: "Resource not found (expired search, invalid booking ID)" },
              { code: 409, message: "Conflict", description: "Booking already exists or price changed" },
              { code: 429, message: "Too Many Requests", description: "Rate limit exceeded. Retry after cooldown." },
              { code: 500, message: "Internal Error", description: "Server error. Contact support if persistent." },
            ].map((err) => (
              <div key={err.code} className="flex items-center gap-4 py-2.5">
                <Badge variant="outline" className="font-mono text-xs w-12 justify-center">{err.code}</Badge>
                <span className="text-sm font-medium w-40">{err.message}</span>
                <span className="text-xs text-muted-foreground flex-1">{err.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SDKs & Rate Limits */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Rate Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm p-2.5 rounded-lg bg-warning/50/5 border border-warning/50/15">
              <span className="text-muted-foreground">Sandbox</span>
              <span className="font-bold text-warning">120 requests/min</span>
            </div>
            <div className="flex justify-between text-sm p-2.5 rounded-lg bg-success/50/5 border border-success/50/15">
              <span className="text-muted-foreground">Production</span>
              <span className="font-bold text-success">60 requests/min</span>
            </div>
            <p className="text-xs text-muted-foreground">Rate limit headers are included in every response: <code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code></p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Code className="w-4 h-4 text-primary" /> SDK Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="javascript" className="space-y-3">
              <TabsList className="h-8 bg-muted/40">
                <TabsTrigger value="javascript" className="text-[11px]">JavaScript</TabsTrigger>
                <TabsTrigger value="python" className="text-[11px]">Python</TabsTrigger>
                <TabsTrigger value="php" className="text-[11px]">PHP</TabsTrigger>
              </TabsList>
              <TabsContent value="javascript">
                <CodeBlock code={`const res = await fetch("${BASE_URL}/tenant-api", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_API_KEY",
    "x-api-env": "sandbox"
  },
  body: JSON.stringify({
    action: "flight_search",
    params: { from: "DAC", to: "DXB", date: "2026-04-15", adults: 1 }
  })
});
const data = await res.json();`} language="javascript" />
              </TabsContent>
              <TabsContent value="python">
                <CodeBlock code={`import requests

response = requests.post(
    "${BASE_URL}/tenant-api",
    headers={
        "Content-Type": "application/json",
        "x-api-key": "YOUR_API_KEY",
        "x-api-env": "sandbox"
    },
    json={
        "action": "flight_search",
        "params": {"from": "DAC", "to": "DXB", "date": "2026-04-15", "adults": 1}
    }
)
data = response.json()`} language="python" />
              </TabsContent>
              <TabsContent value="php">
                <CodeBlock code={`$ch = curl_init("${BASE_URL}/tenant-api");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "x-api-key: YOUR_API_KEY",
    "x-api-env: sandbox"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "action" => "flight_search",
    "params" => ["from" => "DAC", "to" => "DXB", "date" => "2026-04-15", "adults" => 1]
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch));`} language="php" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Wallet & Billing Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Billing & Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> <span>All <strong className="text-foreground">production bookings</strong> deduct from your wallet balance automatically.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> <span><strong className="text-foreground">Sandbox bookings</strong> use sample data — no wallet charges.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> <span>Booking pricing follows the same deduction model as White Label bookings — base cost + applicable markups.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> <span>Ensure sufficient wallet balance before making production booking calls. A <code className="bg-muted px-1 rounded text-foreground">402</code> error is returned if balance is insufficient.</span></li>
            <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /> <span>Top up your wallet from the <strong className="text-foreground">Wallet & Billing</strong> section of your dashboard.</span></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiDocumentation;
