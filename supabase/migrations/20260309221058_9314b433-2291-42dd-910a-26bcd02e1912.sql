
-- Insert airline_settings
INSERT INTO public.airline_settings (id, airline_code, airline_name, cabin_baggage, checkin_baggage, cancellation_policy, date_change_policy, name_change_policy, no_show_policy, created_at, updated_at) VALUES
('db9c328c-1832-4696-97d2-78a618448bdf', 'BG', 'Biman Bangladesh', '7 Kg', '10 Kg', 'Free cancellation within 24 hours of booking', 'As Per Airline', 'As Per Airline', 'As Per Airline', '2026-02-27 19:28:50.106068+00', '2026-03-08 22:02:49.782918+00'),
('5ccd4984-08fc-42df-993e-ba05a74191ea', 'CZ', 'China Southern Airlines', '7 Kg', '23 Kg', 'Varies by fare class', 'Varies by fare class', 'Name changes up to 48h before departure ($50 fee)', 'No-show results in full fare forfeiture', '2026-03-03 01:01:54.981512+00', '2026-03-08 22:02:49.782918+00'),
('e6f3a985-4038-48fb-9c79-fce4f48fa399', 'MU', 'China Eastern Airlines', '7 Kg', '23 Kg', 'Varies by fare class', 'Varies by fare class', 'Name changes up to 48h before departure ($50 fee)', 'No-show results in full fare forfeiture', '2026-03-03 01:01:54.981512+00', '2026-03-08 22:02:49.782918+00')
ON CONFLICT (id) DO NOTHING;

