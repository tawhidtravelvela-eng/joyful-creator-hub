-- 1. Search signals (learning telemetry)
CREATE TABLE IF NOT EXISTS public.flight_search_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  from_code text NOT NULL,
  to_code text NOT NULL,
  depart_date date,
  return_date date,
  adults int DEFAULT 1,
  children int DEFAULT 0,
  infants int DEFAULT 0,
  cabin_class text,
  trip_type text,
  results_count int DEFAULT 0,
  lowest_price numeric,
  currency text DEFAULT 'USD',
  selected_flight_id text,
  selected_price numeric,
  search_country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fss_route ON public.flight_search_signals(from_code, to_code, depart_date);
CREATE INDEX IF NOT EXISTS idx_fss_created ON public.flight_search_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fss_user ON public.flight_search_signals(user_id);
ALTER TABLE public.flight_search_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert search signals" ON public.flight_search_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read signals" ON public.flight_search_signals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 2. Aggregated price trends per route
CREATE TABLE IF NOT EXISTS public.flight_price_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_code text NOT NULL,
  to_code text NOT NULL,
  depart_date date NOT NULL,
  sample_date date NOT NULL DEFAULT CURRENT_DATE,
  min_price numeric NOT NULL,
  avg_price numeric NOT NULL,
  max_price numeric,
  sample_count int DEFAULT 1,
  currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_code, to_code, depart_date, sample_date, currency)
);
CREATE INDEX IF NOT EXISTS idx_fpt_route_depart ON public.flight_price_trends(from_code, to_code, depart_date, sample_date DESC);
ALTER TABLE public.flight_price_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read price trends" ON public.flight_price_trends FOR SELECT USING (true);

-- 3. Cached AI insights
CREATE TABLE IF NOT EXISTS public.flight_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  from_code text NOT NULL,
  to_code text NOT NULL,
  depart_date date,
  return_date date,
  insights jsonb NOT NULL,
  source text DEFAULT 'ai',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fic_key ON public.flight_insights_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_fic_expires ON public.flight_insights_cache(expires_at);
ALTER TABLE public.flight_insights_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read insights cache" ON public.flight_insights_cache FOR SELECT USING (true);