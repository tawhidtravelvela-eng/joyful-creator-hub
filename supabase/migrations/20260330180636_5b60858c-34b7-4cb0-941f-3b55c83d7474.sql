
-- Sync state tracker for background inventory crawl
CREATE TABLE IF NOT EXISTS public.tour_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id text NOT NULL,
  destination_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- pending, syncing, completed, paused
  total_products_found integer NOT NULL DEFAULT 0,
  products_detailed integer NOT NULL DEFAULT 0,
  last_product_code text,
  product_codes_pending text[] NOT NULL DEFAULT '{}',
  product_codes_done text[] NOT NULL DEFAULT '{}',
  search_cursor integer NOT NULL DEFAULT 1,
  search_complete boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0, -- higher = more important, user searches get 100
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_count integer NOT NULL DEFAULT 0,
  last_error text,
  UNIQUE(destination_id)
);

ALTER TABLE public.tour_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage tour_sync_state"
  ON public.tour_sync_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admin read tour_sync_state"
  ON public.tour_sync_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Also extend tour_product_cache: make expires_at much longer for bg-synced items
-- and add a flag to distinguish bg-synced vs search-cached
ALTER TABLE public.tour_product_cache 
  ADD COLUMN IF NOT EXISTS sync_source text NOT NULL DEFAULT 'search',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS detail_fetched boolean NOT NULL DEFAULT false;
