-- Self-healing highlights backfill: runs once every 7 days to catch any new products missing highlights
-- Auto-unschedules when remaining = 0, re-run this script to restart
-- Run this in the SQL Editor: https://supabase.com/dashboard/project/vqvkgdjuzqmysmhhaswm/sql/new

-- First unschedule if already exists (safe to call even if not scheduled)
select cron.unschedule('backfill-tour-highlights');

select cron.schedule(
  'backfill-tour-highlights',
  '0 3 * * 0',  -- Every Sunday at 3:00 AM UTC
  $$
  select
    net.http_post(
        url:='https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/tour-inventory-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
        body:='{"action": "backfill-highlights", "batchSize": 2000}'::jsonb
    ) as request_id;
  $$
);

-- Auto-unschedules when remaining = 0 (built into the DB function)
-- To check progress: SELECT public.backfill_tour_highlights(0);
-- To manually re-enable: just re-run this script
