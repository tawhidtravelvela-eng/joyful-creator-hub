
-- Disable all flight/hotel providers
UPDATE api_settings SET is_active = false WHERE provider IN ('travelport', 'amadeus', 'travelvela', 'agoda', 'viator');

-- Insert or update tripjack as active with pre-production environment
INSERT INTO api_settings (provider, is_active, settings)
VALUES ('tripjack', true, '{"environment": "pre-production", "hotel_enabled": true, "flight_enabled": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- In case tripjack already exists, update it
UPDATE api_settings SET is_active = true, settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{environment}', '"pre-production"'
) || '{"hotel_enabled": true}'::jsonb
WHERE provider = 'tripjack';
