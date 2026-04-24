-- Add currency and receipt_url columns to wallet_transactions
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Create a function for admin to approve pending deposits
CREATE OR REPLACE FUNCTION public.approve_wallet_deposit(p_transaction_id UUID, p_admin_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Get the pending transaction
  SELECT * INTO v_tx FROM public.wallet_transactions WHERE id = p_transaction_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or not pending');
  END IF;

  -- Approve: set status to completed
  UPDATE public.wallet_transactions
  SET status = 'completed',
      description = CASE 
        WHEN p_admin_note IS NOT NULL THEN description || ' | Approved: ' || p_admin_note
        ELSE description || ' | Approved'
      END
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object('success', true, 'amount', v_tx.amount, 'currency', v_tx.currency, 'user_id', v_tx.user_id);
END;
$$;

-- Create a function for admin to reject pending deposits
CREATE OR REPLACE FUNCTION public.reject_wallet_deposit(p_transaction_id UUID, p_reason TEXT DEFAULT 'Rejected by admin')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Check exists and is pending
  IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE id = p_transaction_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or not pending');
  END IF;

  -- Reject
  UPDATE public.wallet_transactions
  SET status = 'rejected',
      description = description || ' | Rejected: ' || p_reason
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object('success', true);
END;
$$;