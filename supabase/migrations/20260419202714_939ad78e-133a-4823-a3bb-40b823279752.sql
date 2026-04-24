-- Backfill the missing whitelabel purchase record for the user who was already debited 63,312 BDT
-- but whose purchase row failed to insert (silent error from non-existent 'currency' column).
INSERT INTO public.whitelabel_purchases (
  user_id, product_type, base_price, final_price,
  discount_percent, discount_amount,
  agent_commission_percent, agent_commission_amount,
  status, created_at
)
SELECT
  'b0118195-43cd-4906-8c51-370b269edc5a'::uuid,
  'whitelabel',
  63312, 63312, 0, 0, 0, 0,
  'completed',
  '2026-04-19 19:56:20.974242+00'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM public.whitelabel_purchases
  WHERE user_id = 'b0118195-43cd-4906-8c51-370b269edc5a'::uuid
    AND product_type = 'whitelabel'
    AND status = 'completed'
);