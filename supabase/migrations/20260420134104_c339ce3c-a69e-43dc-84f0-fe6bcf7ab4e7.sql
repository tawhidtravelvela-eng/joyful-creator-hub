-- Resolve a custom site (published or not) for a given hostname.
-- Anonymous visitors can call this so their browser knows whether to
-- render the live site, a "Coming Soon" splash, or fall through.
--
-- RLS chain (affiliates → profiles) blocks anon reads, so we use
-- SECURITY DEFINER and explicitly return only the columns we need.
CREATE OR REPLACE FUNCTION public.resolve_custom_site_for_host(_host text)
RETURNS TABLE (
  site_id uuid,
  tenant_id uuid,
  site_name text,
  tagline text,
  logo_url text,
  favicon_url text,
  primary_color text,
  accent_color text,
  font_heading text,
  font_body text,
  social_links jsonb,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  show_flights boolean,
  show_hotels boolean,
  show_tours boolean,
  show_transfers boolean,
  is_published boolean,
  published_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  IF _host IS NULL OR length(_host) = 0 THEN RETURN; END IF;

  -- Path A: direct tenants.domain match
  SELECT id INTO _tenant_id FROM public.tenants
   WHERE domain = _host AND is_active = true LIMIT 1;

  -- Path B: whitelabel_site_domains → affiliates → profiles.tenant_id
  IF _tenant_id IS NULL THEN
    SELECT p.tenant_id INTO _tenant_id
      FROM public.whitelabel_site_domains d
      JOIN public.affiliates a ON a.id = d.affiliate_id
      JOIN public.profiles p ON p.user_id = a.user_id
     WHERE d.domain = _host AND d.cf_status = 'active'
     LIMIT 1;
  END IF;

  IF _tenant_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT cs.id, cs.tenant_id, cs.site_name, cs.tagline, cs.logo_url, cs.favicon_url,
           cs.primary_color, cs.accent_color, cs.font_heading, cs.font_body,
           cs.social_links, cs.contact_email, cs.contact_phone, cs.contact_whatsapp,
           cs.show_flights, cs.show_hotels, cs.show_tours, cs.show_transfers,
           cs.is_published, cs.published_at
      FROM public.custom_sites cs
     WHERE cs.tenant_id = _tenant_id
     LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_custom_site_for_host(text) TO anon, authenticated;

-- Pages for a site, returned regardless of publish status. Anon callers
-- still need this to render either the published page or to know there
-- are pages for the coming-soon flow.
CREATE OR REPLACE FUNCTION public.get_custom_site_pages(_site_id uuid)
RETURNS TABLE (
  id uuid,
  site_id uuid,
  slug text,
  title text,
  meta_title text,
  meta_description text,
  is_home boolean,
  is_system boolean,
  sort_order int,
  sections jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, site_id, slug, title, meta_title, meta_description,
         is_home, is_system, sort_order, sections
    FROM public.custom_site_pages
   WHERE site_id = _site_id
   ORDER BY sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_custom_site_pages(uuid) TO anon, authenticated;