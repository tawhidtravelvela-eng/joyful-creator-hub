-- Trigram index for fast ILIKE name searches (the primary use case)
CREATE INDEX IF NOT EXISTS hotels_catalogue_name_trgm_idx
  ON public.hotels_catalogue USING gin (name gin_trgm_ops);

-- City lookups
CREATE INDEX IF NOT EXISTS hotels_catalogue_city_idx
  ON public.hotels_catalogue (lower(city_name));

-- Canonical id lookups (cross-supplier identity)
CREATE INDEX IF NOT EXISTS hotels_catalogue_canonical_idx
  ON public.hotels_catalogue (canonical_id);

-- Update resolver to read from the materialised view
CREATE OR REPLACE FUNCTION public.resolve_hotel_by_name(p_query text, p_limit int DEFAULT 5)
RETURNS TABLE (
  supplier text,
  supplier_hotel_id text,
  canonical_id text,
  name text,
  city_name text,
  country_name text,
  rating numeric,
  image_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.supplier,
    h.supplier_hotel_id,
    h.canonical_id,
    h.name,
    h.city_name,
    h.country_name,
    h.rating,
    h.image_url
  FROM public.hotels_catalogue h
  WHERE h.name ILIKE '%' || p_query || '%'
  ORDER BY
    CASE WHEN lower(h.name) = lower(p_query) THEN 0
         WHEN lower(h.name) LIKE lower(p_query) || '%' THEN 1
         ELSE 2
    END,
    h.rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- Internal cron-callable refresh (no role check, for pg_cron)
CREATE OR REPLACE FUNCTION public.cron_refresh_hotels_catalogue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.hotels_catalogue;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_hotel_by_name(text, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cron_refresh_hotels_catalogue() TO service_role;