CREATE TABLE public.google_place_id_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  place_id text NOT NULL,
  name text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE UNIQUE INDEX idx_google_place_id_cache_query ON public.google_place_id_cache (lower(query));

ALTER TABLE public.google_place_id_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.google_place_id_cache FOR ALL USING (true) WITH CHECK (true);