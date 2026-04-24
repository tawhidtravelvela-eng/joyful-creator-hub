
-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Debug logs: 24 hours
  DELETE FROM public.itinerary_change_logs WHERE created_at < now() - interval '24 hours';
  DELETE FROM public.itinerary_errors WHERE detected_at < now() - interval '24 hours';
  DELETE FROM public.ai_usage_logs WHERE created_at < now() - interval '24 hours';

  -- Draft trips: 3 days
  DELETE FROM public.saved_trips
  WHERE status = 'draft' AND updated_at < now() - interval '3 days';

  -- Saved (unconfirmed) trips: 7 days
  DELETE FROM public.saved_trips
  WHERE status IS DISTINCT FROM 'confirmed'
    AND status IS DISTINCT FROM 'booked'
    AND status != 'draft'
    AND updated_at < now() - interval '7 days';
END;
$$;
