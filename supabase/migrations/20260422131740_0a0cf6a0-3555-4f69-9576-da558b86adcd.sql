INSERT INTO public.block_library (
  block_key, display_name, description, category,
  audience_tags, vertical_tags, mood_tags,
  source_skin, ai_compose_weight, is_active
) VALUES (
  'deals.tabbed-from-city',
  'Tabbed Deals from User City',
  'Auto-detects the visitor''s origin city and shows tabbed deals (Flights / Hotels / Tours / Visa / Transfers) backed by cached data with curated fallbacks.',
  'trending',
  ARRAY['b2c','hybrid'],
  ARRAY['general','mixed','flights','hotels','tours'],
  ARRAY['conversion','localized','tabbed'],
  'hybrid-full',
  0.9,
  true
)
ON CONFLICT (block_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  audience_tags = EXCLUDED.audience_tags,
  vertical_tags = EXCLUDED.vertical_tags,
  mood_tags = EXCLUDED.mood_tags,
  is_active = true,
  updated_at = now();

UPDATE public.tenant_page_composition
SET block_instances = '[
  {"block_key":"hero.search-mixed"},
  {"block_key":"stat.bar"},
  {"block_key":"deals.tabbed-from-city"},
  {"block_key":"destination.popular"},
  {"block_key":"feature.why-choose-us"},
  {"block_key":"cta.agent-signup"},
  {"block_key":"testimonial.standard"},
  {"block_key":"newsletter.signup"}
]'::jsonb,
updated_at = now()
WHERE tenant_id = '7553b271-bb8f-41e6-adb9-a57bbf4c962d'
  AND page_slug = 'home';