-- Insert api_settings
INSERT INTO public.api_settings (id, provider, is_active, settings, created_at) VALUES
('b1ab890f-ca84-4e18-b41a-78e97ff3db46', 'local_inventory', false, '{"type": "flights"}', '2026-02-27 16:38:01.442505+00'),
('86430c54-38ec-4282-bde4-11e3d9fd7999', 'travelvela', false, '{}', '2026-02-28 20:42:07.55977+00'),
('f473fc93-a72f-44f1-81fa-e1f45fbb9bcd', 'flight_markup', true, '{"type": "percentage", "value": 5}', '2026-02-27 18:45:28.747665+00'),
('cea2d7cc-4846-4ded-8089-69179598d7c2', 'site_general', true, '{"tagline": "Travel Simply", "site_name": "Travel Vela", "show_prices_bdt": true, "default_currency": "BDT", "default_language": "English", "maintenance_mode": false, "user_registration": true}', '2026-03-01 09:27:03.782371+00'),
('fe1d91f8-303f-4ade-8c19-d34e40991f8c', 'taxes_fees', true, '{"service_fee": 0, "tax_percentage": 0, "convenience_fee_percentage": 0}', '2026-02-27 20:26:59.851389+00'),
('f718222f-4d41-4663-b467-726609312e14', 'ait_settings', true, '{"per_api": {"amadeus": 0, "tripjack": 0, "travelport": 0.3, "travelvela": 0}}', '2026-03-08 08:27:59.985811+00'),
('ed401a06-4015-44c8-ab6a-9071e888e518', 'amadeus', false, '{"environment": "test"}', '2026-02-27 16:36:07.813547+00'),
('f3d8950d-f005-4f0c-ae3a-1b581391fb77', 'travelport', true, '{"endpoint": "https://apac.universal-api.travelport.com/B2BGateway/connect/uAPI/AirService", "environment": "production", "student_fare_enabled": true}', '2026-02-27 15:30:28.453661+00'),
('e7239b98-8cf9-4fb1-9a89-54f66f72282e', 'tripjack_flight', true, '{"environment": "production"}', '2026-03-05 20:16:27.587296+00'),
('9dc9f7ff-78a7-4616-a632-36b93be3a226', 'site_apps', true, '{"tawkto": false, "tawkto_id": "", "crisp_enabled": true, "google_reviews": false, "google_place_id": "", "whatsapp_number": "", "whatsapp_widget": true, "crisp_website_id": "7b6ec17d-256a-41e8-9732-17ff58bd51e9"}', '2026-03-08 09:41:25.106574+00'),
('0d90080f-6179-4127-b6ee-b5663bda7ac9', 'site_payment', true, '{"stripe_pk": "", "stripe_sk": "", "sandbox_mode": true, "bkash_enabled": true, "nagad_enabled": false, "stripe_enabled": false, "bank_transfer_enabled": true}', '2026-03-04 15:08:48.583663+00'),
('dd65d03a-8493-4af0-b682-0ffdcde4700c', 'site_contact', true, '{"email": "", "phone": "01870802030", "address": "Bashori Bhaban, Police Line Road, Barishal", "maps_url": "", "whatsapp": "", "iata_number": "", "business_name": "Travel Vela", "civil_aviation_license": ""}', '2026-03-04 16:45:21.513499+00'),
('5bcc887b-62df-4e43-a568-32df0edd0be6', 'api_markup', true, '{"per_api": {"amadeus": {"global": 1, "airlines": {}}, "tripjack": {"global": 3, "airlines": {}}, "travelport": {"global": 2, "airlines": {}}, "travelvela": {"global": 1, "airlines": {}}}, "airline_markups": {}, "markup_percentage": 2}', '2026-02-27 19:00:53.475606+00'),
('c045246d-3197-475c-88cf-7c949ebee186', 'site_branding', true, '{"logo_url": "https://travelvela-html.vercel.app/images/logo.png", "color_card": "#ffffff", "color_muted": "#edf3f8", "favicon_url": "https://travelvela-html.vercel.app/images/favicon.png", "footer_text": "2026 Travel Vela. All rights reserved.", "accent_color": "#10b981", "color_accent": "#ff6b2c", "color_border": "#d0e3f2", "color_primary": "#0092ff", "primary_color": "#0092ff", "color_secondary": "#e8f4ff", "secondary_color": "#f59e0b", "color_background": "#f7fafd", "color_foreground": "#0a1929", "color_destructive": "#e53935", "color_card_foreground": "#0a1929", "color_muted_foreground": "#5a7a99", "color_accent_foreground": "#ffffff", "color_primary_foreground": "#ffffff", "color_secondary_foreground": "#003d6b"}', '2026-03-01 09:28:10.92761+00'),
('1f615d7b-d9dc-4786-933e-1f154b28f0f3', 'currency_rates', true, '{"live_rates": {"AED": 3.6725, "AUD": 1.421306, "BDT": 122.299479, "CAD": 1.368024, "CNY": 6.915072, "EUR": 0.860948, "GBP": 0.749722, "HKD": 7.804472, "INR": 92.108456, "JPY": 157.706313, "KRW": 1477.311478, "MYR": 3.942914, "NPR": 147.37432, "NZD": 1.697866, "PKR": 279.490668, "QAR": 3.64, "SAR": 3.75, "SGD": 1.277508, "THB": 31.653168, "TRY": 43.966313, "USD": 1}, "last_fetched": "2026-03-04T10:37:03.477Z", "conversion_markup": 3, "api_source_currencies": {"amadeus": "USD", "travelport": "BDT", "travelvela": "BDT", "local_inventory": "USD"}}', '2026-02-27 17:39:10.336609+00'),
('d02d3ca5-69d9-49e4-b3ed-5e5a5b2cdec1', 'airline_commissions', true, '{"rules": []}', '2026-03-02 23:41:31.101687+00'),
('ff449992-a9bb-4684-8876-f05eada4a8ed', 'agoda_city_cache', true, '{"london": 6270, "bangkok": 9395, "kolkata": 8850, "singapore": 4064}', '2026-03-08 23:33:30.719708+00'),
('726ce839-62ce-4330-9bfa-59981115d120', 'travelvela_hotel', false, '{}', '2026-03-05 21:49:50.643685+00'),
('c891a08b-0f11-4606-aefb-b5b64edd973e', 'tripjack_hotel', false, '{"environment": "production", "production_host": "api.tripjack.com"}', '2026-03-05 19:39:50.068189+00'),
('e11045db-c81d-45c8-9576-c78e773ee5f2', 'agoda_hotel', true, '{"cityMapping": {}}', '2026-03-08 22:59:33.051756+00')
ON CONFLICT (id) DO NOTHING;

