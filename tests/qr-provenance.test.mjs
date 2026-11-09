import * as analyticsWindow from '../server/utils/analytics-window.mjs'
import * as edit from '../server/utils/qr-edit.mjs'
import * as zod from 'zod'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as h3 from 'h3'
import * as issuance from '../server/utils/qr-issuance.mjs'
import { createHarness } from './helpers/qr-create-harness.mjs'

const config = { qrIssuanceOrigin: 'https://issuer.example.invalid', qrIssuanceEnvironment: 'isolated' }
const stage = { nodeEnv: 'test' }
const body = { title: 'Fixture', data: 'https://destination.example.invalid/a', createShortUrl: true }
const fixture = (overrides = {}) => ({
  id: 'qr', lifecycleStatus: 'active', userId: 'owner', shortUrlId: 'link', data: body.data, errorLevel: 'M',
  issuedEncodedTarget: 'https://issuer.example.invalid/s/old-code', analytics: [],
  shortUrl: { id: 'link', lifecycleStatus: 'active', userId: 'owner', shortCode: 'old-code', originalUrl: body.data },
  ...overrides,
})
const present = (qr) => issuance.presentQr(qr, 'owner', config, undefined, stage)

test('exact issuance survives reload, config changes never rewrite it, direct remains exact', () => {
  const qr = fixture(); const before = structuredClone(qr)
  assert.deepEqual(issuance.storedQrPayload(qr, 'owner', config, undefined, stage), {
    mode: 'tracked', encodedTarget: qr.issuedEncodedTarget, payloadStatus: 'available', payloadProvenance: 'issued', payloadState: 'exact-issued',
  })
  assert.equal(present(qr).userId, undefined)
  assert.equal(present(qr).shortUrl.userId, undefined)
  assert.equal(present(qr).issuedEncodedTarget, undefined)
  assert.equal(issuance.presentQr(qr, 'owner', { ...config, qrIssuanceOrigin: 'https://new.example.invalid' }, undefined, stage).encodedTarget, null)
  assert.deepEqual(qr, before)
  assert.equal(present({ lifecycleStatus: 'active', userId: 'owner', data: ' exact\n ' }).encodedTarget, ' exact\n ')
})

test('legacy null never activates canonical output or backfills provenance', () => {
  const qr = fixture({ issuedEncodedTarget: null }); const before = structuredClone(qr)
  const p = present(qr)
  assert.equal(p.payloadStatus, 'issuance-origin-unknown'); assert.equal(p.payloadProvenance, 'unknown'); assert.equal(p.encodedTarget, null)
  assert.deepEqual(qr, before)
})

test('missing/inconsistent/unsafe/foreign mappings and invalid persisted targets fail closed', () => {
  const base = fixture()
  for (const patch of [
    { shortUrl: null }, { shortUrlId: null }, { shortUrl: { ...base.shortUrl, shortCode: '..' } }, { shortUrl: { ...base.shortUrl, shortCode: 'a/b' } }, { shortUrl: { ...base.shortUrl, id: 'wrong' } },
    { shortUrl: { ...base.shortUrl, userId: 'foreign', originalUrl: 'https://private.example.invalid' } },
    { data: 'https://different.example.invalid' }, { data: 'javascript:alert(1)', shortUrl: { ...base.shortUrl, originalUrl: 'javascript:alert(1)' } },
    { data: ' ' + body.data, shortUrl: { ...base.shortUrl, originalUrl: ' ' + body.data } },
    { issuedEncodedTarget: '' }, { issuedEncodedTarget: 'https://issuer.example.invalid/s/wrong' },
    { issuedEncodedTarget: 'https://retired.example.invalid/s/old-code' },
    { issuedEncodedTarget: 'https://issuer.example.invalid/s/old-code#fragment' },
    { issuedEncodedTarget: 'javascript:alert(1)' }, { issuedEncodedTarget: 'https://u:p@issuer.example.invalid/s/old-code' },
    { userId: 'foreign' },
  ]) {
    const qr = fixture(patch); const before = structuredClone(qr); const p = present(qr)
    assert.equal(p.payloadStatus, 'unavailable', JSON.stringify(patch)); assert.equal(p.encodedTarget, null)
    assert.equal(p.payloadProvenance, 'issued'); assert.deepEqual(qr, before)
    if (patch.shortUrl?.userId === 'foreign') { assert.equal(p.shortUrl, null); assert.equal(p.shortUrlId, null) }
  }
  assert.equal(present(fixture({ issuedEncodedTarget: null, shortUrl: null })).payloadStatus, 'unavailable')
  assert.equal(present(fixture({ shortUrl: null, shortUrlId: null })).mode, 'tracked')
})

