-- 重构数据库 schema，移除 Supabase Auth 依赖

-- 创建自定义用户表
CREATE TABLE IF NOT EXISTS users (
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
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 修改 essay_submissions 表，移除对 auth.users 的依赖
ALTER TABLE essay_submissions DROP CONSTRAINT IF EXISTS essay_submissions_user_id_fkey;
ALTER TABLE essay_submissions ADD CONSTRAINT essay_submissions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 更新 RLS 策略
DROP POLICY IF EXISTS "Users can insert their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can update their own submissions" ON essay_submissions;
DROP POLICY IF EXISTS "Users can view grades for their submissions" ON essay_grades;

-- 暂时禁用 RLS（后续可以根据需要重新启用）
ALTER TABLE essay_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE essay_grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户注册（插入 users 表）
CREATE POLICY "Allow anonymous registration"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 允许认证用户查看自己的信息
CREATE POLICY "Users can view their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 允许认证用户更新自己的信息
CREATE POLICY "Users can update their own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 创建函数：检查每日使用次数
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

-- 创建函数：增加每日使用次数
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
