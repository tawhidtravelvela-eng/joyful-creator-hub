
-- White-label sites table for affiliate program
CREATE TABLE public.whitelabel_sites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  site_name text NOT NULL DEFAULT '',
  subdomain text NOT NULL UNIQUE,
  custom_domain text DEFAULT '',
  logo_url text DEFAULT '',
  primary_color text DEFAULT '#0066FF',
  secondary_color text DEFAULT '#1a1a2e',
  hero_tagline text DEFAULT 'Find the best travel deals',
  contact_email text DEFAULT '',
  commission_rate numeric NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'pending',
  is_active boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whitelabel_sites ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin manage whitelabel_sites"
  ON public.whitelabel_sites FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Affiliates manage own whitelabel site"
  ON public.whitelabel_sites FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = whitelabel_sites.affiliate_id AND a.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = whitelabel_sites.affiliate_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Public read active whitelabel sites"
  ON public.whitelabel_sites FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND status = 'approved');

-- Index for subdomain lookups
CREATE INDEX idx_whitelabel_sites_subdomain ON public.whitelabel_sites(subdomain);
CREATE INDEX idx_whitelabel_sites_affiliate ON public.whitelabel_sites(affiliate_id);
