-- Platform-wide feature catalog + per-tenant enablement state
-- Lets super-admins ship features and decide rollout policy
-- (auto-enable for matching plans, or opt-in via "What's New" panel).

CREATE TABLE IF NOT EXISTS public.platform_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- flights | hotels | tours | transfers | site | general
  required_plan_flag TEXT, -- e.g. allow_flights, allow_ai_copy; null = available to all plans
  rollout_mode TEXT NOT NULL DEFAULT 'opt_in' CHECK (rollout_mode IN ('auto', 'opt_in', 'staged')),
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_feature_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES public.platform_features(feature_key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  acknowledged BOOLEAN NOT NULL DEFAULT false, -- tenant has seen it in What's New
  enabled_at TIMESTAMPTZ,
  enabled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_feature_status_tenant ON public.tenant_feature_status(tenant_id);

ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_status ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read the catalog (needed to render What's New)
CREATE POLICY "platform_features readable by authenticated"
ON public.platform_features FOR SELECT TO authenticated USING (true);

-- Only super admins manage the catalog
CREATE POLICY "platform_features managed by super admin"
ON public.platform_features FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Tenants see their own status; super admins see all
CREATE POLICY "tenant_feature_status visible to tenant or super admin"
ON public.tenant_feature_status FOR SELECT TO authenticated
USING (
  public.is_tenant_member(tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Tenant admins (and super admins) toggle their own
CREATE POLICY "tenant_feature_status managed by tenant admin"
ON public.tenant_feature_status FOR ALL TO authenticated
USING (
  public.is_tenant_admin_of(tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.is_tenant_admin_of(tenant_id)
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE TRIGGER update_platform_features_updated_at
BEFORE UPDATE ON public.platform_features
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_feature_status_updated_at
BEFORE UPDATE ON public.tenant_feature_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolves whether a feature is enabled for a tenant given plan + rollout mode + tenant override.
CREATE OR REPLACE FUNCTION public.is_feature_enabled_for_tenant(_tenant_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature RECORD;
  v_modules JSONB;
  v_plan_ok BOOLEAN := true;
  v_status RECORD;
BEGIN
  SELECT * INTO v_feature FROM public.platform_features WHERE feature_key = _feature_key AND is_active = true;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Plan gating
  IF v_feature.required_plan_flag IS NOT NULL THEN
    v_modules := public.get_tenant_modules(_tenant_id);
    v_plan_ok := COALESCE((v_modules ->> v_feature.required_plan_flag)::boolean, false);
  END IF;
  IF NOT v_plan_ok THEN RETURN false; END IF;

  SELECT * INTO v_status FROM public.tenant_feature_status
   WHERE tenant_id = _tenant_id AND feature_key = _feature_key;

  IF FOUND THEN
    RETURN v_status.enabled;
  END IF;

  -- No row yet → fall back to rollout mode
  IF v_feature.rollout_mode = 'auto' THEN
    RETURN COALESCE(v_feature.default_enabled, true);
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- Seed core feature flags so the system has a starting catalog.
INSERT INTO public.platform_features (feature_key, display_name, description, category, required_plan_flag, rollout_mode, default_enabled)
VALUES
  ('flights_search', 'Flight Search', 'Live flight search and booking on the tenant site.', 'flights', 'flights', 'auto', true),
  ('hotels_search', 'Hotel Search', 'Hotel search, results and booking funnel.', 'hotels', 'hotels', 'auto', true),
  ('tours_search', 'Tours & Activities', 'Activity catalog and booking flow.', 'tours', 'tours', 'auto', true),
  ('transfers_search', 'Airport Transfers', 'Ground transport search and booking.', 'transfers', 'transfers', 'auto', true),
  ('ai_copy_polish', 'AI Copy Enhancer', 'Polishes hero / about / CTA copy in the brand voice after launch.', 'site', 'ai_copy', 'auto', true),
  ('custom_domain', 'Custom Domain', 'Connect your own domain to the tenant site.', 'site', 'custom_domain', 'opt_in', false)
ON CONFLICT (feature_key) DO NOTHING;