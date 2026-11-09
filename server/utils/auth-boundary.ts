import { createError, getHeader, getRequestWebStream, setResponseStatus, type H3Event } from 'h3'
// Bounded per-process aggregate admission control: no IP/identity data retained.
// Serverless replicas do not share it. Provider quotas remain a release gate.
let windowStart = 0
let admitted = 0
export function authOrigin(event: H3Event) {
  const value = useRuntimeConfig(event).authSiteOrigin
  try {
    const url = new URL(value)
    if (url.origin !== value || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) throw 0
    return url.origin
  } catch { throw createError({ statusCode: 503, statusMessage: 'Account service configuration unavailable' }) }
}
export async function accountWriteBody(event: H3Event) {
  const origin = authOrigin(event)
  if (getHeader(event, 'origin') !== origin || getHeader(event, 'sec-fetch-site') === 'cross-site') throw createError({ statusCode: 403, statusMessage: 'Request not allowed' })
  if (getHeader(event, 'content-type')?.split(';')[0]?.trim() !== 'application/json') throw createError({ statusCode: 415, statusMessage: 'JSON required' })
  const now = Date.now()
  if (now - windowStart >= 60000) { windowStart = now; admitted = 0 }
  if (++admitted > 30) throw createError({ statusCode: 429, statusMessage: 'Please wait before trying again' })
  const reader = getRequestWebStream(event)?.getReader()
  if (!reader) throw createError({ statusCode: 400, statusMessage: 'Invalid account request' })
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) { await reader.cancel(); throw createError({ statusCode: 413, statusMessage: 'Request too large' }) }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (error: any) {
    if (error?.statusCode === 413) throw error
    throw createError({ statusCode: 400, statusMessage: 'Invalid account request' })
  }
}
export function privateAccountResult(event: H3Event, result: { state: string }) {
  const statuses: Record<string, number> = { 'invalid-session': 401, 'temporarily-unavailable': 503, 'review-required': 409, 'username-conflict': 409, 'invalid-input': 400 }
  setResponseStatus(event, statuses[result.state] ?? 200)
  return result
}
