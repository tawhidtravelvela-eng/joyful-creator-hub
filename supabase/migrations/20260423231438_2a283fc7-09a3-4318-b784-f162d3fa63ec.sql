-- Variant engine — phase 1: scaffolding for skin-scoped layout variants.
--
-- 1. block_library.audience_tags already exists (verified). Add a default
--    if missing so existing rows can be queried by skin audience filters.
-- 2. tenant_skin_config.section_variant_overrides already exists as jsonb;
--    we keep it untouched here. This migration only adds two new columns
--    needed for the AI re-generation safety net:
--       - locked_variants jsonb  (per block_key → bool, prevents AI overwrite)
--       - locked_content  jsonb  (per block_key → list of locked field paths)
-- 3. skin_definitions.variant_whitelist jsonb — designer-curated list of
--    allowed variant keys per block_key, scoped to that skin.

ALTER TABLE public.tenant_skin_config
  ADD COLUMN IF NOT EXISTS locked_variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS locked_content  jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.skin_definitions
  ADD COLUMN IF NOT EXISTS variant_whitelist jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenant_skin_config.locked_variants IS
  'Per-block layout-variant locks. Shape: { "<block_key>": true } — when true, AI re-runs (logo change, reskin) must not overwrite the tenant''s manual choice.';

COMMENT ON COLUMN public.tenant_skin_config.locked_content IS
  'Per-block content field locks. Shape: { "<block_key>": ["headline", "subtitle"] } — listed fields are protected from AI re-generation.';

COMMENT ON COLUMN public.skin_definitions.variant_whitelist IS
  'Designer-curated map of allowed layout variants per block. Shape: { "<block_key>": { "allowed": ["variantA", "variantB"], "default": "variantA" } }. AI may only pick variants from "allowed".';