-- =========================================================
-- WHITELABEL STUDIO PHASE 1 — FOUNDATION
-- =========================================================

-- ---------------------------------------------------------
-- Helper functions for non-recursive RLS
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_affiliate_owner(_affiliate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affiliates
    WHERE id = _affiliate_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin_of(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role IN ('admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------
-- 1. whitelabel_pages
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  title           text NOT NULL,
  layout_type     text NOT NULL DEFAULT 'standard',
  published       boolean NOT NULL DEFAULT false,
  is_homepage     boolean NOT NULL DEFAULT false,
  seo_meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_version_id uuid,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_pages_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX whitelabel_pages_aff_slug ON public.whitelabel_pages(affiliate_id, slug) WHERE affiliate_id IS NOT NULL;
CREATE UNIQUE INDEX whitelabel_pages_tenant_slug ON public.whitelabel_pages(tenant_id, slug) WHERE tenant_id IS NOT NULL;
CREATE INDEX whitelabel_pages_aff_idx ON public.whitelabel_pages(affiliate_id) WHERE affiliate_id IS NOT NULL;
CREATE INDEX whitelabel_pages_tenant_idx ON public.whitelabel_pages(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE public.whitelabel_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published pages"
  ON public.whitelabel_pages FOR SELECT
  USING (published = true);

CREATE POLICY "Affiliate owners manage their pages"
  ON public.whitelabel_pages FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage their pages"
  ON public.whitelabel_pages FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

CREATE POLICY "Super admins view all pages"
  ON public.whitelabel_pages FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER whitelabel_pages_updated
  BEFORE UPDATE ON public.whitelabel_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- 2. whitelabel_page_versions
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_page_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      uuid NOT NULL REFERENCES public.whitelabel_pages(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  sections     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active    boolean NOT NULL DEFAULT false,
  notes        text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

CREATE INDEX whitelabel_page_versions_page_idx ON public.whitelabel_page_versions(page_id, version DESC);

ALTER TABLE public.whitelabel_page_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active versions of published pages"
  ON public.whitelabel_page_versions FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.whitelabel_pages p
      WHERE p.id = page_id AND p.published = true
    )
  );

CREATE POLICY "Owners manage page versions (affiliate)"
  ON public.whitelabel_page_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.whitelabel_pages p
    WHERE p.id = page_id
      AND p.affiliate_id IS NOT NULL
      AND public.is_affiliate_owner(p.affiliate_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.whitelabel_pages p
    WHERE p.id = page_id
      AND p.affiliate_id IS NOT NULL
      AND public.is_affiliate_owner(p.affiliate_id)
  ));

CREATE POLICY "Owners manage page versions (tenant)"
  ON public.whitelabel_page_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.whitelabel_pages p
    WHERE p.id = page_id
      AND p.tenant_id IS NOT NULL
      AND public.is_tenant_admin_of(p.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.whitelabel_pages p
    WHERE p.id = page_id
      AND p.tenant_id IS NOT NULL
      AND public.is_tenant_admin_of(p.tenant_id)
  ));

-- ---------------------------------------------------------
-- 3. whitelabel_section_registry
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_section_registry (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key        text NOT NULL UNIQUE,
  display_name    text NOT NULL,
  description     text,
  category        text NOT NULL DEFAULT 'content',
  icon            text,
  preview_image   text,
  schema_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  is_premium      boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whitelabel_section_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sections"
  ON public.whitelabel_section_registry FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins manage section registry"
  ON public.whitelabel_section_registry FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------
-- 4. whitelabel_themes_v2
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_themes_v2 (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id         uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id            uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  preset_key           text,
  primary_color        text NOT NULL DEFAULT '#2563eb',
  secondary_color      text NOT NULL DEFAULT '#1e40af',
  accent_color         text NOT NULL DEFAULT '#f59e0b',
  background_color     text NOT NULL DEFAULT '#ffffff',
  text_color           text NOT NULL DEFAULT '#0f172a',
  font_heading         text NOT NULL DEFAULT 'Inter',
  font_body            text NOT NULL DEFAULT 'Inter',
  density              text NOT NULL DEFAULT 'comfortable',
  border_radius        text NOT NULL DEFAULT '0.5rem',
  button_style         text NOT NULL DEFAULT 'solid',
  dark_mode_enabled    boolean NOT NULL DEFAULT false,
  custom_css           text,
  logo_url             text,
  favicon_url          text,
  og_image_url         text,
  hero_image_url       text,
  site_name            text,
  hero_tagline         text,
  hero_subtitle        text,
  whatsapp_number      text,
  google_analytics_id  text,
  facebook_pixel_id    text,
  custom_head_scripts  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_themes_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX whitelabel_themes_v2_aff_uniq ON public.whitelabel_themes_v2(affiliate_id) WHERE affiliate_id IS NOT NULL;
CREATE UNIQUE INDEX whitelabel_themes_v2_tenant_uniq ON public.whitelabel_themes_v2(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE public.whitelabel_themes_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view themes"
  ON public.whitelabel_themes_v2 FOR SELECT USING (true);

CREATE POLICY "Affiliate owners manage their theme"
  ON public.whitelabel_themes_v2 FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage their theme"
  ON public.whitelabel_themes_v2 FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

CREATE TRIGGER whitelabel_themes_v2_updated
  BEFORE UPDATE ON public.whitelabel_themes_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- 5. whitelabel_assets (media library)
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id  uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  url           text NOT NULL,
  file_name     text,
  mime_type     text,
  file_size     integer,
  width         integer,
  height        integer,
  alt_text      text,
  category      text DEFAULT 'general',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_assets_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

CREATE INDEX whitelabel_assets_aff_idx ON public.whitelabel_assets(affiliate_id) WHERE affiliate_id IS NOT NULL;
CREATE INDEX whitelabel_assets_tenant_idx ON public.whitelabel_assets(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE public.whitelabel_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view assets"
  ON public.whitelabel_assets FOR SELECT USING (true);

CREATE POLICY "Affiliate owners manage their assets"
  ON public.whitelabel_assets FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage their assets"
  ON public.whitelabel_assets FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

-- ---------------------------------------------------------
-- 6. whitelabel_testimonials
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_testimonials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id  uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_name   text NOT NULL,
  author_role   text,
  author_avatar text,
  rating        integer DEFAULT 5,
  quote         text NOT NULL,
  trip_type     text,
  is_published  boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_testimonials_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

ALTER TABLE public.whitelabel_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published testimonials"
  ON public.whitelabel_testimonials FOR SELECT
  USING (is_published = true);

CREATE POLICY "Affiliate owners manage testimonials"
  ON public.whitelabel_testimonials FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage testimonials"
  ON public.whitelabel_testimonials FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

-- ---------------------------------------------------------
-- 7. whitelabel_faqs
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_faqs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id  uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id     uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  question      text NOT NULL,
  answer        text NOT NULL,
  category      text DEFAULT 'general',
  is_published  boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_faqs_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

ALTER TABLE public.whitelabel_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published FAQs"
  ON public.whitelabel_faqs FOR SELECT
  USING (is_published = true);

CREATE POLICY "Affiliate owners manage FAQs"
  ON public.whitelabel_faqs FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage FAQs"
  ON public.whitelabel_faqs FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

-- ---------------------------------------------------------
-- 8. whitelabel_offers
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           text NOT NULL,
  subtitle        text,
  description     text,
  image_url       text,
  badge_text      text,
  price_from      numeric,
  currency        text DEFAULT 'USD',
  destination     text,
  link_url        text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_published    boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_offers_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

ALTER TABLE public.whitelabel_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published offers"
  ON public.whitelabel_offers FOR SELECT
  USING (is_published = true);

CREATE POLICY "Affiliate owners manage offers"
  ON public.whitelabel_offers FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage offers"
  ON public.whitelabel_offers FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

-- ---------------------------------------------------------
-- 9. whitelabel_announcements
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'top_bar',
  message         text NOT NULL,
  link_text       text,
  link_url        text,
  background_color text,
  text_color      text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_announcements_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

ALTER TABLE public.whitelabel_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active announcements"
  ON public.whitelabel_announcements FOR SELECT
  USING (is_active = true);

CREATE POLICY "Affiliate owners manage announcements"
  ON public.whitelabel_announcements FOR ALL
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id))
  WITH CHECK (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins manage announcements"
  ON public.whitelabel_announcements FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

-- ---------------------------------------------------------
-- 10. whitelabel_leads (form captures)
-- ---------------------------------------------------------
CREATE TABLE public.whitelabel_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_page     text,
  source_section  text,
  full_name       text,
  email           text,
  phone           text,
  message         text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'new',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whitelabel_leads_owner_xor CHECK (
    (affiliate_id IS NOT NULL AND tenant_id IS NULL) OR
    (affiliate_id IS NULL AND tenant_id IS NOT NULL)
  )
);

CREATE INDEX whitelabel_leads_aff_idx ON public.whitelabel_leads(affiliate_id, created_at DESC) WHERE affiliate_id IS NOT NULL;
CREATE INDEX whitelabel_leads_tenant_idx ON public.whitelabel_leads(tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;

ALTER TABLE public.whitelabel_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.whitelabel_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Affiliate owners view their leads"
  ON public.whitelabel_leads FOR SELECT
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Affiliate owners update/delete their leads"
  ON public.whitelabel_leads FOR UPDATE
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Affiliate owners delete leads"
  ON public.whitelabel_leads FOR DELETE
  USING (affiliate_id IS NOT NULL AND public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Tenant admins view their leads"
  ON public.whitelabel_leads FOR SELECT
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

CREATE POLICY "Tenant admins update their leads"
  ON public.whitelabel_leads FOR UPDATE
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

CREATE POLICY "Tenant admins delete their leads"
  ON public.whitelabel_leads FOR DELETE
  USING (tenant_id IS NOT NULL AND public.is_tenant_admin_of(tenant_id));

-- ---------------------------------------------------------
-- Seed: Section Registry (14 core sections)
-- ---------------------------------------------------------
INSERT INTO public.whitelabel_section_registry (type_key, display_name, description, category, icon, sort_order, default_config) VALUES
('hero_classic', 'Classic Hero', 'Full-width hero with headline, subtitle and search bar', 'hero', 'Layout', 10,
  '{"headline":"Find your next adventure","subtitle":"Discover flights, hotels and tours worldwide","ctaText":"Search now","backgroundImage":"","overlay":0.4}'::jsonb),
('hero_split', 'Split Hero', 'Text on the left, image on the right', 'hero', 'Columns2', 20,
  '{"headline":"Travel made effortless","subtitle":"Curated experiences for the modern traveler","ctaText":"Get started","image":""}'::jsonb),
('hero_video', 'Video Hero', 'Full-width video background with overlay text', 'hero', 'Video', 30,
  '{"headline":"Begin your journey","subtitle":"","videoUrl":"","posterImage":"","overlay":0.5}'::jsonb),
('hero_minimal', 'Minimal Hero', 'Centered text on solid or gradient background', 'hero', 'AlignCenter', 40,
  '{"headline":"Less complexity. More travel.","subtitle":"Plan, book and manage in one place.","backgroundType":"gradient"}'::jsonb),
('search_inline', 'Search Bar', 'Flight/Hotel/Tour search tabs', 'search', 'Search', 50,
  '{"defaultTab":"flights","showTabs":["flights","hotels","tours"],"style":"floating"}'::jsonb),
('usp_strip', 'Value Props', '3-6 value propositions with icons', 'content', 'Sparkles', 60,
  '{"items":[{"icon":"Shield","title":"Secure booking","description":"Your data and payments are protected"},{"icon":"Headphones","title":"24/7 support","description":"Real humans, around the clock"},{"icon":"Tag","title":"Best price","description":"Price match guarantee on all bookings"}]}'::jsonb),
('destinations_grid', 'Popular Destinations', 'Grid of destination cards', 'content', 'Grid3x3', 70,
  '{"title":"Popular destinations","mode":"auto","limit":8,"layout":"grid"}'::jsonb),
('offers_carousel', 'Featured Offers', 'Carousel of curated deals', 'content', 'Tag', 80,
  '{"title":"Featured offers","source":"manual","limit":6}'::jsonb),
('testimonials_grid', 'Testimonials', 'Customer testimonials grid or carousel', 'social', 'Quote', 90,
  '{"title":"What our travelers say","layout":"carousel","limit":6}'::jsonb),
('trust_bar', 'Trust Bar', 'Partner logos, awards, certifications', 'social', 'Award', 100,
  '{"title":"Trusted by","items":[]}'::jsonb),
('faq_accordion', 'FAQ', 'Accordion of frequently asked questions', 'content', 'HelpCircle', 110,
  '{"title":"Frequently asked questions","limit":10}'::jsonb),
('newsletter_capture', 'Newsletter', 'Email capture for newsletter', 'conversion', 'Mail', 120,
  '{"title":"Stay inspired","subtitle":"Get travel deals in your inbox","ctaText":"Subscribe"}'::jsonb),
('cta_block', 'Call to Action', 'Big banner with headline and CTA button', 'conversion', 'MousePointer', 130,
  '{"headline":"Ready to plan your trip?","subtitle":"Talk to a travel expert today","ctaText":"Contact us","ctaLink":"/contact"}'::jsonb),
('contact_form', 'Contact Form', 'Lead capture form', 'conversion', 'MessageSquare', 140,
  '{"title":"Get in touch","fields":["name","email","phone","message"],"submitText":"Send message"}'::jsonb);
