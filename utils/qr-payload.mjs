export function savedQrTarget(qr) {
  if (!qr || qr.lifecycleStatus === 'retired') return null
  // A server decision always overrides stale fields or legacy data fallbacks.
  if (qr.payloadState !== undefined || qr.payloadStatus !== undefined) {
    if (qr.payloadStatus !== 'available' || !['exact-issued', 'canonical-regeneration', 'direct-content'].includes(qr.payloadState)) return null
    return typeof qr.encodedTarget === 'string' && qr.encodedTarget.length ? qr.encodedTarget : null
  }
  if (qr.shortUrl || qr.shortUrlId || qr.mode === 'tracked') return qr.encodedTarget || null
  return qr.encodedTarget ?? qr.data ?? null
}

export function generatorQrTarget({ savedTarget, dirty, content, tracked }) {
  if (savedTarget && !dirty) return savedTarget
  return tracked ? content.trim() : content
}

export function savedQrNotice(qr) {
  if (!qr) return ''
  if (qr.lifecycleStatus === 'retired') return 'Retired. Tracked redirects are disabled and new scans are not accepted. Export is unavailable. Previously distributed direct-content images cannot be revoked.'
  if (qr.lifecycleStatus === 'archived' && savedQrTarget(qr)) return 'Archived. Existing tracked links and scan recording remain active.'
  if (qr.payloadState === 'canonical-regeneration' && savedQrTarget(qr)) {
    return 'The originally issued QR URL is unknown. This QR uses the verified current Scanlytics short link.'
  }
  if (qr.payloadStatus === 'issuance-origin-unknown') {
    return 'The originally issued QR URL is unknown. Canonical QR regeneration is currently unavailable.'
  }
  if (!savedQrTarget(qr)) return 'This saved QR target could not be verified. Preview, copy and download are unavailable.'
  return ''
}
