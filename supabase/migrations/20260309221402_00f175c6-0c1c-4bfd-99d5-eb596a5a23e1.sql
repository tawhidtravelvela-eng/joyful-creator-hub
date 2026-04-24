
-- Also give admin role so existing has_role('admin') checks pass
INSERT INTO public.user_roles (user_id, role) VALUES ('fbe096d7-58cd-45a5-8166-647eaeca66e9', 'admin') ON CONFLICT (user_id, role) DO NOTHING;

-- Update has_role to treat super_admin as having admin privileges too
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR (_role = 'admin' AND role = 'super_admin'))
  )
$$;
