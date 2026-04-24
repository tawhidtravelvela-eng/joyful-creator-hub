-- Tenant policies (AI-drafted, tenant-reviewed)
CREATE TABLE IF NOT EXISTS public.tenant_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_kind TEXT NOT NULL CHECK (policy_kind IN ('refund','cancellation','terms','payment','support','privacy')),
  title TEXT NOT NULL,
  -- Draft = AI output, editable. Published = live copy shown on site/checkout/emails.
  draft_md TEXT,
  published_md TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version INT NOT NULL DEFAULT 1,
  -- AI generation metadata
  last_generated_at TIMESTAMPTZ,
  last_generated_by UUID,
  generation_model TEXT,
  generation_input JSONB DEFAULT '{}'::jsonb,
  -- Publishing metadata
  published_at TIMESTAMPTZ,
  published_by UUID,
  -- Display
  slug TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  show_in_footer BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_kind)
);

CREATE INDEX IF NOT EXISTS idx_tenant_policies_tenant ON public.tenant_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_policies_published ON public.tenant_policies(tenant_id, status) WHERE status = 'published';

ALTER TABLE public.tenant_policies ENABLE ROW LEVEL SECURITY;

-- Public can read PUBLISHED policies (for rendering on custom sites + checkout)
CREATE POLICY "Published policies are public"
ON public.tenant_policies
FOR SELECT
USING (status = 'published');

-- Tenant admins can read all their own tenant's policies (incl. drafts)
CREATE POLICY "Tenant admins read own policies"
ON public.tenant_policies
FOR SELECT
TO authenticated
USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins insert own policies"
ON public.tenant_policies
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins update own policies"
ON public.tenant_policies
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins delete own policies"
ON public.tenant_policies
FOR DELETE
TO authenticated
USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_tenant_policies_updated
BEFORE UPDATE ON public.tenant_policies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();