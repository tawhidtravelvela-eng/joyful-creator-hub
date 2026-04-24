-- 1. Add the three new columns
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS booking_id uuid,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid;

-- 2. Helpful indexes for filtering / joining
CREATE INDEX IF NOT EXISTS idx_wallet_tx_category ON public.wallet_transactions (category);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_actor ON public.wallet_transactions (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_booking ON public.wallet_transactions (booking_id);

-- 3. Backfill category from existing reference / description for old rows
UPDATE public.wallet_transactions
SET category = CASE
  WHEN reference IN ('whitelabel_purchase','whitelabel_commission','whitelabel_reversal') THEN 'whitelabel'
  WHEN reference IN ('api_access_purchase','api_access_commission','api_access_reversal') THEN 'api'
  WHEN reference ILIKE 'flight%' OR description ILIKE '%flight%' OR description ILIKE '%PNR%' THEN 'flight'
  WHEN reference ILIKE 'hotel%' OR description ILIKE '%hotel%' THEN 'hotel'
  WHEN reference ILIKE 'tour%' OR description ILIKE '%tour%' OR description ILIKE '%activity%' THEN 'tour'
  WHEN reference ILIKE 'transfer%' OR description ILIKE '%transfer%' THEN 'transfer'
  WHEN reference ILIKE 'addon%' OR description ILIKE '%add-on%' OR description ILIKE '%addon%' THEN 'addon'
  WHEN reference ILIKE 'commission%' OR description ILIKE '%commission%' THEN 'commission'
  WHEN reference ILIKE 'refund%' OR description ILIKE '%refund%' OR description ILIKE '%reversed%' OR description ILIKE '%reversal%' THEN 'refund'
  WHEN reference ILIKE 'deposit%' OR reference ILIKE 'topup%' OR description ILIKE '%top%up%' OR description ILIKE '%deposit%' THEN 'topup'
  WHEN type = 'credit' THEN 'topup'
  ELSE 'other'
END
WHERE category IS NULL;

-- 4. Backfill actor_user_id = user_id for old rows (assume self-initiated when unknown)
UPDATE public.wallet_transactions
SET actor_user_id = user_id
WHERE actor_user_id IS NULL;