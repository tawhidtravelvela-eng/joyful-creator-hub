
-- Auto-learn: dest_id 50882 is Penang, Malaysia  
INSERT INTO public.viator_destination_map (dest_id, city_name, country, dest_type, auto_learned)
VALUES ('50882', 'Penang', 'Malaysia', 'CITY', true)
ON CONFLICT (dest_id) DO NOTHING;

-- Fix the 38 products with empty destination that have dest_ref 50882
UPDATE public.tour_product_cache
SET destination = 'Penang'
WHERE is_active = true
  AND (destination = '' OR destination IS NULL)
  AND product_data->'destinations'->0->>'ref' = '50882';
