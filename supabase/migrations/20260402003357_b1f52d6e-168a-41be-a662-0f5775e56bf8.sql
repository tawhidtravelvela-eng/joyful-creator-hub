
-- Notifications table for in-app bell
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  link text DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service manage notifications"
  ON public.notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_notifications_user ON public.notifications (user_id, is_read, created_at DESC);

-- Price alerts table (one-shot per user)
CREATE TABLE public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL DEFAULT 'route',
  route_from text,
  route_to text,
  travel_date date,
  trip_id uuid REFERENCES public.saved_trips(id) ON DELETE CASCADE,
  threshold_price numeric NOT NULL DEFAULT 0,
  current_price numeric,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  last_checked_at timestamptz,
  triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own price_alerts"
  ON public.price_alerts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service manage price_alerts"
  ON public.price_alerts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_price_alerts_active ON public.price_alerts (status, last_checked_at)
  WHERE status = 'active';

-- Trip collaborators table
CREATE TABLE public.trip_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.saved_trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators can view trip collaborators"
  ON public.trip_collaborators FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.saved_trips
      WHERE id = trip_collaborators.trip_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Trip owners manage collaborators"
  ON public.trip_collaborators FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_trips
      WHERE id = trip_collaborators.trip_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_trips
      WHERE id = trip_collaborators.trip_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Service manage trip_collaborators"
  ON public.trip_collaborators FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_trip_collaborators_user ON public.trip_collaborators (user_id);
CREATE INDEX idx_trip_collaborators_trip ON public.trip_collaborators (trip_id);

-- Trigger for price_alerts updated_at
CREATE TRIGGER update_price_alerts_updated_at
  BEFORE UPDATE ON public.price_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
