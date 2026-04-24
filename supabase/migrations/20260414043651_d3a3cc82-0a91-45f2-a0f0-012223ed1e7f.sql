
-- Add tenant linkage columns to b2b_access_requests
ALTER TABLE public.b2b_access_requests
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_tenant_name text;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_b2b_access_requests_tenant_id ON public.b2b_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_b2b_access_requests_status ON public.b2b_access_requests(status);
