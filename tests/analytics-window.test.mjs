import test from 'node:test'
import assert from 'node:assert/strict'
import { analyticsWindow, averagePerDay, growth, parseAnalyticsPeriod } from '../server/utils/analytics-window.mjs'

test('UTC calendar window and previous equivalent elapsed point', () => {
  const w = analyticsWindow(7, new Date('2026-03-10T12:34:56.789Z'))
  assert.equal(w.start.toISOString(), '2026-03-04T00:00:00.000Z')
  assert.equal(w.end.toISOString(), '2026-03-10T12:34:56.789Z')
  assert.equal(w.previous.start.toISOString(), '2026-02-25T00:00:00.000Z')
  assert.equal(w.previous.end.toISOString(), '2026-03-03T12:34:56.789Z')
})

test('all time does not invent a coverage start', () => {
  const w = analyticsWindow('all', new Date('2026-11-01T05:30:00Z'))
  assert.equal(w.start, null)
  assert.equal(w.previous, null)
})

test('invalid periods and instants are rejected', () => {
  for (const p of ['', '01', '8', null, ['7']]) assert.throws(() => parseAnalyticsPeriod(p), RangeError)
  assert.equal(parseAnalyticsPeriod(), 30)
  assert.throws(() => analyticsWindow(7, new Date('invalid')), RangeError)
})

test('averages require known positive coverage', () => {
  assert.equal(averagePerDay(0, 7), 0)
  assert.equal(averagePerDay(14, 7), 2)
  assert.equal(averagePerDay(14, null), null)
  assert.equal(averagePerDay(14, 0), null)
})

test('growth distinguishes missing coverage and zero baselines', () => {
  assert.deepEqual(growth(2, 1, true), { status: 'available', value: 100 })
  assert.deepEqual(growth(1, 0, true), { status: 'new-activity', value: null })
  assert.deepEqual(growth(0, 0, true), { status: 'no-activity', value: null })
  assert.deepEqual(growth(1, 1, false), { status: 'unavailable', value: null })
})
