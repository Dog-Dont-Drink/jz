import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// 验证码存储（生产环境应使用 Redis）
const verificationCodes = new Map()

// 生成 6 位验证码
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 创建邮件传输器
function getEmailTransporter() {
  const email = process.env.VITE_EMAIL_USER
  const password = process.env.VITE_EMAIL_PASSWORD

  if (!email || !password) {
    throw new Error('邮箱配置未设置')
  }

  return nodemailer.createTransport({
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  })
}

// 发送验证码 API
app.post('/api/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ success: false, error: '邮箱不能为空' })
    }

    const code = generateVerificationCode()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 分钟有效期

    // 存储验证码
    verificationCodes.set(email, { code, expiresAt })

    // 发送邮件
    const transporter = getEmailTransporter()
    await transporter.sendMail({
      from: process.env.VITE_EMAIL_USER,
      to: email,
      subject: '申论批改系统 - 验证码',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>验证码</h2>
          <p>您的验证码是：</p>
          <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          <p style="color: #666;">验证码有效期为 5 分钟，请尽快使用。</p>
          <p style="color: #999; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
        </div>
      `,
    })

    console.log(`验证码已发送到 ${email}: ${code}`)
    res.json({ success: true, message: '验证码已发送' })
  } catch (error) {
    console.error('发送验证码失败:', error)
    res.status(500).json({ success: false, error: error.message || '发送验证码失败' })
  }
})

// 验证验证码 API
app.post('/api/verify-code', (req, res) => {
  try {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(400).json({ success: false, error: '邮箱和验证码不能为空' })
    }

    const stored = verificationCodes.get(email)
    if (!stored) {
      return res.json({ success: false, error: '验证码不存在或已过期' })
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(email)
      return res.json({ success: false, error: '验证码已过期' })
    }

    if (stored.code !== code) {
      return res.json({ success: false, error: '验证码错误' })
    }

    verificationCodes.delete(email)
    res.json({ success: true, message: '验证成功' })
  } catch (error) {
    console.error('验证失败:', error)
    res.status(500).json({ success: false, error: error.message || '验证失败' })
  }
})

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
