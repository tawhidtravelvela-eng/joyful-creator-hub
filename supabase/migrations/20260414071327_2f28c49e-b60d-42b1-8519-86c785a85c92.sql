
-- Add subdomain and domain management columns to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS subdomain text UNIQUE,
  ADD COLUMN IF NOT EXISTS domain_type text NOT NULL DEFAULT 'subdomain',
  ADD COLUMN IF NOT EXISTS cf_domain_status text DEFAULT 'pending';

-- Add check constraint for domain_type
ALTER TABLE public.tenants 
  ADD CONSTRAINT tenants_domain_type_check 
  CHECK (domain_type IN ('subdomain', 'custom_domain'));

-- Index for fast subdomain lookups
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants (subdomain) WHERE subdomain IS NOT NULL;
