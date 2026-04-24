
-- Phase 7: Whitelabel sub-affiliate program
-- Lets a WL admin invite their own affiliates who earn commissions on bookings
-- made through their WL site (separate from platform-level affiliates).

CREATE TABLE IF NOT EXISTS public.whitelabel_sub_affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  user_id UUID,                        -- nullable: an invite that hasn't been claimed yet
  email TEXT NOT NULL,
  display_name TEXT,
  sub_code TEXT NOT NULL,              -- short tracking code, unique per parent
  commission_rate NUMERIC NOT NULL DEFAULT 5.0,
  status TEXT NOT NULL DEFAULT 'invited',  -- 'invited' | 'active' | 'paused' | 'revoked'
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (parent_affiliate_id, sub_code),
  UNIQUE (parent_affiliate_id, email)
);

CREATE INDEX IF NOT EXISTS idx_wl_sub_affiliates_parent ON public.whitelabel_sub_affiliates(parent_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_sub_affiliates_user ON public.whitelabel_sub_affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_wl_sub_affiliates_status ON public.whitelabel_sub_affiliates(status);

ALTER TABLE public.whitelabel_sub_affiliates ENABLE ROW LEVEL SECURITY;

-- Parent WL owner can manage their sub-affiliates
CREATE POLICY "WL owner manages sub-affiliates"
  ON public.whitelabel_sub_affiliates
  FOR ALL
  USING (public.is_affiliate_owner(parent_affiliate_id))
  WITH CHECK (public.is_affiliate_owner(parent_affiliate_id));

-- Sub-affiliate can read their own row (once accepted)
CREATE POLICY "Sub-affiliate reads own row"
  ON public.whitelabel_sub_affiliates
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read/manage all
CREATE POLICY "Admins manage all sub-affiliates"
  ON public.whitelabel_sub_affiliates
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_wl_sub_affiliates_updated_at
  BEFORE UPDATE ON public.whitelabel_sub_affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Sub-affiliate click tracking (lightweight; mirrors affiliate_clicks pattern)
CREATE TABLE IF NOT EXISTS public.whitelabel_sub_affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_affiliate_id UUID NOT NULL REFERENCES public.whitelabel_sub_affiliates(id) ON DELETE CASCADE,
  parent_affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  page_url TEXT,
  referrer_url TEXT,
  country TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wl_sub_clicks_sub ON public.whitelabel_sub_affiliate_clicks(sub_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_sub_clicks_parent ON public.whitelabel_sub_affiliate_clicks(parent_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_wl_sub_clicks_created ON public.whitelabel_sub_affiliate_clicks(created_at DESC);

ALTER TABLE public.whitelabel_sub_affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a click (public site tracking pixel)
CREATE POLICY "Public can record sub-affiliate clicks"
  ON public.whitelabel_sub_affiliate_clicks
  FOR INSERT
  WITH CHECK (true);

-- Parent WL owner reads their network's clicks
CREATE POLICY "WL owner reads sub-affiliate clicks"
  ON public.whitelabel_sub_affiliate_clicks
  FOR SELECT
  USING (public.is_affiliate_owner(parent_affiliate_id));

-- Sub-affiliate reads their own clicks
CREATE POLICY "Sub-affiliate reads own clicks"
  ON public.whitelabel_sub_affiliate_clicks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.whitelabel_sub_affiliates s
      WHERE s.id = sub_affiliate_id AND s.user_id = auth.uid()
    )
  );

-- Admins
CREATE POLICY "Admins read all sub-affiliate clicks"
  ON public.whitelabel_sub_affiliate_clicks
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