test('nonstandard supported codes require exact single encoding, never normalization', () => {
  for (const code of ['Mixed_case-123', 'has space', 'percent%code', 'unicode-é']) {
    const qr = fixture(); qr.shortUrl.shortCode = code; qr.issuedEncodedTarget = issuance.issuedQrTarget(config.qrIssuanceOrigin, code)
    assert.equal(present(qr).encodedTarget, qr.issuedEncodedTarget)
  }
})

test('production issuer needs independent platform stage, preview/local cannot borrow it', () => {
  const production = { qrIssuanceOrigin: 'https://scanlytics.vercel.app', qrIssuanceEnvironment: 'production' }
  assert.equal(issuance.resolveQrIssuanceOrigin(production, 'production', { vercel: '1' }), production.qrIssuanceOrigin)
  for (const [env, runtime] of [[undefined, stage], ['production', stage], ['preview', { vercel: '1' }], [undefined, {}], [undefined, { nodeEnv: 'production' }]]) {
    assert.throws(() => issuance.resolveQrIssuanceOrigin(production, env, runtime), { statusCode: 503 })
  }
  for (const [env, runtime] of [[undefined, {}], ['preview', {}], ['production', { vercel: '1' }], [undefined, { vercel: '1', nodeEnv: 'test' }]]) {
    assert.throws(() => issuance.resolveQrIssuanceOrigin(config, env, runtime), { statusCode: 503 })
  }
})

test('persisted creation value equals response and retry uses fresh whole transactions', async () => {
  const h = await createHarness({ collisions: 2 }); const response = await h.invoke(body)
  assert.equal(h.calls.filter(c => c === 'transaction').length, 3)
  assert.equal(new Set(h.calls.filter(c => c[0] === 'short').map(c => c[1].shortCode)).size, 3)
  assert.deepEqual(h.state, ['qr', 'short', 'link']); assert.equal(h.committed.length, 1)
  assert.equal(response.encodedTarget, h.committed[0].issuedEncodedTarget)
  assert.equal(response.qrCode.encodedTarget, response.encodedTarget)
  assert.equal(response.payloadProvenance, 'issued')
  const exhausted = await createHarness({ collisions: 20 })
  await assert.rejects(exhausted.invoke(body), { statusCode: 500, statusMessage: 'Failed to create QR code' })
  assert.equal(exhausted.calls.filter(c => c === 'transaction').length, 10); assert.deepEqual(exhausted.state, [])
})

test('unrelated constraints, write/read failures and bad persisted values never commit/retry', async () => {
  for (const constraint of [
    { code: 'P2003', meta: { modelName: 'ShortUrl', target: ['shortCode'] } },
    { code: 'P2002', meta: { modelName: 'QRCode', target: ['id'] } },
    { code: 'P2002', meta: { modelName: 'ShortUrl', target: ['id'] } },
    { code: 'P2002', meta: { modelName: 'ShortUrl', target: ['shortCode', 'userId'] } },
    { code: 'P2002', meta: { target: ['shortCode'] } },
  ]) {
    const h = await createHarness({ constraint }); await assert.rejects(h.invoke(body), { statusCode: 500 })
    assert.equal(h.calls.filter(c => c === 'transaction').length, 1); assert.deepEqual(h.state, [])
  }
  for (const settings of [{ fail: 'read' }, { fail: 'link' }, { corrupt: { issuedEncodedTarget: null } }]) {
    const h = await createHarness(settings); await assert.rejects(h.invoke(body), { statusCode: 500 }); assert.deepEqual(h.state, [])
  }
})

