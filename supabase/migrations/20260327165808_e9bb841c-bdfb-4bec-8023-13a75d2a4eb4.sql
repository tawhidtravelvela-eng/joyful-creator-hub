
-- Hotel per-night price estimates, seeded initially and self-updated from real searches
CREATE TABLE public.hotel_city_estimates (
  city text PRIMARY KEY,
  country text,
  avg_per_night_usd numeric NOT NULL DEFAULT 0,
  min_per_night_usd numeric NOT NULL DEFAULT 0,
  sample_count int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'seed',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hotel_city_estimates ENABLE ROW LEVEL SECURITY;

-- Public read, service-role write
CREATE POLICY "Anyone can read hotel estimates"
  ON public.hotel_city_estimates FOR SELECT
  TO anon, authenticated
  USING (true);

-- Seed with realistic budget-to-mid hotel per-night USD estimates
INSERT INTO public.hotel_city_estimates (city, country, avg_per_night_usd, min_per_night_usd, source) VALUES
  ('Bangkok', 'Thailand', 32, 18, 'seed'),
  ('Kolkata', 'India', 22, 12, 'seed'),
  ('Kathmandu', 'Nepal', 18, 10, 'seed'),
  ('Kuala Lumpur', 'Malaysia', 38, 22, 'seed'),
  ('Bali', 'Indonesia', 28, 15, 'seed'),
  ('Dubai', 'UAE', 65, 40, 'seed'),
  ('Singapore', 'Singapore', 85, 55, 'seed'),
  ('Colombo', 'Sri Lanka', 24, 14, 'seed'),
  ('Guangzhou', 'China', 40, 25, 'seed'),
  ('Phuket', 'Thailand', 30, 18, 'seed'),
  ('Delhi', 'India', 25, 14, 'seed'),
  ('Mumbai', 'India', 30, 18, 'seed'),
  ('Cox''s Bazar', 'Bangladesh', 20, 10, 'seed'),
  ('Chittagong', 'Bangladesh', 18, 10, 'seed'),
  ('Istanbul', 'Turkey', 45, 28, 'seed'),
  ('Tokyo', 'Japan', 75, 45, 'seed'),
  ('Seoul', 'South Korea', 55, 35, 'seed'),
  ('Hong Kong', 'China', 70, 45, 'seed'),
  ('Maldives', 'Maldives', 120, 60, 'seed'),
  ('Muscat', 'Oman', 55, 35, 'seed');
