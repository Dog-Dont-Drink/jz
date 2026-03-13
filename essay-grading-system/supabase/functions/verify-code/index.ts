import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed. Use POST with JSON body: { "email": "...", "code": "......" }' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  try {
    const { email, code } = await req.json().catch(() => ({}))

    if (!email || !code) {
      return new Response(
        JSON.stringify({ success: false, error: '邮箱和验证码不能为空' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    // 从 Supabase 查询验证码
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const response = await fetch(
      `${supabaseUrl}/rest/v1/verification_codes?email=eq.${email}&select=*`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )

    const data = await response.json()

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: '验证码不存在或已过期' }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    const stored = data[0]

    // 检查是否过期
    if (new Date(stored.expires_at) < new Date()) {
      // 删除过期验证码
      await fetch(`${supabaseUrl}/rest/v1/verification_codes?email=eq.${email}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      })

      return new Response(
        JSON.stringify({ success: false, error: '验证码已过期' }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    // 验证验证码
    if (stored.code !== code) {
      return new Response(
        JSON.stringify({ success: false, error: '验证码错误' }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      )
    }

    // 验证成功，删除验证码
    await fetch(`${supabaseUrl}/rest/v1/verification_codes?email=eq.${email}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    })

    return new Response(
      JSON.stringify({ success: true, message: '验证成功' }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    console.error('验证失败:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '验证失败',
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
