import fs from 'node:fs'
import path from 'node:path'

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function getEnv(name) {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

function requireEnv(...names) {
  for (const name of names) {
    const value = getEnv(name)
    if (value) return value
  }
  throw new Error(`Missing env var. Set one of: ${names.join(', ')}`)
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

async function getAccessToken({ apiKey, secretKey }) {
  const tokenUrl = new URL('https://aip.baidubce.com/oauth/2.0/token')
  tokenUrl.searchParams.set('grant_type', 'client_credentials')
  tokenUrl.searchParams.set('client_id', apiKey)
  tokenUrl.searchParams.set('client_secret', secretKey)
  const json = await fetchJson(tokenUrl.toString(), { method: 'POST' })
  if (!json?.access_token) throw new Error(`Token response missing access_token: ${JSON.stringify(json)}`)
  return json.access_token
}

async function baiduOcr({ accessToken, pathname, imageBase64, params }) {
  const url = new URL(`https://aip.baidubce.com${pathname}`)
  url.searchParams.set('access_token', accessToken)

  const body = new URLSearchParams()
  body.set('image', imageBase64)
  for (const [k, v] of Object.entries(params)) body.set(k, v)

  const json = await fetchJson(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (json?.error_code) {
    throw new Error(`Baidu OCR error: ${json.error_code} ${json.error_msg || ''}`.trim())
  }

  const words = Array.isArray(json?.words_result) ? json.words_result.map((w) => String(w?.words ?? '')).filter(Boolean) : []
  return { text: words.join('\n'), raw: json }
}

async function main() {
  const imagePath = process.argv[2]
  if (!imagePath) {
    console.error('Usage: node scripts/test-baidu-ocr.mjs /absolute/path/to/image.jpg')
    process.exit(1)
  }

  const resolved = path.resolve(imagePath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`Image not found: ${resolved}`)
  }

  loadDotEnv(path.resolve(process.cwd(), '.env'))

  const apiKey = requireEnv('BAIDU_OCR_API_KEY', 'VITE_BAIDU_OCR_API_KEY')
  const secretKey = requireEnv('BAIDU_OCR_SECRET_KEY', 'VITE_BAIDU_OCR_SECRET_KEY')

  const imageBase64 = fs.readFileSync(resolved).toString('base64')
  const accessToken = await getAccessToken({ apiKey, secretKey })

  const handwriting = await baiduOcr({
    accessToken,
    pathname: '/rest/2.0/ocr/v1/handwriting',
    imageBase64,
    params: { detect_direction: 'true', probability: 'true' },
  }).catch((e) => ({ error: e }))

  const general = await baiduOcr({
    accessToken,
    pathname: '/rest/2.0/ocr/v1/general_basic',
    imageBase64,
    params: { detect_direction: 'true', paragraph: 'true', language_type: 'CHN_ENG' },
  }).catch((e) => ({ error: e }))

  console.log('=== handwriting ===')
  if (handwriting.error) {
    console.log(String(handwriting.error))
  } else {
    console.log(`text_len=${handwriting.text.length}`)
    console.log(handwriting.text.slice(0, 800))
  }

  console.log('\n=== general_basic ===')
  if (general.error) {
    console.log(String(general.error))
  } else {
    console.log(`text_len=${general.text.length}`)
    console.log(general.text.slice(0, 800))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
