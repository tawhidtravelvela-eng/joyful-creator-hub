CREATE TABLE IF NOT EXISTS public.city_landmarks_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL,
  landmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'ai-generated',
  CONSTRAINT city_landmarks_cache_city_name_key UNIQUE (city_name)
);

ALTER TABLE public.city_landmarks_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage city_landmarks_cache"
  ON public.city_landmarks_cache FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Public read city_landmarks_cache"
  ON public.city_landmarks_cache FOR SELECT
  TO anon, authenticated
  USING (true);