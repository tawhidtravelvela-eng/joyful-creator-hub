-- 1. Fix profiles UPDATE policy to prevent privilege escalation
-- Create a security definer function to get current privileged field values
CREATE OR REPLACE FUNCTION public.get_profile_privileged_fields(_user_id uuid)
RETURNS TABLE(
  credit_limit numeric,
  is_blocked boolean,
  approval_status text,
  is_approved boolean,
  user_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.credit_limit, p.is_blocked, p.approval_status, p.is_approved, p.user_type
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;

-- Drop old permissive policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create restricted UPDATE policy that locks privileged fields
CREATE POLICY "Users update own safe profile fields" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND credit_limit IS NOT DISTINCT FROM (SELECT f.credit_limit FROM public.get_profile_privileged_fields(auth.uid()) f)
    AND is_blocked IS NOT DISTINCT FROM (SELECT f.is_blocked FROM public.get_profile_privileged_fields(auth.uid()) f)
    AND approval_status IS NOT DISTINCT FROM (SELECT f.approval_status FROM public.get_profile_privileged_fields(auth.uid()) f)
    AND is_approved IS NOT DISTINCT FROM (SELECT f.is_approved FROM public.get_profile_privileged_fields(auth.uid()) f)
    AND user_type IS NOT DISTINCT FROM (SELECT f.user_type FROM public.get_profile_privileged_fields(auth.uid()) f)
  );

-- 2. Fix hotel_popularity_scores - remove public write, add proper service_role policy
DROP POLICY IF EXISTS "Service role full access" ON public.hotel_popularity_scores;

-- Allow public read (needed for ranking display)
CREATE POLICY "Public read hotel_popularity_scores" ON public.hotel_popularity_scores
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role only for writes
CREATE POLICY "Service role manage hotel_popularity_scores" ON public.hotel_popularity_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Fix bank_accounts - restrict to admin only
DROP POLICY IF EXISTS "Authenticated read active bank_accounts" ON public.bank_accounts;

CREATE POLICY "Admin read bank_accounts" ON public.bank_accounts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Add affiliates UPDATE policy for own non-sensitive fields
CREATE POLICY "Affiliates can update own record" ON public.affiliates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND commission_rate IS NOT DISTINCT FROM (SELECT a.commission_rate FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT a.status FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND total_earnings IS NOT DISTINCT FROM (SELECT a.total_earnings FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND total_paid IS NOT DISTINCT FROM (SELECT a.total_paid FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND wallet_balance IS NOT DISTINCT FROM (SELECT a.wallet_balance FROM public.affiliates a WHERE a.user_id = auth.uid())
  );