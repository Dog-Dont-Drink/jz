<template>
  <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white">
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-md mx-auto">
        <!-- Logo and Title -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-4">📝</div>
          <h1 class="text-3xl font-bold text-gray-800 mb-2">申论智能评分系统</h1>
          <p class="text-gray-600">AI 驱动的手写答案识别与评分</p>
        </div>

        <!-- Features -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4 text-gray-800">核心功能</h2>
          <ul class="space-y-3">
            <li class="flex items-start">
              <span class="text-blue-500 mr-2">✓</span>
              <span class="text-gray-700">拍照上传手写答案，自动 OCR 识别</span>
            </li>
            <li class="flex items-start">
              <span class="text-blue-500 mr-2">✓</span>
              <span class="text-gray-700">AI 智能评分，详细得分点分析</span>
            </li>
            <li class="flex items-start">
              <span class="text-blue-500 mr-2">✓</span>
              <span class="text-gray-700">个性化改进建议，助力提分</span>
            </li>
            <li class="flex items-start">
              <span class="text-blue-500 mr-2">✓</span>
              <span class="text-gray-700">历史记录追踪，进步可视化</span>
            </li>
          </ul>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-3">
          <button
            v-if="!isAuthenticated"
            @click="goToLogin"
            class="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 transition"
          >
            立即登录
          </button>
          <button
            v-if="!isAuthenticated"
            @click="goToRegister"
            class="w-full bg-white text-blue-600 py-4 rounded-lg font-semibold text-lg shadow-md border-2 border-blue-600 hover:bg-blue-50 active:bg-blue-100 transition"
          >
            注册账号
          </button>
          <button
            v-if="isAuthenticated"
            @click="goToQuestions"
            class="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 transition"
          >
            进入题库
          </button>
        </div>

        <!-- Footer -->
        <div class="text-center mt-8 text-sm text-gray-500">
          <p>移动端优先设计 · 随时随地练习</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

const goToLogin = () => {
  router.push({ name: 'login' })
}

const goToRegister = () => {
  router.push({ name: 'register' })
}

const goToQuestions = () => {
  router.push({ name: 'questions' })
}
</script>
