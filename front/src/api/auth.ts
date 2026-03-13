import { apiPost } from './http'

type ApiResult = { success: boolean; message?: string; error?: string; [k: string]: any }

function setSession(sessionToken: string, user: { id: string; email: string }) {
  localStorage.setItem('session_token', sessionToken)
  localStorage.setItem('user_id', user.id)
  localStorage.setItem('user_email', user.email)
}

export const authApi = {
  async sendVerificationCode(email: string): Promise<ApiResult> {
    return await apiPost('/api/send-verification-code', { email })
  },

  async verifyCode(email: string, code: string): Promise<ApiResult> {
    return await apiPost('/api/verify-code', { email, code })
  },

  async register(email: string, password: string, verificationCode: string): Promise<ApiResult> {
    const res: any = await apiPost('/api/register', { email, password, verificationCode })
    if (res?.success && res?.sessionToken && res?.user?.id) {
      setSession(String(res.sessionToken), { id: String(res.user.id), email: String(res.user.email || email) })
    }
    return res
  },

  async login(email: string, password: string): Promise<ApiResult> {
    const res: any = await apiPost('/api/login', { email, password })
    if (res?.success && res?.sessionToken && res?.user?.id) {
      setSession(String(res.sessionToken), { id: String(res.user.id), email: String(res.user.email || email) })
    }
    return res
  },

  logout() {
    localStorage.removeItem('session_token')
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_email')
  },

  getSessionToken() {
    return localStorage.getItem('session_token') || ''
  },

  async me() {
    const sessionToken = this.getSessionToken()
    return await apiPost('/api/me', { sessionToken })
  },

  async checkDailyLimit() {
    const sessionToken = this.getSessionToken()
    return await apiPost('/api/user/check-daily-limit', { sessionToken })
  },

  async incrementDailyCheck() {
    const sessionToken = this.getSessionToken()
    return await apiPost('/api/user/increment-daily-check', { sessionToken })
  },
}

