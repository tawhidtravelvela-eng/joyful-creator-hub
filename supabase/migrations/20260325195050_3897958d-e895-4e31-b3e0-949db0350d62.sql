
CREATE TABLE public.city_intros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL,
  country text,
  hero_image_url text,
  intro_text text NOT NULL,
  popular_areas jsonb DEFAULT '[]'::jsonb,
  best_time_to_visit text,
  budget_ranges jsonb DEFAULT '{}'::jsonb,
  language text DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(city_name, language)
);

ALTER TABLE public.city_intros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read city intros"
  ON public.city_intros FOR SELECT
  TO anon, authenticated
  USING (true);
