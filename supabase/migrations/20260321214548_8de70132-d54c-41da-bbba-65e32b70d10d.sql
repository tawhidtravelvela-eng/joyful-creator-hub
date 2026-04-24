
-- White-label coupons (admin + parent agent generated)
CREATE TABLE public.whitelabel_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percent numeric NOT NULL DEFAULT 0 CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses integer DEFAULT NULL,
  used_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_by_type text NOT NULL DEFAULT 'admin' CHECK (created_by_type IN ('admin', 'agent')),
  agent_id uuid DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- White-label purchases
CREATE TABLE public.whitelabel_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  whitelabel_site_id uuid DEFAULT NULL,
  base_price numeric NOT NULL DEFAULT 500,
  coupon_id uuid REFERENCES public.whitelabel_coupons(id) DEFAULT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  final_price numeric NOT NULL DEFAULT 500,
  agent_commission_percent numeric NOT NULL DEFAULT 0,
  agent_commission_amount numeric NOT NULL DEFAULT 0,
  agent_id uuid DEFAULT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for coupons
ALTER TABLE public.whitelabel_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage coupons" ON public.whitelabel_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents manage own coupons" ON public.whitelabel_coupons
  FOR ALL TO authenticated
  USING (created_by = auth.uid() AND created_by_type = 'agent')
  WITH CHECK (created_by = auth.uid() AND created_by_type = 'agent');

CREATE POLICY "Authenticated read active coupons" ON public.whitelabel_coupons
  FOR SELECT TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RLS for purchases
ALTER TABLE public.whitelabel_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage purchases" ON public.whitelabel_purchases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own purchases" ON public.whitelabel_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own purchases" ON public.whitelabel_purchases
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents read sub-agent purchases" ON public.whitelabel_purchases
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Service manage purchases" ON public.whitelabel_purchases
  FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service manage coupons" ON public.whitelabel_coupons
  FOR ALL TO service_role
  USING (true);
