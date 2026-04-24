
-- Add tenant_id to existing user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Functions
CREATE OR REPLACE FUNCTION public.generate_tenant_api_key() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN RETURN 'tvk_' || encode(gen_random_bytes(32), 'hex'); END; $$;
CREATE OR REPLACE FUNCTION public.get_admin_tenant_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT tenant_id FROM public.user_roles WHERE user_id = _user_id AND role = 'admin' LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN INSERT INTO public.profiles (user_id, full_name, email) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email); RETURN NEW; END; $$;

-- Tables in dependency order
CREATE TABLE IF NOT EXISTS public.profiles (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, email text, created_at timestamptz NOT NULL DEFAULT now(), is_blocked boolean DEFAULT false, user_type text DEFAULT 'b2c', company_name text DEFAULT '', approval_status text DEFAULT 'approved', is_approved boolean DEFAULT true, billing_currency text DEFAULT 'USD', tenant_id uuid, company_address text DEFAULT '', trade_license text DEFAULT '', phone text DEFAULT '', approved_by uuid, approved_at timestamptz, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.provider_groups (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, description text DEFAULT '', providers jsonb DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tenants (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, domain text NOT NULL UNIQUE, name text NOT NULL, is_active boolean DEFAULT true, settings jsonb DEFAULT '{}', provider_group_id uuid REFERENCES public.provider_groups(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tenant_api_keys (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, api_key text NOT NULL, name text DEFAULT 'Default', is_active boolean DEFAULT true, rate_limit_per_minute integer DEFAULT 60, last_used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tenant_api_settings (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, provider text NOT NULL, is_active boolean DEFAULT false, settings jsonb DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, provider));
CREATE TABLE IF NOT EXISTS public.tenant_payment_settings (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, provider text NOT NULL, is_active boolean DEFAULT false, settings jsonb DEFAULT '{}', supported_currencies text[] DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id, provider));
CREATE TABLE IF NOT EXISTS public.api_settings (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, provider text NOT NULL UNIQUE, is_active boolean DEFAULT true, settings jsonb DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.flights (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, airline text NOT NULL, from_city text NOT NULL, to_city text NOT NULL, departure text DEFAULT '', arrival text DEFAULT '', duration text DEFAULT '', price numeric DEFAULT 0, stops integer DEFAULT 0, class text DEFAULT 'Economy', seats integer DEFAULT 100, markup_percentage numeric DEFAULT 0, is_active boolean DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.hotels (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, city text NOT NULL, rating numeric DEFAULT 0, reviews integer DEFAULT 0, price numeric DEFAULT 0, image text, amenities jsonb DEFAULT '[]', stars integer DEFAULT 4, created_at timestamptz NOT NULL DEFAULT now(), is_active boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS public.tours (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, destination text NOT NULL, duration text DEFAULT '', price numeric DEFAULT 0, category text DEFAULT 'International', rating numeric DEFAULT 0, image text, highlights jsonb DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), is_active boolean DEFAULT true, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.bookings (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, booking_id text NOT NULL, type text DEFAULT 'Flight' NOT NULL, title text NOT NULL, subtitle text, total numeric DEFAULT 0 NOT NULL, status text DEFAULT 'Pending' NOT NULL, details jsonb DEFAULT '[]', confirmation_number text, confirmation_data jsonb, tenant_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.airports (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, iata_code text NOT NULL UNIQUE, name text NOT NULL, city text NOT NULL, country text DEFAULT '', latitude numeric, longitude numeric, is_active boolean DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.banners (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text NOT NULL, subtitle text DEFAULT '', image_url text DEFAULT '', link_url text DEFAULT '', is_active boolean DEFAULT true, sort_order integer DEFAULT 0, tenant_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.offers (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text NOT NULL, description text DEFAULT '', discount text DEFAULT '', color text DEFAULT 'primary', is_active boolean DEFAULT true, tenant_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.testimonials (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, role text DEFAULT '', text text NOT NULL, rating integer DEFAULT 5, avatar text DEFAULT '', is_active boolean DEFAULT true, tenant_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.blog_categories (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, slug text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.blog_posts (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, title text NOT NULL, slug text NOT NULL, excerpt text, content text DEFAULT '' NOT NULL, featured_image text, category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL, tags jsonb DEFAULT '[]', status text DEFAULT 'draft', author_name text DEFAULT '', published_at timestamptz, tenant_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.popular_routes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, from_code text NOT NULL, to_code text NOT NULL, from_city text DEFAULT '', to_city text DEFAULT '', search_count integer DEFAULT 1, lowest_price numeric DEFAULT 0, currency text DEFAULT 'USD', airline text DEFAULT '', duration text DEFAULT '', stops integer DEFAULT 0, last_searched_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.wallet_transactions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, amount numeric DEFAULT 0 NOT NULL, type text DEFAULT 'credit' NOT NULL, description text DEFAULT '', status text DEFAULT 'completed', reference text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ticket_requests (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, type text DEFAULT 'refund' NOT NULL, status text DEFAULT 'pending' NOT NULL, reason text DEFAULT '', new_travel_date text, admin_notes text DEFAULT '', quote_amount numeric DEFAULT 0, charges numeric DEFAULT 0, refund_method text, tenant_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.saved_passengers (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, title text DEFAULT '', first_name text NOT NULL, last_name text NOT NULL, dob text DEFAULT '', nationality text DEFAULT '', passport_country text DEFAULT '', passport_number text DEFAULT '', passport_expiry text DEFAULT '', frequent_flyer text DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.airline_settings (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, airline_code text NOT NULL UNIQUE, airline_name text DEFAULT '', cabin_baggage text DEFAULT '7 Kg', checkin_baggage text DEFAULT '20 Kg', cancellation_policy text DEFAULT '', date_change_policy text DEFAULT '', name_change_policy text DEFAULT '', no_show_policy text DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.flight_price_cache (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, from_code text NOT NULL, to_code text NOT NULL, travel_date date NOT NULL, lowest_price numeric DEFAULT 0, currency text DEFAULT 'USD', source text DEFAULT '', expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), cabin_class text DEFAULT 'Economy', adults integer DEFAULT 1, children integer DEFAULT 0, infants integer DEFAULT 0, cached_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.destinations (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, country text DEFAULT '', image_url text, price numeric DEFAULT 0, rating numeric DEFAULT 0, flights integer DEFAULT 0, is_active boolean DEFAULT true, sort_order integer DEFAULT 0, tenant_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.hotel_interactions (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, hotel_id text NOT NULL, hotel_name text DEFAULT '' NOT NULL, city text DEFAULT '' NOT NULL, stars integer DEFAULT 0, action text DEFAULT 'view' NOT NULL, session_id uuid, user_id uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.b2b_access_requests (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, request_type text DEFAULT 'api_access' NOT NULL, status text DEFAULT 'pending' NOT NULL, company_name text DEFAULT '', domain_requested text DEFAULT '', business_justification text DEFAULT '', admin_notes text DEFAULT '', reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tour_inquiries (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, visitor_name text DEFAULT '' NOT NULL, visitor_email text DEFAULT '' NOT NULL, visitor_phone text DEFAULT '', destination text DEFAULT '', travel_dates text DEFAULT '', duration text DEFAULT '', travelers integer DEFAULT 1, budget text DEFAULT '', interests text DEFAULT '', ai_itinerary text DEFAULT '', status text DEFAULT 'pending' NOT NULL, admin_notes text DEFAULT '', source text DEFAULT 'website', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tripjack_cities (id integer PRIMARY KEY, city_name text DEFAULT '' NOT NULL, country_name text DEFAULT '', type text DEFAULT 'CITY', full_region_name text DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.tripjack_hotels (tj_hotel_id bigint PRIMARY KEY, unica_id bigint, name text DEFAULT '' NOT NULL, rating integer DEFAULT 0, property_type text DEFAULT 'Hotel', city_name text DEFAULT '', city_code text DEFAULT '', state_name text DEFAULT '', country_name text DEFAULT '', country_code text DEFAULT '', latitude numeric, longitude numeric, address text DEFAULT '', postal_code text DEFAULT '', image_url text DEFAULT '', is_deleted boolean DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz DEFAULT now());

-- Wallet balance function
CREATE OR REPLACE FUNCTION public.get_tenant_wallet_balance(_tenant_id uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) FROM public.wallet_transactions wt JOIN public.profiles p ON p.user_id = wt.user_id WHERE p.tenant_id = _tenant_id $$;

-- Auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON public.bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_airports_iata ON public.airports(iata_code);
CREATE INDEX IF NOT EXISTS idx_airports_active ON public.airports(is_active);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_wallet_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_requests_booking ON public.ticket_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_saved_passengers_user ON public.saved_passengers(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_cache ON public.flight_price_cache(from_code, to_code);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_key ON public.tenant_api_keys(api_key);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popular_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airline_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tripjack_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tripjack_hotels ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Profiles insert on signup" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bookings" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all bookings" ON public.bookings TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own wallet" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage wallet" ON public.wallet_transactions TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage own passengers" ON public.saved_passengers TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own requests" ON public.ticket_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create requests" ON public.ticket_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all requests" ON public.ticket_requests TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read flights" ON public.flights FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage flights" ON public.flights TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read hotels" ON public.hotels FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage hotels" ON public.hotels TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read tours" ON public.tours FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage tours" ON public.tours TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read airports" ON public.airports FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Service manage airports" ON public.airports TO service_role USING (true);
CREATE POLICY "Public read banners" ON public.banners FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage banners" ON public.banners TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read offers" ON public.offers FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage offers" ON public.offers TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read testimonials" ON public.testimonials FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage testimonials" ON public.testimonials TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read destinations" ON public.destinations FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage destinations" ON public.destinations TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read blog_posts" ON public.blog_posts FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage blog_posts" ON public.blog_posts TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read blog_categories" ON public.blog_categories FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage blog_categories" ON public.blog_categories TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read popular_routes" ON public.popular_routes FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage popular_routes" ON public.popular_routes TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manage popular_routes" ON public.popular_routes TO service_role USING (true);
CREATE POLICY "Public read non-sensitive api_settings" ON public.api_settings FOR SELECT USING (provider IN ('site_branding','site_general','site_footer','site_contact','site_social','site_seo','site_payment','currency_rates','taxes_fees','site_privacy_policy','site_terms','site_refund_policy','site_hero','site_stats','site_why_choose','site_newsletter','site_app_download','site_trending','site_blog_section') OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage api_settings" ON public.api_settings TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read airline_settings" ON public.airline_settings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage airline_settings" ON public.airline_settings TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read flight_price_cache" ON public.flight_price_cache FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Service manage flight_price_cache" ON public.flight_price_cache TO service_role USING (true);
CREATE POLICY "Anyone can subscribe newsletter" ON public.newsletter_subscribers FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Admin read newsletter" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read active tenants" ON public.tenants FOR SELECT TO authenticated, anon USING (is_active = true);
CREATE POLICY "Admin manage tenants" ON public.tenants TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read provider_groups" ON public.provider_groups FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin manage provider_groups" ON public.provider_groups TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin manage tenant_api_keys" ON public.tenant_api_keys TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manage tenant_api_keys" ON public.tenant_api_keys TO service_role USING (true);
CREATE POLICY "Admin manage tenant_api_settings" ON public.tenant_api_settings TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service read tenant_api_settings" ON public.tenant_api_settings FOR SELECT TO service_role USING (true);
CREATE POLICY "Admin manage tenant_payment_settings" ON public.tenant_payment_settings TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public insert hotel_interactions" ON public.hotel_interactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read hotel_interactions" ON public.hotel_interactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service manage hotel_interactions" ON public.hotel_interactions USING (true);
CREATE POLICY "Users can view own b2b requests" ON public.b2b_access_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create b2b requests" ON public.b2b_access_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage b2b requests" ON public.b2b_access_requests TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public insert tour_inquiries" ON public.tour_inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin manage tour_inquiries" ON public.tour_inquiries USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Public read tripjack_cities" ON public.tripjack_cities FOR SELECT USING (true);
CREATE POLICY "Service manage tripjack_cities" ON public.tripjack_cities USING (true);
CREATE POLICY "Public read tripjack_hotels" ON public.tripjack_hotels FOR SELECT USING (true);
CREATE POLICY "Service manage tripjack_hotels" ON public.tripjack_hotels USING (true);
