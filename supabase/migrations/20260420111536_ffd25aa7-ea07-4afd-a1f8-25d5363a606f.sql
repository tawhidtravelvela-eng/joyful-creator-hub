-- 1. Extend b2b_plans with first-year vs renewal pricing + marketing data
ALTER TABLE public.b2b_plans
  ADD COLUMN IF NOT EXISTS first_year_price_usd numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_price_usd numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS badge_label text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Seed sensible defaults: first year = yearly price, renewal = same
UPDATE public.b2b_plans
SET first_year_price_usd = COALESCE(NULLIF(yearly_price_usd, 0), monthly_price_usd * 12),
    renewal_price_usd    = COALESCE(NULLIF(yearly_price_usd, 0), monthly_price_usd * 12)
WHERE first_year_price_usd = 0;

-- Mark Pro as featured/popular
UPDATE public.b2b_plans SET is_featured = true, badge_label = 'Most popular' WHERE plan_key = 'pro';

-- Default marketing bullets
UPDATE public.b2b_plans SET features = '["Hotels module","5 pages","2 section variants","Travelvela subdomain"]'::jsonb WHERE plan_key = 'starter' AND features = '[]'::jsonb;
UPDATE public.b2b_plans SET features = '["Flights + Hotels + Tours","15 pages","4 section variants","Custom domain","AI copy assist"]'::jsonb WHERE plan_key = 'pro' AND features = '[]'::jsonb;
UPDATE public.b2b_plans SET features = '["All modules incl. Transfers","50 pages","Unlimited variants","Custom domain","AI copy assist","Branding removed","Priority support"]'::jsonb WHERE plan_key = 'enterprise' AND features = '[]'::jsonb;

-- 2. Tenant plan lifecycle columns
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_billing_cycle text NOT NULL DEFAULT 'yearly';

-- 3. Subscription history table
CREATE TABLE IF NOT EXISTS public.tenant_plan_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'yearly',
  amount_usd numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_renewal boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'wallet',
  wallet_transaction_id uuid REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_plan_subs_tenant ON public.tenant_plan_subscriptions(tenant_id, created_at DESC);

ALTER TABLE public.tenant_plan_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins read own subscriptions" ON public.tenant_plan_subscriptions;
CREATE POLICY "Tenant admins read own subscriptions"
  ON public.tenant_plan_subscriptions FOR SELECT
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins manage subscriptions" ON public.tenant_plan_subscriptions;
CREATE POLICY "Super admins manage subscriptions"
  ON public.tenant_plan_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. RPC: subscribe / renew via wallet
