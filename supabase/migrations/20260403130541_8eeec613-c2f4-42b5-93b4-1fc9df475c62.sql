-- GIN trigram index on hotel name for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_tripjack_hotels_name_trgm
ON public.tripjack_hotels USING gin (name public.gin_trgm_ops);

-- GIN trigram index on city_name for fast city ILIKE searches  
CREATE INDEX IF NOT EXISTS idx_tripjack_hotels_city_trgm
ON public.tripjack_hotels USING gin (city_name public.gin_trgm_ops);