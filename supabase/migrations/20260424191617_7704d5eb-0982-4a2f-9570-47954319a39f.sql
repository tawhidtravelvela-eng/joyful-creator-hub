
-- Supplier-agnostic hotel name resolver. Used by unified-hotel-search to pivot
-- a "hotel name as city" query (e.g. "Landmark Pokhara") into the real city +
-- supplier hotel id, regardless of which supplier owns the record.
--
-- This is the lightweight version of Option B (unified catalogue): instead of
-- materialising a unified table, we expose a single RPC that UNIONs across
-- every supplier source. New suppliers populate `hotel_supplier_mappings` and
-- become resolvable automatically — no resolver code changes needed.

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
SET statement_timeout = '10s'
AS $$
BEGIN
  RETURN QUERY
  WITH unified AS (
    -- Tripjack catalogue (primary, ~2M rows, has trigram index on name)
    SELECT
      'tripjack'::text                                        AS supplier,
      tj_hotel_id::text                                       AS supplier_hotel_id,
      COALESCE(unica_id::text, tj_hotel_id::text)             AS canonical_id,
      h.name                                                  AS name,
      h.city_name                                             AS city_name,
      h.country_name                                          AS country_name,
      h.rating::numeric                                       AS rating,
      h.image_url                                             AS image_url
    FROM public.tripjack_hotels h
    WHERE h.is_deleted = false
      AND h.name ILIKE '%' || p_query || '%'

    UNION ALL

    -- Generic supplier mappings (Hotelston + any future supplier)
    SELECT
      m.supplier,
      m.supplier_hotel_id,
      COALESCE(m.internal_hotel_id, m.supplier_hotel_id)      AS canonical_id,
      m.hotel_name                                            AS name,
      m.city                                                  AS city_name,
      m.country                                               AS country_name,
      NULL::numeric                                           AS rating,
      NULL::text                                              AS image_url
    FROM public.hotel_supplier_mappings m
    WHERE m.hotel_name ILIKE '%' || p_query || '%'
  )
  SELECT u.supplier, u.supplier_hotel_id, u.canonical_id, u.name,
         u.city_name, u.country_name, u.rating, u.image_url
  FROM unified u
  ORDER BY
    CASE WHEN lower(u.name) = lower(p_query) THEN 0
         WHEN lower(u.name) LIKE lower(p_query) || '%' THEN 1
         ELSE 2
    END,
    u.rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$;
