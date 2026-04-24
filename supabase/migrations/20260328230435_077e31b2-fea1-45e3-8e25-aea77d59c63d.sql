-- Clear stale hotel search cache entries that may contain zero-price results
DELETE FROM hotel_search_cache;