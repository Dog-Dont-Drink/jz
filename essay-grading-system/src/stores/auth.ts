import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api/auth'

interface User {
  id: string
  email: string
  username?: string
  daily_check_count?: number
  daily_check_limit?: number
  last_check_date?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)

  const initialize = async () => {
    loading.value = true
    try {
      const currentUser = authApi.getCurrentUser()
      if (currentUser) {
        // 获取完整用户信息
        const userInfo = await authApi.getUserInfo(currentUser.id)
        user.value = userInfo
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      user.value = null
    } finally {
      loading.value = false
    }
  }

  const sendVerificationCode = async (email: string) => {
    const result = await authApi.sendVerificationCode(email)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result
  }

  const signUp = async (email: string, password: string, verificationCode: string) => {
    const result = await authApi.register(email, password, verificationCode)
    if (!result.success) {
      throw new Error('注册失败')
    }
    user.value = result.user
    return result
  }

  const signIn = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    if (!result.success) {
      throw new Error('登录失败')
    }
    user.value = result.user
    return result
  }

  const signOut = async () => {
    authApi.logout()
    user.value = null
  }

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

  return {
    user,
    loading,
    isAuthenticated,
    initialize,
    sendVerificationCode,
    signUp,
    signIn,
    signOut,
    checkDailyLimit,
    incrementDailyCheck,
  }
})
