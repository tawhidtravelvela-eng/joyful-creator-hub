CREATE OR REPLACE FUNCTION public.fix_tour_destinations(batch_size int DEFAULT 2000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_fixed int := 0;
  batch_fixed int := 0;
  iteration int := 0;
  rec RECORD;
BEGIN
  -- Use a cursor-like approach: process products one at a time
  FOR rec IN 
    SELECT 
      t.id,
      t.destination as old_dest,
      COALESCE(
        dm_p.city_name,
        dm_f.city_name
      ) as new_dest
    FROM tour_product_cache t
    LEFT JOIN LATERAL (
      SELECT elem->>'ref' as ref
      FROM jsonb_array_elements(t.product_data->'destinations') elem
      WHERE elem->>'primary' = 'true'
      LIMIT 1
    ) prim ON true
    LEFT JOIN LATERAL (
      SELECT elem->>'ref' as ref
      FROM jsonb_array_elements(t.product_data->'destinations') elem
      LIMIT 1
    ) fst ON true
    LEFT JOIN viator_destination_map dm_p ON dm_p.dest_id::text = prim.ref
    LEFT JOIN viator_destination_map dm_f ON dm_f.dest_id::text = fst.ref
    WHERE t.is_active = true
      AND t.product_data->'destinations' IS NOT NULL
      AND jsonb_array_length(COALESCE(t.product_data->'destinations', '[]'::jsonb)) > 0
      AND COALESCE(dm_p.city_name, dm_f.city_name) IS NOT NULL
      AND t.destination IS DISTINCT FROM COALESCE(dm_p.city_name, dm_f.city_name)
    LIMIT batch_size
  LOOP
    UPDATE tour_product_cache SET destination = rec.new_dest WHERE id = rec.id;
    total_fixed := total_fixed + 1;
  END LOOP;
  
  RETURN jsonb_build_object('fixed', total_fixed);
END;
$$;