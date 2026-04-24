-- ============================================================
-- Viator Product Sync — Cron Jobs Setup
-- ============================================================
-- Run this SQL in your Supabase SQL Editor
-- 
-- Two cron jobs:
-- 1. Daily modified-since delta sync (2 AM UTC)
-- 2. Weekly destination refresh (Sunday 4 AM UTC)
-- ============================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remove old jobs if exist
SELECT cron.unschedule('viator-modified-since-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'viator-modified-since-daily');

SELECT cron.unschedule('viator-destination-refresh-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'viator-destination-refresh-weekly');

-- 3. Daily modified-since sync at 2 AM UTC
SELECT cron.schedule(
  'viator-modified-since-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/tour-inventory-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
    body := '{"action": "modified-since"}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Weekly destination refresh on Sunday 4 AM UTC
SELECT cron.schedule(
  'viator-destination-refresh-weekly',
  '0 4 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/tour-inventory-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
    body := '{"action": "destination-refresh"}'::jsonb
  ) AS request_id;
  $$
);

-- 5. Verify
SELECT jobid, jobname, schedule, active FROM cron.job 
WHERE jobname IN ('viator-modified-since-daily', 'viator-destination-refresh-weekly');
