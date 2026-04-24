-- Ensure pg_cron + pg_net are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Bulk refresh function: rolls over every tenant whose period has expired.
CREATE OR REPLACE FUNCTION public.refresh_all_tenant_ai_credits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  WITH rolled AS (
    UPDATE public.tenant_ai_credits
       SET used_this_period = 0,
           period_start = now(),
           period_end = now() + interval '30 days'
     WHERE period_end < now()
    RETURNING tenant_id
  )
  SELECT count(*) INTO v_count FROM rolled;

  RETURN jsonb_build_object('refreshed_tenants', v_count, 'ran_at', now());
END;
$$;

-- Daily cron at 03:15 UTC (low-traffic window)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-tenant-ai-credits-daily') THEN
    PERFORM cron.unschedule('refresh-tenant-ai-credits-daily');
  END IF;
  PERFORM cron.schedule(
    'refresh-tenant-ai-credits-daily',
    '15 3 * * *',
    $cron$ SELECT public.refresh_all_tenant_ai_credits(); $cron$
  );
END $$;