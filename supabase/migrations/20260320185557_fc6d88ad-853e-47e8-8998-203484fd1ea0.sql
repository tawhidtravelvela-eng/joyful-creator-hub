
-- Clear all tripjack hotel data for fresh re-sync
TRUNCATE TABLE public.tripjack_hotels;
TRUNCATE TABLE public.tripjack_city_hotel_map;
TRUNCATE TABLE public.tripjack_cities;

-- Create sync state table to track progress
CREATE TABLE IF NOT EXISTS public.tripjack_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL DEFAULT 'hotels',
  status text NOT NULL DEFAULT 'idle',
  next_cursor text,
  total_hotels_synced integer NOT NULL DEFAULT 0,
  total_cities_synced integer NOT NULL DEFAULT 0,
  pages_processed integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  UNIQUE(sync_type)
);

-- Seed default row
INSERT INTO public.tripjack_sync_state (sync_type, status)
VALUES ('hotels', 'idle')
ON CONFLICT (sync_type) DO NOTHING;

-- RLS
ALTER TABLE public.tripjack_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage tripjack_sync_state"
  ON public.tripjack_sync_state FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service manage tripjack_sync_state"
  ON public.tripjack_sync_state FOR ALL
  TO service_role
  USING (true);
