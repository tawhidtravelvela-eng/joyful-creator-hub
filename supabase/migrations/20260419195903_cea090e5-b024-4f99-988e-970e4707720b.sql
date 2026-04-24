-- Add allowed_currencies array to profiles for multi-currency B2B/corporate support
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_currencies text[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.allowed_currencies IS
  'Optional list of currencies a B2B/corporate agent may transact in. NULL = restricted to billing_currency only. The billing_currency is treated as the default/primary currency.';

-- Helper index for currency-scoped wallet queries
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_currency
  ON public.wallet_transactions (user_id, currency, status);
