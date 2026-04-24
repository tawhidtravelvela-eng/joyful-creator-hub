INSERT INTO api_settings (provider, is_active, settings)
VALUES ('booking119_taxi', true, '{}')
ON CONFLICT DO NOTHING;