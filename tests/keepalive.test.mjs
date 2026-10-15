import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as h3 from 'h3'
import { createKeepAliveHandler } from '../server/utils/keepalive-handler.mjs'

const secret = 'test-only-cron-secret-that-must-never-be-logged'
const authHeader = `Bearer ${secret}`
const fixedTime = new Date('2026-10-14T12:34:56.000Z')

function makeHarness(options = {}) {
  const { authorization, query } = options
  const configuredSecret = Object.hasOwn(options, 'configuredSecret') ? options.configuredSecret : secret
  const calls = { query: 0, headers: new Map(), logs: [] }
  const logger = Object.fromEntries(['info', 'warn', 'error'].map((method) => [
    method,
    (message) => calls.logs.push({ method, message }),
  ]))
  const handler = createKeepAliveHandler({
    getSecret: () => configuredSecret,
    getAuthorization: () => authorization,
    getRequestId: () => 'iad1::request-123',
    getDeploymentId: () => 'dpl_test123',
    setResponseHeader: (_event, name, value) => calls.headers.set(name, value),
    query: async () => {
      calls.query += 1
      return query?.()
    },
    createHttpError: (statusCode, statusMessage) => Object.assign(
      new Error(statusMessage),
      { statusCode, statusMessage },
    ),
    logger,
    now: () => fixedTime,
    monotonicNow: (() => {
      let tick = 100
      return () => (tick += 2.25)
    })(),
  })
  return { handler, calls }
}

async function captureError(promise) {
  try {
    await promise
    assert.fail('Expected the handler to reject')
  } catch (error) {
    return error
  }
}

test('missing, empty and invalid CRON_SECRET fail closed before SQL', async (t) => {
  for (const configuredSecret of [undefined, null, '', ' ', 'secret with spaces', 'secret\n', 'secret\0', 'é', 'x'.repeat(4097)]) {
    await t.test(`invalid configuration case ${typeof configuredSecret}:${String(configuredSecret).length}`, async () => {
      const { handler, calls } = makeHarness({ configuredSecret, authorization: authHeader })
      const error = await captureError(handler({}))

      assert.equal(error.statusCode, 500)
      assert.equal(calls.query, 0)
      assert.deepEqual(Object.fromEntries(calls.headers), {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
      })
      assert.match(calls.logs[0].message, /"outcome":"missing_configuration"/)
    })
  }
})

test('missing, incorrect, malformed, or oversized authorization is rejected before SQL', async (t) => {
  const invalidHeaders = [undefined, null, '', 123, 'Bearer', 'Bearer ', 'Bearer  token', 'Bearer\ttoken', 'Bearer token,Bearer token', `Bearer ${'w'.repeat(secret.length)}`, `Bearer ${secret}extra`, 'Bearer wrong-token', 'Basic abc', 'Bearer token extra', 'Bearer token\n', `Bearer ${'x'.repeat(9000)}`]
  for (const authorization of invalidHeaders) {
    await t.test(String(authorization).slice(0, 32), async () => {
      const { handler, calls } = makeHarness({ authorization })
      const error = await captureError(handler({}))

      assert.equal(error.statusCode, 401)
      assert.equal(calls.query, 0)
      assert.equal(calls.headers.get('Cache-Control'), 'no-store')
      assert.match(calls.logs[0].message, /"outcome":"unauthorized"/)
    })
  }
})

