
ALTER TABLE public.whitelabel_sites 
ADD COLUMN IF NOT EXISTS design_config jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS layout_template text DEFAULT 'classic',
ADD COLUMN IF NOT EXISTS font_heading text DEFAULT 'DM Serif Display',
ADD COLUMN IF NOT EXISTS font_body text DEFAULT 'Plus Jakarta Sans',
ADD COLUMN IF NOT EXISTS border_radius text DEFAULT '0.75rem',
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#ff6b2c',
ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS sections_config jsonb DEFAULT '{"hero": true, "stats": true, "destinations": true, "offers": true, "testimonials": true, "newsletter": true, "trending_flights": true, "blog": false}'::jsonb,
ADD COLUMN IF NOT EXISTS ai_brand_description text DEFAULT '';
