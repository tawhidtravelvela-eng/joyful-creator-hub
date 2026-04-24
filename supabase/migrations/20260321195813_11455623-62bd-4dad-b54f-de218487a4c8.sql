
-- Ensure newsletter_subscribers has no authenticated read beyond admin
-- Currently only admin SELECT + anon INSERT exist, but let's add explicit deny by ensuring
-- the INSERT policy is scoped properly and no stale policies exist
DROP POLICY IF EXISTS "Anyone can subscribe newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe newsletter"
  ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Add service_role management for edge functions
CREATE POLICY "Service manage newsletter_subscribers"
  ON public.newsletter_subscribers FOR ALL TO service_role
  USING (true);
