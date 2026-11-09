import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as h3 from 'h3'
import * as helpers from '../server/utils/analytics-window.mjs'

const instant = '2026-01-03T12:00:00.000Z'
const scan = (timestamp, id = timestamp, qrCodeId = 'qr', shortUrlId = null) =>
  ({ id, timestamp: new Date(timestamp), qrCodeId, shortUrlId, ipAddress: null, userAgent: null })
const rows = [
  scan('2024-01-01T00:00:00Z'), scan('2025-12-20T00:00:00Z'),
  scan('2025-12-21T00:00:00Z'), scan('2025-12-27T00:00:00Z'), scan('2025-12-27T12:00:00Z'),
  scan('2025-12-28T00:00:00Z', 'start', 'qr', 'foreign-link'),
  scan('2025-12-31T23:59:59Z'), scan('2026-01-03T11:59:59Z', 'a'), scan('2026-01-03T11:59:59Z', 'b'),
  scan(instant), scan('2026-01-04T00:00:00Z'),
  scan('2026-01-03T11:59:59Z', 'foreign-event', 'foreign', 'owned-link'),
  scan('2026-01-03T11:59:59Z', 'link-only', null, 'owned-link'),
  scan('2026-01-03T11:59:59Z', 'unassociated', null),
]
const qr = (id, lifecycleStatus, userId = 'owner') =>
  ({ id, lifecycleStatus, userId, title: id, data: 'fictional', createdAt: new Date('2024-01-01'), shortUrl: null })
const codes = [qr('qr', 'archived'), qr('active', 'active'), qr('retired', 'retired'), qr('foreign', 'active', 'other')]
const within = (timestamp, start, end) => (!start || timestamp >= new Date(start)) && timestamp < new Date(end)

async function run(kind, { period = '7', user = 'owner', id = 'qr', scans = rows, qrs = codes, calls = [], fail = false } = {}) {
  const prisma = {
    qRCode: { findFirst: async ({ where }) => {
      calls.push('lookup')
      assert.equal(where.userId, user)
      assert.equal(where.id, id)
      return qrs.find(q => q.userId === where.userId && q.id === where.id) ?? null
    } },
    // Check the real tagged query and bindings, then emulate the result over fictional rows.
    $queryRaw: async (strings, ...values) => {
      calls.push('aggregate')
      if (fail) throw Error('fictional database error')
      assert.ok(Object.isFrozen(strings.raw))
      const sql = strings.join('?')
      for (const predicate of [
        '"userId" = ?', 'a."qrCodeId"', 'a."timestamp" < b.current_end',
        'a."timestamp" >= b.previous_start', '"timestamp"::date',
      ]) assert.ok(sql.includes(predicate), predicate)
      assert.doesNotMatch(sql, /"shortUrlId"|"ShortUrl"|ipAddress|userAgent/)
      if (kind === 'overview') {
        assert.ok(sql.includes('ORDER BY current_count DESC, id LIMIT 10'))
        assert.ok(sql.includes('LEFT JOIN public."Analytics" a ON a."qrCodeId" = q.id'))
      } else {
        assert.ok(sql.includes('JOIN public."QRCode" q ON q.id = a."qrCodeId"'))
        assert.ok(sql.includes('WHERE q.id = ? AND q."userId" = ?'))
        assert.equal(values.at(-2), id)
      }
      const [start, end, previousStart, previousEnd, chartStart] = values
      assert.equal(end, instant)
      assert.equal(values.at(-1), user)
      const owned = qrs.filter(q => q.userId === values.at(-1) && (kind === 'overview' || q.id === values.at(-2)))
      const ids = new Set(owned.map(q => q.id))
      const counts = new Map(), daily = new Map()
      let totalScans = 0, previousScans = 0
      for (const row of scans) {
        if (!ids.has(row.qrCodeId)) continue
        if (within(row.timestamp, start, end)) {
          totalScans++
          counts.set(row.qrCodeId, (counts.get(row.qrCodeId) ?? 0) + 1)
        }
        if (previousEnd && within(row.timestamp, previousStart, previousEnd)) previousScans++
        if (within(row.timestamp, chartStart, end)) {
          const day = row.timestamp.toISOString().slice(0, 10)
          daily.set(day, (daily.get(day) ?? 0) + 1)
        }
      }
      return [{
        totalScans: BigInt(totalScans), previousScans: BigInt(previousScans), activeQRCodes: BigInt(counts.size),
        buckets: [...daily].map(([date, scans]) => ({ date, scans })),
        topQRCodes: owned.map(({ id, title, lifecycleStatus, data }) =>
          ({ id, title, lifecycleStatus, data, scanCount: counts.get(id) ?? 0 }))
          .sort((a, b) => b.scanCount - a.scanCount || a.id.localeCompare(b.id)).slice(0, 10),
      }]
    },
    analytics: { findMany: async args => {
      calls.push('recent')
      assert.equal(kind, 'qr')
      assert.equal(args.where.qrCodeId, id)
      assert.equal(args.where.qrCode.userId, user)
      assert.equal(args.take, 50)
      assert.equal(JSON.stringify(args.orderBy), '[{"timestamp":"desc"},{"id":"desc"}]')
      assert.equal(Object.keys(args.select).sort().join(','), 'id,ipAddress,timestamp,userAgent')
      const { gte, lt } = args.where.timestamp
      assert.equal(lt.toISOString(), instant)
      return scans.filter(s => s.qrCodeId === args.where.qrCodeId && within(s.timestamp, gte, lt))
        .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id)).slice(0, args.take)
        .map(({ id, timestamp, ipAddress, userAgent }) => ({ id, timestamp, ipAddress, userAgent }))
    } },
  }
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [instant])) } static now() { return new Date(instant).getTime() } }
  const context = createContext({ Date: FixedDate, defineEventHandler: h => h, useRuntimeConfig: () => ({}), process: { env: {} }, console: { error() {} } })
  const mod = exports => new SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v) }, { context })
  const imports = {
    '~/server/utils/prisma': mod({ default: prisma }),
    '~/server/utils/require-email-account': mod({ requireEmailAccount: async () => ({ sub: user }) }),
    '~/server/utils/analytics-window.mjs': mod(helpers),
    '~/server/utils/qr-issuance.mjs': mod({ readQrSnapshot: async (db, fn) => fn(db), serverQrStage: () => 'legacy', presentQr: qr => ({ lifecycleStatus: qr.lifecycleStatus, mode: 'tracked', shortUrl: null }) }),
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
    assert.equal(r.stats.totalScans, 4)
    assert.equal(r.range.previousScans, 2)
    assert.equal(r.range.start.toISOString(), '2025-12-28T00:00:00.000Z')
    assert.equal(r.range.previous.start.toISOString(), '2025-12-21T00:00:00.000Z')
    assert.equal(r.range.previous.end.toISOString(), '2025-12-27T12:00:00.000Z')
    assert.equal(r.series.length, 7)
    assert.equal(r.series.map(x => x.scans).join(','), '1,0,0,1,0,0,2')
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
    assert.equal(r.stats.totalScans, 9); assert.equal(r.series.length, 365)
    assert.equal(r.series.reduce((n,x) => n+x.scans, 0), 8)
    assert.equal(r.range.start, null); assert.equal(r.range.chart.start.toISOString(), '2025-01-04T00:00:00.000Z')
    assert.equal(r.range.previousScans, null)
  })
  test(`${kind}: invalid period rejected`, async () => {
    await assert.rejects(run(kind, { period: '8' }), e => e.statusCode === 400)
  })
}
test('owner predicates exclude foreign and link-only events without reassigning mismatches', async () => {
  const { result, calls } = await run('overview')
  assert.equal(result.stats.totalScans, 4)
  assert.deepEqual(calls, ['aggregate'])
  assert.equal(result.topQRCodes.map(q => q.id).join(','), 'qr,active,retired')
  assert.doesNotMatch(JSON.stringify(result), /ipAddress|userAgent|foreign-event/)
  const other = await run('overview', { user: 'other' })
  assert.equal(other.result.stats.totalScans, 1)
  assert.equal(other.result.topQRCodes[0].id, 'foreign')
  for (const [user, id] of [['other', 'qr'], ['owner', 'foreign']]) {
    const calls = []
    await assert.rejects(run('qr', { user, id, calls }), { statusCode: 404 })
    assert.deepEqual(calls, ['lookup'])
  }
})

