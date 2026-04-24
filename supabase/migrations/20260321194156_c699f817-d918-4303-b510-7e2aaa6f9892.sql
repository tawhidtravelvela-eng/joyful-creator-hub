
-- Fix privilege escalation: prevent admins from assigning super_admin role
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Admins can only insert roles BELOW super_admin
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role != 'super_admin'::app_role
  );

-- Admins can only delete non-super_admin roles
CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND role != 'super_admin'::app_role
  );

-- Super admins can manage all roles (including super_admin)
CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
