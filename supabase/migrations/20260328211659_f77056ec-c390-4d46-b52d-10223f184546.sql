CREATE OR REPLACE FUNCTION public.backfill_tripjack_city_map()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cities_count int;
  hotels_count int;
BEGIN
  -- Clear existing map using TRUNCATE (faster and no WHERE clause needed)
  TRUNCATE tripjack_city_hotel_map;

  -- Rebuild from tripjack_hotels in a single SQL operation
  INSERT INTO tripjack_city_hotel_map (city_name, country_name, hotel_ids, hotel_count, updated_at)
  SELECT
    trim(city_name) as city_name,
    coalesce(country_name, '') as country_name,
    array_agg(tj_hotel_id::text) as hotel_ids,
    count(*) as hotel_count,
    now() as updated_at
  FROM tripjack_hotels
  WHERE is_deleted = false AND trim(city_name) != ''
  GROUP BY trim(city_name), coalesce(country_name, '')
  ON CONFLICT (city_name, country_name)
  DO UPDATE SET
    hotel_ids = EXCLUDED.hotel_ids,
    hotel_count = EXCLUDED.hotel_count,
    updated_at = now();

  SELECT count(*) INTO cities_count FROM tripjack_city_hotel_map;
  SELECT count(*) INTO hotels_count FROM tripjack_hotels WHERE is_deleted = false;

  RETURN jsonb_build_object('cities', cities_count, 'hotels', hotels_count);
END;
$$