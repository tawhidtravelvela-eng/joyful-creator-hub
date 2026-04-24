
-- 1. Remove site_payment from the public whitelist
DROP POLICY IF EXISTS "Public read non-sensitive api_settings" ON public.api_settings;

CREATE POLICY "Public read non-sensitive api_settings"
  ON public.api_settings FOR SELECT
  TO public
  USING (
    provider IN (
      'site_branding', 'site_general', 'site_footer', 'site_contact',
      'site_social', 'site_seo', 'site_payment_public', 'currency_rates',
      'taxes_fees', 'site_privacy_policy', 'site_terms', 'site_refund_policy',
      'site_hero', 'site_stats', 'site_why_choose', 'site_newsletter',
      'site_app_download', 'site_trending', 'site_blog_section'
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. Create a public-safe payment config row (only boolean flags, no credentials)
INSERT INTO public.api_settings (provider, is_active, settings)
VALUES (
  'site_payment_public',
  true,
  '{
    "stripe_enabled": true,
    "bkash_enabled": false,
    "nagad_enabled": false,
    "alipay_enabled": false,
    "airwallex_enabled": false,
    "bank_transfer_enabled": true
  }'::jsonb
)
ON CONFLICT DO NOTHING;
