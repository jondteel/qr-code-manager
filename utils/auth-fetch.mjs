// Replaces the installed module's retry transport at build time on both targets.
// Never allow an original request/error object to reach auth-js's catch logger.
const safeCodes = new Set(['invalid_credentials', 'email_not_confirmed', 'session_not_found',
  'bad_jwt', 'user_not_found', 'otp_expired', 'otp_disabled', 'over_request_rate_limit',
  'over_email_send_rate_limit', 'weak_password', 'user_already_exists'])
function failure(status = 499, code = 'auth_transport_unavailable') {
  return new Response(JSON.stringify({ error_code: code, msg: 'Authentication request could not be completed.' }), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
export async function fetchWithRetry(input, init) {
  const controller = new AbortController()
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  const timer = setTimeout(abort, 10000)
  try {
    // Exactly one attempt, including refresh, signup and recovery. Buffer the body
    // here so a connection lost after headers cannot escape into SDK retries/logs.
    const response = await globalThis.fetch(input, { ...init, signal: controller.signal })
    const body = await response.text()
    if (!response.ok) {
      if (response.status >= 500) return failure()
      let code
      try { const data = JSON.parse(body); code = data.code ?? data.error_code } catch {}
      return failure(response.status, safeCodes.has(code) ? code : 'auth_request_rejected')
    }
    return new Response(body || null, { status: response.status, statusText: response.statusText, headers: response.headers })
  } catch {
    // 499 is deliberately not a retryable SDK status. An uncertain refresh may
    // require signing in again; replaying a spent refresh token is not safe.
    return failure()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
