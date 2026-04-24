-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Attractions table
CREATE TABLE public.attractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_id bigint,
  osm_type text DEFAULT 'node',
  name text NOT NULL,
  name_en text,
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  latitude numeric,
  longitude numeric,
  category text NOT NULL DEFAULT 'attraction',
  subcategory text DEFAULT '',
  tags text[] DEFAULT '{}',
  description text DEFAULT '',
  description_source text DEFAULT '',
  wikipedia_url text DEFAULT '',
  wikidata_id text DEFAULT '',
  image_url text DEFAULT '',
  popularity_score integer DEFAULT 0,
  ai_rank integer,
  best_time_to_visit text DEFAULT '',
  suggested_duration text DEFAULT '',
  itinerary_tags text[] DEFAULT '{}',
  sync_source text DEFAULT 'osm',
  ai_enriched boolean DEFAULT false,
  enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(osm_id, osm_type)
);

CREATE INDEX idx_attractions_city ON public.attractions(city);
CREATE INDEX idx_attractions_country ON public.attractions(country);
CREATE INDEX idx_attractions_category ON public.attractions(category);
CREATE INDEX idx_attractions_city_country ON public.attractions(city, country);
CREATE INDEX idx_attractions_popularity ON public.attractions(popularity_score DESC);

ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attractions" ON public.attractions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service manage attractions" ON public.attractions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage attractions" ON public.attractions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Sync state tracker
CREATE TABLE public.attraction_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  country text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  priority integer DEFAULT 0,
  attraction_count integer DEFAULT 0,
  last_synced_at timestamptz,
  ai_enriched_at timestamptz,
  error_message text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city, country)
);

ALTER TABLE public.attraction_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manage attraction_sync_state" ON public.attraction_sync_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admin read attraction_sync_state" ON public.attraction_sync_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));