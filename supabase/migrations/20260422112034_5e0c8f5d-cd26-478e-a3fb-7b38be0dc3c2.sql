-- Tighten RLS on b2b_access_requests so tenant admins only see/manage
-- partner applications belonging to their own tenant. Super admins
-- (no tenant scope on their admin role) keep full visibility.

-- Drop the broad admin policy so we can replace it with two scoped ones.
DROP POLICY IF EXISTS "Admins can manage b2b requests" ON public.b2b_access_requests;

-- Super admins: full access to everything.
CREATE POLICY "Super admins manage all b2b requests"
ON public.b2b_access_requests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Tenant admins: read + update only their tenant's rows.
-- (Insert remains user-scoped via the existing "Users can create b2b requests" policy.)
CREATE POLICY "Tenant admins read own tenant b2b requests"
ON public.b2b_access_requests
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND public.is_tenant_admin_of(tenant_id)
);

CREATE POLICY "Tenant admins update own tenant b2b requests"
ON public.b2b_access_requests
FOR UPDATE
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND public.is_tenant_admin_of(tenant_id)
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND public.is_tenant_admin_of(tenant_id)
);