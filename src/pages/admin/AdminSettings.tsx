import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { cn } from "@/lib/utils";
import { invalidateThemeCache } from "@/hooks/useThemeColors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, Search, Paintbrush, Bell, Share2, BarChart3, Phone, Link, RefreshCw, Save,
  Users, Monitor, Palette, AppWindow, CalendarCheck, CreditCard, Plug, ShieldCheck, Clock, Loader2, Wallet, Sparkles, Smartphone, Upload, X, Image, Headphones, Mail
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import SmtpConfigCard from "@/components/admin/SmtpConfigCard";
import MarketCurrencySettings from "@/components/admin/MarketCurrencySettings";

const ImageUploadField = ({ label, value, onChange, bucket, folder }: { label: string; value: string; onChange: (url: string) => void; bucket: string; folder: string }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${folder}/${label.toLowerCase()}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(urlData.publicUrl);
      toast.success(`${label} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 space-y-2">
        {value && (
          <div className="relative inline-block">
            <img src={value} alt={label} className="h-12 w-auto object-contain rounded border border-border bg-muted p-1" />
            <button type="button" onClick={() => onChange("")} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`https://example.com/${label.toLowerCase()}.png`} className="flex-1" />
          <Button type="button" variant="outline" size="sm" disabled={uploading} className="shrink-0" asChild>
            <label className="cursor-pointer">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          </Button>
        </div>
      </div>
    </div>
  );
};

type SettingsTab = "general" | "seo" | "branding" | "themes" | "accounts" | "contact" | "notifications" | "social" | "tracking" | "apps" | "booking" | "payment" | "header" | "footer" | "ai" | "currency";

const tabDefs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "seo", label: "SEO", icon: Search },
  { id: "branding", label: "Branding", icon: Paintbrush },
  { id: "themes", label: "Themes", icon: Palette },
  { id: "accounts", label: "Accounts", icon: Users },
  { id: "contact", label: "Contact", icon: Phone },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "social", label: "Social", icon: Share2 },
  { id: "tracking", label: "Tracking", icon: BarChart3 },
  { id: "apps", label: "Apps", icon: AppWindow },
  { id: "booking", label: "Booking Options", icon: CalendarCheck },
  { id: "payment", label: "Payment Gateways", icon: CreditCard },
  { id: "header", label: "Header", icon: Monitor },
  { id: "footer", label: "Footer", icon: Settings },
  { id: "ai", label: "AI Trip Planner", icon: Sparkles },
  { id: "currency", label: "Currency Markets", icon: Wallet },
];

// Each tab maps to a provider key in api_settings
const providerKey = (tab: SettingsTab) => `site_${tab}`;

// Default settings per tab
const defaults: Record<SettingsTab, Record<string, any>> = {
  general: { site_name: "", tagline: "", default_currency: "BDT", default_language: "English", maintenance_mode: false, user_registration: true, show_prices_bdt: true },
  seo: { meta_title: "", meta_description: "", meta_keywords: "", sitemap_xml: "", sitemap_url_count: 0, sitemap_generated_at: "" },
  branding: { logo_url: "", favicon_url: "", footer_text: "", primary_color: "#2563eb", secondary_color: "#f59e0b", accent_color: "#10b981", color_background: "#f5f7fa", color_foreground: "#1e2a3b", color_primary: "#1570d6", color_primary_foreground: "#ffffff", color_secondary: "#edf1f7", color_secondary_foreground: "#2e3d52", color_accent: "#f07b16", color_accent_foreground: "#ffffff", color_muted: "#f0f3f6", color_muted_foreground: "#6b7a8d", color_destructive: "#e5453a", color_card: "#ffffff", color_card_foreground: "#1e2a3b", color_border: "#dce3ed" },
  themes: { font_family: "", dark_mode: false, rounded_corners: true },
  accounts: { email_verification: true, social_login: false, session_timeout: "60" },
  contact: { business_name: "", phone: "", whatsapp: "", email: "", address: "", maps_url: "", civil_aviation_license: "", iata_number: "", est_year: "", license_label: "" },
  notifications: { smtp_host: "", smtp_port: "", smtp_username: "", smtp_password: "", from_email: "", from_name: "", booking_confirmation: true, cancellation_emails: true, admin_notifications: true },
  social: { facebook: "", twitter: "", instagram: "", youtube: "", linkedin: "" },
  tracking: { ga_id: "", fb_pixel: "", gtm_id: "", head_scripts: "", footer_scripts: "" },
  apps: { whatsapp_widget: true, tawkto: false, google_reviews: false, crisp_enabled: true, whatsapp_number: "", tawkto_id: "", google_place_id: "", crisp_website_id: "7b6ec17d-256a-41e8-9732-17ff58bd51e9", crisp_bot_channels: { website: true, whatsapp: true, messenger: true, instagram: true, telegram: true, email: false, twitter: true, line: true, viber: true } },
  booking: { auto_confirm: false, guest_bookings: false, require_phone: true, booking_prefix: "TG-", allow_cancellations: true, cancellation_window: "24", cancellation_fee: "10" },
  payment: { stripe_enabled: false, bkash_enabled: true, nagad_enabled: false, alipay_enabled: false, bank_transfer_enabled: true, stripe_pk: "", stripe_sk: "", bkash_app_key: "", bkash_app_secret: "", bkash_username: "", bkash_password: "", alipay_app_id: "", alipay_private_key: "", alipay_public_key: "", alipay_sandbox: true, sandbox_mode: true },
  header: { show_phone: true, show_email: true, show_ai_concierge: true, show_city: true, show_issue_strip: true, show_tagline: true, ai_concierge_label: "AI Concierge", cta_label: "Plan a Journey" },
  footer: { description: "", copyright_text: "", quick_links: "Flights,Hotels,Tours,Blog", support_links: "Help Center,Cancellation Policy,Privacy Policy,Terms of Service", show_social_icons: true, show_contact_info: true, show_newsletter: false },
  ai: { ai_provider: "gemini", gemini_model: "gemini-2.5-flash", lovable_model: "google/gemini-2.5-flash", trip_planner_require_login: false },
  currency: {},
};

