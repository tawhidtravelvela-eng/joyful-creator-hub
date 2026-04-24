-- Re-backfill wallet_transactions.category with correct precedence:
-- deposit/topup keywords must be checked BEFORE the generic 'transfer' pattern,
-- otherwise "Wallet deposit via Bank Transfer" gets mis-categorised as Transfer.
UPDATE public.wallet_transactions
SET category = CASE
  WHEN reference IN ('whitelabel_purchase','whitelabel_commission','whitelabel_reversal') THEN 'whitelabel'
  WHEN reference IN ('api_access_purchase','api_access_commission','api_access_reversal') THEN 'api'
  -- Deposits / top-ups FIRST so phrases like "deposit via Bank Transfer" aren't caught by 'transfer'
  WHEN reference ILIKE 'deposit%' OR reference ILIKE 'topup%'
       OR description ILIKE '%top%up%' OR description ILIKE '%deposit%'
       OR description ILIKE '%wallet deposit%' THEN 'topup'
  WHEN reference ILIKE 'flight%' OR description ILIKE '%flight%' OR description ILIKE '%PNR%' THEN 'flight'
  WHEN reference ILIKE 'hotel%' OR description ILIKE '%hotel%' THEN 'hotel'
  WHEN reference ILIKE 'tour%' OR description ILIKE '%tour%' OR description ILIKE '%activity%' THEN 'tour'
  -- Only AFTER deposit-detection do we treat 'transfer' as a ground-transport category
  WHEN reference ILIKE 'transfer%' OR description ILIKE '%airport transfer%'
       OR description ILIKE '%transfer booking%' THEN 'transfer'
  WHEN reference ILIKE 'addon%' OR description ILIKE '%add-on%' OR description ILIKE '%addon%' THEN 'addon'
  WHEN reference ILIKE 'commission%' OR description ILIKE '%commission%' THEN 'commission'
  WHEN reference ILIKE 'refund%' OR description ILIKE '%refund%' OR description ILIKE '%reversed%' OR description ILIKE '%reversal%' THEN 'refund'
  WHEN type = 'credit' THEN 'topup'
  ELSE 'other'
END;