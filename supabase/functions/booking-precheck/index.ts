import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { agentUserId, baseCost } = body;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!agentUserId || !baseCost || baseCost <= 0) {
      return new Response(JSON.stringify({ error: "Missing agentUserId or baseCost" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agent's wallet balance
    const { data: txns } = await supabase
      .from("wallet_transactions")
      .select("amount, type, status")
      .eq("user_id", agentUserId);

    const walletBalance = (txns || [])
      .filter((t: any) => t.status === "completed")
      .reduce((s: number, t: any) => s + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)), 0);

    // Get agent's credit limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("credit_limit")
      .eq("user_id", agentUserId)
      .maybeSingle();

    const creditLimit = Number(profile?.credit_limit || 0);
    const availableBalance = walletBalance + creditLimit;

    if (availableBalance < baseCost) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: "insufficient_balance",
        walletBalance,
        creditLimit,
        availableBalance,
        baseCost,
        shortfall: baseCost - availableBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      allowed: true,
      walletBalance,
      creditLimit,
      availableBalance,
      baseCost,
      remainingAfter: availableBalance - baseCost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
