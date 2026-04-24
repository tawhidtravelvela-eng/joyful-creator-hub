
-- Fix tour_sync_state: destination 662 is Miami, not Singapore
UPDATE tour_sync_state 
SET destination_name = 'Miami'
WHERE destination_id = '662';

-- Create proper Singapore entry (Viator ID 60449)
INSERT INTO tour_sync_state (destination_id, destination_name, status, priority, search_hit_count)
VALUES ('60449', 'Singapore', 'pending', 200, 5)
ON CONFLICT (destination_id) DO NOTHING;

-- Fix all products that were synced under destination 662 but labeled as Singapore
-- These are actually Miami products
UPDATE tour_product_cache 
SET destination = 'Miami', is_active = true
WHERE product_data->'destinations'->0->>'ref' = '662'
  AND (destination ILIKE '%singapore%' OR destination = '');

-- Also fix products that have destination = 'Singapore tours experiences' 
-- which came from freetext search but were actually Miami products via dest 662
UPDATE tour_product_cache
SET destination = 'Miami', is_active = true
WHERE destination ILIKE '%singapore%'
  AND product_data->'destinations'->0->>'ref' = '662';

-- Clear all Singapore-related search caches to force fresh results
DELETE FROM tour_search_cache WHERE cache_key ILIKE '%singapore%';
