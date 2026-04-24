CREATE OR REPLACE FUNCTION public.resolve_custom_site_for_host(_host text)
 RETURNS TABLE(site_id uuid, tenant_id uuid, site_name text, tagline text, logo_url text, favicon_url text, primary_color text, accent_color text, font_heading text, font_body text, social_links jsonb, contact_email text, contact_phone text, contact_whatsapp text, show_flights boolean, show_hotels boolean, show_tours boolean, show_transfers boolean, is_published boolean, published_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _hosts text[];
  _h text;
BEGIN
  IF _host IS NULL OR length(_host) = 0 THEN RETURN; END IF;

  -- Build candidate host list: original, lower-cased, with/without www prefix.
  _h := lower(regexp_replace(_host, '\.$', ''));
  _hosts := ARRAY[_h];
  IF _h LIKE 'www.%' THEN
    _hosts := _hosts || substring(_h FROM 5);
  ELSE
    _hosts := _hosts || ('www.' || _h);
  END IF;

  -- Path A: direct tenants.domain match (any candidate)
  SELECT id INTO _tenant_id FROM public.tenants
   WHERE domain = ANY(_hosts) AND is_active = true LIMIT 1;

  -- Path B: whitelabel_site_domains → affiliates → profiles.tenant_id (any candidate)
  IF _tenant_id IS NULL THEN
    SELECT p.tenant_id INTO _tenant_id
      FROM public.whitelabel_site_domains d
      JOIN public.affiliates a ON a.id = d.affiliate_id
      JOIN public.profiles p ON p.user_id = a.user_id
     WHERE d.domain = ANY(_hosts) AND d.cf_status = 'active'
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
$function$;