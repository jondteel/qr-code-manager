import { createHarness } from './helpers/qr-create-harness.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import * as destination from '../server/utils/qr-destination.mjs'
import * as issuance from '../server/utils/qr-issuance.mjs'
import { applyEnv } from '../node_modules/nitropack/dist/runtime/internal/utils.env.mjs'

const bad = (fn) => assert.throws(fn, { statusCode: 400 })
const fixtureOrigin = (config, stage) => issuance.resolveQrIssuanceOrigin(config, stage, stage ? { vercel: '1' } : { nodeEnv: 'test' })

const production = { qrIssuanceOrigin: 'https://scanlytics.vercel.app', qrIssuanceEnvironment: 'production' }
const isolated = { qrIssuanceOrigin: 'https://issuer.example.invalid', qrIssuanceEnvironment: 'isolated' }

test('tracked URLs: accepted spelling, unusual valid hosts, query, fragment and ports', () => {
  for (const url of ['http://example.invalid', 'HTTPS://EXAMPLE.invalid:8443/a?x=1#frag', 'https://[2001:db8::1]:443/a', 'https://例え.テスト/路径?q=é#片', 'https://example.invalid/a%20b']) {
    assert.equal(destination.validateTrackedDestination(` ${url} `), url)
  }
})

test('tracked invalid protocols, relative syntax, empty authority, credentials, raw whitespace, controls and backslashes', () => {
  for (const url of ['', ' ', '/path', '//example.invalid', 'example.invalid', 'javascript:alert(1)', 'data:text/plain,a', 'file:///a', 'mailto:a@example.invalid', 'tel:123', 'https://', 'https:///example.invalid', 'https://?q=a', 'https://u:p@example.invalid', 'https://@example.invalid', 'https://example.invalid/a b', 'https://example.invalid/\t', '\nhttps://example.invalid', 'https://example.invalid/\0', 'https://example.invalid/\u0085', 'https://example.invalid/\u00a0b', 'https://example.invalid\\a', 'https://[broken']) {
    bad(() => destination.validateTrackedDestination(url))
  }
})

test('UTF-8 boundaries and invalid Unicode are checked independently of QR capacity', () => {
  const prefix = 'https://example.invalid/'
  const url = prefix + 'é'.repeat((2048 - Buffer.byteLength(prefix)) / 2)
  assert.equal(Buffer.byteLength(url), 2048)
  assert.equal(destination.validateTrackedDestination(url), url)
  bad(() => destination.validateTrackedDestination(url + 'é'))
  assert.equal(destination.validateDirectContent('😀'.repeat(512)), '😀'.repeat(512))
  bad(() => destination.validateDirectContent('😀'.repeat(513)))
  bad(() => destination.validateDirectContent('a\ud800'))
  bad(() => destination.validateTrackedDestination(prefix + '\udfff'))
})

test('direct strings preserve exact whitespace and structured content', () => {
  for (const value of ['  hello\n ', '\nWIFI:T:WPA;S:Fictional;P:fictional;;\n', 'mailto:a@example.invalid', 'https://example.invalid', '\tvalue\t']) {
    assert.equal(destination.validateDirectContent(value), value)
  }
  for (const value of ['', ' \t\n', 'é'.repeat(1025)]) bad(() => destination.validateDirectContent(value))
})

test('actual encoder rejects a byte-valid payload at H; accepts it at L', () => {
  const value = destination.validateDirectContent('a'.repeat(2048))
  destination.assertQrCapacity(value, 'L')
  bad(() => destination.assertQrCapacity(value, 'H'))
  for (const level of ['L', 'M', 'Q', 'H']) destination.assertQrCapacity('  Fictional\nQR payload  ', level)
})

