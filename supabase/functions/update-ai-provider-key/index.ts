// Admin-only: update an AI provider's API key in the Vault.
// The aiRouter reads from env first, then falls back to Vault via read_provider_secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Admin role required" }, 403);

    const { secret_name, api_key } = await req.json();
    if (!secret_name || typeof secret_name !== "string") return json({ error: "secret_name required" }, 400);
    if (!api_key || typeof api_key !== "string" || api_key.length < 10) {
      return json({ error: "api_key required (min 10 chars)" }, 400);
    }

    const { error: rpcErr } = await admin.rpc("upsert_provider_secret", {
      p_name: secret_name,
      p_secret: api_key,
      p_description: `AI provider key updated via admin UI at ${new Date().toISOString()}`,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    return json({ success: true, secret_name });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
