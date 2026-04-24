
CREATE TABLE public.trip_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 1,
  travelers INTEGER NOT NULL DEFAULT 1,
  travel_type TEXT DEFAULT NULL,
  travel_style TEXT DEFAULT NULL,
  cabin_class TEXT DEFAULT 'Economy',
  budget_total NUMERIC DEFAULT 0,
  budget_currency TEXT DEFAULT 'USD',
  hotel_stars INTEGER DEFAULT NULL,
  selection_priority TEXT DEFAULT 'best_value',
  season TEXT DEFAULT NULL,
  month INTEGER DEFAULT NULL,
  was_finalized BOOLEAN DEFAULT false,
  tenant_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage trip_insights" ON public.trip_insights FOR ALL TO service_role USING (true);
CREATE POLICY "Admin read trip_insights" ON public.trip_insights FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_trip_insights_destination ON public.trip_insights(destination);
CREATE INDEX idx_trip_insights_created_at ON public.trip_insights(created_at DESC);
