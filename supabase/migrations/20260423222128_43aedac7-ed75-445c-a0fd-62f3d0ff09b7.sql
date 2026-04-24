CREATE TABLE IF NOT EXISTS public.platform_module_settings (
  module_key   text PRIMARY KEY,
  is_enabled   boolean NOT NULL DEFAULT true,
  display_name text NOT NULL,
  notes        text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid
);

ALTER TABLE public.platform_module_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_modules_public_read" ON public.platform_module_settings;
CREATE POLICY "platform_modules_public_read"
  ON public.platform_module_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "platform_modules_admin_write" ON public.platform_module_settings;
CREATE POLICY "platform_modules_admin_write"
  ON public.platform_module_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_platform_module_settings_updated_at ON public.platform_module_settings;
CREATE TRIGGER trg_platform_module_settings_updated_at
  BEFORE UPDATE ON public.platform_module_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_module_settings (module_key, display_name, is_enabled)
VALUES
  ('flights',   'Flights',   true),
  ('hotels',    'Hotels',    true),
  ('tours',     'Tours',     true),
  ('transfers', 'Transfers', true),
  ('blog',      'Blog',      true)
ON CONFLICT (module_key) DO NOTHING;