test('direct provenance remains null; client provenance and unsafe production stage rejected', async () => {
  const direct = await createHarness({ config: undefined, nodeEnv: undefined })
  const result = await direct.invoke({ ...body, data: ' exact\n ', createShortUrl: false })
  assert.equal(direct.committed[0].issuedEncodedTarget, null); assert.equal(result.payloadProvenance, 'direct-content')
  const forbidden = await createHarness(); await assert.rejects(forbidden.invoke({ ...body, issuedEncodedTarget: 'https://evil.example.invalid' }), { statusCode: 400 })
  const unsafe = await createHarness({ config: { qrIssuanceOrigin: 'https://scanlytics.vercel.app', qrIssuanceEnvironment: 'production' } })
  await assert.rejects(unsafe.invoke(body), { statusCode: 503 }); assert.deepEqual(unsafe.state, [])
})

async function readHarness(path, rows, { user = { sub: 'owner' }, runtimeConfig = config, environment = { NODE_ENV: 'test' } } = {}) {
  const calls = []
  const pick = ({ where, select }) => {
    calls.push({ where, select })
    assert.equal(where.userId, user.sub)
    for (const key of ['userId', 'issuedEncodedTarget', 'shortUrlId']) assert.equal(select[key], true)
    for (const key of ['id', 'userId', 'shortCode', 'originalUrl']) assert.equal(select.shortUrl.select[key], true)
    return rows.filter(row => row.userId === where.userId && (!where.id || row.id === where.id))
  }
  const prisma = {
    $transaction: async (read, options) => {
      calls.push(options); assert.deepEqual(options, { isolationLevel: 'RepeatableRead' })
      return read({
        qRCode: { findFirst: async query => pick(query)[0] || null, findMany: async query => pick(query) },
        $queryRaw: async () => [{ totalScans: 0n, previousScans: 0n, buckets: [] }],
        analytics: { findMany: async () => [] },
      })
    },
  }
  const context = createContext({ defineEventHandler: h => h, useRuntimeConfig: () => runtimeConfig, process: { env: environment }, console: { error() {} } })
  function mod(exports) { return new SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v) }, { context }) }
  const imports = {
    '~/server/utils/prisma': mod({ default: prisma }), '~/server/utils/require-email-account': mod({ requireEmailAccount: async () => { if (!user?.sub) throw h3.createError({ statusCode: 401 }); return user } }),
    h3: mod({ ...h3, getRouterParam: () => 'qr', getQuery: () => ({ period: 7 }) }),
    '~/server/utils/qr-issuance.mjs': mod(issuance), '~/server/utils/analytics-window.mjs': mod(analyticsWindow),
  }
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8')
  const route = new SourceTextModule(stripTypeScriptTypes(source), { context })
  await route.link(name => { assert.ok(Object.hasOwn(imports, name), name); return imports[name] }); await route.evaluate()
  return { invoke: () => route.namespace.default({}), calls }
}

test('GET/list/analytics share reloaded exact/direct/unknown/unavailable contracts and hide foreign mapping', async () => {
  const files = ['server/api/qr/[id].get.ts', 'server/api/qr/list.get.ts', 'server/api/analytics/qr/[id].get.ts']
  for (const row of [fixture(), fixture({ issuedEncodedTarget: null }), fixture({ issuedEncodedTarget: null, shortUrlId: null, shortUrl: null, data: ' exact\n ' }), fixture({ shortUrl: { ...fixture().shortUrl, userId: 'foreign' } })]) {
    const expected = present(row)
    for (const path of files) {
      const h = await readHarness(path, [row]); const response = await h.invoke()
      const qr = response.qrCode || response.qrCodes?.[0] || response.qr
      for (const key of ['mode', 'encodedTarget', 'payloadStatus', 'payloadProvenance', 'payloadState']) assert.equal(qr[key], expected[key], path)
      assert.equal(qr.userId, undefined); assert.equal(qr.issuedEncodedTarget, undefined); assert.equal(qr.shortUrl?.userId, undefined)
      if (row.shortUrl?.userId === 'foreign') assert.equal(qr.shortUrl, null)
      assert.equal(row.issuedEncodedTarget, expected.payloadProvenance === 'issued' ? fixture().issuedEncodedTarget : null)
    }
  }
})

