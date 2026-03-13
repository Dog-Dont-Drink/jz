import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type BaiduTokenCache = { accessToken: string; expiresAtMs: number }
let baiduTokenCache: BaiduTokenCache | null = null

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function getBaiduAccessToken() {
  const apiKey = Deno.env.get('BAIDU_OCR_API_KEY')
  const secretKey = Deno.env.get('BAIDU_OCR_SECRET_KEY')
  if (!apiKey || !secretKey) {
    throw new Error('BAIDU_OCR_API_KEY / BAIDU_OCR_SECRET_KEY not configured')
  }

  const now = Date.now()
  if (baiduTokenCache && baiduTokenCache.expiresAtMs > now) {
    return baiduTokenCache.accessToken
  }

  const tokenUrl = new URL('https://aip.baidubce.com/oauth/2.0/token')
  tokenUrl.searchParams.set('grant_type', 'client_credentials')
  tokenUrl.searchParams.set('client_id', apiKey)
  tokenUrl.searchParams.set('client_secret', secretKey)

  const tokenResp = await fetch(tokenUrl.toString(), { method: 'POST' })
  const tokenJson = await tokenResp.json().catch(() => null)

  if (!tokenResp.ok) {
    throw new Error(`Baidu OCR token request failed: ${tokenResp.status} ${JSON.stringify(tokenJson)}`)
  }

  const accessToken = tokenJson?.access_token
  const expiresIn = Number(tokenJson?.expires_in ?? 0)
  if (!accessToken || !expiresIn) {
    throw new Error(`Baidu OCR token response invalid: ${JSON.stringify(tokenJson)}`)
  }

  baiduTokenCache = {
    accessToken,
    expiresAtMs: now + expiresIn * 1000 - 60_000,
  }

  return accessToken
}

async function baiduOcrRequest(pathname: string, imageBase64: string, params: Record<string, string>) {
  const accessToken = await getBaiduAccessToken()
  const ocrUrl = new URL(`https://aip.baidubce.com${pathname}`)
  ocrUrl.searchParams.set('access_token', accessToken)

  const body = new URLSearchParams()
  body.set('image', imageBase64)
  for (const [key, value] of Object.entries(params)) {
    body.set(key, value)
  }

  const resp = await fetch(ocrUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const json = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new Error(`Baidu OCR request failed: ${resp.status} ${JSON.stringify(json)}`)
  }

  if (json?.error_code) {
    throw new Error(`Baidu OCR error: ${json.error_code} ${json.error_msg || ''}`.trim())
  }

  const words: string[] = Array.isArray(json?.words_result)
    ? json.words_result.map((w: any) => String(w?.words ?? '')).filter(Boolean)
    : []

  return { text: words.join('\n'), raw: json }
}

