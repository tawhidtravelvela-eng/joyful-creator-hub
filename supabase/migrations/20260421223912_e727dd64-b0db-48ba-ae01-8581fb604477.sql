INSERT INTO public.ai_task_configs (
  task_key, task_label, task_category, provider, model,
  fallback_chain, temperature, max_tokens, enabled, is_locked, description
)
VALUES (
  'studio-ai-compose',
  'Studio — AI Compose Page',
  'whitelabel',
  'lovable',
  'google/gemini-2.5-flash',
  '[
    {"provider":"lovable","model":"google/gemini-3-flash-preview"},
    {"provider":"google","model":"gemini-2.5-flash"},
    {"provider":"lovable","model":"openai/gpt-5-mini"},
    {"provider":"openai","model":"gpt-4.1-mini"}
  ]'::jsonb,
  0.6,
  3000,
  true,
  false,
  'Composes a tenant homepage from a free-text prompt: picks the best skin and ordered block stack, fills hero copy. Used by the Studio AI Compose button.'
)
ON CONFLICT (task_key) DO UPDATE
  SET task_label = EXCLUDED.task_label,
      task_category = EXCLUDED.task_category,
      description = EXCLUDED.description,
      updated_at = now();