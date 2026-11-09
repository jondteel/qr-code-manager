import { createError, type H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import { verifyEmailIdentity } from './auth-admission.mjs'

// Every protected route gets its ownership subject from this fresh admitted user.
// No JWT-only subject fallback, account lookup by email or recovery dependency.
export async function requireEmailAccount(event: H3Event) {
  let result
  try { result = await verifyEmailIdentity((await serverSupabaseClient(event)).auth) }
  catch { result = { state: 'temporarily-unavailable' } }
  if (result.state) {
    const statusCode = result.state === 'invalid-session' ? 401 : result.state === 'review-required' ? 403 : 503
    const statusMessage = statusCode === 401 ? 'Unauthorized' : statusCode === 403 ? 'A confirmed native email account is required' : 'Account service temporarily unavailable'
    throw createError({ statusCode, statusMessage })
  }
  return { sub: result.user.id }
}
