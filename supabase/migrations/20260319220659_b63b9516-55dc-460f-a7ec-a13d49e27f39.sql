ALTER TABLE public.tripjack_hotels
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS facilities jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contact jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone DEFAULT now();