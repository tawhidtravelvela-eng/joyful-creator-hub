-- ============================================================
-- PHASE 3.1 — PAGE MANAGEMENT FOUNDATION
-- ============================================================

-- 1. Extend whitelabel_pages with CMS fields
ALTER TABLE public.whitelabel_pages
  ADD COLUMN IF NOT EXISTS nav_label text,
  ADD COLUMN IF NOT EXISTS nav_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_in_header boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_footer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_page_id uuid REFERENCES public.whitelabel_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_key text DEFAULT 'blank',
  ADD COLUMN IF NOT EXISTS og_image text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS requires_auth boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_wl_pages_parent ON public.whitelabel_pages(parent_page_id);
CREATE INDEX IF NOT EXISTS idx_wl_pages_nav_header ON public.whitelabel_pages(affiliate_id, show_in_header, nav_order) WHERE show_in_header = true;
CREATE INDEX IF NOT EXISTS idx_wl_pages_nav_footer ON public.whitelabel_pages(affiliate_id, show_in_footer, nav_order) WHERE show_in_footer = true;

-- ============================================================
-- 2. Navigation menus table (header + footer structures)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whitelabel_navigation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_location text NOT NULL DEFAULT 'header', -- 'header' | 'footer_col_1' | 'footer_col_2' | 'footer_col_3' | 'footer_col_4' | 'mobile'
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Each item: { id, label, type: 'page'|'url'|'dropdown', page_id?, url?, icon?, target?, children?, sort_order }
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wl_nav_owner_check CHECK (affiliate_id IS NOT NULL OR tenant_id IS NOT NULL),
  CONSTRAINT wl_nav_unique_loc UNIQUE NULLS NOT DISTINCT (affiliate_id, tenant_id, menu_location)
);

CREATE INDEX IF NOT EXISTS idx_wl_nav_affiliate ON public.whitelabel_navigation(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_nav_tenant ON public.whitelabel_navigation(tenant_id);

ALTER TABLE public.whitelabel_navigation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read navigation"
  ON public.whitelabel_navigation FOR SELECT
  USING (true);

CREATE POLICY "Affiliate owners manage their navigation"
  ON public.whitelabel_navigation FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage their navigation"
  ON public.whitelabel_navigation FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

CREATE POLICY "Super admins manage all navigation"
  ON public.whitelabel_navigation FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_wl_nav_updated_at
  BEFORE UPDATE ON public.whitelabel_navigation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Reusable content blocks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whitelabel_content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  block_key text NOT NULL, -- e.g. 'contact_info', 'hero_intro', 'pricing_terms'
  display_name text NOT NULL,
  block_type text NOT NULL DEFAULT 'rich_text', -- rich_text | testimonial | cta | gallery | custom_html | snippet
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_global boolean DEFAULT false, -- if true, can be embedded site-wide (e.g. footer contact)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wl_cb_owner_check CHECK (affiliate_id IS NOT NULL OR tenant_id IS NOT NULL),
  CONSTRAINT wl_cb_unique_key UNIQUE NULLS NOT DISTINCT (affiliate_id, tenant_id, block_key)
);

CREATE INDEX IF NOT EXISTS idx_wl_cb_affiliate ON public.whitelabel_content_blocks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_cb_tenant ON public.whitelabel_content_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wl_cb_key ON public.whitelabel_content_blocks(block_key);

ALTER TABLE public.whitelabel_content_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read content blocks"
  ON public.whitelabel_content_blocks FOR SELECT
  USING (true);

CREATE POLICY "Affiliate owners manage their content blocks"
  ON public.whitelabel_content_blocks FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage their content blocks"
  ON public.whitelabel_content_blocks FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

CREATE POLICY "Super admins manage all content blocks"
  ON public.whitelabel_content_blocks FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_wl_cb_updated_at
  BEFORE UPDATE ON public.whitelabel_content_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Page templates registry (system-wide presets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whitelabel_page_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general', -- general | marketing | legal | content | landing
  preview_image text,
  default_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_seo jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whitelabel_page_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active templates"
  ON public.whitelabel_page_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins manage templates"
  ON public.whitelabel_page_templates FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed core templates
INSERT INTO public.whitelabel_page_templates (template_key, display_name, description, category, sort_order, default_sections) VALUES
  ('blank', 'Blank Page', 'Start from scratch with no pre-filled sections.', 'general', 0, '[]'::jsonb),
  ('about', 'About Us', 'Tell your story — hero, mission, team, stats, CTA.', 'content', 10, '[]'::jsonb),
  ('contact', 'Contact Us', 'Contact form with map, hours, and channels.', 'content', 20, '[]'::jsonb),
  ('deals', 'Deals & Offers', 'Hero, offers carousel, USP strip, newsletter.', 'marketing', 30, '[]'::jsonb),
  ('blog_index', 'Blog Index', 'Latest posts grid with categories.', 'content', 40, '[]'::jsonb),
  ('landing', 'Landing Page', 'Hero, features, testimonials, pricing, CTA.', 'marketing', 50, '[]'::jsonb),
  ('legal', 'Legal / Policy', 'Long-form rich text page for terms, privacy, etc.', 'legal', 60, '[]'::jsonb),
  ('destination', 'Destination Page', 'Hero, intro, top experiences, hotels, FAQ.', 'marketing', 70, '[]'::jsonb)
ON CONFLICT (template_key) DO NOTHING;