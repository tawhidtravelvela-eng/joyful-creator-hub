-- Track which service a page was auto-generated for (null = manual page)
ALTER TABLE public.custom_site_pages
  ADD COLUMN IF NOT EXISTS auto_service text,
  ADD COLUMN IF NOT EXISTS auto_generated_at timestamptz;

-- One auto-generated page per service per site
CREATE UNIQUE INDEX IF NOT EXISTS custom_site_pages_site_auto_service_uniq
  ON public.custom_site_pages (site_id, auto_service)
  WHERE auto_service IS NOT NULL;

-- Allowed services
ALTER TABLE public.custom_site_pages
  DROP CONSTRAINT IF EXISTS custom_site_pages_auto_service_check;
ALTER TABLE public.custom_site_pages
  ADD CONSTRAINT custom_site_pages_auto_service_check
  CHECK (auto_service IS NULL OR auto_service IN ('flights','hotels','tours','transfers'));