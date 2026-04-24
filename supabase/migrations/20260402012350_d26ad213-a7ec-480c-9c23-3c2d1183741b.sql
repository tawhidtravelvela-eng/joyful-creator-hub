
ALTER TABLE viator_destination_map 
  ADD COLUMN IF NOT EXISTS dest_type text DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS lookup_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS iata_code text DEFAULT '',
  ADD COLUMN IF NOT EXISTS time_zone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS taxonomy_synced_at timestamptz DEFAULT NULL;

-- Create index on city_name for fast lookups
CREATE INDEX IF NOT EXISTS idx_viator_dest_map_city ON viator_destination_map (LOWER(city_name));
CREATE INDEX IF NOT EXISTS idx_viator_dest_map_type ON viator_destination_map (dest_type);
CREATE INDEX IF NOT EXISTS idx_viator_dest_map_parent ON viator_destination_map (parent_id);
