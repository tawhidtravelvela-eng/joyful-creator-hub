-- Delete all existing stale city map entries and rebuild from tripjack_hotels using correct tj_hotel_id
DELETE FROM tripjack_city_hotel_map;

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