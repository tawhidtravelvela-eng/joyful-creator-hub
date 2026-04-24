-- Lock down hotels_catalogue: no direct reads from anon/authenticated.
-- Access only via SECURITY DEFINER RPCs (resolve_hotel_by_name, search_hotels_catalogue).

REVOKE ALL ON public.hotels_catalogue FROM PUBLIC;
REVOKE ALL ON public.hotels_catalogue FROM anon;
REVOKE ALL ON public.hotels_catalogue FROM authenticated;

-- service_role keeps full access for cron + edge-function internal use
GRANT SELECT ON public.hotels_catalogue TO service_role;