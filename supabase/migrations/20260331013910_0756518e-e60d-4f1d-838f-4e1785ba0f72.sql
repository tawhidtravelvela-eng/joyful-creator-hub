-- Fix prices using schedule pricing stored in product_data
-- Extract the lowest fromPrice from _schedulePricing.optionPricing and its currency
WITH schedule_prices AS (
  SELECT 
    product_code,
    (SELECT MIN((v->>'fromPrice')::numeric) 
     FROM jsonb_each(product_data->'_schedulePricing'->'optionPricing') AS kv(k, v)
     WHERE (v->>'fromPrice')::numeric > 0
    ) AS sched_price,
    (SELECT v->>'currency'
     FROM jsonb_each(product_data->'_schedulePricing'->'optionPricing') AS kv(k, v)
     WHERE (v->>'fromPrice')::numeric > 0
     ORDER BY (v->>'fromPrice')::numeric ASC
     LIMIT 1
    ) AS sched_currency
  FROM tour_product_cache
  WHERE detail_fetched = true
    AND product_data->'_schedulePricing'->'optionPricing' IS NOT NULL
    AND product_data->'_schedulePricing'->'optionPricing' != 'null'::jsonb
    AND product_data->'_schedulePricing'->'optionPricing' != '{}'::jsonb
)
UPDATE tour_product_cache t
SET price = sp.sched_price,
    currency = COALESCE(sp.sched_currency, 'USD')
FROM schedule_prices sp
WHERE t.product_code = sp.product_code
  AND sp.sched_price IS NOT NULL
  AND sp.sched_price > 0;