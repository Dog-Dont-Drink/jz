import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 生成 6 位验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function maskEmail(email: string) {
  const s = String(email || '')
  const at = s.indexOf('@')
  if (at <= 1) return s
  return `${s.slice(0, 1)}***${s.slice(at - 1)}`
}

async function sendEmailViaSmtp2Go(to: string, code: string) {
  // Supabase Edge Functions cannot reliably send SMTP directly; use an HTTP email provider.
  // SMTP2GO API expects an API key and a verified sender.
  const apiKey = Deno.env.get('SMTP2GO_API_KEY') || Deno.env.get('EMAIL_PASSWORD')
  const sender = Deno.env.get('SMTP2GO_SENDER') || Deno.env.get('EMAIL_USER')

  if (!apiKey || !sender) {
    throw new Error('邮件服务未配置：请设置 SMTP2GO_API_KEY 和 SMTP2GO_SENDER（或兼容变量 EMAIL_PASSWORD/EMAIL_USER）')
  }

  const response = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      to: [to],
      sender,
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
    const t = await response.text().catch(() => '')
    throw new Error(`发送邮件失败（SMTP2GO HTTP ${response.status}）：${t || response.statusText}`)
  }

  const json = await response.json().catch(() => null)
  const succeeded = Number(json?.data?.succeeded ?? 0)
  const failed = Number(json?.data?.failed ?? 0)
  if (succeeded <= 0 || failed > 0) {
    throw new Error(`发送邮件失败（SMTP2GO 返回异常）：${JSON.stringify(json)}`)
  }

  return json
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

    // 存储验证码到 Supabase（使用 verification_codes 表）
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Upsert by unique key (email)
    const upsertResp = await fetch(`${supabaseUrl}/rest/v1/verification_codes?on_conflict=email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email,
        code,
        expires_at: new Date(expiresAt).toISOString(),
      }),
    })
    if (!upsertResp.ok) {
      const t = await upsertResp.text().catch(() => '')
      throw new Error(`保存验证码失败（DB HTTP ${upsertResp.status}）：${t || upsertResp.statusText}`)
    }

    // 发送邮件
    await sendEmailViaSmtp2Go(email, code)
    console.log(`验证码已发送: ${maskEmail(email)}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: '验证码已发送',
        // Debug-only (set RETURN_VERIFICATION_CODE=1 in secrets if needed)
        code: Deno.env.get('RETURN_VERIFICATION_CODE') === '1' ? code : undefined,
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
