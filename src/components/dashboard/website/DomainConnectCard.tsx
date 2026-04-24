import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, ShieldCheck, ShieldAlert, Loader2, RefreshCw, Plug, ExternalLink, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "active" | "verifying" | "pending" | "error" | "unknown";

interface Props {
  tenantId: string;
  currentDomain: string | null; // already validated to be a true custom domain
  onChange: () => void;
}

/**
 * In-dashboard domain connection: lets the tenant admin attach their own
 * custom domain (e.g. agency.com) without leaving the page. Calls the
 * cloudflare-domain edge function for both add + status checks.
 */
export default function DomainConnectCard({ tenantId, currentDomain, onChange }: Props) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<Status>(currentDomain ? "active" : "pending");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currentDomain) refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDomain]);

  async function refreshStatus() {
    if (!currentDomain) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-domain", {
        body: { action: "check_status", tenant_id: tenantId, domain: currentDomain },
      });
      if (error) throw error;
      const s = String(data?.cf_status || data?.status || "").toLowerCase();
      if (s === "active" || s === "ssl_active") setStatus("active");
      else if (s === "pending" || s === "verifying" || s === "initializing") setStatus("verifying");
      else if (s === "error" || s === "failed") setStatus("error");
      else setStatus("unknown");
    } catch (e: any) {
      setStatus("unknown");
    } finally {
      setChecking(false);
    }
  }

  async function handleConnect() {
    const domain = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) {
      toast.error("Enter a valid domain like yourbrand.com");
      return;
    }
    if (/lovable\.|travelvela\.com$/i.test(domain)) {
      toast.error("Use your own custom domain — staging subdomains aren't supported.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cloudflare-domain", {
        body: { action: "add_custom_domain", tenant_id: tenantId, custom_domain: domain },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Domain submitted — point your DNS CNAME to custom.travelvela.com");
      setStatus("verifying");
      setInput("");
      onChange();
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect domain");
    } finally {
      setSubmitting(false);
    }
  }

  function copyTarget() {
    navigator.clipboard.writeText("custom.travelvela.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03]">
      <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <CardContent className="relative p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Custom domain</div>
              <div className="text-xs text-muted-foreground">Your branded site address</div>
            </div>
          </div>
          {currentDomain && (
            <DomainBadge status={status} />
          )}
        </div>

        {currentDomain ? (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5">
              <div className="font-mono text-sm text-foreground truncate">{currentDomain}</div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" onClick={refreshStatus} disabled={checking}>
                  {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={`https://${currentDomain}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              </div>
            </div>
            {status !== "active" && (
              <DnsHint copied={copied} onCopy={copyTarget} />
            )}
          </>
        ) : (
          <>
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <Input
                  placeholder="yourbrand.com"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="font-mono text-sm"
                  disabled={submitting}
                />
                <Button onClick={handleConnect} disabled={submitting || !input.trim()}>
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plug className="w-4 h-4 mr-1.5" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
              <DnsHint copied={copied} onCopy={copyTarget} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DomainBadge({ status }: { status: Status }) {
  if (status === "active") {
    return (
      <Badge className="bg-success/50/10 text-success dark:text-success border-success/50/30 hover:bg-success/50/15">
        <ShieldCheck className="w-3 h-3 mr-1" /> Live · SSL
      </Badge>
    );
  }
  if (status === "verifying") {
    return (
      <Badge className="bg-warning/50/10 text-warning dark:text-warning border-warning/50/30 hover:bg-warning/50/15">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Verifying
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
        <ShieldAlert className="w-3 h-3 mr-1" /> Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <ShieldAlert className="w-3 h-3 mr-1" /> Unverified
    </Badge>
  );
}

function DnsHint({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-1.5 text-xs">
      <div className="font-medium text-foreground">Add this DNS record at your registrar:</div>
      <div className="grid grid-cols-[60px_1fr_auto] items-center gap-2">
        <span className="text-muted-foreground">Type</span>
        <span className="font-mono text-foreground">CNAME</span>
        <span />
        <span className="text-muted-foreground">Name</span>
        <span className="font-mono text-foreground">@ or www</span>
        <span />
        <span className="text-muted-foreground">Value</span>
        <span className="font-mono text-foreground truncate">custom.travelvela.com</span>
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={onCopy}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
      <div className="text-muted-foreground pt-1">SSL is provisioned automatically. DNS may take up to 24h.</div>
    </div>
  );
}