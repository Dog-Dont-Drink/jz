# 项目结构

```
essay-grading-system/
├── src/
│   ├── api/                    # API 调用封装
│   │   ├── questions.ts        # 题目相关 API
│   │   └── submissions.ts      # 提交和评分相关 API
│   ├── lib/                    # 第三方库配置
│   │   └── supabase.ts         # Supabase 客户端初始化
│   ├── pages/                  # 页面组件
│   │   ├── WelcomePage.vue     # 欢迎页
│   │   ├── LoginPage.vue       # 登录页
│   │   ├── RegisterPage.vue    # 注册页
│   │   ├── QuestionListPage.vue    # 题库列表页
│   │   ├── QuestionDetailPage.vue  # 题目详情页
│   │   ├── UploadAnswerPage.vue    # 上传答案页
│   │   ├── OCRConfirmPage.vue      # OCR 确认页
│   │   ├── GradeResultPage.vue     # 评分结果页
│   │   └── HistoryPage.vue         # 历史记录页
│   ├── router/                 # 路由配置
│   │   └── index.ts            # 路由定义和守卫
│   ├── stores/                 # 状态管理
│   │   └── auth.ts             # 认证状态管理
│   ├── types/                  # TypeScript 类型定义
│   │   └── index.ts            # 全局类型
│   ├── App.vue                 # 根组件
│   ├── main.ts                 # 应用入口
│   └── style.css               # 全局样式
├── supabase/
│   ├── functions/              # Edge Functions
│   │   ├── ocr-recognize/      # OCR 识别函数
│   │   │   └── index.ts
│   │   └── grade-essay/        # 评分函数
│   │       └── index.ts
│   ├── migrations/             # 数据库迁移
│   │   ├── 001_initial_schema.sql      # 初始表结构
│   │   └── 002_storage_policies.sql    # Storage RLS 策略
│   └── SECRETS.md              # 环境变量配置说明
├── public/                     # 静态资源
├── .env.example                # 环境变量示例
├── .gitignore                  # Git 忽略文件
├── DEPLOYMENT.md               # 部署指南
├── README.md                   # 项目说明
├── index.html                  # HTML 入口
├── package.json                # 项目依赖
├── postcss.config.js           # PostCSS 配置
├── tailwind.config.js          # Tailwind CSS 配置
├── tsconfig.json               # TypeScript 配置
├── tsconfig.app.json           # 应用 TypeScript 配置
├── tsconfig.node.json          # Node TypeScript 配置
└── vite.config.ts              # Vite 配置
```

## 核心文件说明

### 前端核心

- **src/main.ts**: 应用入口，初始化 Vue、Pinia、Router 和 Auth
- **src/router/index.ts**: 路由配置，包含路由守卫保护需要登录的页面
- **src/stores/auth.ts**: 认证状态管理，处理登录、注册、登出和 session 恢复
- **src/lib/supabase.ts**: Supabase 客户端配置

### API 层

- **src/api/questions.ts**: 题目查询 API
- **src/api/submissions.ts**: 提交、上传、OCR、评分 API

### 页面组件

所有页面都采用移动端优先设计，使用 Tailwind CSS 实现响应式布局。

### 后端 Edge Functions

- **ocr-recognize**: 接收 submissionId，从 Storage 读取图片，调用百度 OCR 识别文字
- **grade-essay**: 接收 submissionId，调用 DeepSeek API 进行智能评分

### 数据库

- **001_initial_schema.sql**: 创建 3 个核心表和 RLS 策略
- **002_storage_policies.sql**: 配置 Storage bucket 的访问策略
