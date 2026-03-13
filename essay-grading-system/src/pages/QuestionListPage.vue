<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm sticky top-0 z-10">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-800">题库</h1>
          <div class="flex items-center space-x-3">
            <router-link
              to="/history"
              class="text-blue-600 hover:text-blue-700 font-medium"
            >
              历史记录
            </router-link>
            <button
              @click="handleLogout"
              class="text-gray-600 hover:text-gray-800"
            >
              退出
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="container mx-auto px-4 py-4">
      <div class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div class="space-y-3">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索题目..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div class="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-2">
            <input
              v-model="filters.date_tag"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />

            <select
              v-model="filters.source"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">全部来源</option>
              <option value="国考">国考</option>
              <option value="军转">军转</option>
              <option value="军转课后作业">军转课后作业</option>
            </select>

            <select
              v-model="filters.category"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">全部类型</option>
              <option value="归纳概括">归纳概括</option>
              <option value="综合分析">综合分析</option>
              <option value="提出对策">提出对策</option>
              <option value="贯彻执行">贯彻执行</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p class="mt-4 text-gray-600">加载中...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p class="text-red-600">{{ error }}</p>
        <button
          @click="loadQuestions"
          class="mt-3 text-blue-600 hover:underline"
        >
          重试
        </button>
      </div>

      <!-- Empty -->
      <div v-else-if="!questions.length" class="text-center py-12">
        <div class="text-6xl mb-4">📚</div>
        <p class="text-gray-600">暂无题目</p>
      </div>

      <!-- Question List -->
      <div v-else class="space-y-3 pb-6">
        <div
          v-for="question in questions"
          :key="question.id"
          @click="goToDetail(getQuestionIdentifier(question))"
          class="bg-white rounded-lg shadow-sm p-4 active:bg-gray-50 transition cursor-pointer"
        >
          <div class="flex items-start justify-between mb-2">
            <h3 class="text-lg font-semibold text-gray-800 flex-1 pr-2">
              {{ question.title }}
            </h3>
            <span class="text-blue-600 font-bold text-lg whitespace-nowrap">
              {{ question.total_score }}分
            </span>
          </div>

          <div class="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <span v-if="question.date_tag" class="bg-gray-100 px-2 py-1 rounded">{{ question.date_tag }}</span>
            <span v-if="question.exercise_no !== null && question.exercise_no !== undefined" class="bg-gray-100 px-2 py-1 rounded">
              第{{ question.exercise_no }}题
            </span>
            <span v-if="question.source" class="bg-gray-100 px-2 py-1 rounded">{{ question.source }}</span>
            <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">{{ question.category }}</span>
          </div>

          <p class="text-gray-600 text-sm line-clamp-2">
            {{ question.requirements || question.question_text || '' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { questionApi } from '../api/questions'
import type { EssayQuestion } from '../types'
import { formatQuestionIdentifier } from '../utils/questionIdentifier'

const router = useRouter()
const authStore = useAuthStore()

const questions = ref<EssayQuestion[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const filters = ref({
  date_tag: '',
  source: '',
  category: '',
})

const loadQuestions = async () => {
  loading.value = true
  error.value = ''

  try {
    const filterParams: any = {}
    if (filters.value.date_tag) filterParams.date_tag = filters.value.date_tag
    if (filters.value.source) filterParams.source = filters.value.source
    if (filters.value.category) filterParams.category = filters.value.category
    if (searchQuery.value) filterParams.search = searchQuery.value

    questions.value = await questionApi.getQuestions(filterParams)
  } catch (err: any) {
    console.error('Load questions error:', err)
    error.value = '加载题目失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const goToDetail = (id: string) => {
  router.push({ name: 'question-detail', params: { id } })
}

const getQuestionIdentifier = (question: EssayQuestion) => {
  return formatQuestionIdentifier(question)
}

const handleLogout = async () => {
  try {
    await authStore.signOut()
    router.push({ name: 'welcome' })
  } catch (err) {
    console.error('Logout error:', err)
  }
}

watch([filters, searchQuery], () => {
  loadQuestions()
}, { deep: true })

onMounted(() => {
  loadQuestions()
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
