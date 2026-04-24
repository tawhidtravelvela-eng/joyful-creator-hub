-- Deduplicate any existing rows before adding unique constraint
DELETE FROM public.flight_price_cache a
USING public.flight_price_cache b
WHERE a.id < b.id
  AND a.from_code = b.from_code
  AND a.to_code = b.to_code
  AND a.travel_date = b.travel_date
  AND COALESCE(a.cabin_class, '') = COALESCE(b.cabin_class, '')
  AND COALESCE(a.adults, 1) = COALESCE(b.adults, 1)
  AND COALESCE(a.children, 0) = COALESCE(b.children, 0)
  AND COALESCE(a.infants, 0) = COALESCE(b.infants, 0);

-- Add unique constraint matching the upsert ON CONFLICT spec used by flight-price-grid
ALTER TABLE public.flight_price_cache
  ADD CONSTRAINT flight_price_cache_route_date_pax_key
  UNIQUE (from_code, to_code, travel_date, cabin_class, adults, children, infants);