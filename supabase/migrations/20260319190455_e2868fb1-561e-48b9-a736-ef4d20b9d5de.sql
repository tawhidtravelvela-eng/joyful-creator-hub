-- Enable Hotelston hotel provider
INSERT INTO api_settings (provider, is_active, settings)
VALUES ('hotelston_hotel', true, '{"environment":"production"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Disable other hotel providers
UPDATE api_settings SET is_active = false WHERE provider IN ('tripjack_hotel', 'agoda_hotel', 'travelvela_hotel');