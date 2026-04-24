-- Author profiles table with regional diversity
CREATE TABLE public.blog_author_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  bio text NOT NULL,
  avatar_url text,
  region text NOT NULL DEFAULT 'south-asia',
  country text,
  expertise text[] DEFAULT '{}',
  social_links jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.blog_author_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active authors" ON public.blog_author_profiles
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage authors" ON public.blog_author_profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add language + author_profile_id to blog_posts
ALTER TABLE public.blog_posts 
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS author_profile_id uuid REFERENCES public.blog_author_profiles(id);

-- Seed regional author profiles
INSERT INTO public.blog_author_profiles (name, slug, bio, region, country, expertise) VALUES
  ('Anika Rahman', 'anika-rahman', 'Travel writer & food explorer from Dhaka. Has covered 30+ destinations across Asia, specializing in budget-friendly adventures and street food discoveries.', 'south-asia', 'BD', ARRAY['budget-travel', 'food-culture', 'destinations']),
  ('Rafiq Hassan', 'rafiq-hassan', 'Adventure photographer and travel journalist. Former airline crew turned full-time explorer, sharing insider tips on flights, deals, and hidden gems.', 'south-asia', 'BD', ARRAY['adventure', 'flight', 'travel-tips']),
  ('Priya Sharma', 'priya-sharma', 'Luxury travel curator & hotel reviewer from Mumbai. Writes about premium experiences accessible on South Asian budgets.', 'south-asia', 'IN', ARRAY['hotel-guides', 'destinations', 'budget-travel']),
  ('Tanvir Ahmed', 'tanvir-ahmed', 'Digital nomad and weekend warrior from Chittagong. Covers visa tips, solo travel, and offbeat destinations for Bangladeshi passport holders.', 'south-asia', 'BD', ARRAY['travel-tips', 'adventure', 'destinations']),
  ('Farah Jahan', 'farah-jahan', 'Family travel expert and cultural storyteller. Helps parents plan stress-free trips with kids across Asia and beyond.', 'south-asia', 'BD', ARRAY['travel-tips', 'travel', 'food-culture']),
  ('Arjun Menon', 'arjun-menon', 'Tech-savvy traveler from Kerala who finds the cheapest flights and best hotel hacks. Former data analyst turned travel hacker.', 'south-asia', 'IN', ARRAY['flight', 'hotel-guides', 'budget-travel']),
  ('Nusrat Fatima', 'nusrat-fatima', 'Cultural heritage enthusiast and monsoon travel specialist. Writes in both Bengali and English about South Asia''s best-kept secrets.', 'south-asia', 'BD', ARRAY['travel', 'destinations', 'food-culture']),
  ('Sameer Al-Rashid', 'sameer-al-rashid', 'Middle East & Southeast Asia travel expert. Covers visa-free destinations, halal travel, and luxury on a budget.', 'middle-east', 'AE', ARRAY['destinations', 'hotel-guides', 'travel-tips'])
ON CONFLICT DO NOTHING;