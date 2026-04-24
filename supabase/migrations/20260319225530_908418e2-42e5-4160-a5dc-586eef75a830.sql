CREATE TABLE IF NOT EXISTS public.hotel_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX idx_hotel_search_cache_key ON public.hotel_search_cache(cache_key);
CREATE INDEX idx_hotel_search_cache_expires ON public.hotel_search_cache(expires_at);

ALTER TABLE public.hotel_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage hotel_search_cache"
ON public.hotel_search_cache FOR ALL TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.cleanup_hotel_search_cache()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = 'public' AS $$
  DELETE FROM public.hotel_search_cache WHERE expires_at < now();
$$;