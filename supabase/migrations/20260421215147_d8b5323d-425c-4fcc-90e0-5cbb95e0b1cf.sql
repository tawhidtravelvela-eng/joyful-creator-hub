INSERT INTO public.ai_provider_keys (provider, display_name, secret_name, base_url, is_active, is_configured, notes)
VALUES (
  'cloudflare',
  'Cloudflare AI Gateway',
  'CLOUDFLARE_AI_GATEWAY_TOKEN',
  'https://gateway.ai.cloudflare.com/v1/5b33f9bcae48bb273b0c118925f2bfcb/vela-ai/compat/chat/completions',
  true,
  true,
  'OpenAI-compatible Universal endpoint. Models use provider-prefixed names (e.g. "openai/gpt-4o-mini", "anthropic/claude-3-5-sonnet-20241022", "google-ai-studio/gemini-2.0-flash", "workers-ai/@cf/meta/llama-3.1-8b-instruct"). Provides caching, analytics, and rate-limiting on top of upstream providers.'
)
ON CONFLICT (provider) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  secret_name = EXCLUDED.secret_name,
  base_url = EXCLUDED.base_url,
  is_active = true,
  is_configured = true,
  notes = EXCLUDED.notes,
  updated_at = now();