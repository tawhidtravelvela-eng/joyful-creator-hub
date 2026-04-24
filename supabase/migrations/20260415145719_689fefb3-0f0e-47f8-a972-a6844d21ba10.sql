
CREATE TABLE public.agent_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  branch TEXT,
  swift_code TEXT,
  routing_number TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  country TEXT,
  logo_url TEXT,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own bank accounts"
  ON public.agent_bank_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Agents can insert own bank accounts"
  ON public.agent_bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents can update own bank accounts"
  ON public.agent_bank_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents can delete own bank accounts"
  ON public.agent_bank_accounts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
