CREATE POLICY "Public can read skin config for active tenants"
ON public.tenant_skin_config
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = tenant_skin_config.tenant_id
      AND t.is_active = true
  )
);