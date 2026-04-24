
-- Add itinerary_code column
ALTER TABLE public.saved_trips
  ADD COLUMN IF NOT EXISTS itinerary_code text UNIQUE;

-- Function to generate human-readable itinerary code
CREATE OR REPLACE FUNCTION public.generate_itinerary_code()
RETURNS TRIGGER AS $$
DECLARE
  date_part text;
  random_part text;
  new_code text;
  attempts int := 0;
BEGIN
  LOOP
    date_part := to_char(now(), 'YYMMDD');
    random_part := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
    new_code := 'TV-' || date_part || '-' || random_part;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.saved_trips WHERE itinerary_code = new_code) THEN
      NEW.itinerary_code := new_code;
      RETURN NEW;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 10 THEN
      -- Fallback: use 6 random chars
      random_part := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
      NEW.itinerary_code := 'TV-' || date_part || '-' || random_part;
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate code on insert
CREATE TRIGGER set_itinerary_code
  BEFORE INSERT ON public.saved_trips
  FOR EACH ROW
  WHEN (NEW.itinerary_code IS NULL)
  EXECUTE FUNCTION public.generate_itinerary_code();

-- Backfill existing rows
UPDATE public.saved_trips
SET itinerary_code = 'TV-' || to_char(created_at, 'YYMMDD') || '-' || upper(substring(md5(id::text) from 1 for 4))
WHERE itinerary_code IS NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_saved_trips_itinerary_code ON public.saved_trips (itinerary_code);
