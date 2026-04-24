-- Tighten lead insert: must specify which agent the lead is for
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.whitelabel_leads;
CREATE POLICY "Anyone can submit a lead with an owner"
  ON public.whitelabel_leads FOR INSERT
  WITH CHECK (
    (affiliate_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_id))
    OR
    (tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id))
  );

-- Tighten public read on themes: must have an owner
DROP POLICY IF EXISTS "Public can view themes" ON public.whitelabel_themes_v2;
CREATE POLICY "Public can view owned themes"
  ON public.whitelabel_themes_v2 FOR SELECT
  USING (affiliate_id IS NOT NULL OR tenant_id IS NOT NULL);

-- Tighten public read on assets: must have an owner
DROP POLICY IF EXISTS "Public can view assets" ON public.whitelabel_assets;
CREATE POLICY "Public can view owned assets"
  ON public.whitelabel_assets FOR SELECT
  USING (affiliate_id IS NOT NULL OR tenant_id IS NOT NULL);
