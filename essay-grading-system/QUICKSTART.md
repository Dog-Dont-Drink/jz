# 快速启动指南

## 项目已创建完成 ✅

恭喜！申论智能评分系统已经成功创建并构建通过。

## 项目位置

```
/Users/wangzhibo/Desktop/website/essay-grading-system/
```

## 立即开始

### 1. 进入项目目录

```bash
cd essay-grading-system
```

### 2. 配置 Supabase

#### 创建 Supabase 项目

1. 访问 https://supabase.com
2. 点击 "New Project"
3. 填写项目信息并创建
4. 等待项目初始化完成（约 2 分钟）

#### 获取配置信息

在 Supabase Dashboard：
1. 进入 Settings → API
2. 复制 `Project URL`
3. 复制 `anon public` key

#### 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

填入你的配置：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. 初始化数据库

在 Supabase Dashboard → SQL Editor 中：

1. 点击 "New query"
2. 复制并执行 `supabase/migrations/001_initial_schema.sql`
3. 再次点击 "New query"
4. 复制并执行 `supabase/migrations/002_storage_policies.sql`

### 4. 创建 Storage Bucket

> 可选：如果你不打算把图片上传到 Storage（仅做 OCR + 手动修正 + 评分），可以跳过此步骤。

在 Supabase Dashboard → Storage：

1. 点击 "New bucket"
2. 名称：`essay-images`
3. 选择 **Private**
4. 点击 "Create bucket"

### 5. 部署 Edge Functions

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 关联项目（在 Supabase Dashboard → Settings → General 找到 Reference ID）
supabase link --project-ref your-project-ref

# 部署 OCR 函数
supabase functions deploy ocr-recognize

# 部署评分函数
supabase functions deploy grade-essay
```

### 6. 配置 API Keys

#### 获取百度 OCR API Key / Secret Key

1. 访问百度智能云 AI 开放平台
2. 创建应用并开通文字识别能力
3. 获取 API Key / Secret Key

#### 获取 DeepSeek API Key

1. 访问 https://platform.deepseek.com
2. 注册账号
3. 创建 API Key

#### 设置 Edge Function 环境变量

```bash
supabase secrets set BAIDU_OCR_API_KEY=your_baidu_ocr_api_key
supabase secrets set BAIDU_OCR_SECRET_KEY=your_baidu_ocr_secret_key
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_key
```

### 7. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

## 测试流程

1. **注册账号**：使用邮箱注册
2. **登录系统**：使用注册的邮箱登录
3. **浏览题库**：查看预置的示例题目
4. **选择题目**：点击进入题目详情
5. **上传答案**：拍照或选择图片上传
6. **确认文本**：查看 OCR 识别结果并修正
7. **提交评分**：等待 AI 评分
8. **查看结果**：查看详细评分和建议
9. **历史记录**：查看所有作答记录

## 项目文档

- **README.md** - 项目概述和功能介绍
- **DEPLOYMENT.md** - 详细部署指南
- **DEVELOPMENT.md** - 开发指南和常见任务
- **API.md** - API 文档和类型定义
- **PROJECT_STRUCTURE.md** - 项目结构说明

## 核心功能

✅ 用户注册/登录/登出
✅ 题库浏览与筛选
✅ 拍照上传答案
✅ OCR 自动识别
✅ 手动输入/修正
✅ AI 智能评分
✅ 详细得分分析
✅ 改进建议
✅ 历史记录

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Tailwind CSS
- **状态**: Pinia + Vue Router
- **后端**: Supabase (Auth + Database + Storage + Edge Functions)
- **OCR**: 百度 OCR
- **AI**: DeepSeek API

## 常见问题

### Q: 构建失败？
A: 确保已安装 `@tailwindcss/postcss`：
```bash
npm install @tailwindcss/postcss
```

### Q: OCR 识别失败？
A: 系统提供手动输入兜底，用户可以直接输入答案。

### Q: 如何添加新题目？
A: 在 Supabase Dashboard → Table Editor → essay_questions 中插入数据。

### Q: 评分不准确？
A: 可以在 `supabase/functions/grade-essay/index.ts` 中调整 prompt 和 temperature。

## 下一步

1. 完成 Supabase 配置
2. 部署 Edge Functions
3. 测试完整流程
4. 添加更多题目
5. 根据需求定制 UI
6. 部署到生产环境

## 生产部署

### 前端部署到 Vercel

```bash
npm install -g vercel
vercel
```

在 Vercel Dashboard 设置环境变量。

### 前端部署到 Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod
```

在 Netlify Dashboard 设置环境变量。

## 技术支持

- 查看项目文档
- 检查 Supabase 日志
- 查看 Edge Function 日志：`supabase functions logs function-name`

## 项目特点

- ✅ **移动端优先**：专为手机端设计
- ✅ **完整可运行**：非伪代码，可直接使用
- ✅ **模块化架构**：清晰的代码组织
- ✅ **类型安全**：完整的 TypeScript 类型
- ✅ **易于扩展**：良好的架构设计
- ✅ **宽松评分**：不要求逐字照抄
- ✅ **兜底方案**：OCR 失败可手动输入

祝你使用愉快！🎉
