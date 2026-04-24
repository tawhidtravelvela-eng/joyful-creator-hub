
-- Affiliates table
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_code text NOT NULL UNIQUE,
  commission_rate numeric NOT NULL DEFAULT 5.0,
  status text NOT NULL DEFAULT 'pending',
  company_name text DEFAULT '',
  website_url text DEFAULT '',
  payment_method text DEFAULT 'wallet',
  total_earnings numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  wallet_balance numeric NOT NULL DEFAULT 0,
  min_payout numeric NOT NULL DEFAULT 50,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Affiliate clicks
CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  page_url text DEFAULT '',
  referrer_url text DEFAULT '',
  ip_hash text DEFAULT '',
  user_agent text DEFAULT '',
  country text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Affiliate conversions (bookings made through affiliate links)
CREATE TABLE public.affiliate_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  click_id uuid REFERENCES public.affiliate_clicks(id) ON DELETE SET NULL,
  booking_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Affiliate payouts
CREATE TABLE public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  payment_method text DEFAULT 'wallet',
  payment_reference text DEFAULT '',
  admin_notes text DEFAULT '',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Affiliate API keys for widget/API access
CREATE TABLE public.affiliate_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE,
  name text DEFAULT 'Default',
  is_active boolean DEFAULT true,
  allowed_domains text[] DEFAULT '{}',
  rate_limit_per_minute int DEFAULT 60,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_api_keys ENABLE ROW LEVEL SECURITY;

-- Affiliates policies
CREATE POLICY "Users can view own affiliate" ON public.affiliates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own affiliate" ON public.affiliates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin manage affiliates" ON public.affiliates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Clicks: service inserts, affiliates can read own
CREATE POLICY "Service manage clicks" ON public.affiliate_clicks FOR ALL TO service_role USING (true);
CREATE POLICY "Anon insert clicks" ON public.affiliate_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Affiliates read own clicks" ON public.affiliate_clicks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "Admin read clicks" ON public.affiliate_clicks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Conversions
CREATE POLICY "Affiliates read own conversions" ON public.affiliate_conversions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "Admin manage conversions" ON public.affiliate_conversions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manage conversions" ON public.affiliate_conversions FOR ALL TO service_role USING (true);

-- Payouts
CREATE POLICY "Affiliates read own payouts" ON public.affiliate_payouts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "Affiliates request payout" ON public.affiliate_payouts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "Admin manage payouts" ON public.affiliate_payouts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- API keys
CREATE POLICY "Affiliates manage own keys" ON public.affiliate_api_keys FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "Admin manage api keys" ON public.affiliate_api_keys FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Helper function to generate affiliate codes
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'AFF' || upper(substr(md5(random()::text), 1, 8));
END;
$$;
