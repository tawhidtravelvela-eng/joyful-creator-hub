-- Top up 500 AI credits for the Mahabub (South Point Travel) tenant for testing.
INSERT INTO public.tenant_ai_credits (tenant_id, monthly_allowance, top_up_balance)
VALUES ('7553b271-bb8f-41e6-adb9-a57bbf4c962d', 5.00, 500)
ON CONFLICT (tenant_id) DO UPDATE
SET top_up_balance = public.tenant_ai_credits.top_up_balance + 500,
    updated_at = now();

INSERT INTO public.tenant_ai_credit_ledger
  (tenant_id, operation, amount_charged, charged_from, topup_balance_after, prompt_summary)
VALUES (
  '7553b271-bb8f-41e6-adb9-a57bbf4c962d',
  'manual_topup',
  -500,
  'top_up',
  (SELECT top_up_balance FROM public.tenant_ai_credits WHERE tenant_id='7553b271-bb8f-41e6-adb9-a57bbf4c962d'),
  'Admin test grant: 500 credits for South Point Travel.'
);