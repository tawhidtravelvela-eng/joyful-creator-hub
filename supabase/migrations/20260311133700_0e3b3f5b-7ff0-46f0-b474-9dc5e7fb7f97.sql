INSERT INTO public.user_roles (user_id, role)
VALUES ('274bbd6e-694f-4761-a4cd-51829e13ecc5', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;