-- Reset the Mahabub tenant's hybrid-full homepage composition to the canonical 6-block stack.
-- Drift cleanup: remove references to the deprecated hybrid-only blocks
-- (hero.hybrid-split, feature.dual-track, feature.agent-benefits, cta.agent-signup-rich, stat.bar)
-- and use only the canonical platform blocks.

UPDATE public.tenant_page_composition
SET block_instances = '[
  {"block_key":"hero.search-mixed"},
  {"block_key":"trending.flights"},
  {"block_key":"destination.popular"},
  {"block_key":"feature.why-choose-us"},
  {"block_key":"cta.agent-signup"},
  {"block_key":"newsletter.signup"}
]'::jsonb,
updated_at = now()
WHERE tenant_id = '7553b271-bb8f-41e6-adb9-a57bbf4c962d'
  AND page_slug = 'home';

-- Also remove the deprecated hybrid-only blocks from the block_library
-- so they no longer appear in the Studio block picker.
DELETE FROM public.block_library
WHERE block_key IN (
  'hero.hybrid-split',
  'feature.dual-track',
  'feature.agent-benefits',
  'cta.agent-signup-rich'
);