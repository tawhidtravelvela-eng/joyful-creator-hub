-- Promote every existing tenant to Enterprise (one-time migration of legacy "purchased" tenants)
UPDATE public.tenants
SET plan_key = 'enterprise'
WHERE plan_key IS NULL
   OR plan_key IN ('starter', 'pro');