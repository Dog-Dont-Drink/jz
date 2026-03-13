-- ============================================
-- 完整重建数据库 Schema
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
-- 3. 创建 essay_questions 表（题库）
-- ============================================
CREATE TABLE essay_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  year INTEGER,
  province TEXT,
  category TEXT,
  prompt TEXT NOT NULL,
  material_text TEXT,
  material_summary TEXT,
  standard_answer TEXT,
  scoring_points JSONB DEFAULT '[]'::jsonb,
  total_score NUMERIC DEFAULT 100,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_questions_year ON essay_questions(year);
CREATE INDEX idx_questions_province ON essay_questions(province);
CREATE INDEX idx_questions_category ON essay_questions(category);
CREATE INDEX idx_questions_tags ON essay_questions USING GIN(tags);

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

-- 如果需要启用 RLS，可以使用以下策略：
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own data" ON users FOR SELECT USING (id = auth.uid());
-- CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (id = auth.uid());

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
-- 8. 插入示例数据（可选）
-- ============================================

-- 插入一个测试题目
INSERT INTO essay_questions (title, year, province, category, prompt, material_text, material_summary, standard_answer, scoring_points, total_score, tags) VALUES
(
  '归纳概括：概括当前基层治理面临的主要问题',
  2024,
  '国考',
  '归纳概括',
  '根据给定资料，概括当前基层治理面临的主要问题。要求：全面、准确、简明，不超过 200 字。',
  '材料1：某社区居委会主任反映，社区工作人员严重不足，平均每人要服务 800 多户居民。社区承担了大量行政事务，如统计报表、检查迎检等，占用了大量时间和精力。居民参与社区事务的积极性不高，很多活动都是工作人员"唱独角戏"。

材料2：调研发现，基层治理中存在"上面千条线，下面一根针"的现象。上级部门层层加码，各种考核、检查名目繁多，基层疲于应付。同时，基层治理资源分散，各部门各自为政，缺乏统筹协调。

材料3：某街道办事处反映，基层治理信息化水平不高，数据孤岛现象严重。居民诉求渠道不畅通，问题反映后得不到及时回应。基层工作人员待遇偏低，人才流失严重。',
  '基层治理面临人员不足、行政事务繁重、居民参与度低、上级层层加码、资源分散、信息化水平低、诉求渠道不畅、人才流失等问题。',
  '当前基层治理主要问题包括：一是人员配置不足，工作人员服务居民数量过多；二是行政事务繁重，占用大量时间精力；三是居民参与度低，缺乏积极性；四是上级层层加码，考核检查过多；五是资源分散，缺乏统筹协调；六是信息化水平不高，数据孤岛严重；七是诉求渠道不畅，回应不及时；八是待遇偏低，人才流失严重。',
  '[
    {"point": "人员配置不足", "score": 2},
    {"point": "行政事务繁重", "score": 2},
    {"point": "居民参与度低", "score": 2},
    {"point": "上级层层加码、考核检查多", "score": 3},
    {"point": "资源分散、缺乏统筹", "score": 2},
    {"point": "信息化水平低、数据孤岛", "score": 2},
    {"point": "诉求渠道不畅、回应不及时", "score": 2},
    {"point": "待遇偏低、人才流失", "score": 2}
  ]',
  17,
  ARRAY['2024', '国考', '归纳概括']
);

-- ============================================
-- 完成！
-- ============================================
