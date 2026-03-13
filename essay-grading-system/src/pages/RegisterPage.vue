<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">注册</h1>
        <p class="text-gray-600">创建您的账号</p>
      </div>

      <div class="bg-white rounded-lg shadow-md p-6">
        <form @submit.prevent="handleRegister">
          <div class="mb-4">
            <label class="block text-gray-700 font-medium mb-2">邮箱</label>
            <input
              v-model="email"
              type="email"
              required
              placeholder="请输入邮箱"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-4">
            <label class="block text-gray-700 font-medium mb-2">验证码</label>
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                v-model="verificationCode"
                type="text"
                required
                maxlength="6"
                placeholder="请输入验证码"
                class="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                @click="handleSendCode"
                :disabled="codeSending || countdown > 0"
                class="w-full sm:w-auto shrink-0 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap text-sm sm:text-base"
              >
                {{ countdown > 0 ? `${countdown}秒后重试` : codeSending ? '发送中...' : '发送验证码' }}
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-gray-700 font-medium mb-2">密码</label>
            <input
              v-model="password"
              type="password"
              required
              minlength="6"
              placeholder="至少 6 位"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div class="mb-6">
            <label class="block text-gray-700 font-medium mb-2">确认密码</label>
            <input
              v-model="confirmPassword"
              type="password"
              required
              placeholder="再次输入密码"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-600 text-sm">{{ error }}</p>
          </div>

          <div v-if="success" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p class="text-green-600 text-sm">{{ success }}</p>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg shadow-md hover:bg-blue-700 active:bg-blue-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </form>

        <div class="mt-6 text-center">
          <p class="text-gray-600">
            已有账号？
            <router-link to="/login" class="text-blue-600 font-medium hover:underline">
              立即登录
            </router-link>
          </p>
        </div>
      </div>

      <div class="mt-4 text-center">
        <router-link to="/" class="text-gray-600 hover:text-gray-800">
          ← 返回首页
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const verificationCode = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const codeSending = ref(false)
const countdown = ref(0)
const error = ref('')
const success = ref('')

let countdownTimer: number | null = null

const handleSendCode = async () => {
  error.value = ''

  if (!email.value) {
    error.value = '请先输入邮箱'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    error.value = '请输入有效的邮箱地址'
    return
  }

  codeSending.value = true

  try {
    await authStore.sendVerificationCode(email.value)
    success.value = '验证码已发送，请查收邮件'

    // 开始倒计时
    countdown.value = 60
    countdownTimer = window.setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
    }, 1000)
  } catch (err: any) {
    console.error('Send code error:', err)
    error.value = err.message || '发送验证码失败，请稍后重试'
  } finally {
    codeSending.value = false
  }
}

const handleRegister = async () => {
  error.value = ''
  success.value = ''

  if (!email.value || !verificationCode.value || !password.value || !confirmPassword.value) {
    error.value = '请填写完整信息'
    return
  }

  if (password.value.length < 6) {
    error.value = '密码至少需要 6 位'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = '两次密码输入不一致'
    return
  }

  loading.value = true

  try {
    await authStore.signUp(email.value, password.value, verificationCode.value)
    success.value = '注册成功！即将跳转到登录页面'
    setTimeout(() => {
      router.push({ name: 'login' })
    }, 2000)
  } catch (err: any) {
    console.error('Register error:', err)
    error.value = err.message || '注册失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>
