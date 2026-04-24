
CREATE OR REPLACE FUNCTION public.match_trip_itineraries(
  query_embedding extensions.vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  destination TEXT,
  origin TEXT,
  duration_days INTEGER,
  travelers INTEGER,
  travel_type TEXT,
  travel_style TEXT,
  budget_total NUMERIC,
  budget_currency TEXT,
  itinerary_summary TEXT,
  itinerary_json JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.destination,
    t.origin,
    t.duration_days,
    t.travelers,
    t.travel_type,
    t.travel_style,
    t.budget_total,
    t.budget_currency,
    t.itinerary_summary,
    t.itinerary_json,
    (1 - (t.embedding OPERATOR(extensions.<=>) query_embedding))::FLOAT AS similarity
  FROM public.trip_itinerary_embeddings t
  WHERE (1 - (t.embedding OPERATOR(extensions.<=>) query_embedding)) > match_threshold
  ORDER BY t.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT match_count;
END;
$$;
