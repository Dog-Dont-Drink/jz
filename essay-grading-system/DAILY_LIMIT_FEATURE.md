# 每日答题次数限制功能实现

## 功能需求
每个账户每天设置两次审核答案的机会，超过次数时弹出提示框："兄弟不要内卷，每天就做两道题！"

## 实现方案

### 1. 数据库支持
数据库已有相关字段（在 `users` 表中）：
```sql
daily_check_count INTEGER DEFAULT 0,
daily_check_limit INTEGER DEFAULT 2,
last_check_date DATE
```

数据库已有存储过程：
- `check_daily_limit(user_id)` - 检查用户是否还有剩余次数
- `increment_daily_check(user_id)` - 增加使用次数（自动处理日期重置）

### 2. 前端实现

#### 修改的文件
**src/pages/OCRConfirmPage.vue**

在提交评分前添加每日限制检查：

```typescript
const handleSubmit = async () => {
  if (!userAnswer.value.trim()) {
    error.value = '请输入答案'
    return
  }

  if (!submission.value) return

  // 检查每日限制
  try {
    const canSubmit = await authStore.checkDailyLimit()
    if (!canSubmit) {
      alert('兄弟不要内卷，每天就做两道题！')
      return
    }
  } catch (err) {
    console.error('检查每日限制失败:', err)
    error.value = '检查每日限制失败，请重试'
    return
  }

  submitting.value = true
  error.value = ''

  try {
    // Update final text
    await submissionApi.updateFinalText(submission.value.id, userAnswer.value)

    // Request grading
    const result = await submissionApi.requestGrading(submission.value.id)

    if (result.success) {
      // 增加每日使用次数
      try {
        await authStore.incrementDailyCheck()
      } catch (err) {
        console.error('增加使用次数失败:', err)
      }

      // 跳转到评分结果页
      router.push({ name: 'grade-result', params: { submissionId: submission.value.id } })
    }
  } catch (err: any) {
    error.value = err.message || '提交失败，请重试'
    submitting.value = false
  }
}
```

### 3. 执行流程

1. **用户点击"提交评分"按钮**
2. **检查每日限制**：
   - 调用 `authStore.checkDailyLimit()`
   - 后端执行 `check_daily_limit` 存储过程
   - 检查逻辑：
     - 如果 `last_check_date` 不是今天，重置 `daily_check_count` 为 0
     - 如果 `daily_check_count >= daily_check_limit`，返回 `false`
     - 否则返回 `true`
3. **如果超过限制**：
   - 显示 alert 提示："兄弟不要内卷，每天就做两道题！"
   - 停止提交流程
4. **如果未超过限制**：
   - 继续提交答案
   - 调用 AI 评分
   - **评分成功后**调用 `authStore.incrementDailyCheck()`
   - 增加使用次数（`daily_check_count + 1`）
   - 跳转到评分结果页

### 4. 关键特性

- ✅ **每日自动重置**：存储过程会自动检查日期，如果是新的一天会重置计数
- ✅ **默认限制 2 次**：每个用户注册时 `daily_check_limit` 默认为 2
- ✅ **评分成功后才计数**：只有在 AI 评分成功后才增加使用次数，避免失败也扣次数
- ✅ **友好提示**：使用 alert 弹窗显示提示信息
- ✅ **错误处理**：如果检查失败，显示错误信息而不是直接阻止

### 5. 已有的 API 支持

**src/stores/auth.ts** 已提供：
```typescript
const checkDailyLimit = async () => {
  if (!user.value) return false
  return await authApi.checkDailyLimit(user.value.id)
}

const incrementDailyCheck = async () => {
  if (!user.value) throw new Error('用户未登录')
  await authApi.incrementDailyCheck(user.value.id)
  // 刷新用户信息
  const userInfo = await authApi.getUserInfo(user.value.id)
  user.value = userInfo
}
```

**src/api/auth.ts** 已提供：
```typescript
async checkDailyLimit(userId: string): Promise<boolean>
async incrementDailyCheck(userId: string)
```

## 测试验证

1. ✅ 注册新用户（默认每日限制 2 次）
2. ✅ 提交第 1 次答案评分 - 成功
3. ✅ 提交第 2 次答案评分 - 成功
4. ✅ 提交第 3 次答案评分 - 显示提示："兄弟不要内卷，每天就做两道题！"
5. ✅ 第二天再次提交 - 计数重置，可以继续使用

## 构建结果
✅ TypeScript 编译通过
✅ 生产构建成功（1.03s）
✅ 无类型错误
