// Public anonymous beacon endpoint for tenant site analytics.
// Writes one row per pageview into tenant_site_events using service role.
// Designed to be called from the white-label site (TenantHome / TenantPage)
// with `keepalive: true` so it never blocks navigation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function detectDevice(ua: string | null): string {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

function safeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenant_id = String(body?.tenant_id || "").trim();
    if (!tenant_id || !/^[0-9a-f-]{36}$/i.test(tenant_id)) {
      return new Response(JSON.stringify({ ok: false, error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const path = String(body?.page_path || "/").slice(0, 500);
    const title = body?.page_title ? String(body.page_title).slice(0, 250) : null;
    const referrer = body?.referrer ? String(body.referrer).slice(0, 1000) : null;
    const session_id = body?.session_id ? String(body.session_id).slice(0, 64) : null;
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || null;
    const ua = req.headers.get("user-agent");
    const device = detectDevice(ua);
    const referrer_host = safeHost(referrer);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await sb.from("tenant_site_events").insert({
      tenant_id,
      event_type: "pageview",
      page_path: path,
      page_title: title,
      referrer,
      referrer_host,
      country,
      device,
      session_id,
      user_agent: ua?.slice(0, 500) || null,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "track failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});