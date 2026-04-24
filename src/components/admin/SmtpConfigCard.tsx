import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Save, Loader2, Mail, TestTube, Trash2, Server, Cloud } from "lucide-react";

interface SmtpConfig {
  id?: string;
  tenant_id: string | null;
  label: string;
  host: string;
  port: number;
  username: string;
  from_email: string;
  from_name: string;
  encryption: string;
  is_active: boolean;
  email_mode: "platform" | "custom";
  daily_quota: number;
  daily_sent: number;
  password?: string;
}

const emptyConfig: SmtpConfig = {
  tenant_id: null,
  label: "Default",
  host: "",
  port: 587,
  username: "",
  from_email: "",
  from_name: "",
  encryption: "tls",
  is_active: true,
  email_mode: "platform",
  daily_quota: 200,
  daily_sent: 0,
  password: "",
};

interface Props {
  tenantId?: string | null;
  tenantName?: string;
  /** Hide the platform option (used in global admin where platform mode doesn't apply) */
  hideModePicker?: boolean;
}

export default function SmtpConfigCard({ tenantId = null, tenantName, hideModePicker }: Props) {
  const [config, setConfig] = useState<SmtpConfig>({ ...emptyConfig, tenant_id: tenantId ?? null });
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    loadConfig();
  }, [tenantId]);

  const loadConfig = async () => {
    setLoading(true);
    let query = supabase
      .from("smtp_configurations")
      .select("*")
      .eq("is_active", true);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    } else {
      query = query.is("tenant_id", null);
    }

    const { data } = await query.maybeSingle();

    if (data) {
      setConfig({
        ...data,
        tenant_id: (data as any).tenant_id ?? null,
        email_mode: (data as any).email_mode || "platform",
        daily_quota: (data as any).daily_quota ?? 200,
        daily_sent: (data as any).daily_sent ?? 0,
        password: "",
      });
      setExistingId(data.id);
    } else {
      setConfig({ ...emptyConfig, tenant_id: tenantId ?? null });
      setExistingId(null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (config.email_mode === "custom" && (!config.host || !config.username || !config.from_email)) {
      toast.error("Host, username, and from email are required for custom SMTP");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        tenant_id: config.tenant_id || null,
        label: config.label,
        host: config.email_mode === "custom" ? config.host : null,
        port: config.port,
        username: config.email_mode === "custom" ? config.username : null,
        from_email: config.email_mode === "custom" ? config.from_email : null,
        from_name: config.from_name,
        encryption: config.encryption,
        is_active: config.is_active,
        email_mode: config.email_mode,
        daily_quota: config.daily_quota,
      };

      let configId = existingId;

      if (existingId) {
        const { error } = await supabase
          .from("smtp_configurations")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("smtp_configurations")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        configId = data.id;
        setExistingId(data.id);
      }

      if (config.email_mode === "custom" && config.password && configId) {
        const { error: vaultError } = await supabase.rpc("save_provider_credentials", {
          p_provider: `smtp_${configId}`,
          p_credentials: { password: config.password } as any,
        });
        if (vaultError) throw vaultError;
      }

      toast.success("SMTP configuration saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save SMTP config");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error("Enter a test email address");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: testEmail,
          subject: `SMTP Test — ${tenantName || "Global"}`,
          html: `<div style="font-family:sans-serif;padding:20px"><h2>✅ SMTP Test Successful</h2><p>This email was sent from your ${tenantName || "global"} SMTP configuration.</p><p style="color:#888;font-size:12px">Sent at ${new Date().toISOString()}</p></div>`,
          tenant_id: tenantId || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Test email sent to ${testEmail}`);
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    if (!confirm("Delete this SMTP configuration?")) return;
    const { error } = await supabase.from("smtp_configurations").delete().eq("id", existingId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("SMTP configuration deleted");
      setConfig({ ...emptyConfig, tenant_id: tenantId ?? null });
      setExistingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isPlatform = config.email_mode === "platform";
  const showModePicker = !hideModePicker && tenantId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">
              {tenantName ? `SMTP — ${tenantName}` : "Global SMTP Configuration"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {existingId && (
              <Badge variant={config.is_active ? "default" : "secondary"}>
                {config.is_active ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {tenantName
            ? "Choose how this tenant sends emails"
            : "Default SMTP server used for all tenants without their own config"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode picker — only for tenants */}
        {showModePicker && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Email Sending Mode</Label>
            <RadioGroup
              value={config.email_mode}
              onValueChange={(v) => setConfig((p) => ({ ...p, email_mode: v as "platform" | "custom" }))}
              className="grid grid-cols-1 gap-3"
            >
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isPlatform ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="platform" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Use Platform SMTP</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use our shared SMTP server. Includes {config.daily_quota} emails/day free. Can purchase more.
                  </p>
                  {isPlatform && existingId && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {config.daily_sent} / {config.daily_quota} sent today
                      </Badge>
                    </div>
                  )}
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  !isPlatform ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="custom" className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Use Own SMTP Server</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Configure your own SMTP credentials (Gmail, SendGrid, Mailgun, etc). No daily limit.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {/* Platform mode — minimal config */}
        {isPlatform && showModePicker && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Name (optional)</Label>
                <Input
                  value={config.from_name}
                  onChange={(e) => setConfig((p) => ({ ...p, from_name: e.target.value }))}
                  placeholder={tenantName || "My Brand"}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <Label>Active</Label>
                <Switch
                  checked={config.is_active}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, is_active: v }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Custom SMTP fields — or when it's the global admin card */}
        {(!isPlatform || !showModePicker) && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Label</Label>
                <Input
                  value={config.label}
                  onChange={(e) => setConfig((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Default"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <Label>Active</Label>
                <Switch
                  checked={config.is_active}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, is_active: v }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>SMTP Host</Label>
                <Input
                  value={config.host}
                  onChange={(e) => setConfig((p) => ({ ...p, host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig((p) => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Username</Label>
                <Input
                  value={config.username}
                  onChange={(e) => setConfig((p) => ({ ...p, username: e.target.value }))}
                  placeholder="user@domain.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={config.password || ""}
                  onChange={(e) => setConfig((p) => ({ ...p, password: e.target.value }))}
                  placeholder={existingId ? "••••••• (unchanged)" : "Enter password"}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Encryption</Label>
              <Select
                value={config.encryption}
                onValueChange={(v) => setConfig((p) => ({ ...p, encryption: v }))}
              >
                <SelectTrigger className="mt-1 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">STARTTLS (587)</SelectItem>
                  <SelectItem value="ssl">SSL/TLS (465)</SelectItem>
                  <SelectItem value="none">None (25)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Email</Label>
                <Input
                  value={config.from_email}
                  onChange={(e) => setConfig((p) => ({ ...p, from_email: e.target.value }))}
                  placeholder="noreply@yourdomain.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>From Name</Label>
                <Input
                  value={config.from_name}
                  onChange={(e) => setConfig((p) => ({ ...p, from_name: e.target.value }))}
                  placeholder="Travel Vela"
                  className="mt-1"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save"}
          </Button>
          {existingId && (
            <>
              <div className="flex items-center gap-2 ml-auto">
                <Input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@email.com"
                  className="w-48"
                />
                <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                  Test
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
