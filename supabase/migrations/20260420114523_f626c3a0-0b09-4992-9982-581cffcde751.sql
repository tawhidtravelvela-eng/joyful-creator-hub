-- One-shot execution: grandfather all paid whitelabel users into Enterprise (1y)
DO $$
DECLARE
  rec RECORD;
  v_tenant_id uuid;
  v_subdomain text;
  v_affiliate RECORD;
  v_expires_at timestamptz := now() + interval '1 year';
BEGIN
  FOR rec IN
    SELECT DISTINCT wt.user_id, p.email, p.full_name, p.tenant_id
    FROM wallet_transactions wt
    JOIN profiles p ON p.user_id = wt.user_id
    WHERE wt.category = 'whitelabel'
      AND wt.status = 'completed'
      AND wt.type = 'debit'
  LOOP
    IF rec.tenant_id IS NOT NULL THEN
      v_tenant_id := rec.tenant_id;
    ELSE
      SELECT * INTO v_affiliate FROM affiliates WHERE user_id = rec.user_id LIMIT 1;
      v_subdomain := lower(regexp_replace(
        COALESCE(v_affiliate.affiliate_code, split_part(rec.email, '@', 1), 'tenant-' || substr(rec.user_id::text, 1, 8)),
        '[^a-z0-9]', '', 'g'
      ));

      -- Ensure subdomain uniqueness
      IF EXISTS (SELECT 1 FROM tenants WHERE subdomain = v_subdomain) THEN
        v_subdomain := v_subdomain || substr(md5(random()::text), 1, 4);
      END IF;

      INSERT INTO tenants (name, domain, subdomain, domain_type, whitelabel_enabled, allowed_products, is_active,
                           plan_key, plan_started_at, plan_expires_at, plan_billing_cycle)
      VALUES (
        COALESCE(NULLIF(rec.full_name, ''), v_subdomain),
        v_subdomain || '.travelvela.com',
        v_subdomain,
        'subdomain',
        true,
        ARRAY['flights', 'hotels', 'tours', 'transfers'],
        true,
        'enterprise',
        now(),
        v_expires_at,
        'yearly'
      )
      RETURNING id INTO v_tenant_id;

      UPDATE profiles SET tenant_id = v_tenant_id WHERE user_id = rec.user_id;
    END IF;

    -- Tenant admin role
    INSERT INTO user_roles (user_id, role, tenant_id)
    VALUES (rec.user_id, 'admin', v_tenant_id)
    ON CONFLICT DO NOTHING;

    -- Upgrade plan if not already enterprise w/ >300 days left
    IF NOT EXISTS (
      SELECT 1 FROM tenants
      WHERE id = v_tenant_id AND plan_key = 'enterprise'
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at > now() + interval '300 days'
    ) THEN
      UPDATE tenants
         SET plan_key = 'enterprise',
             plan_started_at = COALESCE(plan_started_at, now()),
             plan_expires_at = v_expires_at,
             plan_billing_cycle = 'yearly',
             whitelabel_enabled = true
       WHERE id = v_tenant_id;

      INSERT INTO tenant_plan_subscriptions
        (tenant_id, plan_key, billing_cycle, amount_usd, starts_at, expires_at, source, notes)
      VALUES
        (v_tenant_id, 'enterprise', 'yearly', 0, now(), v_expires_at,
         'legacy_grandfather',
         'Auto-granted: existing whitelabel customer (' || rec.email || ')');
    END IF;
  END LOOP;
END $$;