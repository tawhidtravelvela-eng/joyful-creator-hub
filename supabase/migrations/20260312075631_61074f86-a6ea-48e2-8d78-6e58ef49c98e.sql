
-- Baggage cache: stores baggage allowance per route/airline/fare class
CREATE TABLE public.baggage_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_code text NOT NULL,
  to_code text NOT NULL,
  airline_code text NOT NULL,
  fare_class text NOT NULL DEFAULT '',
  cabin_baggage text DEFAULT '',
  checkin_baggage text DEFAULT '',
  source text DEFAULT 'tripjack',
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (from_code, to_code, airline_code, fare_class)
);

-- Student baggage cache: separate table for student fare baggage
CREATE TABLE public.student_baggage_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_code text NOT NULL,
  to_code text NOT NULL,
  airline_code text NOT NULL,
  fare_class text NOT NULL DEFAULT '',
  cabin_baggage text DEFAULT '',
  checkin_baggage text DEFAULT '',
  source text DEFAULT 'tripjack',
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (from_code, to_code, airline_code, fare_class)
);

-- Enable RLS
ALTER TABLE public.baggage_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_baggage_cache ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read baggage_cache" ON public.baggage_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read student_baggage_cache" ON public.student_baggage_cache FOR SELECT TO anon, authenticated USING (true);

-- Service role write
CREATE POLICY "Service manage baggage_cache" ON public.baggage_cache FOR ALL TO service_role USING (true);
CREATE POLICY "Service manage student_baggage_cache" ON public.student_baggage_cache FOR ALL TO service_role USING (true);

-- Admin manage
CREATE POLICY "Admin manage baggage_cache" ON public.baggage_cache FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage student_baggage_cache" ON public.student_baggage_cache FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Upsert function for baggage cache
CREATE OR REPLACE FUNCTION public.upsert_baggage_cache(
  p_from_code text,
  p_to_code text,
  p_airline_code text,
  p_fare_class text,
  p_cabin_baggage text,
  p_checkin_baggage text,
  p_source text DEFAULT 'tripjack',
  p_is_student boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_is_student THEN
    INSERT INTO public.student_baggage_cache (from_code, to_code, airline_code, fare_class, cabin_baggage, checkin_baggage, source, cached_at, expires_at)
    VALUES (p_from_code, p_to_code, p_airline_code, COALESCE(p_fare_class, ''), COALESCE(p_cabin_baggage, ''), COALESCE(p_checkin_baggage, ''), p_source, now(), now() + interval '60 days')
    ON CONFLICT (from_code, to_code, airline_code, fare_class)
    DO UPDATE SET cabin_baggage = EXCLUDED.cabin_baggage, checkin_baggage = EXCLUDED.checkin_baggage, source = EXCLUDED.source, cached_at = now(), expires_at = now() + interval '60 days', updated_at = now();
  ELSE
    INSERT INTO public.baggage_cache (from_code, to_code, airline_code, fare_class, cabin_baggage, checkin_baggage, source, cached_at, expires_at)
    VALUES (p_from_code, p_to_code, p_airline_code, COALESCE(p_fare_class, ''), COALESCE(p_cabin_baggage, ''), COALESCE(p_checkin_baggage, ''), p_source, now(), now() + interval '60 days')
    ON CONFLICT (from_code, to_code, airline_code, fare_class)
    DO UPDATE SET cabin_baggage = EXCLUDED.cabin_baggage, checkin_baggage = EXCLUDED.checkin_baggage, source = EXCLUDED.source, cached_at = now(), expires_at = now() + interval '60 days', updated_at = now();
  END IF;
END;
$$;

-- Indexes for fast lookups
CREATE INDEX idx_baggage_cache_lookup ON public.baggage_cache (from_code, to_code, airline_code);
CREATE INDEX idx_student_baggage_cache_lookup ON public.student_baggage_cache (from_code, to_code, airline_code);
