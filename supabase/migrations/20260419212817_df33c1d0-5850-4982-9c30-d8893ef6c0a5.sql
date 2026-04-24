
-- Affiliate-scoped domains table for B2B Custom Website hub
-- Multiple domains per site allowed (subdomain + custom + extras), one is primary

CREATE TABLE IF NOT EXISTS public.whitelabel_site_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  domain_type TEXT NOT NULL DEFAULT 'subdomain', -- 'subdomain' | 'custom_domain'
  is_primary BOOLEAN NOT NULL DEFAULT false,
  cf_status TEXT NOT NULL DEFAULT 'pending_dns', -- 'pending_dns' | 'verifying' | 'active' | 'failed' | 'removed'
  cf_details JSONB,
  ssl_status TEXT, -- 'pending' | 'active' | 'failed'
  verified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain)
);

CREATE INDEX IF NOT EXISTS idx_wl_site_domains_affiliate ON public.whitelabel_site_domains(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_site_domains_primary ON public.whitelabel_site_domains(affiliate_id, is_primary) WHERE is_primary = true;

ALTER TABLE public.whitelabel_site_domains ENABLE ROW LEVEL SECURITY;

-- Owner policies (use existing is_affiliate_owner helper)
CREATE POLICY "Affiliate owners can view their domains"
  ON public.whitelabel_site_domains FOR SELECT
  USING (public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Affiliate owners can insert their domains"
  ON public.whitelabel_site_domains FOR INSERT
  WITH CHECK (public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Affiliate owners can update their domains"
  ON public.whitelabel_site_domains FOR UPDATE
  USING (public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Affiliate owners can delete their domains"
  ON public.whitelabel_site_domains FOR DELETE
  USING (public.is_affiliate_owner(affiliate_id));

-- Admins can do everything
CREATE POLICY "Admins manage all whitelabel site domains"
  ON public.whitelabel_site_domains FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public read for domain resolution (needed by site renderer)
CREATE POLICY "Public can read active domains for site resolution"
  ON public.whitelabel_site_domains FOR SELECT
  USING (cf_status = 'active');

-- updated_at trigger
CREATE TRIGGER set_wl_site_domains_updated
BEFORE UPDATE ON public.whitelabel_site_domains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to ensure only one primary per affiliate
CREATE OR REPLACE FUNCTION public.ensure_single_primary_wl_domain()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.whitelabel_site_domains
    SET is_primary = false
    WHERE affiliate_id = NEW.affiliate_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_primary_wl_domain
AFTER INSERT OR UPDATE OF is_primary ON public.whitelabel_site_domains
FOR EACH ROW WHEN (NEW.is_primary = true)
EXECUTE FUNCTION public.ensure_single_primary_wl_domain();
