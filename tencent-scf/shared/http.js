function jsonResponse(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...extraHeaders,
    },
    body: JSON.stringify(body ?? {}),
  }
}

function ok(body) {
  return jsonResponse(200, body)
}

function badRequest(message) {
  return jsonResponse(400, { success: false, error: message || 'Bad Request' })
}

function methodNotAllowed() {
  return jsonResponse(405, {
    success: false,
    error: 'Method not allowed. Use POST with JSON body.',
  })
}

function serverError(err) {
  const msg = (err && err.message) || String(err || 'Internal error')
  return jsonResponse(500, { success: false, error: msg })
}

function parseJsonBody(event) {
  const raw = event && event.body
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

module.exports = {
  ok,
  badRequest,
  methodNotAllowed,
  serverError,
  parseJsonBody,
  jsonResponse,
}

