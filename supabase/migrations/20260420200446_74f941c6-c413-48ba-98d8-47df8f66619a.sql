
SELECT cron.unschedule('daily-auto-blog-enterprise-tenants')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-auto-blog-enterprise-tenants');

SELECT cron.schedule(
  'daily-auto-blog-enterprise-tenants',
  '0 7 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/auto-blog-post',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
    body := '{"mode":"all_enterprise"}'::jsonb
  ) AS request_id;
  $cron$
);
