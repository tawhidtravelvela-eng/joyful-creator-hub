-- Sub-affiliate payouts ledger
CREATE TABLE IF NOT EXISTS public.whitelabel_sub_affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_affiliate_id uuid NOT NULL REFERENCES public.whitelabel_sub_affiliates(id) ON DELETE CASCADE,
  parent_affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending', -- pending | paid | rejected
  payment_method text,
  payment_reference text,
  admin_notes text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wl_sub_payouts_sub ON public.whitelabel_sub_affiliate_payouts(sub_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_sub_payouts_parent ON public.whitelabel_sub_affiliate_payouts(parent_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_sub_payouts_status ON public.whitelabel_sub_affiliate_payouts(status);

ALTER TABLE public.whitelabel_sub_affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Parent affiliate (white-label owner) can manage payouts to their sub-affiliates
CREATE POLICY "Parent affiliate can view own sub-affiliate payouts"
  ON public.whitelabel_sub_affiliate_payouts FOR SELECT
  USING (public.is_affiliate_owner(parent_affiliate_id));

CREATE POLICY "Parent affiliate can create sub-affiliate payouts"
  ON public.whitelabel_sub_affiliate_payouts FOR INSERT
  WITH CHECK (public.is_affiliate_owner(parent_affiliate_id));

CREATE POLICY "Parent affiliate can update own sub-affiliate payouts"
  ON public.whitelabel_sub_affiliate_payouts FOR UPDATE
  USING (public.is_affiliate_owner(parent_affiliate_id));

-- Sub-affiliate user can view their own payouts
CREATE POLICY "Sub-affiliate user can view own payouts"
  ON public.whitelabel_sub_affiliate_payouts FOR SELECT
  USING (sub_affiliate_id IN (SELECT id FROM public.whitelabel_sub_affiliates WHERE user_id = auth.uid()));

-- Admins can view all
CREATE POLICY "Admins can view all sub-affiliate payouts"
  ON public.whitelabel_sub_affiliate_payouts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Add total_paid column to whitelabel_sub_affiliates if missing
ALTER TABLE public.whitelabel_sub_affiliates
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0;

-- updated_at trigger
CREATE TRIGGER trg_wl_sub_payouts_updated_at
  BEFORE UPDATE ON public.whitelabel_sub_affiliate_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();