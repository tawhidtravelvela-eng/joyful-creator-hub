
-- Nuclear but precise fix: For products where the assigned destination doesn't appear 
-- anywhere in the product title, short_description, or a reasonable set of keywords,
-- reset them to be re-resolved.
-- 
-- Since we can't easily parse JSON destination refs in SQL, and the map is now clean,
-- the safest approach is to reset ALL detail_fetched products that have destinations
-- from the heavily polluted cities. The sync engine will re-resolve them correctly.
UPDATE tour_product_cache 
SET detail_fetched = false
WHERE detail_fetched = true
AND destination IN ('Phuket', 'Bangkok', 'Kuala Lumpur', 'Dubai', 'Kolkata', 'Singapore', 'Miami')
AND NOT (
  -- Keep products where the title actually references the destination
  LOWER(title) LIKE '%' || LOWER(destination) || '%'
  OR LOWER(short_description) LIKE '%' || LOWER(destination) || '%'
);
