async function supabaseFetch(path, init) {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  if (!baseUrl || !key) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }

  const resp = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init && init.headers ? init.headers : {}),
    },
  })
  const text = await resp.text().catch(() => '')
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }
  if (!resp.ok) {
    throw new Error(`Supabase REST ${resp.status}: ${text || resp.statusText}`)
  }
  return json
}

async function upsertVerificationCode(email, code, expiresAtIso) {
  await supabaseFetch(`/rest/v1/verification_codes?on_conflict=email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      email,
      code,
      expires_at: expiresAtIso,
      updated_at: new Date().toISOString(),
    }),
  })
}

async function getVerificationCodeRow(email) {
  const url = new URL('http://x/verification') // dummy base
  url.searchParams.set('email', `eq.${email}`)
  url.searchParams.set('select', '*')
  const json = await supabaseFetch(`/rest/v1/verification_codes?${url.searchParams.toString()}`, {
    method: 'GET',
  })
  return Array.isArray(json) && json.length ? json[0] : null
}

async function deleteVerificationCode(email) {
  const url = new URL('http://x/verification') // dummy base
  url.searchParams.set('email', `eq.${email}`)
  await supabaseFetch(`/rest/v1/verification_codes?${url.searchParams.toString()}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  })
}

module.exports = {
  upsertVerificationCode,
  getVerificationCodeRow,
  deleteVerificationCode,
}

