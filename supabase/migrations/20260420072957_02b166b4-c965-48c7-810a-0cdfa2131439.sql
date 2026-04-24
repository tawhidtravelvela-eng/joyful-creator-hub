-- 1. Storage: scope INSERT/UPDATE/DELETE on assets bucket to user's own folder
-- Drop overly permissive existing policies (if they exist)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname ILIKE '%assets%' OR policyname ILIKE '%authenticated%upload%' OR policyname ILIKE '%public%upload%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Public can READ from assets bucket (it's a public bucket)
CREATE POLICY "assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Authenticated users can only INSERT into their own folder: assets/{user_id}/...
CREATE POLICY "assets_user_folder_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can only UPDATE files in their own folder
CREATE POLICY "assets_user_folder_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can only DELETE files in their own folder
CREATE POLICY "assets_user_folder_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can manage all files in assets bucket
CREATE POLICY "assets_admin_all"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Note: service_role bypasses RLS automatically, so edge functions writing to
-- system folders (blog-images/, destinations/, etc.) continue to work.

-- 2. trip_search_cache: only service_role can mutate (no public UPDATE)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trip_search_cache'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.trip_search_cache', pol.policyname);
  END LOOP;
END $$;

-- Anyone can read cached results (cache is shared)
CREATE POLICY "trip_search_cache_public_read"
ON public.trip_search_cache FOR SELECT
USING (true);

-- Only service_role can write/update/delete (edge functions)
-- service_role bypasses RLS, so no INSERT/UPDATE/DELETE policies for anon/authenticated needed.

-- 3. hotel_search_snapshot: restrict raw payload exposure
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'hotel_search_snapshot'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hotel_search_snapshot', pol.policyname);
  END LOOP;
END $$;

-- Authenticated users only — no anonymous access to raw supplier payloads
CREATE POLICY "hotel_snapshot_authenticated_read"
ON public.hotel_search_snapshot FOR SELECT
TO authenticated
USING (true);

-- service_role handles writes (edge functions); no public mutation policies.

-- 4. Realtime channel authorization: users can only subscribe to their own topics
-- Topic convention: 'trip-{user_id}' or 'user-{user_id}-*'
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.policyname);
  END LOOP;
END $$;

-- Authenticated users can subscribe (SELECT) only to topics containing their user_id
CREATE POLICY "realtime_user_scoped_read"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

-- Authenticated users can broadcast (INSERT) only to topics containing their user_id
CREATE POLICY "realtime_user_scoped_write"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);
