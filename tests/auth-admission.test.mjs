import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes, createRequire } from 'node:module'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import { pathToFileURL } from 'node:url'
import * as h3 from 'h3'
import { emailIdentityAllowed, verifyEmailIdentity } from '../server/utils/auth-admission.mjs'
import { accountReadiness, reconcileProfile } from '../server/utils/auth-account.mjs'
import { emailIdentity, subjectA, subjectB } from './helpers/email-identity.mjs'

const auth = user => ({ getUser: async () => ({ data: { user }, error: null }) })
const denied = {
  google: { app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider: 'google', user_id: subjectA }] },
  linked: { identities: [...emailIdentity().identities, { provider: 'google', user_id: subjectA }] },
  mixed_metadata: { app_metadata: { provider: 'email', providers: ['email', 'google'] } },
  missing_metadata: { app_metadata: undefined }, missing_identities: { identities: undefined },
  empty_identities: { identities: [] }, null_identity: { identities: [null] },
  wrong_identity_subject: { identities: [{ ...emailIdentity().identities[0], user_id: subjectB }] },
  wrong_provider_subject: { identities: [{ ...emailIdentity().identities[0], id: subjectB }] },
  missing_provider_subject: { identities: [{ ...emailIdentity().identities[0], id: undefined }] },
  contradictory_provider_id: { identities: [{ ...emailIdentity().identities[0], provider_id: subjectB }] },
  missing_identity_uuid: { identities: [{ ...emailIdentity().identities[0], identity_id: undefined }] },
  anonymous: { is_anonymous: true }, unknown_anonymous: { is_anonymous: undefined },
  phone: { identities: [{ provider: 'phone', user_id: subjectA }], phone: '+15555550123' },
  banned: { banned_until: '2026-12-01' }, deleted: { deleted_at: '2026-11-01' },
  unconfirmed: { email_confirmed_at: null }, malformed_confirmation: { email_confirmed_at: 'unknown' },
  missing_email: { email: undefined }, malformed_email: { email: 'not-an-email' },
  missing_audience: { aud: undefined }, wrong_role: { role: 'service_role' },
  pending_email: { new_email: 'changed@example.test' }, pending_transition: { email_change_sent_at: '2026-11-03' },
  explicit_sso: { is_sso_user: true }, malformed_sso: { is_sso_user: null },
  contradictory_identity_data: { identities: [{ ...emailIdentity().identities[0], identity_data: { sub: subjectB } }] },
}
test('native password and passwordless share positive email composition without history or recovery state', async t => {
  for (const method of ['password', 'email OTP']) await t.test(method, async () => {
    const user = emailIdentity()
    assert.equal(Object.hasOwn(user, 'is_sso_user'), false)
    assert.equal(emailIdentityAllowed(user), true)
    assert.equal(emailIdentityAllowed({ ...user, identities: [{ ...user.identities[0], identity_data: { email_verified: false, sub: user.id, email: user.email } }] }), true)
    assert.equal((await verifyEmailIdentity(auth(user))).user.id, subjectA)
    assert.equal(emailIdentityAllowed({ ...user, user_metadata: { provider: 'google', is_sso_user: true, eligible: false } }), true)
  })
})
test('unsupported and ambiguous composition refuses before existing/new profile DB access', async t => {
  for (const [name, patch] of Object.entries(denied)) await t.test(name, async () => {
    const user = emailIdentity(patch)
    let touches = 0
    const db = { user: { findUnique() { touches++; return { id: subjectA } }, create() { touches++; throw Error('must not write') } } }
    assert.equal(emailIdentityAllowed(user), false)
    assert.equal((await accountReadiness(db, auth(user))).state, 'review-required')
    assert.equal((await reconcileProfile(db, auth(user), { username: 'fictional' })).state, 'review-required')
    assert.equal(touches, 0)
  })
})
test('provider outages, malformed responses and subjects fail closed without logging secrets', async t => {
  const canary = 'fictional-password-token-not-for-diagnostics'
  for (const [name, getUser, state] of [
    ['outage', async () => { throw Error(canary) }, 'temporarily-unavailable'],
    ['provider_error', async () => ({ error: { status: 503, message: canary } }), 'temporarily-unavailable'],
    ['null', async () => null, 'invalid-session'], ['empty', async () => ({}), 'invalid-session'],
    ['noncanonical_subject', async () => ({ data: { user: emailIdentity({ id: 'forged' }) } }), 'invalid-session'],
  ]) await t.test(name, async () => {
    const result = await verifyEmailIdentity({ getUser })
    assert.deepEqual(result, { state }); assert.equal(JSON.stringify(result).includes(canary), false)
  })
})

