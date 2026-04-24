-- Delete bad tour_sync_state rows where destination_id is not a numeric Viator ID
DELETE FROM tour_sync_state 
WHERE destination_id !~ '^\d+$';