UPDATE public.skin_definitions
SET variant_whitelist = jsonb_set(
  COALESCE(variant_whitelist, '{}'::jsonb),
  '{hero.search-mixed}',
  jsonb_build_object(
    'allowed', jsonb_build_array('cinematic', 'editorial-split'),
    'default', 'cinematic'
  ),
  true
)
WHERE skin_key = 'hybrid-full';