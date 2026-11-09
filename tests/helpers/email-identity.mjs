export const subjectA = '11111111-1111-4111-8111-111111111111'
export const subjectB = '33333333-3333-4333-8333-333333333333'
export function emailIdentity(patch = {}) {
  const id = patch.id ?? subjectA
  return { id, email: 'a@example.test', email_confirmed_at: '2026-10-17T12:00:00Z',
    aud: 'authenticated', role: 'authenticated', is_anonymous: false,
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [{ identity_id: '22222222-2222-4222-8222-222222222222', user_id: id, id, provider: 'email' }], ...patch }
}
