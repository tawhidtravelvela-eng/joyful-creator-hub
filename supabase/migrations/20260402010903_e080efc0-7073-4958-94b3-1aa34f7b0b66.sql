
-- Keep only the dest_id that matches tour_sync_state for each city
-- Step 1: Delete entries that have a sibling matching tour_sync_state
DELETE FROM viator_destination_map
WHERE dest_id IN (
  SELECT vm.dest_id
  FROM viator_destination_map vm
  WHERE vm.city_name IN (
    SELECT city_name FROM viator_destination_map GROUP BY city_name HAVING count(*) > 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM tour_sync_state ts 
    WHERE ts.destination_id = vm.dest_id
  )
  AND EXISTS (
    SELECT 1 FROM viator_destination_map vm2
    JOIN tour_sync_state ts2 ON ts2.destination_id = vm2.dest_id
    WHERE vm2.city_name = vm.city_name
  )
);

-- Step 2: For remaining duplicates (no tour_sync_state match at all), keep lowest dest_id
DELETE FROM viator_destination_map
WHERE dest_id IN (
  SELECT vm.dest_id
  FROM viator_destination_map vm
  WHERE vm.city_name IN (
    SELECT city_name FROM viator_destination_map GROUP BY city_name HAVING count(*) > 1
  )
  AND vm.dest_id::bigint > (
    SELECT MIN(v2.dest_id::bigint) FROM viator_destination_map v2 WHERE v2.city_name = vm.city_name
  )
);
