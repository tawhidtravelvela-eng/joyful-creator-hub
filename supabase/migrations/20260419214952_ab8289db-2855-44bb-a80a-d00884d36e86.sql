-- Track Cloudflare for SaaS Custom Hostname IDs and origin info
ALTER TABLE public.whitelabel_site_domains
  ADD COLUMN IF NOT EXISTS cf_hostname_id TEXT,
  ADD COLUMN IF NOT EXISTS cf_provider TEXT NOT NULL DEFAULT 'pages',
  ADD COLUMN IF NOT EXISTS verification_method TEXT,
  ADD COLUMN IF NOT EXISTS verification_record JSONB;

CREATE INDEX IF NOT EXISTS idx_wl_site_domains_cf_hostname_id
  ON public.whitelabel_site_domains(cf_hostname_id)
  WHERE cf_hostname_id IS NOT NULL;