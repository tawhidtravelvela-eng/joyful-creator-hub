ALTER TABLE public.custom_sites
ADD COLUMN IF NOT EXISTS brand_kit jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.custom_sites.brand_kit IS
'AI-generated brand kit: secondary_color, neutral palette, button style, icon style, banner style, brand voice adjectives + tone line. Applied on top of primary_color/font_heading/font_body.';