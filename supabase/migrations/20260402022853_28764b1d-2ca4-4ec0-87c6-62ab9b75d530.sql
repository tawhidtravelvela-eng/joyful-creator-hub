
-- Add version tracking columns to saved_trips
ALTER TABLE public.saved_trips
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_modified_source text DEFAULT NULL;

-- Create itinerary_change_logs table
CREATE TABLE public.itinerary_change_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.saved_trips(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  action_type text NOT NULL DEFAULT 'update',
  source text NOT NULL DEFAULT 'user',
  actor_id text DEFAULT NULL,
  before_state jsonb DEFAULT NULL,
  after_state jsonb DEFAULT NULL,
  change_summary text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_change_logs_trip_id ON public.itinerary_change_logs(trip_id);
CREATE INDEX idx_change_logs_created_at ON public.itinerary_change_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.itinerary_change_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own trips
CREATE POLICY "Users view own trip logs"
  ON public.itinerary_change_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_trips st
      WHERE st.id = itinerary_change_logs.trip_id
      AND st.user_id = auth.uid()
    )
  );

-- Admins can view all logs
CREATE POLICY "Admins view all trip logs"
  ON public.itinerary_change_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert logs for their own trips
CREATE POLICY "Users insert own trip logs"
  ON public.itinerary_change_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_trips st
      WHERE st.id = itinerary_change_logs.trip_id
      AND st.user_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service manage change logs"
  ON public.itinerary_change_logs
  FOR ALL
  TO service_role
  USING (true);

-- Create itinerary_errors table
CREATE TABLE public.itinerary_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.saved_trips(id) ON DELETE CASCADE,
  version integer DEFAULT NULL,
  error_type text NOT NULL,
  source text DEFAULT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone DEFAULT NULL,
  detected_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_itinerary_errors_trip_id ON public.itinerary_errors(trip_id);
CREATE INDEX idx_itinerary_errors_type ON public.itinerary_errors(error_type);

ALTER TABLE public.itinerary_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trip errors"
  ON public.itinerary_errors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_trips st
      WHERE st.id = itinerary_errors.trip_id
      AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all errors"
  ON public.itinerary_errors
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own trip errors"
  ON public.itinerary_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.saved_trips st
      WHERE st.id = itinerary_errors.trip_id
      AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "Service manage errors"
  ON public.itinerary_errors
  FOR ALL
  TO service_role
  USING (true);

-- Cleanup function: keep only last 20 versions per trip
CREATE OR REPLACE FUNCTION public.cleanup_old_change_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.itinerary_change_logs
  WHERE id IN (
    SELECT id FROM public.itinerary_change_logs
    WHERE trip_id = NEW.trip_id
    ORDER BY version DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_change_logs
  AFTER INSERT ON public.itinerary_change_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_old_change_logs();
