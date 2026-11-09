import { liveQrLifecycle } from './qr-lifecycle-state.mjs'
import { canonicalQrTarget, readQrSnapshot } from './qr-issuance.mjs'
import { validateTrackedDestination } from './qr-destination.mjs'

// F2's supported code/path contract, including its bounded encoded URL. This
// origin is a validation sentinel only; it is never an issuer or redirect.
export function supportedRedirectCode(code) {
  return Boolean(canonicalQrTarget('https://validation.example.invalid', code))
}

// H3 getRouterParam defaults to the raw radix3 segment. Decode exactly once;
// H3's optional decoder tolerates malformed escapes, which this route refuses.
export function decodeRedirectCode(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 6144) return null
  try {
    const code = decodeURIComponent(raw)
    return supportedRedirectCode(code) ? code : null
  } catch { return null }
}

export function redirectEligibility(link, code) {
  const unavailable = { available: false }
  if (!supportedRedirectCode(code) || !link || link.shortCode !== code || !link.id || !link.userId) return unavailable
  const qr = link.qrCode
  if (!liveQrLifecycle(qr?.lifecycleStatus)) return unavailable
  if (!qr?.id || qr.shortUrlId !== link.id || qr.userId !== link.userId || qr.data !== link.originalUrl) return unavailable
  try {
    if (typeof link.originalUrl !== 'string' || validateTrackedDestination(link.originalUrl) !== link.originalUrl) return unavailable
    if (qr.issuedEncodedTarget !== null) {
      const target = qr.issuedEncodedTarget
      if (typeof target !== 'string' || validateTrackedDestination(target) !== target) return unavailable
      // Establish exact path/code association without requiring a current or
      // guessed historical issuer. No query/fragment or alternative path.
      const match = /^https?:\/\/[^/?#]+(\/.*)$/i.exec(target)
      if (!match || match[1] !== `/s/${encodeURIComponent(code)}`) return unavailable
    }
    return { available: true, destination: link.originalUrl, shortUrlId: link.id, qrCodeId: qr.id }
  } catch { return unavailable }
}

export async function resolveRedirect(prisma, code) {
  if (!supportedRedirectCode(code)) return { available: false }
  // Prisma relation loading may issue multiple SELECTs. RepeatableRead keeps
  // mapping and reverse one-to-one QR in a single committed MVCC snapshot.
  // No locks, writes, repairs or retries. Scan logging remains outside it.
  return readQrSnapshot(prisma, async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const link = await tx.shortUrl.findUnique({
      where: { shortCode: code },
      select: {
        id: true, shortCode: true, originalUrl: true, userId: true,
        qrCode: { select: { id: true, shortUrlId: true, userId: true, data: true, issuedEncodedTarget: true, lifecycleStatus: true } },
      },
    })
    return redirectEligibility(link, code)
  })
}
