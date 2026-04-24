import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmtpConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  from_email: string;
  from_name: string;
  encryption: "tls" | "ssl" | "none";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { to, subject, html, text, tenant_id, reply_to } = body;

    if (!to || !subject || (!html && !text)) {
      return new Response(JSON.stringify({ error: "to, subject, and html or text are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve SMTP config: tenant-specific → global default
    // If tenant uses "platform" mode, skip to global config
    let smtpConfig: SmtpConfig | null = null;
    let tenantRecord: any = null;

    if (tenant_id) {
      const { data: tenantSmtp } = await adminClient
        .from("smtp_configurations")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .maybeSingle();

      if (tenantSmtp) {
        tenantRecord = tenantSmtp;
        // Only use tenant SMTP if they have custom mode configured
        if ((tenantSmtp as any).email_mode === "custom") {
          smtpConfig = tenantSmtp as SmtpConfig;
        }
        // If platform mode, fall through to global
      }
    }

    if (!smtpConfig) {
      const { data: globalSmtp } = await adminClient
        .from("smtp_configurations")
        .select("*")
        .is("tenant_id", null)
        .eq("is_active", true)
        .maybeSingle();
      if (globalSmtp) smtpConfig = globalSmtp as SmtpConfig;
    }

    if (!smtpConfig) {
      return new Response(JSON.stringify({ error: "No SMTP configuration found. Please configure SMTP in admin settings." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily quota for platform-mode tenants
    if (tenantRecord && (tenantRecord.email_mode === "platform")) {
      // Reset counter if past reset time
      const resetAt = new Date(tenantRecord.quota_reset_at);
      const now = new Date();
      if (now.toDateString() !== resetAt.toDateString()) {
        await adminClient.from("smtp_configurations").update({
          daily_sent: 0,
          quota_reset_at: now.toISOString(),
        }).eq("id", tenantRecord.id);
        tenantRecord.daily_sent = 0;
      }

      if (tenantRecord.daily_sent >= tenantRecord.daily_quota) {
        return new Response(JSON.stringify({
          error: `Daily email quota (${tenantRecord.daily_quota}) exceeded. Purchase more or configure your own SMTP.`,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Increment counter
      await adminClient.from("smtp_configurations").update({
        daily_sent: (tenantRecord.daily_sent || 0) + 1,
      }).eq("id", tenantRecord.id);

      // Use tenant from_name if set, override global
      if (tenantRecord.from_name) {
        (smtpConfig as any).from_name = tenantRecord.from_name;
      }
    }

    // Get SMTP password from vault
    const { data: password } = await adminClient.rpc("read_provider_secret", {
      p_name: `smtp_${smtpConfig.id}_password`,
    });

    if (!password) {
      return new Response(JSON.stringify({ error: "SMTP password not found in vault" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build SMTP client config
    const clientConfig: any = {
      connection: {
        hostname: smtpConfig.host,
        port: smtpConfig.port,
        auth: {
          username: smtpConfig.username,
          password: password,
        },
      },
    };

    if (smtpConfig.encryption === "tls") {
      clientConfig.connection.tls = true;
    } else if (smtpConfig.encryption === "ssl") {
      // For SSL (port 465), use direct TLS
      clientConfig.connection.tls = true;
    }
    // For 'none', no TLS config needed

    const client = new SMTPClient(clientConfig);

    const fromStr = smtpConfig.from_name
      ? `${smtpConfig.from_name} <${smtpConfig.from_email}>`
      : smtpConfig.from_email;

    await client.send({
      from: fromStr,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      content: text || "",
      html: html || undefined,
      replyTo: reply_to || undefined,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true, from: smtpConfig.from_email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("SMTP send error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
