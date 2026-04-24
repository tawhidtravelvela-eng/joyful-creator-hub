
-- =============================================
-- 1. Fix attractions: wrong city names (landmarks stored as city)
-- =============================================
UPDATE public.attractions SET city = 'Singapore', country = 'Singapore'
WHERE city IN ('Gardens by the Bay Singapore', 'Universal Studios Singapore', 'ArtScience Museum', 'Sentosa Island');

UPDATE public.attractions SET city = 'Penang', country = 'Malaysia'
WHERE city IN ('Penang Hill', 'Penang (Batu Ferringhi)', 'Entopia Butterfly Farm Penang');

UPDATE public.attractions SET city = 'Kuala Lumpur', country = 'Malaysia'
WHERE city IN ('Petronas Towers', 'zoo negara', 'Genting Highlands');

DELETE FROM public.attractions WHERE city = 'bangladesh';

-- =============================================
-- 2. Fill missing country values in attractions
-- =============================================
UPDATE public.attractions SET country = 'Malaysia' WHERE city = 'Penang' AND (country = '' OR country IS NULL);
UPDATE public.attractions SET country = 'Malaysia' WHERE city = 'Kuala Lumpur' AND (country = '' OR country IS NULL);
UPDATE public.attractions SET country = 'Malaysia' WHERE city = 'Langkawi' AND (country = '' OR country IS NULL);
UPDATE public.attractions SET country = 'India' WHERE city = 'Kolkata' AND (country = '' OR country IS NULL);
UPDATE public.attractions SET country = 'Thailand' WHERE city = 'Phuket' AND (country = '' OR country IS NULL);
UPDATE public.attractions SET country = 'Thailand' WHERE city = 'Pattaya' AND (country = '' OR country IS NULL);

-- =============================================
-- 3. Consolidate tour_product_cache destinations
-- =============================================
UPDATE public.tour_product_cache SET destination = 'Penang' WHERE destination IN ('Penang Island', 'George Town');
UPDATE public.tour_product_cache SET destination = 'New York City' WHERE destination = 'New York';
UPDATE public.tour_product_cache SET destination = 'Singapore' WHERE destination = 'Sentosa Island';

-- =============================================
-- 4. Deduplicate viator_destination_map
-- =============================================
DELETE FROM public.viator_destination_map WHERE city_name = 'Langkawi' AND (dest_type IS NULL OR dest_type = '');
DELETE FROM public.viator_destination_map WHERE city_name = 'Pattaya' AND (dest_type IS NULL OR dest_type = '');
DELETE FROM public.viator_destination_map WHERE city_name = 'Singapore' AND dest_type = 'COUNTRY';
DELETE FROM public.viator_destination_map WHERE city_name = 'Penang Island';
