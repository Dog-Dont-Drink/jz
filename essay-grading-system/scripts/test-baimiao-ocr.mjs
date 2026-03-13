import fs from 'node:fs'
import path from 'node:path'
import { createXXHash128 } from 'hash-wasm'

function getOrCreateStableUuid() {
  const env = process.env.BAIMIAO_UUID
  if (env && env.trim()) return env.trim()
  const p = path.resolve('/tmp/baimiao_uuid.txt')
  try {
    if (fs.existsSync(p)) {
      const existing = fs.readFileSync(p, 'utf8').trim()
      if (existing) return existing
    }
  } catch {
    // ignore
  }
  const uuid = crypto.randomUUID()
  try {
    fs.writeFileSync(p, uuid, 'utf8')
  } catch {
    // ignore
  }
  return uuid
}

async function fetchJson(url, init) {
  const resp = await fetch(url, init)
  const text = await resp.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`)
  }
  return json
}

function sanitizeOcrText(input) {
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

function extractText(resp) {
  const words =
    resp?.data?.ydResp?.words_result ??
    resp?.data?.result?.words_result ??
    resp?.result?.words_result ??
    []
  const lines = Array.isArray(words) ? words.map((x) => String(x?.words || '')).filter(Boolean) : []
  return lines.map((line) => sanitizeOcrText(line)).filter(Boolean).join('\n').trim()
}

async function calcXxHash128Hex(filePath) {
  const bytes = new Uint8Array(fs.readFileSync(filePath))
  const hasher = await createXXHash128()
  hasher.init(0, 0)
  hasher.update(bytes)
  return hasher.digest('hex')
}

async function getPermToken(baseUrl) {
  const url = `${baseUrl}/api/user/login/anonymous`
  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      // Required by baimiao web API
      'X-AUTH-UUID': globalThis.__BM_UUID || '',
      'X-AUTH-TOKEN': '',
    },
    body: JSON.stringify({}),
  })
  const token = json?.data?.token ?? json?.token
  if (!token) throw new Error(`perm response invalid: ${JSON.stringify(json)}`)
  return String(token)
}

async function getOcrPermToken(baseUrl, { mode = 'single', version = 'v2' } = {}) {
  const url = `${baseUrl}/api/perm/single`
  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      'X-AUTH-UUID': globalThis.__BM_UUID || '',
      'X-AUTH-TOKEN': globalThis.__BM_TOKEN || '',
    },
    body: JSON.stringify({ mode, version }),
  })
  const token = json?.data?.token ?? json?.token
  const engine = json?.data?.engine
  if (!token) throw new Error(`perm/single response invalid: ${JSON.stringify(json)}`)
  return { token: String(token), engine: engine ? String(engine) : null, raw: json }
}

async function getOssSign(baseUrl, mimeType) {
  const url = `${baseUrl}/api/oss/sign?mime_type=${encodeURIComponent(mimeType)}`
  const json = await fetchJson(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      'X-AUTH-UUID': globalThis.__BM_UUID || '',
      'X-AUTH-TOKEN': globalThis.__BM_TOKEN || '',
    },
  })
  return json?.data ?? json
}

async function uploadToOss(signInfo, filePath, mimeType) {
  const file = fs.readFileSync(filePath)

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
    form.append('file', new Blob([file], { type: mimeType || 'application/octet-stream' }))

    const resp = await fetch(String(r.host), {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      body: form,
    })
    if (!resp.ok) throw new Error(`OSS 表单上传失败: ${resp.status} ${await resp.text()}`)
    return String(r.file_key)
  }

  if (signInfo?.uploadUrl && signInfo?.fields && signInfo?.fileKey) {
    const form = new FormData()
    for (const [k, v] of Object.entries(signInfo.fields)) form.append(k, String(v))
    form.append('file', new Blob([file], { type: mimeType || 'application/octet-stream' }))
    const resp = await fetch(signInfo.uploadUrl, {
      method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      body: form,
    })
    if (!resp.ok) throw new Error(`OSS 表单上传失败: ${resp.status} ${await resp.text()}`)
    return String(signInfo.fileKey)
  }

  if (signInfo?.uploadUrl && signInfo?.fileKey) {
    const resp = await fetch(signInfo.uploadUrl, {
      method: 'PUT',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': mimeType || 'application/octet-stream',
      },
      body: file,
    })
    if (!resp.ok) throw new Error(`OSS PUT 上传失败: ${resp.status} ${await resp.text()}`)
    return String(signInfo.fileKey)
  }

  throw new Error(`无法识别 oss sign 返回格式: ${JSON.stringify(signInfo)}`)
}

async function submitOcr(baseUrl, payload) {
  const url = `${baseUrl}/api/ocr/image/plus`
  const json = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      'X-AUTH-UUID': globalThis.__BM_UUID || '',
      'X-AUTH-TOKEN': globalThis.__BM_TOKEN || '',
    },
    body: JSON.stringify(payload),
  })
  const jobStatusId = json?.data?.jobStatusId ?? json?.jobStatusId
  if (!jobStatusId) throw new Error(`submit response invalid: ${JSON.stringify(json)}`)
  return String(jobStatusId)
}

async function trySubmitVariants(baseUrl, { token, hash, fileKey }) {
  const variants = [
    { batchId: '', total: 1, token, hash, fileKey },
    { batchId: '', total: 1, token, hash, file_key: fileKey },
    { batchId: '', total: 1, token, hash, fileKey, file_key: fileKey },
    { batchId: '', total: 1, hash, fileKey },
    { batchId: '', total: 1, hash, file_key: fileKey },
  ]

  for (const payload of variants) {
    const url = `${baseUrl}/api/ocr/image/plus`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/`,
        'X-AUTH-UUID': globalThis.__BM_UUID || '',
        'X-AUTH-TOKEN': globalThis.__BM_TOKEN || '',
      },
      body: JSON.stringify(payload),
    })
    const json = await resp.json().catch(() => null)
    console.log('submit payload keys=', Object.keys(payload).sort().join(','), '=>', json)
    const jobStatusId = json?.data?.jobStatusId ?? json?.jobStatusId
    if (jobStatusId) return String(jobStatusId)
  }
  return null
}

