-- Update cleanup function to only clean search cache, never product cache
CREATE OR REPLACE FUNCTION public.cleanup_tour_cache()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  -- Only clean search cache (short-lived), NEVER product cache
  DELETE FROM public.tour_search_cache WHERE expires_at < now();
$$;

-- Make expires_at nullable on tour_product_cache (products never expire)
ALTER TABLE public.tour_product_cache ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.tour_product_cache ALTER COLUMN expires_at SET DEFAULT NULL;