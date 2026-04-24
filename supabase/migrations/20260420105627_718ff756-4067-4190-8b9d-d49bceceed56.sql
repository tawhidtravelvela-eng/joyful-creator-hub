-- Phase 3: Custom Sites tables for B2B tenants
-- Each tenant gets ONE custom_site with multiple pages (each page = ordered list of section instances)

CREATE TABLE IF NOT EXISTS public.custom_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL DEFAULT 'My Travel Site',
  tagline TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  -- Brand identity (locked to design system; only colors/fonts swappable)
  primary_color TEXT NOT NULL DEFAULT '#0EA5E9',
  accent_color TEXT,
  font_heading TEXT DEFAULT 'Inter',
  font_body TEXT DEFAULT 'Inter',
  -- Contact + social
  contact_phone TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Module visibility (overrides plan flags only as a hide-toggle)
  show_flights BOOLEAN NOT NULL DEFAULT true,
  show_hotels BOOLEAN NOT NULL DEFAULT true,
  show_tours BOOLEAN NOT NULL DEFAULT true,
  show_transfers BOOLEAN NOT NULL DEFAULT true,
  -- Lifecycle
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS public.custom_site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.custom_sites(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                -- 'home', 'about', 'contact', 'privacy', 'terms'
  title TEXT NOT NULL,
  is_home BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false, -- true for required pages
  meta_title TEXT,
  meta_description TEXT,
  -- Section instances: [{id, type, variant, content, hidden}]
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_custom_site_pages_site ON public.custom_site_pages(site_id);
CREATE INDEX IF NOT EXISTS idx_custom_sites_tenant ON public.custom_sites(tenant_id);

-- Enable RLS
ALTER TABLE public.custom_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_site_pages ENABLE ROW LEVEL SECURITY;

-- ===== Helper: is the user a member of this tenant? =====
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  );
$$;

-- ===== custom_sites policies =====
CREATE POLICY "Tenant admins can view their site"
  ON public.custom_sites FOR SELECT
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant admins can insert their site"
  ON public.custom_sites FOR INSERT
  WITH CHECK (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant admins can update their site"
  ON public.custom_sites FOR UPDATE
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant admins can delete their site"
  ON public.custom_sites FOR DELETE
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'admin'));

-- Public can read PUBLISHED sites (for the actual rendered tenant website)
CREATE POLICY "Public can view published sites"
  ON public.custom_sites FOR SELECT
  USING (is_published = true);

-- ===== custom_site_pages policies =====
CREATE POLICY "Tenant admins can view their pages"
  ON public.custom_site_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_sites s
      WHERE s.id = custom_site_pages.site_id
        AND (public.is_tenant_admin_of(s.tenant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Tenant admins can insert their pages"
  ON public.custom_site_pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_sites s
      WHERE s.id = custom_site_pages.site_id
        AND (public.is_tenant_admin_of(s.tenant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Tenant admins can update their pages"
  ON public.custom_site_pages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_sites s
      WHERE s.id = custom_site_pages.site_id
        AND (public.is_tenant_admin_of(s.tenant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Tenant admins can delete their pages"
  ON public.custom_site_pages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_sites s
      WHERE s.id = custom_site_pages.site_id
        AND (public.is_tenant_admin_of(s.tenant_id) OR public.has_role(auth.uid(), 'admin'))
        AND custom_site_pages.is_system = false
    )
  );

CREATE POLICY "Public can view pages of published sites"
  ON public.custom_site_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_sites s
      WHERE s.id = custom_site_pages.site_id AND s.is_published = true
    )
  );

-- ===== Updated-at triggers =====
CREATE TRIGGER trg_custom_sites_updated_at
  BEFORE UPDATE ON public.custom_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_custom_site_pages_updated_at
  BEFORE UPDATE ON public.custom_site_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();