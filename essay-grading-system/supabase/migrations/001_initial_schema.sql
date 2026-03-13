-- Create essay_questions table
CREATE TABLE IF NOT EXISTS essay_questions (
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

-- Create essay_submissions table
CREATE TABLE IF NOT EXISTS essay_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES essay_questions(id) ON DELETE CASCADE,
  image_path TEXT,
  ocr_text TEXT,
  final_user_text TEXT DEFAULT '',
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  grade_status TEXT DEFAULT 'pending' CHECK (grade_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create essay_grades table
CREATE TABLE IF NOT EXISTS essay_grades (
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON essay_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_question_id ON essay_submissions(question_id);
CREATE INDEX IF NOT EXISTS idx_grades_submission_id ON essay_grades(submission_id);
CREATE INDEX IF NOT EXISTS idx_questions_year ON essay_questions(year);
CREATE INDEX IF NOT EXISTS idx_questions_province ON essay_questions(province);
CREATE INDEX IF NOT EXISTS idx_questions_category ON essay_questions(category);

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

-- RLS Policies for essay_grades (users can only access grades for their submissions)
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

-- Insert sample questions
INSERT INTO essay_questions (title, year, province, category, prompt, material_text, material_summary, standard_answer, scoring_points, total_score) VALUES
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
  17
),
(
  '综合分析：分析"数字化转型"对传统产业的影响',
  2023,
  '国考',
  '综合分析',
  '根据给定资料，分析"数字化转型"对传统产业的影响。要求：分析全面，条理清晰，不超过 300 字。',
  '材料描述了数字化转型如何改变传统制造业、零售业等行业，包括提高效率、降低成本、创新商业模式等积极影响，同时也带来了技术门槛、人才短缺、数据安全等挑战。',
  '数字化转型对传统产业既有积极影响也有挑战，需要企业主动适应变革。',
  '数字化转型对传统产业的影响是双重的。积极方面：一是提高生产效率，通过自动化、智能化降低人工成本；二是优化供应链管理，实现精准预测和库存控制；三是创新商业模式，拓展线上线下融合渠道；四是提升客户体验，通过数据分析实现个性化服务。挑战方面：一是技术门槛高，中小企业转型困难；二是人才短缺，缺乏既懂业务又懂技术的复合型人才；三是数据安全风险增加；四是初期投入大，回报周期长。因此，传统产业需要因地制宜，循序渐进推进数字化转型。',
  '[
    {"point": "提高生产效率、降低成本", "score": 3},
    {"point": "优化供应链管理", "score": 2},
    {"point": "创新商业模式", "score": 3},
    {"point": "提升客户体验", "score": 2},
    {"point": "技术门槛高", "score": 2},
    {"point": "人才短缺", "score": 3},
    {"point": "数据安全风险", "score": 2},
    {"point": "初期投入大", "score": 2},
    {"point": "需因地制宜推进", "score": 1}
  ]',
  20
);
