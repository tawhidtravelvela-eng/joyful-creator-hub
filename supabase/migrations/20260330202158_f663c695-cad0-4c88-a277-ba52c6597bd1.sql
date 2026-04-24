UPDATE tour_sync_state 
SET status = 'syncing', 
    priority = 100, 
    search_hit_count = COALESCE(search_hit_count, 0) + 5, 
    started_at = now(), 
    updated_at = now() 
WHERE destination_id = '662';