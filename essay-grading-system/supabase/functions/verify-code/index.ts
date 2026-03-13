import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getSupabaseAuthClient() {
  const url = String(Deno.env.get('SUPABASE_URL') || '').trim()
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

    const supabase = getSupabaseAuthClient()
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: String(code),
      type: 'email',
    })
    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message || '验证码错误或已过期' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '验证成功',
        auth_user_id: data?.user?.id ?? null,
      }),
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
