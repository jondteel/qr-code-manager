import { liveQrLifecycle } from './qr-lifecycle-state.mjs'
import { createError } from 'h3'
import { validateTrackedDestination, validateDirectContent, assertQrCapacity } from './qr-destination.mjs'

const productionOrigin = 'https://scanlytics.vercel.app'

// Platform markers are server environment values, never request data. Non-Vercel
// production is deliberately unsupported until an independent stage is designed.
export function resolveQrIssuanceOrigin(config, deploymentEnvironment, runtime = {}) {
  const fail = () => { throw createError({ statusCode: 503, statusMessage: 'QR issuance is unavailable' }) }
  const origin = config.qrIssuanceOrigin
  const environment = config.qrIssuanceEnvironment
  if (typeof origin !== 'string' || !['production', 'isolated'].includes(environment)) fail()
  let url
  try { url = new URL(origin) } catch { fail() }
  if (url.origin !== origin || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail()
  const vercelStage = runtime.vercel === '1' && ['production', 'preview', 'development'].includes(deploymentEnvironment)
  const localStage = !runtime.vercel && !deploymentEnvironment && ['development', 'test'].includes(runtime.nodeEnv)
  if (!vercelStage && !localStage) fail()
  if (environment === 'production') {
    if (!vercelStage || deploymentEnvironment !== 'production' || origin !== productionOrigin || url.protocol !== 'https:') fail()
  } else {
    if (deploymentEnvironment === 'production' || origin === productionOrigin) fail()
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail()
  }
  return origin
}

export function issuedQrTarget(origin, shortCode) {
  return `${origin}/s/${encodeURIComponent(shortCode)}`
}

export function serverQrStage(env) {
  return { vercel: env.VERCEL, nodeEnv: env.NODE_ENV }
}

function supportedShortCode(code) {
  return typeof code === 'string' && code.length > 0 && code.isWellFormed() &&
    !['.', '..'].includes(code) && !/[\u0000-\u001f\u007f-\u009f/\\]/u.test(code)
}

function coherentMapping(qr, owner) {
  const link = qr.shortUrl
  return Boolean(owner && qr.userId === owner && qr.shortUrlId && link &&
    link.id === qr.shortUrlId && link.userId === owner && supportedShortCode(link.shortCode) && qr.data === link.originalUrl)
}

// Deliberate true only; Nuxt can deserialize runtime env values to booleans.
export function legacyCanonicalEnabled(value) {
  return value === true || value === 'true'
}

// Compatibility is an operator assertion following independent verification,
// never inferred from a hostname, incoming request, or mere code existence.
// Bind it to the stage, issuer and known public route/mapping-store contract.
export function resolveLegacyCanonicalOrigin(config, deploymentEnvironment, runtime) {
  if (!legacyCanonicalEnabled(config?.qrLegacyCanonicalRegenEnabled)) return null
  try {
    const origin = resolveQrIssuanceOrigin(config, deploymentEnvironment, runtime)
    const expected = `${config.qrIssuanceEnvironment}|${origin}/s/[code]|same-store-v1`
    if (config.qrLegacyCanonicalCompatibility !== expected) return null
    return origin
  } catch { return null }
}

// Preserve the F1 route/code contract, including non-nanoid historical codes.
// Deployment verification must cover exact platform decoding; never normalize.
export function canonicalQrTarget(origin, shortCode) {
  if (!supportedShortCode(shortCode) || typeof origin !== 'string') return null
  try {
    const url = new URL(origin)
    if (url.origin !== origin || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null
    const target = issuedQrTarget(origin, shortCode)
    if (validateTrackedDestination(target) !== target) return null
    return target
  } catch { return null }
}

/**
 * @typedef {{payloadState:'exact-issued', encodedTarget:string} |
 * {payloadState:'canonical-regeneration', encodedTarget:string} |
 * {payloadState:'direct-content', encodedTarget:string} |
 * {payloadState:'unavailable', encodedTarget:null}} QrExportDecision
 */

/** @returns {QrExportDecision & {mode:string, payloadStatus:string, payloadProvenance:string}} */
export function storedQrPayload(qr, owner, config, deploymentEnvironment, runtime) {
  const known = qr.issuedEncodedTarget != null
  const tracked = Boolean(qr.shortUrl || qr.shortUrlId || known)
  const payload = {
    mode: tracked ? 'tracked' : 'direct', encodedTarget: null,
    payloadStatus: 'unavailable', payloadState: /** @type {'unavailable'} */ ('unavailable'),
    payloadProvenance: tracked ? (known ? 'issued' : 'unknown') : 'direct-content',
  }
  if (!owner || qr.userId !== owner) return payload
  if (!liveQrLifecycle(qr.lifecycleStatus)) return payload
  if (!tracked) {
    try {
      validateDirectContent(qr.data)
      assertQrCapacity(qr.data, qr.errorLevel || 'M')
      return { ...payload, encodedTarget: qr.data, payloadStatus: 'available', payloadState: 'direct-content' }
    } catch { return payload }
  }
  if (!coherentMapping(qr, owner)) return payload
  try {
    if (validateTrackedDestination(qr.data) !== qr.data ||
        validateTrackedDestination(qr.shortUrl.originalUrl) !== qr.shortUrl.originalUrl) return payload
    if (!known) {
      // Undefined/missing provenance is not positive evidence of historical null.
      const origin = resolveLegacyCanonicalOrigin(config, deploymentEnvironment, runtime)
      if (!origin) return { ...payload, payloadStatus: 'issuance-origin-unknown' }
      if (qr.issuedEncodedTarget !== null) return payload
      const target = canonicalQrTarget(origin, qr.shortUrl.shortCode)
      if (!target) return payload
      assertQrCapacity(target, qr.errorLevel || 'M')
      return { ...payload, encodedTarget: target, payloadStatus: 'available',
        payloadProvenance: 'canonical-regeneration', payloadState: 'canonical-regeneration' }
    }
    const target = qr.issuedEncodedTarget
    if (typeof target !== 'string' || validateTrackedDestination(target) !== target) return payload
    // Only the currently supported, independently staged issuer is established.
    // Retired/unknown hosts remain stored but unavailable; never substitute hosts.
    const origin = resolveQrIssuanceOrigin(config, deploymentEnvironment, runtime)
    if (target !== issuedQrTarget(origin, qr.shortUrl.shortCode)) return payload
    assertQrCapacity(target, qr.errorLevel || 'M')
    return { ...payload, encodedTarget: target, payloadStatus: 'available', payloadState: 'exact-issued' }
  } catch {
    return payload
  }
}

// Keep internal provenance and ownership out of public records. A foreign or
// incoherent association must never disclose its code/destination/identity.
export function presentQr(qr, owner, config, deploymentEnvironment, runtime) {
  const { userId, issuedEncodedTarget, shortUrl, ...publicQr } = qr
  const { userId: linkOwner, ...publicLink } = shortUrl || {}
  return {
    ...publicQr,
    ...(Object.hasOwn(qr, 'shortUrlId') ? { shortUrlId: coherentMapping(qr, owner) ? qr.shortUrlId : null } : {}),
    shortUrl: coherentMapping(qr, owner) ? publicLink : null,
    ...storedQrPayload(qr, owner, config, deploymentEnvironment, runtime),
  }
}

// Prisma 5's nested relation reads can use more than one SQL statement. All
// statements for a QR/mapping pair must see the same repeatable-read snapshot.
export function readQrSnapshot(prisma, read) {
  return prisma.$transaction(read, { isolationLevel: 'RepeatableRead' })
}