-- Insert banners
INSERT INTO public.banners (id, title, subtitle, image_url, link_url, is_active, sort_order, tenant_id, created_at) VALUES
('fd065a59-ebd2-4031-af79-e1ea7e2b4e6a', 'banner 2', '', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', true, 2, NULL, '2026-03-01 10:12:00.403651+00'),
('a1bee4a8-8888-4339-ae15-c306d2e6508a', 'offer', '', 'https://travelvela-html.vercel.app/images/offer-banner/1.avif', 'https://travelvela-html.vercel.app/pricing.html', true, 1, NULL, '2026-03-01 10:11:33.554895+00'),
('63cec0cf-4d64-4e0d-8239-8ea2abff26ae', 'gfd', '', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', 'https://travelvela-html.vercel.app/images/offer-banner/2.avif', true, 3, NULL, '2026-03-01 10:12:20.586118+00')
ON CONFLICT (id) DO NOTHING;

-- Insert blog_categories
INSERT INTO public.blog_categories (id, name, slug, created_at) VALUES
('3a9b8b75-ae21-45e3-bf74-a384599f3aa7', 'Travel', 'travel', '2026-03-01 09:05:39.072992+00'),
('84365e96-700a-4c88-9a13-e70541f5c70d', 'Tour', 'tour', '2026-03-01 09:05:51.01216+00'),
('9ed6ef1d-b5e1-4b2a-8eb1-6a113d2bc08f', 'Flight', 'flight', '2026-03-01 09:06:01.090816+00'),
('fcfee9c2-1794-4aa5-8bf4-0fa8cb6f7449', 'Travel Tips', 'travel-tips', '2026-03-01 09:42:04.598627+00'),
('6d5340c9-e7dc-45c6-aa19-39688f54a566', 'Destinations', 'destinations', '2026-03-01 09:42:04.598627+00'),
('1994ecc8-0228-4491-9fa7-00d150bd89bc', 'Budget Travel', 'budget-travel', '2026-03-01 09:42:04.598627+00')
ON CONFLICT (id) DO NOTHING;

-- Insert offers
INSERT INTO public.offers (id, title, description, discount, color, is_active, tenant_id, created_at) VALUES
('ae8a3435-022a-41b6-b965-618e01322c93', 'Summer Sale', 'Flights & Hotels', '40% OFF', 'primary', true, NULL, '2026-03-03 07:59:54.161211+00'),
('79865e24-f964-4266-abd1-6f41771a1755', 'Hotel Deals', 'Luxury stays at budget prices', '10% OFF', 'accent', true, NULL, '2026-03-03 07:59:54.161211+00'),
('9f137e8a-07da-4922-a64b-1634e00ea357', 'Honeymoon Special', 'Free room upgrade on packages', 'FREE UPGRADE', 'success', true, NULL, '2026-03-03 07:59:54.161211+00')
ON CONFLICT (id) DO NOTHING;

-- Insert hotels
INSERT INTO public.hotels (id, name, city, rating, reviews, price, image, amenities, stars, created_at, is_active) VALUES
('ada54958-ce57-476d-9e72-5ea76e7a13a2', 'Grand Palace Hotel', 'Paris', 4.8, 2340, 250, 'dest-paris', '["WiFi", "Pool", "Spa", "Restaurant", "Gym"]', 5, '2026-02-27 13:11:27.452392+00', true),
('91514563-23a8-46d1-b4e4-eb09d3c8b781', 'Tokyo Bay Resort', 'Tokyo', 4.7, 1890, 180, 'dest-tokyo', '["WiFi", "Restaurant", "Bar", "Gym"]', 4, '2026-02-27 13:11:27.452392+00', true),
('c57ae804-0fcb-4a11-ac4e-ad3efed45ff7', 'Bali Zen Villas', 'Bali', 4.9, 3200, 320, 'dest-bali', '["WiFi", "Pool", "Spa", "Restaurant", "Beach Access"]', 5, '2026-02-27 13:11:27.452392+00', true),
('5dd36b87-dea0-4eb9-8a05-aa450caa6634', 'Burj View Suites', 'Dubai', 4.6, 1560, 400, 'dest-dubai', '["WiFi", "Pool", "Spa", "Restaurant", "Gym", "Bar"]', 5, '2026-02-27 13:11:27.452392+00', true),
('c7c236c9-0a3b-46f3-86cc-0ec9d3873564', 'Aegean Blue Hotel', 'Santorini', 4.8, 980, 280, 'dest-santorini', '["WiFi", "Pool", "Restaurant", "Sea View"]', 4, '2026-02-27 13:11:27.452392+00', true),
('4532d67d-5b5e-4de3-b312-64f6fe266d33', 'Manhattan Central Inn', 'New York', 4.4, 4100, 199, 'dest-newyork', '["WiFi", "Restaurant", "Gym", "Bar"]', 4, '2026-02-27 13:11:27.452392+00', true)
ON CONFLICT (id) DO NOTHING;

-- Insert provider_groups
INSERT INTO public.provider_groups (id, name, description, providers, created_at) VALUES
('cb3d35b4-00e5-45d9-9ab9-ff2f091b7e0c', 'APAC', 'Asia-Pacific region - Travelport + Tripjack', '{"amadeus": false, "tripjack": true, "travelport": true, "travelvela": false}', '2026-03-07 18:45:43.151033+00'),
('5b78950f-9b8e-4048-91d5-076d65814ac2', 'Europe', 'Europe region - Amadeus + Travelport', '{"amadeus": true, "tripjack": false, "travelport": true, "travelvela": false}', '2026-03-07 18:45:43.151033+00'),
('447d9a4c-4ebd-4ec9-a20c-9689d77ffdb4', 'Global', 'Full access to all providers', '{"amadeus": true, "tripjack": true, "travelport": true, "travelvela": true}', '2026-03-07 18:45:43.151033+00')
ON CONFLICT (id) DO NOTHING;
