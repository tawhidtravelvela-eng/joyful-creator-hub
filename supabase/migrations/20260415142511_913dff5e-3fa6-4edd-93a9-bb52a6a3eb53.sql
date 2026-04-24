
-- SMTP configurations: global default (tenant_id IS NULL) + per-tenant overrides
CREATE TABLE public.smtp_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Default',
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  encryption TEXT NOT NULL DEFAULT 'tls' CHECK (encryption IN ('tls', 'ssl', 'none')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active global default allowed
CREATE UNIQUE INDEX idx_smtp_global_default ON public.smtp_configurations (tenant_id) WHERE tenant_id IS NULL AND is_active = true;
-- Only one active config per tenant
CREATE UNIQUE INDEX idx_smtp_tenant_unique ON public.smtp_configurations (tenant_id) WHERE tenant_id IS NOT NULL AND is_active = true;

ALTER TABLE public.smtp_configurations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SMTP configs
CREATE POLICY "Admins can manage SMTP configs"
  ON public.smtp_configurations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_smtp_configurations_updated_at
  BEFORE UPDATE ON public.smtp_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
