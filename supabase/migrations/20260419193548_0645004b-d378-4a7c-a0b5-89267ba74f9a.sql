
-- Repair 2 wallet transactions tagged with wrong currency.
-- The South Point Travel agent (BDT-billing) deposited 63,312 BDT via bank transfer
-- but it was stored as USD because the deposit edge function defaulted to USD.
-- The whitelabel setup fee debit was the USD default (500) charged from a BDT wallet.

-- Fix 1: Bank deposit was made in BDT (agent's billing currency), tag it correctly
UPDATE public.wallet_transactions
SET currency = 'BDT'
WHERE id = '2f36e2e3-0ca6-44d7-9a14-a4a4ed1acac2'
  AND currency = 'USD';

-- Fix 2: Reverse the incorrect 500 USD whitelabel debit so the agent's BDT wallet is whole again.
-- They will be re-charged in BDT once admin sets a BDT price for the whitelabel package.
UPDATE public.wallet_transactions
SET status = 'reversed',
    description = description || ' | REVERSED: incorrect currency (USD charged on BDT wallet) — please re-purchase'
WHERE id = 'fff44c37-b5b2-42b8-8100-4b00d539ef00'
  AND status = 'completed';

-- Also remove the matching whitelabel_purchases row so the agent can re-purchase
DELETE FROM public.whitelabel_purchases
WHERE user_id = 'b0118195-43cd-4906-8c51-370b269edc5a'
  AND product_type = 'whitelabel'
  AND created_at < '2026-04-15 17:00:00+00';
