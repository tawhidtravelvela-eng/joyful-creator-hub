
-- Agent markup settings: each agent sets markup for their sub-agents and B2C customers
CREATE TABLE public.agent_markup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  applies_to text NOT NULL DEFAULT 'sub_agents' CHECK (applies_to IN ('sub_agents', 'b2c')),
  markup_type text NOT NULL DEFAULT 'percentage' CHECK (markup_type IN ('percentage', 'fixed')),
  markup_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, applies_to)
);

ALTER TABLE public.agent_markup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own markup_settings" ON public.agent_markup_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin manage agent_markup_settings" ON public.agent_markup_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service manage agent_markup_settings" ON public.agent_markup_settings
  FOR ALL TO service_role USING (true);

-- Sub-agent earnings: tracks per-booking profit at each hierarchy level
CREATE TABLE public.sub_agent_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_agent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id text NOT NULL,
  base_cost numeric NOT NULL DEFAULT 0,
  markup_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_agent_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own earnings" ON public.sub_agent_earnings
  FOR SELECT TO authenticated USING (agent_user_id = auth.uid());

CREATE POLICY "Admin manage sub_agent_earnings" ON public.sub_agent_earnings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service manage sub_agent_earnings" ON public.sub_agent_earnings
  FOR ALL TO service_role USING (true);

-- Agent earnings wallet balance (separate from main wallet)
-- We track this via wallet_transactions with a special description prefix
-- No new table needed - we use wallet_transactions with type and description to differentiate
