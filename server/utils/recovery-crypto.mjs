// Server-only, disconnected foundation. Never import from browser code.
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto'
export const PURPOSE = 'password-recovery'
const atom = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const proofPattern = /^(?:pkce_)?[a-f0-9]{56,128}$/
export function check(ok) { if (!ok) throw new Error('Recovery foundation refused') }
export function opaque() { return randomBytes(32).toString('base64url') }
export function canonicalOpaque(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value, 'base64url').toString('base64url') === value
}
export function email(value) {
  check(typeof value === 'string' && value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value))
  return value
}
export function config({ environment, project, activeKeyId, keys, recipientKey }) {
  check([environment, project, activeKeyId].every(v => typeof v === 'string' && atom.test(v)))
  check(keys instanceof Map && keys.has(activeKeyId) && Buffer.isBuffer(recipientKey) && recipientKey.length === 32)
  const copy = new Map()
  for (const [id, key] of keys) { check(typeof id === 'string' && atom.test(id) && Buffer.isBuffer(key) && key.length === 32); copy.set(id, Buffer.from(key)) }
  // Copy caller-owned buffers; never silently fall back to a default/unknown key.
  return { environment, project, activeKeyId, keys: copy, recipientKey: Buffer.from(recipientKey) }
}
const encode = values => Buffer.from(JSON.stringify(values), 'utf8')
const hmac = (key, values) => createHmac('sha256', key).update(encode(values)).digest('hex')
const digest = secret => createHash('sha256').update(encode(['scanalytics/recovery/secret/v1', secret])).digest('hex')
function same(a, b) {
  return typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}
export function recipientId(c, recipient) { return hmac(c.recipientKey, ['scanalytics/recovery/recipient/v1', c.environment, c.project, email(recipient)]) }
function tuple(g, proof) {
  check(g.version === 1 && g.purpose === PURPOSE && atom.test(g.environment) && atom.test(g.project) && uuid.test(g.subject))
  check(canonicalOpaque(g.selector) && atom.test(g.keyId) && /^[a-f0-9]{64}$/.test(g.recipientId))
  check(Number.isSafeInteger(g.generation) && g.generation > 0 && g.generation <= 2147483647)
  check(Number.isSafeInteger(g.issuedAtMs) && g.issuedAtMs > 0 && Number.isSafeInteger(g.expiresAtMs))
  check(g.expiresAtMs > g.issuedAtMs && g.expiresAtMs - g.issuedAtMs <= 600000)
  check(typeof proof === 'string' && proofPattern.test(proof))
  return ['scanalytics/recovery/proof/v1', g.version, g.environment, g.project, g.selector, g.subject, email(g.email), g.recipientId, g.purpose, g.generation, g.keyId, g.issuedAtMs, g.expiresAtMs, proof]
}
export function mint(c, { subject, recipient, proof, generation, issuedAtMs, expiresAtMs }) {
  const secret = opaque(), selector = opaque()
  const g = { version: 1, environment: c.environment, project: c.project, selector, subject,
    email: email(recipient), recipientId: recipientId(c, recipient), purpose: PURPOSE, generation,
    keyId: c.activeKeyId, issuedAtMs, expiresAtMs }
  const proofMac = hmac(c.keys.get(g.keyId), tuple(g, proof))
  return { record: { ...g, secretDigest: digest(secret), proofMac }, capability: `r1.${selector}.${secret}.${proof}` }
}
export function parse(capability) {
  check(typeof capability === 'string' && capability.length <= 300)
  const parts = capability.split('.')
  check(parts.length === 4 && parts[0] === 'r1' && canonicalOpaque(parts[1]) && canonicalOpaque(parts[2]) && proofPattern.test(parts[3]))
  check(parts.join('.') === capability)
  return { selector: parts[1], secret: parts[2], proof: parts[3] }
}
export function bound(c, g, capability, now) {
  try {
    const p = parse(capability), key = c.keys.get(g.keyId)
    check(key && g.environment === c.environment && g.project === c.project && g.selector === p.selector)
    check(Number.isSafeInteger(now) && now >= g.issuedAtMs && now < g.expiresAtMs)
    return same(g.secretDigest, digest(p.secret)) && same(g.proofMac, hmac(key, tuple(g, p.proof)))
  } catch { return false }
}
