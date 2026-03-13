-- Add stable business code for questions (code -> uuid mapping)

ALTER TABLE essay_questions
ADD COLUMN IF NOT EXISTS code TEXT;

-- Enforce uniqueness for codes; Postgres allows multiple NULLs by default.
CREATE UNIQUE INDEX IF NOT EXISTS essay_questions_code_unique
ON essay_questions (code);

-- Backfill codes for built-in sample questions (idempotent)
UPDATE essay_questions
SET code = 'guokao_2024_01'
WHERE code IS NULL
  AND title = '归纳概括：概括当前基层治理面临的主要问题';

UPDATE essay_questions
SET code = 'guokao_2023_01'
WHERE code IS NULL
  AND title = '综合分析：分析"数字化转型"对传统产业的影响';

-- Backfill codes for 军转课后作业 questions (idempotent)
UPDATE essay_questions
SET code = 'junzhuan_2026_03_10_01'
WHERE code IS NULL
  AND title = '概括S市建设美丽水系、打造优美环境的主要措施';

UPDATE essay_questions
SET code = 'junzhuan_2026_03_10_02'
WHERE code IS NULL
  AND title = '概括Z省融合型大社区治理中的新问题与新解法';

UPDATE essay_questions
SET code = 'junzhuan_2026_03_11_03'
WHERE code IS NULL
  AND title = '概括L县"苹果产业后整理"的主要举措';

UPDATE essay_questions
SET code = 'junzhuan_2026_03_11_04'
WHERE code IS NULL
  AND title = '总结Z县打造现代田园综合体对乡村振兴的借鉴经验';

UPDATE essay_questions
SET code = 'junzhuan_2026_03_12_05'
WHERE code IS NULL
  AND title = '概括空巢老人面临的生存现状和心理问题';

UPDATE essay_questions
SET code = 'junzhuan_2026_03_12_06'
WHERE code IS NULL
  AND title = '概括我国智慧城市建设中的问题并总结主要经验';

UPDATE essay_questions
SET code = 'junzhuan_2026_03_13_07'
WHERE code IS NULL
  AND title = '分析企业群众办事中遇到的问题及Y区行政审批服务局的解决措施';

UPDATE essay_questions
SET code = 'junzhuan_2026_03_13_08'
WHERE code IS NULL
  AND title = '分析黄河滩区"四乱"现象难整治的原因';
