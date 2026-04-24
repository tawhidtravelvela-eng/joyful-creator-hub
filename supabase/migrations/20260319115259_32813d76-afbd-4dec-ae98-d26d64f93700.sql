-- Enable Tripjack hotel with production environment, disable others
UPDATE api_settings 
SET is_active = true, 
    settings = COALESCE(settings, '{}'::jsonb) || '{"environment": "production"}'::jsonb
WHERE provider = 'tripjack_hotel';

-- Insert if not exists
INSERT INTO api_settings (provider, is_active, settings)
VALUES ('tripjack_hotel', true, '{"environment": "production"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Disable Agoda hotel
UPDATE api_settings SET is_active = false WHERE provider = 'agoda_hotel';

-- Disable Hotelston hotel  
UPDATE api_settings SET is_active = false WHERE provider = 'hotelston_hotel';