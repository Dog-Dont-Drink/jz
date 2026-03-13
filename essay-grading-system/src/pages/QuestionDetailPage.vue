<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm sticky top-0 z-10">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center">
          <button @click="goBack" class="mr-3 text-gray-600 hover:text-gray-800">
            ← 返回
          </button>
          <h1 class="text-xl font-bold text-gray-800">题目详情</h1>
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
    <div v-else-if="question" class="container mx-auto px-4 py-6 pb-24">
      <!-- Title and Meta -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 class="text-xl font-bold text-gray-800 mb-3">{{ question.title }}</h2>
        <div class="flex items-center space-x-2 text-sm mb-3">
          <span v-if="question.date_tag" class="bg-gray-100 px-2 py-1 rounded">{{ question.date_tag }}</span>
          <span v-if="question.exercise_no !== null && question.exercise_no !== undefined" class="bg-gray-100 px-2 py-1 rounded">
            第{{ question.exercise_no }}题
          </span>
          <span v-if="question.source" class="bg-gray-100 px-2 py-1 rounded">{{ question.source }}</span>
          <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">{{ question.category }}</span>
          <span v-if="question.word_limit" class="bg-purple-100 text-purple-700 px-2 py-1 rounded">
            {{ question.word_limit }}字
          </span>
          <span class="bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">
            {{ question.total_score }}分
          </span>
        </div>
      </div>

      <!-- Question -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-2">题干</h3>
        <p v-if="question.question_text" class="text-gray-700 leading-relaxed whitespace-pre-wrap">{{ question.question_text }}</p>
        <p v-else class="text-gray-500 text-sm">暂无题干</p>

        <div class="border-t border-gray-100 mt-4 pt-4">
          <h3 class="font-semibold text-gray-800 mb-2">作答要求</h3>
          <p v-if="question.requirements" class="text-gray-700 leading-relaxed whitespace-pre-wrap">{{ question.requirements }}</p>
          <p v-else class="text-gray-500 text-sm">暂无作答要求</p>
        </div>
      </div>

      <!-- Material -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-gray-800">材料内容</h3>
          <button
            @click="materialExpanded = !materialExpanded"
            class="text-blue-600 text-sm hover:underline"
          >
            {{ materialExpanded ? '收起' : '展开' }}
          </button>
        </div>
        <div v-if="!materialExpanded" class="text-gray-600 text-sm">
          {{ (question.material_text || '').slice(0, 120) || '点击展开查看完整材料' }}{{ (question.material_text || '').length > 120 ? '...' : '' }}
        </div>
        <div v-else class="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
          {{ question.material_text || '' }}
        </div>
      </div>

      <!-- Answer Outline -->
      <div v-if="question.answer_outline" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-2">答案要点/提纲</h3>
        <div class="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
          {{ question.answer_outline }}
        </div>
      </div>

      <!-- Standard Answer -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-gray-800">参考答案</h3>
          <button
            @click="answerExpanded = !answerExpanded"
            class="text-blue-600 text-sm hover:underline"
          >
            {{ answerExpanded ? '收起' : '展开' }}
          </button>
        </div>
        <div v-if="answerExpanded" class="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
          {{ question.standard_answer }}
        </div>
      </div>

      <!-- Scoring Points -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-2">参考得分点</h3>
        <ul class="space-y-2">
          <li
            v-for="(point, index) in question.scoring_points"
            :key="index"
            class="flex items-start text-sm"
          >
            <span class="text-blue-600 font-semibold mr-2 whitespace-nowrap">
              {{ point.score }}分
            </span>
            <span class="text-gray-700">{{ point.point }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Fixed Bottom Actions -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
      <div class="container mx-auto max-w-md space-y-2">
        <button
          @click="goToUpload"
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 transition"
        >
          📷 拍照上传答案
        </button>
        <button
          @click="goToManualInput"
          class="w-full bg-white text-blue-600 py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 active:bg-blue-100 transition"
        >
          ✍️ 手动输入答案
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { questionApi } from '../api/questions'
import { submissionApi } from '../api/submissions'
import type { EssayQuestion } from '../types'
import { formatQuestionIdentifier } from '../utils/questionIdentifier'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const question = ref<EssayQuestion | null>(null)
const loading = ref(false)
const error = ref('')
const materialExpanded = ref(false)
const answerExpanded = ref(false)

const loadQuestion = async () => {
  loading.value = true
  error.value = ''

  try {
    const id = route.params.id as string
    question.value = await questionApi.getQuestionByIdentifier(id)
  } catch (err: any) {
    console.error('Load question error:', err)
    error.value = '加载题目失败'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}

const goToUpload = () => {
  if (question.value) {
    router.push({ name: 'upload', params: { questionId: formatQuestionIdentifier(question.value) } })
  }
}

const goToManualInput = async () => {
  if (!question.value || !authStore.user) return

  try {
    const submission = await submissionApi.createSubmission(
      formatQuestionIdentifier(question.value),
      authStore.user.id
    )
    router.push({ name: 'ocr-confirm', params: { submissionId: submission.id } })
  } catch (err) {
    console.error('Create submission error:', err)
    alert('创建提交失败，请重试')
  }
}

onMounted(() => {
  loadQuestion()
})
</script>
