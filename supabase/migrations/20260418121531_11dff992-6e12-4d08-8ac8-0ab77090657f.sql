CREATE POLICY "Anyone can read flight price cache"
ON public.flight_price_cache
FOR SELECT
USING (true);