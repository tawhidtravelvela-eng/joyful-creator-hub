-- Delete 599 bad rows where tj_hotel_id has wrong format (>100B)
-- These are duplicates of correct rows already in the table from the recent sync
DELETE FROM public.tripjack_hotels
WHERE tj_hotel_id > 100000000000
  AND unica_id IS NOT NULL;