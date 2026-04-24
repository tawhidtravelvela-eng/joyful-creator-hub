
-- Add service_role write access to tripjack_city_hotel_map
CREATE POLICY "Service manage tripjack_city_hotel_map"
  ON public.tripjack_city_hotel_map FOR ALL
  TO service_role
  USING (true);

-- Also add admin access
CREATE POLICY "Admin manage tripjack_city_hotel_map"
  ON public.tripjack_city_hotel_map FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
