CREATE OR REPLACE FUNCTION public.fix_tour_destinations(batch_size int DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count int := 0;
BEGIN
  WITH product_refs AS (
    SELECT 
      t.id,
      t.product_code,
      t.destination as old_dest,
      -- Extract primary destination ref from product_data JSONB
      (
        SELECT elem->>'ref'
        FROM jsonb_array_elements(t.product_data->'destinations') elem
        WHERE elem->>'primary' = 'true'
        LIMIT 1
      ) as primary_ref,
      -- Fallback: first destination ref
      (
        SELECT elem->>'ref'
        FROM jsonb_array_elements(t.product_data->'destinations') elem
        LIMIT 1
      ) as first_ref
    FROM tour_product_cache t
    WHERE t.product_data->'destinations' IS NOT NULL
      AND jsonb_array_length(t.product_data->'destinations') > 0
      AND t.is_active = true
    LIMIT batch_size
  ),
  resolved AS (
    SELECT 
      pr.id,
      pr.product_code,
      pr.old_dest,
      COALESCE(
        dm_primary.city_name,
        dm_first.city_name
      ) as new_dest
    FROM product_refs pr
    LEFT JOIN viator_destination_map dm_primary 
      ON dm_primary.dest_id::text = pr.primary_ref
    LEFT JOIN viator_destination_map dm_first 
      ON dm_first.dest_id::text = pr.first_ref
    WHERE COALESCE(dm_primary.city_name, dm_first.city_name) IS NOT NULL
      AND COALESCE(dm_primary.city_name, dm_first.city_name) != pr.old_dest
  )
  UPDATE tour_product_cache tc
  SET destination = r.new_dest
  FROM resolved r
  WHERE tc.id = r.id;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  RETURN jsonb_build_object('fixed', fixed_count);
END;
$$;