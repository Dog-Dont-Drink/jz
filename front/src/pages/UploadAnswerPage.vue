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
            <h1 class="text-xl font-bold text-gray-800">上传答案</h1>
          </div>
          <button @click="goToQuestions" class="text-blue-600 hover:text-blue-700 text-sm">
            题库
          </button>
        </div>
      </div>
    </div>

    <div class="container mx-auto px-4 py-6 max-w-md">
      <!-- Upload Area -->
      <div v-if="!imageFile && !imagePreview" class="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div class="text-center">
          <div class="text-6xl mb-4">📷</div>
          <h3 class="text-lg font-semibold text-gray-800 mb-2">上传答题图片</h3>
          <p class="text-gray-600 text-sm mb-6">支持拍照或从相册选择</p>

          <div class="space-y-3">
            <label class="block">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                @change="handleFileSelect"
                class="hidden"
              />
              <span class="block w-full bg-blue-600 text-white py-3 rounded-lg font-semibold cursor-pointer hover:bg-blue-700 active:bg-blue-800 transition">
                📸 拍照
              </span>
            </label>

            <label class="block">
              <input
                type="file"
                accept="image/*"
                @change="handleFileSelect"
                class="hidden"
              />
              <span class="block w-full bg-white text-blue-600 py-3 rounded-lg font-semibold border-2 border-blue-600 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition">
                🖼️ 从相册选择
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Image Preview -->
      <div v-if="imagePreview" class="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-3">图片预览</h3>
        <img :src="imagePreview" alt="Preview" class="w-full rounded-lg mb-3" />
        <button
          @click="resetImage"
          class="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition"
        >
          重新选择
        </button>
      </div>

      <!-- Upload Progress -->
      <div v-if="ocrProcessing" class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-3"></div>
        <p class="text-gray-700 font-medium">识别中...</p>
        <p class="text-gray-500 text-sm mt-2">正在后台识别手写文字，你也可以先返回题库继续操作</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p class="text-red-600 text-sm">{{ error }}</p>
        <button
          @click="error = ''"
          class="mt-2 text-blue-600 hover:underline text-sm"
        >
          关闭
        </button>
      </div>

      <!-- Actions -->
      <div v-if="imageFile && !ocrProcessing" class="space-y-3">
        <button
          @click="handleUploadAndOCR"
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 transition"
        >
          识别文字
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { submissionApi } from '../api/submissions'
import { useOcrStore } from '../stores/ocr'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const ocrStore = useOcrStore()

const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const ocrProcessing = ref(false)
const error = ref('')

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件'
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    error.value = '图片大小不能超过 10MB'
    return
  }

  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  error.value = ''
}

const resetImage = () => {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imageFile.value = null
  imagePreview.value = ''
  error.value = ''
}

const handleUploadAndOCR = async () => {
  if (!imageFile.value || !authStore.user) {
    error.value = '请先登录'
    return
  }

  const questionId = route.params.questionId as string

  ocrProcessing.value = true
  error.value = ''

  try {
    // 先创建 submission（不阻塞页面跳转）
    const submission = await submissionApi.createSubmission(questionId)

    // 在内存里启动 OCR（可后台运行），结果页会自动显示
    ocrStore.start(submission.id, imageFile.value)

    router.push({ name: 'ocr-confirm', params: { submissionId: submission.id } })
  } catch (err: any) {
    console.error('OCR error:', err)
    error.value = err?.message || 'OCR 识别失败，您可以手动输入答案'
  } finally {
    ocrProcessing.value = false
  }
}

const goBack = () => {
  router.back()
}

const goToQuestions = () => {
  router.push({ name: 'questions' })
}
</script>
