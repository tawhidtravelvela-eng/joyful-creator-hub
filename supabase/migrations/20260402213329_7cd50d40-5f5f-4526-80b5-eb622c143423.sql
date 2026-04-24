
-- =============================================
-- Hotel Cache-First Architecture — 6 Tables
-- =============================================

-- 1. hotel_static_cache
CREATE TABLE public.hotel_static_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_uid text NOT NULL,
  name text NOT NULL DEFAULT '',
  rating numeric DEFAULT 0,
  stars integer DEFAULT 0,
  address text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT '',
  latitude numeric,
  longitude numeric,
  property_type text DEFAULT 'Hotel',
  hero_image_url text,
  images_json jsonb DEFAULT '[]'::jsonb,
  facilities_json jsonb DEFAULT '[]'::jsonb,
  description text DEFAULT '',
  source text DEFAULT 'tripjack',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_static_cache_uid_source_unique UNIQUE (hotel_uid, source)
);

CREATE INDEX idx_hotel_static_cache_uid ON public.hotel_static_cache(hotel_uid);
CREATE INDEX idx_hotel_static_cache_city ON public.hotel_static_cache(city);

ALTER TABLE public.hotel_static_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hotel_static_cache" ON public.hotel_static_cache
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service manage hotel_static_cache" ON public.hotel_static_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. hotel_search_snapshot
CREATE TABLE public.hotel_search_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_uid text NOT NULL,
  search_hotel_id text DEFAULT '',
  checkin date NOT NULL,
  checkout date NOT NULL,
  occupancy_key text NOT NULL DEFAULT '2-0-1',
  min_price numeric DEFAULT 0,
  currency text DEFAULT 'INR',
  free_cancellation boolean DEFAULT false,
  property_type text DEFAULT 'Hotel',
  meal_basis text DEFAULT '',
  raw_search_json jsonb DEFAULT '{}'::jsonb,
  stale_status text DEFAULT 'fresh',
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_search_snapshot_unique UNIQUE (hotel_uid, checkin, checkout, occupancy_key)
);

CREATE INDEX idx_hotel_search_snapshot_lookup ON public.hotel_search_snapshot(hotel_uid, checkin, checkout);
CREATE INDEX idx_hotel_search_snapshot_stale ON public.hotel_search_snapshot(stale_status, last_checked_at);

ALTER TABLE public.hotel_search_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read hotel_search_snapshot" ON public.hotel_search_snapshot
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service manage hotel_search_snapshot" ON public.hotel_search_snapshot
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. hotel_detail_snapshot
CREATE TABLE public.hotel_detail_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_uid text NOT NULL,
  search_hotel_id text DEFAULT '',
  checkin date NOT NULL,
  checkout date NOT NULL,
  occupancy_key text NOT NULL DEFAULT '2-0-1',
  raw_detail_json jsonb DEFAULT '{}'::jsonb,
  options_count integer DEFAULT 0,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_detail_snapshot_unique UNIQUE (hotel_uid, checkin, checkout, occupancy_key)
);

CREATE INDEX idx_hotel_detail_snapshot_lookup ON public.hotel_detail_snapshot(hotel_uid, checkin, checkout);

ALTER TABLE public.hotel_detail_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read hotel_detail_snapshot" ON public.hotel_detail_snapshot
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service manage hotel_detail_snapshot" ON public.hotel_detail_snapshot
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. hotel_option_snapshot
CREATE TABLE public.hotel_option_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id text NOT NULL,
  hotel_uid text NOT NULL,
  checkin date NOT NULL,
  checkout date NOT NULL,
  occupancy_key text NOT NULL DEFAULT '2-0-1',
  total_price numeric DEFAULT 0,
  currency text DEFAULT 'INR',
  cancellation_type text DEFAULT 'unknown',
  cancellation_deadline_at timestamptz,
  cancellation_is_free boolean DEFAULT false,
  cancellation_text text DEFAULT '',
  cancellation_policy_raw_json jsonb DEFAULT '{}'::jsonb,
  pan_required boolean DEFAULT false,
  passport_required boolean DEFAULT false,
  is_package_rate boolean DEFAULT false,
  availability_status text DEFAULT 'available',
  meal_basis text DEFAULT '',
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_option_snapshot_unique UNIQUE (option_id, hotel_uid, checkin, checkout, occupancy_key)
);

CREATE INDEX idx_hotel_option_snapshot_hotel ON public.hotel_option_snapshot(hotel_uid, checkin, checkout);
CREATE INDEX idx_hotel_option_snapshot_option ON public.hotel_option_snapshot(option_id);

ALTER TABLE public.hotel_option_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read hotel_option_snapshot" ON public.hotel_option_snapshot
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service manage hotel_option_snapshot" ON public.hotel_option_snapshot
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. hotel_room_snapshot
CREATE TABLE public.hotel_room_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  option_id text NOT NULL,
  hotel_uid text NOT NULL,
  room_name text DEFAULT '',
  standard_name text DEFAULT '',
  description text DEFAULT '',
  meal_basis text DEFAULT '',
  facilities_json jsonb DEFAULT '[]'::jsonb,
  images_json jsonb DEFAULT '[]'::jsonb,
  room_details_json jsonb DEFAULT '{}'::jsonb,
  occupancy_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_room_snapshot_unique UNIQUE (room_id, option_id)
);

CREATE INDEX idx_hotel_room_snapshot_option ON public.hotel_room_snapshot(option_id);
CREATE INDEX idx_hotel_room_snapshot_hotel ON public.hotel_room_snapshot(hotel_uid);

ALTER TABLE public.hotel_room_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read hotel_room_snapshot" ON public.hotel_room_snapshot
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service manage hotel_room_snapshot" ON public.hotel_room_snapshot
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. hotel_price_history
CREATE TABLE public.hotel_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_uid text NOT NULL,
  option_id text,
  room_id text,
  checkin date,
  checkout date,
  old_price numeric NOT NULL DEFAULT 0,
  new_price numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'INR',
  change_type text DEFAULT 'search',
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hotel_price_history_hotel ON public.hotel_price_history(hotel_uid, changed_at DESC);
CREATE INDEX idx_hotel_price_history_option ON public.hotel_price_history(option_id);

ALTER TABLE public.hotel_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read hotel_price_history" ON public.hotel_price_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service manage hotel_price_history" ON public.hotel_price_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Freshness helper function
CREATE OR REPLACE FUNCTION public.get_hotel_freshness(
  p_last_checked_at timestamptz,
  p_checkin date
)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN p_last_checked_at IS NULL THEN 'hard_stale'
    WHEN p_checkin - CURRENT_DATE > 30 
      THEN CASE WHEN now() - p_last_checked_at < interval '24 hours' THEN 'fresh'
                WHEN now() - p_last_checked_at < interval '48 hours' THEN 'soft_stale'
                ELSE 'hard_stale' END
    WHEN p_checkin - CURRENT_DATE > 7
      THEN CASE WHEN now() - p_last_checked_at < interval '6 hours' THEN 'fresh'
                WHEN now() - p_last_checked_at < interval '12 hours' THEN 'soft_stale'
                ELSE 'hard_stale' END
    ELSE
      CASE WHEN now() - p_last_checked_at < interval '60 minutes' THEN 'fresh'
           WHEN now() - p_last_checked_at < interval '2 hours' THEN 'soft_stale'
           ELSE 'hard_stale' END
  END;
$$;
