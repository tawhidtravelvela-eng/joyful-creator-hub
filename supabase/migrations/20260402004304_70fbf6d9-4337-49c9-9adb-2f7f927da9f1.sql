-- Add currency snapshot columns to bookings for frozen pricing
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booked_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS source_amount numeric,
  ADD COLUMN IF NOT EXISTS source_currency text,
  ADD COLUMN IF NOT EXISTS fx_rate_used numeric,
  ADD COLUMN IF NOT EXISTS fx_markup_used numeric;