// Actual TypeScript shared helper + actual route, synthetic provider and DB only.
const root = new URL('../', import.meta.url), require = createRequire(new URL('../package.json', import.meta.url))
const routes = ['qr/list.get.ts', 'qr/create.post.ts', 'qr/[id].get.ts', 'qr/[id].put.ts', 'qr/[id].delete.ts', 'qr/[id]/lifecycle.patch.ts', 'analytics/overview.get.ts', 'analytics/qr/[id].get.ts']
async function routeHarness(path, provider) {
  let touches = 0, providerCalls = 0
  const trip = () => { touches++; throw Error('synthetic-db-boundary') }
  const db = { qRCode: { findMany: trip, findFirst: trip }, analytics: { findMany: trip }, $transaction: trip, $queryRaw: trip }
  const context = createContext({ defineEventHandler: h => h, useRuntimeConfig: () => ({}), process: { env: { NODE_ENV: 'test' } }, console: { error() {} } })
  const mod = exports => new SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v) }, { context })
  const helper = new SourceTextModule(stripTypeScriptTypes(await readFile(new URL('server/utils/require-email-account.ts', root), 'utf8')), { context })
  await helper.link(name => mod(name === 'h3' ? h3 : name === './auth-admission.mjs' ? { verifyEmailIdentity } : { serverSupabaseClient: async () => ({ auth: { getUser: async () => { providerCalls++; return provider() }, getClaims: () => { throw Error('JWT-only fallback forbidden') } } }) }))
  await helper.evaluate()
  const body = path.includes('lifecycle') ? { status: 'archived' } : path.includes('create') ? { title: 'Fictional', data: 'fictional-direct', createShortUrl: false } : { title: 'Fictional' }
  const mocks = { '~/server/utils/prisma': { default: db }, '~/server/utils/require-email-account': helper.namespace, h3: { ...h3, getRouterParam: () => 'other-account-qr', getQuery: () => ({}), readBody: async () => body } }
  const route = new SourceTextModule(stripTypeScriptTypes(await readFile(new URL('server/api/' + path, root), 'utf8')), { context })
  await route.link(async name => mod(mocks[name] ?? await import(name.startsWith('~/') ? new URL(name.slice(2), root) : pathToFileURL(require.resolve(name)))))
  await route.evaluate()
  return { invoke: () => route.namespace.default({}), touches: () => touches, providerCalls: () => providerCalls }
}
test('all protected handlers enforce fresh admission before DB and preserve supported-user flow', async t => {
  for (const path of routes) await t.test(path, async () => {
    let user = emailIdentity(denied.google)
    const route = await routeHarness(path, () => ({ data: { user }, error: null }))
    await assert.rejects(route.invoke(), { statusCode: 403 }); assert.equal(route.touches(), 0)
    user = emailIdentity()
    await assert.rejects(route.invoke(), { statusCode: 500 }); assert.ok(route.touches() > 0)
    user = emailIdentity(denied.linked)
    const before = route.touches()
    await assert.rejects(route.invoke(), { statusCode: 403 }); assert.equal(route.touches(), before)
    assert.equal(route.providerCalls(), 3)
  })
})
test('all protected handlers bound provider errors before any DB operation', async t => {
  for (const path of routes) await t.test(path, async () => {
    const route = await routeHarness(path, () => { throw Error('fictional-sensitive-provider-error') })
    await assert.rejects(route.invoke(), e => e.statusCode === 503 && !String(e).includes('fictional-sensitive-provider-error'))
    assert.equal(route.touches(), 0)
  })
})
