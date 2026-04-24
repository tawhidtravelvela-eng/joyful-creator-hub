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

    // Auth check
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

    const agentId = user.id;
    const body = await req.json();
    const { action } = body;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ─── Fund Sub-Agent ───
    if (action === "fund_sub_agent") {
      const { subAgentUserId, amount } = body;
      if (!subAgentUserId || !amount || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid sub-agent or amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify the sub-agent belongs to this agent
      const { data: subProfile } = await supabase
        .from("profiles")
        .select("user_id, parent_agent_id, full_name")
        .eq("user_id", subAgentUserId)
        .eq("parent_agent_id", agentId)
        .maybeSingle();

      if (!subProfile) {
        return new Response(JSON.stringify({ error: "Sub-agent not found under your account" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve agent's billing currency so the transfer is recorded in the right currency
      const { data: agentProfile } = await supabase
        .from("profiles")
        .select("billing_currency")
        .eq("user_id", agentId)
        .maybeSingle();
      const transferCurrency = String((agentProfile as any)?.billing_currency || "USD").toUpperCase();

      // Check agent's wallet balance — only count txns in the same currency
      const { data: agentTxns } = await supabase
        .from("wallet_transactions")
        .select("amount, type, status, currency")
        .eq("user_id", agentId);

      const agentBalance = (agentTxns || [])
        .filter((t: any) => t.status === "completed" && String(t.currency || "USD").toUpperCase() === transferCurrency)
        .reduce((s: number, t: any) => s + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)), 0);

      if (agentBalance < amount) {
        return new Response(JSON.stringify({ error: "Insufficient wallet balance", balance: agentBalance, currency: transferCurrency }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subName = subProfile.full_name || "Sub-agent";

      // Debit agent
      const { error: debitErr } = await supabase.from("wallet_transactions").insert({
        user_id: agentId,
        amount,
        type: "debit",
        status: "completed",
        currency: transferCurrency,
        description: `Fund transfer to sub-agent: ${subName}`,
        reference: `TRF-${Date.now()}`,
      });

      if (debitErr) {
        return new Response(JSON.stringify({ error: debitErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Credit sub-agent in the same currency as the parent
      const { error: creditErr } = await supabase.from("wallet_transactions").insert({
        user_id: subAgentUserId,
        amount,
        type: "credit",
        status: "completed",
        currency: transferCurrency,
        description: `Wallet funded by parent agent`,
        reference: `TRF-${Date.now()}`,
      });

      if (creditErr) {
        // Rollback: re-credit agent
        await supabase.from("wallet_transactions").insert({
          user_id: agentId,
          amount,
          type: "credit",
          status: "completed",
          currency: transferCurrency,
          description: `Refund: failed transfer to sub-agent`,
          reference: `TRF-ROLLBACK-${Date.now()}`,
        });
        return new Response(JSON.stringify({ error: creditErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record transfer
      await supabase.from("wallet_transfers").insert({
        from_user_id: agentId,
        to_user_id: subAgentUserId,
        amount,
        status: "completed",
        description: `Agent funded sub-agent: ${subName}`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Get Sub-Agents with balances ───
    if (action === "list_sub_agents") {
      const { data: subAgents } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, company_name, phone, is_approved, approval_status, created_at, credit_limit")
        .eq("parent_agent_id", agentId)
        .order("created_at", { ascending: false });

      // Get balances for each sub-agent
      const enriched = await Promise.all((subAgents || []).map(async (sa: any) => {
        const { data: txns } = await supabase
          .from("wallet_transactions")
          .select("amount, type, status")
          .eq("user_id", sa.user_id);

        const balance = (txns || [])
          .filter((t: any) => t.status === "completed")
          .reduce((s: number, t: any) => s + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)), 0);

        return { ...sa, wallet_balance: balance };
      }));

      return new Response(JSON.stringify({ success: true, subAgents: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Approve sub-agent ───
    if (action === "approve_sub_agent") {
      const { subAgentUserId } = body;
      const { data: subProfile } = await supabase
        .from("profiles")
        .select("user_id, parent_agent_id")
        .eq("user_id", subAgentUserId)
        .eq("parent_agent_id", agentId)
        .maybeSingle();

      if (!subProfile) {
        return new Response(JSON.stringify({ error: "Sub-agent not found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("profiles")
        .update({ is_approved: true, approval_status: "approved" })
        .eq("user_id", subAgentUserId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Set credit limit ───
    if (action === "set_credit_limit") {
      const { subAgentUserId, creditLimit } = body;
      const { data: subProfile } = await supabase
        .from("profiles")
        .select("user_id, parent_agent_id")
        .eq("user_id", subAgentUserId)
        .eq("parent_agent_id", agentId)
        .maybeSingle();

      if (!subProfile) {
        return new Response(JSON.stringify({ error: "Sub-agent not found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("profiles")
        .update({ credit_limit: creditLimit })
        .eq("user_id", subAgentUserId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Get transfer history ───
    if (action === "transfer_history") {
      const { data: transfers } = await supabase
        .from("wallet_transfers")
        .select("*")
        .or(`from_user_id.eq.${agentId},to_user_id.eq.${agentId}`)
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ success: true, transfers: transfers || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
