
CREATE TABLE public.student_airline_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  airline_code text NOT NULL,
  airline_name text DEFAULT '',
  scope_type text NOT NULL DEFAULT 'all' CHECK (scope_type IN ('all', 'country', 'route')),
  from_country text DEFAULT '',
  to_country text DEFAULT '',
  from_code text DEFAULT '',
  to_code text DEFAULT '',
  cabin_baggage text DEFAULT '',
  checkin_baggage text DEFAULT '',
  discount_policy text DEFAULT '',
  cancellation_policy text DEFAULT '',
  date_change_policy text DEFAULT '',
  name_change_policy text DEFAULT '',
  no_show_policy text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.student_airline_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage student_airline_settings"
  ON public.student_airline_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read student_airline_settings"
  ON public.student_airline_settings FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Service manage student_airline_settings"
  ON public.student_airline_settings FOR ALL
  TO service_role
  USING (true);
