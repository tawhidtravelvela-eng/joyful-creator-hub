import { useState, useRef } from "react";
import { useB2B } from "@/contexts/B2BContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Building2, User, Shield, Lock, Bell, Save, Key, Camera, Loader2, ImageIcon, Upload, Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useBrandTheme } from "@/hooks/useBrandTheme";

type SettingsTab = "profile" | "security" | "notifications";

export const B2BSettings = () => {
  const { profile, refresh } = useB2B();
  const { user } = useAuth();
  const { brandColor, isLocked, setManualColor, resetToAuto, reExtractFromLogo } = useBrandTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState(profile.company_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [companyAddress, setCompanyAddress] = useState(profile.company_address || "");
  const [country, setCountry] = useState(profile.country || "");
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "AG";

  const tabs: { label: string; value: SettingsTab; icon: any }[] = [
    { label: "Agency Profile", value: "profile", icon: Building2 },
    { label: "Security", value: "security", icon: Shield },
    { label: "Notifications", value: "notifications", icon: Bell },
  ];

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload failed: " + uploadError.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl } as any).eq("user_id", user.id);
    setUploading(false);
    if (updateError) { toast.error("Failed to save: " + updateError.message); return; }
    toast.success("Profile photo updated");
    refresh();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }

    setUploadingLogo(true);
    const ext = file.name.split(".").pop();
    const path = `logos/${user.id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("assets").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload failed: " + uploadError.message); setUploadingLogo(false); return; }

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    const logoUrl = urlData.publicUrl + "?t=" + Date.now();
    const { error: updateError } = await supabase.from("profiles").update({ logo_url: logoUrl } as any).eq("user_id", user.id);
    setUploadingLogo(false);
    if (updateError) { toast.error("Failed to save: " + updateError.message); return; }
    toast.success("Company logo updated");
    refresh();
    // Auto-recolor the dashboard from the new logo unless the agent locked their color.
    if (!isLocked) {
      try { await reExtractFromLogo(); } catch { /* non-fatal */ }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      company_name: companyName, phone, company_address: companyAddress, country,
    } as any).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    refresh();
  };

  const handleChangePassword = async () => {
    const newPassword = (document.getElementById("new-password") as HTMLInputElement)?.value;
    const confirmPassword = (document.getElementById("confirm-password") as HTMLInputElement)?.value;
    if (!newPassword || newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Manage your agency profile and preferences" />
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map(t => (
          <Button key={t.value} variant={activeTab === t.value ? "default" : "ghost"} size="sm" className="h-8 text-xs gap-1.5" onClick={() => setActiveTab(t.value)}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      {activeTab === "profile" && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Profile Photo Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Camera className="w-4 h-4" /> Profile Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onClick={() => avatarInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground text-xl font-bold">
                    {initials}
                  </div>
                )}
                {uploading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5 justify-center"><Upload className="w-3.5 h-3.5" /> Click to upload photo</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG — max 2MB</p>
                  </div>
                )}
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
            </CardContent>
          </Card>

          {/* Company Logo Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Company Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onClick={() => logoInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo" className="h-14 w-auto max-w-[180px] object-contain" />
                ) : (
                  <div className="h-14 w-[120px] flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                {uploadingLogo ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5 justify-center"><Upload className="w-3.5 h-3.5" /> Click to upload logo</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Appears on your sidebar — PNG recommended, max 2MB</p>
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              {profile.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-destructive hover:text-destructive mt-2 w-full"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) return;
                    await supabase.from("profiles").update({ logo_url: null } as any).eq("user_id", user.id);
                    toast.success("Logo removed");
                    refresh();
                  }}
                >
                  Remove Logo
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Brand Color — auto-derived from the logo, manually overridable */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" /> Dashboard Brand Color
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <label
                  className="relative w-14 h-14 rounded-2xl border border-border cursor-pointer overflow-hidden shadow-sm flex-shrink-0"
                  style={{ backgroundColor: brandColor || "#cbd5e1" }}
                  title="Click to pick a custom color"
                >
                  <input
                    type="color"
                    value={brandColor || "#1f6feb"}
                    onChange={(e) => setManualColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Pick brand color"
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground tabular-nums">
                    {brandColor ? brandColor.toUpperCase() : "Detecting…"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isLocked
                      ? "Custom color set — won't change when you upload a new logo."
                      : "Auto-picked from your logo. Upload a new logo to refresh, or pick your own."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.logo_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] gap-1.5"
                    onClick={async () => {
                      try {
                        await reExtractFromLogo();
                        toast.success("Brand color refreshed from logo");
                      } catch {
                        toast.error("Couldn't read color from logo");
                      }
                    }}
                  >
                    <RotateCcw className="w-3 h-3" /> Re-pick from logo
                  </Button>
                )}
                {isLocked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px]"
                    onClick={async () => {
                      await resetToAuto();
                      toast.success("Switched back to auto color from logo");
                    }}
                  >
                    Use logo color again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">Company Name</Label><Input className="h-9 text-sm" value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
              <div><Label className="text-xs">Business Address</Label><Textarea className="text-sm min-h-[60px]" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} /></div>
              <div><Label className="text-xs">Country</Label><Input className="h-9 text-sm" value={country} onChange={e => setCountry(e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Contact & Preferences */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Contact & Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">Contact Email</Label><Input type="email" className="h-9 text-sm" value={profile.email} disabled /></div>
              <div><Label className="text-xs">Phone</Label><Input className="h-9 text-sm" value={phone} onChange={e => setPhone(e.target.value)} /></div>
              <div><Label className="text-xs">Billing Currency</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="text-sm px-3 py-1">{profile.billing_currency || "USD"}</Badge>
                  <span className="text-[10px] text-muted-foreground">Set by admin during approval</span>
                </div>
              </div>
              <Button size="sm" className="h-9 gap-1.5 text-xs mt-2" onClick={handleSaveProfile} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "security" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label className="text-xs">New Password</Label><Input id="new-password" type="password" className="h-9 text-sm" /></div>
              <div><Label className="text-xs">Confirm Password</Label><Input id="confirm-password" type="password" className="h-9 text-sm" /></div>
              <Button size="sm" className="h-9 gap-1.5 text-xs" onClick={handleChangePassword}>
                <Key className="w-3.5 h-3.5" /> Update Password
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "notifications" && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Notification Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Booking Confirmations", desc: "Email on booking confirmation", on: true },
              { label: "Low Balance Alerts", desc: "Wallet below threshold", on: true },
              { label: "Marketing", desc: "Deals and promotions", on: false },
            ].map((n, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div><p className="text-sm font-medium">{n.label}</p><p className="text-xs text-muted-foreground">{n.desc}</p></div>
                <Switch defaultChecked={n.on} />
              </div>
            ))}
            <Button size="sm" className="h-9 gap-1.5 text-xs mt-2" onClick={() => toast.success("Preferences saved")}>
              <Save className="w-3.5 h-3.5" /> Save Preferences
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
