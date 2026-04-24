import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Booking Settlement — walks the agent hierarchy and settles wallets.
 *
 * Input: { bookingUserId, baseCost, bookingId }
 *   bookingUserId = the user who made the booking (agent or sub-agent at any level)
 *   baseCost      = Travel Vela's base cost
 *   bookingId     = reference for the booking
 *
 * Algorithm (unlimited depth):
 *   1. Build the ancestor chain from bookingUser up to the root agent (no parent_agent_id).
 *   2. For each ancestor, look up their agent_markup_settings for 'sub_agents'.
 *   3. Calculate cascading cost:
 *      - Level 0 (Travel Vela): baseCost
 *      - Level N cost = Level N-1 cost + ancestor N's markup
 *   4. The booking user's wallet is debited: their parent's cost to them
 *      (baseCost + sum of all ancestor markups).
 *   5. Each ancestor's earnings wallet is credited their markup.
 *   6. If any ancestor has negative markup, their main wallet is debited for the shortfall.
 */

interface AncestorNode {
  userId: string;
  parentAgentId: string | null;
  markupType: string;
  markupValue: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ─── Settle a booking ───
    if (action === "settle") {
      const { bookingUserId, baseCost, bookingId } = body;
      if (!bookingUserId || !baseCost || baseCost <= 0 || !bookingId) {
        return new Response(JSON.stringify({ error: "Missing bookingUserId, baseCost, or bookingId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build ancestor chain (walk up parent_agent_id, max 20 levels safety)
      const ancestors: AncestorNode[] = [];
      let currentUserId = bookingUserId;
      for (let i = 0; i < 20; i++) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, parent_agent_id")
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (!profile || !profile.parent_agent_id) break;

        // Get parent's markup settings for sub_agents
        const { data: markup } = await supabase
          .from("agent_markup_settings")
          .select("markup_type, markup_value")
          .eq("user_id", profile.parent_agent_id)
          .eq("applies_to", "sub_agents")
          .maybeSingle();

        ancestors.push({
          userId: profile.parent_agent_id,
          parentAgentId: null, // not needed
          markupType: markup?.markup_type || "fixed",
          markupValue: Number(markup?.markup_value || 0),
        });

        currentUserId = profile.parent_agent_id;
      }

      // Calculate costs at each level (bottom-up)
      // ancestors[0] = direct parent, ancestors[N] = root agent
      // Cost to booking user = baseCost + sum of all ancestor markups
      let totalCostToBookingUser = baseCost;
      const earningsBreakdown: { agentUserId: string; markupAmount: number; costBelow: number }[] = [];

      // Walk from root (last ancestor) to direct parent (first ancestor)
      // Each ancestor's markup is applied on top of the cost below them
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const ancestor = ancestors[i];
        let markupAmount: number;

        if (ancestor.markupType === "percentage") {
          // Percentage of the cost that this ancestor sees
          const costBelowThis = i === ancestors.length - 1
            ? baseCost
            : baseCost + earningsBreakdown.reduce((s, e) => s + e.markupAmount, 0) -
              (earningsBreakdown.find(e => e.agentUserId === ancestors[i + 1]?.userId)?.markupAmount || 0);
          markupAmount = Math.round((ancestor.markupValue / 100) * baseCost * 100) / 100;
        } else {
          markupAmount = ancestor.markupValue;
        }

        totalCostToBookingUser += markupAmount;
        earningsBreakdown.push({
          agentUserId: ancestor.userId,
          markupAmount,
          costBelow: 0, // filled for reference
        });
      }

      // Check booking user's wallet balance
      const { data: txns } = await supabase
        .from("wallet_transactions")
        .select("amount, type, status")
        .eq("user_id", bookingUserId);

      const walletBalance = (txns || [])
        .filter((t: any) => t.status === "completed")
        .reduce((s: number, t: any) => s + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)), 0);

      const { data: bookingProfile } = await supabase
        .from("profiles")
        .select("credit_limit")
        .eq("user_id", bookingUserId)
        .maybeSingle();

      const creditLimit = Number(bookingProfile?.credit_limit || 0);
      const available = walletBalance + creditLimit;

      if (available < totalCostToBookingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: "insufficient_balance",
          required: totalCostToBookingUser,
          available,
          shortfall: totalCostToBookingUser - available,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Debit booking user's wallet for total cost
      const ref = `BKG-${bookingId}-${Date.now()}`;
      await supabase.from("wallet_transactions").insert({
        user_id: bookingUserId,
        amount: totalCostToBookingUser,
        type: "debit",
        status: "completed",
        description: `Booking ${bookingId}: base cost + markups`,
        reference: ref,
      });

      // Credit each ancestor's earnings and record in sub_agent_earnings
      for (const earning of earningsBreakdown) {
        if (earning.markupAmount > 0) {
          // Credit to agent's wallet as earnings
          await supabase.from("wallet_transactions").insert({
            user_id: earning.agentUserId,
            amount: earning.markupAmount,
            type: "credit",
            status: "completed",
            description: `Sub-agent earnings: Booking ${bookingId}`,
            reference: `EARN-${bookingId}-${Date.now()}`,
          });
        } else if (earning.markupAmount < 0) {
          // Negative markup: debit from agent's main wallet
          await supabase.from("wallet_transactions").insert({
            user_id: earning.agentUserId,
            amount: Math.abs(earning.markupAmount),
            type: "debit",
            status: "completed",
            description: `Discount subsidy: Booking ${bookingId}`,
            reference: `SUBSIDY-${bookingId}-${Date.now()}`,
          });
        }

        // Record in sub_agent_earnings
        if (earning.markupAmount !== 0) {
          await supabase.from("sub_agent_earnings").insert({
            agent_user_id: earning.agentUserId,
            sub_agent_user_id: bookingUserId,
            booking_id: bookingId,
            base_cost: baseCost,
            markup_amount: earning.markupAmount,
            status: "completed",
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        totalCharged: totalCostToBookingUser,
        baseCost,
        earningsBreakdown: earningsBreakdown.map(e => ({
          agentUserId: e.agentUserId,
          markupAmount: e.markupAmount,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Get earnings summary ───
    if (action === "earnings_summary") {
      const { data: earnings } = await supabase
        .from("sub_agent_earnings")
        .select("*")
        .eq("agent_user_id", user.id)
        .order("created_at", { ascending: false });

      const totalEarnings = (earnings || []).reduce((s: number, e: any) => s + Number(e.markup_amount), 0);

      return new Response(JSON.stringify({
        success: true,
        totalEarnings,
        earnings: earnings || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Transfer earnings to main wallet ───
    if (action === "transfer_earnings") {
      const { amount } = body;
      if (!amount || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Calculate available earnings (total earned minus already transferred)
      const { data: earned } = await supabase
        .from("sub_agent_earnings")
        .select("markup_amount")
        .eq("agent_user_id", user.id)
        .eq("status", "completed");

      const totalEarned = (earned || []).reduce((s: number, e: any) => s + Math.max(0, Number(e.markup_amount)), 0);

      // Check how much has already been transferred
      const { data: transferred } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .like("description", "Earnings transfer to main wallet%");

      const totalTransferred = (transferred || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const availableEarnings = totalEarned - totalTransferred;

      if (amount > availableEarnings) {
        return new Response(JSON.stringify({
          error: "Amount exceeds available earnings",
          availableEarnings,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // The earnings are already credited as wallet_transactions during settlement,
      // so "transferring" just means they're already in the main wallet.
      // We record it for tracking purposes.
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        amount: 0, // no actual movement, just tracking
        type: "credit",
        status: "completed",
        description: `Earnings transfer to main wallet: ${amount}`,
        reference: `EARN-TRF-${Date.now()}`,
      });

      return new Response(JSON.stringify({ success: true, transferred: amount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