test('overview ranks active, archived and retired history in a stable top ten', async () => {
  const qrs = [...codes, ...Array.from({ length: 12 }, (_, i) => qr(String(i), 'active'))]
  const scans = [...rows, scan('2025-12-28T00:00:00Z', 'active-event', 'active'),
    scan('2025-12-28T00:00:00Z', 'retired-event', 'retired')]
  const { result, calls } = await run('overview', { qrs, scans })
  assert.equal(result.stats.totalScans, 6)
  assert.equal(result.stats.activeQRCodes, 3)
  assert.equal(result.topQRCodes.length, 10)
  assert.equal(result.topQRCodes.slice(0, 3).map(q => q.lifecycleStatus).join(','), 'archived,active,retired')
  assert.deepEqual(calls, ['aggregate'])
  for (const id of ['active', 'retired']) assert.equal((await run('qr', { id, qrs, scans })).result.stats.totalScans, 1)
})

test('100,001 fictional events keep exact totals and recent results cap at 50', async () => {
  const scans = Array.from({ length: 100_001 }, (_, i) =>
    scan('2025-12-28T00:00:00Z', String(i).padStart(6, '0')))
  for (const kind of ['overview', 'qr']) {
    const { result, calls } = await run(kind, { scans })
    assert.equal(result.stats.totalScans, scans.length)
    assert.equal(result.series[0].scans, scans.length)
    assert.deepEqual(calls, kind === 'overview' ? ['aggregate'] : ['lookup', 'aggregate', 'recent'])
    if (kind === 'qr') {
      assert.equal(result.recentScans.length, 50)
      assert.equal(result.recentScans[0].id, '100000')
      assert.equal(result.recentScans[49].id, '099951')
    }
  }
})

test('admission precedes data reads and database failures remain errors', async () => {
  for (const kind of ['overview', 'qr']) {
    const calls = []
    await assert.rejects(run(kind, { user: null, calls }), { statusCode: 401 })
    assert.deepEqual(calls, [])
    await assert.rejects(run(kind, { fail: true, calls }), { statusCode: 500 })
    assert.deepEqual(calls, kind === 'overview' ? ['aggregate'] : ['lookup', 'aggregate'])
  }
})
