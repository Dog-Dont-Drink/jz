# 开发指南

## 本地开发环境搭建

### 1. 克隆项目并安装依赖

```bash
cd essay-grading-system
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 Supabase 配置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

## 添加新题目

### 方法 1: 通过 Supabase Dashboard

1. 登录 Supabase Dashboard
2. 进入 Table Editor → essay_questions
3. 点击 "Insert row"
4. 填写字段：
   - title: 题目标题
   - year: 年份
   - province: 地区
   - category: 题型
   - prompt: 题目要求
   - material_text: 材料全文
   - material_summary: 材料摘要
   - standard_answer: 标准答案
   - scoring_points: 得分点（JSON 格式）
   - total_score: 总分

### 方法 2: 通过 SQL

```sql
INSERT INTO essay_questions (
  title, year, province, category, prompt,
  material_text, material_summary, standard_answer,
  scoring_points, total_score
) VALUES (
  '题目标题',
  2024,
  '国考',
  '归纳概括',
  '题目要求...',
  '材料全文...',
  '材料摘要...',
  '标准答案...',
  '[
    {"point": "得分点1", "score": 3},
    {"point": "得分点2", "score": 2}
  ]'::jsonb,
  20
);
```

## 调试 Edge Functions

### 本地运行 Edge Functions

```bash
# 安装 Supabase CLI
npm install -g supabase

# 启动本地 Supabase
supabase start

# 运行 Edge Functions
supabase functions serve --env-file supabase/functions/.env
```

### 查看日志

```bash
# 查看 OCR 函数日志
supabase functions logs ocr-recognize

# 查看评分函数日志
supabase functions logs grade-essay
```

## 修改评分规则

编辑 `supabase/functions/grade-essay/index.ts` 中的 `GRADING_PROMPT_TEMPLATE`：

```typescript
const GRADING_PROMPT_TEMPLATE = `你是一名资深公务员考试申论阅卷助手...

评分规则：
1. 修改这里的规则
2. 调整评分标准
...
`
```

重新部署：

```bash
supabase functions deploy grade-essay
```

## 调整 DeepSeek 参数

在 `grade-essay/index.ts` 中修改：

```typescript
body: JSON.stringify({
  model: 'deepseek-chat',
  messages: [...],
  response_format: { type: 'json_object' },
  temperature: 0.3,  // 调整这个值：0-1，越小越严格
})
```

## 自定义 UI 样式

所有页面使用 Tailwind CSS，可以直接修改组件中的 class：

```vue
<button class="bg-blue-600 hover:bg-blue-700 ...">
  按钮
</button>
```

修改全局样式：编辑 `src/style.css`

## 常见开发任务

### 添加新的筛选条件

1. 修改 `QuestionListPage.vue` 的 filters
2. 更新 `src/api/questions.ts` 的查询逻辑
3. 在数据库添加相应索引

### 修改评分结果展示

编辑 `GradeResultPage.vue`，调整布局和显示内容。

### 添加新的页面

1. 在 `src/pages/` 创建新组件
2. 在 `src/router/index.ts` 添加路由
3. 如需认证，添加 `meta: { requiresAuth: true }`

## 测试

### 测试 OCR

1. 准备一张手写答案图片
2. 登录系统
3. 选择题目
4. 上传图片
5. 查看 OCR 识别结果

### 测试评分

1. 完成 OCR 或手动输入答案
2. 提交评分
3. 查看评分结果
4. 检查得分点是否合理

## 性能优化建议

### 图片压缩

在上传前压缩图片：

```typescript
// 在 UploadAnswerPage.vue 中添加
const compressImage = async (file: File): Promise<File> => {
  // 使用 canvas 压缩图片
  // 返回压缩后的文件
}
```

### 懒加载

路由已配置懒加载：

```typescript
component: () => import('../pages/QuestionListPage.vue')
```

### 缓存优化

考虑添加题目列表缓存：

```typescript
// 在 Pinia store 中缓存
const questionsStore = defineStore('questions', () => {
  const cache = ref<EssayQuestion[]>([])
  // ...
})
```

## 故障排查

### 前端无法连接 Supabase

- 检查 `.env` 文件配置
- 确认 Supabase 项目状态
- 查看浏览器控制台错误

### OCR 识别失败

- 检查图片格式和大小
- 验证 BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY
- 查看 Edge Function 日志

### 评分返回错误

- 检查 DEEPSEEK_API_KEY
- 验证 API 余额
- 查看模型返回的原始数据

### RLS 权限错误

- 检查用户是否已登录
- 验证 RLS 策略配置
- 确认 user_id 匹配

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交代码
4. 发起 Pull Request

## 技术支持

遇到问题可以：
- 查看 README.md
- 查看 DEPLOYMENT.md
- 检查 Supabase 文档
- 查看 Edge Function 日志
