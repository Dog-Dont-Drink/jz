# API 文档

## 前端 API

### Questions API

#### getQuestions(filters?)

获取题目列表

**参数:**
```typescript
filters?: {
  year?: number
  province?: string
  category?: string
  search?: string
}
```

**返回:**
```typescript
Promise<EssayQuestion[]>
```

**示例:**
```typescript
import { questionApi } from '@/api/questions'

const questions = await questionApi.getQuestions({
  year: 2024,
  province: '国考',
  category: '归纳概括'
})
```

#### getQuestionById(id)

获取单个题目详情

**参数:**
```typescript
id: string
```

**返回:**
```typescript
Promise<EssayQuestion>
```

### Submissions API

#### createSubmission(questionId, userId)

创建新的提交记录

**参数:**
```typescript
questionId: string
userId: string
```

**返回:**
```typescript
Promise<EssaySubmission>
```

#### uploadImage(file, submissionId)

上传答题图片到 Storage

**参数:**
```typescript
file: File
submissionId: string
```

**返回:**
```typescript
Promise<string> // 返回文件路径
```

#### performOCR(submissionId)

执行 OCR 识别

**参数:**
```typescript
submissionId: string
```

**返回:**
```typescript
Promise<{
  success: boolean
  text?: string
  error?: string
}>
```

#### performOCRFromFileViaEdge(file)

直接把图片（base64）发给后端 OCR（Edge Function），不依赖 Storage。

**参数:**
```typescript
file: File
```

**返回:**
```typescript
Promise<{
  success: boolean
  text?: string
  raw?: any
  error?: string
}>
```

#### updateFinalText(submissionId, finalText)

更新用户最终确认的答案文本

**参数:**
```typescript
submissionId: string
finalText: string
```

#### requestGrading(submissionId)

请求 AI 评分

**参数:**
```typescript
submissionId: string
```

**返回:**
```typescript
Promise<{
  success: boolean
  grade?: GradeResult
  error?: string
}>
```

#### getSubmissionById(submissionId)

获取提交详情（包含题目和评分）

**参数:**
```typescript
submissionId: string
```

**返回:**
```typescript
Promise<SubmissionWithDetails>
```

#### getUserSubmissions(userId)

获取用户的所有提交记录

**参数:**
```typescript
userId: string
```

**返回:**
```typescript
Promise<SubmissionWithDetails[]>
```

## Edge Functions API

### OCR Recognize Function

**Endpoint:** `https://your-project.supabase.co/functions/v1/ocr-recognize`

**Method:** POST

**Headers:**
```
Authorization: Bearer YOUR_ANON_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "submissionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "text": "识别的文字内容",
  "raw": { /* 百度 OCR 原始返回 */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "错误信息"
}
```

### Grade Essay Function

**Endpoint:** `https://your-project.supabase.co/functions/v1/grade-essay`

**Method:** POST

**Headers:**
```
Authorization: Bearer YOUR_ANON_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "submissionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "grade": {
    "total_score": 15,
    "content_score": 8,
    "structure_score": 4,
    "expression_score": 3,
    "matched_points": [
      {
        "point": "得分点描述",
        "reason": "给分理由",
        "score": 3
      }
    ],
    "missed_points": [
      {
        "point": "漏掉的得分点",
        "reason": "原因说明"
      }
    ],
    "deduction_points": [
      {
        "issue": "扣分问题",
        "reason": "扣分理由",
        "deduct_score": 2
      }
    ],
    "overall_feedback": "综合评价",
    "improvement_suggestions": [
      "改进建议1",
      "改进建议2"
    ]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 数据库表结构

### essay_questions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| title | TEXT | 题目标题 |
| year | INTEGER | 年份 |
| province | TEXT | 地区 |
| category | TEXT | 题型 |
| prompt | TEXT | 题目要求 |
| material_text | TEXT | 材料全文 |
| material_summary | TEXT | 材料摘要 |
| standard_answer | TEXT | 标准答案 |
| scoring_points | JSONB | 得分点数组 |
| total_score | NUMERIC | 总分 |
| tags | TEXT[] | 标签数组 |
| created_at | TIMESTAMPTZ | 创建时间 |

### essay_submissions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| question_id | UUID | 题目 ID |
| image_path | TEXT | 图片路径 |
| ocr_text | TEXT | OCR 识别文本 |
| final_user_text | TEXT | 用户最终文本 |
| ocr_status | TEXT | OCR 状态 |
| grade_status | TEXT | 评分状态 |
| created_at | TIMESTAMPTZ | 创建时间 |

### essay_grades

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| submission_id | UUID | 提交 ID |
| total_score | NUMERIC | 总分 |
| content_score | NUMERIC | 内容分 |
| structure_score | NUMERIC | 结构分 |
| expression_score | NUMERIC | 表达分 |
| matched_points | JSONB | 命中得分点 |
| missed_points | JSONB | 漏掉得分点 |
| deduction_points | JSONB | 扣分点 |
| overall_feedback | TEXT | 综合评价 |
| improvement_suggestions | JSONB | 改进建议 |
| raw_model_output | JSONB | 模型原始输出 |
| created_at | TIMESTAMPTZ | 创建时间 |

## TypeScript 类型定义

完整类型定义见 `src/types/index.ts`

## 错误处理

所有 API 调用都应该使用 try-catch 处理错误：

```typescript
try {
  const result = await questionApi.getQuestions()
} catch (error) {
  console.error('Error:', error)
  // 显示错误提示
}
```

## 认证

所有需要认证的 API 调用会自动携带 Supabase session token。

确保在调用前用户已登录：

```typescript
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
if (!authStore.isAuthenticated) {
  // 跳转到登录页
}
```
