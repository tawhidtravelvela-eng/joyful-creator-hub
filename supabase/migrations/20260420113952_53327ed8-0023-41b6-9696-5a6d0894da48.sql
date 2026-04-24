-- Grandfather legacy whitelabel customers into Enterprise plan (1 year)
-- Idempotent: safe to re-run. Creates tenant + admin role + plan if missing.

CREATE OR REPLACE FUNCTION public.backfill_legacy_whitelabel_to_enterprise()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_tenant_id uuid;
  v_subdomain text;
  v_affiliate RECORD;
  v_processed int := 0;
  v_skipped int := 0;
  v_results jsonb := '[]'::jsonb;
  v_expires_at timestamptz := now() + interval '1 year';
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super admin required';
  END IF;

  -- Find every user with at least one COMPLETED whitelabel-category debit
  FOR rec IN
    SELECT DISTINCT wt.user_id, p.email, p.full_name, p.tenant_id
    FROM wallet_transactions wt
    JOIN profiles p ON p.user_id = wt.user_id
    WHERE wt.category = 'whitelabel'
      AND wt.status = 'completed'
      AND wt.type = 'debit'
  LOOP
    -- 1. Ensure tenant exists
    IF rec.tenant_id IS NOT NULL THEN
      v_tenant_id := rec.tenant_id;
    ELSE
      -- Generate a subdomain from email or affiliate code
      SELECT * INTO v_affiliate FROM affiliates WHERE user_id = rec.user_id LIMIT 1;
      v_subdomain := lower(regexp_replace(
        COALESCE(v_affiliate.affiliate_code, split_part(rec.email, '@', 1), 'tenant-' || substr(rec.user_id::text, 1, 8)),
        '[^a-z0-9]', '', 'g'
      ));

      INSERT INTO tenants (name, domain, subdomain, domain_type, whitelabel_enabled, allowed_products, is_active)
      VALUES (
        COALESCE(NULLIF(rec.full_name, ''), v_subdomain),
        v_subdomain || '.travelvela.com',
        v_subdomain,
        'subdomain',
        true,
        ARRAY['flights', 'hotels', 'tours', 'transfers'],
        true
      )
      RETURNING id INTO v_tenant_id;

      UPDATE profiles SET tenant_id = v_tenant_id WHERE user_id = rec.user_id;
    END IF;

    -- 2. Ensure user has tenant admin role
    INSERT INTO user_roles (user_id, role, tenant_id)
    VALUES (rec.user_id, 'admin', v_tenant_id)
    ON CONFLICT DO NOTHING;

    -- 3. Grant Enterprise plan if not already covered
    IF EXISTS (
      SELECT 1 FROM tenants
      WHERE id = v_tenant_id
        AND plan_key = 'enterprise'
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at > now() + interval '300 days'
    ) THEN
      v_skipped := v_skipped + 1;
    ELSE
      UPDATE tenants
         SET plan_key = 'enterprise',
             plan_started_at = COALESCE(plan_started_at, now()),
             plan_expires_at = v_expires_at,
             plan_billing_cycle = 'yearly',
             whitelabel_enabled = true
       WHERE id = v_tenant_id;

      INSERT INTO tenant_plan_subscriptions
        (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, source, notes, created_by)
      VALUES
        (v_tenant_id, 'enterprise', 'yearly', 0, now(), v_expires_at,
         'legacy_grandfather',
         'Auto-granted: existing whitelabel customer (' || rec.email || ')',
         auth.uid());

      v_processed := v_processed + 1;
    END IF;

    v_results := v_results || jsonb_build_object(
      'user_id', rec.user_id,
      'email', rec.email,
      'tenant_id', v_tenant_id,
      'expires_at', v_expires_at
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'granted', v_processed,
    'already_current', v_skipped,
    'users', v_results
  );
END;
$$;