
-- Cache destination classifications so we don't re-detect on every search
CREATE TABLE public.destination_classification_cache (
  term text PRIMARY KEY,
  classification text NOT NULL CHECK (classification IN ('country', 'city', 'attraction', 'freetext')),
  resolved_cities text[] DEFAULT '{}',
  country text,
  dest_id text,
  hit_count int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.destination_classification_cache ENABLE ROW LEVEL SECURITY;

-- Public read for edge functions (service role writes)
CREATE POLICY "Service role full access" ON public.destination_classification_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_dest_class_term ON public.destination_classification_cache (term);
CREATE INDEX idx_dest_class_classification ON public.destination_classification_cache (classification);
