-- Make tenants.domain nullable so a tenant can exist without any connected
-- domain (the dashboard will prompt them to connect their own).
ALTER TABLE public.tenants ALTER COLUMN domain DROP NOT NULL;

-- Clear stale platform subdomains and any *.lovable.* values from
-- tenants.domain. Tenants must connect their own custom domain.
UPDATE public.tenants
SET domain = NULL
WHERE domain ILIKE '%.travelvela.com'
   OR domain = 'travelvela.com'
   OR domain ILIKE '%.lovable.app'
   OR domain ILIKE '%.lovableproject.com';