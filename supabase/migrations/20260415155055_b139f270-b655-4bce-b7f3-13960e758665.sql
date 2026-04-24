CREATE OR REPLACE FUNCTION public.get_tenant_wallet_balance(_tenant_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)
  FROM public.wallet_transactions wt
  JOIN public.profiles p ON p.user_id = wt.user_id
  WHERE p.tenant_id = _tenant_id
    AND wt.status = 'completed'
$$;