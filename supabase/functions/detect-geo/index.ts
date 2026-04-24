import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Server-side geo detection edge function.
 *
 * Detection chain (first hit wins):
 * 1. CDN/infra headers (CF-IPCountry, X-Vercel-IP-Country, etc.) — zero latency
 * 2. IP geo API providers (server-side, reliable) — with 3s timeouts
 * 3. Client-provided timezone hint (offline-capable fallback)
 * 4. Hardcoded default → BD (primary market)
 *
 * Returns: { country_code: string }
 * NEVER throws — always returns a valid country code.
 */

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "Asia/Dhaka": "BD",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Karachi": "PK",
  "Asia/Bangkok": "TH",
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Manila": "PH",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Istanbul": "TR",
  "Europe/Moscow": "RU",
  "America/New_York": "US", "America/Chicago": "US", "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
  "Australia/Sydney": "AU",
  "Pacific/Auckland": "NZ",
  "Africa/Cairo": "EG",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
};

// No hardcoded default — if all methods fail, we still return a signal
// so the client can apply its own timezone/locale fallback
const DEFAULT_COUNTRY = "";

async function detectFromApis(clientIp: string | null): Promise<string | null> {
  const apis = [
    { url: "https://api.country.is", parse: (d: any) => d?.country },
    { url: "https://ipapi.co/json/", parse: (d: any) => d?.country_code },
    { url: "https://ipwho.is/", parse: (d: any) => d?.country_code },
    { url: "https://freeipapi.com/api/json", parse: (d: any) => d?.countryCode },
  ];

  for (const api of apis) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(api.url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      const code = api.parse(data)?.toUpperCase();
      if (code && code.length === 2) {
        console.log(`[detect-geo] IP API hit: ${api.url} → ${code}`);
        return code;
      }
    } catch {
      continue;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. CDN / infra headers (instant, most reliable)
    const cfCountry = req.headers.get("cf-ipcountry")?.toUpperCase();
    if (cfCountry && cfCountry !== "XX" && cfCountry !== "T1" && cfCountry.length === 2) {
      console.log(`[detect-geo] CDN header hit: ${cfCountry}`);
      return new Response(JSON.stringify({ country_code: cfCountry, source: "cdn-header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
      });
    }

    // Check other infra headers
    const infraHeaders = ["x-vercel-ip-country", "x-country-code", "x-real-country"];
    for (const h of infraHeaders) {
      const val = req.headers.get(h)?.toUpperCase();
      if (val && val.length === 2) {
        console.log(`[detect-geo] Infra header ${h}: ${val}`);
        return new Response(JSON.stringify({ country_code: val, source: "cdn-header" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
        });
      }
    }

    // 2. Timezone hint from client (prefer visitor-owned signal over runtime IP)
    let tz: string | null = null;
    try {
      const url = new URL(req.url);
      tz = url.searchParams.get("tz");
    } catch { /* ignore */ }

    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      const code = TIMEZONE_TO_COUNTRY[tz];
      console.log(`[detect-geo] Timezone fallback: ${tz} → ${code}`);
      return new Response(JSON.stringify({ country_code: code, source: "timezone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
      });
    }

    // 3. IP geo APIs (server-side last resort only — may reflect runtime/edge region)
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const apiResult = await detectFromApis(clientIp);
    if (apiResult) {
      return new Response(JSON.stringify({ country_code: apiResult, source: "provider" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
      });
    }

    // 4. No country resolved here — let client timezone/locale continue safely
    console.warn(`[detect-geo] No country resolved on server`);
    return new Response(JSON.stringify({ country_code: DEFAULT_COUNTRY, source: "none" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    console.error("[detect-geo] Fatal error:", err);
    return new Response(JSON.stringify({ country_code: DEFAULT_COUNTRY, source: "error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
