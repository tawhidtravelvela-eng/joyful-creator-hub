
-- Aggregated hotel popularity scores for ranking
-- Auto-refreshed from hotel_interactions + bookings
CREATE TABLE public.hotel_popularity_scores (
  hotel_uid TEXT PRIMARY KEY,
  hotel_name TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  click_count INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  booking_count INT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  last_booked_at TIMESTAMPTZ,
  popularity_rank REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup during ranking
CREATE INDEX idx_hotel_popularity_city ON public.hotel_popularity_scores(city);
CREATE INDEX idx_hotel_popularity_rank ON public.hotel_popularity_scores(popularity_rank DESC);

-- Enable RLS (service role only — used server-side in edge functions)
ALTER TABLE public.hotel_popularity_scores ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (edge functions use service role)
CREATE POLICY "Service role full access"
ON public.hotel_popularity_scores
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to refresh popularity scores from interactions + bookings
CREATE OR REPLACE FUNCTION public.refresh_hotel_popularity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Upsert aggregated interaction data
  INSERT INTO hotel_popularity_scores (hotel_uid, hotel_name, city, click_count, view_count, last_clicked_at, updated_at)
  SELECT
    hotel_id,
    MAX(hotel_name),
    MAX(city),
    COUNT(*) FILTER (WHERE action = 'click'),
    COUNT(*) FILTER (WHERE action = 'view'),
    MAX(created_at) FILTER (WHERE action = 'click'),
    now()
  FROM hotel_interactions
  WHERE created_at > now() - interval '90 days'
  GROUP BY hotel_id
  ON CONFLICT (hotel_uid)
  DO UPDATE SET
    click_count = EXCLUDED.click_count,
    view_count = EXCLUDED.view_count,
    hotel_name = COALESCE(NULLIF(EXCLUDED.hotel_name, ''), hotel_popularity_scores.hotel_name),
    city = COALESCE(NULLIF(EXCLUDED.city, ''), hotel_popularity_scores.city),
    last_clicked_at = EXCLUDED.last_clicked_at,
    updated_at = now();

  -- Update booking counts from bookings table
  UPDATE hotel_popularity_scores hps
  SET
    booking_count = sub.cnt,
    last_booked_at = sub.last_booked
  FROM (
    SELECT
      details->>'hotelId' AS hid,
      COUNT(*) AS cnt,
      MAX(created_at) AS last_booked
    FROM bookings
    WHERE type = 'hotel'
      AND status IN ('confirmed', 'completed')
      AND details->>'hotelId' IS NOT NULL
      AND created_at > now() - interval '90 days'
    GROUP BY details->>'hotelId'
  ) sub
  WHERE hps.hotel_uid = sub.hid;

  -- Compute composite popularity rank (0-100 scale)
  UPDATE hotel_popularity_scores
  SET popularity_rank = LEAST(100, (
    COALESCE(click_count, 0) * 2.0 +
    COALESCE(view_count, 0) * 0.5 +
    COALESCE(booking_count, 0) * 15.0
  ));
END;
$$;
