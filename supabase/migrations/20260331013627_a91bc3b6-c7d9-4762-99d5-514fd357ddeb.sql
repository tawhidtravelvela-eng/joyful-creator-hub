-- Fix incorrectly stored BDT prices: convert back to USD
-- Rate used was approximately 110.5 * 1.02 markup = 112.71
-- Reverse: USD = BDT / 112.71
UPDATE public.tour_product_cache 
SET price = ROUND(price / 112.71), 
    currency = 'USD'
WHERE currency = 'BDT' AND price > 0;