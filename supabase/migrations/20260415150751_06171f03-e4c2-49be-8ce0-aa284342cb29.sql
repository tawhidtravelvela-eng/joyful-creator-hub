
CREATE TABLE public.commission_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module TEXT NOT NULL DEFAULT 'flights' CHECK (module IN ('flights', 'hotels', 'tours')),
  api_provider TEXT NOT NULL DEFAULT 'travelport',
  carrier_code TEXT NOT NULL DEFAULT '',
  origin TEXT DEFAULT '',
  commission_type TEXT NOT NULL DEFAULT 'commission' CHECK (commission_type IN ('commission', 'discount')),
  profit_type TEXT NOT NULL DEFAULT 'percentage' CHECK (profit_type IN ('percentage', 'fixed')),
  amount NUMERIC NOT NULL DEFAULT 0,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage commission rules"
  ON public.commission_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_commission_rules_module ON public.commission_rules(module);
CREATE INDEX idx_commission_rules_provider ON public.commission_rules(api_provider);
CREATE INDEX idx_commission_rules_tenant ON public.commission_rules(tenant_id);
