-- One-shot redeploy SQL (schema + RLS + seed questions)
-- Run this in Supabase Dashboard -> SQL Editor after you reset/drop your public tables.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- Tables
-- =========================

CREATE TABLE IF NOT EXISTS essay_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
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

-- =========================
-- Indexes
-- =========================

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON essay_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_question_id ON essay_submissions(question_id);
CREATE INDEX IF NOT EXISTS idx_grades_submission_id ON essay_grades(submission_id);
CREATE INDEX IF NOT EXISTS idx_questions_year ON essay_questions(year);
CREATE INDEX IF NOT EXISTS idx_questions_province ON essay_questions(province);
CREATE INDEX IF NOT EXISTS idx_questions_category ON essay_questions(category);

-- Enforce uniqueness for codes; Postgres allows multiple NULLs by default.
CREATE UNIQUE INDEX IF NOT EXISTS essay_questions_code_unique
ON essay_questions (code);

-- =========================
-- RLS
-- =========================

ALTER TABLE essay_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_grades ENABLE ROW LEVEL SECURITY;

-- essay_questions: authenticated read
DROP POLICY IF EXISTS "Allow authenticated users to read questions" ON essay_questions;
CREATE POLICY "Allow authenticated users to read questions"
  ON essay_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- essay_submissions: per-user access
DROP POLICY IF EXISTS "Users can insert their own submissions" ON essay_submissions;
CREATE POLICY "Users can insert their own submissions"
  ON essay_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own submissions" ON essay_submissions;
CREATE POLICY "Users can view their own submissions"
  ON essay_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own submissions" ON essay_submissions;
CREATE POLICY "Users can update their own submissions"
  ON essay_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- essay_grades: user can read grades for their submissions; service role can insert
DROP POLICY IF EXISTS "Users can view grades for their submissions" ON essay_grades;
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

DROP POLICY IF EXISTS "Service role can insert grades" ON essay_grades;
CREATE POLICY "Service role can insert grades"
  ON essay_grades
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =========================
-- Seed questions (with code)
-- =========================

-- 国考示例
INSERT INTO essay_questions (
  code, title, year, province, category, prompt,
  material_text, material_summary, standard_answer, scoring_points, total_score, tags
) VALUES
(
  'guokao_2024_01',
  '归纳概括：概括当前基层治理面临的主要问题',
  2024,
  '国考',
  '归纳概括',
  '根据给定资料，概括当前基层治理面临的主要问题。要求：全面、准确、简明，不超过 200 字。',
  $$材料1：某社区居委会主任反映，社区工作人员严重不足，平均每人要服务 800 多户居民。社区承担了大量行政事务，如统计报表、检查迎检等，占用了大量时间和精力。居民参与社区事务的积极性不高，很多活动都是工作人员"唱独角戏"。

材料2：调研发现，基层治理中存在"上面千条线，下面一根针"的现象。上级部门层层加码，各种考核、检查名目繁多，基层疲于应付。同时，基层治理资源分散，各部门各自为政，缺乏统筹协调。

材料3：某街道办事处反映，基层治理信息化水平不高，数据孤岛现象严重。居民诉求渠道不畅通，问题反映后得不到及时回应。基层工作人员待遇偏低，人才流失严重。$$,
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
  ]'::jsonb,
  17,
  ARRAY[]::TEXT[]
),
(
  'guokao_2023_01',
  '综合分析：分析"数字化转型"对传统产业的影响',
  2023,
  '国考',
  '综合分析',
  '根据给定资料，分析"数字化转型"对传统产业的影响。要求：分析全面，条理清晰，不超过 300 字。',
  '材料描述了数字化转型如何改变传统制造业、零售业等行业，包括提高效率、降低成本、创新商业模式等积极影响，同时也带来了技术门槛、人才短缺、数据安全等挑战。',
  '数字化转型对传统产业既有积极影响也有挑战，需要企业主动适应变革。',
  $$数字化转型对传统产业的影响是双重的。积极方面：一是提高生产效率，通过自动化、智能化降低人工成本；二是优化供应链管理，实现精准预测和库存控制；三是创新商业模式，拓展线上线下融合渠道；四是提升客户体验，通过数据分析实现个性化服务。挑战方面：一是技术门槛高，中小企业转型困难；二是人才短缺，缺乏既懂业务又懂技术的复合型人才；三是数据安全风险增加；四是初期投入大，回报周期长。因此，传统产业需要因地制宜，循序渐进推进数字化转型。$$,
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
  ]'::jsonb,
  20,
  ARRAY[]::TEXT[]
)
ON CONFLICT (code) DO NOTHING;

