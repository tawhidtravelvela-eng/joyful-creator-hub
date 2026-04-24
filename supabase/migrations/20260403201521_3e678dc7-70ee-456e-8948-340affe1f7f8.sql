
CREATE OR REPLACE FUNCTION public.fix_tour_currency_from_schedule(batch_size int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count int := 0;
BEGIN
  WITH candidates AS (
    SELECT 
      t.id,
      (SELECT value->>'currency' 
       FROM jsonb_each(t.product_data->'_schedulePricing'->'optionPricing') 
       WHERE value->>'currency' IS NOT NULL 
       LIMIT 1) as real_currency,
      (SELECT MIN((value->>'fromPrice')::numeric) 
       FROM jsonb_each(t.product_data->'_schedulePricing'->'optionPricing') 
       WHERE (value->>'fromPrice')::numeric > 0) as real_price
    FROM tour_product_cache t
    WHERE t.currency = 'USD'
      AND t.product_data->'_schedulePricing'->'optionPricing' IS NOT NULL
      AND jsonb_typeof(t.product_data->'_schedulePricing'->'optionPricing') = 'object'
    LIMIT batch_size
  )
  UPDATE tour_product_cache tc
  SET currency = c.real_currency,
      price = c.real_price
  FROM candidates c
  WHERE tc.id = c.id
    AND c.real_currency IS NOT NULL
    AND c.real_currency != 'USD'
    AND c.real_price > 0;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  RETURN jsonb_build_object('fixed', fixed_count);
END;
$$;
