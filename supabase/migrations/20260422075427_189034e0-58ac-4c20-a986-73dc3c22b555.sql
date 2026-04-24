INSERT INTO public.ai_task_configs (task_key, task_label, task_category, provider, model, temperature, max_tokens, enabled, description)
VALUES (
  'studio-ai-rebuild-site',
  'Studio · Rebuild Site',
  'studio',
  'lovable',
  'google/gemini-2.5-flash',
  0.7,
  4096,
  true,
  'Full homepage rebuild from updated brand inputs. Picks skin + block stack + fresh hero copy. 50 credits.'
)
ON CONFLICT (task_key) DO NOTHING;