-- Convert legacy variant-mode pages to mirror-mode for sites that have
-- the Phase 1 base_version set. Replaces sections JSON with the canonical
-- mirror-key list so the new MirrorPageEditor renders in the Studio.
UPDATE public.custom_site_pages csp
SET sections = '["hero","stats","banners","ai_planner","trending","destinations","features","testimonials","newsletter"]'::jsonb
FROM public.custom_sites cs
WHERE csp.site_id = cs.id
  AND cs.base_version IS NOT NULL
  AND csp.is_home = true
  AND jsonb_typeof(csp.sections) = 'array'
  AND (
    jsonb_array_length(csp.sections) = 0
    OR jsonb_typeof(csp.sections->0) = 'object'
  );