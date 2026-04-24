
-- Cache for trip planner live search results (flights, hotels, activities)
-- TTL: 30 minutes for flights, 2 hours for hotels/activities
CREATE TABLE public.trip_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  search_type text NOT NULL CHECK (search_type IN ('flights', 'hotels', 'activities')),
  search_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  cached_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_trip_search_cache_key ON public.trip_search_cache (cache_key);
CREATE INDEX idx_trip_search_cache_expires ON public.trip_search_cache (expires_at);

-- Enable RLS
ALTER TABLE public.trip_search_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can manage cache
CREATE POLICY "Service manage trip_search_cache" ON public.trip_search_cache
  FOR ALL TO service_role USING (true);

-- Auto-cleanup expired entries (optional manual cleanup via cron)
CREATE OR REPLACE FUNCTION public.cleanup_trip_search_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.trip_search_cache WHERE expires_at < now();
$$;
