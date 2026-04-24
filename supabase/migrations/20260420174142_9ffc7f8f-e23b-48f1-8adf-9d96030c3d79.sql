
-- ── Tenant uniqueness inputs ─────────────────────────────────────────────
ALTER TABLE public.custom_sites
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS product_focus text,
  ADD COLUMN IF NOT EXISTS region_focus text,
  ADD COLUMN IF NOT EXISTS brand_personality text,
  ADD COLUMN IF NOT EXISTS layout_preset text;

COMMENT ON COLUMN public.custom_sites.audience IS 'leisure | corporate | luxury | agents | mixed';
COMMENT ON COLUMN public.custom_sites.product_focus IS 'flights | hotels | tours | visa | mixed';
COMMENT ON COLUMN public.custom_sites.region_focus IS 'free-text region (e.g. GCC, SE Asia, Global)';
COMMENT ON COLUMN public.custom_sites.brand_personality IS 'modern | classic | bold | minimal | warm | premium';
COMMENT ON COLUMN public.custom_sites.layout_preset IS 'ota | corporate | hotel | flight | tour | ai_powered';

-- ── Per-page section variants + long-form body ──────────────────────────
ALTER TABLE public.custom_site_pages
  ADD COLUMN IF NOT EXISTS section_variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS body_md text;

COMMENT ON COLUMN public.custom_site_pages.section_variants IS 'Map of section_key -> variant_key chosen by AI (e.g. {"hero":"split"})';
COMMENT ON COLUMN public.custom_site_pages.body_md IS 'Markdown body for system content pages (about, privacy, terms)';

-- ── Generation log (debug + regen history) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_site_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.custom_sites(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',           -- pending | success | failed
  model text,
  input jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  triggered_by uuid,                                -- auth.uid() of caller
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csgl_site_created
  ON public.custom_site_generation_logs (site_id, created_at DESC);

ALTER TABLE public.custom_site_generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin reads all generation logs" ON public.custom_site_generation_logs;
CREATE POLICY "super_admin reads all generation logs"
  ON public.custom_site_generation_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "tenant admin reads own site logs" ON public.custom_site_generation_logs;
CREATE POLICY "tenant admin reads own site logs"
  ON public.custom_site_generation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.custom_sites cs
      WHERE cs.id = custom_site_generation_logs.site_id
        AND public.is_tenant_admin_of(cs.tenant_id)
    )
  );

-- Service role / SECURITY DEFINER edge function writes; no INSERT/UPDATE/DELETE policy needed for end users.