-- 军转课后作业（含你用到的 junzhuan_2026_03_12_05）
INSERT INTO essay_questions (
  code, title, year, province, category, prompt,
  material_text, material_summary, standard_answer, scoring_points, total_score, tags
) VALUES
(
  'junzhuan_2026_03_10_01',
  '概括S市建设美丽水系、打造优美环境的主要措施',
  2026,
  '军转',
  '概括题',
  '根据"给定资料1"，概括S市为建设美丽水系、打造优美环境实施了哪些主要措施？要求：（1）分条归纳概括；（2）表述准确、完整；（3）不超过150字。',
  $$资料1：S市城市水系长120公里，水域面积630万平方米，水系两岸绿地面积1220万平方米。水系不仅是市民休闲观光、健身娱乐的重要场所，也是S市城市景观的重要组成部分。为认真落实市委、市政府"城市建设上水平、出品位"的整体要求，城市水系管理处将以建设"美丽水系"为总目标，努力打造优美环境。城市水系整体绿化效果不错，但部分河道仍存在绿量不足、缺少色彩、管护水平较低等问题。今年将在加强水系绿化管护的同时，重点对连心河两岸绿化水平进行提升：重要部位高标准绿化整治，增加乔木数量；一般绿地通过灌木、彩叶树及野花组合丰富色彩；在有条件的地方铺设管道24万米，实施喷灌浇水；由粗放管理向精细化管护转变。针对夜间照明不足，将维修不能使用的照明设施，并在需要照明的地段安装路灯，在节点部位选用艺术灯具。围绕便民提质工程，将继续增加公交线路，完善绿道，规划修建公共厕所、停车场等设施，并选择合适地点设立垂钓区。为解决执法难题，S市成立城市水系巡查大队，加大对侵占绿地、烧烤、破坏设施设备、私自下河游泳、河道排污等行为的执法力度。与此同时，大力强化安全体系建设，在危险河段加装防护栏、加栽绿篱和灌木、安装监控，并设置警示牌、悬挂警示标语、配备保安，维护河道安全秩序。$$,
  'S市通过提升绿化、完善照明、完善服务设施、加强安全监管等措施建设美丽水系。',
  '一、提升绿化水平。增加绿量；丰富色彩；提升管护质量；铺设管道；精细化管护。二、完善照明设施。安装路灯，维修照明设施，安装艺术灯具。三、完善服务设施。增加公交线路；修建停车场；完善绿道等服务设施。四、加强安全监管。成立巡查大队；加装防护栏、加栽绿植、安装监控、警示牌、配备保安，进行监管。',
  '[]'::jsonb,
  20,
  ARRAY['2026-03-10', '军转课后作业']
),
(
  'junzhuan_2026_03_10_02',
  '概括Z省融合型大社区治理中的新问题与新解法',
  2026,
  '军转',
  '概括题',
  '请根据"给定资料"，概括Z省在融合型大社区治理过程中遇到的新问题以及运用的新解法。要求：全面、准确、有条理。不超过400字。',
  $$Z省P市欣阳社区是典型的融合型大社区，人口密度大、单元构成复杂、利益需求多样、管理主体多元，而社区干部仅18人，传统管理服务方式已无法应对。针对问题，社区通过"掌上社区"App和基层治理综合信息平台实现问题上报和自动派发；通过一体化智能化公共数据平台和"活地图"实现疫情排查及党员、志愿者力量调度；省里科学划分、合理优化网格，在网格中设置微网格，构建"村（社区）—网格—微网格"治理体系。Y市搭建"微家园"线上空间，让居民发布需求、交流互动，推动邻里互助和公共服务精准配对。针对社区资源统筹调度不足、群众投诉问题复杂，推动乡镇及基层站所干部下沉到村（社区），多跨协同形成合力；同时开通政府部门、村（社区）与群众的三方对话机制。资料还强调技术手段再先进，也不能丢掉走街访巷"铁脚板"的老传统，并要防止重复收集数据增加基层压力。$$,
  'Z省融合型大社区面临规模大、人员多、管理难等问题，通过数字化赋能、科学划分网格、搭建公共服务平台、推动多元共治等措施解决。',
  $$新问题：1.社区规模大、人员多、构成复杂、利益需求多样、管理主体多元。2.网格划分过大、层级过多、力量不足。3.住户间比较陌生，邻里关系生疏。4.基层干部人员少，社区缺乏资源统筹调度能力。新解法：1.数字化赋能。建立一体化智能化公共数据平台，实现数据及时下发以及精准对接；开发"掌上社区"App；建立"活地图"。2.科学划分网格。增加网格密度，按楼道、楼栋设置微网格，构建"村（社区）—网格—微网格"治理体系。3.搭建公共服务平台。建立"微家园"，创造线上交流空间，提供精准公共服务。4.推动多元共治。促进乡镇及基层站所干部下沉基层，多跨协同形成合力；开通线上三方对话机制。$$,
  '[]'::jsonb,
  25,
  ARRAY['2026-03-10', '军转课后作业']
),
(
  'junzhuan_2026_03_11_03',
  '概括L县"苹果产业后整理"的主要举措',
  2026,
  '军转',
  '概括题',
  '根据"给定资料3"，请概括L县"苹果产业后整理"的主要举措。要求：（1）准确全面；（2）分条概括；（3）不超过200字。',
  $$资料3：L县通过现代化选果线检测苹果大小、糖度、瑕疵等，实现分级分选，提高苹果价值。金奇果业通过成立直播团队、建立大数据中心、在省城设立电商运营中心、全网开设40多家店铺，实现苹果和消费者无缝对接，助推电商和微商发展。县委县政府制定《苹果产业强县建设规划》，提出以"苹果产业后整理"为抓手做大做强苹果产业。面对苹果集中上市时价格波动和信息不对称问题，县里成立专门工作组，一方面到Z商品交易所学习，一方面请专家普及苹果期货知识，利用期货价格帮助果农预判价格、指导企业发展。当地苹果还打上"L县苹果""平安接福"等标签，强化品牌化经营。$$,
  'L县通过分级分选、网络推广、政策规划、利用期货信息、打造品牌等措施推进苹果产业后整理。',
  '1.进行分级分选，提高了苹果价值，实现了优果优价，以质论价。2.充分利用网络平台进行宣传、推广，延伸苹果产业链条。3.政府出台政策，制定苹果产业强县建设的规划，做大做强苹果产业。4.学习并利用期货信息，及时把握市场动态。5.打造本地品牌，提高农民积极性。',
  '[]'::jsonb,
  20,
  ARRAY['2026-03-11', '军转课后作业']
),
(
  'junzhuan_2026_03_11_04',
  '总结Z县打造现代田园综合体对乡村振兴的借鉴经验',
  2026,
  '军转',
  '经验总结题',
  '根据"给定材料2"，谈谈Z县打造现代田园综合体的过程对推进乡村振兴工作有哪些值得借鉴的经验。要求：1.紧扣资料，内容全面；2.表达准确，条理清晰；3.不超过300字。',
  $$给定材料2：Z县依托35.96万亩柑橘产业打造橘乡田园综合体。县里通过多次召开会议，邀请专家学者、企业家和在外工作人员出谋划策，最终决定立足传统和产业基础发展特色农业。推进交通、网络等基础设施建设，流转土地，提供岗位和技术培训，帮助群众实现分红、务工和承包经营。建设柑橘加工厂和完整产业链，发展橙汁、果酒、橘蓉、药物原料、有机肥、橘饲料等多元产品。坚持绿色发展，采用太阳能杀虫灯、生物有机肥，引入大型生态农业公司，实行公司化运作。还规划柑橘文化博览区、环湖湿地、智慧橘园等，推动农业与文化、旅游、体育等融合发展。$$,
  'Z县通过借智借力、完善设施、智能生产、绿色发展、文旅融合等措施打造田园综合体，为乡村振兴提供借鉴。',
  '1.借智借力，因地制宜。邀请专业人士、在外务工人员考察座谈，听取意见，立足传统和优势，因地制宜发展特色产业。2.完善设施，拓宽收入渠道。推进交通、网络设施建设；开展技术培训、提供工作岗位，增加经营性收入。3.智能生产，完善产业链条。推进智能化生产、精深加工，发展完整的产业链，实现经济效益最大化。4.绿色发展，参与市场竞争。减少农药用量，发展现代生态农业；优选招商企业，确定生态环保方向，实行公司化运作。5.文旅融合，发展复合产业。确定主导产业，推进农业文化旅游体育等多种产业融合的复合型农业。',
  '[]'::jsonb,
  20,
  ARRAY['2026-03-11', '军转课后作业']
),
(
  'junzhuan_2026_03_12_05',
  '概括空巢老人面临的生存现状和心理问题',
  2026,
  '军转',
  '概括题',
  '根据"给定资料1"，概括空巢老人面临的生存现状和心理问题。要求：全面、准确、有条理，不超过200字。',
  $$资料1：随着农村大量中青年外流，"空巢"家庭遍布农村地区。农村空巢老人大多年老体弱，生活自理能力不强，失去主要照料者，只能依靠老伴或孙辈照顾，若突然发病无人照应，养老问题令人担忧。子女常年在外，沟通时间少、频率低，老人常报喜不报忧，感情生活匮乏，部分丧偶老人出现抑郁、悲观厌世情绪。老人闲暇活动少，农村文体娱乐场所缺乏，生活单调枯燥。虽然新农合改善了一定医疗条件，但乡镇医院仍缺医少药，老人收入少、积蓄不多，又常年受慢性病困扰，陷入"没法治"和"治不起"的双重困境。$$,
  '空巢老人面临缺少照料、感情匮乏、生活单调、医疗困难等生存现状，以及孤独抑郁、缺乏安全感等心理问题。',
  '生存现状：1.老无所养，年老体弱，生活自理能力不强，缺少生活起居照顾；2.感情生活匮乏，与子女缺少沟通交流；3.生活单调枯燥，闲暇时间少，文体娱乐活动少；4.缺医少药，医疗承受力弱，被疾病困扰。心理问题：1.担忧养老问题，依存感缺失；2.孤独伤感抑郁，悲观厌世，幸福感缺失；3.内心空虚寂寞，充实感缺失；4.安全感缺失，害怕疾病。',
  '[]'::jsonb,
  20,
  ARRAY['2026-03-12', '军转课后作业']
),
(
  'junzhuan_2026_03_12_06',
  '概括我国智慧城市建设中的问题并总结主要经验',
  2026,
  '军转',
  '综合概括题',
  '根据给定材料1-7，找出我国智慧城市在建设中存在哪些问题，并总结智慧城市建设主要经验。要求：内容全面、概括准确、条理清晰、语言简洁，不超过400字。',
  $$给定材料1-7：材料介绍智慧城市建设背景、智慧医疗、智慧交通、政务热线整合、信息基础设施建设、威海智慧城市"2333建设"计划、专项资金和人才培养等经验，也指出我国智慧城市建设存在缺少统一理论和标准体系、部门之间信息孤岛严重、运营机制不健全、核心技术不足、便民惠民目标不清晰等问题。同时，材料通过老年人网上购票困难等案例，反映数字弱势群体难以共享数字红利；通过西班牙桑坦德"城市脉搏"等案例展示智慧城市中信息公开、公众参与和城市治理协同的重要性。$$,
  '我国智慧城市建设存在标准缺失、信息孤岛、机制不健全、技术不足、目标不明确等问题，需要整合资源、完善设施、确保资金、培养人才、提升便民服务。',
  $$一、问题：1.缺少统一的理论和标准体系，缺少智慧城市建设的总体标准；2.政府职能部门间的协调不够到位，信息管理的运营机制不健全，信息和资源共享不够；3.部分老年人及文化素质较低的数字弱势群体无法充分享受数字带来的便利服务；4.缺少核心技术，未能完全掌握高端芯片和传感器技术；5.实现信息化、便民、惠民的目标不明确。二、经验：1.整合资源信息。打破部门间的壁垒，实现信息共享，提高审批效率。2.完善基础设施。科学调研，发展信息产业园，推动信息产业发展，不断拓宽信息高速公路。3.确保资金投入。设立专项资金，并建立政府与企业多方参与、市场化运作的融资机制，鼓励民间资本参与。4.注重人才培养。整合教育资源，自主培养高技能人才，提供智力支持。5.实现与民方便。开发手机应用程序，让市民轻松获取信息，鼓励市民参与城市管理。$$,
  '[]'::jsonb,
  25,
  ARRAY['2026-03-12', '军转课后作业']
),
(
  'junzhuan_2026_03_13_07',
  '分析企业群众办事中遇到的问题及Y区行政审批服务局的解决措施',
  2026,
  '军转',
  '问题对策题',
  '根据"给定资料2"，请谈谈企业群众在办事中遇到了哪些问题，Y区行政审批服务局采取了什么措施予以解决。要求：（1）全面、准确、有条理；（2）200—250字。',
  $$给定资料2：Y区行政审批服务局围绕优化营商环境开展服务创新。企业在多地选址，原本办理分公司手续需要跑多个地方；群众首次办理业务时，不熟悉政策和操作流程。对此，Y区推出企业开办"611"服务，线上依托政务服务网实现"一次登录、一网通办"，线下设置企业开办专区，实现设立登记、公章刻制、银行开户、社保登记、发票申领、公积金登记等事项一站式办理、一日办结，并提供免费刻章、邮寄、复印、税务UK设备等"四免服务"。在大厅安排"红马甲"志愿者，提供咨询引导、帮办代办、智慧讲解、爱心帮助等服务。还建立25个微信群，每个群安排专人对接一类业务，全天候答疑解惑；定期召开业务分析会，形成精简处理模板，提升服务水平。$$,
  '企业群众办事面临跨区跑腿、不熟悉流程等问题，Y区通过推出611服务、提供志愿者服务、建立微信群答疑、定期总结归纳等措施解决。',
  $$问题：1.企业选址在多地，办手续需要跑多个地方。2.市民不了解相关政策及程序。解决措施：1.推出企业开办611服务。依托政务服务网开通线上业务系统，实现一次登录、一网通办；线下设置涉企事项优化集成，实现一站式办理、一日办结；推出各项免费服务，为企业节约成本。2.提供志愿者服务。志愿者驻守政务服务大厅，为群众提供精准服务，全程一对一指导，解决群众需求。3.线上实时答疑。建立微信群，安排专人负责业务，全天候答疑解惑，实现急事及时解决、小事情线上解决。4.不断总结归纳。定期召开业务分析会，把群众关注的问题进行分类，形成处理模板，提升业务水平。$$,
  '[]'::jsonb,
  20,
  ARRAY['2026-03-13', '军转课后作业']
),
(
  'junzhuan_2026_03_13_08',
  '分析黄河滩区"四乱"现象难整治的原因',
  2026,
  '军转',
  '原因分析题',
  '根据"给定资料1"，分析黄河滩区"四乱"现象难整治的原因。要求：紧扣材料，条理清晰，不超过400字。',
  $$资料1：黄河滩区曾出现儿童游乐园等乱建现象，开发商借黄河风景区"玩在黄河边"的噱头吸引游客，将滩区作为生财工具。滩区既是黄河河道组成部分，在行洪、蓄洪、沉沙和生态保护中作用重要，又涉及大量居民生产生活，人水争地矛盾突出。有关滩区保护的法律法规比较分散，有些条款较为宽松，缺乏震慑力。黄河滩区存在占地面积广、体量规模大、存留时间久的"四乱"问题，利益主体多元，多头管理、职能分散。黄河水利委员会、地方政府及自然资源、河务、生态环境、农业等多个部门分别承担不同监管职责，条块分割导致执法力量分散，难以有效监管。$$,
  '黄河滩区"四乱"现象难整治的原因包括利益主体多元、法律法规不完善、发展思路不科学、多头管理职能分散等。',
  $$"四乱"是指在黄河滩区"乱占、乱踩、乱堆、乱建"的现象。"四乱"现象难整治的原因有：一、利益主体多元。1.开发商受利益驱动，以黄河为噱头吸引游客，将黄河作为生财工具。2.滩区既是农田又有湿地保护区，人水争地矛盾突出。二、相关法律法规不完善。1.有关滩区保护的法律法规比较分散，难以形成拳头效应。2.有些法规条款制定比较宽松，缺乏震慑力。三、原有产业发展思路不科学。黄河滩地产业发展不符合黄河生态保护要求，与绿色发展思路背道而驰，未能平衡好发展与保护的关系。四、多头管理，职能分散。多个部门具有黄河监管职能，部门条块分割造成执法力量分散，难以有效监管。$$,
  '[]'::jsonb,
  25,
  ARRAY['2026-03-13', '军转课后作业']
)
ON CONFLICT (code) DO NOTHING;

-- NOTE: If you still want Storage upload, run `supabase/migrations/002_storage_policies.sql` separately.
