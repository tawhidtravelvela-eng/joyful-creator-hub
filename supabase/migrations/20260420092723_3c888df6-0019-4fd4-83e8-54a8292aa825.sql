-- Per-sub-affiliate product-type rate overrides
CREATE TABLE public.whitelabel_sub_affiliate_product_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_affiliate_id uuid NOT NULL REFERENCES public.whitelabel_sub_affiliates(id) ON DELETE CASCADE,
  parent_affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  product_type text NOT NULL CHECK (product_type IN ('hotel','flight','tour','transfer','package','other')),
  commission_rate numeric NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_affiliate_id, product_type)
);

CREATE INDEX idx_wl_sub_aff_product_rates_sub ON public.whitelabel_sub_affiliate_product_rates(sub_affiliate_id);
CREATE INDEX idx_wl_sub_aff_product_rates_parent ON public.whitelabel_sub_affiliate_product_rates(parent_affiliate_id);

ALTER TABLE public.whitelabel_sub_affiliate_product_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parent owners manage product rates"
ON public.whitelabel_sub_affiliate_product_rates FOR ALL
USING (public.is_affiliate_owner(parent_affiliate_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_affiliate_owner(parent_affiliate_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sub-affiliates view their own product rates"
ON public.whitelabel_sub_affiliate_product_rates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.whitelabel_sub_affiliates sa
    WHERE sa.id = whitelabel_sub_affiliate_product_rates.sub_affiliate_id
      AND sa.user_id = auth.uid()
  )
);

CREATE TRIGGER trg_wl_sub_aff_product_rates_updated
BEFORE UPDATE ON public.whitelabel_sub_affiliate_product_rates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Volume-based bonus tiers per parent affiliate
CREATE TABLE public.whitelabel_sub_affiliate_volume_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tier_name text NOT NULL DEFAULT 'Tier',
  min_conversions integer NOT NULL DEFAULT 0 CHECK (min_conversions >= 0),
  bonus_rate numeric NOT NULL DEFAULT 0 CHECK (bonus_rate >= 0 AND bonus_rate <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wl_sub_aff_volume_tiers_parent ON public.whitelabel_sub_affiliate_volume_tiers(parent_affiliate_id, min_conversions);

ALTER TABLE public.whitelabel_sub_affiliate_volume_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parent owners manage volume tiers"
ON public.whitelabel_sub_affiliate_volume_tiers FOR ALL
USING (public.is_affiliate_owner(parent_affiliate_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_affiliate_owner(parent_affiliate_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sub-affiliates view parent volume tiers"
ON public.whitelabel_sub_affiliate_volume_tiers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.whitelabel_sub_affiliates sa
    WHERE sa.parent_affiliate_id = whitelabel_sub_affiliate_volume_tiers.parent_affiliate_id
      AND sa.user_id = auth.uid()
  )
);

CREATE TRIGGER trg_wl_sub_aff_volume_tiers_updated
BEFORE UPDATE ON public.whitelabel_sub_affiliate_volume_tiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();