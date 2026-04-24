
-- Add slug column
ALTER TABLE public.tour_product_cache ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs, always append product_code to guarantee uniqueness
UPDATE public.tour_product_cache
SET slug = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        trim(title) || '-' || trim(destination),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
) || '-' || lower(regexp_replace(product_code, '[^a-zA-Z0-9]', '', 'g'))
WHERE title IS NOT NULL;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_product_cache_slug ON public.tour_product_cache (slug) WHERE slug IS NOT NULL;

-- Index for destination lookup
CREATE INDEX IF NOT EXISTS idx_tour_product_cache_dest_lower ON public.tour_product_cache (lower(destination));