test('issuance origin fails closed and isolates local/preview from production', () => {
  assert.equal(fixtureOrigin(production, 'production'), production.qrIssuanceOrigin)
  assert.equal(fixtureOrigin(isolated, 'preview'), isolated.qrIssuanceOrigin)
  for (const origin of ['http://localhost:3200', 'http://127.0.0.1:3200', 'https://preview.example.invalid']) {
    assert.equal(fixtureOrigin({ ...isolated, qrIssuanceOrigin: origin }), origin)
  }
  for (const config of [{}, { ...production, qrIssuanceOrigin: '' }, { ...production, qrIssuanceOrigin: 'http://scanlytics.vercel.app' }, { ...production, qrIssuanceOrigin: isolated.qrIssuanceOrigin }, { ...isolated, qrIssuanceOrigin: production.qrIssuanceOrigin }, { ...isolated, qrIssuanceOrigin: 'http://example.invalid' }, { ...isolated, qrIssuanceEnvironment: '' }]) {
    assert.throws(() => fixtureOrigin(config), { statusCode: 503 })
  }
  for (const suffix of ['/', '/path', '?q=x', '#frag', '/..']) {
    assert.throws(() => fixtureOrigin({ ...isolated, qrIssuanceOrigin: isolated.qrIssuanceOrigin + suffix }), { statusCode: 503 })
  }
  assert.throws(() => fixtureOrigin({ ...isolated, qrIssuanceOrigin: 'https://u:p@issuer.example.invalid' }), { statusCode: 503 })
  assert.throws(() => fixtureOrigin(isolated, 'production'), { statusCode: 503 })
  assert.throws(() => fixtureOrigin(production, 'preview'), { statusCode: 503 })
})

