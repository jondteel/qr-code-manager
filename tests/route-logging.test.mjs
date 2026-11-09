import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import { Console } from 'node:console'
import { PassThrough } from 'node:stream'
import { createServer } from 'node:http'
import { once } from 'node:events'
import * as h3 from 'h3'
import * as zod from 'zod'
import { Prisma } from '@prisma/client'
import * as destination from '../server/utils/qr-destination.mjs'
import * as issuance from '../server/utils/qr-issuance.mjs'

const routes = [
  ['qr/create.post.ts', 'qr-create', 'Failed to create QR code'],
  ['qr/list.get.ts', 'qr-list', 'Failed to fetch QR codes'],
  ['qr/[id].get.ts', 'qr-fetch', 'Failed to fetch QR code'],
  ['analytics/overview.get.ts', 'analytics-overview', 'Failed to fetch analytics'],
  ['analytics/qr/[id].get.ts', 'qr-analytics', 'Failed to fetch QR analytics'],
]
// Fictional values only. Each injected error carries all classes of sensitive data.
const canaries = ['CANARY_ACCESS_TOKEN_3A', 'CANARY_REFRESH_TOKEN_3A', 'CANARY_RECOVERY_PROOF_3A',
  'CANARY_PASSWORD_3A', 'postgresql://fiction:CANARY_DB_PASSWORD_3A@127.0.0.1:1/fiction',
  'CANARY_SQL_PARAMETER_3A', 'https://fiction:CANARY_URL_PASSWORD_3A@example.invalid/?token=CANARY_QUERY_TOKEN_3A',
  'canary-private-3a@example.test', 'CANARY_PRIVATE_ACCOUNT_3A', 'CANARY_SERVICE_KEY_3A']
const sensitive = canaries.join(' | ')
function fault(kind) {
  const error = kind === 'known-prisma'
    ? new Prisma.PrismaClientKnownRequestError(sensitive, { code: 'P2003', clientVersion: '5.22.0', meta: { parameters: [sensitive], modelName: 'QRCode' } })
    : kind === 'unknown-prisma'
      ? new Prisma.PrismaClientUnknownRequestError(sensitive, { clientVersion: '5.22.0' })
      : new Error(sensitive, { cause: { provider: { body: sensitive } } })
  error.stack = sensitive
  error.provider = { authorization: 'Bearer ' + sensitive, cookie: sensitive, response: { body: sensitive } }
  error.sql = { statement: 'SELECT $1', parameters: [sensitive] }
  return error
}
const config = { qrIssuanceOrigin: 'https://issuer.example.invalid', qrIssuanceEnvironment: 'isolated' }
const body = { title: 'Fictional QR', data: 'https://destination.example.invalid/a', createShortUrl: true }
const row = () => ({ id: 'fictional-qr', userId: 'fictional-owner', lifecycleStatus: 'active',
  title: body.title, data: body.data, errorLevel: 'M', createdAt: new Date('2026-01-01T00:00:00Z'),
  shortUrlId: 'fictional-link', issuedEncodedTarget: 'https://issuer.example.invalid/s/fixture8',
  shortUrl: { id: 'fictional-link', userId: 'fictional-owner', shortCode: 'fixture8', originalUrl: body.data },
  analytics: [], _count: { analytics: 0 } })

