# 申论智能评分系统

移动端优先的申论手写答案拍照评分系统，支持 OCR 识别和 AI 智能评分。

## 技术栈

- **前端**: Vue 3 + Vite + TypeScript + Tailwind CSS
- **路由**: Vue Router
- **状态管理**: Pinia
- **后端**: Supabase (Auth + Database + Storage + Edge Functions)
- **OCR**: 百度 OCR（通用文字识别）
- **AI 评分**: DeepSeek API

## 功能特性

- ✅ 用户注册/登录/登出
- ✅ 题库浏览与筛选
- ✅ 拍照上传答案
- ✅ OCR 自动识别手写文字
- ✅ 手动输入/修正答案
- ✅ AI 智能评分
- ✅ 详细得分点分析
- ✅ 改进建议
- ✅ 历史记录查看

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 配置 Supabase

#### 3.1 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 创建新项目
3. 获取项目 URL 和 anon key

#### 3.2 运行数据库迁移

在 Supabase Dashboard 的 SQL Editor 中执行：

```bash
supabase/migrations/001_initial_schema.sql
```

#### 3.3 创建 Storage Bucket

> 可选：当前版本 OCR 支持“直接 base64 调用后端 OCR”，不需要把图片上传到 Storage；只有你想保存图片或使用基于 `submissionId + image_path` 的识别流程时才需要配置。

1. 进入 Storage 页面
2. 创建名为 `essay-images` 的 bucket
3. 设置为 **private**（私有）
4. 配置 RLS 策略：

```sql
-- Allow authenticated users to upload their own images
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'essay-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to read their own images
CREATE POLICY "Users can read their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'essay-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow service role to read all images
CREATE POLICY "Service role can read all images"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'essay-images');
```

#### 3.4 部署 Edge Functions

安装 Supabase CLI：

```bash
npm install -g supabase
```

登录并部署函数：

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy ocr-recognize
supabase functions deploy grade-essay
```

设置 Edge Function 环境变量：

```bash
supabase secrets set BAIDU_OCR_API_KEY=your_baidu_ocr_api_key
supabase secrets set BAIDU_OCR_SECRET_KEY=your_baidu_ocr_secret_key
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key
```

### 4. 获取 API Keys

#### 百度 OCR API Key / Secret Key

1. 访问百度智能云 AI 开放平台
2. 创建应用并开通文字识别能力
3. 获取 API Key / Secret Key

#### DeepSeek API Key

1. 访问 [DeepSeek](https://platform.deepseek.com)
2. 注册账号
3. 创建 API Key

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

## 项目结构

```
src/
├── api/              # API 调用封装
│   ├── questions.ts
│   └── submissions.ts
├── lib/              # 第三方库配置
│   └── supabase.ts
├── pages/            # 页面组件
│   ├── WelcomePage.vue
│   ├── LoginPage.vue
│   ├── RegisterPage.vue
│   ├── QuestionListPage.vue
│   ├── QuestionDetailPage.vue
│   ├── UploadAnswerPage.vue
│   ├── OCRConfirmPage.vue
│   ├── GradeResultPage.vue
│   └── HistoryPage.vue
├── router/           # 路由配置
│   └── index.ts
├── stores/           # 状态管理
│   └── auth.ts
├── types/            # TypeScript 类型
│   └── index.ts
├── App.vue
├── main.ts
└── style.css

supabase/
├── functions/        # Edge Functions
│   ├── ocr-recognize/
│   │   └── index.ts
│   └── grade-essay/
│       └── index.ts
└── migrations/       # 数据库迁移
    └── 001_initial_schema.sql
```

## 数据库表结构

### essay_questions
- 题目信息表
- 包含题干、材料、标准答案、得分点等

### essay_submissions
- 用户提交表
- 包含图片路径、OCR 文本、最终答案等

### essay_grades
- 评分结果表
- 包含总分、分项得分、得分点分析、改进建议等

## 核心流程

1. **用户注册/登录** → Supabase Auth
2. **浏览题库** → 从 essay_questions 表读取
3. **拍照上传** → 上传到 Supabase Storage
4. **OCR 识别** → 调用 ocr-recognize Edge Function
5. **确认答案** → 用户可手动修正 OCR 结果
6. **提交评分** → 调用 grade-essay Edge Function
7. **查看结果** → 展示详细评分和建议
8. **历史记录** → 查看所有作答记录

## 评分规则

系统采用宽松评分策略：
- 不要求逐字照抄标准答案
- 允许近义表达、同义替换
- 核心观点一致即可给分
- 适度宽容错别字和语病
- 重点关注要点完整性和逻辑性

## 部署

### 构建生产版本

```bash
npm run build
```

### 部署到 Vercel/Netlify

1. 连接 Git 仓库
2. 设置环境变量
3. 自动部署

## 注意事项

1. **百度 OCR 额度/计费**：以百度控制台为准（建议设置限额/告警）
2. **DeepSeek API 费用**：按 token 计费
3. **Supabase 免费版限制**：500MB 数据库，1GB 存储
4. **图片大小限制**：建议不超过 10MB
5. **私有 Storage**：图片不能直接公开访问

## 常见问题

### Q: OCR 识别失败怎么办？
A: 系统提供手动输入兜底方案，用户可以直接输入答案。

### Q: 评分不准确怎么办？
A: 可以调整 DeepSeek API 的 temperature 参数，或优化 prompt。

### Q: 如何添加新题目？
A: 在 Supabase Dashboard 的 Table Editor 中直接插入数据。

## License

MIT
