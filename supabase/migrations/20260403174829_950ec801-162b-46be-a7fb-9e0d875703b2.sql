
-- Table for high-demand / holiday dates
CREATE TABLE IF NOT EXISTS public.high_demand_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  label text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_high_demand_date_country ON public.high_demand_dates (date, COALESCE(country, ''));
ALTER TABLE public.high_demand_dates ENABLE ROW LEVEL SECURITY;

-- Anyone can read, only admins insert/update/delete
CREATE POLICY "Anyone can read high_demand_dates" ON public.high_demand_dates FOR SELECT USING (true);
CREATE POLICY "Admins manage high_demand_dates" ON public.high_demand_dates FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed common global holidays for 2025-2026
INSERT INTO public.high_demand_dates (date, label) VALUES
  ('2025-12-24','Christmas Eve'),('2025-12-25','Christmas'),('2025-12-31','New Year Eve'),
  ('2026-01-01','New Year'),('2026-02-14','Valentine''s Day'),
  ('2026-03-29','Easter'),('2026-04-03','Easter Weekend'),
  ('2026-07-04','US Independence Day'),('2026-11-26','Thanksgiving'),
  ('2026-12-24','Christmas Eve'),('2026-12-25','Christmas'),('2026-12-31','New Year Eve')
ON CONFLICT DO NOTHING;

-- Updated freshness function
CREATE OR REPLACE FUNCTION public.get_hotel_freshness(p_last_checked_at timestamptz, p_checkin date)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_last_checked_at IS NULL THEN 'hard_stale'
    ELSE (
      SELECT CASE
        -- Check if checkin date is a high-demand date
        WHEN EXISTS (SELECT 1 FROM public.high_demand_dates WHERE date = p_checkin) THEN
          CASE
            WHEN p_checkin - CURRENT_DATE <= 7 THEN
              CASE WHEN now() - p_last_checked_at < interval '60 minutes' THEN 'fresh'
                   WHEN now() - p_last_checked_at < interval '2 hours' THEN 'soft_stale'
                   ELSE 'hard_stale' END
            ELSE
              CASE WHEN now() - p_last_checked_at < interval '12 hours' THEN 'fresh'
                   WHEN now() - p_last_checked_at < interval '24 hours' THEN 'soft_stale'
                   ELSE 'hard_stale' END
          END
        -- Normal tiers
        WHEN p_checkin - CURRENT_DATE < 3 THEN
          CASE WHEN now() - p_last_checked_at < interval '60 minutes' THEN 'fresh'
               WHEN now() - p_last_checked_at < interval '2 hours' THEN 'soft_stale'
               ELSE 'hard_stale' END
        WHEN p_checkin - CURRENT_DATE < 7 THEN
          CASE WHEN now() - p_last_checked_at < interval '12 hours' THEN 'fresh'
               WHEN now() - p_last_checked_at < interval '24 hours' THEN 'soft_stale'
               ELSE 'hard_stale' END
        WHEN p_checkin - CURRENT_DATE < 30 THEN
          CASE WHEN now() - p_last_checked_at < interval '48 hours' THEN 'fresh'
               WHEN now() - p_last_checked_at < interval '72 hours' THEN 'soft_stale'
               ELSE 'hard_stale' END
        ELSE
          CASE WHEN now() - p_last_checked_at < interval '240 hours' THEN 'fresh'
               WHEN now() - p_last_checked_at < interval '480 hours' THEN 'soft_stale'
               ELSE 'hard_stale' END
      END
    )
  END;
$$;
