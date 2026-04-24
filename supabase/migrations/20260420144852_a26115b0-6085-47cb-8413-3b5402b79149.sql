ALTER TABLE public.custom_sites
  ADD COLUMN IF NOT EXISTS ai_bot_name text,
  ADD COLUMN IF NOT EXISTS ai_bot_avatar_url text,
  ADD COLUMN IF NOT EXISTS ai_bot_greeting text,
  ADD COLUMN IF NOT EXISTS ai_bot_tone text DEFAULT 'friendly',
  ADD COLUMN IF NOT EXISTS mention_ai boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS base_version text DEFAULT 'aurora';

ALTER TABLE public.custom_site_pages
  ADD COLUMN IF NOT EXISTS content_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb;