
-- 1. airline_settings: remove public read, keep admin + service_role
DROP POLICY IF EXISTS "Public read airline_settings" ON public.airline_settings;
CREATE POLICY "Service read airline_settings"
  ON public.airline_settings FOR SELECT TO service_role
  USING (true);

-- 2. baggage_cache: remove public read, keep admin + service_role
DROP POLICY IF EXISTS "Public read baggage_cache" ON public.baggage_cache;

-- 3. student_baggage_cache: remove public read, keep admin + service_role
DROP POLICY IF EXISTS "Public read student_baggage_cache" ON public.student_baggage_cache;

-- 4. student_airline_settings: remove public read, keep admin + service_role
DROP POLICY IF EXISTS "Public read student_airline_settings" ON public.student_airline_settings;
CREATE POLICY "Service read student_airline_settings"
  ON public.student_airline_settings FOR SELECT TO service_role
  USING (true);

-- 5. flight_price_cache: remove public read, keep service_role
DROP POLICY IF EXISTS "Public read flight_price_cache" ON public.flight_price_cache;

-- 6. hotel_supplier_mappings: remove public read, keep service_role
DROP POLICY IF EXISTS "Public read hotel_supplier_mappings" ON public.hotel_supplier_mappings;
