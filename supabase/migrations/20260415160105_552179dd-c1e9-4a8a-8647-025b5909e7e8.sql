-- Allow authenticated users to insert their own wallet transactions (debit for purchases)
CREATE POLICY "Users can insert own wallet transactions"
ON public.wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);