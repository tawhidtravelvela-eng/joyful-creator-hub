-- Drop the misconfigured policy that grants ALL to public
DROP POLICY IF EXISTS "Service role full access" ON public.google_place_id_cache;

-- Allow public SELECT (cache reads are safe and used by edge functions / clients)
CREATE POLICY "Public can read place id cache"
ON public.google_place_id_cache
FOR SELECT
TO public
USING (true);

-- Restrict all write operations to service_role only (edge functions use service role key)
CREATE POLICY "Service role can insert place id cache"
ON public.google_place_id_cache
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update place id cache"
ON public.google_place_id_cache
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can delete place id cache"
ON public.google_place_id_cache
FOR DELETE
TO service_role
USING (true);