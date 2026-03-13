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
            <h1 class="text-xl font-bold text-gray-800">评分结果</h1>
          </div>
          <button
            @click="goToHistory"
            class="text-blue-600 hover:text-blue-700 text-sm"
          >
            历史记录
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
      </div>
    </div>

    <!-- Content -->
    <div v-else-if="submission && grade" class="container mx-auto px-4 py-6 pb-24 max-w-2xl">
      <!-- Total Score -->
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-4 text-white text-center">
        <p class="text-lg mb-2">总分</p>
        <p class="text-6xl font-bold mb-2">{{ grade.total_score }}</p>
        <p class="text-xl">满分 {{ submission.question?.total_score || 100 }}</p>
      </div>

      <!-- Sub Scores -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3">分项得分</h3>
        <div class="space-y-2">
          <div class="flex items-center justify-between py-2 border-b border-gray-100">
            <span class="text-gray-700">内容分</span>
            <span class="text-blue-600 font-bold text-lg">{{ grade.content_score }}</span>
          </div>
          <div class="flex items-center justify-between py-2 border-b border-gray-100">
            <span class="text-gray-700">结构分</span>
            <span class="text-blue-600 font-bold text-lg">{{ grade.structure_score }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-gray-700">表达分</span>
            <span class="text-blue-600 font-bold text-lg">{{ grade.expression_score }}</span>
          </div>
        </div>
      </div>

      <!-- Matched Points -->
      <div v-if="grade.matched_points.length" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3 flex items-center">
          <span class="text-green-500 mr-2">✓</span>
          命中得分点
        </h3>
        <div class="space-y-3">
          <div
            v-for="(point, index) in grade.matched_points"
            :key="index"
            class="bg-green-50 border border-green-200 rounded-lg p-3"
          >
            <div class="flex items-start justify-between mb-1">
              <p class="text-gray-800 font-medium flex-1">{{ point.point }}</p>
              <span class="text-green-600 font-bold ml-2 whitespace-nowrap">+{{ point.score }}</span>
            </div>
            <p class="text-gray-600 text-sm">{{ point.reason }}</p>
          </div>
        </div>
      </div>

      <!-- Missed Points -->
      <div v-if="grade.missed_points.length" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3 flex items-center">
          <span class="text-orange-500 mr-2">⚠</span>
          漏掉的得分点
        </h3>
        <div class="space-y-3">
          <div
            v-for="(point, index) in grade.missed_points"
            :key="index"
            class="bg-orange-50 border border-orange-200 rounded-lg p-3"
          >
            <p class="text-gray-800 font-medium mb-1">{{ point.point }}</p>
            <p class="text-gray-600 text-sm">{{ point.reason }}</p>
          </div>
        </div>
      </div>

      <!-- Deduction Points -->
      <div v-if="grade.deduction_points.length" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3 flex items-center">
          <span class="text-red-500 mr-2">✗</span>
          扣分点
        </h3>
        <div class="space-y-3">
          <div
            v-for="(point, index) in grade.deduction_points"
            :key="index"
            class="bg-red-50 border border-red-200 rounded-lg p-3"
          >
            <div class="flex items-start justify-between mb-1">
              <p class="text-gray-800 font-medium flex-1">{{ point.issue }}</p>
              <span class="text-red-600 font-bold ml-2 whitespace-nowrap">-{{ point.deduct_score }}</span>
            </div>
            <p class="text-gray-600 text-sm">{{ point.reason }}</p>
          </div>
        </div>
      </div>

      <!-- Overall Feedback -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3">综合评价</h3>
        <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{{ grade.overall_feedback }}</p>
      </div>

      <!-- Improvement Suggestions -->
      <div v-if="grade.improvement_suggestions.length" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3">改进建议</h3>
        <ul class="space-y-2">
          <li
            v-for="(suggestion, index) in grade.improvement_suggestions"
            :key="index"
            class="flex items-start text-gray-700"
          >
            <span class="text-blue-500 mr-2 mt-1">•</span>
            <span>{{ suggestion }}</span>
          </li>
        </ul>
      </div>

      <!-- User Answer -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3">您的答案</h3>
        <p class="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
          {{ submission.final_user_text }}
        </p>
      </div>

      <!-- OCR Text if different -->
      <div v-if="submission.ocr_text && submission.ocr_text !== submission.final_user_text" class="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 class="font-semibold text-gray-700 mb-2 text-sm">原始 OCR 识别</h3>
        <p class="text-gray-600 text-sm whitespace-pre-wrap">{{ submission.ocr_text }}</p>
      </div>
    </div>

    <!-- Fixed Bottom Actions -->
    <div v-if="!loading && submission" class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
      <div class="container mx-auto max-w-md">
        <button
          @click="goToQuestionDetail"
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 transition"
        >
          再次作答
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { submissionApi } from '../api/submissions'
import type { SubmissionWithDetails, EssayGrade } from '../types'

const router = useRouter()
const route = useRoute()

const submission = ref<SubmissionWithDetails | null>(null)
const grade = ref<EssayGrade | null>(null)
const loading = ref(false)
const error = ref('')

const loadResult = async () => {
  loading.value = true
  error.value = ''

  try {
    const submissionId = route.params.submissionId as string
    const data = await submissionApi.getSubmissionById(submissionId)
    submission.value = data

    if (data.grade && Array.isArray(data.grade) && data.grade.length > 0) {
      grade.value = data.grade[0] as EssayGrade
    } else if (data.grade && !Array.isArray(data.grade)) {
      grade.value = data.grade as EssayGrade
    } else {
      error.value = '评分结果未找到'
    }
  } catch (err: any) {
    console.error('Load result error:', err)
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push({ name: 'questions' })
}

const goToHistory = () => {
  router.push({ name: 'history' })
}

const goToQuestionDetail = () => {
  if (submission.value?.question_id) {
    router.push({ name: 'question-detail', params: { id: submission.value.question_id } })
  }
}

onMounted(() => {
  loadResult()
})
</script>
