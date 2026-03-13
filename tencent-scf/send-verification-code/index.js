const { ok, badRequest, methodNotAllowed, serverError, parseJsonBody, jsonResponse } = require('../shared/http')
const { generate6DigitCode, isValidEmail } = require('../shared/code')
const { upsertVerificationCode } = require('../shared/supabaseRest')
const { sendVerificationEmail } = require('../shared/email163')

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
    if (!email) return badRequest('邮箱不能为空')
    if (!isValidEmail(email)) return badRequest('请输入有效的邮箱地址')

    const code = generate6DigitCode()
    const expiresAtIso = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    await upsertVerificationCode(email, code, expiresAtIso)
    await sendVerificationEmail(email, code)

    return ok({ success: true, message: '验证码已发送' })
  } catch (err) {
    return serverError(err)
  }
}

