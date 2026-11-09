import { createError } from 'h3'
import { presentQr } from './qr-issuance.mjs'

import { QR_LIFECYCLES, lifecycleTransition } from './qr-lifecycle-state.mjs'

export async function transitionQr(prisma, { id, owner, status, config, environment, stage }) {
  if (!QR_LIFECYCLES.includes(status)) throw createError({ statusCode: 400, statusMessage: 'Invalid QR lifecycle' })
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`
    await tx.$executeRaw`SET LOCAL statement_timeout = '4s'`
    // Same QR-first lock order as destination edits. A concurrent losing writer
    // under RepeatableRead fails with a conflict, with no automatic retry.
    const locked = await tx.$queryRaw`SELECT "id" FROM "QRCode" WHERE "id" = ${id} AND "userId" = ${owner} FOR UPDATE`
    if (locked.length !== 1) throw createError({ statusCode: 404, statusMessage: 'QR code not found' })
    const before = await tx.qRCode.findFirst({ where: { id, userId: owner }, include: { shortUrl: true } })
    if (!before) throw createError({ statusCode: 404, statusMessage: 'QR code not found' })
    if (!lifecycleTransition(before.lifecycleStatus, status)) throw createError({ statusCode: 409, statusMessage: 'QR lifecycle transition unavailable' })
    // Do not touch an inconsistent/foreign association. No mapping writes occur.
    if (before.shortUrlId && (!before.shortUrl || before.shortUrl.id !== before.shortUrlId || before.shortUrl.userId !== owner))
      throw createError({ statusCode: 409, statusMessage: 'QR lifecycle could not be verified' })
    if (before.lifecycleStatus === status) return presentQr(before, owner, config, environment, stage)
    const after = await tx.qRCode.update({ where: { id }, data: { lifecycleStatus: status }, include: { shortUrl: true } })
    return presentQr(after, owner, config, environment, stage)
  }, { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 8000 })
}
