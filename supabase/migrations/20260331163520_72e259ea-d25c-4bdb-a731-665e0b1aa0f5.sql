
-- Fix all destination names in tour_product_cache using viator_destination_map
UPDATE tour_product_cache pc
SET destination = vdm.city_name
FROM viator_destination_map vdm
WHERE vdm.dest_id = pc.product_data->'destinations'->0->>'ref'
  AND pc.destination != vdm.city_name;

-- Also fix products where dest_id is not in first position but in any position
-- by checking all destination refs
UPDATE tour_product_cache pc
SET destination = vdm.city_name
FROM viator_destination_map vdm
WHERE pc.destination = '' OR pc.destination ILIKE '%tours experiences%'
  OR pc.destination ILIKE '%Batu Ferringhi%' OR pc.destination ILIKE '%KLCC%'
  OR pc.destination ILIKE '%self-managed%' OR pc.destination ILIKE '%ArtScience%'
  OR pc.destination ILIKE '%taj mahal%' OR pc.destination ILIKE '%zoo negara%'
  OR pc.destination ILIKE '%Sail The DREAM%' OR pc.destination ILIKE '%Explore Sentosa%'
  OR pc.destination ILIKE '%Marina Bay%' OR pc.destination ILIKE '%Gardens by the Bay%'
  OR pc.destination ILIKE '%Batu Caves%' OR pc.destination ILIKE '%Genting%'
  OR pc.destination ILIKE '%Cable Car%' OR pc.destination ILIKE '%Artscience%'
AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(pc.product_data->'destinations') d
  WHERE vdm.dest_id = d->>'ref'
);

-- Clear stale search cache
DELETE FROM tour_search_cache;
