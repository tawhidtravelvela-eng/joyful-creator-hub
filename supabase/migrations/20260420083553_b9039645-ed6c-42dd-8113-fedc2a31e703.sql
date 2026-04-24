-- Phase 1: White-label booking platform foundation
-- Add platform-controlled and WL-admin-controlled config to whitelabel_themes_v2

ALTER TABLE public.whitelabel_themes_v2
  -- Platform-locked
  ADD COLUMN IF NOT EXISTS allowed_currency text NOT NULL DEFAULT 'USD',
  -- WL-admin controlled
  ADD COLUMN IF NOT EXISTS payment_gateway_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS markup_rules jsonb NOT NULL DEFAULT '{"flights":{"type":"percent","value":0},"hotels":{"type":"percent","value":0},"tours":{"type":"percent","value":0},"transfers":{"type":"percent","value":0}}'::jsonb,
  ADD COLUMN IF NOT EXISTS affiliate_program_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS module_visibility jsonb NOT NULL DEFAULT '{"flights":true,"hotels":true,"tours":true,"transfers":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS layout_variants jsonb NOT NULL DEFAULT '{"results":"list","detail":"standard","checkout":"single"}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_css_advanced text,
  ADD COLUMN IF NOT EXISTS show_powered_by boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 5.0;

COMMENT ON COLUMN public.whitelabel_themes_v2.allowed_currency IS 'Locked by platform admin. WL site can ONLY transact in this currency.';
COMMENT ON COLUMN public.whitelabel_themes_v2.payment_gateway_overrides IS 'WL admin selection from platform-available gateways. Shape: {"stripe":true,"bank":true,"bkash":false}';
COMMENT ON COLUMN public.whitelabel_themes_v2.markup_rules IS 'WL admin display-time markup per module. {"flights":{"type":"percent|flat","value":N}}';
COMMENT ON COLUMN public.whitelabel_themes_v2.module_visibility IS 'WL admin module on/off. Hidden modules return 404 in WL routing.';
COMMENT ON COLUMN public.whitelabel_themes_v2.layout_variants IS 'WL admin layout choice per module: results=list|grid|map, checkout=single|multi.';
COMMENT ON COLUMN public.whitelabel_themes_v2.affiliate_program_enabled IS 'WL admin toggle. When false, /affiliate routes return 404 inside this WL.';