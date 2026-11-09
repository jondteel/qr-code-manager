// GoTrue v2.197.0 shares recovery and magic-link verification storage.
// Fixed type, SDK events and fresh identity cannot prove issuance purpose.
// Keep completion unavailable until a separately approved purpose-preserving
// authority is implemented. Do not consume proof, create a session or mutate Auth.
export async function completeRecovery(_auth, body) {
  if (!body || typeof body !== 'object' || Object.keys(body).some(k => !['email','token','tokenHash','password','confirmation'].includes(k))) return { state: 'invalid-input' }
  if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 128 || body.password !== body.confirmation) return { state: 'invalid-password' }
  const hashed = typeof body.tokenHash === 'string' && /^[a-fA-F0-9]{32,256}$/.test(body.tokenHash)
  const otp = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) && body.email.length <= 254 && typeof body.token === 'string' && /^[0-9]{6,10}$/.test(body.token)
  if ((!hashed && !otp) || (hashed && (body.email || body.token))) return { state: 'recovery-proof-required' }
  return { state: 'recovery-unavailable' }
}
