
UPDATE api_settings 
SET settings = jsonb_set(settings, '{environment}', '"test"')
WHERE provider = 'tripjack_flight';

UPDATE api_settings 
SET settings = jsonb_set(
      jsonb_set(settings, '{endpoint}', '"https://apac.universal-api.pp.travelport.com/B2BGateway/connect/uAPI/AirService"'),
      '{environment}', '"test"'
    )
WHERE provider = 'travelport';
