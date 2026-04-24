
-- Step 1: Delete all polluted viator_destination_map entries
-- Keep only entries with a non-empty country (the authoritative ones)
-- For cities that have NO entry with country, keep the oldest one
DELETE FROM viator_destination_map
WHERE dest_id IN (
  SELECT vm.dest_id
  FROM viator_destination_map vm
  WHERE vm.city_name IN (
    SELECT city_name FROM viator_destination_map GROUP BY city_name HAVING count(*) > 1
  )
  AND (vm.country IS NULL OR vm.country = '')
  AND EXISTS (
    SELECT 1 FROM viator_destination_map v2
    WHERE v2.city_name = vm.city_name
    AND v2.dest_id != vm.dest_id
    AND v2.country IS NOT NULL AND v2.country != ''
  )
);

-- Step 2: For cities that STILL have duplicates (none had a country), keep the oldest
DELETE FROM viator_destination_map
WHERE dest_id IN (
  SELECT vm.dest_id
  FROM viator_destination_map vm
  WHERE vm.city_name IN (
    SELECT city_name FROM viator_destination_map GROUP BY city_name HAVING count(*) > 1
  )
  AND vm.created_at > (
    SELECT MIN(v2.created_at) FROM viator_destination_map v2 WHERE v2.city_name = vm.city_name
  )
);

-- Step 3: Add a unique constraint on city_name to prevent future pollution
-- (dest_id already has a unique constraint, but city_name doesn't)
-- NOTE: We can't add UNIQUE on city_name because different dest_ids CAN map to different cities
-- Instead, we'll rely on the code fix to only save PRIMARY destination refs
