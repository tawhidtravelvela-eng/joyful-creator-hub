
-- 1. Add parent_agent_id and credit_limit to profiles for sub-agent hierarchy
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS parent_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS credit_limit numeric NOT NULL DEFAULT 0;

-- Index for fast sub-agent lookups
CREATE INDEX IF NOT EXISTS idx_profiles_parent_agent ON public.profiles(parent_agent_id) WHERE parent_agent_id IS NOT NULL;

-- 2. Add tenant_id to wallet_transactions if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.wallet_transactions ADD COLUMN tenant_id uuid;
  END IF;
END $$;

-- 3. Create wallet_transfers table for agent→sub-agent fund movements
CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid NOT NULL REFERENCES auth.users(id),
  to_user_id uuid NOT NULL REFERENCES auth.users(id),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'completed',
  description text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;

-- Agents can see transfers they initiated
CREATE POLICY "Agents see own transfers" ON public.wallet_transfers
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Service role full access
CREATE POLICY "Service manage wallet_transfers" ON public.wallet_transfers
  FOR ALL TO service_role USING (true);

-- Admin full access
CREATE POLICY "Admin manage wallet_transfers" ON public.wallet_transfers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_from ON public.wallet_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_to ON public.wallet_transfers(to_user_id);

-- 4. Create agent_payment_gateways table for agent's own payment gateway config on white-label
CREATE TABLE IF NOT EXISTS public.agent_payment_gateways (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.agent_payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own gateways" ON public.agent_payment_gateways
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin manage agent_payment_gateways" ON public.agent_payment_gateways
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service manage agent_payment_gateways" ON public.agent_payment_gateways
  FOR ALL TO service_role USING (true);
