-- AI task configurations: one row per AI task in the platform
CREATE TABLE IF NOT EXISTS public.ai_task_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL UNIQUE,
  task_label text NOT NULL,
  task_category text NOT NULL DEFAULT 'general',
  description text,
  provider text NOT NULL DEFAULT 'lovable',
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  fallback_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  temperature numeric(3,2) DEFAULT 0.7,
  max_tokens integer DEFAULT 4096,
  enabled boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_task_configs_key ON public.ai_task_configs(task_key);
CREATE INDEX IF NOT EXISTS idx_ai_task_configs_category ON public.ai_task_configs(task_category);

-- Provider key registry — references secret names; actual values live in Supabase Vault / env
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  secret_name text NOT NULL,
  base_url text,
  is_configured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_task_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

-- Admins manage both tables
CREATE POLICY "Admins manage ai_task_configs"
  ON public.ai_task_configs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage ai_provider_keys"
  ON public.ai_provider_keys FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_ai_task_configs_updated
  BEFORE UPDATE ON public.ai_task_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ai_provider_keys_updated
  BEFORE UPDATE ON public.ai_provider_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed providers
INSERT INTO public.ai_provider_keys (provider, display_name, secret_name, base_url, is_configured, is_active, notes) VALUES
  ('lovable',   'Lovable AI Gateway', 'LOVABLE_API_KEY',    'https://ai.gateway.lovable.dev/v1/chat/completions',                 true,  true, 'Default gateway. Models: google/gemini-3-flash-preview, gemini-2.5-pro, gpt-5, gpt-5-mini, etc.'),
  ('google',    'Google Gemini',      'GOOGLE_AI_API_KEY',  'https://generativelanguage.googleapis.com/v1beta/models',            true,  true, 'Direct Gemini API. Models: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-3-flash-preview, gemini-3-flash-lite, gemini-2.0-flash-lite, etc.'),
  ('openai',    'OpenAI Direct',      'OPENAI_API_KEY',     'https://api.openai.com/v1/chat/completions',                         true,  true, 'Direct OpenAI. Models: gpt-5, gpt-5-mini, gpt-5-nano, gpt-4o, gpt-4o-mini.'),
  ('anthropic', 'Anthropic Claude',   'ANTHROPIC_API_KEY',  'https://api.anthropic.com/v1/messages',                              true,  true, 'Direct Anthropic. Models: claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5.')
ON CONFLICT (provider) DO NOTHING;

-- Seed AI tasks
INSERT INTO public.ai_task_configs (task_key, task_label, task_category, description, provider, model, fallback_chain, temperature, max_tokens) VALUES
  ('trip-planner-generate',  'Trip Planner — Itinerary Generation', 'trip-planner', 'Generates the day-by-day itinerary structure', 'lovable', 'google/gemini-3-flash-preview', '[{"provider":"google","model":"gemini-2.5-flash"},{"provider":"lovable","model":"openai/gpt-5-mini"}]'::jsonb, 0.7, 8192),
  ('trip-planner-extract',   'Trip Planner — Intent Extraction',    'trip-planner', 'Extracts cities, dates, travelers from chat',  'lovable', 'google/gemini-3-flash-preview', '[{"provider":"google","model":"gemini-2.5-flash-lite"}]'::jsonb, 0.2, 2048),
  ('trip-planner-match',     'Trip Planner — Activity Match',        'trip-planner', 'Matches AI activities to bookable products',   'lovable', 'google/gemini-3-flash-preview', '[]'::jsonb, 0.3, 4096),
  ('trip-planner-learner',   'Trip Planner — Learning Loop',         'trip-planner', 'Learns from booking outcomes',                  'lovable', 'google/gemini-2.5-flash-lite', '[]'::jsonb, 0.4, 2048),
  ('flight-insights',        'Flight Insights — AI Pick + Rationale','flights',      'Reranks flights and writes pricing insights',  'lovable', 'google/gemini-3-flash-preview', '[{"provider":"google","model":"gemini-2.5-flash"}]'::jsonb, 0.5, 1024),
  ('blog-writer',            'Blog — Auto Post Writer',              'content',      'Writes long-form travel blog posts',            'lovable', 'openai/gpt-5-mini',             '[{"provider":"lovable","model":"google/gemini-2.5-pro"}]'::jsonb, 0.8, 8192),
  ('blog-image',             'Blog — Featured Image Prompt',         'content',      'Crafts hero image prompts',                     'lovable', 'google/gemini-3-flash-preview', '[]'::jsonb, 0.9, 512),
  ('city-intro',             'Content — City Intro Generator',       'content',      'Generates city overview text',                  'lovable', 'google/gemini-3-flash-preview', '[]'::jsonb, 0.7, 2048),
  ('passport-ocr',           'OCR — Passport Field Extraction',      'utilities',    'Extracts passport MRZ + visual fields',         'google',  'gemini-2.5-flash',              '[{"provider":"lovable","model":"google/gemini-2.5-flash"}]'::jsonb, 0.1, 500),
  ('theme-ai-chat',          'Admin — Theme AI Assistant',           'admin',        'Helps admins design themes via chat',           'lovable', 'google/gemini-3-flash-preview', '[]'::jsonb, 0.6, 4096),
  ('design-generator',       'Whitelabel — Design Generator',        'admin',        'Generates whitelabel design from prompt',       'lovable', 'google/gemini-2.5-pro',         '[{"provider":"lovable","model":"google/gemini-3-flash-preview"}]'::jsonb, 0.7, 4096),
  ('route-intelligence',     'Flights — Route Intelligence',         'flights',      'Suggests popular routes and hubs',              'lovable', 'google/gemini-2.5-flash-lite', '[]'::jsonb, 0.4, 2048)
ON CONFLICT (task_key) DO NOTHING;