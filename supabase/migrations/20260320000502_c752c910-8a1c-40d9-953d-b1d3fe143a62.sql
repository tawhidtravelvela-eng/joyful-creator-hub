
-- Hotel search sessions for session-based caching with sort/filter/paginate
CREATE TABLE public.hotel_search_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  search_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  hotels jsonb NOT NULL DEFAULT '[]'::jsonb,
  hotel_count integer NOT NULL DEFAULT 0,
  provider_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_currency text NOT NULL DEFAULT 'BDT',
  status text NOT NULL DEFAULT 'searching',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX idx_hotel_search_sessions_session_id ON public.hotel_search_sessions(session_id);
CREATE INDEX idx_hotel_search_sessions_expires ON public.hotel_search_sessions(expires_at);

ALTER TABLE public.hotel_search_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage hotel_search_sessions"
  ON public.hotel_search_sessions FOR ALL TO service_role
  USING (true);

CREATE POLICY "Public read hotel_search_sessions"
  ON public.hotel_search_sessions FOR SELECT TO anon, authenticated
  USING (true);

-- Supplier mapping table for cross-supplier hotel deduplication
CREATE TABLE public.hotel_supplier_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_hotel_id text NOT NULL,
  supplier text NOT NULL,
  supplier_hotel_id text NOT NULL,
  hotel_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  latitude numeric,
  longitude numeric,
  confidence numeric NOT NULL DEFAULT 1.0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(supplier, supplier_hotel_id)
);

CREATE INDEX idx_hotel_supplier_mappings_internal ON public.hotel_supplier_mappings(internal_hotel_id);
CREATE INDEX idx_hotel_supplier_mappings_supplier ON public.hotel_supplier_mappings(supplier, supplier_hotel_id);
CREATE INDEX idx_hotel_supplier_mappings_city ON public.hotel_supplier_mappings(city);

ALTER TABLE public.hotel_supplier_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage hotel_supplier_mappings"
  ON public.hotel_supplier_mappings FOR ALL TO service_role
  USING (true);

CREATE POLICY "Public read hotel_supplier_mappings"
  ON public.hotel_supplier_mappings FOR SELECT TO anon, authenticated
  USING (true);

-- Cleanup function for expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_hotel_search_sessions()
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  DELETE FROM public.hotel_search_sessions WHERE expires_at < now();
$$;