test('unauthenticated and foreign QR reads do not expose targets', async () => {
  for (const path of ['server/api/qr/[id].get.ts', 'server/api/qr/list.get.ts', 'server/api/analytics/qr/[id].get.ts']) {
    const h = await readHarness(path, [fixture()], { user: null }); await assert.rejects(h.invoke(), { statusCode: 401 }); assert.deepEqual(h.calls, [])
    const foreign = await readHarness(path, [fixture({ userId: 'foreign' })])
    if (path.includes('list')) assert.equal((await foreign.invoke()).qrCodes.length, 0)
    else await assert.rejects(foreign.invoke(), { statusCode: 404 })
  }
})

test('strict update API refuses provenance replacement without any database operation', async () => {
  const context = createContext({ defineEventHandler: h => h, console: { error() {} } })
  function mod(exports) { return new SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v) }, { context }) }
  const imports = {
    '~/server/utils/prisma': mod({ default: new Proxy({}, { get() { throw Error('Update must reject before DB') } }) }),
    '~/server/utils/require-email-account': mod({ requireEmailAccount: async () => ({ sub: 'owner' }) }),
    h3: mod({ ...h3, getQuery: () => ({}), getRouterParam: () => 'qr', readBody: async () => ({ issuedEncodedTarget: 'https://evil.example.invalid' }) }),
    zod: mod(zod),
    '~/server/utils/qr-edit.mjs': mod(edit),
    '~/server/utils/qr-issuance.mjs': mod(issuance), '~/server/utils/analytics-window.mjs': mod(analyticsWindow),
  }
  const source = await readFile(new URL('../server/api/qr/[id].put.ts', import.meta.url), 'utf8')
  const route = new SourceTextModule(stripTypeScriptTypes(source), { context })
  await route.link(name => { assert.ok(Object.hasOwn(imports, name)); return imports[name] }); await route.evaluate()
  await assert.rejects(route.namespace.default({}), { statusCode: 400 })
})

const enabledConfig = {
  ...config, qrLegacyCanonicalRegenEnabled: 'true',
  qrLegacyCanonicalCompatibility: 'isolated|https://issuer.example.invalid/s/[code]|same-store-v1',
}
const legacyFixture = (patch = {}) => fixture({ issuedEncodedTarget: null, ...patch })
const canonicalPresent = (row, cfg = enabledConfig, env, runtime = stage) => issuance.presentQr(row, 'owner', cfg, env, runtime)

test('F2 gate accepts deliberate true only', async t => {
  for (const value of [undefined, null, '', 'false', false, 'invalid', 'TRUE', ' true ', '1', 1, {}, []]) {
    await t.test(`disabled ${JSON.stringify(value)}`, () => {
      assert.equal(issuance.legacyCanonicalEnabled(value), false)
      const row = canonicalPresent(legacyFixture(), { ...enabledConfig, qrLegacyCanonicalRegenEnabled: value })
      assert.equal(row.payloadState, 'unavailable'); assert.equal(row.encodedTarget, null)
    })
  }
  for (const value of [true, 'true']) assert.equal(issuance.legacyCanonicalEnabled(value), true)
})

test('F2 canonical target construction preserves supported single-segment legacy codes', () => {
  for (const code of ['fixture8', 'AbC_-019', 'a', '123456789', 'has space', 'percent%code', 'unicode-é', 'abc?defg', 'abc#defg', '%2F']) assert.equal(issuance.canonicalQrTarget(config.qrIssuanceOrigin, code), `${config.qrIssuanceOrigin}/s/${encodeURIComponent(code)}`)
  for (const code of ['', null, undefined, 123, '.', '..', 'a/b', 'abc\\defg', 'abc\ndefg', '\ud800', 'x'.repeat(2048)]) {
    assert.equal(issuance.canonicalQrTarget(config.qrIssuanceOrigin, code), null, String(code))
  }
})

test('F2 canonical projection preserves IDs, code, exact destination and scan history without backfill', () => {
  const row = legacyFixture(); row.analytics.push({ id: 'scan', timestamp: '2026-01-01' })
  const before = structuredClone(row)
  const result = canonicalPresent(row)
  assert.equal(result.payloadState, 'canonical-regeneration')
  assert.equal(result.payloadProvenance, 'canonical-regeneration')
  assert.equal(result.payloadStatus, 'available')
  assert.equal(result.encodedTarget, 'https://issuer.example.invalid/s/old-code')
  assert.equal(result.issuedEncodedTarget, undefined)
  assert.deepEqual(row, before)
  assert.equal(row.issuedEncodedTarget, null)
})

