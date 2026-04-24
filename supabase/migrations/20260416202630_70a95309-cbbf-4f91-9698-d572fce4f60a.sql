-- Add base currency to affiliates (the canonical currency for their wallet/earnings totals)
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'USD';

-- Backfill existing rows defensively
UPDATE public.affiliates SET base_currency = 'USD' WHERE base_currency IS NULL;