async function getStatus(baseUrl, jobStatusId) {
  const url = `${baseUrl}/api/ocr/image/plus/status?jobStatusId=${encodeURIComponent(jobStatusId)}`
  return fetchJson(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/`,
      'X-AUTH-UUID': globalThis.__BM_UUID || '',
      'X-AUTH-TOKEN': globalThis.__BM_TOKEN || '',
    },
  })
}

async function pollResult(baseUrl, jobStatusId, timeoutMs = 120000, intervalMs = 2000) {
  const start = Date.now()
  while (true) {
    const data = await getStatus(baseUrl, jobStatusId)
    const ended = data?.data?.isEnded ?? data?.isEnded ?? false
    if (ended) return data
    if (Date.now() - start > timeoutMs) throw new Error('轮询超时')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

async function main() {
  const imagePath = process.argv[2]
  if (!imagePath) {
    console.error('Usage: node scripts/test-baimiao-ocr.mjs /absolute/path/to/image.jpg')
    process.exit(1)
  }
  const resolved = path.resolve(imagePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`Image not found: ${resolved}`)
  }

  const baseUrl = (process.argv[3] || 'https://web.baimiaoapp.com').replace(/\/$/, '')
  const mimeType = resolved.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

  globalThis.__BM_UUID = getOrCreateStableUuid()

  console.log('[1/6] calc xxhash128...')
  const hash = await calcXxHash128Hex(resolved)
  console.log('hash=', hash)

  console.log('[2/6] auth token (anonymous login)...')
  const authToken = await getPermToken(baseUrl)
  globalThis.__BM_TOKEN = authToken
  console.log('auth_token_len=', authToken.length)

  console.log('[2.1/6] ocr perm token...')
  const perm = await getOcrPermToken(baseUrl, { mode: 'single', version: 'v2' })
  globalThis.__BM_OCR_TOKEN = perm.token
  console.log('ocr_token=', perm.token, 'engine=', perm.engine)

  console.log('[3/6] oss sign...')
  const signInfo = await getOssSign(baseUrl, mimeType)
  console.log('sign keys=', Object.keys(signInfo || {}).slice(0, 10))

  console.log('[4/6] upload oss...')
  const fileKey = await uploadToOss(signInfo, resolved, mimeType)
  console.log('fileKey=', fileKey)

  console.log('[5/6] submit ocr...')
  const jobStatusId =
    (await trySubmitVariants(baseUrl, { token: perm.token, hash, fileKey })) ??
    (await submitOcr(baseUrl, { batchId: '', total: 1, token: perm.token, hash, fileKey }))
  console.log('jobStatusId=', jobStatusId)

  console.log('[6/6] poll result...')
  const result = await pollResult(baseUrl, jobStatusId)
  const text = extractText(result)

  console.log('\n=== text ===')
  console.log(`text_len=${text.length}`)
  console.log(text.slice(0, 1000))

  if (!text) {
    console.log('\n=== debug(result keys) ===')
    const d = result?.data ?? result
    console.log('top_keys=', Object.keys(result || {}))
    console.log('data_keys=', d && typeof d === 'object' ? Object.keys(d) : null)
    console.log('ended=', d?.isEnded ?? null, 'status=', d?.status ?? null, 'msg=', d?.msg ?? d?.message ?? null)
    console.log('result_keys=', d?.result && typeof d.result === 'object' ? Object.keys(d.result) : null)
    console.log('raw_snip=', JSON.stringify(result).slice(0, 1200))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
