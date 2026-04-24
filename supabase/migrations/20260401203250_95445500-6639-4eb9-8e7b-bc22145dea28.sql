-- Create utility function for auto-updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create saved_trips table
CREATE TABLE public.saved_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Trip',
  destination TEXT,
  origin TEXT,
  duration_days INTEGER,
  travelers INTEGER DEFAULT 1,
  itinerary JSONB,
  live_data JSONB,
  messages JSONB,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_public BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'complete',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Users can view their own trips"
  ON public.saved_trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create trips"
  ON public.saved_trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
  ON public.saved_trips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
  ON public.saved_trips FOR DELETE
  USING (auth.uid() = user_id);

-- Public trips viewable by anyone (for share links)
CREATE POLICY "Anyone can view public trips"
  ON public.saved_trips FOR SELECT
  USING (is_public = true);

-- Indexes
CREATE INDEX idx_saved_trips_user_id ON public.saved_trips (user_id);
CREATE INDEX idx_saved_trips_share_token ON public.saved_trips (share_token) WHERE share_token IS NOT NULL;

-- Auto-update timestamp trigger
CREATE TRIGGER update_saved_trips_updated_at
  BEFORE UPDATE ON public.saved_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();