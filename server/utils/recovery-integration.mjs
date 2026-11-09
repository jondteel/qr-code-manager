// Server-only integration. Provider/account authority is injected by the local runtime,
// never taken from the HTTP request or an authenticated browser session.
import { check, email, parse } from './recovery-crypto.mjs'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export function eligibleUser(u, recipient, subject) {
  check(u && uuid.test(u.id) && (!subject || u.id === subject))
  check(u.email === email(recipient) && typeof u.email_confirmed_at === 'string' && Number.isFinite(Date.parse(u.email_confirmed_at)))
  check(u.is_anonymous === false && u.aud === 'authenticated' && u.role === 'authenticated')
  // Pinned GoTrue v2.197.0: is_sso_user is json:"-", not an optional false flag.
  // This omission is NOT non-SSO evidence. Trusted recovery generation selects
  // non-SSO users in pinned mail.go -> FindUserByEmailAndAudience; require
  // positive email-only composition here and recheck it before native mutation.
  // Native updateUser independently rejects the provider's hidden SSO flag.
  check(!Object.hasOwn(u, 'is_sso_user') || u.is_sso_user === false)
  for (const key of ['deleted_at','banned_until','new_email','email_change_sent_at']) check(u[key] === undefined || u[key] === null || u[key] === '')
  check(u.app_metadata?.provider === 'email' && JSON.stringify(u.app_metadata.providers) === '["email"]')
  check(Array.isArray(u.identities) && u.identities.length === 1 && u.identities[0].provider === 'email' && u.identities[0].user_id === u.id)
  // Omitted factors is documented wire serialization; a separate listFactors call
  // is mandatory. Present contradictory/malformed factors are never accepted.
  check(!Object.hasOwn(u, 'factors') || (Array.isArray(u.factors) && u.factors.every(f => f.status === 'unverified')))
  return u.id
}
export function validateGenerated(response, recipient, projectOrigin, origin) {
  check(!response?.error)
  const p = response?.data?.properties, u = response?.data?.user
  check(p?.verification_type === 'recovery' && typeof p.hashed_token === 'string')
  parse(`r1.${'A'.repeat(43)}.${'A'.repeat(43)}.${p.hashed_token}`)
  const action = new URL(p.action_link)
  check(p.redirect_to === origin + '/auth/recovery')
  check(!action.username && !action.password && !action.hash && ['token','type','redirect_to'].every(k => action.searchParams.getAll(k).length === 1))
  check(action.searchParams.get('redirect_to') === origin + '/auth/recovery')
  check(action.origin === projectOrigin && action.pathname === '/auth/v1/verify' && action.searchParams.get('type') === 'recovery' && action.searchParams.get('token') === p.hashed_token)
  return { subject: eligibleUser(u, recipient), proof: p.hashed_token }
}
export function recoveryIntegration({ ledger, admin, userClient, origin, projectOrigin, providerLifetimeMs, deliver, observe = () => {} }) {
  check(Number.isSafeInteger(providerLifetimeMs) && providerLifetimeMs > 0 && providerLifetimeMs <= 600000)
  check(new URL(origin).origin === origin && new URL(projectOrigin).origin === projectOrigin)
  // Fixed event codes only: never pass errors, subjects, recipients or proofs.
  // Observability cannot change authorization, trigger retries or reopen a fence.
  function signal(code) { try { observe(code) } catch {} }
  async function account(subject, recipient) {
    // Password history is deliberately irrelevant: confirmed email-passwordless
    // accounts may establish their first password. Subject comes only from
    // trusted generation or the durable bound claim, never a browser/email lookup.
    check(uuid.test(subject) && recipient.endsWith('@example.test'))
    const fresh = await admin.auth.admin.getUserById(subject)
    check(!fresh.error); eligibleUser(fresh.data.user, recipient, subject)
    const factors = await admin.auth.admin.mfa.listFactors({ userId: subject })
    check(!factors.error && Array.isArray(factors.data?.factors) && factors.data.factors.every(f => f.status === 'unverified'))
  }
  return Object.freeze({
    async request(recipient) {
      let reserved
      try {
        email(recipient); check(recipient.endsWith('@example.test'))
        reserved = await ledger.reserve(recipient)
        if (!reserved) return
        const response = await admin.auth.admin.generateLink({ type: 'recovery', email: recipient, options: { redirectTo: origin + '/auth/recovery' } })
        const provider = validateGenerated(response, recipient, projectOrigin, origin)
        await account(provider.subject, recipient)
        const grant = await ledger.publish(reserved, recipient, { ...provider, lifetimeMs: providerLifetimeMs })
        check(grant)
        await deliver({ recipient, url: origin + '/auth/recovery#' + grant.capability })
        check(await ledger.delivered(reserved))
      } catch {
        if (reserved) {
          signal('issuance-uncertain')
          try { if (!await ledger.abandon(reserved)) signal('issuance-fence-unconfirmed') }
          catch { signal('issuance-fence-unconfirmed') }
        }
      }
      // Existing, missing, ineligible, quota and uncertain outcomes are identical.
    },
    async complete(body) {
      if (!body || typeof body !== 'object' || Object.keys(body).some(k => !['capability','password','confirmation'].includes(k))) return { state: 'invalid-input' }
      if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 128 || body.password !== body.confirmation) return { state: 'invalid-password' }
      let proof
      try { proof = parse(body.capability).proof } catch { return { state: 'invalid-or-expired' } }
      const claim = await ledger.claim(body.capability)
      if (!claim) return { state: 'invalid-or-expired' }
      let client, outcome = 'refused', result = { state: 'recovery-refused' }
      try {
        // Only an acknowledged durable claim permits any provider dispatch.
        await account(claim.subject, claim.email)
        client = userClient()
        const verified = await client.auth.verifyOtp({ type: 'recovery', token_hash: proof })
        check(!verified.error && verified.data?.session && verified.data.user?.id === claim.subject)
        const fresh = await client.auth.getUser()
        check(!fresh.error); eligibleUser(fresh.data.user, claim.email, claim.subject)
        await account(claim.subject, claim.email)
        const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel()
        check(!assurance.error && assurance.data?.currentLevel === 'aal1' && assurance.data.nextLevel === 'aal1')
        // Once mutation is dispatched, every exception/transport loss is unknown.
        outcome = 'outcome_unknown'
        const updated = await client.auth.updateUser({ password: body.password })
        if (updated.error) {
          if (updated.error.status >= 400 && updated.error.status < 499) { outcome = 'refused'; result = { state: 'recovery-refused' } }
        } else {
          check(updated.data?.user?.id === claim.subject)
          // Supported user sign-out invalidates refresh sessions; access JWTs can
          // survive to expiry. Revocation uncertainty is never reported as success.
          // auth.signOut() hides native 401/403/404 errors in SDK 2.95.3.
          // Use its underlying supported logout call with the isolated USER JWT
          // and the user client's anonymous project key, never the admin client.
          const revoked = await client.auth.admin.signOut(verified.data.session.access_token, 'global')
          if (revoked.error) signal('revocation-unconfirmed')
          check(!revoked.error)
          outcome = 'consumed'; result = { state: 'password-updated' }
        }
      } catch {} finally {
        // No browser storage/cookies/tokens. Stop refresh and discard references;
        // do not make another network call after an uncertain mutation.
        try { client?.auth.stopAutoRefresh() } catch {}
        client = undefined
      }
      if (outcome === 'outcome_unknown') signal('completion-uncertain')
      if (!await ledger.settle(claim, outcome)) {
        signal('settlement-unconfirmed')
        return { state: 'outcome-unknown' }
      }
      return outcome === 'outcome_unknown' ? { state: 'outcome-unknown' } : result
    },
  })
}
