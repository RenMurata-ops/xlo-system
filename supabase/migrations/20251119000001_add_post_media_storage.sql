-- Create storage bucket for post media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for post-media bucket (drop if exists first)
DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view their own media" ON storage.objects;
CREATE POLICY "Users can view their own media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'post-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Public can view media" ON storage.objects;
CREATE POLICY "Public can view media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
