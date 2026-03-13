function getApiBaseUrl() {
  const runtimeBase = String(window.__APP_CONFIG__?.API_BASE_URL || '').trim()
  const envBase = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  const base = runtimeBase || envBase
  return base ? base.replace(/\/$/, '') : ''
}

async function parseJsonResponse(resp: Response) {
  const text = await resp.text().catch(() => '')
  if (!text) {
    return { success: false, error: 'Empty response from server' }
  }
  try {
    return JSON.parse(text)
  } catch {
    // Common case: upstream proxy returns HTML error pages (413/502/504) which breaks JSON parsing.
    const ct = resp.headers.get('content-type') || ''
    const hint = ct.includes('text/html') || text.trim().startsWith('<')
      ? 'Server returned HTML (check backend logs / reverse proxy).'
      : 'Invalid JSON response.'
    return { success: false, error: `${hint}\n${text}` }
  }
}

export async function apiPost(path: string, body: unknown) {
  const base = getApiBaseUrl()
  const url = base
    ? `${base}${path.startsWith('/') ? '' : '/'}${path}`
    : `${path.startsWith('/') ? '' : '/'}${path}`

  const resp = await fetch(url, {
    method: 'POST',
    // Use text/plain to avoid some mobile CORS preflight issues.
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await parseJsonResponse(resp)
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid response from server')
  }
  if (!resp.ok) {
    throw new Error(String(json?.error || json?.message || `HTTP ${resp.status}`))
  }
  return json
}

export async function apiUpload(path: string, form: FormData, opts?: { signal?: AbortSignal }) {
  const base = getApiBaseUrl()
  const url = base
    ? `${base}${path.startsWith('/') ? '' : '/'}${path}`
    : `${path.startsWith('/') ? '' : '/'}${path}`
  const resp = await fetch(url, { method: 'POST', body: form, signal: opts?.signal })
  const json = await parseJsonResponse(resp)
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid response from server')
  }
  if (!resp.ok) {
    throw new Error(String(json?.error || json?.message || `HTTP ${resp.status}`))
  }
  return json
}
