// Deliberately non-activatable: accepts fictional .test mail only, no SDK client.
import { check, email } from './recovery-crypto.mjs'
export function validateFixtureResponse(response, recipient) {
  check(!response?.error)
  const u = response?.data?.user, p = response?.data?.properties
  check(p?.verification_type === 'recovery' && typeof p.hashed_token === 'string')
  check(u?.email === recipient && !!u.email_confirmed_at && u.is_anonymous === false && u.is_sso_user === false)
  check(!u.deleted_at && !u.banned_until && !u.new_email && !u.email_change_sent_at && Array.isArray(u.factors) && u.factors.length === 0)
  check(u.app_metadata?.provider === 'email' && u.app_metadata?.providers?.length === 1 && u.app_metadata.providers[0] === 'email')
  return { subject: u.id, proof: p.hashed_token }
}
export function fictionalMailSink() {
  const messages = []
  return Object.freeze({
    // In-memory capabilities are intentionally private test state; never serialize.
    async deliver(message) {
      check(message.recipient.endsWith('@example.test') && message.origin === 'https://recovery.example.test')
      messages.push({ ...message })
    },
    take() { return messages.splice(0) },
  })
}
export function fixtureIssuer({ ledger, generateFixture, sink }) {
  return async function issue(recipient) {
    let reserved
    try {
      email(recipient)
      check(recipient.endsWith('@example.test'))
      reserved = await ledger.reserve(recipient)
      if (!reserved) return { state: 'unavailable' }
      // Server-owned constants, no caller type/project/redirect/subject parameters.
      const response = await generateFixture({ type: 'recovery', email: recipient, options: { redirectTo: 'https://recovery.example.test/auth/recovery' } })
      const provider = validateFixtureResponse(response, recipient)
      const grant = await ledger.publish(reserved, recipient, provider)
      if (!grant) { await ledger.abandon(reserved); return { state: 'unavailable' } }
      await sink.deliver({ recipient, origin: 'https://recovery.example.test', capability: grant.capability })
      if (!await ledger.delivered(reserved)) { await ledger.abandon(reserved); return { state: 'unavailable' } }
      return { state: 'fixture-delivered' }
    } catch {
      if (reserved) { try { await ledger.abandon(reserved) } catch {} }
      return { state: 'unavailable' }
    }
  }
}
