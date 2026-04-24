import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MousePointerClick, DollarSign, TrendingUp, Loader2, Copy, Check,
  Wallet, Link2, Code2, Key, ExternalLink, ArrowUpRight, BarChart3,
  Plus, Trash2, Eye, EyeOff, Globe, Rocket, Megaphone,
} from "lucide-react";

// Quick-Launch and Campaigns belonged to the deleted affiliate quicklaunch
// system. They will be reintroduced in Phase 0c on top of the new skin
// architecture. For now we render lightweight placeholders so the dashboard
// continues to compile and show the affiliate's stats / payouts.
const AffiliateQuickLaunch = (_: { affiliateId: string; affiliateCode?: string }) => (
  <div className="p-8 text-center text-muted-foreground border rounded-lg">
    Quick-Launch site builder is being rebuilt on the new Skin System (Phase 0c).
  </div>
);
const AffiliateCampaigns = (_: { affiliateId: string; affiliateCode?: string }) => (
  <div className="p-8 text-center text-muted-foreground border rounded-lg">
    Campaign manager is being rebuilt on the new Skin System (Phase 0c).
  </div>
);
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useToast } from "@/hooks/use-toast";

interface Affiliate {
  id: string;
  affiliate_code: string;
  commission_rate: number;
  status: string;
  company_name: string;
  website_url: string;
  total_earnings: number;
  total_paid: number;
  wallet_balance: number;
  min_payout: number;
  base_currency: string;
  created_at: string;
}

interface Click {
  id: string;
  page_url: string;
  country: string;
  created_at: string;
}

interface Conversion {
  id: string;
  booking_amount: number;
  commission_rate: number;
  commission_amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_reference: string;
  created_at: string;
}

