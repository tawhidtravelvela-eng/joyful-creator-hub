SELECT cron.schedule(
  'cleanup-message-dedup',
  '*/30 * * * *',
  $$DELETE FROM public.message_dedup WHERE created_at < now() - interval '5 minutes'$$
);