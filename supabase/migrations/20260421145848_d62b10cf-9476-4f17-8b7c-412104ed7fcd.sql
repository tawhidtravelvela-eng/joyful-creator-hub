ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_color text,
  ADD COLUMN IF NOT EXISTS brand_color_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.brand_color IS 'Hex color (e.g. #1f6feb) auto-extracted from the agent''s logo and used to theme their B2B dashboard.';
COMMENT ON COLUMN public.profiles.brand_color_locked IS 'When true, brand_color is user-overridden and should not be auto-overwritten when the logo changes.';