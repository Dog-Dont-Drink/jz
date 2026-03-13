-- Simple RLS fix - Run this in Supabase SQL Editor
-- This will allow all authenticated users to perform operations

-- Disable RLS temporarily to clean up
ALTER TABLE essay_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE essay_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE essay_grades DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename;
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE essay_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_grades ENABLE ROW LEVEL SECURITY;

-- Simple policies for essay_questions
CREATE POLICY "questions_select" ON essay_questions FOR SELECT TO authenticated USING (true);

-- Simple policies for essay_submissions
CREATE POLICY "submissions_insert" ON essay_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "submissions_select" ON essay_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "submissions_update" ON essay_submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "submissions_delete" ON essay_submissions FOR DELETE TO authenticated USING (true);

-- Simple policies for essay_grades
CREATE POLICY "grades_select" ON essay_grades FOR SELECT TO authenticated USING (true);
CREATE POLICY "grades_insert" ON essay_grades FOR INSERT TO authenticated WITH CHECK (true);

-- Service role policies
CREATE POLICY "service_submissions_all" ON essay_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_grades_all" ON essay_grades FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Storage policies - drop all first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Simple storage policies
CREATE POLICY "storage_all_authenticated" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'essay-images') WITH CHECK (bucket_id = 'essay-images');
CREATE POLICY "storage_all_service" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'essay-images') WITH CHECK (bucket_id = 'essay-images');
