-- Create market_currency_rules table
CREATE TABLE public.market_currency_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  country_name text NOT NULL DEFAULT '',
  default_currency text NOT NULL DEFAULT 'USD',
  allowed_currencies text[] NOT NULL DEFAULT ARRAY['USD'],
  force_single_currency boolean NOT NULL DEFAULT false,
  currency_picker_mode text NOT NULL DEFAULT 'auto'
    CHECK (currency_picker_mode IN ('auto', 'show', 'hide', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_currency_rules ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage market currency rules"
  ON public.market_currency_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public read access (needed for anonymous geo-based currency resolution)
CREATE POLICY "Anyone can read market currency rules"
  ON public.market_currency_rules
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_market_currency_rules_updated_at
  BEFORE UPDATE ON public.market_currency_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial market rules
INSERT INTO public.market_currency_rules (country_code, country_name, default_currency, allowed_currencies, force_single_currency, currency_picker_mode) VALUES
  ('BD', 'Bangladesh', 'BDT', ARRAY['BDT'], true, 'auto'),
  ('IN', 'India', 'INR', ARRAY['INR', 'USD'], false, 'auto'),
  ('MY', 'Malaysia', 'MYR', ARRAY['MYR', 'USD'], false, 'auto'),
  ('SG', 'Singapore', 'SGD', ARRAY['SGD', 'USD'], false, 'auto'),
  ('AE', 'UAE', 'AED', ARRAY['AED', 'USD'], false, 'auto'),
  ('US', 'United States', 'USD', ARRAY['USD'], true, 'auto'),
  ('GB', 'United Kingdom', 'GBP', ARRAY['GBP', 'EUR', 'USD'], false, 'auto'),
  ('SA', 'Saudi Arabia', 'SAR', ARRAY['SAR', 'USD'], false, 'auto'),
  ('PK', 'Pakistan', 'PKR', ARRAY['PKR', 'USD'], false, 'auto'),
  ('LK', 'Sri Lanka', 'LKR', ARRAY['LKR', 'USD'], false, 'auto'),
  ('JP', 'Japan', 'JPY', ARRAY['JPY', 'USD'], false, 'auto'),
  ('KR', 'South Korea', 'KRW', ARRAY['KRW', 'USD'], false, 'auto'),
  ('TH', 'Thailand', 'THB', ARRAY['THB', 'USD'], false, 'auto'),
  ('AU', 'Australia', 'AUD', ARRAY['AUD', 'USD'], false, 'auto')
ON CONFLICT (country_code) DO NOTHING;