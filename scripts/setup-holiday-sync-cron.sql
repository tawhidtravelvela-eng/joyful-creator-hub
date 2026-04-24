-- ============================================================
-- Holiday Sync Cron Job
-- Runs once yearly on Jan 2nd at 03:00 UTC to bulk-fetch
-- national holidays for all 230+ countries via Calendarific.
-- Also runs monthly on the 1st as a catch-up for any failures.
-- ============================================================

-- Yearly full sync (Jan 2nd — after New Year)
SELECT cron.schedule(
  'sync-holidays-yearly',
  '0 3 2 1 *',   -- Jan 2nd, 03:00 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-holidays',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Monthly catch-up (1st of each month, 04:00 UTC)
-- Only processes countries that weren't cached yet (idempotent)
SELECT cron.schedule(
  'sync-holidays-monthly-catchup',
  '0 4 1 * *',   -- 1st of month, 04:00 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-holidays',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
