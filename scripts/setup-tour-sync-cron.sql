-- ============================================================
-- Tour Inventory Background Sync — Cron Job Setup
-- ============================================================
-- Run this SQL in your Supabase SQL Editor
-- This triggers a sync batch every 2 minutes (fast continuous sync)
-- Each batch fetches ~10 product details with 1.5s delays
-- Paused destinations auto-resume after 5 min cooldown

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remove old job if exists
SELECT cron.unschedule('tour-inventory-sync-batch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tour-inventory-sync-batch');

-- 3. Schedule every 5 minutes
SELECT cron.schedule(
  'tour-inventory-sync-batch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/tour-inventory-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
    body := '{"action": "sync-batch"}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Verify
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'tour-inventory-sync-batch';
