-- Complete RLS and Storage policies fix
-- Run this in Supabase SQL Editor

-- ============================================
-- Part 1: Fix Table RLS Policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read questions" ON essay_questions;
DROP POLICY IF EXISTS "Users can insert their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can update their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can view grades for their submissions" ON essay_grades;
DROP POLICY IF EXISTS "Service role can insert grades" ON essay_grades;
DROP POLICY IF EXISTS "Service role can update submissions" ON essay_submissions;

-- Enable Row Level Security
ALTER TABLE essay_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_grades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for essay_questions (all authenticated users can read)
CREATE POLICY "Allow authenticated users to read questions"
  ON essay_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for essay_submissions
CREATE POLICY "Users can insert their own submissions"
  ON essay_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own submissions"
  ON essay_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions"
  ON essay_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update submissions"
  ON essay_submissions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for essay_grades
CREATE POLICY "Users can view grades for their submissions"
  ON essay_grades
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM essay_submissions
      WHERE essay_submissions.id = essay_grades.submission_id
      AND essay_submissions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert grades"
  ON essay_grades
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================
-- Part 2: Fix Storage Policies
-- ============================================

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read all images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'essay-images' AND
  (storage.foldername(name))[1] = 'submissions'
);

-- Allow authenticated users to update images
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'essay-images' AND
  (storage.foldername(name))[1] = 'submissions'
)
WITH CHECK (
  bucket_id = 'essay-images' AND
  (storage.foldername(name))[1] = 'submissions'
);

-- Allow authenticated users to read images
CREATE POLICY "Users can read their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'essay-images' AND
  (storage.foldername(name))[1] = 'submissions'
);

-- Allow authenticated users to delete images
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'essay-images' AND
  (storage.foldername(name))[1] = 'submissions'
);

-- Allow service role full access (for Edge Functions)
CREATE POLICY "Service role can read all images"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'essay-images');

CREATE POLICY "Service role can upload images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'essay-images');

CREATE POLICY "Service role can update images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'essay-images')
WITH CHECK (bucket_id = 'essay-images');

CREATE POLICY "Service role can delete images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'essay-images');
