const nodemailer = require('nodemailer')

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || 'smtp.163.com')
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = String(process.env.SMTP_SECURE || 'true') === 'true'
  const user = String(process.env.SMTP_USER || '')
  const pass = String(process.env.SMTP_PASS || '')
  const from = String(process.env.SMTP_FROM || user || '')

  if (!user || !pass) {
    throw new Error('Missing SMTP_USER / SMTP_PASS in function environment')
  }
  if (!from) {
    throw new Error('Missing SMTP_FROM (or SMTP_USER)')
  }

  return { host, port, secure, user, pass, from }
}

function createTransport() {
  const cfg = getSmtpConfig()
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  })
}

function renderHtml(code) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>申论批改系统 - 验证码</h2>
      <p>您的验证码是：</p>
      <div style="font-size: 32px; letter-spacing: 6px; font-weight: 700;">${code}</div>
      <p style="color: #666;">验证码有效期为 5 分钟，请尽快使用。</p>
      <p style="color: #999; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
    </div>
  `.trim()
}

async function sendVerificationEmail(to, code) {
  const cfg = getSmtpConfig()
  const transporter = createTransport()

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject: '申论批改系统 - 验证码',
    html: renderHtml(code),
  })
}

module.exports = { sendVerificationEmail }

