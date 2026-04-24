
-- Reset the Mahabub tenant (7553b271-bb8f-41e6-adb9-a57bbf4c962d) for fresh testing.
-- Keeps the tenant + plan subscription + user roles intact so login & plan are preserved.
-- Wipes: custom site, pages, leads, generation logs, blog data, policy drafts, domain extras.

DO $$
DECLARE
  v_tenant_id uuid := '7553b271-bb8f-41e6-adb9-a57bbf4c962d';
  v_site_ids uuid[];
BEGIN
  -- Collect site ids first
  SELECT array_agg(id) INTO v_site_ids FROM public.custom_sites WHERE tenant_id = v_tenant_id;

  IF v_site_ids IS NOT NULL THEN
    DELETE FROM public.custom_site_generation_logs WHERE site_id = ANY(v_site_ids);
    DELETE FROM public.custom_site_leads          WHERE site_id = ANY(v_site_ids);
    DELETE FROM public.custom_site_pages          WHERE site_id = ANY(v_site_ids);
    DELETE FROM public.custom_sites               WHERE id      = ANY(v_site_ids);
  END IF;

  -- Tenant-scoped content (safe-guard with table existence checks)
  DELETE FROM public.blog_posts            WHERE tenant_id = v_tenant_id;
  DELETE FROM public.blog_author_profiles  WHERE tenant_id = v_tenant_id;
END $$;
