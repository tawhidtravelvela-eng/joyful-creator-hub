ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS allowed_products text[] NOT NULL DEFAULT ARRAY['flights', 'hotels', 'tours'];