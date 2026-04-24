-- Drop subdomain concept from tenants and affiliate sites.
-- Tenants now connect ONLY via custom domains.

-- 1. tenants: drop subdomain + domain_type + cf_domain_status
ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS subdomain,
  DROP COLUMN IF EXISTS domain_type,
  DROP COLUMN IF EXISTS cf_domain_status;

-- 2. affiliate_sites: drop subdomain (keep custom_domain only)
ALTER TABLE public.affiliate_sites
  DROP COLUMN IF EXISTS subdomain;

-- 3. whitelabel_sites: drop subdomain
ALTER TABLE public.whitelabel_sites
  DROP COLUMN IF EXISTS subdomain;

-- 4. whitelabel_site_domains: remove any rows of type 'subdomain'
DELETE FROM public.whitelabel_site_domains WHERE domain_type = 'subdomain';

-- Then drop the domain_type column entirely (only custom domains exist now).
ALTER TABLE public.whitelabel_site_domains
  DROP COLUMN IF EXISTS domain_type;