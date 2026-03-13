import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '../api/auth'

export interface User {
  id: string
  email: string
  daily_check_count?: number
  daily_check_limit?: number
  last_check_date?: string
  created_at?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  const initialize = async () => {
    if (isInitialized.value) return
    isInitialized.value = true
    try {
      const sessionToken = authApi.getSessionToken()
      if (!sessionToken) {
        user.value = null
        return
      }
      const res: any = await authApi.me()
      if (res?.success && res?.user?.id) {
        user.value = res.user as User
      } else {
        user.value = null
        authApi.logout()
      }
    } catch {
      user.value = null
    }
  }

  const sendVerificationCode = async (email: string) => {
    const res: any = await authApi.sendVerificationCode(email)
    if (!res?.success) throw new Error(res?.error || '发送验证码失败')
    return res
  }

  const signUp = async (email: string, password: string, verificationCode: string) => {
    const res: any = await authApi.register(email, password, verificationCode)
    if (!res?.success) throw new Error(res?.error || '注册失败')
    user.value = res.user as User
    return res
  }

  const signIn = async (email: string, password: string) => {
    const res: any = await authApi.login(email, password)
    if (!res?.success) throw new Error(res?.error || '登录失败')
    user.value = res.user as User
    return res
  }

  const signOut = async () => {
    authApi.logout()
    user.value = null
  }

  const checkDailyLimit = async () => {
    const res: any = await authApi.checkDailyLimit()
    if (!res?.success) throw new Error(res?.error || '检查失败')
    return !!res.allowed
  }

  const incrementDailyCheck = async () => {
    const res: any = await authApi.incrementDailyCheck()
    if (!res?.success) throw new Error(res?.error || '增加次数失败')
    return res
  }

  return {
    user,
    isInitialized,
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

