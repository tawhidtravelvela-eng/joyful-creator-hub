-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily auto blog post generation at 6 AM UTC (12 PM Bangladesh time)
SELECT cron.schedule(
  'daily-auto-blog-posts',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vqvkgdjuzqmysmhhaswm.supabase.co/functions/v1/auto-blog-post',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdmtnZGp1enFteXNtaGhhc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzA1MzIsImV4cCI6MjA4ODY0NjUzMn0.q8SN7tDAJsDofQCcbperE9SMFBhSMseUcZ0a-Xg3LuU"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
