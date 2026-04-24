// Edge function helper: reads provider credentials from Supabase Vault
// with in-memory caching (5-min TTL) and audit logging
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── In-memory cache with 5-minute TTL ──
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const secretCache = new Map<string, { value: string | null; expiresAt: number }>();

function getCached(key: string): string | null | undefined {
  const entry = secretCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    secretCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: string | null) {
  secretCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  // Evict stale entries periodically (keep cache small)
  if (secretCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of secretCache) {
      if (now > v.expiresAt) secretCache.delete(k);
    }
  }
}

/**
 * Reads a provider secret from Supabase Vault using service_role.
 * - Caches in memory (5-min TTL) to reduce decrypt calls
 * - Logs every vault read to secret_access_logs for audit
 * - Falls back to environment variable if vault secret not found
 * @param callerFunction - name of the calling edge function (for audit)
 */
export async function getVaultSecret(
  secretName: string,
  envFallback?: string,
  callerFunction?: string
): Promise<string | null> {
  // Check cache first
  const cached = getCached(secretName);
  if (cached !== undefined) return cached;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("[vault] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, using env fallback");
      const fallback = envFallback ? (Deno.env.get(envFallback) || null) : null;
      setCache(secretName, fallback);
      return fallback;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // read_provider_secret now automatically logs to secret_access_logs
    const { data, error } = await supabase.rpc("read_provider_secret", { p_name: secretName });

    if (error || !data) {
      const fallback = envFallback ? (Deno.env.get(envFallback) || null) : null;
      setCache(secretName, fallback);

      // Log the access attempt with function name if provided
      if (callerFunction) {
        await supabase.from("secret_access_logs").insert({
          secret_name: secretName,
          provider: secretName.split("_")[0],
          accessed_by: "edge_function",
          function_name: callerFunction,
        }).then(() => {});
      }
      return fallback;
    }

    // Cache the result
    // SECURITY: Never log the actual value
    setCache(secretName, data as string);

    // Update audit log with function name (the DB function already inserted a row)
    if (callerFunction) {
      // Update the most recent log entry for this secret with the function name
      await supabase
        .from("secret_access_logs")
        .update({ function_name: callerFunction, accessed_by: "edge_function" })
        .eq("secret_name", secretName)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(() => {});
    }

    return data as string;
  } catch (err) {
    console.warn(`[vault] Failed to read secret ${secretName}:`, err);
    const fallback = envFallback ? (Deno.env.get(envFallback) || null) : null;
    setCache(secretName, fallback);
    return fallback;
  }
}

/**
 * Gets multiple provider secrets at once (with caching).
 */
export async function getVaultSecrets(
  secrets: Array<{ vaultKey: string; envFallback?: string }>,
  callerFunction?: string
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};

  const promises = secrets.map(async ({ vaultKey, envFallback }) => {
    result[vaultKey] = await getVaultSecret(vaultKey, envFallback, callerFunction);
  });

  await Promise.all(promises);
  return result;
}

// This function can also be invoked directly for testing
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { secret_name } = await req.json();

    if (!secret_name) {
      return new Response(JSON.stringify({ success: false, error: "Missing secret_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only check if secret exists, never return the value via HTTP
    const value = await getVaultSecret(secret_name, undefined, "vault-secrets-test");

    return new Response(JSON.stringify({
      success: true,
      exists: value !== null,
      // Never return the actual secret value
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
