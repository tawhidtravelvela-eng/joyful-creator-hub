ALTER TABLE public.airline_settings
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS from_code text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS to_code text NULL DEFAULT '';