test('F2 owner/link/destination/code ambiguity fails closed even with enabled verified issuer', async t => {
  const base = legacyFixture()
  const cases = [
    { shortUrl: null }, { shortUrlId: null }, { shortUrlId: 'wrong-id' },
    { shortUrl: { ...base.shortUrl, id: 'wrong' } },
    { shortUrl: { ...base.shortUrl, userId: 'other' } }, { userId: 'other' },
    { data: 'https://different.example.invalid' },
    { shortUrl: { ...base.shortUrl, originalUrl: base.data + '/' } },
    { shortUrl: { ...base.shortUrl, shortCode: 'a/b' } },
    { issuedEncodedTarget: undefined },
  ]
  for (const destination of ['javascript:alert(1)', 'data:text/plain,x', 'file:///tmp/x', 'mailto:a@example.invalid', 'https:evil.example.invalid', '//example.invalid', 'https://u:p@example.invalid', 'https://safe.example.invalid@evil.example.invalid', 'https://example.invalid/white space', 'https://example.invalid\\evil', ' https://example.invalid', 'https://example.invalid/\n', 'https://[broken', 'https://example.invalid/' + 'x'.repeat(2048), 'https://example.invalid/\ud800']) {
    cases.push({ data: destination, shortUrl: { ...base.shortUrl, originalUrl: destination } })
  }
  for (const [i, patch] of cases.entries()) await t.test(`unsafe fixture ${i}`, () => {
    const row = legacyFixture(patch); const before = structuredClone(row)
    const result = canonicalPresent(row)
    assert.equal(result.payloadState, 'unavailable'); assert.equal(result.encodedTarget, null)
    assert.deepEqual(row, before)
    if (patch.shortUrl?.userId === 'other') {
      assert.equal(result.shortUrl, null); assert.equal(result.shortUrlId, null)
    }
  })
})

test('F2 flag alone cannot establish issuer or host/route/store compatibility', () => {
  for (const patch of [
    { qrIssuanceOrigin: undefined }, { qrIssuanceOrigin: '' },
    { qrIssuanceOrigin: 'https://issuer.example.invalid/path' },
    { qrIssuanceOrigin: 'http://untrusted.example.invalid' },
    { qrIssuanceEnvironment: 'staging' },
    { qrLegacyCanonicalCompatibility: undefined }, { qrLegacyCanonicalCompatibility: '' },
    { qrLegacyCanonicalCompatibility: true },
    { qrLegacyCanonicalCompatibility: 'isolated|https://retired.example.invalid/s/[code]|same-store-v1' },
    { qrLegacyCanonicalCompatibility: 'production|https://issuer.example.invalid/s/[code]|same-store-v1' },
    { qrLegacyCanonicalCompatibility: 'isolated|https://issuer.example.invalid/api/s/[code]|same-store-v1' },
  ]) assert.equal(canonicalPresent(legacyFixture(), { ...enabledConfig, ...patch }).encodedTarget, null)
})

test('F2 production and isolated compatibility declarations cannot cross trusted stages', () => {
  const production = { qrIssuanceOrigin: 'https://scanlytics.vercel.app', qrIssuanceEnvironment: 'production', qrLegacyCanonicalRegenEnabled: true }
  // Production route compatibility has not been verified: flag alone is insufficient.
  assert.equal(canonicalPresent(legacyFixture(), production, 'production', { vercel: '1' }).encodedTarget, null)
  const verified = { ...production, qrLegacyCanonicalCompatibility: 'production|https://scanlytics.vercel.app/s/[code]|same-store-v1' }
  // Synthetic operator assertion only, not current production activation evidence.
  assert.equal(canonicalPresent(legacyFixture(), verified, 'production', { vercel: '1' }).encodedTarget, 'https://scanlytics.vercel.app/s/old-code')
  for (const [environment, runtime] of [
    ['preview', { vercel: '1' }], ['development', { vercel: '1' }],
    ['staging', { vercel: '1' }], ['production', {}],
    [undefined, stage], [undefined, { nodeEnv: 'production' }],
  ]) assert.equal(canonicalPresent(legacyFixture(), verified, environment, runtime).encodedTarget, null)
  assert.equal(canonicalPresent(legacyFixture(), enabledConfig, 'preview', { vercel: '1' }).payloadState, 'canonical-regeneration')
  assert.equal(canonicalPresent(legacyFixture(), enabledConfig, 'production', { vercel: '1' }).encodedTarget, null)
  assert.equal(canonicalPresent(legacyFixture(), enabledConfig, undefined, {}).encodedTarget, null)
})

