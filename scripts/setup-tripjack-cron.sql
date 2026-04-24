-- ============================================================
-- Tripjack Hotel Sync — Weekly Cron Job Setup
-- ============================================================
-- Run this SQL in your Supabase SQL Editor (or psql for self-hosted)
-- 
-- Prerequisites: pg_cron and pg_net extensions must be enabled
-- Replace YOUR_SUPABASE_URL and YOUR_ANON_KEY with your values
-- ============================================================

-- 1. Enable extensions (skip if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remove old job if exists
SELECT cron.unschedule('tripjack-weekly-hotel-sync') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tripjack-weekly-hotel-sync');

-- 3. Schedule weekly sync — every Sunday at 3:00 AM UTC
-- This triggers a batch of 50 pages (5000 hotels) per run.
-- For a full initial sync, use the bash script instead.
SELECT cron.schedule(
  'tripjack-weekly-hotel-sync',
  '0 3 * * 0',  -- Sunday 3 AM UTC
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/tripjack-hotel-search',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"action": "sync-hotels", "maxPages": 50}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Verify the job was created
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'tripjack-weekly-hotel-sync';