async function harness(route, { error, failAt = 'query', denial, foreign = false, sourceRoot = '../server/api/' } = {}) {
  const calls = [], committed = [], logs = []
  let rolledBack = 0, stdout = '', stderr = '', serializations = 0
  const out = new PassThrough(), err = new PassThrough()
  out.on('data', chunk => { stdout += chunk }); err.on('data', chunk => { stderr += chunk })
  const sink = new Console({ stdout: out, stderr: err, colorMode: false })
  const logger = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir'].map(method => [method, (...args) => {
    logs.push({ method, args }); sink[method](...args)
  }]))
  if (error) error.toJSON = () => { serializations++; return { secret: sensitive } }
  function checkpoint(stage) { calls.push(stage); if (error && stage === failAt) throw error }
  const owned = args => {
    assert.equal(args.where.userId, 'fictional-owner')
    return foreign ? null : row()
  }
  const db = {
    qRCode: {
      findMany: async args => { checkpoint('query'); const r = owned(args); return r ? [r] : [] },
      findFirst: async args => { checkpoint('query'); return owned(args) },
    },
    analytics: { findMany: async args => {
      assert.equal(args.where.qrCodeId, 'fictional-qr'); checkpoint('scans'); return []
    } },
    $transaction: async (fn, options) => {
      calls.push('transaction')
      if (!route.startsWith('qr/create')) {
        assert.equal(options.isolationLevel, 'RepeatableRead')
        try { return await fn(db) } catch (e) { rolledBack++; throw e }
      }
      let qr, link
      const tx = { qRCode: {
        create: async ({ data }) => {
          checkpoint('qr'); assert.equal(data.userId, 'fictional-owner')
          qr = { ...row(), ...data, shortUrlId: null, shortUrl: null }; return { id: qr.id }
        },
        update: async ({ data }) => { checkpoint('link'); Object.assign(qr, data) },
        findUniqueOrThrow: async ({ select }) => {
          checkpoint('read'); const full = { ...qr, shortUrl: link ?? null }
          assert.equal(select.lifecycleStatus, true)
          return full
        },
      }, shortUrl: { create: async ({ data }) => {
        checkpoint('short'); assert.equal(data.userId, 'fictional-owner')
        link = { ...data, id: 'fictional-link' }; return { id: link.id }
      } } }
      try {
        const result = await fn(tx); checkpoint('commit'); committed.push(result); return result
      } catch (e) { rolledBack++; throw e }
    },
  }
  const context = createContext({ console: logger, defineEventHandler: h3.defineEventHandler,
    useRuntimeConfig: () => config, process: { env: { NODE_ENV: 'test' } } })
  const mod = exports => new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
  }, { context })
  const imports = {
    '~/server/utils/prisma': mod({ default: db }),
    '~/server/utils/require-email-account': mod({ requireEmailAccount: async () => {
      if (denial) throw h3.createError({ statusCode: denial, statusMessage: denial === 401 ? 'Unauthorized' : denial === 403 ? 'A confirmed native email account is required' : 'Account service temporarily unavailable' })
      return { sub: 'fictional-owner' }
    } }),
    h3: mod(h3), zod: mod(zod), nanoid: mod({ nanoid: () => 'fixture8' }),
    '@prisma/client': mod({ Prisma }),
    '~/server/utils/qr-destination.mjs': mod(destination), '~/server/utils/qr-issuance.mjs': mod(issuance),
  }
  // Optional second pass executes the fresh Nitro-generated handler chunks.
  // Auth/Prisma and Nitro runtime imports remain explicit fixture adapters.
  const built = process.env.LOGGING_TEST_COMPILED === '1'
  const path = built ? '../.output/server/chunks/routes/api/' + route.replace('[id]', '_id_').replace('.ts', '.mjs') : sourceRoot + route
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = built ? source : stripTypeScriptTypes(source, { mode: 'transform' })
  const module = new SourceTextModule(compiled, { context })
  const compiledRuntime = mod({ c: h3.defineEventHandler, e: h3.createError, r: h3.readBody,
    g: h3.getQuery, f: h3.getRouterParam, u: () => config })
  const compiledIssuance = mod({ v: destination.validateTrackedDestination, b: destination.validateDirectContent,
    c: destination.assertQrCapacity, s: issuance.serverQrStage, f: issuance.resolveQrIssuanceOrigin,
    i: issuance.issuedQrTarget, p: issuance.presentQr, r: issuance.readQrSnapshot })
  const empty = mod({})
  await module.link(specifier => {
    if (built) {
      if (specifier.endsWith('/_/nitro.mjs')) return compiledRuntime
      if (specifier.endsWith('/_/prisma.mjs')) return mod({ p: db })
      if (specifier.endsWith('/_/require-email-account.mjs')) return mod({ r: async () => {
        if (denial) throw h3.createError({ statusCode: denial, statusMessage: denial === 401 ? 'Unauthorized' : denial === 403 ? 'A confirmed native email account is required' : 'Account service temporarily unavailable' })
        return { sub: 'fictional-owner' }
      } })
      if (specifier.endsWith('/_/qr-issuance.mjs')) return compiledIssuance
      if (['node:http', 'node:https', 'node:events', 'node:buffer', 'node:fs', 'node:path', 'node:crypto', 'node:url', '@supabase/ssr', 'qrcode'].includes(specifier)
        || specifier.endsWith('/_/auth-admission.mjs') || specifier.endsWith('/_/serverSupabaseClient.mjs')) return empty
    }
    assert.ok(Object.hasOwn(imports, specifier), `Unexpected route import ${specifier}`)
    return imports[specifier]
  })
  await module.evaluate()
  const app = h3.createApp({ debug: false })
  app.use(h3.defineEventHandler(event => {
    event.context.params = { id: 'fictional-qr' }
    return module.namespace.default(event)
  }))
  const server = createServer(h3.toNodeListener(app))
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  return { calls, committed, logs,
    get rolledBack() { return rolledBack }, get stdout() { return stdout }, get stderr() { return stderr },
    get serializations() { return serializations },
    async invoke(input = body, query = '') {
      const create = route.startsWith('qr/create')
      const response = await fetch(`http://127.0.0.1:${server.address().port}/fixture${query}`, {
        method: create ? 'POST' : 'GET', headers: create ? { 'content-type': 'application/json' } : {},
        ...(create ? { body: JSON.stringify(input) } : {}),
      })
      const text = await response.text()
      return { status: response.status, body: JSON.parse(text), text }
    },
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) },
  }
}
function noCanaries(h, response) {
  for (const canary of canaries) {
    assert.equal((h.stdout + h.stderr + response.text).includes(canary), false, 'sensitive canary escaped')
  }
  assert.equal(h.serializations, 0, 'nested error serialization occurred')
}

