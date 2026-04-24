
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Table to store successful itineraries with embeddings for RAG
CREATE TABLE public.trip_itinerary_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 1,
  travelers INTEGER NOT NULL DEFAULT 1,
  travel_type TEXT DEFAULT NULL,
  travel_style TEXT DEFAULT NULL,
  cabin_class TEXT DEFAULT 'Economy',
  budget_total NUMERIC DEFAULT 0,
  budget_currency TEXT DEFAULT 'USD',
  trip_signature TEXT NOT NULL DEFAULT '',
  itinerary_summary TEXT NOT NULL DEFAULT '',
  itinerary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding extensions.vector(1536),
  quality_score NUMERIC DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  tenant_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_itinerary_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage trip_itinerary_embeddings" ON public.trip_itinerary_embeddings FOR ALL TO service_role USING (true);
CREATE POLICY "Admin read trip_itinerary_embeddings" ON public.trip_itinerary_embeddings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for vector similarity search
CREATE INDEX idx_trip_itinerary_embedding ON public.trip_itinerary_embeddings USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 20);
CREATE INDEX idx_trip_itinerary_destination ON public.trip_itinerary_embeddings(destination);
