const { ok, badRequest, methodNotAllowed, serverError, parseJsonBody, jsonResponse } = require('../shared/http')
const { isValidEmail } = require('../shared/code')
const { getVerificationCodeRow, deleteVerificationCode } = require('../shared/supabaseRest')

exports.main_handler = async (event) => {
  try {
    const method = (event && (event.httpMethod || event.requestContext?.http?.method)) || ''
    if (String(method).toUpperCase() === 'OPTIONS') {
      return jsonResponse(204, {})
    }
    if (String(method).toUpperCase() !== 'POST') {
      return methodNotAllowed()
    }

    const body = parseJsonBody(event)
    const email = String(body.email || '').trim()
    const code = String(body.code || '').trim()
    if (!email || !code) return badRequest('邮箱和验证码不能为空')
    if (!isValidEmail(email)) return badRequest('请输入有效的邮箱地址')

    const row = await getVerificationCodeRow(email)
    if (!row) {
      return ok({ success: false, error: '验证码不存在或已过期' })
    }

    const expired = new Date(row.expires_at) < new Date()
    if (expired) {
      await deleteVerificationCode(email).catch(() => {})
      return ok({ success: false, error: '验证码已过期' })
    }

    if (String(row.code) !== code) {
      return ok({ success: false, error: '验证码错误' })
    }

    await deleteVerificationCode(email).catch(() => {})
    return ok({ success: true, message: '验证成功' })
  } catch (err) {
    return serverError(err)
  }
}