test('F2 gate on/off cannot replace inconsistent exact issuance or rewrite direct content', () => {
  for (const cfg of [config, enabledConfig]) {
    const exact = canonicalPresent(fixture(), cfg)
    assert.equal(exact.payloadState, 'exact-issued'); assert.equal(exact.encodedTarget, fixture().issuedEncodedTarget)
    for (const target of ['https://retired.example.invalid/s/old-code', 'https://issuer.example.invalid/s/wrong', '', 'javascript:alert(1)']) {
      const row = fixture({ issuedEncodedTarget: target }); const before = structuredClone(row)
      assert.equal(canonicalPresent(row, cfg).payloadState, 'unavailable'); assert.deepEqual(row, before)
    }
    const direct = canonicalPresent({ lifecycleStatus: 'active', userId: 'owner', data: '  exact\n payload  ', issuedEncodedTarget: null }, cfg)
    assert.equal(direct.payloadState, 'direct-content'); assert.equal(direct.encodedTarget, '  exact\n payload  ')
  }
})

test('F2 GET/list/analytics use the same enabled projection; detached/deleted/foreign snapshots remain closed', async () => {
  for (const path of ['server/api/qr/[id].get.ts', 'server/api/qr/list.get.ts', 'server/api/analytics/qr/[id].get.ts']) {
    for (const row of [legacyFixture(), legacyFixture({ shortUrl: null }), legacyFixture({ shortUrl: { ...fixture().shortUrl, userId: 'other' } })]) {
      const before = structuredClone(row)
      const h = await readHarness(path, [row], { runtimeConfig: enabledConfig })
      const response = await h.invoke(); const result = response.qrCode || response.qrCodes?.[0] || response.qr
      const expected = canonicalPresent(row)
      for (const key of ['payloadState', 'payloadStatus', 'payloadProvenance', 'encodedTarget']) assert.equal(result[key], expected[key], path)
      assert.deepEqual(row, before)
    }
    const deleted = await readHarness(path, [], { runtimeConfig: enabledConfig })
    if (path.includes('list')) assert.equal((await deleted.invoke()).qrCodes.length, 0)
    else await assert.rejects(deleted.invoke(), { statusCode: 404 })
    const foreign = await readHarness(path, [legacyFixture({ userId: 'other' })], { runtimeConfig: enabledConfig })
    if (path.includes('list')) assert.equal((await foreign.invoke()).qrCodes.length, 0)
    else await assert.rejects(foreign.invoke(), { statusCode: 404 })
  }
})

test('F2 construction refuses arbitrary invalid origins; supported codes encode exactly once', () => {
  for (const origin of [undefined, '', 'javascript:alert(1)', 'https://u:p@example.invalid', 'https://issuer.example.invalid/path', 'https://issuer.example.invalid/', 'http://untrusted.example.invalid']) {
    assert.equal(issuance.canonicalQrTarget(origin, 'fixture8'), null)
  }
  for (const code of ['Mixed_case-123', 'has space', 'percent%code', 'unicode-é', '%2F', 'code?query#fragment']) {
    const row = legacyFixture(); row.shortUrl.shortCode = code
    const result = canonicalPresent(row)
    assert.equal(result.payloadState, 'canonical-regeneration')
    assert.equal(result.encodedTarget, issuance.issuedQrTarget(config.qrIssuanceOrigin, code))
    assert.equal(decodeURIComponent(new URL(result.encodedTarget).pathname.slice(3)), code)
  }
})
