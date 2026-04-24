
-- Deactivate mislabeled tours: products stored with destination 'Singapore' 
-- but whose titles clearly indicate non-Singapore locations (Wynwood, Miami, Everglades, etc.)
UPDATE tour_product_cache 
SET is_active = false, destination = '' 
WHERE destination ILIKE '%Singapore%' 
  AND is_active = true
  AND (
    title ILIKE '%wynwood%' OR title ILIKE '%miami%' OR title ILIKE '%everglades%' 
    OR title ILIKE '%key west%' OR title ILIKE '%fort lauderdale%' 
    OR title ILIKE '%naples%' OR title ILIKE '%biscayne%'
    OR title ILIKE '%honolulu%' OR title ILIKE '%waikiki%' OR title ILIKE '%pearl harbor%'
    OR title ILIKE '%oahu%' OR title ILIKE '%maui%' OR title ILIKE '%hawaii%'
    OR title ILIKE '%orlando%' OR title ILIKE '%disney%'
  );

-- Also deactivate products with destination 'Singapore' that have empty or null titles
UPDATE tour_product_cache 
SET is_active = false 
WHERE destination ILIKE '%Singapore%' 
  AND is_active = true
  AND (title IS NULL OR title = '');

-- Clear stale search caches for Singapore so fresh results are served
DELETE FROM tour_search_cache WHERE cache_key ILIKE '%singapore%';
