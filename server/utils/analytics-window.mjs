// Calendar windows use UTC and one caller-supplied request instant.
const DAY = 86_400_000

export function parseAnalyticsPeriod(value) {
  if (value === undefined) return 30
  if (value === 'all') return 'all'
  if (value === '7' || value === '30' || value === '90' || value === 7 || value === 30 || value === 90) return Number(value)
  throw new RangeError('Invalid analytics period')
}

export function analyticsWindow(period, asOf) {
  if (Object.prototype.toString.call(asOf) !== '[object Date]' || !Number.isFinite(asOf.getTime())) throw new RangeError('Invalid asOf')
  if (period !== 'all' && ![7, 30, 90].includes(period)) throw new RangeError('Invalid analytics period')
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
  const end = new Date(asOf.getTime())
  if (period === 'all') return { start: null, end, previous: null }
  const start = new Date(today - (period - 1) * DAY)
  return {
    start, end,
    previous: { start: new Date(start.getTime() - period * DAY), end: new Date(end.getTime() - period * DAY) },
  }
}

export function averagePerDay(count, observedDays) {
  if (!Number.isFinite(count) || count < 0 || !Number.isFinite(observedDays) || observedDays <= 0) return null
  return count / observedDays
}

export function growth(current, previous, comparable) {
  if (!comparable || !Number.isFinite(current) || !Number.isFinite(previous) || current < 0 || previous < 0) return { status: 'unavailable', value: null }
  if (previous === 0) return { status: current === 0 ? 'no-activity' : 'new-activity', value: null }
  return { status: 'available', value: 100 * (current - previous) / previous }
}

// All-time totals retain all associated events; charts show a bounded UTC range.
export function chartWindow(window) {
  const today = Date.UTC(window.end.getUTCFullYear(), window.end.getUTCMonth(), window.end.getUTCDate())
  return { start: window.start ?? new Date(today - 364 * DAY), end: window.end }
}

export function dailySeries(scans, window) {
  const buckets = new Map()
  for (const scan of scans) {
    const time = new Date(scan.timestamp)
    if (time >= window.start && time < window.end) {
      const key = time.toISOString().slice(0, 10)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
  }
  const series = []
  for (let cursor = new Date(window.start); cursor < window.end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10)
    series.push({ date, scans: buckets.get(date) ?? 0 })
  }
  return series
}
