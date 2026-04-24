
-- Update the function to drop the "tv-" prefix
CREATE OR REPLACE FUNCTION public.generate_vela_id(p_product_code TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT substring(md5(p_product_code) from 1 for 7);
$$;

-- Backfill all existing rows with the new shorter format
UPDATE public.tour_product_cache 
SET vela_id = substring(md5(product_code) from 1 for 7);
