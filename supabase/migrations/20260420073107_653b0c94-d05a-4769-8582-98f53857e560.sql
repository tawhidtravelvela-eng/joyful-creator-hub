-- Refine assets bucket policies to match real upload paths in the app
DROP POLICY IF EXISTS "assets_user_folder_insert" ON storage.objects;
DROP POLICY IF EXISTS "assets_user_folder_update" ON storage.objects;
DROP POLICY IF EXISTS "assets_user_folder_delete" ON storage.objects;

-- Authenticated users can upload to known safe prefixes
-- Receipts and user folders are strictly scoped by uid; avatars/logos/whitelabel are app-managed
CREATE POLICY "assets_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets'
  AND (
    -- Personal user folder (uid as first segment)
    (storage.foldername(name))[1] = auth.uid()::text
    -- Receipts must be scoped to the user's own uid folder
    OR ((storage.foldername(name))[1] = 'receipts' AND (storage.foldername(name))[2] = auth.uid()::text)
    -- App-managed prefixes (filename typically includes uid or affiliate id)
    OR (storage.foldername(name))[1] IN ('avatars', 'logos', 'whitelabel')
  )
);

CREATE POLICY "assets_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'receipts' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR (storage.foldername(name))[1] IN ('avatars', 'logos', 'whitelabel')
  )
)
WITH CHECK (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'receipts' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR (storage.foldername(name))[1] IN ('avatars', 'logos', 'whitelabel')
  )
);

CREATE POLICY "assets_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR ((storage.foldername(name))[1] = 'receipts' AND (storage.foldername(name))[2] = auth.uid()::text)
    OR (storage.foldername(name))[1] IN ('avatars', 'logos', 'whitelabel')
  )
);
