<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm sticky top-0 z-10">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <button @click="goBack" class="mr-3 text-gray-600 hover:text-gray-800">
              ← 返回
            </button>
            <h1 class="text-xl font-bold text-gray-800">确认答案</h1>
          </div>
          <button @click="goToQuestions" class="text-blue-600 hover:text-blue-700 text-sm">
            题库
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      <p class="mt-4 text-gray-600">加载中...</p>
    </div>

    <!-- Content -->
    <div v-else-if="submission" class="container mx-auto px-4 py-6 pb-24 max-w-2xl">
      <!-- OCR Result Notice -->
      <div v-if="ocrStatus === 'processing'" class="bg-white rounded-lg shadow-sm p-6 text-center mb-4">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-3"></div>
        <p class="text-gray-700 font-medium">识别中...</p>
        <p class="text-gray-500 text-sm mt-2">识别在后台运行，你可以先修改答案或返回题库</p>
      </div>

      <div v-else-if="originalOcrText" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p class="text-blue-800 text-sm">
          ✓ OCR 识别完成，请仔细核对并修改识别结果
        </p>
      </div>

      <div v-else class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p class="text-yellow-800 text-sm">
          ⚠️ OCR 识别失败或未识别，请手动输入答案
        </p>
      </div>

      <!-- Answer Input -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <label class="block font-semibold text-gray-800 mb-2">
          您的答案
          <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="userAnswer"
          rows="15"
          placeholder="请输入或修改您的答案..."
          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        ></textarea>
        <p class="text-gray-500 text-sm mt-2">
          字数：{{ userAnswer.length }}
        </p>
      </div>

      <!-- Original OCR Text -->
      <div v-if="originalOcrText && originalOcrText !== userAnswer" class="bg-gray-50 rounded-lg p-4 mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-gray-700 text-sm">原始识别文本</h3>
          <button
            @click="restoreOCR"
            class="text-blue-600 text-sm hover:underline"
          >
            恢复
          </button>
        </div>
        <p class="text-gray-600 text-sm whitespace-pre-wrap">{{ originalOcrText }}</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p class="text-red-600 text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Fixed Bottom Actions -->
    <div v-if="!loading" class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
      <div class="container mx-auto max-w-md">
        <button
          @click="handleSubmit"
          :disabled="submitting || !userAnswer.trim()"
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <span v-if="submitting" class="inline-flex items-center justify-center">
            <span class="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></span>
            提交中...
          </span>
          <span v-else>提交评分</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { submissionApi } from '../api/submissions'
import type { EssaySubmission } from '../types'
import { useOcrStore } from '../stores/ocr'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const ocrStore = useOcrStore()

const submission = ref<EssaySubmission | null>(null)
const userAnswer = ref('')
const originalOcrText = ref('')
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const ocrStatus = ref<'idle' | 'processing' | 'done' | 'error' | 'aborted'>('idle')

let _draftTimer: any = null

const loadSubmission = async () => {
  loading.value = true
  error.value = ''

  try {
    const submissionId = route.params.submissionId as string
    const data = await submissionApi.getSubmissionById(submissionId)
    submission.value = data

    // OCR text is intentionally NOT persisted to DB.
    // Prefer localStorage cache; fall back to in-memory OCR job; then fall back to DB.
    let cached = ''
    try {
      cached = localStorage.getItem(`ocr_text:${submissionId}`) || ''
    } catch {
      cached = ''
    }

    const job = ocrStore.jobs[submissionId]
    if (job?.status) ocrStatus.value = job.status
    if (job?.status === 'done' && job.text) {
      originalOcrText.value = job.text
      try {
        localStorage.setItem(`ocr_text:${submissionId}`, job.text)
      } catch {
        // ignore
      }
    } else if (cached) {
      originalOcrText.value = cached
    } else {
      originalOcrText.value = data.ocr_text || ''
    }

    // Initialize with final text (if any) or OCR text
    const draftKey = `draft_answer:${submissionId}`
    let draft = ''
    try {
      draft = localStorage.getItem(draftKey) || ''
    } catch {
      draft = ''
    }
    userAnswer.value = draft || data.final_user_text || originalOcrText.value || ''
  } catch (err: any) {
    console.error('Load submission error:', err)
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

const restoreOCR = () => {
  if (originalOcrText.value) {
    userAnswer.value = originalOcrText.value
  }
}

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

      try {
        localStorage.removeItem(`ocr_text:${submission.value.id}`)
        localStorage.removeItem(`draft_answer:${submission.value.id}`)
      } catch {
        // ignore
      }
      router.push({ name: 'grade-result', params: { submissionId: submission.value.id } })
    } else {
      const raw = String(result?.raw || '').trim()
      const rawHint = raw
        ? `\n\n原始返回片段：\n${raw.slice(0, 600)}${raw.length > 600 ? '\n...' : ''}`
        : ''
      throw new Error((result.error || '评分失败') + rawHint)
    }
  } catch (err: any) {
    console.error('Submit error:', err)
    error.value = err.message || '提交失败，请重试'
    submitting.value = false
  }
}

const goBack = () => {
  router.back()
}

const goToQuestions = () => {
  router.push({ name: 'questions' })
}

watch(
  () => userAnswer.value,
  (val) => {
    const submissionId = String(route.params.submissionId || '')
    if (!submissionId) return
    const key = `draft_answer:${submissionId}`
    if (_draftTimer) clearTimeout(_draftTimer)
    _draftTimer = setTimeout(() => {
      try {
        localStorage.setItem(key, val)
      } catch {
        // ignore
      }
    }, 200)
  }
)

watch(
  () => ocrStore.jobs[String(route.params.submissionId || '')],
  (job) => {
    if (!job) return
    ocrStatus.value = job.status
    if (job.status === 'done' && job.text) {
      originalOcrText.value = job.text
      // If user hasn't typed anything, auto-fill with OCR
      if (!userAnswer.value.trim()) userAnswer.value = job.text
      try {
        localStorage.setItem(`ocr_text:${job.submissionId}`, job.text)
      } catch {
        // ignore
      }
    }
    if (job.status === 'error' && job.error) {
      // Don't override existing user-visible error.
      if (!error.value) error.value = job.error
    }
  },
  { deep: true }
)

onMounted(() => {
  loadSubmission()
})
</script>
