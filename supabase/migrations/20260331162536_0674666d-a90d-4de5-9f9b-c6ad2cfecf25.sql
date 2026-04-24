
-- Create viator destination ID → city name mapping table
CREATE TABLE public.viator_destination_map (
  dest_id TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.viator_destination_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read viator_destination_map" ON public.viator_destination_map
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service manage viator_destination_map" ON public.viator_destination_map
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed known mappings from our cached data analysis
INSERT INTO public.viator_destination_map (dest_id, city_name, country, region) VALUES
  -- Malaysia
  ('335', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('672', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('59070', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('36684', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('36678', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('680', 'Penang', 'Malaysia', 'Southeast Asia'),
  ('339', 'Penang', 'Malaysia', 'Southeast Asia'),
  ('50882', 'Penang', 'Malaysia', 'Southeast Asia'),
  ('51052', 'Penang', 'Malaysia', 'Southeast Asia'),
  ('338', 'Langkawi', 'Malaysia', 'Southeast Asia'),
  ('24162', 'Langkawi', 'Malaysia', 'Southeast Asia'),
  ('4633', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('5467', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  -- Singapore
  ('60449', 'Singapore', 'Singapore', 'Southeast Asia'),
  ('50208', 'Singapore', 'Singapore', 'Southeast Asia'),
  -- Thailand
  ('684', 'Bangkok', 'Thailand', 'Southeast Asia'),
  ('344', 'Pattaya', 'Thailand', 'Southeast Asia'),
  ('685', 'Chiang Mai', 'Thailand', 'Southeast Asia'),
  ('693', 'Chiang Rai', 'Thailand', 'Southeast Asia'),
  ('343', 'Phuket', 'Thailand', 'Southeast Asia'),
  -- India
  ('22046', 'Kolkata', 'India', 'South Asia'),
  ('22047', 'Kolkata', 'India', 'South Asia'),
  ('4924', 'Kolkata', 'India', 'South Asia'),
  ('50369', 'Kolkata', 'India', 'South Asia'),
  ('4547', 'Agra', 'India', 'South Asia'),
  ('804', 'Jaipur', 'India', 'South Asia'),
  ('29', 'Agra', 'India', 'South Asia'),
  -- USA
  ('662', 'Miami', 'USA', 'North America'),
  ('955', 'Fort Lauderdale', 'USA', 'North America'),
  ('956', 'Boston', 'USA', 'North America'),
  ('957', 'Chicago', 'USA', 'North America'),
  ('953', 'Key West', 'USA', 'North America'),
  ('660', 'Orlando', 'USA', 'North America'),
  -- Middle East
  ('319', 'Abu Dhabi', 'UAE', 'Middle East'),
  ('321', 'Amman', 'Jordan', 'Middle East'),
  ('324', 'Bahrain', 'Bahrain', 'Middle East'),
  -- East Asia
  ('843', 'Beijing', 'China', 'East Asia'),
  ('850', 'Busan', 'South Korea', 'East Asia'),
  ('849', 'Seoul', 'South Korea', 'East Asia'),
  ('844', 'Shanghai', 'China', 'East Asia'),
  ('847', 'Tokyo', 'Japan', 'East Asia'),
  ('848', 'Osaka', 'Japan', 'East Asia'),
  ('845', 'Hong Kong', 'China', 'East Asia'),
  -- Southeast Asia (others)
  ('910', 'Bali', 'Indonesia', 'Southeast Asia'),
  ('857', 'Cebu', 'Philippines', 'Southeast Asia'),
  ('858', 'Boracay', 'Philippines', 'Southeast Asia'),
  ('859', 'Colombo', 'Sri Lanka', 'South Asia'),
  ('863', 'Bagan', 'Myanmar', 'Southeast Asia'),
  -- Europe
  ('736', 'Amsterdam', 'Netherlands', 'Europe'),
  ('734', 'Barcelona', 'Spain', 'Europe'),
  ('747', 'Berlin', 'Germany', 'Europe'),
  ('758', 'Brussels', 'Belgium', 'Europe'),
  ('744', 'Budapest', 'Hungary', 'Europe'),
  ('759', 'Copenhagen', 'Denmark', 'Europe'),
  ('548', 'Athens', 'Greece', 'Europe'),
  ('547', 'Antalya', 'Turkey', 'Europe'),
  ('549', 'Bodrum', 'Turkey', 'Europe'),
  ('550', 'Crete', 'Greece', 'Europe'),
  ('755', 'Amalfi Coast', 'Italy', 'Europe'),
  ('756', 'Cinque Terre', 'Italy', 'Europe'),
  ('728', 'London', 'UK', 'Europe'),
  -- Africa
  ('528', 'Cairo', 'Egypt', 'Africa'),
  ('521', 'Cape Town', 'South Africa', 'Africa'),
  ('530', 'Accra', 'Ghana', 'Africa'),
  ('526', 'Casablanca', 'Morocco', 'Africa'),
  -- Oceania
  ('364', 'Brisbane', 'Australia', 'Oceania'),
  ('366', 'Cairns', 'Australia', 'Oceania'),
  ('367', 'Adelaide', 'Australia', 'Oceania'),
  ('371', 'Auckland', 'New Zealand', 'Oceania'),
  ('374', 'Christchurch', 'New Zealand', 'Oceania'),
  -- Americas
  ('766', 'Buenos Aires', 'Argentina', 'South America'),
  ('786', 'Bogota', 'Colombia', 'South America'),
  ('788', 'Cartagena', 'Colombia', 'South America'),
  ('796', 'Bahamas', 'Bahamas', 'Caribbean'),
  ('797', 'Aruba', 'Aruba', 'Caribbean'),
  ('798', 'Barbados', 'Barbados', 'Caribbean'),
  ('802', 'Bermuda', 'Bermuda', 'Caribbean'),
  ('911', 'Cancún', 'Mexico', 'North America'),
  ('917', 'Costa Rica', 'Costa Rica', 'Central America'),
  -- Unknown IDs found in cache - map to best guess
  ('22495', 'Kolkata', 'India', 'South Asia'),
  ('276', 'Delhi', 'India', 'South Asia'),
  ('22171', 'Kolkata', 'India', 'South Asia'),
  ('23475', 'Kolkata', 'India', 'South Asia'),
  ('24350', 'Kolkata', 'India', 'South Asia'),
  ('25511', 'Kolkata', 'India', 'South Asia'),
  ('34206', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('37757', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('4371', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('463', 'Dubai', 'UAE', 'Middle East'),
  ('432', 'Dubai', 'UAE', 'Middle East'),
  ('50286', 'Singapore', 'Singapore', 'Southeast Asia'),
  ('669', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('671', 'Kuala Lumpur', 'Malaysia', 'Southeast Asia'),
  ('792', 'Nassau', 'Bahamas', 'Caribbean'),
  ('794', 'San Juan', 'Puerto Rico', 'Caribbean'),
  ('827', 'Punta Cana', 'Dominican Republic', 'Caribbean'),
  ('5290', 'New York', 'USA', 'North America'),
  ('4141', 'Los Angeles', 'USA', 'North America'),
  ('4316', 'San Francisco', 'USA', 'North America'),
  ('50206', 'Miami', 'USA', 'North America'),
  ('21768', 'Kolkata', 'India', 'South Asia')
ON CONFLICT (dest_id) DO UPDATE SET city_name = EXCLUDED.city_name, country = EXCLUDED.country, region = EXCLUDED.region;
