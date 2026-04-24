
CREATE TABLE public.visa_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_country TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  destination_name TEXT,
  visa_status TEXT NOT NULL CHECK (visa_status IN ('visa_free', 'evisa', 'eta', 'visa_required')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (passport_country, destination_country)
);

ALTER TABLE public.visa_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visa requirements"
  ON public.visa_requirements FOR SELECT USING (true);

CREATE TABLE public.visa_fetch_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_country TEXT NOT NULL UNIQUE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_refresh_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
  record_count INT DEFAULT 0
);

ALTER TABLE public.visa_fetch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visa fetch log"
  ON public.visa_fetch_log FOR SELECT USING (true);

CREATE INDEX idx_visa_req_passport ON public.visa_requirements (passport_country);
