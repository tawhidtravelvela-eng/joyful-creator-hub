
-- Remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public read hotel_search_sessions" ON public.hotel_search_sessions;

-- Replace with service_role only read (frontend should use edge functions to access session data)
CREATE POLICY "Service read hotel_search_sessions"
  ON public.hotel_search_sessions FOR SELECT
  TO service_role
  USING (true);
