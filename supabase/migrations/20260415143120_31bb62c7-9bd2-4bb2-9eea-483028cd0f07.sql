ALTER TABLE public.smtp_configurations
  ADD COLUMN IF NOT EXISTS email_mode text NOT NULL DEFAULT 'platform' CHECK (email_mode IN ('platform', 'custom'));

ALTER TABLE public.smtp_configurations
  ADD COLUMN IF NOT EXISTS daily_quota integer NOT NULL DEFAULT 200;

ALTER TABLE public.smtp_configurations
  ADD COLUMN IF NOT EXISTS daily_sent integer NOT NULL DEFAULT 0;

ALTER TABLE public.smtp_configurations
  ADD COLUMN IF NOT EXISTS quota_reset_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.smtp_configurations ALTER COLUMN host DROP NOT NULL;
ALTER TABLE public.smtp_configurations ALTER COLUMN username DROP NOT NULL;
ALTER TABLE public.smtp_configurations ALTER COLUMN from_email DROP NOT NULL;