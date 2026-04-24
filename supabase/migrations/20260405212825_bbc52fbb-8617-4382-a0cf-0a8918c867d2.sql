ALTER TABLE public.tour_product_cache ADD COLUMN IF NOT EXISTS places_covered text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tour_product_cache_places_covered ON public.tour_product_cache USING GIN(places_covered);
