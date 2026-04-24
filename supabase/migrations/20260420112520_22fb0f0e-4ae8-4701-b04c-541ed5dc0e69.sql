
-- Per-currency price overrides for B2B plans (admin-set).
-- When no override exists for a (plan, currency, kind) we fall back to USD * live FX rate.
CREATE TABLE public.b2b_plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL REFERENCES public.b2b_plans(plan_key) ON DELETE CASCADE,
  currency text NOT NULL,
  -- which price slot this overrides
  price_kind text NOT NULL CHECK (price_kind IN ('monthly','first_year','renewal')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_key, currency, price_kind)
);

ALTER TABLE public.b2b_plan_prices ENABLE ROW LEVEL SECURITY;

-- Anyone can read prices (needed for the public pricing grid)
CREATE POLICY "Plan prices are readable by everyone"
  ON public.b2b_plan_prices FOR SELECT USING (true);

-- Only super admins can manage overrides
CREATE POLICY "Super admins manage plan prices"
  ON public.b2b_plan_prices FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_b2b_plan_prices_updated_at
  BEFORE UPDATE ON public.b2b_plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: resolve the price for a given plan + currency + kind.
-- Returns { amount, currency, source: 'override' | 'fx' }.
-- FX path uses live rates from api_settings.provider='currency_rates' (settings.live_rates jsonb).
CREATE OR REPLACE FUNCTION public.get_plan_price(
  p_plan_key text,
  p_currency text,
  p_price_kind text
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency text := UPPER(COALESCE(NULLIF(p_currency, ''), 'USD'));
  v_kind text := COALESCE(p_price_kind, 'first_year');
  v_override numeric;
  v_usd numeric;
  v_plan RECORD;
  v_rates jsonb;
  v_rate numeric;
BEGIN
  -- 1. Override?
  SELECT amount INTO v_override
    FROM public.b2b_plan_prices
   WHERE plan_key = p_plan_key
     AND currency = v_currency
     AND price_kind = v_kind;

  IF v_override IS NOT NULL THEN
    RETURN jsonb_build_object(
      'amount', v_override,
      'currency', v_currency,
      'source', 'override'
    );
  END IF;

  -- 2. Fallback: USD price * live FX rate
  SELECT * INTO v_plan FROM public.b2b_plans WHERE plan_key = p_plan_key;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('amount', 0, 'currency', v_currency, 'source', 'missing');
  END IF;

  v_usd := CASE v_kind
    WHEN 'monthly'    THEN v_plan.monthly_price_usd
    WHEN 'first_year' THEN v_plan.first_year_price_usd
    WHEN 'renewal'    THEN v_plan.renewal_price_usd
    ELSE v_plan.first_year_price_usd
  END;

  IF v_currency = 'USD' OR v_usd = 0 THEN
    RETURN jsonb_build_object('amount', v_usd, 'currency', v_currency, 'source', 'usd');
  END IF;

  SELECT settings->'live_rates' INTO v_rates
    FROM public.api_settings
   WHERE provider = 'currency_rates'
   LIMIT 1;

  v_rate := COALESCE((v_rates->>v_currency)::numeric, 0);
  IF v_rate <= 0 THEN
    -- No FX data — return USD amount unconverted so the UI can flag it.
    RETURN jsonb_build_object('amount', v_usd, 'currency', 'USD', 'source', 'fx_unavailable');
  END IF;

  RETURN jsonb_build_object(
    'amount', round(v_usd * v_rate, 2),
    'currency', v_currency,
    'source', 'fx'
  );
END;
$$;

-- Replace subscribe_tenant_plan: now charges in customer's currency.
CREATE OR REPLACE FUNCTION public.subscribe_tenant_plan(
  p_tenant_id uuid,
  p_plan_key text,
  p_billing_cycle text DEFAULT 'yearly',
  p_currency text DEFAULT NULL  -- NULL = use caller's billing_currency
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_tenant RECORD;
  v_user_id uuid := auth.uid();
  v_amount numeric(12,2);
  v_currency text;
  v_balance numeric;
  v_is_renewal boolean := false;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_period interval;
  v_tx_id uuid;
  v_sub_id uuid;
  v_kind text;
  v_price jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_tenant_admin_of(p_tenant_id) OR public.has_role(v_user_id, 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied: must be tenant admin';
  END IF;

  SELECT * INTO v_plan FROM public.b2b_plans WHERE plan_key = p_plan_key AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found or inactive: %', p_plan_key; END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;

  v_is_renewal := (v_tenant.plan_key = p_plan_key AND v_tenant.plan_started_at IS NOT NULL);

  -- Resolve currency: explicit param → caller's billing_currency → USD
  IF p_currency IS NULL OR p_currency = '' THEN
    SELECT UPPER(COALESCE(billing_currency, 'USD')) INTO v_currency
      FROM public.profiles WHERE user_id = v_user_id;
  ELSE
    v_currency := UPPER(p_currency);
  END IF;
  v_currency := COALESCE(v_currency, 'USD');

  -- Resolve price-kind + period
  IF p_billing_cycle = 'monthly' THEN
    v_kind := 'monthly';
    v_period := interval '1 month';
  ELSE
    v_kind := CASE WHEN v_is_renewal THEN 'renewal' ELSE 'first_year' END;
    v_period := interval '1 year';
  END IF;

  v_price := public.get_plan_price(p_plan_key, v_currency, v_kind);
  v_amount := COALESCE((v_price->>'amount')::numeric, 0);
  v_currency := COALESCE(v_price->>'currency', v_currency);

  -- Free plan shortcut
  IF v_amount <= 0 THEN
    v_starts_at := now();
    v_expires_at := now() + v_period;
    UPDATE public.tenants
       SET plan_key = p_plan_key, plan_started_at = v_starts_at,
           plan_expires_at = v_expires_at, plan_billing_cycle = p_billing_cycle
     WHERE id = p_tenant_id;
    INSERT INTO public.tenant_plan_subscriptions (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, is_renewal, source, created_by)
    VALUES (p_tenant_id, p_plan_key, p_billing_cycle, 0, v_starts_at, v_expires_at, v_is_renewal, 'free', v_user_id)
    RETURNING id INTO v_sub_id;
    RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id, 'expires_at', v_expires_at, 'amount', 0, 'currency', v_currency);
  END IF;

  -- Wallet check: balance in the SAME currency as the charge
  SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0)
    INTO v_balance
  FROM public.wallet_transactions
  WHERE user_id = v_user_id
    AND status = 'completed'
    AND UPPER(currency) = v_currency;

  IF v_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance in %: need %, have %', v_currency, v_amount, v_balance;
  END IF;

  v_starts_at := now();
  IF v_is_renewal AND v_tenant.plan_expires_at IS NOT NULL AND v_tenant.plan_expires_at > now() THEN
    v_expires_at := v_tenant.plan_expires_at + v_period;
  ELSE
    v_expires_at := now() + v_period;
  END IF;

  -- Debit in the customer's currency
  INSERT INTO public.wallet_transactions (user_id, amount, type, status, currency, description, category, tenant_id)
  VALUES (v_user_id, v_amount, 'debit', 'completed', v_currency,
          CASE WHEN v_is_renewal THEN 'Plan renewal: ' ELSE 'Plan subscription: ' END
            || v_plan.display_name || ' (' || p_billing_cycle || ')',
          'plan_subscription', p_tenant_id)
  RETURNING id INTO v_tx_id;

  UPDATE public.tenants
     SET plan_key = p_plan_key,
         plan_started_at = COALESCE(v_tenant.plan_started_at, v_starts_at),
         plan_expires_at = v_expires_at,
         plan_billing_cycle = p_billing_cycle
   WHERE id = p_tenant_id;

  -- Note: amount_usd column kept for backward compat — store the charged amount
  -- alongside the new currency field via the description; future migration can split.
  INSERT INTO public.tenant_plan_subscriptions (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, is_renewal, source, wallet_transaction_id, created_by, notes)
  VALUES (p_tenant_id, p_plan_key, p_billing_cycle, v_amount, v_starts_at, v_expires_at, v_is_renewal, 'wallet', v_tx_id, v_user_id,
          'Charged ' || v_amount::text || ' ' || v_currency)
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'expires_at', v_expires_at,
    'amount', v_amount,
    'currency', v_currency,
    'is_renewal', v_is_renewal,
    'price_source', v_price->>'source'
  );
END;
$$;
