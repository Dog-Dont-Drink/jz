# 数据格式显示问题修复

## 问题描述
1. 在题目列表页和题目详情页，`answer_outline` 和 `scoring_points` 字段显示为 JSON 格式字符串
2. 有些题目显示 `[object Object]`，这是因为题目没有答案要点，只有参考答案

## 根本原因
数据库中这些字段存储为 JSONB 类型：
- `answer_outline JSONB DEFAULT '[]'::jsonb`
- `scoring_points JSONB DEFAULT '[]'::jsonb`
- `source JSONB`

但前端 TypeScript 类型定义期望：
- `answer_outline: string | null`
- `scoring_points: ScoringPoint[]`
- `source: string | null`

## 解决方案
在 `src/api/questions.ts` 中添加数据转换函数 `normalizeQuestion()`，将数据库返回的 JSONB 格式转换为前端期望的格式。

### 转换逻辑（改进版）
```typescript
function normalizeQuestion(raw: any): EssayQuestion {
  // 处理 answer_outline - 如果为空则返回 null
  let answerOutline: string | null = null
  if (raw.answer_outline) {
    if (typeof raw.answer_outline === 'string') {
      answerOutline = raw.answer_outline.trim() || null
    } else if (Array.isArray(raw.answer_outline)) {
      const joined = raw.answer_outline
        .filter((item: any) => item && typeof item === 'string')
        .join('\n')
        .trim()
      answerOutline = joined || null
    }
  }

  // 处理 scoring_points - 过滤掉无效对象
  let scoringPoints: any[] = []
  if (raw.scoring_points) {
    if (Array.isArray(raw.scoring_points)) {
      scoringPoints = raw.scoring_points.filter((item: any) =>
        item && typeof item === 'object' && item.point
      )
    } else if (typeof raw.scoring_points === 'object') {
      scoringPoints = Object.values(raw.scoring_points).filter((item: any) =>
        item && typeof item === 'object' && item.point
      )
    }
  }

  // 处理 source
  let source: string | null = null
  if (raw.source) {
    if (typeof raw.source === 'string') {
      source = raw.source
    } else if (typeof raw.source === 'object') {
      source = raw.source.name || raw.source.source || null
    }
  }

  return {
    ...raw,
    answer_outline: answerOutline,
    scoring_points: scoringPoints,
    source: source,
  }
}
```

### 关键改进
1. **空值处理**：如果 `answer_outline` 为空或无效，返回 `null` 而不是空字符串或 `[object Object]`
2. **数组过滤**：只保留有效的对象（包含 `point` 字段）
3. **类型安全**：添加类型检查，避免显示 `[object Object]`

## 修改的文件
- `src/api/questions.ts`
  - 改进 `normalizeQuestion()` 函数
  - 在 `getQuestions()` 中使用 `.map(normalizeQuestion)`
  - 在 `getQuestionByIdentifier()` 中使用 `normalizeQuestion(data)`

## 前端显示逻辑
在 `QuestionDetailPage.vue` 中，使用 `v-if` 条件渲染：
```vue
<!-- 只在有内容时显示 -->
<div v-if="question.answer_outline" class="bg-white rounded-lg shadow-sm p-4 mb-4">
  <h3 class="font-semibold text-gray-800 mb-2">答案要点/提纲</h3>
  <div class="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
    {{ question.answer_outline }}
  </div>
</div>
```

## 测试验证
1. ✅ 访问 http://localhost:5189/questions
2. ✅ 检查题目列表是否正常显示（不显示 JSON 格式）
3. ✅ 点击进入题目详情页
4. ✅ 检查"答案要点/提纲"：
   - 有内容的题目正常显示文本
   - 没有内容的题目不显示该区块（不显示 `[object Object]`）
5. ✅ 检查"参考得分点"是否正常显示为列表

## 构建结果
✅ TypeScript 编译通过
✅ 生产构建成功（1.03s）
✅ 无类型错误
✅ 文件大小优化
