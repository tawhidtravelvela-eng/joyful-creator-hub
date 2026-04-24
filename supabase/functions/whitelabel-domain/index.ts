// Edge function: Affiliate-scoped domain management for Custom Website hub.
// Provisions subdomains via Cloudflare DNS + Pages, and custom domains via
// Cloudflare for SaaS Custom Hostnames API (preferred) with a Pages fallback.
//
// Vanity CNAME target (env WHITELABEL_CNAME_TARGET, e.g. "custom.travelvela.com")
// hides the underlying *.pages.dev hostname from end customers.
//
// Actions:
//   - add_custom_domain { domain }
//   - check_status      { domain_id }
//   - set_primary       { domain_id }
//   - remove_domain     { domain_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CF_API = "https://api.cloudflare.com/client/v4";
const BASE_DOMAIN = "travelvela.com";

// ── Cloudflare HTTP helper ───────────────────────────────────────────────
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

// ── Zone helper (used by Cloudflare for SaaS custom hostnames) ───────────
async function getZoneId(baseDomain: string): Promise<string> {
  const json = await cfFetch(`/zones?name=${baseDomain}&status=active`);
  if (!json.result?.length) throw new Error(`Zone not found for ${baseDomain}`);
  return json.result[0].id;
}

// ── Cloudflare Pages helpers (legacy / subdomain attachment) ─────────────
async function addPagesDomain(accountId: string, project: string, domain: string) {
  try {
    await cfFetch(`/accounts/${accountId}/pages/projects/${project}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });
  } catch (e: any) {
    if (!e.message?.includes("already exists")) throw e;
  }
}

async function removePagesDomain(accountId: string, project: string, domain: string) {
  try {
    await cfFetch(`/accounts/${accountId}/pages/projects/${project}/domains/${domain}`, { method: "DELETE" });
  } catch { /* ok */ }
}

async function getPagesDomainStatus(accountId: string, project: string, domain: string) {
  try {
    const json = await cfFetch(`/accounts/${accountId}/pages/projects/${project}/domains/${domain}`);
    return json.result;
  } catch { return null; }
}

// ── Cloudflare for SaaS — Custom Hostnames API ───────────────────────────
// Docs: https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-create-custom-hostname
type SaasHostname = {
  id: string;
  hostname: string;
  status: string;            // active | pending | active_redeploying | moved | pending_deletion | deleted | pending_blocked | pending_migration | provisioned | test_pending | test_active | test_blocked | test_failed | blocked
  ssl?: {
    status?: string;         // initializing | pending_validation | deleted | pending_issuance | pending_deployment | pending_deletion | pending_expiration | expired | active | initializing_timed_out | validation_timed_out | issuance_timed_out | deployment_timed_out | deletion_timed_out | pending_cleanup | staging_deployment | staging_active | deactivating | inactive | backup_issued | holding_deployment
    method?: "http" | "txt" | "email";
    type?: string;
    validation_records?: Array<{ txt_name?: string; txt_value?: string; http_url?: string; http_body?: string; emails?: string[] }>;
    validation_errors?: Array<{ message: string }>;
  };
  ownership_verification?: { type: string; name: string; value: string };
  ownership_verification_http?: { http_url: string; http_body: string };
  verification_errors?: string[];
};

async function createCustomHostname(zoneId: string, hostname: string): Promise<SaasHostname> {
  const json = await cfFetch(`/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: {
        method: "txt",            // TXT validation works without HTTP reachability
        type: "dv",
        settings: { min_tls_version: "1.2" },
        bundle_method: "ubiquitous",
        wildcard: false,
      },
    }),
  });
  return json.result as SaasHostname;
}

async function getCustomHostname(zoneId: string, hostnameId: string): Promise<SaasHostname | null> {
  try {
    const json = await cfFetch(`/zones/${zoneId}/custom_hostnames/${hostnameId}`);
    return json.result as SaasHostname;
  } catch { return null; }
}

async function deleteCustomHostname(zoneId: string, hostnameId: string) {
  try {
    await cfFetch(`/zones/${zoneId}/custom_hostnames/${hostnameId}`, { method: "DELETE" });
  } catch { /* ok */ }
}

// ── Validation ───────────────────────────────────────────────────────────
function validateCustomDomain(d: string): string | null {
  if (!d) return "Domain required";
  if (d.length > 253) return "Domain too long";
  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(d)) return "Enter a valid domain (e.g. mybrand.com)";
  if (d.endsWith(`.${BASE_DOMAIN}`) || d === BASE_DOMAIN) return "Cannot use travelvela.com — connect your own domain";
  return null;
}

