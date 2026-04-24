import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Eye, EyeOff, ShieldCheck, Check } from "lucide-react";

interface CredentialField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "password";
}

interface VaultCredentialFieldsProps {
  provider: string;
  fields: CredentialField[];
  title?: string;
}

const VaultCredentialFields = ({ provider, fields, title }: VaultCredentialFieldsProps) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, [provider]);

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.rpc("get_provider_credential_status", {
        p_provider: provider,
      });
      if (!error && data) {
        setConfigured(data as Record<string, boolean>);
      }
    } catch (err) {
      console.error("Failed to check credential status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const nonEmpty = Object.entries(values).filter(([, v]) => v.trim() !== "");
    if (nonEmpty.length === 0) {
      toast({ title: "No changes", description: "Enter at least one credential to save.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      nonEmpty.forEach(([k, v]) => {
        credentials[k] = v.trim();
      });

      const { error } = await supabase.rpc("save_provider_credentials", {
        p_provider: provider,
        p_credentials: credentials,
      });

      if (error) throw error;

      toast({
        title: "Credentials saved",
        description: `${nonEmpty.length} credential(s) stored securely in Vault.`,
      });

      // Update configured status and clear inputs
      const newConfigured = { ...configured };
      nonEmpty.forEach(([k]) => {
        newConfigured[k] = true;
      });
      setConfigured(newConfigured);
      setValues({});
    } catch (err: any) {
      toast({ title: "Error saving credentials", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Checking credentials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-medium text-primary">{title}</p>
        </div>
      )}

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Credentials are encrypted at rest using Supabase Vault. Enter new values to update.
        </p>

        <div className="grid gap-2.5">
          {fields.map((field) => {
            const isConfigured = configured[field.key];
            const isPassword = field.type === "password" || field.key.includes("password") || field.key.includes("secret") || field.key.includes("api_key");
            const isVisible = visibility[field.key];

            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{field.label}</Label>
                  {isConfigured && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                      <Check className="w-3 h-3" /> Configured
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={isPassword && !isVisible ? "password" : "text"}
                    placeholder={isConfigured ? "••••••••  (enter to update)" : field.placeholder || `Enter ${field.label}`}
                    className="h-8 text-xs pr-8"
                    value={values[field.key] || ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                  {isPassword && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setVisibility((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving} className="mt-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />}
          Save to Vault
        </Button>
      </div>
    </div>
  );
};

export default VaultCredentialFields;