interface ApiKey {
  id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  allowed_domains: string[];
  last_used_at: string | null;
  created_at: string;
}

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { formatFromSource, convertFromSource, formatDirectPrice } = useCurrency();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [clicks, setClicks] = useState<Click[]>([]);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWidget, setCopiedWidget] = useState(false);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDomains, setNewKeyDomains] = useState("");
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

  const baseUrl = window.location.origin;

  // Restrict affiliate tools to B2C users only
  useEffect(() => {
    if (authLoading || !user) return;
    const checkUserType = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user.id)
        .maybeSingle();
      const type = data?.user_type || "b2c";
      setUserType(type);
      if (type !== "b2c") {
        toast({ title: "Access Denied", description: "The affiliate program is available for individual (B2C) users only.", variant: "destructive" });
        navigate("/dashboard");
      }
    };
    checkUserType();
  }, [user, authLoading]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: affData } = await supabase
      .from("affiliates")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (affData) {
      setAffiliate(affData as any);
      const [cl, co, pa, ak] = await Promise.all([
        supabase.from("affiliate_clicks").select("*").eq("affiliate_id", affData.id).order("created_at", { ascending: false }).limit(200),
        supabase.from("affiliate_conversions").select("*").eq("affiliate_id", affData.id).order("created_at", { ascending: false }).limit(200),
        supabase.from("affiliate_payouts").select("*").eq("affiliate_id", affData.id).order("created_at", { ascending: false }),
        supabase.from("affiliate_api_keys").select("*").eq("affiliate_id", affData.id).order("created_at", { ascending: false }),
      ]);
      setClicks((cl.data || []) as any);
      setConversions((co.data || []) as any);
      setPayouts((pa.data || []) as any);
      setApiKeys((ak.data || []) as any);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const applyAsAffiliate = async () => {
    if (!user) return;
    setApplyLoading(true);
    const { data: code } = await supabase.rpc("generate_affiliate_code");
    const { error } = await supabase.from("affiliates").insert({
      user_id: user.id,
      affiliate_code: code || `AFF${Date.now().toString(36).toUpperCase()}`,
      company_name: companyName,
      website_url: websiteUrl,
      status: "pending",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Application submitted!", description: "Your affiliate application is under review." });
    }
    setApplyLoading(false);
    fetchData();
  };

  const copyRefLink = () => {
    if (!affiliate) return;
    navigator.clipboard.writeText(`${baseUrl}?ref=${affiliate.affiliate_code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const widgetCode = affiliate
    ? `<iframe src="${baseUrl}/affiliate-widget?ref=${affiliate.affiliate_code}" style="width:100%;max-width:400px;height:320px;border:none;border-radius:12px;" />`
    : "";

  const copyWidget = () => {
    navigator.clipboard.writeText(widgetCode);
    setCopiedWidget(true);
    setTimeout(() => setCopiedWidget(false), 2000);
  };

  const requestPayout = async () => {
    if (!affiliate) return;
    const amount = Number(payoutAmount);
    if (amount <= 0 || amount > affiliate.wallet_balance) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (amount < affiliate.min_payout) {
      toast({
        title: `Minimum payout is ${formatFromSource(affiliate.min_payout, affiliate.base_currency || "USD")}`,
        variant: "destructive",
      });
      return;
    }
    await supabase.from("affiliate_payouts").insert({
      affiliate_id: affiliate.id,
      amount,
      currency: affiliate.base_currency || "USD",
      status: "pending",
    });
    toast({ title: "Payout requested" });
    setShowPayoutDialog(false);
    setPayoutAmount("");
    fetchData();
  };

  const generateApiKey = async () => {
    if (!affiliate) return;
    const key = `aff_${crypto.randomUUID().replace(/-/g, "")}`;
    const domains = newKeyDomains.split(",").map(d => d.trim()).filter(Boolean);
    await supabase.from("affiliate_api_keys").insert({
      affiliate_id: affiliate.id,
      api_key: key,
      name: newKeyName || "Default",
      allowed_domains: domains,
    });
    setNewKeyName("");
    setNewKeyDomains("");
    toast({ title: "API key created" });
    fetchData();
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("affiliate_api_keys").delete().eq("id", id);
    toast({ title: "API key deleted" });
    fetchData();
  };

  // Stats
  const todayClicks = clicks.filter(c => new Date(c.created_at).toDateString() === new Date().toDateString()).length;
  const conversionRate = clicks.length > 0 ? ((conversions.length / clicks.length) * 100).toFixed(1) : "0";

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-[hsl(152,70%,42%/0.12)] text-[hsl(152,70%,42%)]",
      pending: "bg-[hsl(38,92%,50%/0.12)] text-[hsl(38,92%,50%)]",
      rejected: "bg-destructive/10 text-destructive",
      completed: "bg-primary/10 text-primary",
    };
    return map[status] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  // Not an affiliate yet - show application form
  if (!affiliate) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-16 px-4">
          <Card className="border-border/50">
            <CardHeader className="text-center">
              <div className="mx-auto p-3 rounded-xl bg-primary/10 w-fit mb-3">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Join Our Affiliate Program</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Earn commissions by referring customers. Share your unique link and earn revenue on every booking.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Company / Website Name</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" />
              </div>
              <div>
                <Label className="text-xs">Website URL</Label>
                <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://yoursite.com" />
              </div>
              <Button className="w-full" onClick={applyAsAffiliate} disabled={applyLoading || !companyName}>
                {applyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Apply Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Pending approval
  if (affiliate.status === "pending") {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-16 px-4 text-center">
          <div className="mx-auto p-3 rounded-xl bg-[hsl(38,92%,50%/0.1)] w-fit mb-4">
            <Loader2 className="h-8 w-8 text-[hsl(38,92%,50%)]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Application Under Review</h2>
          <p className="text-sm text-muted-foreground mt-2">Your affiliate application is being reviewed. You'll be notified once approved.</p>
          <Badge variant="outline" className="mt-4 bg-[hsl(38,92%,50%/0.12)] text-[hsl(38,92%,50%)]">Pending Approval</Badge>
        </div>
      </Layout>
    );
  }

  if (affiliate.status === "rejected" || affiliate.status === "suspended") {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-16 px-4 text-center">
          <h2 className="text-2xl font-bold text-foreground">Account {affiliate.status === "rejected" ? "Rejected" : "Suspended"}</h2>
          <p className="text-sm text-muted-foreground mt-2">Please contact support for more information.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Affiliate Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Code: <span className="font-mono font-bold text-foreground">{affiliate.affiliate_code}</span> · {affiliate.commission_rate}% commission
            </p>
          </div>
          <Button onClick={copyRefLink} variant="outline" className="gap-2">
            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedLink ? "Copied!" : "Copy Referral Link"}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Clicks", value: clicks.length, sub: `${todayClicks} today`, icon: MousePointerClick, color: "hsl(205,100%,50%)" },
            { label: "Conversions", value: conversions.length, sub: `${conversionRate}% rate`, icon: ArrowUpRight, color: "hsl(152,70%,42%)" },
            { label: "Total Earnings", value: formatFromSource(affiliate.total_earnings, affiliate.base_currency || "USD"), sub: "lifetime", icon: DollarSign, color: "hsl(280,70%,55%)" },
            { label: "Wallet Balance", value: formatFromSource(affiliate.wallet_balance, affiliate.base_currency || "USD"), sub: "available", icon: Wallet, color: "hsl(18,100%,59%)" },
            { label: "Total Paid", value: formatFromSource(affiliate.total_paid, affiliate.base_currency || "USD"), sub: "withdrawn", icon: TrendingUp, color: "hsl(38,92%,50%)" },
          ].map(kpi => (
            <Card key={kpi.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="p-2 rounded-lg w-fit mb-2" style={{ background: `${kpi.color}15` }}>
                  <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="links" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="links" className="text-xs gap-1.5"><Link2 className="h-3.5 w-3.5" /> Links & Widget</TabsTrigger>
            <TabsTrigger value="clicks" className="text-xs gap-1.5"><MousePointerClick className="h-3.5 w-3.5" /> Clicks</TabsTrigger>
            <TabsTrigger value="conversions" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Conversions</TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs gap-1.5"><Wallet className="h-3.5 w-3.5" /> Payouts</TabsTrigger>
            <TabsTrigger value="api" className="text-xs gap-1.5"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
            <TabsTrigger value="mysite" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" /> My Site</TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Campaigns</TabsTrigger>
          </TabsList>

          {/* Links & Widget Tab */}
          <TabsContent value="links" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Referral Link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input readOnly value={`${baseUrl}?ref=${affiliate.affiliate_code}`} className="font-mono text-xs" />
                    <Button size="sm" variant="outline" onClick={copyRefLink}>
                      {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link anywhere. When visitors book through it, you earn {affiliate.commission_rate}% commission.
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Deep links</p>
                    {["/flights", "/hotels", "/tours"].map(path => (
                      <div key={path} className="flex items-center gap-2 text-xs">
                        <code className="bg-muted px-2 py-1 rounded text-[11px] flex-1 truncate">{baseUrl}{path}?ref={affiliate.affiliate_code}</code>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          navigator.clipboard.writeText(`${baseUrl}${path}?ref=${affiliate.affiliate_code}`);
                          toast({ title: "Copied!" });
                        }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4" /> Embeddable Widget</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <pre className="bg-muted p-3 rounded-lg text-[11px] font-mono whitespace-pre-wrap break-all">{widgetCode}</pre>
                    <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-7" onClick={copyWidget}>
                      {copiedWidget ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Embed this search widget on your website. All bookings made through it will be tracked automatically.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Clicks Tab */}
          <TabsContent value="clicks">
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Page</TableHead>
                    <TableHead className="text-xs">Country</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clicks.slice(0, 50).map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs truncate max-w-[300px]">{c.page_url || "/"}</TableCell>
                      <TableCell className="text-xs">{c.country || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {clicks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No clicks recorded yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Conversions Tab */}
          <TabsContent value="conversions">
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Booking Amount</TableHead>
                    <TableHead className="text-xs">Rate</TableHead>
                    <TableHead className="text-xs">Commission</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversions.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm">{formatFromSource(c.booking_amount, c.currency || "USD")}</TableCell>
                      <TableCell className="text-sm">{c.commission_rate}%</TableCell>
                      <TableCell className="text-sm font-medium text-[hsl(152,70%,42%)]">{formatFromSource(c.commission_amount, c.currency || "USD")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge(c.status)}>{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {conversions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No conversions yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Available balance: <span className="font-bold text-foreground">{formatFromSource(affiliate.wallet_balance, affiliate.base_currency || "USD")}</span></p>
                <p className="text-xs text-muted-foreground">Minimum payout: {formatFromSource(affiliate.min_payout, affiliate.base_currency || "USD")}</p>
              </div>
              <Button onClick={() => setShowPayoutDialog(true)} disabled={affiliate.wallet_balance < affiliate.min_payout}>
                Request Payout
              </Button>
            </div>
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm font-medium">{formatFromSource(p.amount, p.currency || "USD")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge(p.status)}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.payment_reference || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {payouts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No payouts yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">API Access</CardTitle>
                <p className="text-xs text-muted-foreground">Use API keys to integrate search and booking into your platform.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Key Name</Label>
                    <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="My Website" className="h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Allowed Domains (comma-separated)</Label>
                    <Input value={newKeyDomains} onChange={e => setNewKeyDomains(e.target.value)} placeholder="example.com, app.example.com" className="h-9 text-sm" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={generateApiKey} size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Generate Key
                    </Button>
                  </div>
                </div>

                {apiKeys.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Key</TableHead>
                        <TableHead className="text-xs">Domains</TableHead>
                        <TableHead className="text-xs">Last Used</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map(k => (
                        <TableRow key={k.id}>
                          <TableCell className="text-sm">{k.name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {showKeyId === k.id ? k.api_key : `${k.api_key.slice(0, 12)}...`}
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowKeyId(showKeyId === k.id ? null : k.id)}>
                                {showKeyId === k.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                                navigator.clipboard.writeText(k.api_key);
                                toast({ title: "Copied!" });
                              }}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{k.allowed_domains?.join(", ") || "Any"}</TableCell>
                          <TableCell className="text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => deleteApiKey(k.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-foreground">API Documentation</p>
                  <p className="text-xs text-muted-foreground">Base URL: <code className="bg-background px-1.5 py-0.5 rounded">{baseUrl}/api/affiliate</code></p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><code className="bg-background px-1.5 py-0.5 rounded">GET /search/flights</code> — Search flights</p>
                    <p><code className="bg-background px-1.5 py-0.5 rounded">GET /search/hotels</code> — Search hotels</p>
                    <p>Include header: <code className="bg-background px-1.5 py-0.5 rounded">X-Affiliate-Key: your_api_key</code></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Quick-Launch site */}
          <TabsContent value="mysite">
            <AffiliateQuickLaunch affiliateId={affiliate.id} affiliateCode={affiliate.affiliate_code} />
          </TabsContent>

          {/* Marketing campaigns */}
          <TabsContent value="campaigns">
            <AffiliateCampaigns affiliateId={affiliate.id} affiliateCode={affiliate.affiliate_code} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Payout Request Dialog */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Available balance: <span className="font-bold text-foreground">{formatFromSource(affiliate.wallet_balance, affiliate.base_currency || "USD")}</span>
            </p>
            <div>
              <Label className="text-xs">Amount ({affiliate.base_currency || "USD"})</Label>
              <Input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} min={affiliate.min_payout} max={affiliate.wallet_balance} />
              <p className="text-[10px] text-muted-foreground mt-1">
                Minimum: {formatFromSource(affiliate.min_payout, affiliate.base_currency || "USD")} · Paid in {affiliate.base_currency || "USD"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)}>Cancel</Button>
            <Button onClick={requestPayout}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AffiliateDashboard;
