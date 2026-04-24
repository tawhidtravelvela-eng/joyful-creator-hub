
-- Remove taxes_fees and currency_rates from the public read allowlist
DROP POLICY IF EXISTS "Public read non-sensitive api_settings" ON public.api_settings;

CREATE POLICY "Public read non-sensitive api_settings"
  ON public.api_settings
  FOR SELECT
  TO public
  USING (
    (provider = ANY (ARRAY[
      'site_branding'::text, 'site_general'::text, 'site_footer'::text,
      'site_contact'::text, 'site_social'::text, 'site_seo'::text,
      'site_payment_public'::text,
      'site_privacy_policy'::text, 'site_terms'::text, 'site_refund_policy'::text,
      'site_hero'::text, 'site_stats'::text, 'site_why_choose'::text,
      'site_newsletter'::text, 'site_app_download'::text,
      'site_trending'::text, 'site_blog_section'::text
    ]))
    OR has_role(auth.uid(), 'admin'::app_role)
  );
