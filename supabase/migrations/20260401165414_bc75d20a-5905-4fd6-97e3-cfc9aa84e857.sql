ALTER TABLE public.trip_generation_jobs
  ADD COLUMN IF NOT EXISTS quality_score smallint,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3),
  ADD COLUMN IF NOT EXISTS quality_metadata jsonb;