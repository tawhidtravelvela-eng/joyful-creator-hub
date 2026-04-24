-- Admin-featured items for trip planner priority boosting
CREATE TABLE public.featured_travel_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('airline', 'hotel', 'activity')),
  match_value text NOT NULL,
  match_field text NOT NULL DEFAULT 'name',
  city text DEFAULT '',
  priority_boost integer NOT NULL DEFAULT 10,
  reason text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.featured_travel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage featured items" ON public.featured_travel_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service read featured items" ON public.featured_travel_items
  FOR SELECT TO service_role USING (true);

CREATE INDEX idx_featured_items_type_active ON public.featured_travel_items(item_type, is_active);