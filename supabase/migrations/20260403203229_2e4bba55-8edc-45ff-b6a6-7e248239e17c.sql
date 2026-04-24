CREATE OR REPLACE FUNCTION public.fix_tour_destinations(batch_size int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count int := 0;
BEGIN
  -- Direct update: join product_data destinations with viator_destination_map
  -- and update where the resolved city differs from current destination
  UPDATE tour_product_cache tc
  SET destination = COALESCE(dm_primary.city_name, dm_first.city_name)
  FROM (
    SELECT 
      t.id,
      -- Extract primary ref
      (SELECT elem->>'ref' FROM jsonb_array_elements(t.product_data->'destinations') elem WHERE elem->>'primary' = 'true' LIMIT 1) as primary_ref,
      -- Fallback: first ref
      (SELECT elem->>'ref' FROM jsonb_array_elements(t.product_data->'destinations') elem LIMIT 1) as first_ref
    FROM tour_product_cache t
    WHERE t.product_data->'destinations' IS NOT NULL
      AND jsonb_array_length(COALESCE(t.product_data->'destinations', '[]'::jsonb)) > 0
      AND t.is_active = true
  ) refs
  LEFT JOIN viator_destination_map dm_primary ON dm_primary.dest_id::text = refs.primary_ref
  LEFT JOIN viator_destination_map dm_first ON dm_first.dest_id::text = refs.first_ref
  WHERE tc.id = refs.id
    AND COALESCE(dm_primary.city_name, dm_first.city_name) IS NOT NULL
    AND tc.destination IS DISTINCT FROM COALESCE(dm_primary.city_name, dm_first.city_name);
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  RETURN jsonb_build_object('fixed', fixed_count);
END;
$$;