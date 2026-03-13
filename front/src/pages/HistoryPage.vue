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
            <h1 class="text-xl font-bold text-gray-800">历史记录</h1>
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

    <!-- Error -->
    <div v-else-if="error" class="container mx-auto px-4 py-6">
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p class="text-red-600">{{ error }}</p>
        <button
          @click="loadHistory"
          class="mt-3 text-blue-600 hover:underline"
        >
          重试
        </button>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!submissions.length" class="container mx-auto px-4 py-12 text-center">
      <div class="text-6xl mb-4">📋</div>
      <p class="text-gray-600 mb-6">暂无作答记录</p>
      <button
        @click="goToQuestions"
        class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
      >
        开始答题
      </button>
    </div>

    <!-- History List -->
    <div v-else class="container mx-auto px-4 py-6 pb-6">
      <div class="space-y-3">
        <div
          v-for="submission in submissions"
          :key="submission.id"
          @click="goToResult(submission.id)"
          class="bg-white rounded-lg shadow-sm p-4 active:bg-gray-50 transition cursor-pointer"
        >
          <div class="flex items-start justify-between mb-2">
            <h3 class="text-lg font-semibold text-gray-800 flex-1 pr-2">
              {{ getQuestionTitle(submission) }}
            </h3>
            <span
              v-if="getGradeScore(submission) !== null"
              class="text-blue-600 font-bold text-xl whitespace-nowrap"
            >
              {{ getGradeScore(submission) }}分
            </span>
          </div>

          <div class="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <span>{{ formatDate(submission.created_at) }}</span>
            <span v-if="submission.grade_status === 'completed'" class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
              已评分
            </span>
            <span v-else-if="submission.grade_status === 'processing'" class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">
              评分中
            </span>
            <span v-else class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
              待评分
            </span>
          </div>

          <p v-if="getGradeFeedback(submission)" class="text-gray-600 text-sm line-clamp-2">
            {{ getGradeFeedback(submission) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { submissionApi } from '../api/submissions'
import type { SubmissionWithDetails } from '../types'

const router = useRouter()
const authStore = useAuthStore()

const submissions = ref<SubmissionWithDetails[]>([])
const loading = ref(false)
const error = ref('')

const loadHistory = async () => {
  if (!authStore.user) return

  loading.value = true
  error.value = ''

  try {
    submissions.value = await submissionApi.getUserSubmissions(authStore.user.id)
  } catch (err: any) {
    console.error('Load history error:', err)
    error.value = '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const getQuestionTitle = (submission: SubmissionWithDetails) => {
  if (submission.question && typeof submission.question === 'object' && 'title' in submission.question) {
    return submission.question.title
  }
  return '未知题目'
}

const getGradeScore = (submission: SubmissionWithDetails) => {
  if (submission.grade) {
    if (Array.isArray(submission.grade) && submission.grade.length > 0) {
      return submission.grade[0].total_score
    } else if (typeof submission.grade === 'object' && 'total_score' in submission.grade) {
      return submission.grade.total_score
    }
  }
  return null
}

const getGradeFeedback = (submission: SubmissionWithDetails) => {
  if (submission.grade) {
    if (Array.isArray(submission.grade) && submission.grade.length > 0) {
      return submission.grade[0].overall_feedback
    } else if (typeof submission.grade === 'object' && 'overall_feedback' in submission.grade) {
      return submission.grade.overall_feedback
    }
  }
  return ''
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days < 7) {
    return days + '天前'
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

const goBack = () => {
  router.push({ name: 'questions' })
}

const goToQuestions = () => {
  router.push({ name: 'questions' })
}

const goToResult = (submissionId: string) => {
  router.push({ name: 'grade-result', params: { submissionId } })
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
