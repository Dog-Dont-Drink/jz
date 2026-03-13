# 快速启动指南

## 当前问题
注册时报错：`Could not find the table 'public.users' in the schema cache`

## 解决步骤

### 第一步：重建数据库

1. **打开 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 登录你的账号
   - 选择项目：`ujintrxvwehghlqimice`

2. **执行 SQL 迁移**
   - 点击左侧菜单 "SQL Editor"
   - 点击 "New query"
   - 打开文件：`supabase/migrations/006_recreate_all_tables.sql`
   - 复制全部内容（200行）
   - 粘贴到 SQL Editor
   - 点击 "Run" 执行

3. **验证数据库**
   执行以下 SQL 检查表是否创建成功：
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('users', 'essay_questions', 'essay_submissions', 'essay_grades');
   ```
   应该返回 4 个表名。

### 第二步：启动服务

1. **启动后端服务器**
   ```bash
   cd server
   npm start
   ```
   后端运行在：http://localhost:3001

2. **启动前端服务器**（新终端）
   ```bash
   npm run dev
   ```
   前端运行在：http://localhost:5186

### 第三步：测试注册

1. 打开浏览器访问：http://localhost:5186
2. 点击"注册账号"
3. 输入邮箱
4. 点击"发送验证码"
5. 查收邮件获取验证码
6. 完成注册

## 数据库表结构

### users（用户表）
- id, email, password_hash, username
- daily_check_count, daily_check_limit（每日使用限制）
- last_check_date, created_at, updated_at

### essay_questions（题库）
- id, title, year, province, category
- prompt, material_text, standard_answer
- scoring_points, total_score, tags

### essay_submissions（提交记录）
- id, user_id, question_id
- ocr_text, final_user_text
- ocr_status, grade_status

### essay_grades（评分记录）
- id, submission_id
- total_score, content_score, structure_score
- matched_points, missed_points
- overall_feedback, improvement_suggestions

## 常见问题

### Q: 数据库执行失败？
A: 确保在 Supabase Dashboard 的 SQL Editor 中执行，不要在本地执行。

### Q: 后端启动失败？
A: 检查 `server/.env` 文件是否存在，包含邮箱配置。

### Q: 验证码收不到？
A: 检查 163 邮箱授权码是否正确配置在 `server/.env` 中。

### Q: 前端页面空白？
A: 确保后端服务器已启动，检查浏览器控制台是否有错误。

## 文件说明

- `supabase/migrations/006_recreate_all_tables.sql` - 数据库迁移脚本
- `server/index.js` - 后端 API 服务器
- `server/.env` - 后端环境变量（邮箱配置）
- `.env` - 前端环境变量（API 地址等）
- `DATABASE_REBUILD.md` - 详细的数据库文档
- `DEPLOYMENT.md` - 部署文档

## 技术栈

- 前端：Vue 3 + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + Nodemailer
- 数据库：Supabase (PostgreSQL)
- OCR：LLM API (gpt-4o)
- 评分：DeepSeek API
