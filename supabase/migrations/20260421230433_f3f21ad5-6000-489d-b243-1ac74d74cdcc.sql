-- Monthly AI credit period refresh
-- - Resets used_this_period back to 0 when current period has ended
-- - Advances period_start/period_end by 1 month
-- - Forfeits expired top_up_balance older than 1 full period (rollover policy: 1 month)
--
-- Safe to call repeatedly per tenant; only acts when now() >= period_end.

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
BEGIN
  SELECT * INTO v_row
  FROM public.tenant_ai_credits
  WHERE tenant_id = _tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_ai_credits (tenant_id)
    VALUES (_tenant_id)
    RETURNING * INTO v_row;
  END IF;

  -- Period still active → nothing to do.
  IF now()::date < v_row.period_end THEN
    RETURN jsonb_build_object(
      'rolled_over', false,
      'period_start', v_row.period_start,
      'period_end',   v_row.period_end,
      'used_this_period', v_row.used_this_period,
      'top_up_balance',   v_row.top_up_balance
    );
  END IF;

  -- How many whole monthly periods elapsed (handles long inactivity).
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
    -- Rollover policy: keep top_up_balance for exactly 1 period (drops to 0
    -- if more than one period has elapsed without use).
    top_up_balance    = CASE WHEN v_periods_elapsed = 1 THEN top_up_balance ELSE 0 END,
    period_start      = v_new_start,
    period_end        = v_new_end,
    updated_at        = now()
  WHERE tenant_id = _tenant_id;

  RETURN jsonb_build_object(
    'rolled_over', true,
    'periods_elapsed', v_periods_elapsed,
    'period_start', v_new_start,
    'period_end',   v_new_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_tenant_ai_credits(uuid)
  TO authenticated, service_role;

-- Bulk variant: refresh every tenant whose period has ended. Returns count.
CREATE OR REPLACE FUNCTION public.refresh_all_tenant_ai_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT tenant_id FROM public.tenant_ai_credits
    WHERE period_end <= now()::date
  LOOP
    PERFORM public.refresh_tenant_ai_credits(rec.tenant_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('refreshed', v_count, 'ran_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_all_tenant_ai_credits()
  TO service_role;

-- Daily cron — runs every day at 02:15 UTC. Cheap because it only touches
-- rows whose period actually ended.
SELECT cron.unschedule('refresh-tenant-ai-credits-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-tenant-ai-credits-daily'
);

SELECT cron.schedule(
  'refresh-tenant-ai-credits-daily',
  '15 2 * * *',
  $$ SELECT public.refresh_all_tenant_ai_credits(); $$
);