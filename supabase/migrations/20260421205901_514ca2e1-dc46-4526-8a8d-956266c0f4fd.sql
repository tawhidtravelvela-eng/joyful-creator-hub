-- ============================================================================
-- Phase 0 — Skin System, AI Credits, Snapshots & Module Config
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SKIN DEFINITIONS — the 6 canonical skins (catalog data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.skin_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skin_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  audience_type text NOT NULL CHECK (audience_type IN ('b2c', 'b2b', 'hybrid', 'corporate')),
  primary_vertical text CHECK (primary_vertical IN ('flights', 'hotels', 'tours', 'transfers', 'general', 'corporate', 'mixed')),
  required_plan_key text DEFAULT 'starter',
  is_active boolean NOT NULL DEFAULT true,
  is_premium boolean NOT NULL DEFAULT false,
  preview_image_url text,
  default_design_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_modules jsonb NOT NULL DEFAULT '{"flights":true,"hotels":true,"tours":true,"transfers":true}'::jsonb,
  default_section_variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_surface_b2c text,
  search_surface_b2b text,
  results_surface_b2c text,
  results_surface_b2b text,
  dashboard_layout text NOT NULL DEFAULT 'standard',
  homepage_mode text NOT NULL DEFAULT 'public_marketing' CHECK (homepage_mode IN ('public_marketing', 'auth_walled', 'hybrid_auto_switch')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skin_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skin definitions are publicly readable"
  ON public.skin_definitions FOR SELECT USING (true);

CREATE POLICY "Only super admins can modify skin definitions"
  ON public.skin_definitions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_skin_definitions_updated_at
  BEFORE UPDATE ON public.skin_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 6 canonical skins
INSERT INTO public.skin_definitions (skin_key, display_name, description, audience_type, primary_vertical, required_plan_key, is_premium, dashboard_layout, homepage_mode, sort_order)
VALUES
  ('b2c-flight',     'Flight-Forward Consumer',  'Bold flight-led consumer site with immersive search hero',                    'b2c',       'flights',   'starter',    false, 'consumer',          'public_marketing',     1),
  ('b2c-hotel',      'Hotel & Stays Consumer',   'Photo-led hotel discovery with editorial property cards',                     'b2c',       'hotels',    'starter',    false, 'consumer',          'public_marketing',     2),
  ('b2c-tour',       'Tours & Experiences',      'Inspirational tours-first layout with experience storytelling',               'b2c',       'tours',     'starter',    false, 'consumer',          'public_marketing',     3),
  ('b2c-general',    'Balanced All-Round',       'Balanced consumer site giving equal weight to all modules',                   'b2c',       'general',   'starter',    false, 'consumer',          'public_marketing',     4),
  ('hybrid-full',    'Hybrid Consumer + Agent',  'Public consumer site with auth-aware agent dashboard on the same domain',     'hybrid',    'mixed',     'professional', true, 'agent',             'hybrid_auto_switch',   5),
  ('b2b-corporate',  'B2B Corporate Travel',     'Marketing homepage with auth-walled corporate booking portal',                'corporate', 'corporate', 'enterprise', true, 'corporate',         'auth_walled',          6)
ON CONFLICT (skin_key) DO UPDATE SET
  display_name        = EXCLUDED.display_name,
  description         = EXCLUDED.description,
  audience_type       = EXCLUDED.audience_type,
  primary_vertical    = EXCLUDED.primary_vertical,
  required_plan_key   = EXCLUDED.required_plan_key,
  is_premium          = EXCLUDED.is_premium,
  dashboard_layout    = EXCLUDED.dashboard_layout,
  homepage_mode       = EXCLUDED.homepage_mode,
  sort_order          = EXCLUDED.sort_order,
  updated_at          = now();

-- ----------------------------------------------------------------------------
-- 2. TENANT SKIN CONFIG — per-tenant chosen skin + module + design overrides
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_skin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  skin_key text NOT NULL REFERENCES public.skin_definitions(skin_key) ON UPDATE CASCADE,
  enabled_modules jsonb NOT NULL DEFAULT '{"flights":true,"hotels":true,"tours":true,"transfers":true}'::jsonb,
  design_token_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  section_variant_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  font_heading text,
  font_body text,
  primary_color text,
  accent_color text,
  background_color text,
  border_radius text,
  density text CHECK (density IN ('compact', 'cozy', 'roomy')),
  button_style text,
  image_treatment text,
  animation_level text,
  brand_kit_extracted_at timestamptz,
  last_ai_rebuild_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_skin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read their skin config"
  ON public.tenant_skin_config FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins can manage their skin config"
  ON public.tenant_skin_config FOR ALL
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_tenant_skin_config_updated_at
  BEFORE UPDATE ON public.tenant_skin_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tenant_skin_config_skin_key ON public.tenant_skin_config(skin_key);

-- ----------------------------------------------------------------------------
-- 3. TENANT AI CREDITS — monthly pool + top-up balance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ai_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  monthly_allowance numeric(10,2) NOT NULL DEFAULT 5.00,
  used_this_period numeric(10,2) NOT NULL DEFAULT 0,
  top_up_balance numeric(10,2) NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  total_lifetime_used numeric(12,2) NOT NULL DEFAULT 0,
  last_charged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_ai_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their AI credits"
  ON public.tenant_ai_credits FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage AI credits"
  ON public.tenant_ai_credits FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_tenant_ai_credits_updated_at
  BEFORE UPDATE ON public.tenant_ai_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. AI CREDIT LEDGER — append-only log of every charge
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ai_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  operation text NOT NULL,
  amount_charged numeric(10,4) NOT NULL,
  charged_from text NOT NULL CHECK (charged_from IN ('monthly_pool', 'top_up', 'mixed', 'free_tier')),
  prompt_summary text,
  result_reference text,
  metadata jsonb DEFAULT '{}'::jsonb,
  pool_balance_after numeric(10,2),
  topup_balance_after numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_ai_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their AI credit ledger"
  ON public.tenant_ai_credit_ledger FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_ai_credit_ledger_tenant_created ON public.tenant_ai_credit_ledger(tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. TENANT SITE SNAPSHOTS — versioned rollback points
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_site_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  created_by uuid,
  trigger_source text NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'before_ai_rebuild', 'before_skin_change', 'auto_daily', 'before_brand_kit')),
  skin_key text,
  enabled_modules jsonb,
  design_tokens jsonb,
  section_variants jsonb,
  page_composition jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_site_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their snapshots"
  ON public.tenant_site_snapshots FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins can create snapshots"
  ON public.tenant_site_snapshots FOR INSERT
  WITH CHECK (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins can delete snapshots"
  ON public.tenant_site_snapshots FOR DELETE
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_tenant_snapshots_tenant_created ON public.tenant_site_snapshots(tenant_id, created_at DESC);

-- Trigger to keep only the latest 20 snapshots per tenant
CREATE OR REPLACE FUNCTION public.prune_tenant_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tenant_site_snapshots
  WHERE id IN (
    SELECT id FROM public.tenant_site_snapshots
    WHERE tenant_id = NEW.tenant_id
    ORDER BY created_at DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER prune_snapshots_after_insert
  AFTER INSERT ON public.tenant_site_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.prune_tenant_snapshots();

-- ----------------------------------------------------------------------------
-- 6. BLOCK LIBRARY — registry of every section block, tagged for AI selection
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.block_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('hero', 'search', 'feature', 'testimonial', 'stat', 'cta', 'footer', 'header', 'destination', 'trending', 'gallery', 'pricing', 'faq', 'comparison', 'banner', 'newsletter', 'team', 'about', 'contact', 'custom')),
  source_skin text,
  audience_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  vertical_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  mood_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  density text CHECK (density IN ('compact', 'cozy', 'roomy', 'immersive')),
  preview_image_url text,
  component_path text,
  default_content_schema jsonb DEFAULT '{}'::jsonb,
  required_plan_key text DEFAULT 'starter',
  is_active boolean NOT NULL DEFAULT true,
  ai_compose_weight numeric(3,2) NOT NULL DEFAULT 1.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.block_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block library is publicly readable"
  ON public.block_library FOR SELECT USING (true);

CREATE POLICY "Only super admins can modify block library"
  ON public.block_library FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_block_library_updated_at
  BEFORE UPDATE ON public.block_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_block_library_category ON public.block_library(category) WHERE is_active = true;
CREATE INDEX idx_block_library_audience ON public.block_library USING gin(audience_tags);
CREATE INDEX idx_block_library_vertical ON public.block_library USING gin(vertical_tags);
CREATE INDEX idx_block_library_mood ON public.block_library USING gin(mood_tags);

-- ----------------------------------------------------------------------------
-- 7. TENANT PAGE COMPOSITION — per-tenant per-page block instances
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_page_composition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_slug text NOT NULL,
  page_title text,
  meta_description text,
  block_instances jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  last_edited_by uuid,
  last_ai_edit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, page_slug)
);

