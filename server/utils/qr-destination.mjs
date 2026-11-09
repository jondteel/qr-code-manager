import QRCode from 'qrcode'
import { createError } from 'h3'

const invalid = (message) => { throw createError({ statusCode: 400, statusMessage: message }) }

function bounded(value) {
  if (!value.trim()) invalid('QR content is required')
  if (Buffer.byteLength(value, 'utf8') > 2048) invalid('QR content exceeds 2048 UTF-8 bytes')
  // Reject unpaired UTF-16 surrogates rather than silently encoding replacement bytes.
  if (!value.isWellFormed()) invalid('QR content must be valid Unicode')
  return value
}

export function validateTrackedDestination(value) {
  // Outer JavaScript trim whitespace is removed. Controls (including outer newlines)
  // are rejected before parsing; the URL parser otherwise silently removes them.
  if (/[\u0000-\u001f\u007f-\u009f\\]/u.test(value)) invalid('Invalid tracked destination')
  const accepted = bounded(value.trim())
  if (/\s/u.test(accepted) || !/^https?:\/\/[^/?#]+(?:[/?#]|$)/i.test(accepted)) invalid('An absolute HTTP(S) destination is required')
  let url
  try { url = new URL(accepted) } catch { invalid('Invalid tracked destination') }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || /^https?:\/\/[^/?#]*@/i.test(accepted)) {
    invalid('Invalid tracked destination')
  }
  // Preserve the accepted trimmed spelling; do not serialize, lowercase, punycode,
  // percent-encode or otherwise rewrite it. Both persisted fields use this value.
  return accepted
}

export function validateDirectContent(value) {
  return bounded(value)
}

export function assertQrCapacity(payload, errorLevel) {
  try { QRCode.create(payload, { errorCorrectionLevel: errorLevel }) }
  catch { invalid('QR content cannot be encoded at the selected error correction level') }
}
