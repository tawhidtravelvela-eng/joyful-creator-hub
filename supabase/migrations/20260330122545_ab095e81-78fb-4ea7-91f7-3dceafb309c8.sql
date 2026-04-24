CREATE TABLE public.activity_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name text NOT NULL,
  city text NOT NULL,
  country text,
  currency text NOT NULL DEFAULT 'USD',
  price_usd numeric NOT NULL DEFAULT 0,
  price_local numeric,
  local_currency text,
  includes_notes text,
  source text DEFAULT 'ai_lookup',
  confidence text DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(activity_name, city, currency)
);

CREATE INDEX idx_activity_price_cache_expiry ON public.activity_price_cache (expires_at);

ALTER TABLE public.activity_price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.activity_price_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public read access" ON public.activity_price_cache
  FOR SELECT TO anon, authenticated USING (true);