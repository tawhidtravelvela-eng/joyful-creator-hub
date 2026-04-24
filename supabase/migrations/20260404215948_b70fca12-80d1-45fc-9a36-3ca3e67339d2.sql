DROP INDEX IF EXISTS idx_google_place_id_cache_query;
ALTER TABLE public.google_place_id_cache ADD CONSTRAINT uq_google_place_id_cache_query UNIQUE (query);