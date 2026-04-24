
-- Make click insert require affiliate_id to exist
DROP POLICY "Anon insert clicks" ON public.affiliate_clicks;
CREATE POLICY "Anon insert clicks" ON public.affiliate_clicks FOR INSERT TO anon, authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.status = 'approved'));
