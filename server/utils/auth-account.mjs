import { verifyEmailIdentity as verifyIdentity } from './auth-admission.mjs'
export { verifyIdentity }
const profileSelect = { id: true, username: true }
async function profileState(db, user) {
  const own = await db.user.findUnique({ where: { id: user.id }, select: profileSelect })
  if (own) return own.id === user.id ? { state: 'ready' } : { state: 'review-required' }
  const emailOwner = await db.user.findUnique({ where: { email: user.email.trim().toLowerCase() }, select: { id: true } })
  return { state: emailOwner ? 'review-required' : 'onboarding-required' }
}
export async function accountReadiness(db, auth) {
  const verified = await verifyIdentity(auth)
  if (verified.state) return verified
  try { return await profileState(db, verified.user) } catch { return { state: 'temporarily-unavailable' } }
}
export async function reconcileProfile(db, auth, body) {
  const verified = await verifyIdentity(auth)
  if (verified.state) return verified
  const user = verified.user
  if (!body || Object.keys(body).length !== 1 || typeof body.username !== 'string') return { state: 'invalid-input' }
  let state
  try { state = await profileState(db, user) } catch { return { state: 'temporarily-unavailable' } }
  // Preserve an existing same-subject row exactly, even when legacy attributes differ.
  if (state.state !== 'onboarding-required') return state
  if (!body || Object.keys(body).length !== 1 || typeof body.username !== 'string') return { state: 'invalid-input' }
  const username = body.username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return { state: 'invalid-input' }
  try {
    // Single INSERT is atomic. A uniqueness failure finishes before the reread;
    // there is no cross-service transaction, upsert, rename or compensation.
    await db.user.create({ data: { id: user.id, email: user.email.trim().toLowerCase(), username }, select: profileSelect })
    return { state: 'ready' }
  } catch (error) {
    try {
      const after = await profileState(db, user)
      if (after.state !== 'onboarding-required') return after
      return { state: error?.code === 'P2002' ? 'username-conflict' : 'temporarily-unavailable' }
    } catch { return { state: 'temporarily-unavailable' } }
  }
}
