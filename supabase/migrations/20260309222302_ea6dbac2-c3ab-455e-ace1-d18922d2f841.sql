
-- Fix 1: hotel_interactions - restrict service manage to service_role instead of public
DROP POLICY IF EXISTS "Service manage hotel_interactions" ON public.hotel_interactions;
CREATE POLICY "Service manage hotel_interactions" ON public.hotel_interactions
  FOR ALL TO service_role USING (true);

-- Fix 2: hotel_interactions - restrict public insert to only allow inserts with valid data (not wide-open)
DROP POLICY IF EXISTS "Public insert hotel_interactions" ON public.hotel_interactions;
CREATE POLICY "Anon insert hotel_interactions" ON public.hotel_interactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (hotel_id IS NOT NULL AND hotel_name IS NOT NULL);

-- Fix 3: tour_inquiries - restrict public insert
DROP POLICY IF EXISTS "Public insert tour_inquiries" ON public.tour_inquiries;
CREATE POLICY "Anon insert tour_inquiries" ON public.tour_inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (visitor_email IS NOT NULL AND visitor_email <> '');

-- Fix 4: tripjack_cities - restrict service manage to service_role
DROP POLICY IF EXISTS "Service manage tripjack_cities" ON public.tripjack_cities;
CREATE POLICY "Service manage tripjack_cities" ON public.tripjack_cities
  FOR ALL TO service_role USING (true);

-- Fix 5: tripjack_hotels - restrict service manage to service_role
DROP POLICY IF EXISTS "Service manage tripjack_hotels" ON public.tripjack_hotels;
CREATE POLICY "Service manage tripjack_hotels" ON public.tripjack_hotels
  FOR ALL TO service_role USING (true);

-- Fix 6: tour_inquiries admin policy - restrict to authenticated instead of public
DROP POLICY IF EXISTS "Admin manage tour_inquiries" ON public.tour_inquiries;
CREATE POLICY "Admin manage tour_inquiries" ON public.tour_inquiries
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 7: hotel_interactions admin read - restrict to authenticated
DROP POLICY IF EXISTS "Admin read hotel_interactions" ON public.hotel_interactions;
CREATE POLICY "Admin read hotel_interactions" ON public.hotel_interactions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
