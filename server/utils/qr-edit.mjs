import { liveQrLifecycle } from './qr-lifecycle-state.mjs'
import { createError } from 'h3'
import { validateTrackedDestination, validateDirectContent, assertQrCapacity } from './qr-destination.mjs'
import { canonicalQrTarget, storedQrPayload, presentQr } from './qr-issuance.mjs'

const conflict = () => { throw createError({ statusCode: 409, statusMessage: 'QR edit could not be verified; reload before trying again' }) }
const notFound = () => { throw createError({ statusCode: 404, statusMessage: 'QR code not found' }) }
const tracked = (qr) => Boolean(qr.shortUrlId || qr.shortUrl || qr.issuedEncodedTarget != null)
const include = { shortUrl: { include: { qrCode: { select: { id: true, userId: true, shortUrlId: true } } } } }

function verifyMapping(qr, owner, config, environment, stage) {
  const link = qr.shortUrl
  if (qr.userId !== owner || !qr.shortUrlId || !link || link.id !== qr.shortUrlId || link.userId !== owner ||
      !link.qrCode || link.qrCode.id !== qr.id || link.qrCode.userId !== owner || link.qrCode.shortUrlId !== link.id) conflict()
  try {
    if (validateTrackedDestination(qr.data) !== qr.data || validateTrackedDestination(link.originalUrl) !== link.originalUrl ||
        qr.data !== link.originalUrl || !canonicalQrTarget('https://validation.example.invalid', link.shortCode)) conflict()
  } catch { conflict() }
  // Null historical issuance stays editable without activating regeneration.
  // Known issuance must satisfy the same issuer/code/capacity contract as F1/F2.
  if (qr.issuedEncodedTarget !== null && storedQrPayload(qr, owner, config, environment, stage).payloadState !== 'exact-issued') conflict()
}

function publicResult(qr, owner, config, environment, stage) {
  // The reverse ownership relation is private edit validation evidence only.
  const clean = { ...qr, shortUrl: qr.shortUrl && (({ qrCode, ...link }) => link)(qr.shortUrl) }
  return presentQr(clean, owner, config, environment, stage)
}

export function isQrEditConflict(error) {
  return ['P2034', 'P2025', 'P2028'].includes(error?.code) ||
    (error?.code === 'P2010' && ['40001', '40P01', '55P03', '57014'].includes(error?.meta?.code))
}

export async function editQr(prisma, { id, owner, changes, config, environment, stage }) {
  // No retries: a losing request must reload/revalidate rather than overwrite a
  // winning edit. Locks cover only this QR and its current mapping, in that order.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`
    await tx.$executeRaw`SET LOCAL statement_timeout = '4s'`
    const profile = await tx.user.findUnique({ where: { id: owner }, select: { id: true } })
    if (!profile) notFound()
    const locked = await tx.$queryRaw`SELECT "id" FROM "QRCode" WHERE "id" = ${id} AND "userId" = ${profile.id} FOR UPDATE`
    if (locked.length !== 1) notFound()
    const before = await tx.qRCode.findFirst({ where: { id, userId: owner }, include })
    if (!before) notFound()
    if (!liveQrLifecycle(before.lifecycleStatus)) conflict()
    const contentEdit = Object.hasOwn(changes, 'data')
    const renderingEdit = ['size', 'errorLevel', 'fgColor', 'bgColor'].some((key) => Object.hasOwn(changes, key) && changes[key] !== before[key])
    if (before.shortUrlId) {
      const links = await tx.$queryRaw`SELECT "id" FROM "ShortUrl" WHERE "id" = ${before.shortUrlId} AND "userId" = ${owner} FOR UPDATE`
      if (links.length !== 1 && (contentEdit || renderingEdit)) conflict()
    }
    const isTracked = tracked(before)
    // Unchanged settings sent by existing clients do not turn title corrections
    // into rendering edits on a historical unavailable record.
    const data = { ...changes }
    if (isTracked && (contentEdit || renderingEdit)) verifyMapping(before, owner, config, environment, stage)
    if (contentEdit) data.data = isTracked ? validateTrackedDestination(data.data) : validateDirectContent(data.data)
    const candidate = { ...before, ...data, shortUrl: before.shortUrl && { ...before.shortUrl, originalUrl: data.data ?? before.data } }
    if (!isTracked && (contentEdit || renderingEdit)) {
      validateDirectContent(candidate.data)
      assertQrCapacity(candidate.data, candidate.errorLevel)
    }
    if (isTracked && renderingEdit && storedQrPayload(candidate, owner, config, environment, stage).payloadStatus !== 'available') conflict()
    // QR first; either write or final verification failure rolls back both.
    await tx.qRCode.update({ where: { id }, data })
    if (isTracked && contentEdit) await tx.shortUrl.update({ where: { id: before.shortUrlId }, data: { originalUrl: data.data } })
    const after = await tx.qRCode.findFirst({ where: { id, userId: owner }, include })
    if (!after || ['id', 'userId', 'shortUrlId', 'issuedEncodedTarget'].some((key) => after[key] !== before[key]) ||
        String(after.createdAt) !== String(before.createdAt) || tracked(after) !== isTracked ||
        Object.entries(data).some(([key, value]) => after[key] !== value)) conflict()
    if (isTracked && (contentEdit || renderingEdit)) {
      verifyMapping(after, owner, config, environment, stage)
      if (['id', 'userId', 'shortCode'].some((key) => after.shortUrl[key] !== before.shortUrl[key])) conflict()
    }
    if (!contentEdit && (after.data !== before.data || after.shortUrl?.originalUrl !== before.shortUrl?.originalUrl)) conflict()
    return publicResult(after, owner, config, environment, stage)
  }, { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 8000 })
}
