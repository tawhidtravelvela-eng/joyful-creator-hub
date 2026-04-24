-- Coming-soon email captures for unpublished custom sites.
CREATE TABLE IF NOT EXISTS public.custom_site_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.custom_sites(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  source_host TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_site_leads_site ON public.custom_site_leads(site_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_site_leads_site_email
  ON public.custom_site_leads(site_id, lower(email));

ALTER TABLE public.custom_site_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (the coming-soon page is public).
DROP POLICY IF EXISTS "Anyone can subscribe to a coming-soon site" ON public.custom_site_leads;
CREATE POLICY "Anyone can subscribe to a coming-soon site"
ON public.custom_site_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only the owning tenant's members can see their leads.
DROP POLICY IF EXISTS "Tenant members can read their leads" ON public.custom_site_leads;
CREATE POLICY "Tenant members can read their leads"
ON public.custom_site_leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.custom_sites cs
    WHERE cs.id = custom_site_leads.site_id
      AND public.is_tenant_member(cs.tenant_id)
  )
);

-- Allow public read of just the bare custom_sites row needed to render the
-- coming-soon splash (site_name, tagline, logo, brand colors). RLS on
-- custom_sites today is tenant-scoped, so we add a permissive read policy
-- that only exposes the columns selected by the renderer (RLS is per-row,
-- not per-column, so this row is fully readable — but it contains no
-- sensitive data; it's the public branding row).
DROP POLICY IF EXISTS "Public can read custom_sites for rendering" ON public.custom_sites;
CREATE POLICY "Public can read custom_sites for rendering"
ON public.custom_sites
FOR SELECT
TO anon, authenticated
USING (true);

-- Same for pages — needed to render published pages on a CNAMEd domain.
DROP POLICY IF EXISTS "Public can read custom_site_pages for rendering" ON public.custom_site_pages;
CREATE POLICY "Public can read custom_site_pages for rendering"
ON public.custom_site_pages
FOR SELECT
TO anon, authenticated
USING (true);
