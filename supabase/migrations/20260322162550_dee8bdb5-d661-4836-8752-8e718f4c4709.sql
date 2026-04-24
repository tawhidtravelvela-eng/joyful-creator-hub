
-- Add product_type to whitelabel_coupons to support both whitelabel and api_access
ALTER TABLE public.whitelabel_coupons
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'whitelabel'
  CHECK (product_type IN ('whitelabel', 'api_access', 'both'));

-- Add product_type to whitelabel_purchases
ALTER TABLE public.whitelabel_purchases
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'whitelabel'
  CHECK (product_type IN ('whitelabel', 'api_access'));
