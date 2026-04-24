// Tenant AI credit top-up.
//
// Debits the caller's wallet for `amount_usd` worth of credit (converting via
// FX into the wallet's currency) and credits `tenant_ai_credits.top_up_balance`
// 1:1 in USD. Logs both a wallet_transactions row and a tenant_ai_credit_ledger
// entry so the activity feed shows the top-up immediately.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_USD = [5, 10, 25, 50, 100];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Authentication required" }, 401);
    }

    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userResp, error: userErr } = await anon.auth.getUser();
    if (userErr || !userResp?.user) {
      return json({ success: false, error: "Invalid session" }, 401);
    }
    const userId = userResp.user.id;

    const body = await req.json().catch(() => ({}));
    const tenant_id = String(body?.tenant_id || "").trim();
    const amount_usd = Number(body?.amount_usd || 0);

    if (!tenant_id) return json({ success: false, error: "tenant_id required" }, 400);
    if (!Number.isFinite(amount_usd) || amount_usd <= 0)
      return json({ success: false, error: "amount_usd must be > 0" }, 400);
    // Allow exact buckets OR any custom value 1–500 USD
    if (!ALLOWED_USD.includes(amount_usd) && (amount_usd < 1 || amount_usd > 500)) {
      return json({ success: false, error: "amount must be between $1 and $500" }, 400);
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Caller must be a tenant member.
    const { data: prof } = await sb
      .from("profiles")
      .select("tenant_id, billing_currency")
      .eq("user_id", userId)
      .maybeSingle();

    const profileTenant = (prof as any)?.tenant_id as string | null;
    if (!profileTenant || profileTenant !== tenant_id) {
      // Allow super-admins as a fallback.
      const { data: roles } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isSuper = (roles || []).some((r: any) =>
        ["super_admin", "admin"].includes(r.role),
      );
      if (!isSuper) {
        return json({ success: false, error: "Not authorized for this tenant" }, 403);
      }
    }

    const walletCurrency = String(
      (prof as any)?.billing_currency || "USD",
    ).toUpperCase();

    // Resolve FX rate (USD → walletCurrency). Fallback to 1.0 (charge in USD).
    let fxRate = 1;
    let chargeCurrency = "USD";
    if (walletCurrency !== "USD") {
      const { data: fx } = await sb
        .from("api_settings")
        .select("settings")
        .eq("provider", "currency_rates")
        .maybeSingle();
      const rates = ((fx?.settings as any)?.live_rates || {}) as Record<string, number>;
      const r = Number(rates[walletCurrency] || 0);
      if (r > 0) {
        fxRate = r;
        chargeCurrency = walletCurrency;
      }
    }
    const chargeAmount = Math.round(amount_usd * fxRate * 100) / 100;

    // Check wallet balance in caller's currency.
    const { data: txs } = await sb
      .from("wallet_transactions")
      .select("amount, type, currency")
      .eq("user_id", userId)
      .eq("status", "completed");
    const balance = (txs || [])
      .filter((t: any) => String(t.currency).toUpperCase() === chargeCurrency)
      .reduce(
        (sum: number, t: any) =>
          sum + (t.type === "credit" ? Number(t.amount) : -Number(t.amount)),
        0,
      );

    if (balance < chargeAmount) {
      return json({
        success: false,
        status: 402,
        error: "Insufficient wallet balance",
        message: `You need ${chargeAmount.toFixed(2)} ${chargeCurrency} but your wallet has ${balance.toFixed(2)} ${chargeCurrency}.`,
        required: chargeAmount,
        available: balance,
        currency: chargeCurrency,
        error_stage: "balance_check",
      });
    }

    // 1. Debit wallet.
    const { error: debitErr } = await sb.from("wallet_transactions").insert({
      user_id: userId,
      tenant_id,
      amount: chargeAmount,
      type: "debit",
      status: "completed",
      currency: chargeCurrency,
      category: "ai_credit_topup",
      description: `AI credit top-up: $${amount_usd.toFixed(2)} USD`,
    });
    if (debitErr) {
      return json({ success: false, error: debitErr.message }, 500);
    }

    // 2. Ensure credits row exists, then bump top_up_balance by USD amount.
    const { data: existing } = await sb
      .from("tenant_ai_credits")
      .select("top_up_balance")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!existing) {
      await sb
        .from("tenant_ai_credits")
        .insert({ tenant_id, top_up_balance: amount_usd });
    } else {
      await sb
        .from("tenant_ai_credits")
        .update({
          top_up_balance: Number(existing.top_up_balance || 0) + amount_usd,
        })
        .eq("tenant_id", tenant_id);
    }

    // 3. Re-read the row so the ledger entry shows the post-balance.
    const { data: after } = await sb
      .from("tenant_ai_credits")
      .select("monthly_allowance, used_this_period, top_up_balance")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    await sb.from("tenant_ai_credit_ledger").insert({
      tenant_id,
      user_id: userId,
      operation: "topup",
      amount_charged: -amount_usd, // negative cost = credit added
      charged_from: "top_up",
      prompt_summary: `Top-up: $${amount_usd.toFixed(2)} USD (${chargeAmount.toFixed(2)} ${chargeCurrency})`,
      pool_balance_after:
        Math.max(
          0,
          Number(after?.monthly_allowance || 0) -
            Number(after?.used_this_period || 0),
        ) || 0,
      topup_balance_after: Number(after?.top_up_balance || 0),
      metadata: {
        amount_usd,
        charge_amount: chargeAmount,
        charge_currency: chargeCurrency,
        fx_rate: fxRate,
        wallet_currency: walletCurrency,
      },
    });

    return json({
      success: true,
      amount_usd,
      charge_amount: chargeAmount,
      charge_currency: chargeCurrency,
      fx_rate: fxRate,
      new_top_up_balance: Number(after?.top_up_balance || 0),
    });
  } catch (err) {
    console.error("tenant-ai-credit-topup error:", err);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}