UPDATE api_settings SET is_active = false WHERE provider = 'tripjack_hotel';
UPDATE api_settings SET is_active = true WHERE provider = 'hotelston_hotel';