test('valid Bearer authorization awaits exactly one query before returning success', async () => {
  let releaseQuery
  const { handler, calls } = makeHarness({
    authorization: authHeader,
    query: () => new Promise((resolve) => { releaseQuery = resolve }),
  })

  let settled = false
  const pending = handler({}).then((result) => {
    settled = true
    return result
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(calls.query, 1)
  assert.equal(settled, false)
  assert.equal(calls.headers.get('Cache-Control'), 'no-store')
  releaseQuery()

  assert.deepEqual(await pending, { success: true, checkedAt: fixedTime.toISOString() })
  assert.equal(settled, true)
  assert.equal(calls.query, 1)
})

test('database rejection returns a generic service error and sanitized diagnostics', async () => {
  const privateDetail = `connection failed with ${secret} and postgresql://private-user:private-password@db.invalid`
  const queryError = Object.assign(new Error(privateDetail), { code: 'P1001' })
  const { handler, calls } = makeHarness({ authorization: authHeader, query: () => { throw queryError } })
  const error = await captureError(handler({}))

  assert.equal(error.statusCode, 503)
  assert.equal(error.statusMessage, 'Database check unavailable')
  assert.equal(calls.query, 1)
  assert.match(calls.logs[0].message, /"outcome":"database_error"/)
  assert.match(calls.logs[0].message, /"errorClass":"prisma_p1001"/)
  assert.doesNotMatch(error.message, /cron-secret|private-password|db\.invalid/i)
  assert.doesNotMatch(JSON.stringify(calls.logs), new RegExp(secret))
  assert.doesNotMatch(JSON.stringify(calls.logs), /private-password|db\.invalid|connection failed/i)
})

test('a driver-reported timeout is handled after the query rejects, without a JavaScript timeout race', async () => {
  const timeoutError = Object.assign(new Error(`timed out for ${secret}`), { code: 'P2024' })
  const { handler, calls } = makeHarness({
    authorization: authHeader,
    query: () => new Promise((_resolve, reject) => setTimeout(() => reject(timeoutError), 5)),
  })
  const error = await captureError(handler({}))

  assert.equal(error.statusCode, 503)
  assert.equal(calls.query, 1)
  assert.match(calls.logs[0].message, /"errorClass":"prisma_p2024"/)
  assert.doesNotMatch(error.message, new RegExp(secret))
  assert.doesNotMatch(calls.logs[0].message, new RegExp(secret))
})

test('success diagnostic includes timestamp, duration and safe identifiers only', async () => {
  const { handler, calls } = makeHarness({ authorization: authHeader })
  await handler({})

  assert.equal(calls.logs.length, 1)
  const record = JSON.parse(calls.logs[0].message)
  assert.equal(record.event, 'scanlytics.keep_alive')
  assert.equal(record.timestamp, fixedTime.toISOString())
  assert.equal(record.outcome, 'success')
  assert.equal(record.queryDurationMs, 2)
  assert.equal(record.requestId, 'iad1::request-123')
  assert.equal(record.deploymentId, 'dpl_test123')
  assert.doesNotMatch(calls.logs[0].message, new RegExp(secret))
})

test('unsafe platform identifiers are omitted from diagnostics', async () => {
  const logMessages = []
  const handler = createKeepAliveHandler({
    getSecret: () => secret,
    getAuthorization: () => authHeader,
    getRequestId: () => 'user@example.invalid request',
    getDeploymentId: () => 'invalid deployment id',
    setResponseHeader: () => {},
    query: async () => {},
    createHttpError: (statusCode, statusMessage) => Object.assign(
      new Error(statusMessage),
      { statusCode, statusMessage },
    ),
    logger: { info: (message) => logMessages.push(message), warn() {}, error() {} },
    now: () => fixedTime,
    monotonicNow: () => 1,
  })

  await handler({})
  const record = JSON.parse(logMessages[0])
  assert.equal(Object.hasOwn(record, 'requestId'), false)
  assert.equal(Object.hasOwn(record, 'deploymentId'), false)
  assert.doesNotMatch(logMessages[0], new RegExp(secret))
})

// Evaluate the unchanged production route with real H3 adapters and the real
// helper. Only Prisma and the process environment are isolated; no SQL can leave
// this test. VM modules avoid a TypeScript loader or a new test dependency.
test('production route reads the secret per request and wires H3 and SELECT 1', async () => {
  const source = await readFile(new URL('../server/api/cron/keep-db-alive.get.ts', import.meta.url), 'utf8')
  const env = {}
  const logs = []
  const queries = []
  let finishQuery
  let queryResult = () => new Promise((resolve) => { finishQuery = resolve })
  const context = createContext({
    process: { env },
    defineEventHandler: h3.defineEventHandler,
  })
  function moduleFor(exports) {
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  }
  const logger = Object.fromEntries(['info', 'warn', 'error'].map((method) => [method, (record) => logs.push(record)]))
  const imports = {
    h3: moduleFor(h3),
    '~/server/utils/prisma': moduleFor({ default: {
      $queryRaw: (strings, ...values) => {
        queries.push({ sql: strings.join(''), values })
        return queryResult()
      },
    } }),
    '~/server/utils/keepalive-handler.mjs': moduleFor({
      createKeepAliveHandler: (dependencies) => createKeepAliveHandler({ ...dependencies, logger }),
    }),
  }
  const route = new SourceTextModule(source, { context })
  await route.link((specifier) => {
    assert.ok(Object.hasOwn(imports, specifier), `Unexpected route import: ${specifier}`)
    return imports[specifier]
  })
  await route.evaluate()
  const handler = route.namespace.default
  function event(authorization) {
    const headers = new Map()
    return {
      node: {
        req: { headers: authorization === undefined ? {} : { authorization } },
        res: { setHeader: (name, value) => headers.set(name.toLowerCase(), value) },
      },
      headers,
    }
  }
  async function rejected(request, statusCode) {
    await assert.rejects(handler(request), { statusCode })
    assert.equal(request.headers.get('cache-control'), 'no-store')
    assert.equal(request.headers.get('pragma'), 'no-cache')
    assert.equal(request.headers.get('expires'), '0')
  }
  await rejected(event(authHeader), 500)
  env.CRON_SECRET = secret
  await rejected(event(), 401)
  await rejected(event('Bearer wrong'), 401)
  assert.equal(queries.length, 0)
  const request = event(authHeader)
  let settled = false
  const pending = handler(request).then((result) => { settled = true; return result })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(queries, [{ sql: 'SELECT 1', values: [] }])
  assert.equal(settled, false)
  finishQuery([{ '?column?': 1 }])
  assert.equal((await pending).success, true)
  assert.equal(request.headers.get('cache-control'), 'no-store')
  env.CRON_SECRET = 'rotated-test-secret'
  await rejected(event(authHeader), 401)
  assert.equal(queries.length, 1)
  queryResult = () => Promise.reject(Object.assign(new Error('postgresql://private:password@db.invalid'), { code: 'P2024' }))
  await rejected(event('Bearer rotated-test-secret'), 503)
  assert.equal(queries.length, 2)
  assert.doesNotMatch(logs.join(''), /private:password|db\.invalid/)
  assert.ok(logs.every((record) => !record.includes(secret)))
})

test('maximum supported secret authenticates with fixed-length digests', async () => {
  const configuredSecret = 'x'.repeat(4096)
  const { handler, calls } = makeHarness({ configuredSecret, authorization: `bEaReR ${configuredSecret}` })
  assert.equal((await handler({})).success, true)
  assert.equal(calls.query, 1)
})
