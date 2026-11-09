// Server-only, fresh provider evidence. No passwords, tokens, browser flags or
// user_metadata authorize product admission. Password and email OTP use one rule.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const invalidCodes = new Set(['bad_jwt', 'session_not_found', 'user_not_found', 'refresh_token_not_found', 'refresh_token_already_used'])
export function emailIdentityAllowed(user) {
  if (!user || typeof user.id !== 'string' || !uuid.test(user.id)) return false
  if (typeof user.email !== 'string' || user.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || user.email !== user.email.trim().toLowerCase()) return false
  if (typeof user.email_confirmed_at !== 'string' || !Number.isFinite(Date.parse(user.email_confirmed_at))) return false
  if (user.is_anonymous !== false || user.aud !== 'authenticated' || user.role !== 'authenticated') return false
  // Pinned GoTrue hides this flag. Omission is NOT evidence that it is false.
  // This is the explicitly approved observable-composition boundary only;
  // hidden managed state and legacy/imported identities remain release gates.
  if (Object.hasOwn(user, 'is_sso_user') && user.is_sso_user !== false) return false
  for (const key of ['deleted_at', 'banned_until', 'new_email', 'email_change_sent_at', 'phone', 'phone_confirmed_at']) {
    if (user[key] !== undefined && user[key] !== null && user[key] !== '') return false
  }
  if (user.app_metadata?.provider !== 'email' || !Array.isArray(user.app_metadata.providers) || user.app_metadata.providers.length !== 1 || user.app_metadata.providers[0] !== 'email') return false
  if (!Array.isArray(user.identities) || user.identities.length !== 1) return false
  const identity = user.identities[0]
  if (!identity || identity.provider !== 'email' || identity.user_id !== user.id || identity.id !== user.id || typeof identity.identity_id !== 'string' || !uuid.test(identity.identity_id) || (Object.hasOwn(identity, 'provider_id') && identity.provider_id !== user.id)) return false
  // auth-js 2.95.3 / pinned GoTrue: id is the provider subject, identity_id is
  // the identity UUID. Nested email_verified is not current email confirmation;
  // email_confirmed_at above is authoritative. Optional payload cannot change subject.
  const data = identity.identity_data
  if (data !== undefined && (data === null || typeof data !== 'object' || Array.isArray(data))) return false
  if (data && ((Object.hasOwn(data, 'sub') && data.sub !== user.id) || (Object.hasOwn(data, 'email') && data.email !== user.email))) return false
  return true
}
export async function verifyEmailIdentity(auth) {
  try {
    const response = await auth.getUser()
    const error = response?.error
    if (error) return { state: error.name === 'AuthSessionMissingError' || invalidCodes.has(error.code) || error.status === 401 ? 'invalid-session' : 'temporarily-unavailable' }
    const user = response?.data?.user
    if (!user || typeof user.id !== 'string' || !uuid.test(user.id)) return { state: 'invalid-session' }
    if (!emailIdentityAllowed(user)) return { state: 'review-required' }
    return { user }
  } catch { return { state: 'temporarily-unavailable' } }
}
