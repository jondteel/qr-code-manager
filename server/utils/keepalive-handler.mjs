import { createHash, timingSafeEqual } from 'node:crypto'

const MAX_SECRET_BYTES = 4096
const MAX_AUTHORIZATION_BYTES = 8192

function isSafeIdentifier(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && /^[A-Za-z0-9:_-]+$/.test(value)
}

function matchesBearerSecret(authorization, secret) {
  if (typeof authorization !== 'string') return false
  if (Buffer.byteLength(authorization, 'utf8') > MAX_AUTHORIZATION_BYTES) return false

  const match = /^Bearer ([^\s]+)$/i.exec(authorization)
  if (!match || match[0] !== authorization || Buffer.byteLength(match[1], 'utf8') > MAX_SECRET_BYTES) return false

  const expectedDigest = createHash('sha256').update(secret, 'utf8').digest()
  const receivedDigest = createHash('sha256').update(match[1], 'utf8').digest()
  return timingSafeEqual(expectedDigest, receivedDigest)
}

function safePrismaCode(error) {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'query_failed'
  return typeof error.code === 'string' && /^P\d{4}$/.test(error.code)
    ? `prisma_${error.code.toLowerCase()}`
    : 'query_failed'
}

function writeDiagnostic(logger, method, fields) {
  logger[method](JSON.stringify({ event: 'scanlytics.keep_alive', ...fields }))
}

/**
 * Build the request handler with explicit I/O dependencies so its security and
 * query ordering can be exercised without a database or Nuxt runtime.
 */
export function createKeepAliveHandler({
  getSecret,
  getAuthorization,
  getRequestId,
  getDeploymentId,
  setResponseHeader,
  query,
  createHttpError,
  logger = console,
  now = () => new Date(),
  monotonicNow = () => performance.now(),
}) {
  return async function keepAlive(event) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    setResponseHeader(event, 'Pragma', 'no-cache')
    setResponseHeader(event, 'Expires', '0')

    const invocationAt = now().toISOString()
    const requestId = getRequestId?.(event)
    const deploymentId = getDeploymentId?.()
    const identifiers = {
      ...(isSafeIdentifier(requestId) ? { requestId } : {}),
      ...(isSafeIdentifier(deploymentId) ? { deploymentId } : {}),
    }

    const secret = getSecret()
    if (typeof secret !== 'string'
      || secret.length === 0
      || !/^[\x21-\x7e]+$/.test(secret)
      || Buffer.byteLength(secret, 'utf8') > MAX_SECRET_BYTES) {
      writeDiagnostic(logger, 'error', {
        timestamp: invocationAt,
        outcome: 'missing_configuration',
        ...identifiers,
      })
      throw createHttpError(500, 'Cron authentication is unavailable')
    }

    if (!matchesBearerSecret(getAuthorization(event), secret)) {
      writeDiagnostic(logger, 'warn', {
        timestamp: invocationAt,
        outcome: 'unauthorized',
        ...identifiers,
      })
      throw createHttpError(401, 'Unauthorized')
    }

    const queryStartedAt = monotonicNow()
    try {
      await query()
    } catch (error) {
      const queryDurationMs = Math.max(0, Math.round(monotonicNow() - queryStartedAt))
      writeDiagnostic(logger, 'error', {
        timestamp: invocationAt,
        outcome: 'database_error',
        errorClass: safePrismaCode(error),
        queryDurationMs,
        ...identifiers,
      })
      throw createHttpError(503, 'Database check unavailable')
    }

    const queryDurationMs = Math.max(0, Math.round(monotonicNow() - queryStartedAt))
    const checkedAt = now().toISOString()
    writeDiagnostic(logger, 'info', {
      timestamp: invocationAt,
      outcome: 'success',
      queryDurationMs,
      ...identifiers,
    })

    return { success: true, checkedAt }
  }
}
