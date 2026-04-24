-- Per-conversion rows for sub-affiliates (enables analytics, trends, leaderboards)
CREATE TABLE public.whitelabel_sub_affiliate_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_affiliate_id uuid NOT NULL REFERENCES public.whitelabel_sub_affiliates(id) ON DELETE CASCADE,
  parent_affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  booking_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  product_type text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wl_sub_conv_parent_created
  ON public.whitelabel_sub_affiliate_conversions (parent_affiliate_id, created_at DESC);
CREATE INDEX idx_wl_sub_conv_sub_created
  ON public.whitelabel_sub_affiliate_conversions (sub_affiliate_id, created_at DESC);

ALTER TABLE public.whitelabel_sub_affiliate_conversions ENABLE ROW LEVEL SECURITY;

-- Parent affiliate (WL site owner) sees everything in their program
CREATE POLICY "Parent affiliate can view sub-affiliate conversions"
ON public.whitelabel_sub_affiliate_conversions
FOR SELECT
TO authenticated
USING (public.is_affiliate_owner(parent_affiliate_id));

-- Sub-affiliate sees their own
CREATE POLICY "Sub-affiliate can view own conversions"
ON public.whitelabel_sub_affiliate_conversions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.whitelabel_sub_affiliates wsa
    JOIN auth.users u ON lower(u.email) = lower(wsa.email)
    WHERE wsa.id = whitelabel_sub_affiliate_conversions.sub_affiliate_id
      AND u.id = auth.uid()
  )
);

-- updated_at trigger
CREATE TRIGGER update_wl_sub_conv_updated_at
BEFORE UPDATE ON public.whitelabel_sub_affiliate_conversions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();