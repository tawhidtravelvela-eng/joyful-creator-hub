
-- Transfer route cache for the managed transfer system
CREATE TABLE public.transfer_route_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_key TEXT NOT NULL,
  pickup_type TEXT NOT NULL DEFAULT 'airport',
  pickup_code TEXT,
  pickup_name TEXT,
  dropoff_type TEXT NOT NULL DEFAULT 'hotel',
  dropoff_code TEXT,
  dropoff_name TEXT,
  passenger_count INTEGER DEFAULT 2,
  luggage_class TEXT DEFAULT 'standard',
  vehicle_class TEXT DEFAULT 'standard_sedan',
  time_bucket TEXT DEFAULT 'daytime',
  pricing_source TEXT NOT NULL DEFAULT 'AI_ESTIMATED',
  price_accuracy TEXT NOT NULL DEFAULT 'MEDIUM',
  bookability TEXT NOT NULL DEFAULT 'arrange_manually',
  currency TEXT NOT NULL DEFAULT 'USD',
  total_price NUMERIC NOT NULL DEFAULT 0,
  per_person_price NUMERIC,
  transfer_type TEXT DEFAULT 'airport_hotel',
  mode TEXT DEFAULT 'private_car',
  duration_minutes INTEGER,
  is_roundtrip BOOLEAN DEFAULT false,
  is_mandatory BOOLEAN DEFAULT false,
  confidence_score NUMERIC DEFAULT 0.5,
  recommendation_text TEXT,
  tags TEXT[],
  resolved_data JSONB DEFAULT '{}'::jsonb,
  country TEXT,
  city TEXT,
  destination_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_key)
);

-- Index for fast lookups
CREATE INDEX idx_transfer_cache_route ON public.transfer_route_cache(route_key);
CREATE INDEX idx_transfer_cache_city ON public.transfer_route_cache(city, country);
CREATE INDEX idx_transfer_cache_expires ON public.transfer_route_cache(expires_at);

-- Enable RLS (public read, service-role write)
ALTER TABLE public.transfer_route_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read transfer cache"
ON public.transfer_route_cache FOR SELECT
USING (true);

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_transfer_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.transfer_route_cache WHERE expires_at < now();
$$;

-- Updated_at trigger
CREATE TRIGGER update_transfer_cache_updated_at
BEFORE UPDATE ON public.transfer_route_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
