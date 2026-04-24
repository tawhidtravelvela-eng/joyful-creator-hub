-- Allow anon and authenticated users to read trip search cache
CREATE POLICY "Anyone can read trip search cache"
ON public.trip_search_cache
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon and authenticated users to insert/update trip search cache
CREATE POLICY "Anyone can insert trip search cache"
ON public.trip_search_cache
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update trip search cache"
ON public.trip_search_cache
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);