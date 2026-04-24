// Edge function: Provision / remove tenant CUSTOM domains on Cloudflare Pages.
// Subdomains are no longer supported — tenants must connect their own domain.
// Actions: add_custom_domain, remove_domain, check_status
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfFetch(path: string, opts: RequestInit = {}) {
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not configured");
  const res = await fetch(`${CF_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const json = await res.json();
  if (!json.success && json.errors?.length) {
    throw new Error(json.errors.map((e: any) => e.message).join("; "));
  }
  return json;
}

// ── Add custom domain to Cloudflare Pages project ──
async function addPagesDomain(accountId: string, projectName: string, domain: string) {
  try {
    await cfFetch(`/accounts/${accountId}/pages/projects/${projectName}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });
  } catch (e: any) {
    const msg = String(e?.message || "").toLowerCase();
    // Idempotent: ignore "already added / already exists" errors so re-runs succeed.
    if (msg.includes("already added") || msg.includes("already exists")) return;
    throw e;
  }
}

// ── Remove custom domain from Cloudflare Pages project ──
async function removePagesDomain(accountId: string, projectName: string, domain: string) {
  await cfFetch(`/accounts/${accountId}/pages/projects/${projectName}/domains/${domain}`, {
    method: "DELETE",
  });
}

// ── Get domain status from Cloudflare Pages ──
async function getPagesDomainStatus(accountId: string, projectName: string, domain: string) {
  try {
    const json = await cfFetch(`/accounts/${accountId}/pages/projects/${projectName}/domains/${domain}`);
    return json.result;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate as admin
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();
    if (!roleData) throw new Error("Admin access required");

    const body = await req.json();
    const { action, tenant_id, custom_domain } = body;

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const projectName = Deno.env.get("CLOUDFLARE_PAGES_PROJECT_NAME");
    if (!accountId || !projectName) throw new Error("Cloudflare config missing");

    let result: any = {};

    switch (action) {
      case "add_custom_domain": {
        if (!custom_domain || !tenant_id) throw new Error("custom_domain and tenant_id required");

        // 1. Add domain to Pages project (customer must point DNS to us)
        await addPagesDomain(accountId, projectName, custom_domain);

        // 2. Update tenant record
        await adminClient
          .from("tenants")
          .update({
            domain: custom_domain.toLowerCase(),
          })
          .eq("id", tenant_id);

        result = {
          domain: custom_domain,
          status: "pending_dns",
          instructions: `Customer must add a CNAME record: ${custom_domain} → ${projectName}.pages.dev`,
        };
        break;
      }

      case "remove_domain": {
        if (!tenant_id) throw new Error("tenant_id required");

        // Get tenant to find current domain
        const { data: tenant } = await adminClient
          .from("tenants")
          .select("domain")
          .eq("id", tenant_id)
          .single();

        if (tenant?.domain) {
          try { await removePagesDomain(accountId, projectName, tenant.domain); } catch { /* ok */ }
        }

        await adminClient
          .from("tenants")
          .update({ domain: null })
          .eq("id", tenant_id);

        result = { status: "removed" };
        break;
      }

      case "check_status": {
        if (!tenant_id) throw new Error("tenant_id required");
        const { data: tenant } = await adminClient
          .from("tenants")
          .select("domain")
          .eq("id", tenant_id)
          .single();

        if (tenant?.domain) {
          const domainInfo = await getPagesDomainStatus(accountId, projectName, tenant.domain);
          const newStatus = domainInfo?.status === "active" ? "active" : domainInfo?.status || "unknown";
          result = { domain: tenant.domain, cf_status: newStatus, details: domainInfo };
        } else {
          result = { cf_status: "no_domain" };
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[cloudflare-domain]", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
