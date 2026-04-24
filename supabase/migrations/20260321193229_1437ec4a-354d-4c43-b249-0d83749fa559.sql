
-- Audit log table for secret access tracking
CREATE TABLE public.secret_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name text NOT NULL,
  provider text NOT NULL DEFAULT '',
  accessed_by text NOT NULL DEFAULT 'edge_function',
  function_name text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only service_role and admins can read
ALTER TABLE public.secret_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage secret_access_logs"
  ON public.secret_access_logs FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Admin read secret_access_logs"
  ON public.secret_access_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for quick lookups
CREATE INDEX idx_secret_access_logs_created ON public.secret_access_logs (created_at DESC);
CREATE INDEX idx_secret_access_logs_provider ON public.secret_access_logs (provider);

-- Update read_provider_secret to log access
CREATE OR REPLACE FUNCTION public.read_provider_secret(p_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  result text;
  v_provider text;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;

  -- Log the access (extract provider from name like "travelport_password" -> "travelport")
  v_provider := split_part(p_name, '_', 1);
  INSERT INTO public.secret_access_logs (secret_name, provider, accessed_by)
  VALUES (p_name, v_provider, 'service_role');

  RETURN result;
END;
$$;