for (const [route, event, message] of routes) {
  for (const kind of ['runtime', 'known-prisma', 'unknown-prisma']) {
    test(`${event}: synthetic ${kind} failure is private over H3 HTTP`, async () => {
      const h = await harness(route, { error: fault(kind), failAt: event === 'qr-create' ? 'qr' : 'query' })
      try {
        const response = await h.invoke()
        assert.equal(response.status, 500); assert.equal(response.body.statusMessage, message)
        assert.equal(response.body.statusCode, 500); assert.equal(response.body.data, undefined)
        assert.deepEqual(JSON.parse(JSON.stringify(h.logs)), [{ method: 'error', args: [{ event, outcome: 'failed', reason: 'unexpected-error' }] }])
        assert.equal(h.stdout, ''); assert.ok(h.stderr.includes(event)); noCanaries(h, response)
        assert.equal(h.committed.length, 0)
        if (event !== 'analytics-overview') assert.equal(h.rolledBack, 1)
      } finally { await h.close() }
    })
  }
  test(`${event}: success contract and owner predicate preserved`, async () => {
    const h = await harness(route)
    try {
      const response = await h.invoke()
      assert.equal(response.status, 200); assert.equal(response.body.success, true)
      assert.deepEqual(h.logs, []); noCanaries(h, response)
      if (event === 'qr-create') {
        assert.equal(response.body.encodedTarget, 'https://issuer.example.invalid/s/fixture8')
        assert.equal(h.committed.length, 1)
      } else if (event === 'qr-list') {
        assert.equal(response.body.qrCodes.length, 1); assert.equal(response.body.stats.totalQRCodes, 1)
      } else if (event === 'qr-fetch') assert.equal(response.body.qrCode.id, 'fictional-qr')
      else { assert.equal(response.body.stats.totalScans, 0); assert.ok(Array.isArray(response.body.series)) }
    } finally { await h.close() }
  })
  for (const denial of [401, 403, 503]) test(`${event}: admission ${denial} still refuses before database`, async () => {
    const h = await harness(route, { denial })
    try {
      const response = await h.invoke(); assert.equal(response.status, denial)
      assert.deepEqual(h.calls, []); assert.deepEqual(h.logs, []); noCanaries(h, response)
    } finally { await h.close() }
  })
}
for (const stage of ['short', 'link', 'read', 'commit']) test(`qr-create: synthetic ${stage} failure aborts without replay or disclosure`, async () => {
  const h = await harness(routes[0][0], { error: fault('runtime'), failAt: stage })
  try {
    const response = await h.invoke(); assert.equal(response.status, 500)
    assert.equal(h.rolledBack, 1); assert.equal(h.committed.length, 0)
    assert.equal(h.calls.filter(c => c === 'transaction').length, 1)
    assert.equal(h.logs.length, 1); noCanaries(h, response)
  } finally { await h.close() }
})
test('qr-analytics: scan query failure after owned QR lookup remains private', async () => {
  const h = await harness(routes[4][0], { error: fault('unknown-prisma'), failAt: 'scans' })
  try { const r = await h.invoke(); assert.equal(r.status, 500); assert.equal(h.logs.length, 1); noCanaries(h, r) }
  finally { await h.close() }
})
for (const route of ['qr/[id].get.ts', 'analytics/qr/[id].get.ts']) test(`${route}: foreign/missing QR remains 404 without scans`, async () => {
  const h = await harness(route, { foreign: true })
  try {
    const r = await h.invoke(); assert.equal(r.status, 404); assert.equal(r.body.statusMessage, 'QR code not found')
    assert.equal(h.calls.includes('scans'), false); assert.deepEqual(h.logs, []); noCanaries(h, r)
  } finally { await h.close() }
})
test('qr-create: direct success preserves exact content and creates no mapping', async () => {
  const h = await harness(routes[0][0])
  try {
    const r = await h.invoke({ ...body, data: ' exact fictional content\n ', createShortUrl: false })
    assert.equal(r.status, 200); assert.equal(r.body.encodedTarget, ' exact fictional content\n ')
    assert.equal(h.calls.includes('short'), false); assert.deepEqual(h.logs, [])
  } finally { await h.close() }
})
test('qr-create: validation remains 400 without writes or failure diagnostics', async () => {
  const h = await harness(routes[0][0])
  try { const r = await h.invoke({ ...body, title: '' }); assert.equal(r.status, 400); assert.ok(r.body.data.issues.length); assert.deepEqual(h.calls, []); assert.deepEqual(h.logs, []) }
  finally { await h.close() }
})
test('qr-list: invalid lifecycle filter remains 400 without reads', async () => {
  const h = await harness(routes[1][0])
  try { const r = await h.invoke(undefined, '?status=invalid'); assert.equal(r.status, 400); assert.deepEqual(h.calls, []); assert.deepEqual(h.logs, []) }
  finally { await h.close() }
})
