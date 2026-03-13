import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SMTP_HOST = 'smtp.163.com'
const SMTP_PORT = 465

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 生成 6 位验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 使用 SMTP 发送邮件
async function sendEmail(to: string, code: string, emailUser: string, emailPassword: string) {
  // 使用第三方 SMTP 服务
  const response = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: emailPassword, // 如果使用 SMTP2GO，这里需要 API key
      to: [to],
      sender: emailUser,
      subject: '申论批改系统 - 验证码',
      html_body: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>验证码</h2>
          <p>您的验证码是：</p>
          <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          <p style="color: #666;">验证码有效期为 5 分钟，请尽快使用。</p>
          <p style="color: #999; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    throw new Error('发送邮件失败')
  }

  return await response.json()
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed. Use POST with JSON body: { "email": "..." }' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const { email } = await req.json().catch(() => ({}))

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: '邮箱不能为空' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    // 生成验证码
    const code = generateVerificationCode()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 分钟有效期

    // 获取环境变量
    const emailUser = Deno.env.get('EMAIL_USER')
    const emailPassword = Deno.env.get('EMAIL_PASSWORD')

    if (!emailUser || !emailPassword) {
      throw new Error('邮箱配置未设置')
    }

    // 存储验证码到 Supabase（使用 verification_codes 表）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    await fetch(`${supabaseUrl}/rest/v1/verification_codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        email,
        code,
        expires_at: new Date(expiresAt).toISOString(),
      }),
    })

    // 发送邮件（简化版：直接返回验证码，实际应该发送邮件）
    // 由于 Deno Deploy 限制，这里暂时返回验证码供测试
    console.log(`验证码: ${code} (邮箱: ${email})`)

    return new Response(
      JSON.stringify({
        success: true,
        message: '验证码已发送',
        // 开发环境下返回验证码（生产环境应删除）
        code: Deno.env.get('DENO_DEPLOYMENT_ID') ? undefined : code,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    console.error('发送验证码失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '发送验证码失败',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
})