const SeoTab = ({ s, update, allSettings, setAllSettings }: { s: Record<string, any>; update: (key: string, value: any) => void; allSettings: Record<SettingsTab, Record<string, any>>; setAllSettings: React.Dispatch<React.SetStateAction<Record<SettingsTab, Record<string, any>>>> }) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const siteUrl = window.location.origin;
      const { data, error } = await supabase.functions.invoke('generate-sitemap', {
        body: { siteUrl },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Generation failed');

      const now = new Date().toISOString();
      const newSeo = { ...allSettings.seo, sitemap_xml: data.sitemap, sitemap_url_count: data.urlCount, sitemap_generated_at: now };
      await supabase.from("api_settings").upsert({ provider: "site_seo", settings: newSeo as any, is_active: true }, { onConflict: "provider" });
      setAllSettings((prev) => ({ ...prev, seo: newSeo }));
      toast.success(`Sitemap generated with ${data.urlCount} URLs`);
    } catch (err: any) {
      toast.error("Failed to generate sitemap: " + (err.message || err));
    }
    setGenerating(false);
  };

  const handleView = () => {
    if (!s.sitemap_xml) {
      toast.error("No sitemap generated yet. Click Generate first.");
      return;
    }
    const blob = new Blob([s.sitemap_xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            <CardTitle>SEO Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Meta Title</Label><Input value={s.meta_title} onChange={(e) => update("meta_title", e.target.value)} placeholder="Travel Vela - Book Flights at Best Prices" className="mt-1" /></div>
          <div><Label>Meta Description</Label><Textarea value={s.meta_description} onChange={(e) => update("meta_description", e.target.value)} placeholder="Website meta description" className="mt-1" rows={3} /></div>
          <div><Label>Meta Keywords</Label><Input value={s.meta_keywords} onChange={(e) => update("meta_keywords", e.target.value)} placeholder="website, business, service" className="mt-1" /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            <CardTitle>Sitemap</CardTitle>
          </div>
          <CardDescription>Generate and manage your website sitemap for search engines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleView}>
              <Link className="w-4 h-4" />View Sitemap
            </Button>
            <Button className="flex-1 gap-2" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {generating ? "Generating..." : "Generate"}
            </Button>
          </div>
          {s.sitemap_generated_at && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Last generated: {new Date(s.sitemap_generated_at).toLocaleString()}</p>
              <p>URLs indexed: {s.sitemap_url_count || 0}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as SettingsTab) || "general";
  const [allSettings, setAllSettings] = useState<Record<SettingsTab, Record<string, any>>>({ ...defaults });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setActiveTab = (tab: SettingsTab) => setSearchParams({ tab });

  // Load all site_* settings from api_settings
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("api_settings")
        .select("provider, settings")
        .like("provider", "site_%");

      if (data) {
        const merged = { ...defaults };
        data.forEach((row) => {
          const tab = row.provider.replace("site_", "") as SettingsTab;
          if (merged[tab]) {
            merged[tab] = { ...merged[tab], ...(row.settings as Record<string, any>) };
          }
        });
        setAllSettings(merged);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Update a field in the current tab's settings
  const update = useCallback((key: string, value: any) => {
    setAllSettings((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [key]: value },
    }));
  }, [activeTab]);

  const s = allSettings[activeTab];

  // Save current tab's settings
  const handleSave = async () => {
    setSaving(true);
    const provider = providerKey(activeTab);
    const { error } = await supabase
      .from("api_settings")
      .upsert({ provider, settings: s as any, is_active: true }, { onConflict: "provider" });

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Settings saved successfully");
      if (activeTab === "branding") {
        invalidateThemeCache();
        window.location.reload();
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your website configuration</p>
        </div>

        {/* Horizontal scrollable tabs */}
        <ScrollArea className="w-full">
          <div className="flex items-center gap-1 border-b border-border pb-0 min-w-max">
            {tabDefs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-colors relative ${
                  activeTab === tab.id
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Tab content */}
        <div>
          {activeTab === "general" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    <CardTitle>General Settings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Site Name</Label><Input value={s.site_name} onChange={(e) => update("site_name", e.target.value)} placeholder="Travel Vela" className="mt-1" /></div>
                  <div><Label>Tagline</Label><Input value={s.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Your Travel Partner" className="mt-1" /></div>
                  <div><Label>Default Currency</Label><Input value={s.default_currency} onChange={(e) => update("default_currency", e.target.value)} placeholder="BDT" className="mt-1" /></div>
                  <div><Label>Default Language</Label><Input value={s.default_language} onChange={(e) => update("default_language", e.target.value)} placeholder="English" className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-primary" />
                    <CardTitle>Site Options</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Maintenance Mode</Label><p className="text-xs text-muted-foreground">Take the site offline temporarily</p></div>
                    <Switch checked={s.maintenance_mode} onCheckedChange={(v) => update("maintenance_mode", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>User Registration</Label><p className="text-xs text-muted-foreground">Allow new user sign-ups</p></div>
                    <Switch checked={s.user_registration} onCheckedChange={(v) => update("user_registration", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Show Prices in BDT</Label><p className="text-xs text-muted-foreground">Display prices in local currency</p></div>
                    <Switch checked={s.show_prices_bdt} onCheckedChange={(v) => update("show_prices_bdt", v)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "seo" && (
            <SeoTab s={s} update={update} allSettings={allSettings} setAllSettings={setAllSettings} />
          )}

          {activeTab === "branding" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Paintbrush className="w-5 h-5 text-primary" />
                    <CardTitle>Brand Identity</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <ImageUploadField label="Logo" value={s.logo_url} onChange={(url) => update("logo_url", url)} bucket="assets" folder="branding" />
                  <ImageUploadField label="Favicon" value={s.favicon_url} onChange={(url) => update("favicon_url", url)} bucket="assets" folder="branding" />
                  <div><Label>Footer Text</Label><Input value={s.footer_text} onChange={(e) => update("footer_text", e.target.value)} placeholder="© 2026 Travel Vela. All rights reserved." className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card className="xl:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    <CardTitle>Site Color Palette</CardTitle>
                  </div>
                  <CardDescription>These colors control the entire site theme. Changes apply after saving.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {([
                      ["color_primary", "Primary"],
                      ["color_primary_foreground", "Primary Text"],
                      ["color_secondary", "Secondary"],
                      ["color_secondary_foreground", "Secondary Text"],
                      ["color_accent", "Accent"],
                      ["color_accent_foreground", "Accent Text"],
                      ["color_background", "Background"],
                      ["color_foreground", "Foreground Text"],
                      ["color_card", "Card Background"],
                      ["color_card_foreground", "Card Text"],
                      ["color_muted", "Muted Background"],
                      ["color_muted_foreground", "Muted Text"],
                      ["color_border", "Borders"],
                      ["color_destructive", "Destructive / Error"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                        <Input type="color" value={s[key] || "#000000"} onChange={(e) => update(key, e.target.value)} className="w-10 h-10 p-0.5 cursor-pointer rounded border-0 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{label}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s[key] || "#000000"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "themes" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  <CardTitle>Theme Settings</CardTitle>
                </div>
                <CardDescription>Customize the look and feel of your website</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Font Family</Label><Input value={s.font_family} onChange={(e) => update("font_family", e.target.value)} placeholder="Inter, sans-serif" className="mt-1" /></div>
                <div className="flex items-center justify-between">
                  <div><Label>Dark Mode</Label><p className="text-xs text-muted-foreground">Enable dark mode toggle for users</p></div>
                  <Switch checked={s.dark_mode} onCheckedChange={(v) => update("dark_mode", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Rounded Corners</Label><p className="text-xs text-muted-foreground">Use rounded UI elements</p></div>
                  <Switch checked={s.rounded_corners} onCheckedChange={(v) => update("rounded_corners", v)} />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "accounts" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <CardTitle>Account Settings</CardTitle>
                </div>
                <CardDescription>Configure user account behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label>Email Verification Required</Label><p className="text-xs text-muted-foreground">Users must verify email before login</p></div>
                  <Switch checked={s.email_verification} onCheckedChange={(v) => update("email_verification", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Allow Social Login</Label><p className="text-xs text-muted-foreground">Enable Google / Facebook sign-in</p></div>
                  <Switch checked={s.social_login} onCheckedChange={(v) => update("social_login", v)} />
                </div>
                <div><Label>Default User Role</Label><Input placeholder="user" className="mt-1" disabled /></div>
                <div><Label>Session Timeout (minutes)</Label><Input value={s.session_timeout} onChange={(e) => update("session_timeout", e.target.value)} placeholder="60" className="mt-1" /></div>
              </CardContent>
            </Card>
          )}

          {activeTab === "contact" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    <CardTitle>Contact Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Business Name</Label><Input value={s.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="Travel Vela Ltd." className="mt-1" /></div>
                  <div><Label>Phone Number</Label><Input value={s.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+880 1234 567890" className="mt-1" /></div>
                  <div><Label>WhatsApp Number</Label><Input value={s.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} placeholder="+880 1234 567890" className="mt-1" /></div>
                  <div><Label>Email Address</Label><Input value={s.email} onChange={(e) => update("email", e.target.value)} placeholder="info@travelvela.com" className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Link className="w-5 h-5 text-primary" />
                    <CardTitle>Address & Map</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Office Address</Label><Textarea value={s.address} onChange={(e) => update("address", e.target.value)} placeholder="123 Main Street, Dhaka, Bangladesh" className="mt-1" rows={2} /></div>
                  <div><Label>Google Maps Embed URL</Label><Input value={s.maps_url} onChange={(e) => update("maps_url", e.target.value)} placeholder="https://maps.google.com/..." className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <CardTitle>Licenses & Credentials</CardTitle>
                  </div>
                  <CardDescription>Displayed on e-tickets and official documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Civil Aviation License No.</Label><Input value={s.civil_aviation_license} onChange={(e) => update("civil_aviation_license", e.target.value)} placeholder="CAAB-XXXX-XXXX" className="mt-1" /></div>
                  <div><Label>IATA Number</Label><Input value={s.iata_number} onChange={(e) => update("iata_number", e.target.value)} placeholder="XX-X XXXX X" className="mt-1" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Established Year</Label>
                      <Input
                        type="number"
                        min="1900"
                        max={new Date().getFullYear()}
                        value={s.est_year || ""}
                        onChange={(e) => update("est_year", e.target.value)}
                        placeholder="2010"
                        className="mt-1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Shown in footer trust strip as "X+ years".</p>
                    </div>
                    <div>
                      <Label>License Badge Label</Label>
                      <Input
                        value={s.license_label || ""}
                        onChange={(e) => update("license_label", e.target.value)}
                        placeholder="IATA / Licensed / Bonded"
                        className="mt-1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">Optional — overrides the default "Licensed" footer label.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <SmtpConfigCard />
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    <CardTitle>Email Preferences</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Booking Confirmation</Label><p className="text-xs text-muted-foreground">Send email on new bookings</p></div>
                    <Switch checked={s.booking_confirmation} onCheckedChange={(v) => update("booking_confirmation", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Cancellation Emails</Label><p className="text-xs text-muted-foreground">Send email on cancellations</p></div>
                    <Switch checked={s.cancellation_emails} onCheckedChange={(v) => update("cancellation_emails", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Admin Notifications</Label><p className="text-xs text-muted-foreground">Notify admin on new bookings</p></div>
                    <Switch checked={s.admin_notifications} onCheckedChange={(v) => update("admin_notifications", v)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "social" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-primary" />
                  <CardTitle>Social Media Links</CardTitle>
                </div>
                <CardDescription>Add your social profile links — only profiles with URLs will appear in the footer. Leave blank to hide.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Facebook URL</Label><Input value={s.facebook} onChange={(e) => update("facebook", e.target.value)} placeholder="https://facebook.com/travelgo" className="mt-1" /></div>
                <div><Label>Twitter / X URL</Label><Input value={s.twitter} onChange={(e) => update("twitter", e.target.value)} placeholder="https://x.com/travelgo" className="mt-1" /></div>
                <div><Label>Instagram URL</Label><Input value={s.instagram} onChange={(e) => update("instagram", e.target.value)} placeholder="https://instagram.com/travelgo" className="mt-1" /></div>
                <div><Label>YouTube URL</Label><Input value={s.youtube} onChange={(e) => update("youtube", e.target.value)} placeholder="https://youtube.com/@travelgo" className="mt-1" /></div>
                <div><Label>LinkedIn URL</Label><Input value={s.linkedin} onChange={(e) => update("linkedin", e.target.value)} placeholder="https://linkedin.com/company/travelgo" className="mt-1" /></div>
              </CardContent>
            </Card>
          )}

          {activeTab === "tracking" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <CardTitle>Analytics</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Google Analytics ID</Label><Input value={s.ga_id} onChange={(e) => update("ga_id", e.target.value)} placeholder="G-XXXXXXXXXX" className="mt-1" /></div>
                  <div><Label>Facebook Pixel ID</Label><Input value={s.fb_pixel} onChange={(e) => update("fb_pixel", e.target.value)} placeholder="123456789" className="mt-1" /></div>
                  <div><Label>Google Tag Manager ID</Label><Input value={s.gtm_id} onChange={(e) => update("gtm_id", e.target.value)} placeholder="GTM-XXXXXXX" className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <CardTitle>Custom Scripts</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Custom Head Scripts</Label><Textarea value={s.head_scripts} onChange={(e) => update("head_scripts", e.target.value)} placeholder="<script>...</script>" className="mt-1 font-mono text-sm" rows={4} /></div>
                  <div><Label>Custom Footer Scripts</Label><Textarea value={s.footer_scripts} onChange={(e) => update("footer_scripts", e.target.value)} placeholder="<script>...</script>" className="mt-1 font-mono text-sm" rows={4} /></div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "apps" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AppWindow className="w-5 h-5 text-primary" />
                    <CardTitle>Installed Apps</CardTitle>
                  </div>
                  <CardDescription>Manage third-party app integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>WhatsApp Chat Widget</Label><p className="text-xs text-muted-foreground">Show floating WhatsApp button on site</p></div>
                    <Switch checked={s.whatsapp_widget} onCheckedChange={(v) => update("whatsapp_widget", v)} />
                  </div>
                   <div className="flex items-center justify-between">
                    <div><Label>Live Chat (Tawk.to)</Label><p className="text-xs text-muted-foreground">Embed live chat support widget</p></div>
                    <Switch checked={s.tawkto} onCheckedChange={(v) => update("tawkto", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Crisp Live Chat</Label><p className="text-xs text-muted-foreground">Crisp chat widget with Vela AI assistant</p></div>
                    <Switch checked={s.crisp_enabled} onCheckedChange={(v) => update("crisp_enabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Google Reviews Widget</Label><p className="text-xs text-muted-foreground">Display Google reviews on homepage</p></div>
                    <Switch checked={s.google_reviews} onCheckedChange={(v) => update("google_reviews", v)} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Plug className="w-5 h-5 text-primary" />
                    <CardTitle>App Configuration</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>WhatsApp Number</Label><Input value={s.whatsapp_number} onChange={(e) => update("whatsapp_number", e.target.value)} placeholder="+880 1234 567890" className="mt-1" /></div>
                  <div><Label>Tawk.to Property ID</Label><Input value={s.tawkto_id} onChange={(e) => update("tawkto_id", e.target.value)} placeholder="xxxxxxxxxxxxxxx" className="mt-1" /></div>
                  <div><Label>Crisp Website ID</Label><Input value={s.crisp_website_id} onChange={(e) => update("crisp_website_id", e.target.value)} placeholder="7b6ec17d-256a-41e8-9732-17ff58bd51e9" className="mt-1" /></div>
                  <div><Label>Google Place ID</Label><Input value={s.google_place_id} onChange={(e) => update("google_place_id", e.target.value)} placeholder="ChIJ..." className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Headphones className="w-5 h-5 text-primary" />
                    <CardTitle>Crisp AI Bot Channels</CardTitle>
                  </div>
                  <CardDescription>Choose which Crisp messaging channels the AI bot responds on. Disabled channels will be ignored by the bot (messages will still arrive for human agents).</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { key: "website", label: "Website Chat", desc: "Your website's live chat widget" },
                      { key: "whatsapp", label: "WhatsApp", desc: "WhatsApp Business integration" },
                      { key: "messenger", label: "Messenger", desc: "Facebook Messenger" },
                      { key: "instagram", label: "Instagram", desc: "Instagram Direct Messages" },
                      { key: "telegram", label: "Telegram", desc: "Telegram bot integration" },
                      { key: "email", label: "Email", desc: "Email conversations" },
                      { key: "twitter", label: "Twitter/X", desc: "Twitter DMs" },
                      { key: "line", label: "LINE", desc: "LINE messaging" },
                      { key: "viber", label: "Viber", desc: "Viber messaging" },
                    ].map((ch) => (
                      <div key={ch.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <Label className="text-sm">{ch.label}</Label>
                          <p className="text-xs text-muted-foreground">{ch.desc}</p>
                        </div>
                        <Switch
                          checked={s.crisp_bot_channels?.[ch.key] ?? (ch.key !== "email")}
                          onCheckedChange={(v) => {
                            const channels = { ...(s.crisp_bot_channels || {}), [ch.key]: v };
                            update("crisp_bot_channels", channels);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "booking" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-primary" />
                    <CardTitle>Booking Behavior</CardTitle>
                  </div>
                  <CardDescription>Control how bookings work on your site</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Auto-Confirm Bookings</Label><p className="text-xs text-muted-foreground">Automatically confirm without admin review</p></div>
                    <Switch checked={s.auto_confirm} onCheckedChange={(v) => update("auto_confirm", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Allow Guest Bookings</Label><p className="text-xs text-muted-foreground">Let users book without creating an account</p></div>
                    <Switch checked={s.guest_bookings} onCheckedChange={(v) => update("guest_bookings", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Require Phone Number</Label><p className="text-xs text-muted-foreground">Phone is mandatory during booking</p></div>
                    <Switch checked={s.require_phone} onCheckedChange={(v) => update("require_phone", v)} />
                  </div>
                  <div><Label>Booking ID Prefix</Label><Input value={s.booking_prefix} onChange={(e) => update("booking_prefix", e.target.value)} placeholder="TG-" className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <CardTitle>Cancellation Policy</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Allow Cancellations</Label><p className="text-xs text-muted-foreground">Users can cancel their bookings</p></div>
                    <Switch checked={s.allow_cancellations} onCheckedChange={(v) => update("allow_cancellations", v)} />
                  </div>
                  <div>
                    <Label>Cancellation Window (hours)</Label>
                    <Input value={s.cancellation_window} onChange={(e) => update("cancellation_window", e.target.value)} placeholder="24" type="number" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Hours before departure when cancellation is allowed</p>
                  </div>
                  <div><Label>Cancellation Fee (%)</Label><Input value={s.cancellation_fee} onChange={(e) => update("cancellation_fee", e.target.value)} placeholder="10" type="number" className="mt-1" /></div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "payment" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <CardTitle>Payment Gateways</CardTitle>
                  </div>
                  <CardDescription>Enable and configure payment methods</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Stripe</Label><p className="text-xs text-muted-foreground">Accept credit/debit cards globally</p></div>
                    <Switch checked={s.stripe_enabled} onCheckedChange={(v) => update("stripe_enabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>bKash</Label><p className="text-xs text-muted-foreground">Mobile banking for Bangladesh</p></div>
                    <Switch checked={s.bkash_enabled} onCheckedChange={(v) => update("bkash_enabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Nagad</Label><p className="text-xs text-muted-foreground">Digital financial service</p></div>
                    <Switch checked={s.nagad_enabled} onCheckedChange={(v) => update("nagad_enabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Alipay</Label><p className="text-xs text-muted-foreground">Alipay payments for Chinese Yuan (CNY)</p></div>
                    <Switch checked={s.alipay_enabled} onCheckedChange={(v) => update("alipay_enabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Bank Transfer</Label><p className="text-xs text-muted-foreground">Manual bank transfer payments</p></div>
                    <Switch checked={s.bank_transfer_enabled} onCheckedChange={(v) => update("bank_transfer_enabled", v)} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <CardTitle>Gateway Credentials</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Stripe Publishable Key</Label><Input value={s.stripe_pk} onChange={(e) => update("stripe_pk", e.target.value)} placeholder="pk_live_..." className="mt-1" /></div>
                  <div><Label>Stripe Secret Key</Label><Input type="password" value={s.stripe_sk} onChange={(e) => update("stripe_sk", e.target.value)} placeholder="sk_live_..." className="mt-1" /></div>
                  <div className="flex items-center justify-between pt-2">
                    <div><Label>Test / Sandbox Mode</Label><p className="text-xs text-muted-foreground">Use test credentials for development</p></div>
                    <Switch checked={s.sandbox_mode} onCheckedChange={(v) => update("sandbox_mode", v)} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    <CardTitle>bKash Credentials</CardTitle>
                  </div>
                  <CardDescription>bKash Tokenized Checkout API credentials (available only for BDT payments)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>App Key</Label><Input value={s.bkash_app_key} onChange={(e) => update("bkash_app_key", e.target.value)} placeholder="App Key from bKash PGW" className="mt-1" /></div>
                  <div><Label>App Secret</Label><Input type="password" value={s.bkash_app_secret} onChange={(e) => update("bkash_app_secret", e.target.value)} placeholder="••••••••" className="mt-1" /></div>
                  <div><Label>Username</Label><Input value={s.bkash_username} onChange={(e) => update("bkash_username", e.target.value)} placeholder="bKash merchant username" className="mt-1" /></div>
                  <div><Label>Password</Label><Input type="password" value={s.bkash_password} onChange={(e) => update("bkash_password", e.target.value)} placeholder="••••••••" className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <CardTitle>Alipay Credentials</CardTitle>
                  </div>
                  <CardDescription>Alipay Global Open Platform credentials (CNY payments only)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>App ID</Label><Input value={s.alipay_app_id} onChange={(e) => update("alipay_app_id", e.target.value)} placeholder="Alipay App ID" className="mt-1" /></div>
                  <div><Label>Private Key</Label><Input type="password" value={s.alipay_private_key} onChange={(e) => update("alipay_private_key", e.target.value)} placeholder="RSA2 Private Key" className="mt-1" /></div>
                  <div><Label>Alipay Public Key</Label><Input type="password" value={s.alipay_public_key} onChange={(e) => update("alipay_public_key", e.target.value)} placeholder="Alipay RSA2 Public Key" className="mt-1" /></div>
                  <div className="flex items-center justify-between pt-2">
                    <div><Label>Sandbox Mode</Label><p className="text-xs text-muted-foreground">Use Alipay sandbox for testing</p></div>
                    <Switch checked={s.alipay_sandbox} onCheckedChange={(v) => update("alipay_sandbox", v)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "header" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-primary" />
                    <CardTitle>Top Strip</CardTitle>
                  </div>
                  <CardDescription>The thin black "broadsheet" strip above the main header. Toggle which items appear there.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Show Top Strip</Label><p className="text-xs text-muted-foreground">Master toggle for the entire top strip</p></div>
                    <Switch checked={s.show_issue_strip !== false} onCheckedChange={(v) => update("show_issue_strip", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Show Phone</Label><p className="text-xs text-muted-foreground">Uses phone from Contact settings</p></div>
                    <Switch checked={s.show_phone !== false} onCheckedChange={(v) => update("show_phone", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Show Email</Label><p className="text-xs text-muted-foreground">Uses email from Contact settings</p></div>
                    <Switch checked={s.show_email !== false} onCheckedChange={(v) => update("show_email", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Show City Chip</Label><p className="text-xs text-muted-foreground">Displays your city in the top strip</p></div>
                    <Switch checked={s.show_city !== false} onCheckedChange={(v) => update("show_city", v)} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <CardTitle>AI Concierge & CTA</CardTitle>
                  </div>
                  <CardDescription>Control the AI link in the top strip and the primary CTA pill on the right.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Show AI Concierge Link</Label><p className="text-xs text-muted-foreground">Top-strip shortcut to the AI Trip Planner. Hide this if your plan doesn't include AI.</p></div>
                    <Switch checked={s.show_ai_concierge !== false} onCheckedChange={(v) => update("show_ai_concierge", v)} />
                  </div>
                  <div>
                    <Label>AI Concierge Label</Label>
                    <Input value={s.ai_concierge_label || ""} onChange={(e) => update("ai_concierge_label", e.target.value)} placeholder="AI Concierge" className="mt-1" />
                  </div>
                  <div>
                    <Label>Primary CTA Label</Label>
                    <Input value={s.cta_label || ""} onChange={(e) => update("cta_label", e.target.value)} placeholder="Plan a Journey" className="mt-1" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Show Tagline</Label><p className="text-xs text-muted-foreground">"The Travel Atelier" line under the wordmark</p></div>
                    <Switch checked={s.show_tagline !== false} onCheckedChange={(v) => update("show_tagline", v)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "footer" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    <CardTitle>Footer Content</CardTitle>
                  </div>
                  <CardDescription>Customize the footer text and description shown on your website</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Footer Description</Label><Textarea value={s.description} onChange={(e) => update("description", e.target.value)} placeholder="Your trusted travel partner. Search, compare, and book flights at the best prices worldwide." className="mt-1" rows={3} /></div>
                  <div><Label>Copyright Text</Label><Input value={s.copyright_text} onChange={(e) => update("copyright_text", e.target.value)} placeholder="© 2026 Travel Vela. All rights reserved." className="mt-1" /><p className="text-xs text-muted-foreground mt-1">Leave empty to auto-generate with site name</p></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Link className="w-5 h-5 text-primary" />
                    <CardTitle>Footer Links</CardTitle>
                  </div>
                  <CardDescription>Comma-separated list of link labels for each column</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div><Label>Quick Links (Explore)</Label><Input value={s.quick_links} onChange={(e) => update("quick_links", e.target.value)} placeholder="Flights,Hotels,Tours,Blog" className="mt-1" /><p className="text-xs text-muted-foreground mt-1">These link to /flights, /hotels, etc.</p></div>
                  <div><Label>Support Links</Label><Input value={s.support_links} onChange={(e) => update("support_links", e.target.value)} placeholder="Help Center,Cancellation Policy,Privacy Policy,Terms of Service" className="mt-1" /></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-primary" />
                    <CardTitle>Footer Options</CardTitle>
                  </div>
                  <CardDescription>Toggle footer sections on or off</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Show Social Icons</Label><p className="text-xs text-muted-foreground">Display social media links from Social settings</p></div>
                    <Switch checked={s.show_social_icons} onCheckedChange={(v) => update("show_social_icons", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Show Contact Info</Label><p className="text-xs text-muted-foreground">Display email, phone, and address from Contact settings</p></div>
                    <Switch checked={s.show_contact_info} onCheckedChange={(v) => update("show_contact_info", v)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <CardTitle>AI Provider</CardTitle>
                  </div>
                  <CardDescription>Choose which AI backend powers your Trip Planner</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <RadioGroup value={s.ai_provider || "gemini"} onValueChange={(v) => update("ai_provider", v)} className="space-y-4">
                    <div className={cn("flex items-start gap-4 p-4 rounded-xl border-2 transition-colors cursor-pointer", s.ai_provider === "gemini" ? "border-primary bg-primary/5" : "border-border")} onClick={() => update("ai_provider", "gemini")}>
                      <RadioGroupItem value="gemini" id="gemini" className="mt-1" />
                      <div>
                        <Label htmlFor="gemini" className="text-base font-semibold cursor-pointer">Google Gemini (Direct)</Label>
                        <p className="text-sm text-muted-foreground mt-1">Uses your own GOOGLE_AI_API_KEY secret. Model: {s.gemini_model || "gemini-2.5-flash"}</p>
                      </div>
                    </div>
                    <div className={cn("flex items-start gap-4 p-4 rounded-xl border-2 transition-colors cursor-pointer", s.ai_provider === "lovable" ? "border-primary bg-primary/5" : "border-border")} onClick={() => update("ai_provider", "lovable")}>
                      <RadioGroupItem value="lovable" id="lovable" className="mt-1" />
                      <div>
                        <Label htmlFor="lovable" className="text-base font-semibold cursor-pointer">Lovable AI Gateway</Label>
                        <p className="text-sm text-muted-foreground mt-1">Uses the pre-configured LOVABLE_API_KEY. Model: {s.lovable_model || "google/gemini-2.5-flash"}</p>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    <CardTitle>Model Configuration</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Gemini Model</Label>
                    <Input value={s.gemini_model} onChange={(e) => update("gemini_model", e.target.value)} placeholder="gemini-2.5-flash" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Used when provider is Google Gemini</p>
                  </div>
                  <div>
                    <Label>Lovable AI Model</Label>
                    <Input value={s.lovable_model} onChange={(e) => update("lovable_model", e.target.value)} placeholder="google/gemini-2.5-flash" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Used when provider is Lovable AI Gateway</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <CardTitle>Access Control</CardTitle>
                  </div>
                  <CardDescription>Control who can use the AI Trip Planner</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Require Login</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.trip_planner_require_login
                          ? "Only logged-in users can use the AI Trip Planner (recommended to control costs)"
                          : "Anyone can use the AI Trip Planner without logging in (rate-limited by IP)"}
                      </p>
                    </div>
                    <Switch
                      checked={s.trip_planner_require_login || false}
                      onCheckedChange={(v) => update("trip_planner_require_login", v)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "currency" && (
            <MarketCurrencySettings />
          )}

          <div className="mt-6">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
