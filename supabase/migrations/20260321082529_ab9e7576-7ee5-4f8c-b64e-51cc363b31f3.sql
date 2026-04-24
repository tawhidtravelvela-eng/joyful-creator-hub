-- Delete old 12-digit hotel IDs that don't work with Tripjack search API
-- The static API returns hotelId (8-digit, valid for search) and tjHotelId (12-digit, internal only)
-- Old sync incorrectly stored 12-digit IDs
DELETE FROM tripjack_hotels WHERE length(tj_hotel_id::text) > 10;

-- Also rebuild city_hotel_map to only contain valid 8-digit IDs
DELETE FROM tripjack_city_hotel_map WHERE true;