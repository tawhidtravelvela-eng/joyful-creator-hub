UPDATE api_settings 
SET settings = settings || '{"crisp_bot_channels": {"website": true, "whatsapp": false, "messenger": false, "instagram": false, "telegram": false, "email": false, "twitter": false, "line": false, "viber": false}}'::jsonb
WHERE provider = 'site_apps';