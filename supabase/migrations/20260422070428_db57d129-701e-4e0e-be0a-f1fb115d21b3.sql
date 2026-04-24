-- 1. Add the two plan-level columns described in the plan.
ALTER TABLE public.b2b_plans
  ADD COLUMN IF NOT EXISTS monthly_ai_credit_usd numeric(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS allow_full_rebuild boolean NOT NULL DEFAULT true;

-- 2. Seed sensible per-tier defaults from the plan doc.
UPDATE public.b2b_plans SET monthly_ai_credit_usd = 5.00  WHERE plan_key = 'starter';
UPDATE public.b2b_plans SET monthly_ai_credit_usd = 15.00 WHERE plan_key = 'growth';
UPDATE public.b2b_plans SET monthly_ai_credit_usd = 25.00 WHERE plan_key = 'pro';
UPDATE public.b2b_plans SET monthly_ai_credit_usd = 50.00 WHERE plan_key IN ('enterprise', 'business');

-- Starter plans typically don't include the (expensive) full rebuild.
UPDATE public.b2b_plans SET allow_full_rebuild = false WHERE plan_key = 'starter';

-- 3. Helper: resolve the AI grant for a tenant's *currently active* plan.
CREATE OR REPLACE FUNCTION public.get_tenant_ai_grant(_tenant_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.monthly_ai_credit_usd
      FROM public.tenants t
      JOIN public.b2b_plans p ON p.plan_key = t.plan_key
      WHERE t.id = _tenant_id
        AND (t.plan_expires_at IS NULL OR t.plan_expires_at > now())
      LIMIT 1
    ),
    -- Fallback to Starter's grant if no active plan
    (SELECT monthly_ai_credit_usd FROM public.b2b_plans WHERE plan_key = 'starter' LIMIT 1),
    5.00
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_ai_grant(uuid)
  TO authenticated, service_role;

-- 4. Refresh function: read the per-plan grant rather than a hardcoded default.
CREATE OR REPLACE FUNCTION public.refresh_tenant_ai_credits(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_periods_elapsed int;
  v_new_start date;
  v_new_end date;
  v_grant numeric;
BEGIN
  v_grant := public.get_tenant_ai_grant(_tenant_id);

  SELECT * INTO v_row
  FROM public.tenant_ai_credits
  WHERE tenant_id = _tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_ai_credits (tenant_id, monthly_allowance)
    VALUES (_tenant_id, v_grant)
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'rolled_over', false,
      'period_start', v_row.period_start,
      'period_end', v_row.period_end,
      'monthly_allowance', v_row.monthly_allowance,
      'used_this_period', v_row.used_this_period,
      'top_up_balance', v_row.top_up_balance
    );
  END IF;

  IF now()::date < v_row.period_end THEN
    -- Even mid-period, keep allowance in sync if plan changed.
    IF v_row.monthly_allowance IS DISTINCT FROM v_grant THEN
      UPDATE public.tenant_ai_credits
      SET monthly_allowance = v_grant, updated_at = now()
      WHERE tenant_id = _tenant_id;
    END IF;
    RETURN jsonb_build_object(
      'rolled_over', false,
      'period_start', v_row.period_start,
      'period_end',   v_row.period_end,
      'monthly_allowance', v_grant,
      'used_this_period', v_row.used_this_period,
      'top_up_balance',   v_row.top_up_balance
    );
  END IF;

  v_periods_elapsed := GREATEST(
    1,
    extract(year  from age(now()::date, v_row.period_end))::int * 12
    + extract(month from age(now()::date, v_row.period_end))::int + 1
  );

  v_new_start := v_row.period_end;
  v_new_end   := (v_row.period_end + (v_periods_elapsed || ' months')::interval)::date;

  UPDATE public.tenant_ai_credits
  SET
    used_this_period  = 0,
    monthly_allowance = v_grant,
    top_up_balance    = CASE WHEN v_periods_elapsed = 1 THEN top_up_balance ELSE 0 END,
    period_start      = v_new_start,
    period_end        = v_new_end,
    updated_at        = now()
  WHERE tenant_id = _tenant_id;

  RETURN jsonb_build_object(
    'rolled_over', true,
    'periods_elapsed', v_periods_elapsed,
    'period_start', v_new_start,
    'period_end',   v_new_end,
    'monthly_allowance', v_grant
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_tenant_ai_credits(uuid)
  TO authenticated, service_role;

-- 5. Sync allowance immediately when a tenant's plan changes (subscribe / upgrade / admin grant).
CREATE OR REPLACE FUNCTION public.sync_tenant_ai_allowance_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant numeric;
BEGIN
  IF NEW.plan_key IS DISTINCT FROM OLD.plan_key
     OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at THEN
    v_grant := public.get_tenant_ai_grant(NEW.id);

    INSERT INTO public.tenant_ai_credits (tenant_id, monthly_allowance)
    VALUES (NEW.id, v_grant)
    ON CONFLICT (tenant_id) DO UPDATE
      SET monthly_allowance = EXCLUDED.monthly_allowance,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_ai_allowance_on_plan_change ON public.tenants;
CREATE TRIGGER sync_ai_allowance_on_plan_change
  AFTER UPDATE OF plan_key, plan_expires_at ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tenant_ai_allowance_on_plan_change();

-- 6. Backfill existing tenant_ai_credits rows so allowance reflects current plan.
UPDATE public.tenant_ai_credits c
SET monthly_allowance = public.get_tenant_ai_grant(c.tenant_id),
    updated_at = now()
WHERE c.monthly_allowance IS DISTINCT FROM public.get_tenant_ai_grant(c.tenant_id);