import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as h3 from 'h3'
import * as helpers from '../server/utils/analytics-window.mjs'

const instant = '2026-01-03T12:00:00.000Z'
const event = (timestamp, id = timestamp) => ({ id, timestamp: new Date(timestamp), ipAddress: null, userAgent: null })
const rows = [event('2024-01-01T00:00:00Z'), event('2025-12-20T00:00:00Z'), event('2025-12-27T00:00:00Z'), event('2025-12-31T23:59:59Z'), event('2026-01-03T11:59:59Z'), event(instant)]
async function run(kind, { period = '7', user = 'owner', id = 'qr', scans = rows } = {}) {
  const calls = []
  const qr = { id: 'qr', userId: 'owner', title: 'Fictional', lifecycleStatus: 'archived', data: 'fictional', createdAt: new Date('2024-01-01'), shortUrl: null }
  const within = (list, range) => list.filter(x => (!range.gte || x.timestamp >= range.gte) && x.timestamp < range.lt)
  const prisma = { qRCode: {
    findMany: async args => { calls.push(args); return args.where.userId === 'owner' ? [{ ...qr, analytics: within(scans, args.select.analytics.where.timestamp) }] : [] },
    findFirst: async args => { calls.push(args); return args.where.userId === 'owner' && args.where.id === 'qr' ? qr : null },
  }, analytics: { findMany: async args => { calls.push(args); return within(scans, args.where.timestamp).sort((a,b) => b.timestamp - a.timestamp) } } }
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [instant])) } static now() { return new Date(instant).getTime() } }
  const context = createContext({ Date: FixedDate, defineEventHandler: h => h, useRuntimeConfig: () => ({}), process: { env: {} }, console })
  const mod = exports => new SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v) }, { context })
  const imports = {
    '~/server/utils/prisma': mod({ default: prisma }),
    '~/server/utils/require-email-account': mod({ requireEmailAccount: async () => ({ sub: user }) }),
    '~/server/utils/analytics-window.mjs': mod(helpers),
    '~/server/utils/qr-issuance.mjs': mod({ readQrSnapshot: async (db, fn) => fn(db), serverQrStage: () => 'legacy', presentQr: () => ({ lifecycleStatus: 'archived', mode: 'tracked', shortUrl: null }) }),
    h3: mod({ ...h3, getQuery: () => ({ period }), getRouterParam: () => id }),
  }
  const path = kind === 'overview' ? '../server/api/analytics/overview.get.ts' : '../server/api/analytics/qr/[id].get.ts'
  const route = new SourceTextModule(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8')), { context })
  await route.link(name => imports[name]); await route.evaluate()
  return { result: await route.namespace.default({}), calls }
}
for (const kind of ['overview', 'qr']) {
  test(`${kind}: UTC current and previous windows cross year; chart equals total`, async () => {
    const { result: r } = await run(kind)
    assert.equal(r.stats.totalScans, 2)
    assert.equal(r.range.previousScans, 1)
    assert.equal(r.range.start.toISOString(), '2025-12-28T00:00:00.000Z')
    assert.equal(r.range.previous.start.toISOString(), '2025-12-21T00:00:00.000Z')
    assert.equal(r.range.previous.end.toISOString(), '2025-12-27T12:00:00.000Z')
    assert.equal(r.series.length, 7)
    assert.equal(r.series.reduce((n,x) => n+x.scans, 0), r.stats.totalScans)
    assert.equal(r.stats.avgScansPerDay, null); assert.equal(r.stats.uniqueVisitors, null)
    assert.equal(r.range.coverage, 'unknown'); assert.equal(r.range.growthStatus, 'unavailable')
  })
  test(`${kind}: sparse and zero events do not fabricate coverage`, async () => {
    const { result: r } = await run(kind, { scans: [] })
    assert.equal(r.stats.totalScans, 0); assert.equal(r.range.previousScans, 0)
    assert.equal(r.stats.avgScansPerDay, null); assert.equal(r.range.growthStatus, 'unavailable')
    assert.ok(r.series.every(x => x.scans === 0))
  })
  test(`${kind}: all-time totals include older events but chart is bounded`, async () => {
    const { result: r } = await run(kind, { period: 'all' })
    assert.equal(r.stats.totalScans, 5); assert.equal(r.series.length, 365)
    assert.equal(r.series.reduce((n,x) => n+x.scans, 0), 4)
    assert.equal(r.range.start, null); assert.equal(r.range.chart.start.toISOString(), '2025-01-04T00:00:00.000Z')
    assert.equal(r.range.previousScans, null)
  })
  test(`${kind}: invalid period rejected`, async () => {
    await assert.rejects(run(kind, { period: '8' }), e => e.statusCode === 400)
  })
}
test('overview restricts account; foreign QR is rejected before analytics query', async () => {
  const { result, calls } = await run('overview', { user: 'other' })
  assert.equal(result.stats.totalScans, 0); assert.equal(calls[0].where.userId, 'other')
  await assert.rejects(run('qr', { user: 'other' }), e => e.statusCode === 404)
  await assert.rejects(run('qr', { id: 'foreign' }), e => e.statusCode === 404)
})
