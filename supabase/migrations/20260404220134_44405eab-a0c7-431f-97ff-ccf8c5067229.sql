ALTER TABLE public.google_place_id_cache DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.google_place_id_cache ADD COLUMN IF NOT EXISTS fail_count smallint NOT NULL DEFAULT 0;
ALTER TABLE public.google_place_id_cache ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT now();