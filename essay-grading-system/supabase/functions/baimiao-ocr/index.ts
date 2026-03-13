import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createXXHash128 } from 'https://esm.sh/hash-wasm@4.12.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BAIMIAO_BASE_URL = 'https://web.baimiaoapp.com'

type BaimiaoAuthCache = { uuid: string; token: string; fetchedAtMs: number }
let baimiaoAuthCache: BaimiaoAuthCache | null = null
type BaimiaoPermCache = { uuid: string; permToken: string; engine: string | null; fetchedAtMs: number }
let baimiaoPermCache: BaimiaoPermCache | null = null

function getStableUuid() {
  const env = Deno.env.get('BAIMIAO_UUID')
  if (env && env.trim()) return env.trim()
  if ((globalThis as any).__baimiao_uuid) return String((globalThis as any).__baimiao_uuid)
  const uuid = crypto.randomUUID()
  ;(globalThis as any).__baimiao_uuid = uuid
  return uuid
}

function base64ToUint8Array(base64: string) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function sniffMimeTypeFromDataUrl(dataUrl: string) {
  const m = /^data:([^;]+);base64,/i.exec(dataUrl)
  return m?.[1] || null
}

async function fetchJson(url: string, init?: RequestInit) {
  const resp = await fetch(url, init)
  const text = await resp.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`)
  }
  return json
}

function assertBaimiaoOk(step: string, json: any) {
  const code = json?.code
  if (code === 0 || code === undefined || code === null) return
  if (code === 4) {
    throw new Error('白描接口被风控拦截（code=4）。请稍后再试/更换网络环境，或改用百度 OCR。')
  }
  throw new Error(`${step} 失败: code=${String(code)} msg=${String(json?.msg ?? json?.message ?? '')}`)
}

function baimiaoCommonHeaders(uuid: string, token: string) {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    Origin: BAIMIAO_BASE_URL,
    Referer: `${BAIMIAO_BASE_URL}/`,
    'X-AUTH-UUID': uuid,
    'X-AUTH-TOKEN': token,
  } as Record<string, string>
}

async function getBaimiaoAuth() {
  const uuid = getStableUuid()
  const now = Date.now()
  if (baimiaoAuthCache && baimiaoAuthCache.uuid === uuid && now - baimiaoAuthCache.fetchedAtMs < 20 * 60_000) {
    return { uuid, authToken: baimiaoAuthCache.token }
  }

  const json = await fetchJson(`${BAIMIAO_BASE_URL}/api/user/login/anonymous`, {
    method: 'POST',
    headers: baimiaoCommonHeaders(uuid, ''),
    body: JSON.stringify({}),
  })
  assertBaimiaoOk('anonymous login', json)
  const authToken = String(json?.data?.token ?? json?.token ?? '')
  if (!authToken) throw new Error(`anonymous login 响应异常: ${JSON.stringify(json)}`)

  baimiaoAuthCache = { uuid, token: authToken, fetchedAtMs: now }
  return { uuid, authToken }
}

async function getBaimiaoPerm() {
  const { uuid, authToken } = await getBaimiaoAuth()
  const now = Date.now()
  if (baimiaoPermCache && baimiaoPermCache.uuid === uuid && now - baimiaoPermCache.fetchedAtMs < 5 * 60_000) {
    return { uuid, authToken, permToken: baimiaoPermCache.permToken, engine: baimiaoPermCache.engine }
  }

  const json = await fetchJson(`${BAIMIAO_BASE_URL}/api/perm/single`, {
    method: 'POST',
    headers: baimiaoCommonHeaders(uuid, authToken),
    body: JSON.stringify({ mode: 'single', version: 'v2' }),
  })
  assertBaimiaoOk('perm/single', json)
  const permToken = String(json?.data?.token ?? json?.token ?? '')
  const engine = json?.data?.engine ? String(json.data.engine) : null
  if (!permToken) throw new Error(`perm/single 响应异常: ${JSON.stringify(json)}`)

  baimiaoPermCache = { uuid, permToken, engine, fetchedAtMs: now }
  return { uuid, authToken, permToken, engine }
}

async function getOssSign(mimeType: string, uuid: string, authToken: string) {
  const url = `${BAIMIAO_BASE_URL}/api/oss/sign?mime_type=${encodeURIComponent(mimeType)}`
  const json = await fetchJson(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Origin: BAIMIAO_BASE_URL,
      Referer: `${BAIMIAO_BASE_URL}/`,
      'X-AUTH-UUID': uuid,
      'X-AUTH-TOKEN': authToken,
    },
  })
  assertBaimiaoOk('oss/sign', json)
  return json?.data ?? json
}

async function uploadToOss(signInfo: any, bytes: Uint8Array, mimeType: string) {
  // Newer API shape (OSS4 form upload)
  if (signInfo?.result?.host && signInfo?.result?.file_key && signInfo?.result?.policy) {
    const r = signInfo.result
    const form = new FormData()
    form.append('key', String(r.file_key))
    form.append('policy', String(r.policy))
    form.append('x-oss-signature-version', String(r.x_oss_signature_version))
    form.append('x-oss-credential', String(r.x_oss_credential))
    form.append('x-oss-date', String(r.x_oss_date))
    form.append('x-oss-signature', String(r.signature))
    if (r.security_token) form.append('x-oss-security-token', String(r.security_token))
    form.append('success_action_status', '200')
    if (mimeType) form.append('Content-Type', mimeType)
    form.append('file', new Blob([bytes], { type: mimeType || 'application/octet-stream' }))

    const resp = await fetch(String(r.host), {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      body: form,
    })
    const text = await resp.text().catch(() => '')
    if (!resp.ok) throw new Error(`OSS 上传失败: ${resp.status} ${text}`)
    return String(r.file_key)
  }

  throw new Error(`无法识别 oss sign 返回格式: ${JSON.stringify(signInfo)}`)
}

async function submitOcr(payload: any, uuid: string, authToken: string) {
  const json = await fetchJson(`${BAIMIAO_BASE_URL}/api/ocr/image/plus`, {
    method: 'POST',
    headers: baimiaoCommonHeaders(uuid, authToken),
    body: JSON.stringify(payload),
  })
  assertBaimiaoOk('ocr/submit', json)
  const jobStatusId = json?.data?.jobStatusId ?? json?.jobStatusId
  if (!jobStatusId) throw new Error(`提交 OCR 响应异常: ${JSON.stringify(json)}`)
  return String(jobStatusId)
}

async function getStatus(jobStatusId: string, uuid: string, authToken: string) {
  const url = `${BAIMIAO_BASE_URL}/api/ocr/image/plus/status?jobStatusId=${encodeURIComponent(jobStatusId)}`
  const json = await fetchJson(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Origin: BAIMIAO_BASE_URL,
      Referer: `${BAIMIAO_BASE_URL}/`,
      'X-AUTH-UUID': uuid,
      'X-AUTH-TOKEN': authToken,
    },
  })
  assertBaimiaoOk('ocr/status', json)
  return json
}

async function pollResult(jobStatusId: string, uuid: string, authToken: string, timeoutMs = 120_000, intervalMs = 1500) {
  const start = Date.now()
  while (true) {
    const json = await getStatus(jobStatusId, uuid, authToken)
    const ended = json?.data?.isEnded ?? json?.isEnded ?? false
    if (ended) return json
    if (Date.now() - start > timeoutMs) {
      throw new Error('轮询超时（白描未在限定时间内返回结果）')
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

function sanitizeOcrText(input: string) {
  let s = String(input ?? '')
  s = s.replace(/[\u0000-\u001f\u007f]/g, '')
  s = s.replace(/\u00a0/g, ' ').replace(/\u3000/g, ' ')
  s = s.replace(/[ \t]{2,}/g, ' ')
  s = s.replace(/[★☆■□◆◇●○▲△▼▽※→←↑↓▶▷◁◀◆■□●○◎◇◆]/g, '')
  s = s.replace(
    /[^\p{Script=Han}\p{L}\p{N}\s，。！？；：、,.!?;:（）()《》〈〉【】\[\]“”‘’'"\-—…·\/]/gu,
    ''
  )
  s = s.replace(/([\p{Script=Han}])\s+([\p{Script=Han}])/gu, '$1$2')
  s = s.replace(/\s+([，。！？；：、,.!?;:])/g, '$1')
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
    const needSpace = /[A-Za-z0-9]/.test(prevLast) && /[A-Za-z0-9]/.test(nextFirst)
    current += (needSpace ? ' ' : '') + line
    if (shouldBreakParagraph(line)) flush()
  }

  flush()
  return paragraphs.join('\n\n')
}

function extractBaimiaoText(resp: any) {
  const words =
    resp?.data?.ydResp?.words_result ??
    resp?.data?.result?.words_result ??
    resp?.result?.words_result ??
    []
  const lines = Array.isArray(words) ? words.map((x: any) => String(x?.words || '')).filter(Boolean) : []
  return joinLinesToParagraphs(lines).trim()
}

async function calcXxHash128Hex(bytes: Uint8Array) {
  const toHex = (buf: ArrayBuffer) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

  // Baimiao web uses xxhash128, but the WASM module may fail to load in some Edge runtimes.
  // Fallback to sha256 (trimmed to 128-bit) as a best-effort stable fingerprint.
  try {
    const hasher = await createXXHash128()
    hasher.init(0, 0)
    hasher.update(bytes)
    return (hasher.digest('hex') as string) || ''
  } catch {
    const sha = await crypto.subtle.digest('SHA-256', bytes)
    return toHex(sha).slice(0, 32)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const imageBase64Raw = body?.imageBase64 ?? body?.image_base64 ?? null
    const imageDataUrl = body?.imageDataUrl ?? body?.image_data_url ?? null
    const mimeTypeHint = body?.mimeType ?? body?.mime_type ?? null

    let imageBase64: string | null = null
    let mimeType: string | null = null

    if (typeof imageBase64Raw === 'string' && imageBase64Raw.trim()) {
      imageBase64 = imageBase64Raw.trim()
      mimeType = typeof mimeTypeHint === 'string' && mimeTypeHint.trim() ? mimeTypeHint.trim() : null
    } else if (typeof imageDataUrl === 'string' && imageDataUrl.trim()) {
      mimeType = sniffMimeTypeFromDataUrl(imageDataUrl.trim())
      const commaIndex = imageDataUrl.indexOf(',')
      imageBase64 = commaIndex >= 0 ? imageDataUrl.slice(commaIndex + 1).trim() : imageDataUrl.trim()
    }

    if (!imageBase64) {
      throw new Error('imageBase64 (or imageDataUrl) is required')
    }

    const bytes = base64ToUint8Array(imageBase64)
    const mime = mimeType || 'image/jpeg'

    const { uuid, authToken, permToken, engine } = await getBaimiaoPerm()
    const signInfo = await getOssSign(mime, uuid, authToken)
    const fileKey = await uploadToOss(signInfo, bytes, mime)
    const hash = await calcXxHash128Hex(bytes)

    const jobStatusId = await submitOcr(
      {
        batchId: '',
        total: 1,
        token: permToken,
        hash,
        fileKey,
      },
      uuid,
      authToken
    )

    const result = await pollResult(jobStatusId, uuid, authToken)
    const text = extractBaimiaoText(result)
    if (!text) throw new Error('未识别到文字（请尽量保证图片清晰、光线充足、文字占满画面）')

    return new Response(
      JSON.stringify({
        success: true,
        provider: 'baimiao',
        engine,
        text,
        raw: result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('baimiao-ocr error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
