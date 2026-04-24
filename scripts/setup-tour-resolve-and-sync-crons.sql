-- ============================================================
-- Tour Inventory: Re-resolve + Auto-Sync Background Crons
-- ============================================================
-- Re-resolve runs every 2 min to fix contaminated products
-- Sync-batch runs every 5 min for ongoing population
-- Both are safe to overlap — they operate on different product sets

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old jobs if exist
SELECT cron.unschedule('tour-re-resolve-batch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tour-re-resolve-batch');

SELECT cron.unschedule('tour-inventory-sync-batch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tour-inventory-sync-batch');

-- 1. Re-resolve every 2 minutes (fixes ~500 products per run, auto-idle when done)
SELECT cron.schedule(
  'tour-re-resolve-batch',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/tour-inventory-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
    body := '{"action": "re-resolve"}'::jsonb
  ) AS request_id;
  $$
);

-- 2. Sync-batch every 2 minutes (fetches ~35 product details per batch)
SELECT cron.schedule(
  'tour-inventory-sync-batch',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/tour-inventory-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
    body := '{"action": "sync-batch"}'::jsonb
  ) AS request_id;
  $$
);

-- Verify
SELECT jobid, jobname, schedule, active FROM cron.job 
WHERE jobname IN ('tour-re-resolve-batch', 'tour-inventory-sync-batch');
