
-- 1. Plan flags
ALTER TABLE public.b2b_plans
  ADD COLUMN IF NOT EXISTS allow_blog boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_auto_blog boolean NOT NULL DEFAULT false;

UPDATE public.b2b_plans SET allow_blog = false, allow_auto_blog = false WHERE plan_key = 'starter';
UPDATE public.b2b_plans SET allow_blog = true,  allow_auto_blog = false WHERE plan_key = 'pro';
UPDATE public.b2b_plans SET allow_blog = true,  allow_auto_blog = true  WHERE plan_key = 'enterprise';

-- 2. Tenant opt-in toggle
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auto_blog_enabled boolean NOT NULL DEFAULT false;

-- 3. Helper: does this tenant's current plan allow a blog feature?
CREATE OR REPLACE FUNCTION public.tenant_can_use_blog(_tenant_id uuid, _feature text DEFAULT 'blog')
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _feature = 'auto_blog' THEN COALESCE(p.allow_auto_blog, false)
    ELSE COALESCE(p.allow_blog, false)
  END
  FROM public.tenants t
  LEFT JOIN public.b2b_plans p
    ON p.plan_key = COALESCE(
      CASE WHEN t.plan_expires_at IS NULL OR t.plan_expires_at > now() THEN t.plan_key END,
      'starter'
    )
  WHERE t.id = _tenant_id;
$$;

-- 4. RLS — tenant admins can manage their own tenant's blog content
DROP POLICY IF EXISTS "Tenant admins manage own blog_posts" ON public.blog_posts;
CREATE POLICY "Tenant admins manage own blog_posts"
ON public.blog_posts FOR ALL
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND public.is_tenant_admin_of(tenant_id)
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND public.is_tenant_admin_of(tenant_id)
  AND public.tenant_can_use_blog(tenant_id, 'blog')
);

DROP POLICY IF EXISTS "Tenant admins manage own blog_authors" ON public.blog_author_profiles;
CREATE POLICY "Tenant admins manage own blog_authors"
ON public.blog_author_profiles FOR ALL
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND public.is_tenant_admin_of(tenant_id)
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND public.is_tenant_admin_of(tenant_id)
  AND public.tenant_can_use_blog(tenant_id, 'blog')
);
