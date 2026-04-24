ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS b2b_landing_slug text NOT NULL DEFAULT 'partners',
  ADD COLUMN IF NOT EXISTS show_partner_cta_on_home boolean NOT NULL DEFAULT true;

-- Ensure the slug is URL-safe & non-empty (lowercase letters, numbers, hyphens)
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_b2b_landing_slug_format;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_b2b_landing_slug_format
  CHECK (b2b_landing_slug ~ '^[a-z0-9][a-z0-9-]{0,40}$');