test('installed Nitro applies Nuxt private runtime environment overrides with the documented names', () => {
  // This worker is launched with only fictional configuration by safe-run.py.
  const origin = process.env.NUXT_QR_ISSUANCE_ORIGIN
  const environment = process.env.NUXT_QR_ISSUANCE_ENVIRONMENT
  try {
    process.env.NUXT_QR_ISSUANCE_ORIGIN = isolated.qrIssuanceOrigin
    process.env.NUXT_QR_ISSUANCE_ENVIRONMENT = 'isolated'
    const resolved = applyEnv({ qrIssuanceOrigin: '', qrIssuanceEnvironment: '' }, { prefix: 'NITRO_', altPrefix: 'NUXT_' })
    assert.deepEqual(resolved, isolated)
  } finally {
    for (const [name, value] of Object.entries({ NUXT_QR_ISSUANCE_ORIGIN: origin, NUXT_QR_ISSUANCE_ENVIRONMENT: environment })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

// Closed route import map: real Prisma/Auth modules can never be imported. The
// transaction fixture commits only after its callback succeeds; this tests route
// wiring/rollback propagation, not PostgreSQL transaction or collision behavior.
const input = (overrides = {}) => ({ title: 'Fictional QR', data: 'https://example.invalid/a', createShortUrl: true, ...overrides })

test('tracked create stores identical accepted content, atomically links IDs and returns authority without owner', async () => {
  const h = await createHarness()
  const result = await h.invoke(input({ data: ' HTTPS://例え.テスト:8443/a?q=1#f ' }))
  assert.equal(result.mode, 'tracked')
  assert.equal(result.encodedTarget, 'https://issuer.example.invalid/s/fixture8')
  assert.equal(result.qrCode.data, 'HTTPS://例え.テスト:8443/a?q=1#f')
  assert.equal(result.qrCode.data, result.shortUrl.originalUrl)
  assert.equal(result.qrCode.shortUrlId, result.shortUrl.id)
  assert.equal(result.qrCode.userId, undefined)
  assert.deepEqual(h.state, ['qr', 'short', 'link'])
})

test('direct creation preserves exact data, returns direct target, and never creates mapping or reads origin', async () => {
  const h = await createHarness({ config: new Proxy({}, { get() { throw Error('Direct creation must not read origin') } }) })
  const content = ' \nFictional direct text\t '
  const result = await h.invoke(input({ data: content, createShortUrl: false }))
  assert.equal(result.mode, 'direct')
  assert.equal(result.encodedTarget, content)
  assert.equal(result.qrCode.data, content)
  assert.equal(result.shortUrl, null)
  assert.deepEqual(h.state, ['qr'])
  assert.equal(h.calls.some((c) => c[0] === 'short'), false)
})

test('invalid data, implicit mode, unknown fields, capacity and auth fail before transaction', async () => {
  const cases = [input({ data: '/relative' }), input({ data: 'https://u:p@example.invalid' }), input({ data: 'javascript:alert(1)' }), input({ data: 'https://example.invalid/a b' }), input({ data: 'https://example.invalid/\n' }), input({ data: 'é'.repeat(1025) }), input({ data: ' \n', createShortUrl: false }), input({ data: '😀'.repeat(513), createShortUrl: false }), input({ data: 'a'.repeat(2048), createShortUrl: false, errorLevel: 'H' }), input({ unknown: true })]
  const omitted = input(); delete omitted.createShortUrl; cases.push(omitted)
  for (const body of cases) {
    const h = await createHarness()
    await assert.rejects(h.invoke(body), { statusCode: 400 })
    assert.deepEqual(h.calls, [])
  }
  const h = await createHarness({ user: null })
  await assert.rejects(h.invoke(input()), { statusCode: 401 })
  assert.deepEqual(h.calls, [])
})

test('request Host, forwarded Host, Origin and VERCEL_URL cannot select encoded target', async () => {
  const h = await createHarness({ config: production, environment: 'production' })
  const result = await h.invoke(input(), { host: 'evil.example.invalid', 'x-forwarded-host': 'forwarded.example.invalid', origin: 'https://browser.example.invalid' })
  assert.equal(result.encodedTarget, 'https://scanlytics.vercel.app/s/fixture8')
  const missing = await createHarness({ config: {} })
  await assert.rejects(missing.invoke(input(), { host: 'scanlytics.vercel.app' }), { statusCode: 503 })
  assert.deepEqual(missing.calls, [])
})

test('transaction failures propagate and mock state does not commit partial QR/mapping/linkage', async () => {
  for (const fail of ['qr', 'short', 'link']) {
    const h = await createHarness({ fail })
    await assert.rejects(h.invoke(input()), { statusCode: 500 })
    assert.deepEqual(h.state, [])
  }
})

test('stored legacy linkage preserves unknown issuance and exact direct content', () => {
  const qr = { lifecycleStatus: 'active', userId: 'owner', shortUrlId: 'old-id', data: 'https://old-destination.example.invalid', shortUrl: { id: 'old-id', lifecycleStatus: 'active', userId: 'owner', shortCode: 'old-code', originalUrl: 'https://old-destination.example.invalid' } }
  const before = JSON.stringify(qr)
  assert.deepEqual(issuance.storedQrPayload(qr, 'owner'), { mode: 'tracked', encodedTarget: null, payloadStatus: 'issuance-origin-unknown', payloadProvenance: 'unknown', payloadState: 'unavailable' })
  assert.equal(JSON.stringify(qr), before)
  assert.equal(issuance.storedQrPayload({ lifecycleStatus: 'active', userId: 'owner', data: ' exact\n ' }, 'owner').encodedTarget, ' exact\n ')
})


test('creation projection supplies lifecycle to presentation for both modes', async () => {
  for (const createShortUrl of [true, false]) {
    const h = await createHarness()
    const result = await h.invoke(input({ createShortUrl }))
    assert.equal(result.qrCode.lifecycleStatus, 'active')
    assert.equal(h.committed[0].lifecycleStatus, 'active')
    assert.equal(result.payloadStatus, 'available')
    assert.equal(h.committed[0].userId, 'fictional-owner')
    assert.equal(h.committed[0].issuedEncodedTarget,
      createShortUrl ? result.encodedTarget : null)
  }
})

test('creation refuses a non-live persisted lifecycle and rolls back both modes', async () => {
  for (const createShortUrl of [true, false]) {
    const h = await createHarness({ corrupt: { lifecycleStatus: 'retired' } })
    await assert.rejects(h.invoke(input({ createShortUrl })), { statusCode: 500 })
    assert.deepEqual(h.state, [])
    assert.deepEqual(h.committed, [])
  }
})
