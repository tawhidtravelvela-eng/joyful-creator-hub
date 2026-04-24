-- Step 1: Delete ALL contaminated products from tour_product_cache
-- These are products synced under wrong destination IDs
DELETE FROM tour_product_cache 
WHERE destination IN (
  SELECT s.destination_name 
  FROM tour_sync_state s
  LEFT JOIN viator_destination_map v ON v.dest_id = s.destination_id
  WHERE v.city_name IS NULL OR lower(v.city_name) != lower(s.destination_name)
);

-- Step 2: Delete ALL rows from tour_sync_state — will be re-initialized with correct IDs
DELETE FROM tour_sync_state;
