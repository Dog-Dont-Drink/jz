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

function requireEnv(name) {
  const value = process.env[name]
  if (!value || !value.trim()) throw new Error(`Missing env var: ${name}`)
  return value.trim()
}

async function main() {
  const imagePath = process.argv[2]
  if (!imagePath) {
    console.error('Usage: node scripts/test-edge-ocr.mjs /absolute/path/to/image.jpg')
    process.exit(1)
  }

  const resolved = path.resolve(imagePath)
  if (!fs.existsSync(resolved)) throw new Error(`Image not found: ${resolved}`)

  loadDotEnv(path.resolve(process.cwd(), '.env'))

  const supabaseUrl = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')

  const imageBase64 = fs.readFileSync(resolved).toString('base64')

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ocr-recognize`
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ imageBase64 }),
  })

  const text = await resp.text()
  console.log(`HTTP ${resp.status}`)
  console.log(text)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
