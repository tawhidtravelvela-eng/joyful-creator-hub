
INSERT INTO public.block_library (block_key, display_name, category, description, source_skin, audience_tags, vertical_tags, mood_tags, ai_compose_weight, density, is_active)
VALUES
  ('hero.hybrid-split', 'Hybrid Split Hero', 'hero',
   'Two-pane hero presenting the consumer storefront and partner program side-by-side.',
   'hybrid-full', ARRAY['hybrid','b2c','b2b'], ARRAY['mixed'], ARRAY['confident','dual-audience','versatile'], 9.50, 'cozy', true),
  ('feature.agent-benefits', 'Agent Benefits Grid', 'feature',
   'Six-tile feature grid showcasing the partner program value proposition (commission, wallet, sub-agents, branding, analytics, support).',
   'hybrid-full', ARRAY['hybrid','b2b'], ARRAY['mixed'], ARRAY['professional','partner-focused'], 8.00, 'cozy', true),
  ('feature.dual-track', 'Dual-Track How It Works', 'feature',
   'Side-by-side three-step flows for travelers and partners.',
   'hybrid-full', ARRAY['hybrid'], ARRAY['mixed'], ARRAY['structured','dual-audience'], 7.50, 'roomy', true),
  ('cta.agent-signup-rich', 'Rich Agent Signup CTA', 'cta',
   'Conversion-focused agent signup section with gradient panel, bullet-point reassurance and dual CTAs.',
   'hybrid-full', ARRAY['hybrid','b2b'], ARRAY['mixed'], ARRAY['conversion','partner-focused'], 9.00, 'roomy', true)
ON CONFLICT (block_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  source_skin = EXCLUDED.source_skin,
  audience_tags = EXCLUDED.audience_tags,
  vertical_tags = EXCLUDED.vertical_tags,
  mood_tags = EXCLUDED.mood_tags,
  ai_compose_weight = EXCLUDED.ai_compose_weight,
  density = EXCLUDED.density,
  is_active = EXCLUDED.is_active,
  updated_at = now();
