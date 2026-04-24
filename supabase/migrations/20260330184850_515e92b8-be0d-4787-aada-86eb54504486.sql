-- Add columns for modified-since tracking and search frequency
ALTER TABLE public.tour_sync_state 
  ADD COLUMN IF NOT EXISTS last_modified_since_at timestamptz,
  ADD COLUMN IF NOT EXISTS modified_since_cursor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS search_hit_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_search_hit_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_tier text DEFAULT 'monthly';

-- Add column to tour_product_cache for tracking modifications
ALTER TABLE public.tour_product_cache
  ADD COLUMN IF NOT EXISTS modified_since_cursor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;