// Map CF SaaS hostname → our internal cf_status / ssl_status pair
function mapSaasStatus(h: SaasHostname): { cf_status: string; ssl_status: string } {
  const cf = (h.status || "").toLowerCase();
  const ssl = (h.ssl?.status || "").toLowerCase();

  let cf_status: string;
  if (cf === "active" && ssl === "active") cf_status = "active";
  else if (cf === "blocked" || cf.startsWith("test_blocked") || cf === "moved") cf_status = "failed";
  else if (cf === "pending" && (!ssl || ssl.startsWith("pending"))) cf_status = "pending_dns";
  else cf_status = "verifying";

  const ssl_status =
    ssl === "active" ? "active" :
    ssl?.includes("fail") || ssl?.includes("timed_out") || ssl === "expired" ? "failed" :
    "pending";

  return { cf_status, ssl_status };
}

// ── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve affiliate for the caller
    const { data: aff } = await admin.from("affiliates").select("id").eq("user_id", user.id).maybeSingle();
    if (!aff?.id) throw new Error("No affiliate account found for this user");
    const affiliateId = aff.id;

    // Verify user has purchased white-label
    const { data: purchase } = await admin
      .from("whitelabel_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_type", "whitelabel")
      .eq("status", "completed")
      .maybeSingle();
    if (!purchase) throw new Error("White-label purchase required");

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const projectName = Deno.env.get("CLOUDFLARE_PAGES_PROJECT_NAME");
    if (!accountId || !projectName) throw new Error("Cloudflare config missing");

    // Vanity CNAME shown to customers (hides .pages.dev).
    // Defaults to the branded `custom.travelvela.com` host, which itself
    // CNAMEs to <project>.pages.dev inside Cloudflare. This keeps the raw
    // Pages hostname out of customer-facing DNS instructions.
    const cnameTarget =
      Deno.env.get("WHITELABEL_CNAME_TARGET") || "custom.travelvela.com";
    // Toggle Cloudflare for SaaS path. Defaults OFF until the dashboard is configured.
    const useSaas = (Deno.env.get("WHITELABEL_USE_CF_SAAS") || "false").toLowerCase() === "true";

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    let result: any = {};

    switch (action) {
      // ── CUSTOM DOMAIN ────────────────────────────────────────────────────
      case "add_custom_domain": {
        const dom = String(body.domain || "").toLowerCase().trim();
        const err = validateCustomDomain(dom);
        if (err) throw new Error(err);

        const { data: existing } = await admin
          .from("whitelabel_site_domains")
          .select("id, affiliate_id")
          .eq("domain", dom)
          .maybeSingle();
        if (existing && existing.affiliate_id !== affiliateId) {
          throw new Error("That domain is already attached to another account");
        }

        const isFirst = await isFirstDomain(admin, affiliateId);
        let upsertPayload: any = {
          affiliate_id: affiliateId,
          domain: dom,
          cf_status: "pending_dns",
          last_checked_at: new Date().toISOString(),
          is_primary: isFirst,
        };

        let dnsInstructions: any = {
          type: "CNAME",
          name: dom,
          value: cnameTarget,
          note: "Add this CNAME at your DNS provider. SSL is provisioned automatically once DNS resolves.",
        };

        if (useSaas) {
          // Preferred path: Cloudflare for SaaS Custom Hostname
          const zoneId = await getZoneId(BASE_DOMAIN);
          const saas = await createCustomHostname(zoneId, dom);
          const mapped = mapSaasStatus(saas);

          upsertPayload = {
            ...upsertPayload,
            cf_provider: "saas",
            cf_hostname_id: saas.id,
            cf_status: mapped.cf_status,
            ssl_status: mapped.ssl_status,
            cf_details: saas as any,
            verification_method: saas.ssl?.method || "txt",
            verification_record: saas.ownership_verification || saas.ssl?.validation_records?.[0] || null,
          };

          // Secondary verification record customer may need to add (TXT for ownership)
          const verify = saas.ownership_verification;
          dnsInstructions = {
            type: "CNAME",
            name: dom,
            value: cnameTarget,
            note: "Add this CNAME at your DNS provider. SSL is provisioned automatically once DNS resolves.",
            verification: verify ? {
              type: verify.type,
              name: verify.name,
              value: verify.value,
              note: "Also add this verification record so we can issue an SSL certificate.",
            } : undefined,
          };
        } else {
          // Legacy fallback: attach directly to Pages project
          await addPagesDomain(accountId, projectName, dom);
          upsertPayload.cf_provider = "pages";
        }

        const { data: row, error } = await admin
          .from("whitelabel_site_domains")
          .upsert(upsertPayload, { onConflict: "domain" })
          .select()
          .single();
        if (error) throw error;

        result = { domain: row, dns_instructions: dnsInstructions };
        break;
      }

      // ── CHECK STATUS ─────────────────────────────────────────────────────
      case "check_status": {
        const id = String(body.domain_id || "");
        if (!id) throw new Error("domain_id required");
        const { data: dom } = await admin
          .from("whitelabel_site_domains")
          .select("*")
          .eq("id", id)
          .eq("affiliate_id", affiliateId)
          .maybeSingle();
        if (!dom) throw new Error("Domain not found");

        let patch: any = { last_checked_at: new Date().toISOString() };

        if (dom.cf_provider === "saas" && dom.cf_hostname_id) {
          const zoneId = await getZoneId(BASE_DOMAIN);
          const saas = await getCustomHostname(zoneId, dom.cf_hostname_id);
          if (saas) {
            const mapped = mapSaasStatus(saas);
            patch = {
              ...patch,
              cf_status: mapped.cf_status,
              ssl_status: mapped.ssl_status,
              cf_details: saas as any,
              verification_method: saas.ssl?.method || dom.verification_method,
              verification_record: saas.ownership_verification || saas.ssl?.validation_records?.[0] || dom.verification_record,
            };
            if (mapped.cf_status === "active" && !dom.verified_at) patch.verified_at = new Date().toISOString();
          } else {
            patch.cf_status = "failed";
          }
        } else {
          // Legacy Pages flow
          const info = await getPagesDomainStatus(accountId, projectName, dom.domain);
          const cfStatus = info?.status === "active" ? "active" : (info?.status || "verifying");
          const sslStatus = info?.certificate_authority ? "active"
            : info?.validation_data?.status === "active" ? "active"
            : "pending";
          patch = {
            ...patch,
            cf_status: cfStatus,
            ssl_status: sslStatus,
            cf_details: info || null,
          };
          if (cfStatus === "active" && !dom.verified_at) patch.verified_at = new Date().toISOString();
        }

        const { data: updated } = await admin
          .from("whitelabel_site_domains")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        result = { domain: updated };
        break;
      }

      // ── SET PRIMARY ──────────────────────────────────────────────────────
      case "set_primary": {
        const id = String(body.domain_id || "");
        if (!id) throw new Error("domain_id required");
        const { data: dom } = await admin
          .from("whitelabel_site_domains")
          .select("affiliate_id, cf_status")
          .eq("id", id)
          .maybeSingle();
        if (!dom || dom.affiliate_id !== affiliateId) throw new Error("Domain not found");
        if (dom.cf_status !== "active") throw new Error("Domain must be verified before it can be primary");

        const { data: updated } = await admin
          .from("whitelabel_site_domains")
          .update({ is_primary: true })
          .eq("id", id)
          .select()
          .single();
        result = { domain: updated };
        break;
      }

      // ── REMOVE DOMAIN ────────────────────────────────────────────────────
      case "remove_domain": {
        const id = String(body.domain_id || "");
        if (!id) throw new Error("domain_id required");
        const { data: dom } = await admin
          .from("whitelabel_site_domains")
          .select("*")
          .eq("id", id)
          .eq("affiliate_id", affiliateId)
          .maybeSingle();
        if (!dom) throw new Error("Domain not found");

        if (dom.cf_provider === "saas" && dom.cf_hostname_id) {
          const zoneId = await getZoneId(BASE_DOMAIN);
          await deleteCustomHostname(zoneId, dom.cf_hostname_id);
        } else {
          await removePagesDomain(accountId, projectName, dom.domain);
        }

        // (Subdomains are no longer supported — only Pages/SaaS cleanup needed.)

        await admin.from("whitelabel_site_domains").delete().eq("id", id);
        result = { removed: true };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[whitelabel-domain]", e);
    return new Response(JSON.stringify({ success: false, error: e.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function isFirstDomain(admin: any, affiliateId: string): Promise<boolean> {
  const { count } = await admin
    .from("whitelabel_site_domains")
    .select("id", { count: "exact", head: true })
    .eq("affiliate_id", affiliateId);
  return (count || 0) === 0;
}
