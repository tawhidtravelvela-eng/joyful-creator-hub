-- Persistent search cache for flight searches (used by unified-flight-search)
CREATE TABLE IF NOT EXISTS public.flight_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  from_code text NOT NULL,
  to_code text NOT NULL,
  depart_date date,
  return_date date,
  tenant_id uuid,
  result_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_flight_search_cache_key ON public.flight_search_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_flight_search_cache_expires ON public.flight_search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_flight_search_cache_route ON public.flight_search_cache(from_code, to_code, depart_date);

ALTER TABLE public.flight_search_cache ENABLE ROW LEVEL SECURITY;

-- Service role manages this; nothing readable via anon key directly.
CREATE POLICY "service role manages flight search cache"
ON public.flight_search_cache
FOR ALL
USING (false)
WITH CHECK (false);

-- Cleanup helper
CREATE OR REPLACE FUNCTION public.cleanup_flight_search_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.flight_search_cache WHERE expires_at < now();
$$;