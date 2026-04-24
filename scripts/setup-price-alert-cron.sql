-- ============================================================
-- Price Alert Check — Cron Job Setup (every 24 hours)
-- ============================================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old job if exists
SELECT cron.unschedule('price-alert-check-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'price-alert-check-daily');

-- Schedule daily at 6 AM UTC
SELECT cron.schedule(
  'price-alert-check-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/price-alert-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
