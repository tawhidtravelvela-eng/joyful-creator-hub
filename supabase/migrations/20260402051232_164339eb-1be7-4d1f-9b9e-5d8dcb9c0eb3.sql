
-- Add vela_id column: a short deterministic internal identifier for stable URLs
ALTER TABLE public.tour_product_cache 
ADD COLUMN IF NOT EXISTS vela_id TEXT;

-- Create unique index on vela_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_product_cache_vela_id 
ON public.tour_product_cache(vela_id) WHERE vela_id IS NOT NULL;

-- Function to generate a short vela_id from product_code
-- Format: "tv-{numeric_hash}" e.g. "tv-8a3f2c" (6 hex chars from md5 of product_code)
CREATE OR REPLACE FUNCTION public.generate_vela_id(p_product_code TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 'tv-' || substring(md5(p_product_code) from 1 for 7);
$$;

-- Backfill existing rows
UPDATE public.tour_product_cache 
SET vela_id = public.generate_vela_id(product_code)
WHERE vela_id IS NULL;

-- Auto-set vela_id on insert/update via trigger
CREATE OR REPLACE FUNCTION public.set_vela_id_on_tour()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.vela_id IS NULL AND NEW.product_code IS NOT NULL THEN
    NEW.vela_id := public.generate_vela_id(NEW.product_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_vela_id ON public.tour_product_cache;
CREATE TRIGGER trg_set_vela_id
BEFORE INSERT OR UPDATE ON public.tour_product_cache
FOR EACH ROW
EXECUTE FUNCTION public.set_vela_id_on_tour();
