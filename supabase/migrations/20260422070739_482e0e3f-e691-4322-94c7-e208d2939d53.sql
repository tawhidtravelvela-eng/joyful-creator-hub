-- Locked-block guardrail for AI rewrites.
-- Tenants can lock individual blocks on a page so that page-wide and
-- site-wide AI rewrites skip them, preserving manual edits.

ALTER TABLE public.tenant_page_composition
  ADD COLUMN IF NOT EXISTS locked_block_keys text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.tenant_page_composition.locked_block_keys IS
  'Block keys whose content the tenant has locked. ai-rewrite-page and ai-rewrite-site must skip these. Slot-level rewrite still works because it is an explicit user action.';
