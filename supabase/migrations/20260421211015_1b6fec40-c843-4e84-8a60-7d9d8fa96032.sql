-- Phase 0c: Drop legacy site-builder tables. The codebase no longer references
-- any of these (cleanup happened in Phase 0b). The new system uses
-- tenant_skin_config, tenant_page_composition, tenant_site_snapshots and
-- block_library exclusively.

-- Drop affiliate site tables
DROP TABLE IF EXISTS public.affiliate_sites CASCADE;

-- Drop custom site tables
DROP TABLE IF EXISTS public.custom_site_generation_logs CASCADE;
DROP TABLE IF EXISTS public.custom_site_leads CASCADE;
DROP TABLE IF EXISTS public.custom_site_pages CASCADE;
DROP TABLE IF EXISTS public.custom_sites CASCADE;

-- Drop whitelabel cluster (28 tables) — order matters; CASCADE handles FKs
DROP TABLE IF EXISTS public.whitelabel_sub_affiliate_clicks CASCADE;
DROP TABLE IF EXISTS public.whitelabel_sub_affiliate_conversions CASCADE;
DROP TABLE IF EXISTS public.whitelabel_sub_affiliate_payouts CASCADE;
DROP TABLE IF EXISTS public.whitelabel_sub_affiliate_product_rates CASCADE;
DROP TABLE IF EXISTS public.whitelabel_sub_affiliate_volume_tiers CASCADE;
DROP TABLE IF EXISTS public.whitelabel_sub_affiliates CASCADE;
DROP TABLE IF EXISTS public.whitelabel_announcements CASCADE;
DROP TABLE IF EXISTS public.whitelabel_assets CASCADE;
DROP TABLE IF EXISTS public.whitelabel_content_blocks CASCADE;
DROP TABLE IF EXISTS public.whitelabel_coupons CASCADE;
DROP TABLE IF EXISTS public.whitelabel_faqs CASCADE;
DROP TABLE IF EXISTS public.whitelabel_leads CASCADE;
DROP TABLE IF EXISTS public.whitelabel_navigation CASCADE;
DROP TABLE IF EXISTS public.whitelabel_offers CASCADE;
DROP TABLE IF EXISTS public.whitelabel_page_versions CASCADE;
DROP TABLE IF EXISTS public.whitelabel_page_templates CASCADE;
DROP TABLE IF EXISTS public.whitelabel_pages CASCADE;
DROP TABLE IF EXISTS public.whitelabel_purchases CASCADE;
DROP TABLE IF EXISTS public.whitelabel_section_registry CASCADE;
DROP TABLE IF EXISTS public.whitelabel_site_domains CASCADE;
DROP TABLE IF EXISTS public.whitelabel_testimonials CASCADE;
DROP TABLE IF EXISTS public.whitelabel_themes_v2 CASCADE;
DROP TABLE IF EXISTS public.whitelabel_sites CASCADE;

-- Drop the now-orphan trigger function for the whitelabel_site_domains table
DROP FUNCTION IF EXISTS public.ensure_single_primary_wl_domain() CASCADE;