function sanitizeOcrText(input: string) {
  let s = String(input ?? '')

  // Remove control characters.
  s = s.replace(/[\u0000-\u001f\u007f]/g, '')
  // Normalize spaces.
  s = s.replace(/\u00a0/g, ' ').replace(/\u3000/g, ' ')
  s = s.replace(/[ \t]{2,}/g, ' ')

  // Remove common decorative/noise symbols that OCR may produce.
  s = s.replace(/[★☆■□◆◇●○▲△▼▽※→←↑↓▶▷◁◀◆■□●○◎◇◆]/g, '')

  // Keep: letters/numbers/CJK/whitespace + common punctuation; drop the rest.
  // (We intentionally keep numbering symbols like "（1）" and punctuation needed for答题要点.)
  s = s.replace(
    /[^\p{Script=Han}\p{L}\p{N}\s，。！？；：、,.!?;:（）()《》〈〉【】\[\]“”‘’'"\-—…·\/]/gu,
    ''
  )

  // Remove spaces between two CJK chars.
  s = s.replace(/([\p{Script=Han}])\s+([\p{Script=Han}])/gu, '$1$2')
  // Trim spaces around punctuation.
  s = s.replace(/\s+([，。！？；：、,.!?;:])/g, '$1')
  s = s.replace(/([（(【\[])\s+/g, '$1')
  s = s.replace(/\s+([）)】\]])/g, '$1')

  return s.trim()
}

function isBulletLike(line: string) {
  const s = line.trim()
  if (!s) return false
  return (
    /^(\(?\d{1,3}[.)）]|（\d{1,3}）|\d{1,3}[、.．]|[一二三四五六七八九十]{1,3}[、.．])/.test(s) ||
    /^[-–—•*]+\s+/.test(s)
  )
}

function shouldBreakParagraph(line: string) {
  const s = line.trim()
  if (!s) return true
  return /[。！？!?]$/.test(s)
}

function joinLinesToParagraphs(lines: string[]) {
  const paragraphs: string[] = []
  let current = ''

  const flush = () => {
    const t = current.trim()
    if (t) paragraphs.push(t)
    current = ''
  }

  for (const rawLine of lines) {
    const line = sanitizeOcrText(rawLine)
    if (!line) continue

    if (isBulletLike(line)) {
      flush()
      paragraphs.push(line)
      continue
    }

    if (!current) {
      current = line
      if (shouldBreakParagraph(line)) flush()
      continue
    }

    const prevLast = current.slice(-1)
    const nextFirst = line.slice(0, 1)
    const needSpace =
      /[A-Za-z0-9]/.test(prevLast) && /[A-Za-z0-9]/.test(nextFirst)

    current += (needSpace ? ' ' : '') + line

    if (shouldBreakParagraph(line)) flush()
  }

  flush()
  return paragraphs.join('\n\n')
}

function formatBaiduOcrResultToText(raw: any) {
  const lines: string[] = Array.isArray(raw?.words_result)
    ? raw.words_result.map((w: any) => String(w?.words ?? '')).filter(Boolean)
    : []
  return joinLinesToParagraphs(lines)
}

async function baiduHandwritingOcr(imageBase64: string) {
  return baiduOcrRequest('/rest/2.0/ocr/v1/handwriting', imageBase64, {
    detect_direction: 'true',
    probability: 'true',
  })
}

async function baiduGeneralBasicOcr(imageBase64: string) {
  return baiduOcrRequest('/rest/2.0/ocr/v1/general_basic', imageBase64, {
    detect_direction: 'true',
    paragraph: 'true',
    language_type: 'CHN_ENG',
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const submissionId = body?.submissionId
    const imageBase64Raw = body?.imageBase64 ?? body?.image_base64 ?? null
    const imageDataUrl = body?.imageDataUrl ?? body?.image_data_url ?? null

    let imageBase64: string | null = null
    if (typeof imageBase64Raw === 'string' && imageBase64Raw.trim()) {
      imageBase64 = imageBase64Raw.trim()
    } else if (typeof imageDataUrl === 'string' && imageDataUrl.trim()) {
      const commaIndex = imageDataUrl.indexOf(',')
      imageBase64 = commaIndex >= 0 ? imageDataUrl.slice(commaIndex + 1) : imageDataUrl
      imageBase64 = imageBase64.trim()
    }

    // If no base64 provided, fall back to the old submissionId + Storage path.
    if (!imageBase64) {
      if (!submissionId) {
        throw new Error('imageBase64 (or imageDataUrl) is required')
      }
      if (typeof submissionId !== 'string' || !isUuid(submissionId)) {
        throw new Error(`submissionId must be a UUID when imageBase64 is not provided (got: ${String(submissionId)})`)
      }

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Get submission
      const { data: submission, error: submissionError } = await supabaseClient
        .from('essay_submissions')
        .select('*')
        .eq('id', submissionId)
        .single()

      if (submissionError) throw submissionError
      if (!submission?.image_path) {
        throw new Error('submission.image_path is empty; provide imageBase64 instead')
      }

      // Get image from storage
      const { data: imageData, error: storageError } = await supabaseClient
        .storage
        .from('essay-images')
        .download(submission.image_path)

      if (storageError) throw storageError

      // Convert blob to base64
      const arrayBuffer = await imageData.arrayBuffer()
      imageBase64 = arrayBufferToBase64(arrayBuffer)
    }

    // Prefer handwriting endpoint for handwritten answers.
    // If it fails or returns empty, fall back to general_basic.
    const result =
      (await baiduHandwritingOcr(imageBase64).catch(() => null)) ??
      (await baiduGeneralBasicOcr(imageBase64))

    const recognizedText = formatBaiduOcrResultToText(result.raw) || sanitizeOcrText(result.text)
    if (!recognizedText.trim()) {
      throw new Error('No text recognized')
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: recognizedText,
        raw: result.raw,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('OCR error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