ALTER TABLE public.tenant_page_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published pages are publicly readable"
  ON public.tenant_page_composition FOR SELECT
  USING (is_published = true OR public.is_tenant_member(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins can manage their pages"
  ON public.tenant_page_composition FOR ALL
  USING (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_admin_of(tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER set_tenant_page_composition_updated_at
  BEFORE UPDATE ON public.tenant_page_composition
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tenant_page_composition_tenant ON public.tenant_page_composition(tenant_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current AI credit state with auto period rollover
CREATE OR REPLACE FUNCTION public.get_tenant_ai_credits(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_needs_rollover boolean := false;
BEGIN
  IF NOT (public.is_tenant_member(_tenant_id) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_record FROM public.tenant_ai_credits WHERE tenant_id = _tenant_id;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_ai_credits (tenant_id) VALUES (_tenant_id)
    RETURNING * INTO v_record;
  END IF;

  -- Auto-rollover if period elapsed
  IF v_record.period_end < now() THEN
    UPDATE public.tenant_ai_credits
       SET used_this_period = 0,
           period_start = now(),
           period_end = now() + interval '30 days'
     WHERE tenant_id = _tenant_id
     RETURNING * INTO v_record;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', v_record.tenant_id,
    'monthly_allowance', v_record.monthly_allowance,
    'used_this_period', v_record.used_this_period,
    'remaining_pool', GREATEST(v_record.monthly_allowance - v_record.used_this_period, 0),
    'top_up_balance', v_record.top_up_balance,
    'total_available', GREATEST(v_record.monthly_allowance - v_record.used_this_period, 0) + v_record.top_up_balance,
    'period_start', v_record.period_start,
    'period_end', v_record.period_end,
    'total_lifetime_used', v_record.total_lifetime_used,
    'last_charged_at', v_record.last_charged_at
  );
END;
$$;

-- Atomically charge AI credits (pool first, then top-up)
CREATE OR REPLACE FUNCTION public.charge_tenant_ai_credits(
  _tenant_id uuid,
  _amount numeric,
  _operation text,
  _user_id uuid DEFAULT NULL,
  _prompt_summary text DEFAULT NULL,
  _result_reference text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_pool_remaining numeric;
  v_charge_from_pool numeric := 0;
  v_charge_from_topup numeric := 0;
  v_charged_from text;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Charge amount must be positive';
  END IF;

  -- Ensure record exists + rolled over
  PERFORM public.get_tenant_ai_credits(_tenant_id);

  SELECT * INTO v_record FROM public.tenant_ai_credits WHERE tenant_id = _tenant_id FOR UPDATE;

  v_pool_remaining := GREATEST(v_record.monthly_allowance - v_record.used_this_period, 0);

  IF v_pool_remaining + v_record.top_up_balance < _amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'required', _amount,
      'available', v_pool_remaining + v_record.top_up_balance
    );
  END IF;

  IF v_pool_remaining >= _amount THEN
    v_charge_from_pool := _amount;
    v_charged_from := 'monthly_pool';
  ELSIF v_pool_remaining > 0 THEN
    v_charge_from_pool := v_pool_remaining;
    v_charge_from_topup := _amount - v_pool_remaining;
    v_charged_from := 'mixed';
  ELSE
    v_charge_from_topup := _amount;
    v_charged_from := 'top_up';
  END IF;

  UPDATE public.tenant_ai_credits
     SET used_this_period = used_this_period + v_charge_from_pool,
         top_up_balance = top_up_balance - v_charge_from_topup,
         total_lifetime_used = total_lifetime_used + _amount,
         last_charged_at = now()
   WHERE tenant_id = _tenant_id
   RETURNING * INTO v_record;

  INSERT INTO public.tenant_ai_credit_ledger (
    tenant_id, user_id, operation, amount_charged, charged_from,
    prompt_summary, result_reference, metadata,
    pool_balance_after, topup_balance_after
  ) VALUES (
    _tenant_id, _user_id, _operation, _amount, v_charged_from,
    _prompt_summary, _result_reference, _metadata,
    GREATEST(v_record.monthly_allowance - v_record.used_this_period, 0),
    v_record.top_up_balance
  );

  RETURN jsonb_build_object(
    'success', true,
    'charged', _amount,
    'charged_from', v_charged_from,
    'remaining_pool', GREATEST(v_record.monthly_allowance - v_record.used_this_period, 0),
    'top_up_balance', v_record.top_up_balance
  );
END;
$$;

-- Create a snapshot of current tenant site state
CREATE OR REPLACE FUNCTION public.create_tenant_snapshot(
  _tenant_id uuid,
  _label text,
  _trigger_source text DEFAULT 'manual',
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id uuid;
  v_config RECORD;
  v_pages jsonb;
BEGIN
  IF NOT (public.is_tenant_admin_of(_tenant_id) OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied: tenant admin required';
  END IF;

  SELECT * INTO v_config FROM public.tenant_skin_config WHERE tenant_id = _tenant_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb) INTO v_pages
  FROM public.tenant_page_composition p
  WHERE p.tenant_id = _tenant_id;

  INSERT INTO public.tenant_site_snapshots (
    tenant_id, label, created_by, trigger_source,
    skin_key, enabled_modules, design_tokens, section_variants, page_composition, notes
  ) VALUES (
    _tenant_id, _label, auth.uid(), _trigger_source,
    v_config.skin_key,
    v_config.enabled_modules,
    v_config.design_token_overrides,
    v_config.section_variant_overrides,
    v_pages,
    _notes
  ) RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;