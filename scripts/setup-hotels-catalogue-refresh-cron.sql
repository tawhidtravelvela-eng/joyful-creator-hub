-- ============================================================
-- Hotels Catalogue Refresh — Weekly Cron Job
-- ============================================================
-- Run this SQL in your Supabase SQL Editor (one-time setup).
--
-- Refreshes the unified `hotels_catalogue` materialised view every
-- Sunday at 4 AM UTC. CONCURRENTLY = readers are not blocked.
--
-- Typical run time on 2M+ rows: 45s–3min depending on disk I/O.
-- ============================================================

-- 1. Ensure extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Remove old job if exists
SELECT cron.unschedule('hotels-catalogue-refresh-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hotels-catalogue-refresh-weekly');

-- 3. Schedule weekly refresh — Sunday 4 AM UTC
--    Calls the SECURITY DEFINER function so no auth/network hop needed.
SELECT cron.schedule(
  'hotels-catalogue-refresh-weekly',
  '0 4 * * 0',
  $$ SELECT public.cron_refresh_hotels_catalogue(); $$
);

-- 4. Verify
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname = 'hotels-catalogue-refresh-weekly';

-- ============================================================
-- ON-DEMAND REFRESH (admin-callable from the app or SQL editor)
-- ============================================================
-- Use this after major events: new supplier added, big initial sync,
-- etc. Skip for routine modified-since deltas.
--
--   SELECT public.refresh_hotels_catalogue(true);
--   -- returns { success, rows, duration_ms, refreshed_at }
-- ============================================================