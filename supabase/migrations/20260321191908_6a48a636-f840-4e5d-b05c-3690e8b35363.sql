
-- Helper function to store a provider secret in Supabase Vault
-- Uses vault.create_secret() for encryption at rest
CREATE OR REPLACE FUNCTION public.upsert_provider_secret(p_name text, p_secret text, p_description text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
BEGIN
  -- Check if secret with this name already exists
  SELECT id INTO existing_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- Update existing secret
    PERFORM vault.update_secret(existing_id, p_secret, p_name, p_description);
  ELSE
    -- Create new secret
    PERFORM vault.create_secret(p_secret, p_name, p_description);
  END IF;
END;
$$;

-- Helper function to read a provider secret from Vault (decrypted)
-- Only callable via service_role or security definer context
CREATE OR REPLACE FUNCTION public.read_provider_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;
  RETURN result;
END;
$$;

-- Helper function to bulk-save provider credentials (called from admin UI)
-- Accepts provider name and JSONB of key-value pairs, stores each in vault
CREATE OR REPLACE FUNCTION public.save_provider_credentials(p_provider text, p_credentials jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  v text;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Iterate over each key-value pair and store in vault
  FOR k, v IN SELECT * FROM jsonb_each_text(p_credentials)
  LOOP
    -- Only store non-empty values
    IF v IS NOT NULL AND v != '' THEN
      PERFORM public.upsert_provider_secret(p_provider || '_' || k, v, p_provider || ' ' || k);
    END IF;
  END LOOP;
END;
$$;

-- Helper to check if a vault secret exists (without revealing value)
CREATE OR REPLACE FUNCTION public.has_provider_secret(p_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = p_name);
END;
$$;

-- Function to check which credentials are configured for a provider (admin only)
CREATE OR REPLACE FUNCTION public.get_provider_credential_status(p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOR rec IN 
    SELECT name, created_at FROM vault.secrets 
    WHERE name LIKE p_provider || '_%'
  LOOP
    result := result || jsonb_build_object(
      replace(rec.name, p_provider || '_', ''), 
      true
    );
  END LOOP;
  
  RETURN result;
END;
$$;
