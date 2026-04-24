-- Track user interactions with generated itineraries (edit, remove, quote, book, abandon)
CREATE TABLE public.trip_itinerary_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.trip_generation_jobs(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL, -- view, edit, remove_activity, replace_hotel, replace_flight, quote_request, booking, abandon
  event_data jsonb DEFAULT '{}'::jsonb, -- details: which activity removed, what was changed, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_itinerary_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own events" ON public.trip_itinerary_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own events" ON public.trip_itinerary_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all events" ON public.trip_itinerary_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service full access" ON public.trip_itinerary_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_trip_events_job ON public.trip_itinerary_events(job_id);
CREATE INDEX idx_trip_events_type ON public.trip_itinerary_events(event_type);
CREATE INDEX idx_trip_events_created ON public.trip_itinerary_events(created_at DESC);

-- Store learning engine insights and recommendations
CREATE TABLE public.trip_learning_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type text NOT NULL, -- pattern, recommendation, policy_update, risk_flag
  category text, -- bundle, activity_density, product_ranking, transport, review_trigger, template, personalization
  priority text DEFAULT 'medium', -- high, medium, low
  title text NOT NULL,
  description text,
  data jsonb DEFAULT '{}'::jsonb, -- structured insight data
  confidence numeric(4,3),
  status text DEFAULT 'active', -- active, applied, dismissed, expired
  sample_size int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  applied_at timestamptz
);

ALTER TABLE public.trip_learning_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage insights" ON public.trip_learning_insights
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service full access insights" ON public.trip_learning_insights
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_learning_insights_type ON public.trip_learning_insights(insight_type);
CREATE INDEX idx_learning_insights_status ON public.trip_learning_insights(status);