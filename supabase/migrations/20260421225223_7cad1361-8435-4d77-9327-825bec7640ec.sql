INSERT INTO public.ai_task_configs (
  task_key, task_label, task_category, provider, model,
  fallback_chain, temperature, max_tokens, enabled, is_locked, description
)
VALUES
(
  'studio-ai-rewrite-slot',
  'Studio — Rewrite single slot',
  'whitelabel',
  'lovable',
  'google/gemini-2.5-flash',
  '[
    {"provider":"lovable","model":"google/gemini-3-flash-preview"},
    {"provider":"google","model":"gemini-2.5-flash"},
    {"provider":"lovable","model":"openai/gpt-5-mini"},
    {"provider":"openai","model":"gpt-4.1-mini"}
  ]'::jsonb,
  0.7, 400, true, false,
  'Rewrites a single field on a single block (headline, CTA, etc). Costs 1 credit.'
),
(
  'studio-ai-rewrite-page',
  'Studio — Rewrite all copy on a page',
  'whitelabel',
  'lovable',
  'google/gemini-2.5-flash',
  '[
    {"provider":"lovable","model":"google/gemini-3-flash-preview"},
    {"provider":"google","model":"gemini-2.5-flash"},
    {"provider":"lovable","model":"openai/gpt-5-mini"},
    {"provider":"openai","model":"gpt-4.1-mini"}
  ]'::jsonb,
  0.65, 3000, true, false,
  'Batch-rewrites every editable field across every block on a page. Costs 5 credits.'
),
(
  'studio-ai-rewrite-site',
  'Studio — Rewrite copy across whole site',
  'whitelabel',
  'lovable',
  'google/gemini-2.5-flash',
  '[
    {"provider":"lovable","model":"google/gemini-3-flash-preview"},
    {"provider":"google","model":"gemini-2.5-flash"},
    {"provider":"lovable","model":"openai/gpt-5-mini"},
    {"provider":"openai","model":"gpt-4.1-mini"}
  ]'::jsonb,
  0.6, 6000, true, false,
  'Rewrites copy across every page composition for a tenant. Auto-snapshots first. Costs 30 credits.'
)
ON CONFLICT (task_key) DO UPDATE
  SET task_label = EXCLUDED.task_label,
      task_category = EXCLUDED.task_category,
      description = EXCLUDED.description,
      max_tokens = EXCLUDED.max_tokens,
      updated_at = now();