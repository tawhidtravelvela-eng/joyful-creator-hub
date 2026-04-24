-- ============================================================================
-- B2B Custom Website — Plan & Privilege Foundation
-- ============================================================================

-- 1. Plans catalogue (admin-managed tiers)
CREATE TABLE IF NOT EXISTS public.b2b_plans (
  plan_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Module privileges
  allow_flights BOOLEAN NOT NULL DEFAULT false,
  allow_hotels BOOLEAN NOT NULL DEFAULT true,
  allow_tours BOOLEAN NOT NULL DEFAULT false,
  allow_transfers BOOLEAN NOT NULL DEFAULT false,

  -- Custom Website features
  allow_custom_domain BOOLEAN NOT NULL DEFAULT false,
  allow_ai_copy BOOLEAN NOT NULL DEFAULT false,
  allow_remove_branding BOOLEAN NOT NULL DEFAULT false,
  max_pages INTEGER NOT NULL DEFAULT 5,
  max_section_variants INTEGER NOT NULL DEFAULT 2,

  -- Pricing (display only; billing handled elsewhere)
  monthly_price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  yearly_price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_plans ENABLE ROW LEVEL SECURITY;

-- Plans are readable by everyone (so tenants see what they can upgrade to)
CREATE POLICY "Plans are viewable by all authenticated users"
  ON public.b2b_plans FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin / admin can write
CREATE POLICY "Admins manage plans"
  ON public.b2b_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER trg_b2b_plans_updated_at
  BEFORE UPDATE ON public.b2b_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed default plans
INSERT INTO public.b2b_plans
  (plan_key, display_name, description, sort_order,
   allow_flights, allow_hotels, allow_tours, allow_transfers,
   allow_custom_domain, allow_ai_copy, allow_remove_branding,
   max_pages, max_section_variants,
   monthly_price_usd, yearly_price_usd)
VALUES
  ('starter',    'Starter',    'Hotels-only Custom Website on a Travelvela subdomain.',
    10, false, true,  false, false, false, false, false, 5,  2,  0,    0),
  ('pro',        'Pro',        'Flights + Hotels + Tours, AI copy assist, custom domain.',
    20, true,  true,  true,  false, true,  true,  false, 15, 4,  49,   490),
  ('enterprise', 'Enterprise', 'All modules, all variants, white-label branding removed, priority support.',
    30, true,  true,  true,  true,  true,  true,  true,  50, 99, 199,  1990)
ON CONFLICT (plan_key) DO NOTHING;

-- 3. Add plan + override columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_key TEXT REFERENCES public.b2b_plans(plan_key) DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS module_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tenants_plan_key ON public.tenants(plan_key);

-- 4. Resolver function: returns effective module privileges for a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_modules(_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_overrides JSONB;
  v_result JSONB;
BEGIN
  -- Fetch tenant's plan + overrides
  SELECT p.*, COALESCE(t.module_overrides, '{}'::jsonb) AS overrides
    INTO v_plan
  FROM public.tenants t
  LEFT JOIN public.b2b_plans p ON p.plan_key = t.plan_key
  WHERE t.id = _tenant_id;

  IF NOT FOUND OR v_plan.plan_key IS NULL THEN
    -- Default to starter privileges
    SELECT * INTO v_plan FROM public.b2b_plans WHERE plan_key = 'starter';
    v_overrides := '{}'::jsonb;
  ELSE
    v_overrides := v_plan.overrides;
  END IF;

  -- Build result, applying overrides on top of plan
  v_result := jsonb_build_object(
    'plan_key', v_plan.plan_key,
    'flights',           COALESCE((v_overrides->>'flights')::boolean,           v_plan.allow_flights),
    'hotels',            COALESCE((v_overrides->>'hotels')::boolean,            v_plan.allow_hotels),
    'tours',             COALESCE((v_overrides->>'tours')::boolean,             v_plan.allow_tours),
    'transfers',         COALESCE((v_overrides->>'transfers')::boolean,         v_plan.allow_transfers),
    'custom_domain',     COALESCE((v_overrides->>'custom_domain')::boolean,     v_plan.allow_custom_domain),
    'ai_copy',           COALESCE((v_overrides->>'ai_copy')::boolean,           v_plan.allow_ai_copy),
    'remove_branding',   COALESCE((v_overrides->>'remove_branding')::boolean,   v_plan.allow_remove_branding),
    'max_pages',         v_plan.max_pages,
    'max_section_variants', v_plan.max_section_variants
  );

  RETURN v_result;
END;
$$;

-- 5. Convenience: get current user's tenant modules (for client RLS-friendly calls)
CREATE OR REPLACE FUNCTION public.get_my_tenant_modules()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.get_tenant_modules(v_tenant_id);
END;
$$;