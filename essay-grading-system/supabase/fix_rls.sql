-- Fix RLS policies for essay grading system
-- Run this in Supabase SQL Editor

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read questions" ON essay_questions;
DROP POLICY IF EXISTS "Users can insert their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can update their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can view grades for their submissions" ON essay_grades;
DROP POLICY IF EXISTS "Service role can insert grades" ON essay_grades;

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

-- RLS Policies for essay_submissions (users can only access their own)
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

-- Allow Edge Functions (service_role) to insert grades
CREATE POLICY "Service role can insert grades"
  ON essay_grades
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow Edge Functions to update submissions (for OCR status)
CREATE POLICY "Service role can update submissions"
  ON essay_submissions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
