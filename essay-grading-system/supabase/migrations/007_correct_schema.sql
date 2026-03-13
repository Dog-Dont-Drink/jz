-- ============================================
-- 完整重建数据库 Schema（匹配实际题目结构）
-- 删除所有旧表，重新创建干净的数据库结构
-- ============================================

-- 1. 删除所有旧表和相关对象
DROP TABLE IF EXISTS essay_grades CASCADE;
DROP TABLE IF EXISTS essay_submissions CASCADE;
DROP TABLE IF EXISTS essay_questions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除旧的函数
DROP FUNCTION IF EXISTS check_daily_limit(UUID);
DROP FUNCTION IF EXISTS increment_daily_check(UUID);

-- ============================================
-- 2. 创建 users 表（自定义用户表）
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT,
  daily_check_count INTEGER DEFAULT 0,
  daily_check_limit INTEGER DEFAULT 2,
  last_check_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_check_date ON users(last_check_date);

-- ============================================
-- 3. 创建 essay_questions 表（题库）- 匹配实际结构
-- ============================================
CREATE TABLE essay_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_code TEXT UNIQUE,
  date_tag TEXT,
  exercise_no INTEGER,
  title TEXT NOT NULL,
  category TEXT,
  question_text TEXT,
  requirements TEXT,
  total_score NUMERIC,
  word_limit INTEGER,
  material_text TEXT,
  standard_answer TEXT,
  answer_outline JSONB DEFAULT '[]'::jsonb,
  scoring_points JSONB DEFAULT '[]'::jsonb,
  source JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_questions_question_code ON essay_questions(question_code);
CREATE INDEX idx_questions_date_tag ON essay_questions(date_tag);
CREATE INDEX idx_questions_category ON essay_questions(category);
CREATE INDEX idx_questions_exercise_no ON essay_questions(exercise_no);

-- ============================================
-- 4. 创建 essay_submissions 表（提交记录）
-- ============================================
CREATE TABLE essay_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
  image_path TEXT,
  ocr_text TEXT,
  final_user_text TEXT DEFAULT '',
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  grade_status TEXT DEFAULT 'pending' CHECK (grade_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_submissions_user_id ON essay_submissions(user_id);
CREATE INDEX idx_submissions_question_id ON essay_submissions(question_id);
CREATE INDEX idx_submissions_created_at ON essay_submissions(created_at DESC);

-- ============================================
-- 5. 创建 essay_grades 表（评分记录）
-- ============================================
CREATE TABLE essay_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES essay_submissions(id) ON DELETE CASCADE,
  total_score NUMERIC DEFAULT 0,
  content_score NUMERIC DEFAULT 0,
  structure_score NUMERIC DEFAULT 0,
  expression_score NUMERIC DEFAULT 0,
  matched_points JSONB DEFAULT '[]'::jsonb,
  missed_points JSONB DEFAULT '[]'::jsonb,
  deduction_points JSONB DEFAULT '[]'::jsonb,
  overall_feedback TEXT,
  improvement_suggestions JSONB DEFAULT '[]'::jsonb,
  raw_model_output JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_grades_submission_id ON essay_grades(submission_id);

-- ============================================
-- 6. 配置 Row Level Security (RLS)
-- ============================================

-- 禁用所有表的 RLS（简化开发，生产环境建议启用）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE essay_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE essay_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE essay_grades DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. 创建辅助函数
-- ============================================

-- 检查每日使用次数限制
CREATE OR REPLACE FUNCTION check_daily_limit(user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
  today DATE;
BEGIN
  today := CURRENT_DATE;

  SELECT * INTO user_record FROM users WHERE id = user_id_param;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 如果是新的一天，重置计数
  IF user_record.last_check_date IS NULL OR user_record.last_check_date < today THEN
    UPDATE users
    SET daily_check_count = 0, last_check_date = today
    WHERE id = user_id_param;
    RETURN TRUE;
  END IF;

  -- 检查是否超过限制
  IF user_record.daily_check_count >= user_record.daily_check_limit THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 增加每日使用次数
CREATE OR REPLACE FUNCTION increment_daily_check(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET daily_check_count = daily_check_count + 1,
      last_check_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 完成！现在可以插入你的题目数据了
-- ============================================
