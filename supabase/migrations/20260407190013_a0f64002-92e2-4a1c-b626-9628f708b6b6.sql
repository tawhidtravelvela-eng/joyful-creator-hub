CREATE OR REPLACE FUNCTION public.search_hotels_catalogue(
  p_query text,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  tj_hotel_id bigint,
  unica_id text,
  name text,
  city_name text,
  country_name text,
  rating numeric,
  property_type text,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    h.tj_hotel_id,
    h.unica_id,
    h.name,
    h.city_name,
    h.country_name,
    h.rating,
    h.property_type,
    h.image_url
  FROM tripjack_hotels h
  WHERE h.is_deleted = false
    AND h.name ILIKE '%' || p_query || '%'
  ORDER BY
    CASE WHEN lower(h.name) LIKE lower(p_query) || '%' THEN 0 ELSE 1 END,
    h.rating DESC NULLS LAST
  LIMIT p_limit;
$$;