
-- Bank accounts table for offline wallet topup
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  branch text DEFAULT '',
  swift_code text DEFAULT '',
  routing_number text DEFAULT '',
  currency text NOT NULL DEFAULT 'USD',
  country text DEFAULT '',
  logo_url text DEFAULT '',
  instructions text DEFAULT '',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Public can read active bank accounts
CREATE POLICY "Public read active bank_accounts"
  ON public.bank_accounts FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admin manage bank_accounts"
  ON public.bank_accounts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
