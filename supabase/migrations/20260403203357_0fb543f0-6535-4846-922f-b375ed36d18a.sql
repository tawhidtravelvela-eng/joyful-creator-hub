CREATE OR REPLACE FUNCTION public.fix_tour_destinations(batch_size int DEFAULT 2000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count int := 0;
  batch_fixed int := 0;
  total_fixed int := 0;
  iteration int := 0;
BEGIN
  LOOP
    iteration := iteration + 1;
    
    WITH to_fix AS (
      SELECT 
        t.id,
        COALESCE(
          (SELECT dm.city_name FROM viator_destination_map dm WHERE dm.dest_id::text = (
            SELECT elem->>'ref' FROM jsonb_array_elements(t.product_data->'destinations') elem WHERE elem->>'primary' = 'true' LIMIT 1
          ) LIMIT 1),
          (SELECT dm.city_name FROM viator_destination_map dm WHERE dm.dest_id::text = (
            SELECT elem->>'ref' FROM jsonb_array_elements(t.product_data->'destinations') elem LIMIT 1
          ) LIMIT 1)
        ) as resolved_dest
      FROM tour_product_cache t
      WHERE t.is_active = true
        AND t.product_data->'destinations' IS NOT NULL
        AND jsonb_array_length(COALESCE(t.product_data->'destinations', '[]'::jsonb)) > 0
      LIMIT batch_size
    )
    UPDATE tour_product_cache tc
    SET destination = tf.resolved_dest
    FROM to_fix tf
    WHERE tc.id = tf.id
      AND tf.resolved_dest IS NOT NULL
      AND tc.destination IS DISTINCT FROM tf.resolved_dest;
    
    GET DIAGNOSTICS batch_fixed = ROW_COUNT;
    total_fixed := total_fixed + batch_fixed;
    
    -- Stop when no more fixes or after 10 iterations
    EXIT WHEN batch_fixed = 0 OR iteration >= 10;
  END LOOP;
  
  RETURN jsonb_build_object('fixed', total_fixed, 'iterations', iteration);
END;
$$;