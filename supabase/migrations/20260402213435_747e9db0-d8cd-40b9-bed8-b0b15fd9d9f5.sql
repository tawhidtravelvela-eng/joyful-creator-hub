
CREATE OR REPLACE FUNCTION public.get_hotel_freshness(
  p_last_checked_at timestamptz,
  p_checkin date
)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_last_checked_at IS NULL THEN 'hard_stale'
    WHEN p_checkin - CURRENT_DATE > 30 
      THEN CASE WHEN now() - p_last_checked_at < interval '24 hours' THEN 'fresh'
                WHEN now() - p_last_checked_at < interval '48 hours' THEN 'soft_stale'
                ELSE 'hard_stale' END
    WHEN p_checkin - CURRENT_DATE > 7
      THEN CASE WHEN now() - p_last_checked_at < interval '6 hours' THEN 'fresh'
                WHEN now() - p_last_checked_at < interval '12 hours' THEN 'soft_stale'
                ELSE 'hard_stale' END
    ELSE
      CASE WHEN now() - p_last_checked_at < interval '60 minutes' THEN 'fresh'
           WHEN now() - p_last_checked_at < interval '2 hours' THEN 'soft_stale'
           ELSE 'hard_stale' END
  END;
$$;
