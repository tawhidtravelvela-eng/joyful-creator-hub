DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tripjack_hotels' AND policyname = 'Service manage tripjack_hotels') THEN
    CREATE POLICY "Service manage tripjack_hotels" ON public.tripjack_hotels FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tripjack_hotels' AND policyname = 'Admin manage tripjack_hotels') THEN
    CREATE POLICY "Admin manage tripjack_hotels" ON public.tripjack_hotels FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;