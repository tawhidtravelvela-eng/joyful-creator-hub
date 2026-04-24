-- Tenant site visitor analytics (page views from white-label sites)
CREATE TABLE IF NOT EXISTS public.tenant_site_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL DEFAULT 'pageview',
  page_path   TEXT NOT NULL DEFAULT '/',
  page_title  TEXT,
  referrer    TEXT,
  referrer_host TEXT,
  country     TEXT,
  device      TEXT,
  session_id  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tse_tenant_created
  ON public.tenant_site_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tse_tenant_path
  ON public.tenant_site_events (tenant_id, page_path);

CREATE INDEX IF NOT EXISTS idx_tse_tenant_referrer
  ON public.tenant_site_events (tenant_id, referrer_host)
  WHERE referrer_host IS NOT NULL;

ALTER TABLE public.tenant_site_events ENABLE ROW LEVEL SECURITY;

-- Tenant admins can read their own events
CREATE POLICY "Tenant admins read their site events"
  ON public.tenant_site_events
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

-- No direct inserts/updates/deletes from clients — edge function uses service role.