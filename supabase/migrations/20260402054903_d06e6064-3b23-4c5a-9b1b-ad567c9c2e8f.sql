select
cron.schedule(
  'backfill-option-pricing',
  '0 */6 * * *',
  $$
  select
    net.http_post(
        url:='https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/tour-inventory-sync',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
        body:='{"action": "backfill-option-pricing"}'::jsonb
    ) as request_id;
  $$
);