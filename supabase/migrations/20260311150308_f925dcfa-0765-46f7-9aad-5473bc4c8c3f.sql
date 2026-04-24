
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access on assets" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'assets');

CREATE POLICY "Admin insert on assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assets');
