
-- Clear ALL search cache (may contain products with wrong destinations)
DELETE FROM tour_search_cache;

-- Reset products that have clearly wrong destinations
-- A product's destination is wrong if no part of the product title or short_description 
-- contains ANY keyword from its assigned destination
-- Instead of complex text matching, reset ALL detail_fetched products to re-resolve
-- This is safe because the sync engine will re-resolve using the cleaned map
UPDATE tour_product_cache 
SET detail_fetched = false
WHERE detail_fetched = true
AND destination IN (
  SELECT DISTINCT tpc.destination
  FROM tour_product_cache tpc
  WHERE tpc.detail_fetched = true
  AND NOT EXISTS (
    SELECT 1 FROM tour_sync_state tss
    WHERE LOWER(tss.destination_name) = LOWER(tpc.destination)
    AND tss.status = 'completed'
  )
);

-- For destinations that ARE in tour_sync_state, check for cross-contamination
-- Products from non-matching cities got assigned to popular destinations like Phuket
-- Reset these so the sync engine re-resolves them
-- Identify products where destination and product_data don't match
-- This catches NYC products labeled as Phuket, etc.
UPDATE tour_product_cache 
SET detail_fetched = false
WHERE detail_fetched = true
AND destination = 'Phuket'
AND (
  title ILIKE '%new york%' OR title ILIKE '%central park%' OR title ILIKE '%manhattan%'
  OR title ILIKE '%brooklyn%' OR title ILIKE '%empire state%' OR title ILIKE '%statue of liberty%'
  OR title ILIKE '%ellis island%' OR title ILIKE '%times square%' OR title ILIKE '%broadway%'
  OR title ILIKE '%harlem%' OR title ILIKE '%bronx%' OR title ILIKE '%queens%'
  OR title ILIKE '%9/11%' OR title ILIKE '%ground zero%' OR title ILIKE '%one world%'
  OR title ILIKE '%coney%' OR title ILIKE '%soho%' OR title ILIKE '%chinatown%'
  OR title ILIKE '%rockefeller%' OR title ILIKE '%hop-on%'
);
