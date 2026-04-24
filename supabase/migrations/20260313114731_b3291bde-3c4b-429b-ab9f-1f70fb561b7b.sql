
-- Create trip_finalization_requests table for admin follow-up
CREATE TABLE public.trip_finalization_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  passenger_name text NOT NULL DEFAULT '',
  passenger_email text NOT NULL DEFAULT '',
  passenger_phone text NOT NULL DEFAULT '',
  trip_title text NOT NULL DEFAULT '',
  destination text NOT NULL DEFAULT '',
  duration_days integer NOT NULL DEFAULT 1,
  travelers integer NOT NULL DEFAULT 1,
  estimated_total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  itinerary_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation_summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  admin_notes text NOT NULL DEFAULT '',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_large_group boolean NOT NULL DEFAULT false,
  tenant_id uuid
);

-- Enable RLS
ALTER TABLE public.trip_finalization_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can create trip requests"
  ON public.trip_finalization_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view own requests  
CREATE POLICY "Users can view own trip requests"
  ON public.trip_finalization_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Anonymous users can also submit (guest checkout)
CREATE POLICY "Anon can create trip requests"
  ON public.trip_finalization_requests FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL AND passenger_email != '');

-- Admins can manage all
CREATE POLICY "Admins can manage all trip requests"
  ON public.trip_finalization_requests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
