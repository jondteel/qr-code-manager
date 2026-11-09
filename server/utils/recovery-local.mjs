// Default-OFF, deliberately task-local integration. No production activation path.
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { config, check } from './recovery-crypto.mjs'
import { recoveryLedger } from './recovery-ledger.mjs'
import { recoveryIntegration } from './recovery-integration.mjs'
import { fetchWithRetry } from '../../utils/auth-fetch.mjs'
let runtime
export function localRecovery() {
  if (process.env.SCANLYTICS_RECOVERY_LOCAL !== 'c8c-01a15769-local-only') return Promise.resolve(null)
  runtime ||= initialize().catch(() => null)
  return runtime
}
async function initialize() {
  const origin = 'http://127.0.0.1:58300', projectOrigin = 'http://127.0.0.1:58321'
  const url = 'postgresql://c8c_owner@127.0.0.1:59488/c8c_app_01a15769?connection_limit=8'
  check(process.env.DATABASE_URL === url && process.env.NUXT_AUTH_SITE_ORIGIN === origin)
  check(process.env.NUXT_PUBLIC_SUPABASE_URL === projectOrigin && process.env.SCANLYTICS_RECOVERY_PROVIDER_EXPIRY === '60')
  const dataDir = process.env.SCANLYTICS_RECOVERY_PG_DATA_DIR?.replaceAll('\\', '/')
  check(dataDir?.endsWith('/01a15769-7328-7940-a8ac-6a977b8b8b1a/pg17-c8c'))
  const db = new PrismaClient({ datasources: { db: { url } }, log: [] })
  try {
    const identity = (await db.$queryRaw`SELECT current_setting('data_directory') AS dir, current_database() AS name, current_user AS owner, system_identifier::text AS id FROM pg_control_system()`)[0]
    check(identity.dir.replaceAll('\\','/') === dataDir && identity.name === 'c8c_app_01a15769' && identity.owner === 'c8c_owner' && identity.id === process.env.SCANLYTICS_RECOVERY_PG_ID)
    const health = await fetchWithRetry(projectOrigin + '/auth/v1/health')
    check(health.ok && (await health.json()).version === 'v2.197.0')
    const key = Buffer.from(process.env.SCANLYTICS_RECOVERY_BINDING_KEY || '', 'base64url')
    const recipientKey = Buffer.from(process.env.SCANLYTICS_RECOVERY_RECIPIENT_KEY || '', 'base64url')
    const c = config({ environment: 'isolated-c8c', project: 'scanalytics-c5-01a15285', activeKeyId: 'c8c', keys: new Map([['c8c', key]]), recipientKey })
    const sdk = key => createClient(projectOrigin, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
      if (new URL(typeof input === 'string' ? input : input.url).origin !== projectOrigin) return Promise.reject(new Error('Recovery origin refused'))
      return fetchWithRetry(input, init)
    } } })
    const admin = sdk(process.env.SCANLYTICS_RECOVERY_ADMIN_KEY)
    return recoveryIntegration({ ledger: recoveryLedger(db,c), admin, userClient: () => sdk(process.env.NUXT_PUBLIC_SUPABASE_KEY), origin, projectOrigin, providerLifetimeMs: 60000,
      // Fixed codes only; no provider errors or account/credential context.
      observe: code => console.warn('Scanlytics recovery operator review required:', code),
      async deliver({ recipient, url }) {
        check(recipient.endsWith('@example.test') && url.startsWith(origin + '/auth/recovery#r1.'))
        const response = await fetchWithRetry('http://127.0.0.1:58324/api/v1/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ From: { Email: 'recovery@example.test', Name: 'Scanlytics local fixture' }, To: [{ Email: recipient }], Subject: 'Scanlytics local password recovery', Text: 'Open this link to choose a new password. It expires within one minute.\n\n' + url + '\n\nAfter recovery, sign in explicitly. If you did not request this, ignore this message.' }) })
        check(response.ok)
      },
    })
  } catch { await db.$disconnect(); return null }
}