CREATE OR REPLACE FUNCTION public.subscribe_tenant_plan(
  p_tenant_id uuid,
  p_plan_key text,
  p_billing_cycle text DEFAULT 'yearly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_tenant RECORD;
  v_user_id uuid := auth.uid();
  v_amount numeric(10,2);
  v_currency text := 'USD';
  v_balance numeric;
  v_is_renewal boolean := false;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_period interval;
  v_tx_id uuid;
  v_sub_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Permission: tenant admin or super admin
  IF NOT (public.is_tenant_admin_of(p_tenant_id) OR public.has_role(v_user_id, 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied: must be tenant admin';
  END IF;

  SELECT * INTO v_plan FROM public.b2b_plans WHERE plan_key = p_plan_key AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found or inactive: %', p_plan_key; END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant not found'; END IF;

  -- Decide first-year vs renewal
  v_is_renewal := (v_tenant.plan_key = p_plan_key AND v_tenant.plan_started_at IS NOT NULL);

  -- Pick price (yearly cycle uses first_year vs renewal, monthly uses monthly_price)
  IF p_billing_cycle = 'monthly' THEN
    v_amount := v_plan.monthly_price_usd;
    v_period := interval '1 month';
  ELSE
    v_amount := CASE WHEN v_is_renewal THEN v_plan.renewal_price_usd ELSE v_plan.first_year_price_usd END;
    v_period := interval '1 year';
  END IF;

  -- Free plan shortcut
  IF v_amount <= 0 THEN
    v_starts_at := now();
    v_expires_at := now() + v_period;
    UPDATE public.tenants
       SET plan_key = p_plan_key, plan_started_at = v_starts_at, plan_expires_at = v_expires_at, plan_billing_cycle = p_billing_cycle
     WHERE id = p_tenant_id;
    INSERT INTO public.tenant_plan_subscriptions (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, is_renewal, source, created_by)
    VALUES (p_tenant_id, p_plan_key, p_billing_cycle, 0, v_starts_at, v_expires_at, v_is_renewal, 'free', v_user_id)
    RETURNING id INTO v_sub_id;
    RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id, 'expires_at', v_expires_at, 'amount', 0);
  END IF;

  -- Check wallet balance (across all tenant admins is too broad — use caller's wallet)
  SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END), 0)
    INTO v_balance
  FROM public.wallet_transactions
  WHERE user_id = v_user_id AND status = 'completed';

  IF v_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance: need %, have %', v_amount, v_balance;
  END IF;

  -- Compute new period (extend if renewing before expiry)
  v_starts_at := now();
  IF v_is_renewal AND v_tenant.plan_expires_at IS NOT NULL AND v_tenant.plan_expires_at > now() THEN
    v_expires_at := v_tenant.plan_expires_at + v_period;
  ELSE
    v_expires_at := now() + v_period;
  END IF;

  -- Debit wallet
  INSERT INTO public.wallet_transactions (user_id, amount, type, status, currency, description, category, tenant_id)
  VALUES (v_user_id, v_amount, 'debit', 'completed', v_currency,
          CASE WHEN v_is_renewal THEN 'Plan renewal: ' ELSE 'Plan subscription: ' END || v_plan.display_name || ' (' || p_billing_cycle || ')',
          'plan_subscription', p_tenant_id)
  RETURNING id INTO v_tx_id;

  -- Update tenant
  UPDATE public.tenants
     SET plan_key = p_plan_key,
         plan_started_at = COALESCE(v_tenant.plan_started_at, v_starts_at),
         plan_expires_at = v_expires_at,
         plan_billing_cycle = p_billing_cycle
   WHERE id = p_tenant_id;

  -- Record subscription
  INSERT INTO public.tenant_plan_subscriptions (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, is_renewal, source, wallet_transaction_id, created_by)
  VALUES (p_tenant_id, p_plan_key, p_billing_cycle, v_amount, v_starts_at, v_expires_at, v_is_renewal, 'wallet', v_tx_id, v_user_id)
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'expires_at', v_expires_at,
    'amount', v_amount,
    'is_renewal', v_is_renewal
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscribe_tenant_plan(uuid, text, text) TO authenticated;

-- 5. Admin RPC: manually grant a plan (no wallet debit), for legacy / sales overrides
CREATE OR REPLACE FUNCTION public.admin_grant_tenant_plan(
  p_tenant_id uuid,
  p_plan_key text,
  p_expires_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sub_id uuid;
BEGIN
  IF NOT public.has_role(v_user_id, 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super admin required';
  END IF;

  UPDATE public.tenants
     SET plan_key = p_plan_key,
         plan_started_at = COALESCE(plan_started_at, now()),
         plan_expires_at = p_expires_at,
         plan_billing_cycle = 'yearly'
   WHERE id = p_tenant_id;

  INSERT INTO public.tenant_plan_subscriptions (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, source, notes, created_by)
  VALUES (p_tenant_id, p_plan_key, 'yearly', 0, now(), p_expires_at, 'admin_grant', p_notes, v_user_id)
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id, 'expires_at', p_expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_tenant_plan(uuid, text, timestamptz, text) TO authenticated;

-- 6. Backfill: grandfather all existing tenants with a plan onto Enterprise for 1 year from today
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants WHERE plan_key IS NOT NULL AND plan_started_at IS NULL
  LOOP
    UPDATE public.tenants
       SET plan_key = 'enterprise',
           plan_started_at = now(),
           plan_expires_at = now() + interval '1 year',
           plan_billing_cycle = 'yearly'
     WHERE id = t.id;

    INSERT INTO public.tenant_plan_subscriptions (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, source, notes)
    VALUES (t.id, 'enterprise', 'yearly', 0, now(), now() + interval '1 year', 'legacy_grandfather',
            'Grandfathered from legacy white-label license. Renewal required before expiry.');
  END LOOP;
END $$;

-- 7. Update get_tenant_modules to factor in expiry (expired => starter)
CREATE OR REPLACE FUNCTION public.get_tenant_modules(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_overrides JSONB;
  v_result JSONB;
  v_effective_plan_key text;
  v_expires_at timestamptz;
  v_is_expired boolean := false;
BEGIN
  SELECT t.plan_key, t.module_overrides, t.plan_expires_at
    INTO v_effective_plan_key, v_overrides, v_expires_at
  FROM public.tenants t
  WHERE t.id = _tenant_id;

  v_is_expired := (v_expires_at IS NOT NULL AND v_expires_at < now());
  IF v_is_expired OR v_effective_plan_key IS NULL THEN
    v_effective_plan_key := 'starter';
  END IF;

  SELECT * INTO v_plan FROM public.b2b_plans WHERE plan_key = v_effective_plan_key;
  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.b2b_plans WHERE plan_key = 'starter';
  END IF;

  v_overrides := COALESCE(v_overrides, '{}'::jsonb);

  v_result := jsonb_build_object(
    'plan_key', v_plan.plan_key,
    'plan_expires_at', v_expires_at,
    'is_expired', v_is_expired,
    'flights',           COALESCE((v_overrides->>'flights')::boolean,           v_plan.allow_flights),
    'hotels',            COALESCE((v_overrides->>'hotels')::boolean,            v_plan.allow_hotels),
    'tours',             COALESCE((v_overrides->>'tours')::boolean,             v_plan.allow_tours),
    'transfers',         COALESCE((v_overrides->>'transfers')::boolean,         v_plan.allow_transfers),
    'custom_domain',     COALESCE((v_overrides->>'custom_domain')::boolean,     v_plan.allow_custom_domain),
    'ai_copy',           COALESCE((v_overrides->>'ai_copy')::boolean,           v_plan.allow_ai_copy),
    'remove_branding',   COALESCE((v_overrides->>'remove_branding')::boolean,   v_plan.allow_remove_branding),
    'max_pages',         v_plan.max_pages,
    'max_section_variants', v_plan.max_section_variants
  );

  RETURN v_result;
END;
$$;

-- Allow anyone authenticated to read active b2b_plans (for pricing UI)
DROP POLICY IF EXISTS "Anyone can read active plans" ON public.b2b_plans;
CREATE POLICY "Anyone can read active plans"
  ON public.b2b_plans FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins manage plans" ON public.b2b_plans;
CREATE POLICY "Super admins manage plans"
  ON public.b2b_plans FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.b2b_plans ENABLE ROW LEVEL SECURITY;