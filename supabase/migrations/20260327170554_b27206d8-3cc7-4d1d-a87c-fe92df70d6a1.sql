
INSERT INTO public.blog_author_profiles (name, slug, bio, region, country, expertise, is_active, tenant_id) VALUES
-- Europe
('Elena Rossi', 'elena-rossi', 'Italian-born travel journalist who has explored over 40 countries across Europe and beyond. Elena specializes in cultural immersion, historic city guides, and Mediterranean travel. Her writing has been featured in leading European travel publications.', 'europe', 'IT', ARRAY['destinations', 'food-culture', 'hotel-guides'], true, NULL),
('James Whitfield', 'james-whitfield', 'London-based travel writer and photographer with a passion for off-the-beaten-path European destinations. James covers everything from budget backpacking routes to luxury escapes across the UK and continent.', 'europe', 'GB', ARRAY['budget-travel', 'adventure', 'travel-tips'], true, NULL),

-- North America
('Sarah Mitchell', 'sarah-mitchell', 'Award-winning travel editor based in New York, covering North American road trips, city breaks, and international travel from the Americas. Sarah brings a practical, budget-conscious perspective to every guide she writes.', 'north-america', 'US', ARRAY['flight', 'destinations', 'budget-travel'], true, NULL),
('Carlos Mendoza', 'carlos-mendoza', 'Mexican-American travel blogger and photographer specializing in Latin American destinations, cultural festivals, and adventure travel. Carlos writes in both English and Spanish, connecting readers to authentic local experiences.', 'americas', 'MX', ARRAY['adventure', 'food-culture', 'destinations'], true, NULL),

-- East Asia
('Yuki Tanaka', 'yuki-tanaka', 'Tokyo-based travel writer covering East Asian destinations with deep expertise in Japanese, Korean, and Chinese travel. Yuki focuses on blending traditional culture with modern city experiences and seasonal travel guides.', 'east-asia', 'JP', ARRAY['destinations', 'food-culture', 'travel-tips'], true, NULL),

-- Southeast Asia
('Linh Nguyen', 'linh-nguyen', 'Vietnamese travel journalist and digital nomad who has lived across Southeast Asia for over a decade. Linh writes comprehensive guides on budget travel, street food, and island hopping across the region.', 'southeast-asia', 'VN', ARRAY['budget-travel', 'food-culture', 'adventure'], true, NULL),

-- Africa
('Amara Osei', 'amara-osei', 'Ghanaian travel writer and safari specialist covering African destinations from bustling cities to remote wildlife reserves. Amara is passionate about showcasing the diversity and beauty of travel across the African continent.', 'africa', 'GH', ARRAY['adventure', 'destinations', 'travel-tips'], true, NULL),

-- Oceania
('Mia Collins', 'mia-collins', 'Australian travel writer and outdoor enthusiast based in Sydney. Mia covers Oceania and Asia-Pacific destinations with a focus on eco-travel, diving, and adventure tourism across Australia, New Zealand, and the Pacific Islands.', 'oceania', 'AU', ARRAY['adventure', 'hotel-guides', 'destinations'], true, NULL);
