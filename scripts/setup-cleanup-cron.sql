-- Run this in Supabase SQL Editor to schedule hourly cleanup
-- Deletes: debug logs (24h), draft trips (3d), unconfirmed trips (7d)

select cron.schedule(
  'cleanup-old-records',
  '0 * * * *',  -- every hour
  $$SELECT public.cleanup_old_records();$$
);
