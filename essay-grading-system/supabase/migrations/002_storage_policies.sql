-- Storage RLS Policies for essay-images bucket

-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'essay-images' AND
  (storage.foldername(name))[1] = 'submissions'
);

-- Allow authenticated users to read their own images
CREATE POLICY "Users can read their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'essay-images' AND
  (storage.foldername(name))[1] = 'submissions'
);

-- Allow service role to read all images (for Edge Functions)
CREATE POLICY "Service role can read all images"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'essay-images');

-- Allow service role to upload images
CREATE POLICY "Service role can upload images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'essay-images');
