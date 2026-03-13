import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function maskEmail(email: string) {
  const s = String(email || '')
  const at = s.indexOf('@')
  if (at <= 1) return s
  return `${s.slice(0, 1)}***${s.slice(at - 1)}`
}

function getSupabaseAuthClient() {
  const url = String(Deno.env.get('SUPABASE_URL') || '').trim()
  // Prefer anon key for Auth calls; fall back to service role if needed.
  const key = String(
    Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  ).trim()
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in function secrets')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
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

    // NOTE: Supabase Edge Functions cannot connect to SMTP servers (like smtp.163.com) via TCP.
    // We trigger Supabase Auth Email OTP instead, so the email is sent by Supabase Auth mailer.
    // To use 163 SMTP, configure it in Supabase Dashboard: Auth -> SMTP.

    const supabase = getSupabaseAuthClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Allow new users to receive OTP during registration.
        shouldCreateUser: true,
      },
    })
    if (error) {
      throw new Error(error.message || '发送验证码失败')
    }

    console.log(`OTP 已触发发送: ${maskEmail(email)}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: '验证码已发送',
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
