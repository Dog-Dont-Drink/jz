import { supabase } from '../lib/supabase'

function getFunctionsBaseUrl() {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  if (!base) throw new Error('Missing VITE_SUPABASE_URL')
  return `${base}/functions/v1`
}

function getVerificationApiBaseUrl() {
  const runtimeBase = String(window.__APP_CONFIG__?.VERIFICATION_API_BASE_URL || '').trim()
  const base = runtimeBase || String(import.meta.env.VITE_VERIFICATION_API_BASE_URL || '').trim()
  return base ? base.replace(/\/$/, '') : ''
}

async function invokeVerificationApi(endpointName: string, body: unknown) {
  // If configured, call Tencent SCF (or any backend) to send/verify email codes.
  // This avoids Supabase Auth and keeps secrets on the backend.
  const externalBase = getVerificationApiBaseUrl()
  const url = externalBase
    ? `${externalBase}/${encodeURIComponent(endpointName)}`
    : `${getFunctionsBaseUrl()}/${endpointName}`

  // Avoid CORS preflight on some mobile networks/browsers by using a "simple request":
  // - no custom headers (no apikey/authorization/x-client-info)
  // - Content-Type: text/plain (simple)
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body ?? {}),
  })

  const text = await resp.text().catch(() => '')
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }
  if (!resp.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${resp.status}`
    throw new Error(String(msg))
  }
  return json
}

export const authApi = {
  // 发送验证码
  async sendVerificationCode(email: string) {
    try {
      return await invokeVerificationApi('send-verification-code', { email })
    } catch (error: any) {
      console.error('发送验证码失败:', error)
      const msg = String(error?.message || '')
      if (/failed to fetch/i.test(msg)) {
        return {
          success: false,
          error: '网络错误：无法连接验证码服务（可能是手机网络/浏览器拦截/DNS 问题）。请切换网络或稍后重试。',
        }
      }
      return { success: false, error: msg || '发送验证码失败' }
    }
  },

  // 验证验证码
  async verifyCode(
    email: string,
    code: string
  ): Promise<{ success: boolean; authUserId?: string | null; error?: string }> {
    try {
      const data = await invokeVerificationApi('verify-code', { email, code })
      return { success: !!data?.success, authUserId: data?.auth_user_id ?? null }
    } catch (error: any) {
      console.error('验证验证码失败:', error)
      const msg = String(error?.message || '')
      if (/failed to fetch/i.test(msg)) {
        console.warn('网络错误：无法连接验证码验证服务（Supabase Functions）')
      }
      return { success: false, error: msg || '验证失败' }
    }
  },

  // 注册用户
  async register(email: string, password: string, verificationCode: string) {
    try {
      // 验证验证码
      const verify = await this.verifyCode(email, verificationCode)
      if (!verify.success) throw new Error(verify.error || '验证码错误或已过期')

      const authUserId = verify.authUserId
      if (authUserId && typeof authUserId !== 'string') {
        throw new Error('验证码验证返回异常（auth_user_id）')
      }

      // 检查邮箱是否已存在
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingUser) {
        throw new Error('该邮箱已被注册')
      }

      // 密码加密（简单示例，实际应使用 bcrypt）
      const passwordHash = btoa(password) // 实际项目中应使用 bcrypt

      // 插入用户
      const { data, error } = await supabase
        .from('users')
        .insert({
          ...(authUserId ? { id: authUserId } : {}),
          email,
          password_hash: passwordHash,
          daily_check_count: 0,
          daily_check_limit: 2,
        })
        .select()
        .single()

      if (error) throw error

      return { success: true, user: data }
    } catch (error: any) {
      console.error('注册失败:', error)
      throw error
    }
  },

  // 登录
  async login(email: string, password: string) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (error) throw error
      if (!user) throw new Error('用户不存在')

      // 验证密码
      const passwordHash = btoa(password)
      if (user.password_hash !== passwordHash) {
        throw new Error('密码错误')
      }

      // 生成 session token（简单示例）
      const sessionToken = btoa(`${user.id}:${Date.now()}`)
      localStorage.setItem('session_token', sessionToken)
      localStorage.setItem('user_id', user.id)
      localStorage.setItem('user_email', user.email)

      return { success: true, user, sessionToken }
    } catch (error: any) {
      console.error('登录失败:', error)
      throw error
    }
  },

  // 登出
  logout() {
    localStorage.removeItem('session_token')
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_email')
  },

  // 获取当前用户
  getCurrentUser() {
    const userId = localStorage.getItem('user_id')
    const userEmail = localStorage.getItem('user_email')
    const sessionToken = localStorage.getItem('session_token')

    if (!userId || !sessionToken) return null

    return { id: userId, email: userEmail }
  },

  // 检查每日使用次数
  async checkDailyLimit(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_daily_limit', {
        user_id_param: userId,
      })

      if (error) throw error
      return data as boolean
    } catch (error) {
      console.error('检查每日限制失败:', error)
      return false
    }
  },

  // 增加每日使用次数
  async incrementDailyCheck(userId: string) {
    try {
      const { error } = await supabase.rpc('increment_daily_check', {
        user_id_param: userId,
      })

      if (error) throw error
    } catch (error) {
      console.error('增加使用次数失败:', error)
      throw error
    }
  },

  // 获取用户信息
  async getUserInfo(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, daily_check_count, daily_check_limit, last_check_date')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('获取用户信息失败:', error)
      throw error
    }
  },
}
