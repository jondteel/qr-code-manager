// One awaited attempt; never retry an uncertain commit. No detached work.
export const SCAN_TRANSACTION_LIMITS = Object.freeze({ maxWait: 1000, timeout: 1500 })

function classify(error) {
  // Allowlisted categories only; never return driver messages, metadata or IDs.
  if (error?.code === 'SCAN_RESPONSE_INVALID') return { outcome: 'unknown', reason: 'invalid-response' }
  if (error?.code === 'P2028') return { outcome: 'unknown', reason: 'transaction-timeout-or-closed' }
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error?.code)) return { outcome: 'unknown', reason: 'connection-or-pool' }
  if (['P2002', 'P2003', 'P2004', 'P2011', 'P2014'].includes(error?.code)) return { outcome: 'failed', reason: 'constraint' }
  // PostgreSQL statement/lock cancellation aborts the transaction. Prisma's
  // generated create can surface this as UnknownRequestError: do not parse it.
  if (error?.code === 'P2010' && ['57014', '55P03'].includes(error?.meta?.code)) return { outcome: 'failed', reason: 'database-timeout' }
  return { outcome: 'unknown', reason: 'write-error' }
}

export async function recordRedirectScan(prisma, data, logger = console) {
  let result
  try {
    const receipt = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '750ms'`
      await tx.$executeRaw`SET LOCAL lock_timeout = '500ms'`
      // Recheck the current lifecycle and hold a share lock until scan commit.
      // Retirement/edit FOR UPDATE waits; if retirement won, admit no scan.
      const eligible = await tx.$queryRaw`SELECT "id" FROM "QRCode" WHERE "id" = ${data.qrCodeId} AND "shortUrlId" = ${data.shortUrlId} AND "lifecycleStatus" IN ('active', 'archived') FOR SHARE`
      if (eligible.length !== 1) return null
      const row = await tx.analytics.create({ data, select: { id: true } })
      if (!row || typeof row.id !== 'string' || !row.id) {
        const error = new Error('Scan response unavailable')
        error.code = 'SCAN_RESPONSE_INVALID'
        throw error
      }
      return row.id
    }, SCAN_TRANSACTION_LIMITS)
    if (receipt === null) return { outcome: 'skipped', reason: 'lifecycle-unavailable' }
    if (typeof receipt !== 'string' || !receipt) {
      const error = new Error('Scan response unavailable')
      error.code = 'SCAN_RESPONSE_INVALID'
      throw error
    }
    // Success only after the transaction promise (including commit) resolves.
    result = { outcome: 'succeeded', reason: 'committed' }
  } catch (error) {
    result = classify(error)
  }
  // Resolution is independent of persistence. Bounded static fields only.
  try {
    const entry = { event: 'redirect-scan', redirect: 'resolved', ...result }
    if (result.outcome === 'succeeded') logger.info(entry)
    else logger.error(entry)
  } catch { /* A logging sink failure must not cancel a safely resolved redirect. */ }
  return result
}
