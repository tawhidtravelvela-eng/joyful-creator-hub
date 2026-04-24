UPDATE api_settings SET is_active = true WHERE provider = 'tripjack_hotel';

INSERT INTO api_settings (provider, is_active, settings)
VALUES ('hotelston', false, '{"environment":"test"}'::jsonb)
ON CONFLICT DO NOTHING;