
-- Tour product cache: stores full Viator (and future provider) product data
CREATE TABLE public.tour_product_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL,
  provider text NOT NULL DEFAULT 'viator',
  destination text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  short_description text DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  pricing_type text NOT NULL DEFAULT 'PER_PERSON',
  rating numeric DEFAULT 0,
  review_count integer DEFAULT 0,
  duration text DEFAULT '',
  image_url text DEFAULT '',
  category text DEFAULT '',
  highlights text[] DEFAULT '{}',
  age_bands jsonb DEFAULT '[]',
  product_data jsonb NOT NULL DEFAULT '{}',
  images text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (product_code, provider)
);

-- Index for fast lookups
CREATE INDEX idx_tour_product_cache_product_code ON public.tour_product_cache(product_code);
CREATE INDEX idx_tour_product_cache_destination ON public.tour_product_cache(destination);
CREATE INDEX idx_tour_product_cache_expires ON public.tour_product_cache(expires_at);
CREATE INDEX idx_tour_product_cache_price ON public.tour_product_cache(price);

-- Tour search results cache: stores search queries → result sets
CREATE TABLE public.tour_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  search_query text NOT NULL DEFAULT '',
  destination_id text DEFAULT '',
  result_count integer NOT NULL DEFAULT 0,
  product_codes text[] NOT NULL DEFAULT '{}',
  results jsonb NOT NULL DEFAULT '[]',
  currency text NOT NULL DEFAULT 'USD',
  provider text NOT NULL DEFAULT 'viator',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX idx_tour_search_cache_key ON public.tour_search_cache(cache_key);
CREATE INDEX idx_tour_search_cache_expires ON public.tour_search_cache(expires_at);

-- RLS
ALTER TABLE public.tour_product_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_search_cache ENABLE ROW LEVEL SECURITY;

-- Public can read cached tours (for discovery UI)
CREATE POLICY "Public read tour_product_cache" ON public.tour_product_cache
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service manage tour_product_cache" ON public.tour_product_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service manage tour_search_cache" ON public.tour_search_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cleanup function for expired cache
CREATE OR REPLACE FUNCTION public.cleanup_tour_cache()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  DELETE FROM public.tour_product_cache WHERE expires_at < now();
  DELETE FROM public.tour_search_cache WHERE expires_at < now();
$$;
